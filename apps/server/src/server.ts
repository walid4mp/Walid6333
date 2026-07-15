import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { v4 as uuid } from 'uuid';
import { z } from 'zod';
import { ChessAI, ChessEngine, STANDARD_START_FEN } from '../../../packages/shared/src/index.js';
import { hashPassword, requireAuth, signToken, verifyPassword, verifyToken, type AuthPayload, type AuthedRequest } from './auth.js';
import { db, initDb } from './db.js';

const PORT = Number(process.env.PORT || 4200);

function resolveProjectRoot() {
  const currentFileDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    process.cwd(),
    resolve(process.cwd(), '../..'),
    resolve(currentFileDir, '../../../../../..'),
    resolve(currentFileDir, '../../../../..'),
  ];

  for (const candidate of candidates) {
    if (existsSync(resolve(candidate, 'apps/web'))) {
      return candidate;
    }
  }

  return process.cwd();
}

const projectRoot = resolveProjectRoot();
const configuredOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const webDistDir = resolve(projectRoot, 'apps/web/dist');
const uploadsDir = resolve(process.env.UPLOAD_DIR || resolve(projectRoot, process.env.RENDER === 'true' ? 'var/data/uploads' : 'uploads'));
const ai = new ChessAI();

mkdirSync(uploadsDir, { recursive: true });
initDb();

const allowOrigin = (origin?: string | null) => {
  if (!origin) return true;
  if (configuredOrigins.length === 0) return true;
  return configuredOrigins.includes(origin);
};

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => callback(null, allowOrigin(origin)),
    credentials: true,
  },
});

app.use(cors({
  origin: (origin, callback) => callback(null, allowOrigin(origin)),
  credentials: true,
}));
app.use(helmet({
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", 'https:', 'data:'],
      imgSrc: ["'self'", 'https:', 'data:', 'blob:'],
      mediaSrc: ["'self'", 'https:', 'data:', 'blob:'],
      connectSrc: ["'self'", 'https:', 'http:', 'ws:', 'wss:'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
      objectSrc: ["'none'"],
    },
  },
}));
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));
app.use(rateLimit({ windowMs: 60_000, max: 180 }));
app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }));

const sanitize = (value: string) => value.trim().replace(/[<>]/g, '');
const now = () => new Date().toISOString();
const publicAssetUrl = (req: express.Request, relativePath: string) => {
  if (configuredOrigins[0]) return `${configuredOrigins[0]}${relativePath}`;
  return `${req.protocol}://${req.get('host')}${relativePath}`;
};

const registerSchema = z.object({
  username: z.string().min(3).max(24),
  email: z.string().email(),
  password: z.string().min(8).max(64),
});
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8).max(64) });
const roomSchema = z.object({
  name: z.string().min(3).max(50),
  visibility: z.enum(['public', 'private', 'password']),
  password: z.string().min(4).max(32).optional(),
  maxPlayers: z.number().min(2).max(16).default(2),
  timeControl: z.string().default('blitz'),
  incrementSeconds: z.number().min(0).max(60).default(0),
});
const moveSchema = z.object({
  from: z.string().length(2),
  to: z.string().length(2),
  promotion: z.enum(['q', 'r', 'b', 'n']).optional(),
});
const uploadImageSchema = z.object({
  fileName: z.string().min(1).max(120).optional(),
  dataUrl: z.string().min(30),
});

function getOptionalAuth(req: express.Request): AuthPayload | undefined {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return undefined;
  try {
    return verifyToken(auth.slice(7));
  } catch {
    return undefined;
  }
}

function getUserByEmail(email: string) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
}
function getUserById(id: string) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
}
function getSettings(userId: string) {
  return db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId) as any;
}
function roomExists(roomId: string) {
  return Boolean(db.prepare('SELECT 1 FROM rooms WHERE id = ?').get(roomId));
}
function ensureWallet(userId: string) {
  db.prepare('INSERT OR IGNORE INTO wallets (user_id, coins, gems, tickets, updated_at) VALUES (?, ?, ?, ?, ?)').run(userId, 12450, 3200, 5, now());
}

function createNotification(userId: string, type: string, title: string, body: string) {
  db.prepare('INSERT INTO notifications (id, user_id, type, title, body, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(uuid(), userId, type, title, body, now());
}

function createWalletTransaction(userId: string, kind: string, currency: 'coins' | 'gems' | 'tickets', amount: number, metadata: Record<string, unknown> = {}) {
  db.prepare('INSERT INTO wallet_transactions (id, user_id, kind, currency, amount, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(uuid(), userId, kind, currency, amount, JSON.stringify(metadata), now());
}

function addWalletBalance(userId: string, patch: { coins?: number; gems?: number; tickets?: number }, kind: string, metadata: Record<string, unknown> = {}) {
  ensureWallet(userId);
  const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(userId) as any;
  const coins = wallet.coins + (patch.coins ?? 0);
  const gems = wallet.gems + (patch.gems ?? 0);
  const tickets = wallet.tickets + (patch.tickets ?? 0);
  db.prepare('UPDATE wallets SET coins = ?, gems = ?, tickets = ?, updated_at = ? WHERE user_id = ?').run(coins, gems, tickets, now(), userId);
  if (patch.coins) createWalletTransaction(userId, kind, 'coins', patch.coins, metadata);
  if (patch.gems) createWalletTransaction(userId, kind, 'gems', patch.gems, metadata);
  if (patch.tickets) createWalletTransaction(userId, kind, 'tickets', patch.tickets, metadata);
  return db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(userId);
}

function seedUserExperience(userId: string) {
  ensureWallet(userId);
  const notificationCount = Number((db.prepare('SELECT COUNT(*) AS total FROM notifications WHERE user_id = ?').get(userId) as any)?.total || 0);
  if (notificationCount === 0) {
    createNotification(userId, 'welcome', 'مرحبًا بك في WARHEX', 'تم تجهيز حسابك والبدء برصيد افتتاحي وهدايا دخول يومية.');
    createNotification(userId, 'event', 'بطولة المبتدئين', 'شارك في أول بطولة لك واربح ذهبًا وجواهر.');
    createNotification(userId, 'reward', 'مكافأة يومية جاهزة', 'يمكنك الآن المطالبة بمكافأتك اليومية من مركز المكافآت.');
  }
  const achievementCount = Number((db.prepare('SELECT COUNT(*) AS total FROM achievements WHERE user_id = ?').get(userId) as any)?.total || 0);
  if (achievementCount === 0) {
    db.prepare('INSERT INTO achievements (id, user_id, code, title, description, unlocked_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuid(), userId, 'first-login', 'خطوة البداية', 'سجلت دخولك الأول إلى WARHEX.', now());
    db.prepare('INSERT INTO achievements (id, user_id, code, title, description, unlocked_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(uuid(), userId, 'premium-ready', 'جاهز للمعركة', 'أصبحت جاهزًا لخوض أول مباراة احترافية.', now());
  }
}
function listRooms(currentUserId?: string) {
  const rows = db.prepare(`
    SELECT r.*, u.username AS host_username,
      (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id) AS member_count
    FROM rooms r
    JOIN users u ON u.id = r.host_user_id
    ORDER BY r.created_at DESC
  `).all() as Array<Record<string, any>>;

  if (!currentUserId) {
    return rows.map((room) => ({ ...room, is_member: false }));
  }

  const membershipRows = db.prepare('SELECT room_id FROM room_members WHERE user_id = ?').all(currentUserId) as Array<{ room_id: string }>;
  const membership = new Set(membershipRows.map((entry) => entry.room_id));
  return rows.map((room) => ({ ...room, is_member: membership.has(room.id) }));
}
function listRoomMembers(roomId: string) {
  return db.prepare(`
    SELECT rm.room_id, rm.user_id, rm.role, rm.joined_at, u.username, u.avatar_url, u.rating
    FROM room_members rm
    JOIN users u ON u.id = rm.user_id
    WHERE rm.room_id = ?
    ORDER BY CASE rm.role WHEN 'host' THEN 0 ELSE 1 END, rm.joined_at ASC
  `).all(roomId);
}
function getFriendsPayload(userId: string) {
  const friends = db.prepare(`
    SELECT f.user_id, f.friend_id, f.status, f.created_at,
      CASE WHEN f.user_id = ? THEN u2.id ELSE u1.id END AS friend_user_id,
      CASE WHEN f.user_id = ? THEN u2.username ELSE u1.username END AS friend_username,
      CASE WHEN f.user_id = ? THEN u2.avatar_url ELSE u1.avatar_url END AS friend_avatar_url,
      CASE WHEN f.user_id = ? THEN u2.rating ELSE u1.rating END AS friend_rating
    FROM friends f
    JOIN users u1 ON u1.id = f.user_id
    JOIN users u2 ON u2.id = f.friend_id
    WHERE (f.user_id = ? OR f.friend_id = ?)
      AND f.status = 'accepted'
    ORDER BY f.created_at DESC
  `).all(userId, userId, userId, userId, userId, userId);

  const incoming = db.prepare(`
    SELECT f.user_id AS requester_id, u.username AS requester_username, u.avatar_url AS requester_avatar_url, u.rating AS requester_rating, f.created_at
    FROM friends f
    JOIN users u ON u.id = f.user_id
    WHERE f.friend_id = ? AND f.status = 'pending'
    ORDER BY f.created_at DESC
  `).all(userId);

  const outgoing = db.prepare(`
    SELECT f.friend_id AS target_id, u.username AS target_username, u.avatar_url AS target_avatar_url, u.rating AS target_rating, f.created_at
    FROM friends f
    JOIN users u ON u.id = f.friend_id
    WHERE f.user_id = ? AND f.status = 'pending'
    ORDER BY f.created_at DESC
  `).all(userId);

  return { friends, incoming, outgoing };
}

function getFriendStatus(userId: string, targetId: string) {
  const relation = db.prepare(`
    SELECT * FROM friends
    WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
    LIMIT 1
  `).get(userId, targetId, targetId, userId) as any;
  if (!relation) return 'none';
  if (relation.status === 'accepted') return 'accepted';
  if (relation.user_id === userId) return 'outgoing';
  return 'incoming';
}

function listMessages(currentUserId: string, options: { scope?: string; roomId?: string; receiverUserId?: string }) {
  const scope = options.scope || 'global';
  if (scope === 'private' && options.receiverUserId) {
    return db.prepare(`
      SELECT m.*, m.room_id AS roomId, m.sender_user_id AS senderUserId, m.receiver_user_id AS receiverUserId, m.created_at AS createdAt, u.username AS sender_username, u.avatar_url AS sender_avatar_url
      FROM messages m
      JOIN users u ON u.id = m.sender_user_id
      WHERE m.scope = 'private'
        AND ((m.sender_user_id = ? AND m.receiver_user_id = ?) OR (m.sender_user_id = ? AND m.receiver_user_id = ?))
      ORDER BY m.created_at ASC
      LIMIT 100
    `).all(currentUserId, options.receiverUserId, options.receiverUserId, currentUserId);
  }

  if (options.roomId) {
    return db.prepare(`
      SELECT m.*, m.room_id AS roomId, m.sender_user_id AS senderUserId, m.receiver_user_id AS receiverUserId, m.created_at AS createdAt, u.username AS sender_username, u.avatar_url AS sender_avatar_url
      FROM messages m
      JOIN users u ON u.id = m.sender_user_id
      WHERE m.room_id = ?
      ORDER BY m.created_at ASC
      LIMIT 100
    `).all(options.roomId);
  }

  return db.prepare(`
    SELECT m.*, m.room_id AS roomId, m.sender_user_id AS senderUserId, m.receiver_user_id AS receiverUserId, m.created_at AS createdAt, u.username AS sender_username, u.avatar_url AS sender_avatar_url
    FROM messages m
    JOIN users u ON u.id = m.sender_user_id
    WHERE m.scope = ?
    ORDER BY m.created_at ASC
    LIMIT 100
  `).all(scope);
}
function updateUserRecord(userId: string, changes: { wins?: number; losses?: number; draws?: number; streakReset?: boolean; streakIncrement?: boolean }) {
  const user = getUserById(userId);
  if (!user) return;

  const nextWins = user.wins + (changes.wins ?? 0);
  const nextLosses = user.losses + (changes.losses ?? 0);
  const nextDraws = user.draws + (changes.draws ?? 0);
  const nextStreak = changes.streakReset ? 0 : changes.streakIncrement ? user.streak + 1 : user.streak;
  const nextMaxStreak = Math.max(user.max_streak, nextStreak);

  db.prepare('UPDATE users SET wins = ?, losses = ?, draws = ?, streak = ?, max_streak = ?, updated_at = ? WHERE id = ?')
    .run(nextWins, nextLosses, nextDraws, nextStreak, nextMaxStreak, now(), userId);
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'royal-square-server',
    webBundlePresent: existsSync(resolve(webDistDir, 'index.html')),
  });
});

app.post('/api/auth/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const username = sanitize(parsed.data.username);
  const email = sanitize(parsed.data.email.toLowerCase());
  if (getUserByEmail(email)) return res.status(409).json({ message: 'Email already in use' });
  const existingUsername = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existingUsername) return res.status(409).json({ message: 'Username already in use' });

  const id = uuid();
  const timestamp = now();
  const passwordHash = await hashPassword(parsed.data.password);
  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, created_at, updated_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, username, email, passwordHash, timestamp, timestamp, timestamp);
  db.prepare('INSERT INTO settings (user_id) VALUES (?)').run(id);
  ensureWallet(id);
  seedUserExperience(id);

  const token = signToken({ sub: id, username });
  res.status(201).json({ token, user: getUserById(id), settings: getSettings(id) });
});

app.post('/api/auth/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const email = sanitize(parsed.data.email.toLowerCase());
  const user = getUserByEmail(email);
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const valid = await verifyPassword(parsed.data.password, user.password_hash);
  if (!valid) return res.status(401).json({ message: 'Invalid credentials' });
  db.prepare('UPDATE users SET last_seen_at = ?, updated_at = ? WHERE id = ?').run(now(), now(), user.id);
  res.json({ token: signToken({ sub: user.id, username: user.username }), user: getUserById(user.id), settings: getSettings(user.id) });
});

app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
  const user = getUserById(req.auth!.sub);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ user, settings: getSettings(user.id), wallet: db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(user.id) });
});

app.post('/api/uploads/image', requireAuth, (req: AuthedRequest, res) => {
  const parsed = uploadImageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const match = parsed.data.dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/);
  if (!match) return res.status(400).json({ message: 'Unsupported image format' });

  const [, rawExtension, base64Payload] = match;
  const buffer = Buffer.from(base64Payload, 'base64');
  if (buffer.byteLength > 3 * 1024 * 1024) {
    return res.status(413).json({ message: 'Image is too large' });
  }

  const extension = rawExtension === 'jpeg' ? 'jpg' : rawExtension;
  const fileName = `${req.auth!.sub}-${Date.now()}-${uuid()}.${extension}`;
  const outputPath = resolve(uploadsDir, fileName);
  writeFileSync(outputPath, buffer);

  res.status(201).json({
    url: `/uploads/${fileName}`,
    absoluteUrl: publicAssetUrl(req, `/uploads/${fileName}`),
  });
});

app.patch('/api/profile', requireAuth, (req: AuthedRequest, res) => {
  const schema = z.object({
    username: z.string().min(3).max(24).optional(),
    bio: z.string().max(280).optional(),
    avatarUrl: z.string().min(1).optional(),
    language: z.enum(['ar', 'en', 'fr']).optional(),
    theme: z.enum(['light', 'dark']).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const user = getUserById(req.auth!.sub);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const username = parsed.data.username ? sanitize(parsed.data.username) : user.username;
  const existingUsername = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, user.id);
  if (existingUsername) return res.status(409).json({ message: 'Username already in use' });

  const bio = parsed.data.bio ? sanitize(parsed.data.bio) : user.bio;
  const avatarUrl = parsed.data.avatarUrl ?? user.avatar_url;
  const language = parsed.data.language ?? user.language;
  const theme = parsed.data.theme ?? user.theme;
  db.prepare('UPDATE users SET username = ?, bio = ?, avatar_url = ?, language = ?, theme = ?, updated_at = ? WHERE id = ?').run(username, bio, avatarUrl, language, theme, now(), user.id);
  res.json({ user: getUserById(user.id) });
});

app.get('/api/search', requireAuth, (req: AuthedRequest, res) => {
  const query = String(req.query.q || '').trim();
  if (!query) return res.json({ users: [], rooms: [] });
  const like = `%${query.toLowerCase()}%`;

  const users = db.prepare(`
    SELECT id, username, avatar_url, rating, bio
    FROM users
    WHERE id != ? AND (LOWER(username) LIKE ? OR LOWER(email) LIKE ?)
    ORDER BY username ASC
    LIMIT 20
  `).all(req.auth!.sub, like, like);

  const rooms = db.prepare(`
    SELECT r.*, u.username AS host_username,
      (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id) AS member_count
    FROM rooms r
    JOIN users u ON u.id = r.host_user_id
    WHERE LOWER(r.name) LIKE ?
    ORDER BY r.created_at DESC
    LIMIT 20
  `).all(like);

  res.json({ users, rooms });
});

app.get('/api/friends', requireAuth, (req: AuthedRequest, res) => {
  res.json(getFriendsPayload(req.auth!.sub));
});

app.post('/api/friends/request', requireAuth, (req: AuthedRequest, res) => {
  const parsed = z.object({ friendId: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const friendId = parsed.data.friendId;
  if (friendId === req.auth!.sub) return res.status(400).json({ message: 'You cannot add yourself' });
  const friend = getUserById(friendId);
  if (!friend) return res.status(404).json({ message: 'User not found' });

  const existing = db.prepare(`
    SELECT * FROM friends
    WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
  `).get(req.auth!.sub, friendId, friendId, req.auth!.sub) as any;

  if (existing?.status === 'accepted') return res.status(409).json({ message: 'Already friends' });
  if (existing?.status === 'pending') return res.status(409).json({ message: 'Friend request already exists' });

  db.prepare('INSERT INTO friends (user_id, friend_id, status, created_at) VALUES (?, ?, ?, ?)')
    .run(req.auth!.sub, friendId, 'pending', now());

  res.status(201).json({ ok: true });
});

app.post('/api/friends/:friendId/accept', requireAuth, (req: AuthedRequest, res) => {
  const friendId = req.params.friendId;
  const pending = db.prepare('SELECT * FROM friends WHERE user_id = ? AND friend_id = ? AND status = ?').get(friendId, req.auth!.sub, 'pending') as any;
  if (!pending) return res.status(404).json({ message: 'Friend request not found' });

  db.prepare('UPDATE friends SET status = ? WHERE user_id = ? AND friend_id = ?').run('accepted', friendId, req.auth!.sub);
  res.json({ ok: true });
});

app.delete('/api/friends/:friendId', requireAuth, (req: AuthedRequest, res) => {
  const result = db.prepare(`
    DELETE FROM friends
    WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
  `).run(req.auth!.sub, req.params.friendId, req.params.friendId, req.auth!.sub);

  if (!result.changes) return res.status(404).json({ message: 'Friend relation not found' });
  res.json({ ok: true });
});

app.get('/api/leaderboard', (_req, res) => {
  const rows = db.prepare('SELECT id, username, avatar_url, rating, wins, losses, draws, max_streak FROM users ORDER BY rating DESC, wins DESC LIMIT 100').all();
  res.json({ players: rows });
});

app.get('/api/history', requireAuth, (req: AuthedRequest, res) => {
  const rows = db.prepare(`
    SELECT g.*, wu.username AS white_username, bu.username AS black_username
    FROM games g
    LEFT JOIN users wu ON wu.id = g.white_user_id
    LEFT JOIN users bu ON bu.id = g.black_user_id
    WHERE white_user_id = ? OR black_user_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).all(req.auth!.sub, req.auth!.sub);
  res.json({ games: rows });
});

app.get('/api/dashboard', requireAuth, (req: AuthedRequest, res) => {
  ensureWallet(req.auth!.sub);
  seedUserExperience(req.auth!.sub);
  const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.auth!.sub);
  const notifications = db.prepare('SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND read_at IS NULL').get(req.auth!.sub) as any;
  const rooms = listRooms(req.auth!.sub).slice(0, 6);
  const friendPayload = getFriendsPayload(req.auth!.sub);
  const latestGames = db.prepare(`
    SELECT g.*, wu.username AS white_username, bu.username AS black_username
    FROM games g
    LEFT JOIN users wu ON wu.id = g.white_user_id
    LEFT JOIN users bu ON bu.id = g.black_user_id
    WHERE white_user_id = ? OR black_user_id = ?
    ORDER BY created_at DESC
    LIMIT 5
  `).all(req.auth!.sub, req.auth!.sub);
  res.json({
    wallet,
    rooms,
    friends: friendPayload.friends.slice(0, 6),
    notifications: Number(notifications.total || 0),
    latestGames,
  });
});

app.get('/api/player/:playerId', requireAuth, (req: AuthedRequest, res) => {
  const player = db.prepare('SELECT id, username, avatar_url, bio, rating, wins, losses, draws, streak, max_streak, last_seen_at, created_at FROM users WHERE id = ?').get(req.params.playerId) as any;
  if (!player) return res.status(404).json({ message: 'Player not found' });
  const achievements = db.prepare('SELECT code, title, description, unlocked_at FROM achievements WHERE user_id = ? ORDER BY unlocked_at DESC LIMIT 20').all(player.id);
  res.json({ player, achievements, friendStatus: getFriendStatus(req.auth!.sub, player.id) });
});

app.get('/api/wallet', requireAuth, (req: AuthedRequest, res) => {
  ensureWallet(req.auth!.sub);
  const wallet = db.prepare('SELECT * FROM wallets WHERE user_id = ?').get(req.auth!.sub);
  const transactions = db.prepare('SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(req.auth!.sub);
  res.json({ wallet, transactions });
});

app.post('/api/wallet/reward', requireAuth, (req: AuthedRequest, res) => {
  const parsed = z.object({ kind: z.enum(['daily', 'wheel', 'mission']), reward: z.object({ coins: z.number().int().optional(), gems: z.number().int().optional(), tickets: z.number().int().optional() }).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const reward = parsed.data.reward || (parsed.data.kind === 'daily' ? { coins: 250, gems: 15 } : parsed.data.kind === 'wheel' ? { coins: 400, gems: 25 } : { coins: 180, gems: 8 });
  const wallet = addWalletBalance(req.auth!.sub, reward, `reward:${parsed.data.kind}`, { kind: parsed.data.kind });
  createNotification(req.auth!.sub, 'reward', 'تم استلام مكافأة', `حصلت على ${reward.coins ?? 0} ذهب و ${reward.gems ?? 0} جواهر.`);
  res.json({ ok: true, wallet, reward });
});

app.post('/api/store/purchase', requireAuth, (req: AuthedRequest, res) => {
  const parsed = z.object({
    category: z.enum(['gold', 'gems', 'recharge', 'premium']),
    packId: z.string().min(1),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const catalog: Record<string, { title: string; coins?: number; gems?: number; tickets?: number }> = {
    'gold-small': { title: 'Gold Pack 10,000', coins: 10000 },
    'gold-large': { title: 'Gold Pack 50,000', coins: 50000 },
    'gems-small': { title: 'Gem Pack 500', gems: 500 },
    'gems-large': { title: 'Gem Pack 2,000', gems: 2000 },
    'recharge-basic': { title: 'Starter Recharge', coins: 4000, gems: 200 },
    'recharge-elite': { title: 'Elite Recharge', coins: 15000, gems: 900, tickets: 2 },
    'premium-month': { title: 'Premium 1 Month', coins: 1500, gems: 120, tickets: 1 },
    'premium-year': { title: 'Premium 12 Months', coins: 9000, gems: 900, tickets: 8 },
  };
  const pack = catalog[parsed.data.packId];
  if (!pack) return res.status(404).json({ message: 'Pack not found' });
  const wallet = addWalletBalance(req.auth!.sub, { coins: pack.coins, gems: pack.gems, tickets: pack.tickets }, `purchase:${parsed.data.category}`, { packId: parsed.data.packId, title: pack.title });
  createNotification(req.auth!.sub, 'purchase', 'تمت العملية بنجاح', `تمت إضافة محتويات ${pack.title} إلى حسابك.`);
  res.json({ ok: true, wallet, pack });
});

app.get('/api/gifts', requireAuth, (req: AuthedRequest, res) => {
  const received = db.prepare(`
    SELECT g.*, u.username AS sender_username
    FROM gifts g
    JOIN users u ON u.id = g.sender_user_id
    WHERE g.receiver_user_id = ?
    ORDER BY g.created_at DESC
  `).all(req.auth!.sub);
  const sent = db.prepare(`
    SELECT g.*, u.username AS receiver_username
    FROM gifts g
    JOIN users u ON u.id = g.receiver_user_id
    WHERE g.sender_user_id = ?
    ORDER BY g.created_at DESC
  `).all(req.auth!.sub);
  res.json({ received, sent });
});

app.post('/api/gifts/send', requireAuth, (req: AuthedRequest, res) => {
  const parsed = z.object({ receiverUserId: z.string().min(1), kind: z.enum(['gold', 'gems', 'premium']), amount: z.number().int().positive().default(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  if (!getUserById(parsed.data.receiverUserId)) return res.status(404).json({ message: 'Receiver not found' });
  const gift = {
    id: uuid(),
    senderUserId: req.auth!.sub,
    receiverUserId: parsed.data.receiverUserId,
    kind: parsed.data.kind,
    payload: parsed.data.kind === 'gold' ? { coins: parsed.data.amount } : parsed.data.kind === 'gems' ? { gems: parsed.data.amount } : { gems: 120, tickets: 1 },
    status: 'pending',
  };
  db.prepare('INSERT INTO gifts (id, sender_user_id, receiver_user_id, kind, payload_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(gift.id, gift.senderUserId, gift.receiverUserId, gift.kind, JSON.stringify(gift.payload), gift.status, now());
  createNotification(gift.receiverUserId, 'gift', 'هدية جديدة', `وصلتك هدية جديدة من ${req.auth!.username}.`);
  res.status(201).json({ ok: true, gift });
});

app.post('/api/gifts/:giftId/claim', requireAuth, (req: AuthedRequest, res) => {
  const gift = db.prepare('SELECT * FROM gifts WHERE id = ? AND receiver_user_id = ?').get(req.params.giftId, req.auth!.sub) as any;
  if (!gift) return res.status(404).json({ message: 'Gift not found' });
  if (gift.status !== 'pending') return res.status(409).json({ message: 'Gift already processed' });
  const payload = JSON.parse(gift.payload_json || '{}') as { coins?: number; gems?: number; tickets?: number };
  const wallet = addWalletBalance(req.auth!.sub, payload, 'gift:claim', { giftId: gift.id, kind: gift.kind });
  db.prepare('UPDATE gifts SET status = ?, decided_at = ? WHERE id = ?').run('claimed', now(), gift.id);
  createNotification(req.auth!.sub, 'gift', 'تم استلام الهدية', 'تمت إضافة محتوى الهدية إلى محفظتك.');
  res.json({ ok: true, wallet, giftId: gift.id });
});

app.get('/api/notifications', requireAuth, (req: AuthedRequest, res) => {
  seedUserExperience(req.auth!.sub);
  const notifications = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(req.auth!.sub);
  res.json({ notifications });
});

app.post('/api/notifications/:notificationId/read', requireAuth, (req: AuthedRequest, res) => {
  db.prepare('UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND user_id = ?').run(now(), req.params.notificationId, req.auth!.sub);
  res.json({ ok: true });
});

app.post('/api/notifications/read-all', requireAuth, (req: AuthedRequest, res) => {
  db.prepare('UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE user_id = ?').run(now(), req.auth!.sub);
  res.json({ ok: true });
});

app.get('/api/messages', requireAuth, (req: AuthedRequest, res) => {
  const scope = String(req.query.scope || 'global');
  const roomId = req.query.roomId ? String(req.query.roomId) : undefined;
  const receiverUserId = req.query.receiverUserId ? String(req.query.receiverUserId) : undefined;
  const messages = listMessages(req.auth!.sub, { scope, roomId, receiverUserId });
  res.json({ messages });
});

app.get('/api/rooms/:roomId', requireAuth, (req: AuthedRequest, res) => {
  const room = db.prepare(`
    SELECT r.*, u.username AS host_username,
      (SELECT COUNT(*) FROM room_members rm WHERE rm.room_id = r.id) AS member_count
    FROM rooms r
    JOIN users u ON u.id = r.host_user_id
    WHERE r.id = ?
  `).get(req.params.roomId) as any;
  if (!room) return res.status(404).json({ message: 'Room not found' });
  const members = listRoomMembers(room.id);
  const messages = listMessages(req.auth!.sub, { roomId: room.id });
  const currentGame = room.current_game_id ? db.prepare('SELECT * FROM games WHERE id = ?').get(room.current_game_id) : null;
  res.json({ room, members, messages, currentGame });
});

app.get('/api/rooms', (req, res) => {
  const auth = getOptionalAuth(req);
  res.json({ rooms: listRooms(auth?.sub) });
});

app.get('/api/rooms/:roomId/members', requireAuth, (req: AuthedRequest, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.roomId) as any;
  if (!room) return res.status(404).json({ message: 'Room not found' });
  res.json({ members: listRoomMembers(room.id) });
});

app.post('/api/rooms', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = roomSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const data = parsed.data;
  const roomId = uuid();
  const timestamp = now();
  const passwordHash = data.password ? await hashPassword(data.password) : null;
  db.prepare(`
    INSERT INTO rooms (id, host_user_id, name, visibility, password_hash, max_players, status, settings_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'waiting', ?, ?, ?)
  `).run(roomId, req.auth!.sub, sanitize(data.name), data.visibility, passwordHash, data.maxPlayers, JSON.stringify({ timeControl: data.timeControl, incrementSeconds: data.incrementSeconds }), timestamp, timestamp);
  db.prepare('INSERT INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)').run(roomId, req.auth!.sub, 'host', timestamp);
  res.status(201).json({ room: db.prepare('SELECT * FROM rooms WHERE id = ?').get(roomId) });
});

app.post('/api/rooms/:roomId/join', requireAuth, async (req: AuthedRequest, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.roomId) as any;
  if (!room) return res.status(404).json({ message: 'Room not found' });
  if (room.visibility === 'password') {
    const password = z.string().min(4).parse(req.body.password);
    const ok = await verifyPassword(password, room.password_hash);
    if (!ok) return res.status(403).json({ message: 'Wrong password' });
  }
  const count = Number((db.prepare('SELECT COUNT(*) as total FROM room_members WHERE room_id = ?').get(room.id) as any).total);
  if (count >= room.max_players) return res.status(409).json({ message: 'Room is full' });
  db.prepare('INSERT OR IGNORE INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)').run(room.id, req.auth!.sub, 'member', now());
  res.json({ ok: true });
});

app.post('/api/rooms/:roomId/leave', requireAuth, (req: AuthedRequest, res) => {
  const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(req.params.roomId) as any;
  if (!room) return res.status(404).json({ message: 'Room not found' });

  db.prepare('DELETE FROM room_members WHERE room_id = ? AND user_id = ?').run(room.id, req.auth!.sub);
  const members = listRoomMembers(room.id) as Array<Record<string, any>>;

  if (members.length === 0) {
    db.prepare('DELETE FROM rooms WHERE id = ?').run(room.id);
    return res.json({ ok: true, deleted: true });
  }

  if (room.host_user_id === req.auth!.sub) {
    const nextHost = members[0];
    db.prepare('UPDATE rooms SET host_user_id = ?, updated_at = ? WHERE id = ?').run(nextHost.user_id, now(), room.id);
    db.prepare('UPDATE room_members SET role = ? WHERE room_id = ? AND user_id = ?').run('host', room.id, nextHost.user_id);
  }

  res.json({ ok: true, deleted: false, members: listRoomMembers(room.id) });
});

app.get('/api/games/:gameId', (req, res) => {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(req.params.gameId) as any;
  if (!game) return res.status(404).json({ message: 'Game not found' });
  const moves = db.prepare('SELECT * FROM moves WHERE game_id = ? ORDER BY ply ASC').all(req.params.gameId);
  res.json({ game, moves });
});

app.post('/api/games/ai', requireAuth, (req: AuthedRequest, res) => {
  const schema = z.object({ fen: z.string().default(STANDARD_START_FEN), depth: z.number().min(1).max(3).default(2), color: z.enum(['w', 'b']).default('b') });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const engine = new ChessEngine(parsed.data.fen);
  const result = ai.search(engine, parsed.data.depth, parsed.data.color);
  res.json(result);
});

app.post('/api/games/import/fen', (req, res) => {
  const schema = z.object({ fen: z.string().min(10) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const engine = new ChessEngine(parsed.data.fen);
  res.json(engine.exportState());
});

app.post('/api/games/import/pgn', (req, res) => {
  const schema = z.object({ pgn: z.string().min(3) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());
  const engine = new ChessEngine();
  engine.loadPGN(parsed.data.pgn);
  res.json(engine.exportState());
});

const liveGames = new Map<string, { engine: ChessEngine; whiteId?: string; blackId?: string; roomId?: string; timeControl: string; incrementSeconds: number; queueType?: string; waiting?: boolean }>();

function expectedScore(ratingA: number, ratingB: number) {
  return 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
}
function updateElo(whiteId: string, blackId: string, scoreWhite: number, gameId: string) {
  const white = getUserById(whiteId);
  const black = getUserById(blackId);
  if (!white || !black) return;
  const k = 24;
  const expectedWhite = expectedScore(white.rating, black.rating);
  const expectedBlack = expectedScore(black.rating, white.rating);
  const newWhite = Math.round(white.rating + k * (scoreWhite - expectedWhite));
  const newBlack = Math.round(black.rating + k * ((1 - scoreWhite) - expectedBlack));
  db.prepare('UPDATE users SET rating = ?, updated_at = ? WHERE id = ?').run(newWhite, now(), whiteId);
  db.prepare('UPDATE users SET rating = ?, updated_at = ? WHERE id = ?').run(newBlack, now(), blackId);
  db.prepare('INSERT INTO ratings (user_id, game_id, before_rating, after_rating, delta, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(whiteId, gameId, white.rating, newWhite, newWhite - white.rating, now());
  db.prepare('INSERT INTO ratings (user_id, game_id, before_rating, after_rating, delta, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(blackId, gameId, black.rating, newBlack, newBlack - black.rating, now());
}
function updateGameRecords(whiteId?: string, blackId?: string, result = '*') {
  if (!whiteId || !blackId) return;
  if (result === '1-0') {
    updateUserRecord(whiteId, { wins: 1, streakIncrement: true });
    updateUserRecord(blackId, { losses: 1, streakReset: true });
    return;
  }
  if (result === '0-1') {
    updateUserRecord(whiteId, { losses: 1, streakReset: true });
    updateUserRecord(blackId, { wins: 1, streakIncrement: true });
    return;
  }
  if (result === '1/2-1/2') {
    updateUserRecord(whiteId, { draws: 1, streakReset: true });
    updateUserRecord(blackId, { draws: 1, streakReset: true });
  }
}
function persistFinishedGame(gameId: string, engine: ChessEngine, whiteId?: string, blackId?: string, result = '*', roomId?: string) {
  const status = engine.getStatus();
  const winnerUserId = result === '1-0' ? whiteId ?? null : result === '0-1' ? blackId ?? null : null;
  const pgn = engine.toPGN({ Result: result });
  db.prepare('UPDATE games SET status = ?, result = ?, winner_user_id = ?, final_fen = ?, pgn = ?, move_count = ?, finished_at = ? WHERE id = ?')
    .run(status.checkmate || status.draw ? 'finished' : 'active', result, winnerUserId, engine.exportFEN(), pgn, engine.history.length, now(), gameId);
  engine.history.forEach((entry, index) => {
    db.prepare('INSERT INTO moves (game_id, ply, san, from_square, to_square, promotion, fen_after, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(gameId, index + 1, entry.move.san ?? `${entry.move.from}${entry.move.to}`, entry.move.from, entry.move.to, entry.move.promotion ?? null, entry.fenAfter, now());
  });
  if (whiteId && blackId) {
    if (result === '1-0') updateElo(whiteId, blackId, 1, gameId);
    if (result === '0-1') updateElo(whiteId, blackId, 0, gameId);
    if (result === '1/2-1/2') updateElo(whiteId, blackId, 0.5, gameId);
    updateGameRecords(whiteId, blackId, result);
  }
  if (roomId) {
    db.prepare('UPDATE rooms SET current_game_id = NULL, status = ?, updated_at = ? WHERE id = ?').run('waiting', now(), roomId);
  }
  liveGames.delete(gameId);
}

io.use((socket, next) => {
  try {
    const token = String(socket.handshake.auth.token || '');
    socket.data.user = verifyToken(token);
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  const auth = socket.data.user as { sub: string; username: string };
  socket.join(`user:${auth.sub}`);
  io.emit('presence:update', { userId: auth.sub, status: 'online' });

  socket.on('room:join', ({ roomId }) => {
    socket.join(`room:${roomId}`);
  });

  socket.on('chat:send', ({ roomId, receiverUserId, content, scope = 'room', messageType = 'text' }, callback) => {
    const broadcastRoomId = roomId ? String(roomId) : null;
    const persistedRoomId = broadcastRoomId && roomExists(broadcastRoomId) ? broadcastRoomId : null;
    const message = {
      id: uuid(),
      roomId: persistedRoomId,
      senderUserId: auth.sub,
      receiverUserId: receiverUserId ?? null,
      scope,
      messageType,
      content: sanitize(String(content || '')),
      createdAt: now(),
    };
    db.prepare('INSERT INTO messages (id, room_id, sender_user_id, receiver_user_id, scope, message_type, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(message.id, message.roomId, message.senderUserId, message.receiverUserId, message.scope, message.messageType, message.content, message.createdAt);
    if (broadcastRoomId) {
      if (persistedRoomId) io.to(`room:${broadcastRoomId}`).emit('chat:message', message);
      else io.to(`game:${broadcastRoomId}`).emit('chat:message', message);
    }
    if (receiverUserId) io.to(`user:${receiverUserId}`).emit('chat:message', message);
    callback?.({ ok: true, message });
  });

  socket.on('voice:signal', ({ targetUserId, payload }) => {
    io.to(`user:${targetUserId}`).emit('voice:signal', { fromUserId: auth.sub, payload });
  });

  socket.on('game:create', ({ roomId, whiteId, blackId, timeControl = 'blitz', incrementSeconds = 0, queueType }, callback) => {
    const normalizedQueueType = queueType ? String(queueType) : undefined;

    if (normalizedQueueType && !roomId && !blackId && whiteId) {
      const waitingEntry = [...liveGames.entries()].find(([, live]) => live.queueType === normalizedQueueType && live.waiting && live.whiteId && live.whiteId !== whiteId && !live.blackId);
      if (waitingEntry) {
        const [existingGameId, existingLive] = waitingEntry;
        existingLive.blackId = whiteId;
        existingLive.waiting = false;
        db.prepare('UPDATE games SET black_user_id = ?, mode = ? WHERE id = ?').run(whiteId, 'online', existingGameId);
        const state = existingLive.engine.exportState();
        io.to(`game:${existingGameId}`).emit('game:matched', { gameId: existingGameId, queueType: normalizedQueueType, state });
        io.to(`game:${existingGameId}`).emit('game:state', { gameId: existingGameId, state });
        callback?.({ ok: true, gameId: existingGameId, state, matched: true, queueType: normalizedQueueType });
        return;
      }
    }

    const gameId = uuid();
    const engine = new ChessEngine();
    const waiting = Boolean(normalizedQueueType && !roomId && !blackId);
    liveGames.set(gameId, { engine, whiteId, blackId, roomId, timeControl, incrementSeconds, queueType: normalizedQueueType, waiting });
    db.prepare('INSERT INTO games (id, white_user_id, black_user_id, mode, status, initial_fen, final_fen, time_control, increment_seconds, started_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(gameId, whiteId ?? null, blackId ?? null, roomId || normalizedQueueType || blackId ? 'online' : 'training', 'active', engine.exportFEN(), engine.exportFEN(), timeControl, incrementSeconds, now(), now());
    if (roomId) db.prepare('UPDATE rooms SET current_game_id = ?, status = ?, updated_at = ? WHERE id = ?').run(gameId, 'playing', now(), roomId);
    callback?.({ ok: true, gameId, state: engine.exportState(), waiting, queueType: normalizedQueueType });
  });

  socket.on('game:join', ({ gameId }) => {
    socket.join(`game:${gameId}`);
    const live = liveGames.get(gameId);
    if (live) socket.emit('game:state', { gameId, state: live.engine.exportState() });
  });

  socket.on('game:move', ({ gameId, move }, callback) => {
    const live = liveGames.get(gameId);
    if (!live) return callback?.({ ok: false, message: 'Game not found' });
    try {
      const parsedMove = moveSchema.parse(move);
      const result = live.engine.makeMove(parsedMove);
      const status = live.engine.getStatus();
      const payload = { gameId, move: result, state: live.engine.exportState() };
      io.to(`game:${gameId}`).emit('game:update', payload);
      if (status.checkmate || status.draw) {
        const finalResult = status.checkmate ? (live.engine.turn === 'w' ? '0-1' : '1-0') : '1/2-1/2';
        persistFinishedGame(gameId, live.engine, live.whiteId, live.blackId, finalResult, live.roomId);
        io.to(`game:${gameId}`).emit('game:finished', { gameId, result: finalResult, state: live.engine.exportState() });
      }
      callback?.({ ok: true, ...payload });
    } catch (error) {
      callback?.({ ok: false, message: (error as Error).message });
    }
  });

  socket.on('game:resign', ({ gameId }, callback) => {
    const live = liveGames.get(gameId);
    if (!live) return callback?.({ ok: false });
    const result = auth.sub === live.whiteId ? '0-1' : '1-0';
    persistFinishedGame(gameId, live.engine, live.whiteId, live.blackId, result, live.roomId);
    io.to(`game:${gameId}`).emit('game:finished', { gameId, result });
    callback?.({ ok: true, result });
  });

  socket.on('disconnect', () => {
    io.emit('presence:update', { userId: auth.sub, status: 'offline' });
  });
});

if (existsSync(resolve(webDistDir, 'index.html'))) {
  app.use(express.static(webDistDir, { index: 'index.html' }));
  app.get(/^(?!\/api|\/socket\.io|\/uploads).*/, (_req, res) => {
    res.sendFile(resolve(webDistDir, 'index.html'));
  });
}

function startServer() {
  return httpServer.listen(PORT, () => {
    console.log(`Royal Square server running on http://localhost:${PORT}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export { app, httpServer, startServer };
