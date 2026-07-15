import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChessEngine, STANDARD_START_FEN } from '../../../packages/shared/src/index';
import type { Socket } from 'socket.io-client';
import { ChessBoard } from './components/ChessBoard';
import { EquipmentArt, GameIcon, ModeArt, NavIcon, PackArt, ResourceIcon } from './components/GameIcons';
import { VoiceChatPanel } from './components/VoiceChatPanel';
import { api } from './lib/api';
import { getSocket, resetSocket } from './lib/socket';

interface User {
  id: string;
  username: string;
  email: string;
  rating: number;
  bio?: string;
  avatar_url?: string | null;
  theme: 'light' | 'dark';
  language: 'ar' | 'en' | 'fr';
}

interface AuthState {
  token: string | null;
  user: User | null;
}

interface Room {
  id: string;
  name: string;
  visibility: string;
  max_players: number;
  status: string;
  host_username: string;
  host_user_id?: string;
  member_count: number;
  settings_json: string;
  is_member?: boolean;
}

interface FriendItem {
  friend_user_id: string;
  friend_username: string;
  friend_avatar_url?: string | null;
  friend_rating: number;
  created_at: string;
}

interface IncomingFriendRequest {
  requester_id: string;
  requester_username: string;
  requester_avatar_url?: string | null;
  requester_rating: number;
  created_at: string;
}

interface OutgoingFriendRequest {
  target_id: string;
  target_username: string;
  target_avatar_url?: string | null;
  target_rating: number;
  created_at: string;
}

interface SearchUser {
  id: string;
  username: string;
  rating: number;
  bio?: string;
  avatar_url?: string | null;
}

interface WalletData {
  user_id: string;
  coins: number;
  gems: number;
  tickets: number;
  updated_at: string;
}

interface WalletTransaction {
  id: string;
  kind: string;
  currency: string;
  amount: number;
  metadata_json: string;
  created_at: string;
}

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  read_at?: string | null;
  created_at: string;
}

interface GiftItem {
  id: string;
  kind: string;
  status: string;
  payload_json: string;
  created_at: string;
  sender_username?: string;
  receiver_username?: string;
}

interface ChatMessage {
  id?: string;
  roomId?: string | null;
  senderUserId: string;
  sender_username?: string;
  receiverUserId?: string | null;
  scope?: string;
  messageType?: string;
  content: string;
  createdAt?: string;
  created_at?: string;
}

interface PublicPlayer {
  id: string;
  username: string;
  avatar_url?: string | null;
  bio?: string;
  rating: number;
  wins?: number;
  losses?: number;
  draws?: number;
  streak?: number;
  max_streak?: number;
  created_at?: string;
  last_seen_at?: string;
}

interface DashboardPayload {
  wallet: WalletData;
  rooms: Room[];
  friends: FriendItem[];
  notifications: number;
  latestGames: Array<Record<string, any>>;
}

const TOURNAMENTS = [
  { id: 'champions-arena', title: 'Champions Arena', subtitle: 'بطولة عالمية سريعة', prize: '50,000 Gold + 2,000 Gems' },
  { id: 'royal-gauntlet', title: 'Royal Gauntlet', subtitle: 'إقصائيات نخبة المصنفين', prize: 'Premium + Tickets' },
  { id: 'winter-siege', title: 'Winter Siege', subtitle: 'حدث موسمي محدود', prize: 'Skins + Gold' },
];


const ARENA_CARDS = [
  { id: 'paris', title: 'PARIS', prize: '400', online: 862, entry: '200', rules: '10 min', theme: 'gold', reward: '+100 CP' },
  { id: 'delhi', title: 'DELHI', prize: '1 000', online: 192, entry: '500', rules: '10 min + 5 sec/move', theme: 'violet', reward: '+120 CP' },
  { id: 'new-york', title: 'NEW YORK', prize: '5 000', online: 174, entry: '2 600', rules: '10 min + 10 sec/move', theme: 'purple', reward: '+140 CP' },
  { id: 'berlin', title: 'BERLIN', prize: '10 000', online: 71, entry: '5 500', rules: '10 min', theme: 'red', reward: '+160 CP' },
  { id: 'london', title: 'LONDON', prize: '20 000', online: 68, entry: '11 000', rules: '10 min + 5 sec/move', theme: 'blue', reward: '+180 CP' },
  { id: 'las-vegas', title: 'LAS VEGAS', prize: '100K', online: 9, entry: '55 000', rules: '10 min + 10 sec/move', theme: 'pink', reward: '+200 CP' },
];

const BOARD_SETS = [
  { id: 'ash', title: 'Ash', tier: 'STANDARD', status: 'USING', progress: '12/12' },
  { id: 'maple', title: 'Maple', tier: 'STANDARD', status: 'OWNED', progress: '12/12' },
  { id: 'oak', title: 'Oak', tier: 'STANDARD', status: 'Find it in chests! Paris +', progress: '8/25' },
  { id: 'olive', title: 'Olive', tier: 'RARE', status: 'Find it in chests! Paris +', progress: '9/25' },
  { id: 'padauk', title: 'Padauk', tier: 'EPIC', status: 'Find it in chests! Paris +', progress: '4/50' },
  { id: 'cherry', title: 'Cherry', tier: 'STANDARD', status: 'Find it in chests! Delhi +', progress: '5/15' },
  { id: 'azure', title: 'Azure', tier: 'RARE', status: 'Find it in chests! Delhi +', progress: '2/25' },
  { id: 'lavender', title: 'Lavender', tier: 'RARE', status: 'Find it in chests! Delhi +', progress: '10/35' },
  { id: 'shade', title: 'Shade', tier: 'STANDARD', status: 'Find it in chests! New York +', progress: '0/25' },
];

const PIECE_SETS = [
  { id: 'chalk', title: 'Chalk', tier: 'STANDARD', status: 'USING', progress: '1/12' },
  { id: 'marl', title: 'Marl', tier: 'STANDARD', status: 'OWNED', progress: '8/12' },
  { id: 'marble', title: 'Marble', tier: 'STANDARD', status: 'Find it in chests! Delhi +', progress: '9/10' },
  { id: 'persian', title: 'Persian', tier: 'RARE', status: 'Find it in chests! New York +', progress: '7/10' },
  { id: 'terracota', title: 'Terracota', tier: 'STANDARD', status: 'Find it in chests! Paris +', progress: '5/10' },
  { id: 'topaz', title: 'Topaz', tier: 'STANDARD', status: 'Find it in chests! New York +', progress: '9/10' },
  { id: 'basalt', title: 'Basalt', tier: 'RARE', status: 'Find it in chests! Paris +', progress: '4/10' },
  { id: 'granite', title: 'Granite', tier: 'RARE', status: 'Find it in chests! New York +', progress: '9/10' },
  { id: 'amethyst', title: 'Amethyst', tier: 'EPIC', status: 'Find it in chests! Paris +', progress: '3/10' },
];

const CONTENT_SECTIONS: Record<string, Array<{ title: string; body: string }>> = {
  events: [
    { title: 'Champions Arena', body: 'سلسلة فعاليات يومية مع تقدم موسمي ومكافآت مباشرة.' },
    { title: 'Winter Siege', body: 'حدث محدود بمهام إضافية ولوحة ترتيب خاصة.' },
    { title: 'Event Shop', body: 'استبدال الرموز المكتسبة بعناصر وموارد داخل اللعبة.' },
  ],
  missions: [
    { title: 'اربح مباراتين', body: 'مهمة يومية تمنحك ذهبًا إضافيًا ونقاط تقدم.' },
    { title: 'العب 3 مباريات', body: 'تزيد من صندوق الأسبوع وتحسن التقدم الموسمي.' },
    { title: 'أرسل هدية لصديق', body: 'مكافأة اجتماعية ترفع التفاعل داخل اللعبة.' },
  ],
  achievements: [
    { title: 'Grandmaster', body: 'الوصول إلى تصنيف مرتفع والفوز بسلسلة مباريات.' },
    { title: 'Collector', body: 'جمع موارد وهدايا وفتح مكافآت متعددة.' },
    { title: 'Legend', body: 'تحقيق إنجازات طويلة المدى وسجل نظيف.' },
  ],
};

function triggerDeviceFeedback(kind: 'tap' | 'success' | 'danger' = 'tap') {
  if (typeof window === 'undefined') return;
  if ('vibrate' in navigator) {
    navigator.vibrate(kind === 'success' ? [18, 28, 18] : kind === 'danger' ? [50, 25, 50] : 10);
  }
  const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextCtor) return;

  try {
    const context = new AudioContextCtor();
    if (!context?.createOscillator || !context?.createGain || !context?.destination) {
      context?.close?.().catch?.(() => undefined);
      return;
    }
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = kind === 'danger' ? 'sawtooth' : 'triangle';
    oscillator.frequency.value = kind === 'success' ? 740 : kind === 'danger' ? 180 : 540;
    gain.gain.value = 0.0001;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.05, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
    oscillator.stop(context.currentTime + 0.2);
    setTimeout(() => context.close?.().catch?.(() => undefined), 260);
  } catch {
    // Ignore feedback failures on unsupported / mocked environments.
  }
}

function formatRelativeStamp(value?: string | null) {
  if (!value) return 'الآن';
  return new Date(value).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' });
}

function RouteTile({ to, title, body, badge }: { to: string; title: string; body: string; badge?: string }) {
  return (
    <Link className="route-tile card" to={to}>
      <div className="section-header">
        <h3>{title}</h3>
        {badge ? <span className="pill">{badge}</span> : null}
      </div>
      <p>{body}</p>
      <span className="text-link">فتح الصفحة</span>
    </Link>
  );
}

function PageHero({ eyebrow, title, body, actions }: { eyebrow: string; title: string; body: string; actions?: ReactNode }) {
  return (
    <section className="card hero-panel page-hero-panel">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
      {actions ? <div className="inline-actions wrap">{actions}</div> : null}
    </section>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة الملف'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

async function recordVoiceDataUrl() {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new Error('المتصفح لا يدعم التسجيل الصوتي');
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  return new Promise<string>((resolve, reject) => {
    const recorder = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onerror = () => reject(new Error('تعذر تسجيل الرسالة الصوتية'));
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        stream.getTracks().forEach((track) => track.stop());
        resolve(String(reader.result || ''));
      };
      reader.onerror = () => reject(new Error('تعذر معالجة التسجيل الصوتي'));
      reader.readAsDataURL(blob);
    };
    recorder.start();
    setTimeout(() => recorder.stop(), 1800);
  });
}

function persistAuth(token: string | null, user: User | null) {
  if (token) localStorage.setItem('royal-token', token);
  else localStorage.removeItem('royal-token');

  if (user) localStorage.setItem('royal-user', JSON.stringify(user));
  else localStorage.removeItem('royal-user');
}

function useAuth() {
  const [auth, setAuth] = useState<AuthState>(() => ({
    token: localStorage.getItem('royal-token'),
    user: localStorage.getItem('royal-user') ? JSON.parse(localStorage.getItem('royal-user')!) : null,
  }));
  const [booting, setBooting] = useState(true);

  const logout = useCallback(() => {
    persistAuth(null, null);
    resetSocket();
    setAuth({ token: null, user: null });
    setBooting(false);
  }, []);

  const setUser = useCallback((user: User | null) => {
    setAuth((prev) => {
      const next = { ...prev, user };
      persistAuth(next.token, next.user);
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!auth.token) return null;
    const response = await api<{ user: User }>('/api/auth/me', { token: auth.token });
    setUser(response.user);
    return response.user;
  }, [auth.token, setUser]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (!auth.token) {
        if (!cancelled) setBooting(false);
        return;
      }

      try {
        const response = await api<{ user: User }>('/api/auth/me', { token: auth.token });
        if (cancelled) return;
        setAuth((prev) => {
          const next = { ...prev, user: response.user };
          persistAuth(next.token, next.user);
          return next;
        });
      } catch {
        if (!cancelled) {
          persistAuth(null, null);
          resetSocket();
          setAuth({ token: null, user: null });
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (auth.user?.theme) document.documentElement.dataset.theme = auth.user.theme;
  }, [auth.user?.theme]);

  const login = (token: string, user: User) => {
    persistAuth(token, user);
    setAuth({ token, user });
    setBooting(false);
  };

  return { auth, booting, setUser, login, logout, refresh };
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="card loading-card">
        <div className="spinner" aria-hidden="true" />
        <h2>جاري تحميل WARHEX</h2>
        <p>يتم التحقق من الجلسة وتجهيز الواجهة.</p>
      </div>
    </div>
  );
}

function AppShell({ auth, logout, setUser }: { auth: AuthState; logout: () => void; setUser: (user: User | null) => void }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);

  useEffect(() => {
    api<DashboardPayload>('/api/dashboard', { token: auth.token }).then(setDashboard).catch(() => undefined);
  }, [auth.token]);

  const wallet = dashboard?.wallet;
  const currentTitle = location.pathname.startsWith('/app/friends') ? 'Friends'
    : location.pathname.startsWith('/app/equipment') ? 'Equipment'
    : location.pathname.startsWith('/app/events') || location.pathname.startsWith('/app/tournaments') ? 'Events'
    : location.pathname.startsWith('/app/store') || location.pathname.startsWith('/app/shop') || location.pathname.startsWith('/app/wallet') || location.pathname.startsWith('/app/recharge') || location.pathname.startsWith('/app/premium') ? 'Shop'
    : location.pathname.startsWith('/app/game') ? 'Classic Chess'
    : location.pathname.startsWith('/app/profile') ? 'Profile'
    : location.pathname.startsWith('/app/settings') ? 'Settings'
    : location.pathname.startsWith('/app/leaderboard') ? 'Leaderboards'
    : location.pathname.startsWith('/app/chat') ? 'Chat'
    : 'Home';

  const navItems = [
    { to: '/app', label: 'Home', icon: 'home' as const, active: location.pathname === '/app' },
    { to: '/app/friends', label: 'Friends', icon: 'friends' as const, active: location.pathname.startsWith('/app/friends') || location.pathname.startsWith('/app/chat/private') },
    { to: '/app/equipment', label: 'Equipment', icon: 'equipment' as const, active: location.pathname.startsWith('/app/equipment') },
    { to: '/app/tournaments', label: 'Events', icon: 'events' as const, active: location.pathname.startsWith('/app/events') || location.pathname.startsWith('/app/missions') || location.pathname.startsWith('/app/achievements') || location.pathname.startsWith('/app/tournaments') },
    { to: '/app/shop', label: 'Shop', icon: 'shop' as const, active: location.pathname.startsWith('/app/shop') || location.pathname.startsWith('/app/store') || location.pathname.startsWith('/app/wallet') || location.pathname.startsWith('/app/recharge') || location.pathname.startsWith('/app/premium') },
  ];

  const hideFrameForGame = location.pathname.startsWith('/app/game') || location.pathname.startsWith('/app/spectate');

  return (
    <div className={`mobile-shell ${hideFrameForGame ? 'game-frame' : ''}`}>
      <header className="resource-topbar wood-card">
        <div className="resource-left">
          <Link className="avatar-chip" to="/app/profile">
            {auth.user?.avatar_url ? <img src={auth.user.avatar_url} alt={auth.user.username} /> : <GameIcon name="player" className="avatar-fallback" />}
            <b className="level-badge">6</b>
          </Link>
          <Link className="top-icon" to="/app/settings" aria-label="Settings"><GameIcon name="settings" /></Link>
          <Link className="top-icon" to="/app/mailbox" aria-label="Mailbox"><GameIcon name="mail" /></Link>
        </div>
        <div className="resource-right">
          <Link className="currency-pill gem-pill" to="/app/store/gems"><ResourceIcon kind="gem" /><strong>{wallet?.gems ?? 16}</strong><em>+</em></Link>
          <Link className="currency-pill coin-pill" to="/app/store/gold"><ResourceIcon kind="coin" /><strong>{wallet?.coins ?? 8997}</strong><em>+</em></Link>
        </div>
      </header>

      {!hideFrameForGame ? (
        <div className="page-title-row">
          <h2>{currentTitle}</h2>
          <div className="page-title-actions">
            <Link className="mini-link with-icon" to="/app/notifications"><GameIcon name="bell" />Alerts</Link>
            <button className="mini-link with-icon button-reset" type="button" onClick={logout}><GameIcon name="settings" />{t('logout')}</button>
          </div>
        </div>
      ) : null}

      <main className="page-content mobile-content">
        <Routes>
          <Route index element={<LobbyPage auth={auth} />} />
          <Route path="queue/:queueType" element={<QueuePage auth={auth} />} />
          <Route path="quick-play" element={<Navigate to="/app/queue/quick" replace />} />
          <Route path="ranked-play" element={<Navigate to="/app/queue/ranked" replace />} />
          <Route path="gold-play" element={<Navigate to="/app/queue/gold" replace />} />
          <Route path="gems-play" element={<Navigate to="/app/queue/gems" replace />} />
          <Route path="local-play" element={<Navigate to="/app/game?mode=local" replace />} />
          <Route path="ai-opponents" element={<Navigate to="/app/game?mode=ai" replace />} />
          <Route path="lobby" element={<Navigate to="/app" replace />} />
          <Route path="create-room" element={<Navigate to="/app/rooms" replace />} />
          <Route path="join-room" element={<Navigate to="/app/rooms" replace />} />
          <Route path="game" element={<GamePage auth={auth} />} />
          <Route path="spectate" element={<SpectatorPage auth={auth} />} />
          <Route path="rooms" element={<RoomsPage auth={auth} />} />
          <Route path="rooms/:roomId" element={<RoomLobbyPage auth={auth} />} />
          <Route path="friends" element={<FriendsPage auth={auth} />} />
          <Route path="friends/requests" element={<FriendRequestsPage auth={auth} />} />
          <Route path="friend-requests" element={<FriendRequestsPage auth={auth} />} />
          <Route path="search" element={<SearchPage auth={auth} />} />
          <Route path="search-players" element={<SearchPage auth={auth} />} />
          <Route path="player/:playerId" element={<PlayerProfilePage auth={auth} />} />
          <Route path="chat/private" element={<PrivateChatPage auth={auth} />} />
          <Route path="chat/global" element={<GlobalChatPage auth={auth} />} />
          <Route path="chat/room" element={<RoomChatPage auth={auth} />} />
          <Route path="private-chat" element={<PrivateChatPage auth={auth} />} />
          <Route path="global-chat" element={<GlobalChatPage auth={auth} />} />
          <Route path="room-chat" element={<RoomChatPage auth={auth} />} />
          <Route path="voice/messages" element={<VoiceMessagesPage auth={auth} />} />
          <Route path="voice/calls" element={<VoiceCallsPage auth={auth} />} />
          <Route path="voice-messages" element={<VoiceMessagesPage auth={auth} />} />
          <Route path="voice-calls" element={<VoiceCallsPage auth={auth} />} />
          <Route path="wallet" element={<WalletPage auth={auth} />} />
          <Route path="shop" element={<StorePage auth={auth} category="gems" />} />
          <Route path="gold-store" element={<StorePage auth={auth} category="gold" />} />
          <Route path="gems-store" element={<StorePage auth={auth} category="gems" />} />
          <Route path="store/gold" element={<StorePage auth={auth} category="gold" />} />
          <Route path="store/gems" element={<StorePage auth={auth} category="gems" />} />
          <Route path="recharge" element={<StorePage auth={auth} category="recharge" />} />
          <Route path="premium" element={<StorePage auth={auth} category="premium" />} />
          <Route path="premium-membership" element={<StorePage auth={auth} category="premium" />} />
          <Route path="gifts" element={<GiftCenterPage auth={auth} />} />
          <Route path="gift-center" element={<GiftCenterPage auth={auth} />} />
          <Route path="daily-rewards" element={<RewardsPage auth={auth} mode="daily" />} />
          <Route path="lucky-wheel" element={<RewardsPage auth={auth} mode="wheel" />} />
          <Route path="events" element={<StaticCollectionPage sectionKey="events" title="Events" />} />
          <Route path="missions" element={<StaticCollectionPage sectionKey="missions" title="Missions" />} />
          <Route path="achievements" element={<StaticCollectionPage sectionKey="achievements" title="Achievements" />} />
          <Route path="equipment" element={<EquipmentPage />} />
          <Route path="tournaments" element={<TournamentsPage />} />
          <Route path="tournaments/:tournamentId" element={<TournamentDetailsPage />} />
          <Route path="notifications" element={<NotificationsPage auth={auth} />} />
          <Route path="mailbox" element={<MailboxPage auth={auth} />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="leaderboards" element={<LeaderboardPage />} />
          <Route path="history" element={<HistoryPage token={auth.token!} />} />
          <Route path="match-history" element={<HistoryPage token={auth.token!} />} />
          <Route path="replay" element={<ReplayPage />} />
          <Route path="replay-viewer" element={<ReplayPage />} />
          <Route path="analysis" element={<MatchAnalysisPage auth={auth} />} />
          <Route path="match-analysis" element={<MatchAnalysisPage auth={auth} />} />
          <Route path="profile" element={<ProfilePage auth={auth} setUser={setUser} />} />
          <Route path="settings" element={<SettingsPage auth={auth} setUser={setUser} />} />
          <Route path="language" element={<LanguagePage auth={auth} setUser={setUser} />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="about" element={<AboutPage />} />
        </Routes>
      </main>

      {!hideFrameForGame ? (
        <nav className="bottom-dock wood-card">
          {navItems.map((item) => (
            <Link key={item.to} className={`dock-item ${item.active ? 'active' : ''}`} to={item.to}>
              <NavIcon kind={item.icon} className="dock-icon" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

function LandingPage() {
  const { t } = useTranslation();
  return (
    <div className="landing">
      <section className="hero card glow">
        <p className="eyebrow">PREMIUM AAA MOBILE CHESS EXPERIENCE</p>
        <h1>{t('brand')}</h1>
        <p>
          اللعب المحلي، اللعب ضد الذكاء الاصطناعي، المباريات المباشرة، الغرف، الصوت، الدردشة، الأصدقاء، البحث، PGN/FEN، وإعادة اللعب — داخل هوية WARHEX السوداء والذهبية.
        </p>
        <div className="hero-actions">
          <Link className="btn" to="/register">ابدأ الآن</Link>
          <Link className="btn secondary" to="/login">تسجيل الدخول</Link>
        </div>
      </section>
      <section className="feature-grid">
        {[
          ['قواعد FIDE كاملة', 'كش، مات، تعادل، تبييت، أون باسون، ترقية، وتكرار الموقف.'],
          ['ذكاء اصطناعي', 'Minimax + Alpha-Beta مع تقييم مراكز ومستويات متعددة.'],
          ['محادثة وصوت', 'Socket.IO للدردشة و WebRTC للتواصل الصوتي أثناء الغرف والمباراة.'],
          ['الأصدقاء والبحث', 'إرسال طلبات صداقة، قبولها، والبحث عن اللاعبين والغرف.'],
        ].map(([title, body]) => (
          <article key={title} className="card">
            <h3>{title}</h3>
            <p>{body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

function AuthPage({ mode, onLogin }: { mode: 'login' | 'register'; onLogin: (token: string, user: User) => void }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ username: '', email: '', password: '' });

  return (
    <div className="auth-layout">
      <form
        className="card auth-card"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            setLoading(true);
            setError('');
            const response = await api<{ token: string; user: User }>(mode === 'login' ? '/api/auth/login' : '/api/auth/register', {
              method: 'POST',
              body: JSON.stringify(mode === 'login' ? { email: form.email, password: form.password } : form),
            });
            onLogin(response.token, response.user);
            navigate('/app');
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setLoading(false);
          }
        }}
      >
        <p className="eyebrow">{mode === 'login' ? 'Welcome back' : 'Create account'}</p>
        <h2>{mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}</h2>
        {mode === 'register' && (
          <label className="field"><span>اسم المستخدم</span><input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label>
        )}
        <label className="field"><span>البريد الإلكتروني</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label className="field"><span>كلمة المرور</span><input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
        {error && <p className="error-text">{error}</p>}
        <button className="btn" type="submit" disabled={loading}>{loading ? 'جارٍ التنفيذ...' : mode === 'login' ? 'دخول' : 'إنشاء الحساب'}</button>
        <Link className="text-link" to={mode === 'login' ? '/register' : '/login'}>{mode === 'login' ? 'ليس لديك حساب؟' : 'لديك حساب بالفعل؟'}</Link>
      </form>
    </div>
  );
}

function LobbyPage({ auth }: { auth: AuthState }) {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api<DashboardPayload>('/api/dashboard', { token: auth.token }).then((response) => setDashboard(response));
  }, [auth.token]);

  return (
    <div className="home-screen">
      <section className="quick-actions-strip">
        <button className="quick-top-btn" type="button" onClick={() => navigate('/app/daily-rewards')}><GameIcon name="gift" />Free Rewards</button>
        <button className="quick-top-btn" type="button" onClick={() => navigate('/app/lucky-wheel')}><GameIcon name="chest" />Lucky Box</button>
        <button className="quick-top-btn" type="button" onClick={() => navigate('/app/leaderboards')}><GameIcon name="trophy" />Leaderboards</button>
      </section>

      <section className="pass-banner wood-card">
        <div>
          <span className="pass-kicker">CHESS PASS</span>
          <strong>30d 04h</strong>
        </div>
        <div className="progress-track"><span style={{ width: '35%' }} /></div>
        <b className="pass-badge"><GameIcon name="crown" /></b>
      </section>

      <button className="mode-card classic" type="button" onClick={() => navigate('/app/queue/quick')}>
        <div>
          <strong>Classic Chess</strong>
          <span>Prize arenas · VS screens · ranked flow</span>
        </div>
        <ModeArt kind="classic" />
      </button>

      <button className="mode-card quick" type="button" onClick={() => navigate('/app/quick-play')}>
        <div>
          <strong>Quick Chess</strong>
          <span>Fast match with auto matchmaking</span>
        </div>
        <ModeArt kind="quick" />
      </button>

      <div className="dual-mode-grid">
        <button className="mode-card danger compact" type="button" onClick={() => navigate('/app/game?mode=ai')}>
          <div><strong>vs. Computer</strong><span>Practice and training</span></div>
          <ModeArt kind="ai" />
        </button>
        <button className="mode-card success compact" type="button" onClick={() => navigate('/app/chat/private')}>
          <div><strong>Mail Chess</strong><span>Private play and messages</span></div>
          <ModeArt kind="mail" />
        </button>
      </div>

      <section className="home-mini-grid">
        <Link className="mini-home-card wood-card" to="/app/friends"><GameIcon name="friends" /><strong>Friends</strong><span>{dashboard?.friends.length ?? 0} online</span></Link>
        <Link className="mini-home-card wood-card" to="/app/equipment"><GameIcon name="equipment" /><strong>Equipment</strong><span>Pieces · Boards</span></Link>
        <Link className="mini-home-card wood-card" to="/app/tournaments"><GameIcon name="events" /><strong>Events</strong><span>Paris · Delhi · London</span></Link>
        <Link className="mini-home-card wood-card" to="/app/shop"><GameIcon name="shop" /><strong>Shop</strong><span>Gold · Gems · Premium</span></Link>
      </section>

      <section className="chest-row">
        <Link className="chest-card open" to="/app/daily-rewards"><GameIcon name="chest" /><span>Tap to Unlock</span><strong>Chest</strong><small>03h 00m</small></Link>
        <div className="chest-card empty"><GameIcon name="chest" /><strong>Chest Slot</strong></div>
        <div className="chest-card empty"><GameIcon name="chest" /><strong>Chest Slot</strong></div>
        <Link className="chest-card silver" to="/app/lucky-wheel"><GameIcon name="chest" /><span>Tap to Unlock</span><strong>Chest</strong><small>08h 00m</small></Link>
      </section>
    </div>
  );
}

function GamePage({ auth }: { auth: AuthState }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const mode = params.get('mode') || 'local';
  const queue = params.get('queue') || 'quick';
  const initialGameId = params.get('gameId') || '';
  const autoStart = params.get('autostart') === '1';
  const [fen, setFen] = useState(STANDARD_START_FEN);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [history, setHistory] = useState<string[]>([STANDARD_START_FEN]);
  const [statusText, setStatusText] = useState('جاهز');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [joinGameId, setJoinGameId] = useState('');
  const [messages, setMessages] = useState<Array<{ senderUserId: string; content: string }>>([]);
  const [chatText, setChatText] = useState('');
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState('');
  const engine = useMemo(() => new ChessEngine(fen), [fen]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const autoQueueStartedRef = useRef(false);

  useEffect(() => {
    setFen(STANDARD_START_FEN);
    setHistory([STANDARD_START_FEN]);
    setLastMove(null);
    setStatusText('جاهز');
    setMessages([]);
    setGameId(initialGameId || null);
    setJoinGameId(initialGameId || '');
  }, [initialGameId, mode]);

  useEffect(() => {
    if (!auth.token) return;
    const instance = getSocket(auth.token);
    setSocket(instance);
    if (mode === 'online' && initialGameId) {
      instance.emit('game:join', { gameId: initialGameId });
    }

    const onChatMessage = (message: { senderUserId: string; content: string }) => setMessages((prev) => [...prev, message]);
    const onGameUpdate = ({ state, move }: any) => {
      setFen(state.fen);
      setLastMove({ from: move.from, to: move.to });
      setHistory((prev) => [...prev, state.fen]);
      setStatusText(state.status.checkmate ? 'كش مات' : state.status.draw ? 'تعادل' : state.status.inCheck ? 'كش' : 'نقلة ناجحة');
    };
    const onGameState = ({ state, gameId: incomingGameId }: any) => {
      setGameId(incomingGameId);
      setFen(state.fen);
      setHistory([state.fen]);
      setStatusText('تم تحميل المباراة الأونلاين');
    };
    const onGameFinished = ({ result }: any) => {
      setStatusText(result === '1/2-1/2' ? 'انتهت المباراة بالتعادل' : `انتهت المباراة: ${result}`);
    };
    const onGameMatched = ({ gameId: incomingGameId }: any) => {
      setGameId(incomingGameId);
      setJoinGameId(incomingGameId);
      setStatusText('تم العثور على خصم وبدء المباراة');
      triggerDeviceFeedback('success');
    };

    instance.on('chat:message', onChatMessage);
    instance.on('game:update', onGameUpdate);
    instance.on('game:state', onGameState);
    instance.on('game:finished', onGameFinished);
    instance.on('game:matched', onGameMatched);

    return () => {
      instance.off('chat:message', onChatMessage);
      instance.off('game:update', onGameUpdate);
      instance.off('game:state', onGameState);
      instance.off('game:finished', onGameFinished);
      instance.off('game:matched', onGameMatched);
    };
  }, [auth.token]);

  const applyLocalMove = async (move: { from: string; to: string; promotion?: 'q' | 'r' | 'b' | 'n' }) => {
    if (mode === 'online' && socket && gameId) {
      socket.emit('game:move', { gameId, move }, (response: any) => {
        if (!response?.ok) {
          setStatusText(response?.message || 'تعذر إرسال النقلة');
        }
      });
      return;
    }

    const local = new ChessEngine(fen);
    const result = local.makeMove(move);
    setFen(local.exportFEN());
    setLastMove({ from: result.from, to: result.to });
    setHistory((prev) => [...prev, local.exportFEN()]);
    const status = local.getStatus();
    setStatusText(status.checkmate ? 'كش مات' : status.draw ? 'تعادل' : status.inCheck ? 'كش' : 'دور الطرف الآخر');

    if (mode === 'ai' && !status.checkmate && !status.draw) {
      const response = await api<{ move: { from: string; to: string; promotion?: 'q' | 'r' | 'b' | 'n' } | null }>('/api/games/ai', {
        method: 'POST',
        token: auth.token,
        body: JSON.stringify({ fen: local.exportFEN(), depth: 2, color: local.turn }),
      });
      if (response.move) {
        const followUp = new ChessEngine(local.exportFEN());
        const aiMove = followUp.makeMove(response.move);
        setFen(followUp.exportFEN());
        setLastMove({ from: aiMove.from, to: aiMove.to });
        setHistory((prev) => [...prev, followUp.exportFEN()]);
        const nextStatus = followUp.getStatus();
        setStatusText(nextStatus.checkmate ? 'الكمبيوتر أنهى المباراة' : nextStatus.inCheck ? 'أنت تحت كش' : 'دورك');
      }
    }
  };

  const startOnline = () => {
    if (!socket || !auth.user) return;
    socket.emit('game:create', { whiteId: auth.user.id, timeControl: 'rapid', incrementSeconds: 2, queueType: queue }, (response: any) => {
      if (response?.ok) {
        setGameId(response.gameId);
        setJoinGameId(response.gameId);
        setFen(response.state.fen);
        setHistory([response.state.fen]);
        socket.emit('game:join', { gameId: response.gameId });
        setStatusText(response.waiting ? 'جاري البحث عن خصم...' : response.matched ? 'تم العثور على خصم وبدء المباراة' : 'تم إنشاء مباراة أونلاين');
      }
    });
  };

  const connectToGame = () => {
    if (!socket || !joinGameId.trim()) return;
    socket.emit('game:join', { gameId: joinGameId.trim() });
    setGameId(joinGameId.trim());
    setStatusText('تم الانضمام إلى غرفة المباراة');
  };

  const resignGame = () => {
    if (!socket || !gameId) return;
    socket.emit('game:resign', { gameId }, (response: any) => {
      if (response?.ok) setStatusText(`استسلام: ${response.result}`);
    });
  };

  useEffect(() => {
    if (mode !== 'online' || !autoStart || !socket || !auth.user || autoQueueStartedRef.current) return;
    autoQueueStartedRef.current = true;
    startOnline();
  }, [autoStart, auth.user, mode, socket]);

  const sendMessage = () => {
    if (!socket || !chatText.trim()) return;
    socket.emit('chat:send', { roomId: gameId, content: chatText, scope: 'room' });
    setChatText('');
  };

  const recordVoiceMessage = async () => {
    try {
      setVoiceError('');
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('المتصفح لا يدعم التسجيل الصوتي');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      voiceChunksRef.current = [];
      recorder.ondataavailable = (event) => voiceChunksRef.current.push(event.data);
      recorder.onstop = () => {
        const blob = new Blob(voiceChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          socket?.emit('chat:send', { roomId: gameId, content: reader.result, scope: 'room', messageType: 'voice' });
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.start();
      setStatusText('جارٍ تسجيل رسالة صوتية لمدّة 5 ثوانٍ');
      setTimeout(() => recorder.stop(), 5000);
    } catch (error) {
      setVoiceError((error as Error).message);
    }
  };

  return (
    <div className="game-layout">
      <section className="card board-panel">
        <div className="section-header">
          <div>
            <h3>ساحة اللعب</h3>
            <p>{mode === 'local' ? 'محلي لاعب ضد لاعب' : mode === 'ai' ? 'لعب ضد الكمبيوتر' : `مباراة أونلاين · Queue ${queue}`}</p>
          </div>
          <div className="inline-actions wrap">
            {mode === 'online' && <button className="btn secondary" type="button" onClick={startOnline}>بدء مباراة أونلاين</button>}
            {mode === 'online' && <button className="btn secondary" type="button" onClick={resignGame} disabled={!gameId}>استسلام</button>}
            <button className="btn secondary" type="button" onClick={() => navigator.clipboard.writeText(new ChessEngine(fen).toPGN())}>نسخ PGN</button>
            <button className="btn secondary" type="button" onClick={() => navigator.clipboard.writeText(fen)}>نسخ FEN</button>
          </div>
        </div>
        {mode === 'online' && (
          <div className="form-grid compact-grid">
            <label className="field">
              <span>معرّف المباراة</span>
              <input value={joinGameId} onChange={(event) => setJoinGameId(event.target.value)} placeholder="ألصق Game ID" />
            </label>
            <div className="inline-actions stretch-end">
              <button className="btn secondary" type="button" onClick={connectToGame}>انضمام لمباراة</button>
            </div>
          </div>
        )}
        {gameId && <p className="pill-inline">Game ID: <code>{gameId}</code></p>}
        <div className="board-stage">
          <div className="board-player-card opponent">
            <span className="board-player-avatar"><GameIcon name="player" /></span>
            <div><strong>Computer / Rival</strong><small>Black · 1200</small></div>
          </div>
          <ChessBoard fen={fen} lastMove={lastMove} onMove={applyLocalMove} />
          <div className="board-player-card current">
            <span className="board-player-avatar"><GameIcon name="player" /></span>
            <div><strong>{auth.user?.username || 'You'}</strong><small>White · {auth.user?.rating ?? 1200}</small></div>
          </div>
          <button className="hint-fab" type="button" onClick={() => triggerDeviceFeedback('tap')}><GameIcon name="hint" /><b>2</b></button>
        </div>
        <div className="stats-grid board-info">
          <div><span>الدور</span><strong>{engine.turn === 'w' ? 'الأبيض' : 'الأسود'}</strong></div>
          <div><span>الوضع</span><strong>{statusText}</strong></div>
          <div><span>عدد النقلات</span><strong>{Math.max(history.length - 1, 0)}</strong></div>
          <div><span>Queue</span><strong>{queue}</strong></div>
          <div><span>Analysis</span><Link className="text-link" to="/app/analysis">فتح التحليل</Link></div>
          <div><span>Replay</span><Link className="text-link" to="/app/replay">Replay Viewer</Link></div>
        </div>
      </section>
      <section className="side-stack">
        <section className="card">
          <div className="section-header"><h3>الدردشة</h3><button className="btn secondary" type="button" onClick={recordVoiceMessage}><GameIcon name="sound" />رسالة صوتية</button></div>
          {voiceError && <p className="error-text">{voiceError}</p>}
          <div className="chat-box">
            {messages.map((message, index) => (
              <div key={`${message.senderUserId}-${index}`} className="chat-item">
                <strong>{message.senderUserId === auth.user?.id ? 'أنت' : 'لاعب'}</strong>
                {String(message.content).startsWith('data:audio') ? <audio controls src={message.content} /> : <p>{message.content}</p>}
              </div>
            ))}
            {messages.length === 0 && <p>لا توجد رسائل بعد.</p>}
          </div>
          <div className="inline-actions">
            <input value={chatText} onChange={(event) => setChatText(event.target.value)} placeholder="اكتب رسالة..." />
            <button className="btn" type="button" onClick={sendMessage}>إرسال</button>
          </div>
        </section>
        <VoiceChatPanel socket={socket} targetUserId={targetUserId} />
        <section className="card">
          <div className="section-header"><h3>تحكم بالصوت</h3></div>
          <label className="field compact"><span>معرّف اللاعب المستهدف</span><input value={targetUserId ?? ''} onChange={(event) => setTargetUserId(event.target.value)} placeholder="ضع user id" /></label>
          <p>ضع معرف اللاعب الآخر لتفعيل WebRTC بينكما أثناء التجربة المحلية أو المباراة الأونلاين.</p>
        </section>
      </section>
    </div>
  );
}

function RoomsPage({ auth }: { auth: AuthState }) {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [members, setMembers] = useState<Record<string, Array<{ user_id: string; username: string; role: string }>>>({});
  const [form, setForm] = useState({ name: '', visibility: 'public', password: '', maxPlayers: 2, timeControl: 'blitz', incrementSeconds: 0 });
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const loadRooms = useCallback(() => api<{ rooms: Room[] }>('/api/rooms', { token: auth.token }).then((response) => setRooms(response.rooms)), [auth.token]);

  useEffect(() => {
    loadRooms();
  }, [loadRooms]);

  const toggleMembers = async (roomId: string) => {
    if (members[roomId]) {
      setMembers((prev) => {
        const next = { ...prev };
        delete next[roomId];
        return next;
      });
      return;
    }
    const response = await api<{ members: Array<{ user_id: string; username: string; role: string }> }>(`/api/rooms/${roomId}/members`, { token: auth.token });
    setMembers((prev) => ({ ...prev, [roomId]: response.members }));
  };

  return (
    <div className="two-column">
      <section className="card">
        <div className="section-header"><h3>إنشاء غرفة</h3></div>
        <div className="form-grid">
          <label className="field"><span>اسم الغرفة</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label className="field"><span>النوع</span><select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })}><option value="public">عامة</option><option value="private">خاصة</option><option value="password">بكلمة مرور</option></select></label>
          {form.visibility === 'password' && <label className="field"><span>كلمة المرور</span><input value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>}
          <label className="field"><span>عدد اللاعبين</span><input type="number" min={2} max={16} value={form.maxPlayers} onChange={(event) => setForm({ ...form, maxPlayers: Number(event.target.value) })} /></label>
          <label className="field"><span>نوع الوقت</span><select value={form.timeControl} onChange={(event) => setForm({ ...form, timeControl: event.target.value })}><option>bullet</option><option>blitz</option><option>rapid</option><option>classical</option><option>custom</option></select></label>
          <label className="field"><span>Increment</span><input type="number" min={0} max={60} value={form.incrementSeconds} onChange={(event) => setForm({ ...form, incrementSeconds: Number(event.target.value) })} /></label>
        </div>
        <button className="btn" type="button" onClick={async () => {
          try {
            setError('');
            const payload = {
              ...form,
              password: form.visibility === 'password' ? form.password : undefined,
            };
            await api('/api/rooms', { method: 'POST', token: auth.token, body: JSON.stringify(payload) });
            setFeedback('تم إنشاء الغرفة');
            loadRooms();
          } catch (err) {
            setError((err as Error).message);
          }
        }}>إنشاء</button>
        {feedback && <p>{feedback}</p>}
        {error && <p className="error-text">{error}</p>}
      </section>
      <section className="card">
        <div className="section-header"><h3>اللوبي</h3></div>
        <div className="list-grid">
          {rooms.map((room) => (
            <article key={room.id} className="list-item vertical">
              <div className="row-spread full-width">
                <div>
                  <strong>{room.name}</strong>
                  <p>{room.host_username} · {room.visibility} · {room.status}</p>
                </div>
                <span className="pill">{room.member_count}/{room.max_players}</span>
              </div>
              <div className="inline-actions wrap">
                <Link className="btn secondary" to={`/app/rooms/${room.id}`}>لوبي الغرفة</Link>
                {!room.is_member ? (
                  <button className="btn secondary" type="button" onClick={async () => {
                    if (room.visibility === 'password') {
                      navigate(`/app/rooms/${room.id}?join=1`);
                      return;
                    }
                    try {
                      setError('');
                      await api(`/api/rooms/${room.id}/join`, { method: 'POST', token: auth.token, body: JSON.stringify({}) });
                      triggerDeviceFeedback('success');
                      setFeedback(`تم الانضمام إلى ${room.name}`);
                      loadRooms();
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}>انضمام</button>
                ) : (
                  <button className="btn secondary" type="button" onClick={async () => {
                    try {
                      setError('');
                      await api(`/api/rooms/${room.id}/leave`, { method: 'POST', token: auth.token });
                      triggerDeviceFeedback('tap');
                      setFeedback(`تم مغادرة ${room.name}`);
                      loadRooms();
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}>مغادرة</button>
                )}
                <button className="btn secondary" type="button" onClick={() => toggleMembers(room.id)}>{members[room.id] ? 'إخفاء الأعضاء' : 'عرض الأعضاء'}</button>
              </div>
              {members[room.id] && (
                <div className="list-grid full-width">
                  {members[room.id].map((member) => (
                    <div key={member.user_id} className="table-row">
                      <strong>{member.username}</strong>
                      <span>{member.role === 'host' ? 'Host' : 'Member'}</span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
          {rooms.length === 0 && <p>لا يوجد غرف حالياً.</p>}
        </div>
      </section>
    </div>
  );
}

function FriendsPage({ auth }: { auth: AuthState }) {
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [incoming, setIncoming] = useState<IncomingFriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingFriendRequest[]>([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const loadFriends = useCallback(async () => {
    const response = await api<{ friends: FriendItem[]; incoming: IncomingFriendRequest[]; outgoing: OutgoingFriendRequest[] }>('/api/friends', { token: auth.token });
    setFriends(response.friends);
    setIncoming(response.incoming);
    setOutgoing(response.outgoing);
  }, [auth.token]);

  useEffect(() => {
    loadFriends().catch((err) => setError((err as Error).message));
  }, [loadFriends]);

  return (
    <div className="friends-screen">
      <section className="friends-tabs wood-card">
        <button className="friends-tab active" type="button">Challenge</button>
        <Link className="friends-tab" to="/app/gift-center">Gifts</Link>
        <Link className="friends-tab" to="/app/mailbox">Inbox</Link>
      </section>

      <section className="friends-invite wood-card">
        <div>
          <h3>Invite your friends!</h3>
          <p>واجهة مستقلة للأصدقاء مع أزرار دعوة وبحث وتحدي مباشرة.</p>
        </div>
        <div className="inline-actions wrap">
          <button className="btn secondary" type="button" onClick={() => navigate('/app/search')}><GameIcon name="search" />بحث عن لاعبين</button>
          <Link className="btn secondary" to="/app/friends/requests"><GameIcon name="mail" />Friend Requests</Link>
        </div>
      </section>

      <section className="card">
        <div className="section-header"><h3>الأصدقاء</h3><span className="pill-inline"><GameIcon name="friends" />{friends.length}</span></div>
        <div className="list-grid">
          {friends.map((friend) => (
            <article key={friend.friend_user_id} className="list-item friend-row">
              <div className="friend-summary">
                <span className="friend-avatar"><GameIcon name="player" /></span>
                <div>
                  <strong>{friend.friend_username}</strong>
                  <p>Elo: {friend.friend_rating}</p>
                </div>
              </div>
              <div className="inline-actions wrap">
                <button className="btn" type="button" onClick={() => navigate('/app/game?mode=online&queue=quick&autostart=1')}>Challenge</button>
                <Link className="btn secondary" to={`/app/player/${friend.friend_user_id}`}>الملف</Link>
                <Link className="btn secondary" to="/app/chat/private">محادثة</Link>
              </div>
            </article>
          ))}
          {friends.length === 0 && <p>لا يوجد أصدقاء بعد.</p>}
        </div>
      </section>

      <section className="two-column">
        <section className="card">
          <div className="section-header"><h3>الطلبات الواردة</h3></div>
          <div className="list-grid">
            {incoming.map((request) => (
              <article key={request.requester_id} className="list-item vertical">
                <div className="row-spread full-width">
                  <div>
                    <strong>{request.requester_username}</strong>
                    <p>Elo: {request.requester_rating}</p>
                  </div>
                  <div className="inline-actions wrap">
                    <Link className="btn secondary" to={`/app/player/${request.requester_id}`}>الملف</Link>
                    <button className="btn" type="button" onClick={async () => {
                      await api(`/api/friends/${request.requester_id}/accept`, { method: 'POST', token: auth.token });
                      loadFriends();
                    }}>قبول</button>
                  </div>
                </div>
              </article>
            ))}
            {incoming.length === 0 && <p>لا توجد طلبات واردة.</p>}
          </div>
        </section>
        <section className="card">
          <div className="section-header"><h3>الطلبات المرسلة</h3></div>
          <div className="list-grid">
            {outgoing.map((request) => (
              <article key={request.target_id} className="list-item">
                <div>
                  <strong>{request.target_username}</strong>
                  <p>بانتظار القبول</p>
                </div>
                <button className="btn secondary" type="button" onClick={async () => {
                  await api(`/api/friends/${request.target_id}`, { method: 'DELETE', token: auth.token });
                  loadFriends();
                }}>إلغاء</button>
              </article>
            ))}
            {outgoing.length === 0 && <p>لا توجد طلبات مرسلة.</p>}
          </div>
          {error && <p className="error-text">{error}</p>}
        </section>
      </section>
    </div>
  );
}

function SearchPage({ auth }: { auth: AuthState }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSearch = async () => {
    try {
      setError('');
      setMessage('');
      const response = await api<{ users: SearchUser[]; rooms: Room[] }>(`/api/search?q=${encodeURIComponent(query)}`, { token: auth.token });
      setUsers(response.users);
      setRooms(response.rooms);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="two-column">
      <section className="card">
        <div className="section-header"><h3>البحث</h3></div>
        <div className="inline-actions">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث عن لاعب أو غرفة" />
          <button className="btn" type="button" onClick={handleSearch}>بحث</button>
        </div>
        {message && <p>{message}</p>}
        {error && <p className="error-text">{error}</p>}
      </section>
      <section className="card">
        <div className="section-header"><h3>نتائج اللاعبين</h3></div>
        <div className="list-grid">
          {users.map((user) => (
            <article key={user.id} className="list-item vertical">
              <div className="row-spread full-width">
                <div>
                  <strong>{user.username}</strong>
                  <p>{user.bio || 'لا توجد نبذة'} · Elo {user.rating}</p>
                </div>
                <div className="inline-actions wrap">
                  <Link className="btn secondary" to={`/app/player/${user.id}`}>Player Profile</Link>
                  <button className="btn secondary" type="button" onClick={async () => {
                    try {
                      await api('/api/friends/request', { method: 'POST', token: auth.token, body: JSON.stringify({ friendId: user.id }) });
                      setMessage(`تم إرسال طلب صداقة إلى ${user.username}`);
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}>إضافة صديق</button>
                </div>
              </div>
            </article>
          ))}
          {query && users.length === 0 && <p>لا توجد نتائج لاعبين.</p>}
        </div>
        <div className="section-header top-gap"><h3>نتائج الغرف</h3></div>
        <div className="list-grid">
          {rooms.map((room) => (
            <article key={room.id} className="list-item vertical">
              <div>
                <strong>{room.name}</strong>
                <p>{room.host_username} · {room.member_count}/{room.max_players}</p>
              </div>
              <Link className="btn secondary" to={`/app/rooms/${room.id}`}>فتح الغرفة</Link>
            </article>
          ))}
          {query && rooms.length === 0 && <p>لا توجد نتائج غرف.</p>}
        </div>
      </section>
    </div>
  );
}

function LeaderboardPage() {
  const [players, setPlayers] = useState<User[]>([]);
  useEffect(() => {
    api<{ players: User[] }>('/api/leaderboard').then((response) => setPlayers(response.players));
  }, []);
  return (
    <section className="card">
      <div className="section-header"><h3>لوحة المتصدرين</h3></div>
      <div className="table-like">
        {players.map((player, index) => (
          <div key={player.id} className="table-row">
            <span>#{index + 1}</span>
            <strong>{player.username}</strong>
            <span>{player.rating}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function HistoryPage({ token }: { token: string }) {
  const [games, setGames] = useState<any[]>([]);
  useEffect(() => {
    api<{ games: any[] }>('/api/history', { token }).then((response) => setGames(response.games));
  }, [token]);
  return (
    <section className="card">
      <div className="section-header"><h3>سجل المباريات</h3></div>
      <div className="list-grid">
        {games.map((game) => (
          <article key={game.id} className="list-item vertical">
            <strong>{game.white_username || 'White'} vs {game.black_username || 'Black'}</strong>
            <p>{game.time_control} · {game.result} · {game.status}</p>
            <code>{game.final_fen}</code>
            <div className="inline-actions wrap">
              <Link className="btn secondary" to="/app/analysis">تحليل المباراة</Link>
              <Link className="btn secondary" to="/app/replay">Replay Viewer</Link>
            </div>
          </article>
        ))}
        {games.length === 0 && <p>لا توجد مباريات محفوظة بعد.</p>}
      </div>
    </section>
  );
}

function ReplayPage() {
  const [input, setInput] = useState('');
  const [fens, setFens] = useState<string[]>([STANDARD_START_FEN]);
  const [index, setIndex] = useState(0);
  return (
    <div className="two-column">
      <section className="card board-panel">
        <div className="section-header"><h3>إعادة اللعب والتحليل</h3></div>
        <ChessBoard fen={fens[index] ?? STANDARD_START_FEN} interactive={false} />
        <div className="inline-actions wrap">
          <button className="btn secondary" type="button" onClick={() => setIndex(0)}>البداية</button>
          <button className="btn secondary" type="button" onClick={() => setIndex((value) => Math.max(0, value - 1))}>السابق</button>
          <button className="btn secondary" type="button" onClick={() => setIndex((value) => Math.min(fens.length - 1, value + 1))}>التالي</button>
          <button className="btn secondary" type="button" onClick={() => setIndex(fens.length - 1)}>النهاية</button>
        </div>
      </section>
      <section className="card">
        <div className="section-header"><h3>استيراد PGN أو FEN</h3></div>
        <textarea rows={12} value={input} onChange={(event) => setInput(event.target.value)} placeholder="ألصق PGN أو FEN هنا" />
        <div className="inline-actions wrap">
          <button className="btn" type="button" onClick={() => {
            const text = input.trim();
            if (text.includes('/')) {
              const engine = new ChessEngine(text);
              setFens([engine.exportFEN()]);
              setIndex(0);
              return;
            }
            const engine = new ChessEngine();
            engine.loadPGN(text);
            setFens([STANDARD_START_FEN, ...engine.history.map((entry) => entry.fenAfter)]);
            setIndex(0);
          }}>تحميل</button>
          <button className="btn secondary" type="button" onClick={() => navigator.clipboard.writeText(fens[index] ?? STANDARD_START_FEN)}>نسخ FEN الحالي</button>
        </div>
      </section>
    </div>
  );
}

function ProfilePage({ auth, setUser }: { auth: AuthState; setUser: (user: User | null) => void }) {
  const [bio, setBio] = useState(auth.user?.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(auth.user?.avatar_url ?? '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);

  return (
    <div className="profile-screen">
      <section className="profile-hero wood-card">
        <div className="profile-main-row">
          <div className="profile-avatar-xl">
            {avatarUrl ? <img src={avatarUrl} alt={auth.user?.username || 'player'} /> : <GameIcon name="player" />}
            <span className="profile-level-badge">6</span>
          </div>
          <div className="profile-title-block">
            <span className="eyebrow">PROFILE</span>
            <h3>{auth.user?.username || 'Walid_922'}</h3>
            <p>ID: {auth.user?.username || 'Walid_922'} · Explorer</p>
          </div>
          <div className="profile-flag-card">
            <span>Algeria</span>
            <strong>Elo {auth.user?.rating ?? 1200}</strong>
          </div>
        </div>
        <div className="profile-tabs wood-card">
          <button className="profile-tab active" type="button">Info</button>
          <button className="profile-tab" type="button">Avatars</button>
          <button className="profile-tab" type="button">Frames</button>
        </div>
      </section>

      <section className="profile-gear-grid">
        <article className="profile-gear-card wood-card">
          <div className="profile-gear-icon"><EquipmentArt kind="piece" /></div>
          <strong>Chalk Pieces</strong>
          <span>Equipped set</span>
        </article>
        <article className="profile-gear-card wood-card">
          <div className="profile-gear-icon"><EquipmentArt kind="board" /></div>
          <strong>Maple Board</strong>
          <span>Current board skin</span>
        </article>
      </section>

      <section className="card profile-stats-grid">
        <div><span>Total Winnings</span><strong>23,100</strong></div>
        <div><span>Games Won</span><strong>12 / 27</strong></div>
        <div><span>Win Rate</span><strong>44%</strong></div>
        <div><span>Current Streak</span><strong>3</strong></div>
        <div><span>Best Streak</span><strong>4</strong></div>
        <div><span>World Rank</span><strong>#982</strong></div>
      </section>

      <section className="card">
        <div className="section-header"><h3>تعديل الملف الشخصي</h3></div>
        <div className="form-grid">
          <label className="field"><span>اسم المستخدم</span><input value={auth.user?.username ?? ''} readOnly /></label>
          <label className="field"><span>رابط الصورة الشخصية</span><input value={avatarUrl ?? ''} onChange={(event) => setAvatarUrl(event.target.value)} /></label>
          <label className="field stretch">
            <span>رفع صورة</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={async (event) => {
                const input = event.currentTarget;
                const file = input.files?.[0];
                if (!file || !auth.token) return;
                try {
                  setUploading(true);
                  setError('');
                  setMessage('');
                  const dataUrl = await readFileAsDataUrl(file);
                  const response = await api<{ url: string }>('/api/uploads/image', {
                    method: 'POST',
                    token: auth.token,
                    body: JSON.stringify({ fileName: file.name, dataUrl }),
                  });
                  setAvatarUrl(response.url);
                  setMessage('تم رفع الصورة بنجاح. اضغط حفظ لتثبيتها في الملف الشخصي.');
                } catch (err) {
                  setError((err as Error).message);
                } finally {
                  setUploading(false);
                  input.value = '';
                }
              }}
            />
          </label>
          {avatarUrl && (
            <div className="field stretch">
              <span>معاينة</span>
              <img src={avatarUrl} alt="Avatar preview" className="profile-preview-image" />
            </div>
          )}
          <label className="field stretch"><span>النبذة</span><textarea rows={4} value={bio} onChange={(event) => setBio(event.target.value)} /></label>
        </div>
        <button className="btn" type="button" disabled={!auth.token || uploading} onClick={async () => {
          if (!auth.token) return;
          try {
            setError('');
            const response = await api<{ user: User }>('/api/profile', { method: 'PATCH', token: auth.token, body: JSON.stringify({ bio, avatarUrl }) });
            setUser(response.user);
            setMessage('تم تحديث الملف الشخصي');
          } catch (err) {
            setError((err as Error).message);
          }
        }}>{uploading ? 'جارٍ رفع الصورة...' : 'حفظ'}</button>
        {message && <p>{message}</p>}
        {error && <p className="error-text">{error}</p>}
      </section>
    </div>
  );
}

function SettingsPage({ auth, setUser }: { auth: AuthState; setUser: (user: User | null) => void }) {
  const [theme, setTheme] = useState<'light' | 'dark'>(auth.user?.theme ?? 'dark');
  const [language, setLanguage] = useState<'ar' | 'en' | 'fr'>(auth.user?.language ?? 'ar');
  const [boardTheme, setBoardTheme] = useState(localStorage.getItem('warhex-board-theme') || 'classic');
  const [moveInput, setMoveInput] = useState(localStorage.getItem('warhex-move-input') || 'drag');
  const [soundEnabled, setSoundEnabled] = useState(localStorage.getItem('warhex-sound') !== '0');
  const [musicEnabled, setMusicEnabled] = useState(localStorage.getItem('warhex-music') === '1');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="settings-screen">
      <section className="settings-header wood-card">
        <div>
          <span className="eyebrow">SETTINGS</span>
          <h3>الإعدادات</h3>
          <p>قوائم مضغوطة شبيهة بواجهة اللعبة المرجعية مع مجموعات Account و Game Options.</p>
        </div>
        <GameIcon name="settings" className="settings-badge-icon" />
      </section>

      <section className="settings-group wood-card">
        <div className="settings-group-label">Account</div>
        <div className="settings-option-list">
          <label className="settings-option-row"><span>المظهر</span><select value={theme} onChange={(event) => setTheme(event.target.value as 'light' | 'dark')}><option value="dark">داكن</option><option value="light">فاتح</option></select></label>
          <label className="settings-option-row"><span>اللغة</span><select value={language} onChange={(event) => setLanguage(event.target.value as 'ar' | 'en' | 'fr')}><option value="ar">العربية</option><option value="en">English</option><option value="fr">Français</option></select></label>
          <Link className="settings-action-pill" to="/app/language">Change</Link>
        </div>
      </section>

      <section className="settings-group wood-card">
        <div className="settings-group-label">Game Options</div>
        <div className="settings-option-list">
          <label className="settings-option-row"><span>ألوان الرقعة</span><select value={boardTheme} onChange={(event) => setBoardTheme(event.target.value)}><option value="classic">Classic</option><option value="forest">Forest</option><option value="midnight">Midnight</option></select></label>
          <label className="settings-option-row"><span>طريقة التحريك</span><select value={moveInput} onChange={(event) => setMoveInput(event.target.value)}><option value="drag">سحب وإفلات</option><option value="click">نقر</option></select></label>
          <label className="settings-option-row"><span>المؤثرات الصوتية</span><select value={soundEnabled ? '1' : '0'} onChange={(event) => setSoundEnabled(event.target.value === '1')}><option value="1">مفعلة</option><option value="0">متوقفة</option></select></label>
          <label className="settings-option-row"><span>الموسيقى</span><select value={musicEnabled ? '1' : '0'} onChange={(event) => setMusicEnabled(event.target.value === '1')}><option value="1">مفعلة</option><option value="0">متوقفة</option></select></label>
        </div>
      </section>

      <div className="inline-actions wrap">
        <button className="btn" type="button" disabled={!auth.token} onClick={async () => {
          if (!auth.token) return;
          try {
            setSaved(false);
            setError('');
            localStorage.setItem('warhex-board-theme', boardTheme);
            localStorage.setItem('warhex-move-input', moveInput);
            localStorage.setItem('warhex-sound', soundEnabled ? '1' : '0');
            localStorage.setItem('warhex-music', musicEnabled ? '1' : '0');
            const response = await api<{ user: User }>('/api/profile', { method: 'PATCH', token: auth.token, body: JSON.stringify({ theme, language }) });
            setUser(response.user);
            triggerDeviceFeedback('success');
            setSaved(true);
          } catch (err) {
            setError((err as Error).message);
          }
        }}>حفظ الإعدادات</button>
        <Link className="btn secondary" to="/app/support">الدعم</Link>
      </div>
      {saved && <p>تم حفظ الإعدادات.</p>}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

function QueuePage({ auth }: { auth: AuthState }) {
  const { queueType = 'quick' } = useParams();
  const navigate = useNavigate();
  const queueCopy: Record<string, { title: string; body: string }> = {
    quick: { title: 'Classic Chess', body: 'اختَر المدينة المناسبة وابدأ المطابقة مباشرة.' },
    ranked: { title: 'Ranked Chess', body: 'بطولات مدن بتقدم وجوائز ونقاط تصنيف.' },
    gold: { title: 'Gold Play', body: 'رهانات ذهبية أعلى وجوائز أكبر.' },
    gems: { title: 'Gems Play', body: 'مواجهات نخبوية بعوائد نادرة.' },
  };
  const entry = queueCopy[queueType] || queueCopy.quick;
  return (
    <section className="arena-screen">
      <PageHero eyebrow="ARENAS" title={entry.title} body={entry.body} actions={<button className="btn" type="button" onClick={() => navigate(`/app/game?mode=online&queue=${queueType}&autostart=1`)}>ابدأ البحث الآن</button>} />
      <div className="arena-list">
        {ARENA_CARDS.map((arena) => (
          <button key={arena.id} className={`arena-card theme-${arena.theme}`} type="button" onClick={() => navigate(`/app/game?mode=online&queue=${queueType}&autostart=1`)}>
            <span className="arena-reward-tag">{arena.reward}</span>
            <div className="arena-header-mark">{arena.title}</div>
            <div className="arena-stat"><strong>Prize:</strong><span>{arena.prize}</span></div>
            <div className="arena-stat"><strong>Players online:</strong><span>{arena.online}</span></div>
            <div className="arena-stat"><strong>Entry fee:</strong><span>{arena.entry}</span></div>
            <small>Rules: {arena.rules}</small>
          </button>
        ))}
      </div>
      <div className="quick-queue-actions">
        <Link className="quick-top-btn" to="/app/game?mode=local">Local Play</Link>
        <Link className="quick-top-btn" to="/app/game?mode=ai">VS Computer</Link>
        <Link className="quick-top-btn" to="/app/rooms">Rooms</Link>
      </div>
    </section>
  );
}

function WalletPage({ auth }: { auth: AuthState }) {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  useEffect(() => {
    api<{ wallet: WalletData; transactions: WalletTransaction[] }>('/api/wallet', { token: auth.token }).then((response) => {
      setWallet(response.wallet);
      setTransactions(response.transactions);
    });
  }, [auth.token]);
  return (
    <div className="two-column">
      <section className="card">
        <PageHero eyebrow="WALLET & ECONOMY" title="المحفظة والاقتصاد" body="كل مواردك ومشترياتك ومكافآتك في صفحة حقيقية مستقلة." actions={<><Link className="btn" to="/app/store/gold"><GameIcon name="coin" />متجر الذهب</Link><Link className="btn secondary" to="/app/store/gems"><GameIcon name="gem" />متجر الجواهر</Link><Link className="btn secondary" to="/app/recharge"><GameIcon name="ticket" />Recharge</Link></>} />
        <div className="stats-grid">
          <div><span>Gold</span><strong>{wallet?.coins ?? '...'}</strong></div>
          <div><span>Gems</span><strong>{wallet?.gems ?? '...'}</strong></div>
          <div><span>Tickets</span><strong>{wallet?.tickets ?? '...'}</strong></div>
        </div>
      </section>
      <section className="card">
        <div className="section-header"><h3>آخر المعاملات</h3><Link to="/app/premium">Premium</Link></div>
        <div className="list-grid">
          {transactions.slice(0, 10).map((transaction) => (
            <article key={transaction.id} className="list-item">
              <div>
                <strong>{transaction.kind}</strong>
                <p>{formatRelativeStamp(transaction.created_at)}</p>
              </div>
              <span>{transaction.amount > 0 ? '+' : ''}{transaction.amount} {transaction.currency}</span>
            </article>
          ))}
          {transactions.length === 0 && <p>لا توجد معاملات بعد.</p>}
        </div>
      </section>
    </div>
  );
}

function StorePage({ auth, category }: { auth: AuthState; category: 'gold' | 'gems' | 'recharge' | 'premium' }) {
  const [feedback, setFeedback] = useState('');
  const catalog: Record<string, Array<{ id: string; title: string; amount: string; price: string; bonus: string }>> = {
    gold: [
      { id: 'gold-small', title: 'Bunch of Coins', amount: '20 000', price: '190.00 د.ج', bonus: '25%' },
      { id: 'gold-large', title: 'Vault of Coins', amount: '800 000', price: '4,600.00 د.ج', bonus: '100%' },
    ],
    gems: [
      { id: 'gems-small', title: 'Locker of Gems', amount: '2 500', price: '1,840.00 د.ج', bonus: '35%' },
      { id: 'gems-large', title: 'Ton of Gems', amount: '20 000', price: '9,200.00 د.ج', bonus: '120%' },
    ],
    recharge: [
      { id: 'recharge-basic', title: 'Starter Recharge', amount: '4 000 + 200', price: '890.00 د.ج', bonus: 'HOT' },
      { id: 'recharge-elite', title: 'Elite Recharge', amount: '15 000 + 900', price: '2,990.00 د.ج', bonus: 'BEST' },
    ],
    premium: [
      { id: 'premium-month', title: 'Premium 1 Month', amount: 'VIP + Rewards', price: '790.00 د.ج', bonus: 'VIP' },
      { id: 'premium-year', title: 'Premium 12 Months', amount: 'VIP + Chests', price: '5,900.00 د.ج', bonus: 'MAX' },
    ],
  };
  return (
    <section className="shop-screen">
      <PageHero eyebrow="SHOP" title={category === 'gold' ? 'Coins' : category === 'gems' ? 'Gems' : category === 'recharge' ? 'Recharge' : 'Premium Membership'} body="تصميم متجر أقرب لواجهة اللعبة المرجعية مع بطاقات شراء كبيرة وزر سعر أخضر." actions={<><Link className="btn secondary" to="/app/store/gold">Coins</Link><Link className="btn secondary" to="/app/store/gems">Gems</Link><Link className="btn secondary" to="/app/recharge">Recharge</Link><Link className="btn secondary" to="/app/premium">Premium</Link></>} />
      <div className="shop-grid-view">
        {catalog[category].map((pack) => (
          <article key={pack.id} className="shop-pack-card">
            <span className="discount-star">{pack.bonus}</span>
            <h3>{pack.title}</h3>
            <PackArt kind={category} />
            <strong className="shop-pack-amount">{pack.amount}</strong>
            <button className="shop-price-btn" type="button" onClick={async () => {
              await api('/api/store/purchase', { method: 'POST', token: auth.token, body: JSON.stringify({ category, packId: pack.id }) });
              triggerDeviceFeedback('success');
              setFeedback(`تمت إضافة ${pack.title} إلى حسابك.`);
            }}>{pack.price}</button>
          </article>
        ))}
      </div>
      {feedback && <p>{feedback}</p>}
    </section>
  );
}

function RewardsPage({ auth, mode }: { auth: AuthState; mode: 'daily' | 'wheel' }) {
  const [feedback, setFeedback] = useState('');
  const [spinning, setSpinning] = useState(false);
  const spinReward = async () => {
    setSpinning(true);
    const reward = mode === 'daily' ? { coins: 250, gems: 15 } : [{ coins: 120 }, { coins: 300, gems: 5 }, { coins: 600, gems: 25 }][Math.floor(Math.random() * 3)];
    await api('/api/wallet/reward', { method: 'POST', token: auth.token, body: JSON.stringify({ kind: mode === 'daily' ? 'daily' : 'wheel', reward }) });
    triggerDeviceFeedback('success');
    setFeedback(`تمت إضافة ${reward.coins ?? 0} ذهب و ${reward.gems ?? 0} جواهر.`);
    setSpinning(false);
  };
  return (
    <section className="card">
      <PageHero eyebrow="REWARDS" title={mode === 'daily' ? 'Daily Rewards' : 'Lucky Wheel'} body={mode === 'daily' ? 'استلم مكافأة الدخول اليومية مباشرة من الخادم.' : 'عجلة الحظ تمنحك موردًا عشوائيًا عند كل تدوير.'} actions={<button className="btn" type="button" onClick={spinReward} disabled={spinning}><GameIcon name={mode === 'daily' ? 'gift' : 'spark'} />{mode === 'daily' ? 'استلام الآن' : spinning ? 'جارٍ التدوير...' : 'تدوير العجلة'}</button>} />
      {feedback && <p>{feedback}</p>}
    </section>
  );
}

function GiftCenterPage({ auth }: { auth: AuthState }) {
  const [gifts, setGifts] = useState<{ received: GiftItem[]; sent: GiftItem[] }>({ received: [], sent: [] });
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [receiverUserId, setReceiverUserId] = useState('');
  const [kind, setKind] = useState<'gold' | 'gems' | 'premium'>('gold');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    const [giftResponse, friendResponse] = await Promise.all([
      api<{ received: GiftItem[]; sent: GiftItem[] }>('/api/gifts', { token: auth.token }),
      api<{ friends: FriendItem[]; incoming: IncomingFriendRequest[]; outgoing: OutgoingFriendRequest[] }>('/api/friends', { token: auth.token }),
    ]);
    setGifts(giftResponse);
    setFriends(friendResponse.friends);
    setReceiverUserId(friendResponse.friends[0]?.friend_user_id || '');
  }, [auth.token]);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="two-column">
      <section className="card">
        <PageHero eyebrow="GIFTS" title="Gift Center" body="إرسال واستلام الهدايا بين الأصدقاء مع تحديث المحفظة فعليًا." />
        <div className="form-grid">
          <label className="field"><span>الصديق المستلم</span><select value={receiverUserId} onChange={(event) => setReceiverUserId(event.target.value)}>{friends.map((friend) => <option key={friend.friend_user_id} value={friend.friend_user_id}>{friend.friend_username}</option>)}</select></label>
          <label className="field"><span>نوع الهدية</span><select value={kind} onChange={(event) => setKind(event.target.value as 'gold' | 'gems' | 'premium')}><option value="gold">Gold</option><option value="gems">Gems</option><option value="premium">Premium</option></select></label>
        </div>
        <button className="btn" type="button" disabled={!receiverUserId} onClick={async () => {
          await api('/api/gifts/send', { method: 'POST', token: auth.token, body: JSON.stringify({ receiverUserId, kind, amount: kind === 'premium' ? 1 : kind === 'gold' ? 500 : 25 }) });
          triggerDeviceFeedback('success');
          setMessage('تم إرسال الهدية.');
          load();
        }}>إرسال هدية</button>
        {message && <p>{message}</p>}
      </section>
      <section className="card">
        <div className="section-header"><h3>الهدايا الواردة</h3></div>
        <div className="list-grid">
          {gifts.received.map((gift) => (
            <article key={gift.id} className="list-item vertical">
              <strong>{gift.sender_username}</strong>
              <p>{gift.kind} · {gift.status}</p>
              {gift.status === 'pending' ? <button className="btn" type="button" onClick={async () => { await api(`/api/gifts/${gift.id}/claim`, { method: 'POST', token: auth.token }); load(); }}>استلام</button> : null}
            </article>
          ))}
          {gifts.received.length === 0 && <p>لا توجد هدايا واردة.</p>}
        </div>
      </section>
    </div>
  );
}

function NotificationsPage({ auth }: { auth: AuthState }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const load = useCallback(async () => {
    const response = await api<{ notifications: NotificationItem[] }>('/api/notifications', { token: auth.token });
    setItems(response.notifications);
  }, [auth.token]);
  useEffect(() => { load(); }, [load]);
  return (
    <section className="card">
      <PageHero eyebrow="ALERTS" title="Notifications" body="مركز الإشعارات والتنبيهات والأخبار الخاصة بحسابك." actions={<button className="btn secondary" type="button" onClick={async () => { await api('/api/notifications/read-all', { method: 'POST', token: auth.token }); load(); }}>تحديد الكل كمقروء</button>} />
      <div className="list-grid">
        {items.map((item) => (
          <article key={item.id} className="list-item vertical">
            <div className="row-spread full-width">
              <strong>{item.title}</strong>
              {!item.read_at ? <button className="btn secondary" type="button" onClick={async () => { await api(`/api/notifications/${item.id}/read`, { method: 'POST', token: auth.token }); load(); }}>قراءة</button> : <span className="pill">مقروء</span>}
            </div>
            <p>{item.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function MailboxPage({ auth }: { auth: AuthState }) {
  return (
    <div className="two-column">
      <GiftCenterPage auth={auth} />
      <NotificationsPage auth={auth} />
    </div>
  );
}

function FriendRequestsPage({ auth }: { auth: AuthState }) {
  const [incoming, setIncoming] = useState<IncomingFriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingFriendRequest[]>([]);
  const load = useCallback(async () => {
    const response = await api<{ friends: FriendItem[]; incoming: IncomingFriendRequest[]; outgoing: OutgoingFriendRequest[] }>('/api/friends', { token: auth.token });
    setIncoming(response.incoming);
    setOutgoing(response.outgoing);
  }, [auth.token]);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="two-column">
      <section className="card"><div className="section-header"><h3>Friend Requests</h3></div><div className="list-grid">{incoming.map((request) => <article key={request.requester_id} className="list-item"><div><strong>{request.requester_username}</strong><p>{request.requester_rating}</p></div><button className="btn" type="button" onClick={async () => { await api(`/api/friends/${request.requester_id}/accept`, { method: 'POST', token: auth.token }); load(); }}>قبول</button></article>)}{incoming.length === 0 && <p>لا توجد طلبات واردة.</p>}</div></section>
      <section className="card"><div className="section-header"><h3>الطلبات المرسلة</h3></div><div className="list-grid">{outgoing.map((request) => <article key={request.target_id} className="list-item"><div><strong>{request.target_username}</strong><p>بانتظار القبول</p></div><button className="btn secondary" type="button" onClick={async () => { await api(`/api/friends/${request.target_id}`, { method: 'DELETE', token: auth.token }); load(); }}>إلغاء</button></article>)}{outgoing.length === 0 && <p>لا توجد طلبات مرسلة.</p>}</div></section>
    </div>
  );
}

function PlayerProfilePage({ auth }: { auth: AuthState }) {
  const { playerId = '' } = useParams();
  const [player, setPlayer] = useState<PublicPlayer | null>(null);
  const [friendStatus, setFriendStatus] = useState('none');
  useEffect(() => {
    api<{ player: PublicPlayer; friendStatus: string }>(`/api/player/${playerId}`, { token: auth.token }).then((response) => {
      setPlayer(response.player);
      setFriendStatus(response.friendStatus);
    });
  }, [auth.token, playerId]);
  return (
    <section className="card">
      <PageHero eyebrow="PLAYER PROFILE" title={player?.username || 'اللاعب'} body={player?.bio || 'نبذة اللاعب'} actions={<>{friendStatus === 'none' ? <button className="btn" type="button" onClick={async () => { await api('/api/friends/request', { method: 'POST', token: auth.token, body: JSON.stringify({ friendId: playerId }) }); setFriendStatus('outgoing'); }}>إضافة صديق</button> : <span className="pill">{friendStatus}</span>}<Link className="btn secondary" to="/app/chat/private">محادثة خاصة</Link></>} />
      <div className="stats-grid">
        <div><span>Elo</span><strong>{player?.rating ?? '-'}</strong></div>
        <div><span>Wins</span><strong>{player?.wins ?? 0}</strong></div>
        <div><span>Max Streak</span><strong>{player?.max_streak ?? 0}</strong></div>
      </div>
    </section>
  );
}

function PrivateChatPage({ auth }: { auth: AuthState }) {
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const socket = useMemo(() => (auth.token ? getSocket(auth.token) : null), [auth.token]);
  useEffect(() => {
    api<{ friends: FriendItem[]; incoming: IncomingFriendRequest[]; outgoing: OutgoingFriendRequest[] }>('/api/friends', { token: auth.token }).then((response) => {
      setFriends(response.friends);
      setSelectedId((prev) => prev || response.friends[0]?.friend_user_id || '');
    });
  }, [auth.token]);
  const loadMessages = useCallback(async () => {
    if (!selectedId) return;
    const response = await api<{ messages: ChatMessage[] }>(`/api/messages?scope=private&receiverUserId=${selectedId}`, { token: auth.token });
    setMessages(response.messages);
  }, [auth.token, selectedId]);
  useEffect(() => { loadMessages(); }, [loadMessages]);
  useEffect(() => {
    if (!socket) return;
    const onMessage = (message: ChatMessage) => {
      if (message.scope === 'private' && (message.senderUserId === selectedId || message.receiverUserId === selectedId)) {
        setMessages((prev) => [...prev, message]);
      }
    };
    socket.on('chat:message', onMessage);
    return () => { socket.off('chat:message', onMessage); };
  }, [selectedId, socket]);
  const selectedFriend = friends.find((item) => item.friend_user_id === selectedId);
  return (
    <div className="two-column chat-layout">
      <section className="card"><div className="section-header"><h3>الأصدقاء</h3><Link to="/app/voice/calls">Voice Calls</Link></div><div className="list-grid">{friends.map((friend) => <button key={friend.friend_user_id} className={`list-item button-reset ${selectedId === friend.friend_user_id ? 'active-item' : ''}`} type="button" onClick={() => setSelectedId(friend.friend_user_id)}><div><strong>{friend.friend_username}</strong><p>Elo {friend.friend_rating}</p></div></button>)}{friends.length === 0 && <p>أضف أصدقاء أولاً.</p>}</div></section>
      <section className="card"><PageHero eyebrow="PRIVATE CHAT" title={selectedFriend?.friend_username || 'اختر صديقًا'} body="صفحة محادثة مستقلة للرسائل الخاصة والرسائل الصوتية." actions={<Link className="btn secondary" to="/app/voice/messages">رسائل صوتية</Link>} /><div className="chat-box">{messages.map((message, index) => <div key={`${message.senderUserId}-${index}-${message.createdAt || message.created_at || index}`} className="chat-item"><strong>{message.senderUserId === auth.user?.id ? 'أنت' : selectedFriend?.friend_username || 'صديق'}</strong>{String(message.content).startsWith('data:audio') ? <audio controls src={message.content} /> : <p>{message.content}</p>}</div>)}{messages.length === 0 && <p>لا توجد رسائل بعد.</p>}</div><div className="inline-actions"><input value={text} onChange={(event) => setText(event.target.value)} placeholder="اكتب رسالة..." /><button className="btn" type="button" onClick={() => { if (!socket || !selectedId || !text.trim()) return; socket.emit('chat:send', { receiverUserId: selectedId, content: text, scope: 'private' }); setText(''); }}>إرسال</button></div></section>
    </div>
  );
}

function GlobalChatPage({ auth }: { auth: AuthState }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const socket = useMemo(() => (auth.token ? getSocket(auth.token) : null), [auth.token]);
  useEffect(() => {
    api<{ messages: ChatMessage[] }>('/api/messages?scope=global', { token: auth.token }).then((response) => setMessages(response.messages));
  }, [auth.token]);
  useEffect(() => {
    if (!socket) return;
    socket.emit('game:join', { gameId: 'global-lobby' });
    const onMessage = (message: ChatMessage) => { if (message.scope === 'global') setMessages((prev) => [...prev, message]); };
    socket.on('chat:message', onMessage);
    return () => { socket.off('chat:message', onMessage); };
  }, [socket]);
  return (
    <section className="card">
      <PageHero eyebrow="GLOBAL CHAT" title="Global Chat" body="صفحة دردشة عامة مستقلة لمجتمع WARHEX بالكامل." />
      <div className="chat-box">{messages.map((message, index) => <div key={`${message.senderUserId}-${index}`} className="chat-item"><strong>{message.sender_username || message.senderUserId}</strong><p>{message.content}</p></div>)}</div>
      <div className="inline-actions"><input value={text} onChange={(event) => setText(event.target.value)} placeholder="اكتب رسالة عامة..." /><button className="btn" type="button" onClick={() => { if (!socket || !text.trim()) return; socket.emit('chat:send', { roomId: 'global-lobby', content: text, scope: 'global' }); setText(''); }}>إرسال</button></div>
    </section>
  );
}

function RoomChatPage({ auth }: { auth: AuthState }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomId, setRoomId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const socket = useMemo(() => (auth.token ? getSocket(auth.token) : null), [auth.token]);
  useEffect(() => {
    api<{ rooms: Room[] }>('/api/rooms', { token: auth.token }).then((response) => {
      setRooms(response.rooms);
      setRoomId((prev) => prev || response.rooms[0]?.id || '');
    });
  }, [auth.token]);
  useEffect(() => {
    if (!roomId) return;
    api<{ messages: ChatMessage[] }>(`/api/messages?roomId=${roomId}`, { token: auth.token }).then((response) => setMessages(response.messages));
  }, [auth.token, roomId]);
  useEffect(() => {
    if (!socket || !roomId) return;
    socket.emit('room:join', { roomId });
    const onMessage = (message: ChatMessage) => { if (message.roomId === roomId) setMessages((prev) => [...prev, message]); };
    socket.on('chat:message', onMessage);
    return () => { socket.off('chat:message', onMessage); };
  }, [roomId, socket]);
  return (
    <section className="card">
      <PageHero eyebrow="ROOM CHAT" title="Room Chat" body="صفحة دردشة مستقلة خاصة باللوبي والغرف." actions={<label className="field compact"><span>الغرفة</span><select value={roomId} onChange={(event) => setRoomId(event.target.value)}>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label>} />
      <div className="chat-box">{messages.map((message, index) => <div key={`${message.senderUserId}-${index}`} className="chat-item"><strong>{message.sender_username || message.senderUserId}</strong>{String(message.content).startsWith('data:audio') ? <audio controls src={message.content} /> : <p>{message.content}</p>}</div>)}{messages.length === 0 && <p>لا توجد رسائل لهذه الغرفة.</p>}</div>
      <div className="inline-actions"><input value={text} onChange={(event) => setText(event.target.value)} placeholder="اكتب رسالة الغرفة..." /><button className="btn" type="button" onClick={() => { if (!socket || !roomId || !text.trim()) return; socket.emit('chat:send', { roomId, content: text, scope: 'room' }); setText(''); }}>إرسال</button></div>
    </section>
  );
}

function VoiceMessagesPage({ auth }: { auth: AuthState }) {
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [targetId, setTargetId] = useState('');
  const [status, setStatus] = useState('');
  const socket = useMemo(() => (auth.token ? getSocket(auth.token) : null), [auth.token]);
  useEffect(() => {
    api<{ friends: FriendItem[]; incoming: IncomingFriendRequest[]; outgoing: OutgoingFriendRequest[] }>('/api/friends', { token: auth.token }).then((response) => {
      setFriends(response.friends);
      setTargetId(response.friends[0]?.friend_user_id || '');
    });
  }, [auth.token]);
  return (
    <section className="card">
      <PageHero eyebrow="VOICE MESSAGES" title="Voice Messages" body="صفحة مستقلة لتسجيل وإرسال الرسائل الصوتية." />
      <label className="field"><span>المستلم</span><select value={targetId} onChange={(event) => setTargetId(event.target.value)}>{friends.map((friend) => <option key={friend.friend_user_id} value={friend.friend_user_id}>{friend.friend_username}</option>)}</select></label>
      <button className="btn" type="button" disabled={!targetId} onClick={async () => { if (!socket || !targetId) return; setStatus('جارٍ التسجيل...'); const dataUrl = await recordVoiceDataUrl(); socket.emit('chat:send', { receiverUserId: targetId, content: dataUrl, scope: 'private', messageType: 'voice' }); triggerDeviceFeedback('success'); setStatus('تم إرسال الرسالة الصوتية.'); }}>تسجيل وإرسال</button>
      {status && <p>{status}</p>}
    </section>
  );
}

function VoiceCallsPage({ auth }: { auth: AuthState }) {
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [targetId, setTargetId] = useState('');
  const socket = useMemo(() => (auth.token ? getSocket(auth.token) : null), [auth.token]);
  useEffect(() => {
    api<{ friends: FriendItem[]; incoming: IncomingFriendRequest[]; outgoing: OutgoingFriendRequest[] }>('/api/friends', { token: auth.token }).then((response) => {
      setFriends(response.friends);
      setTargetId(response.friends[0]?.friend_user_id || '');
    });
  }, [auth.token]);
  return (
    <div className="two-column">
      <section className="card"><PageHero eyebrow="VOICE CALLS" title="Voice Calls" body="اتصال صوتي حي بين اللاعبين عبر صفحة مستقلة." /><label className="field"><span>اللاعب</span><select value={targetId} onChange={(event) => setTargetId(event.target.value)}>{friends.map((friend) => <option key={friend.friend_user_id} value={friend.friend_user_id}>{friend.friend_username}</option>)}</select></label></section>
      <VoiceChatPanel socket={socket} targetUserId={targetId} />
    </div>
  );
}


function EquipmentPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'boards' ? 'boards' : 'pieces';
  const items = tab === 'boards' ? BOARD_SETS : PIECE_SETS;
  return (
    <section className="equipment-screen">
      <div className="equipment-tabs wood-card">
        <button className={`equipment-tab ${tab === 'pieces' ? 'active' : ''}`} type="button" onClick={() => setSearchParams({ tab: 'pieces' })}>Pieces</button>
        <button className={`equipment-tab ${tab === 'boards' ? 'active' : ''}`} type="button" onClick={() => setSearchParams({ tab: 'boards' })}>Boards</button>
        <Link className="equipment-info" to="/app/about">i</Link>
      </div>
      <div className="equipment-grid">
        {items.map((item) => (
          <article key={item.id} className={`equipment-card ${item.status === 'USING' ? 'using' : ''}`}>
            <div className="equipment-preview"><EquipmentArt kind={tab === 'boards' ? 'board' : 'piece'} /></div>
            <strong>{item.title}</strong>
            <span>{item.tier}</span>
            <p>{item.status}</p>
            <div className="equipment-progress"><span style={{ width: `${Math.min(100, Number(item.progress.split('/')[0]) / Number(item.progress.split('/')[1]) * 100 || 0)}%` }} /></div>
            <small>{item.progress}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function StaticCollectionPage({ sectionKey, title }: { sectionKey: 'events' | 'missions' | 'achievements'; title: string }) {
  return (
    <section className="card">
      <PageHero eyebrow={title.toUpperCase()} title={title} body="صفحة مستقلة داخل WARHEX ضمن نفس الهوية البصرية." />
      <div className="feature-grid">
        {CONTENT_SECTIONS[sectionKey].map((item) => <article key={item.title} className="card"><h3>{item.title}</h3><p>{item.body}</p></article>)}
      </div>
    </section>
  );
}

function TournamentsPage() {
  return (
    <section className="arena-screen">
      <PageHero eyebrow="TOURNAMENTS" title="Tournaments" body="بطاقات بطولات أقرب لواجهة الأرينا مع عرض الجوائز والدخول المباشر." />
      <div className="arena-list">
        {TOURNAMENTS.map((item, index) => {
          const theme = ARENA_CARDS[index % ARENA_CARDS.length]?.theme || 'gold';
          return (
            <Link key={item.id} className={`arena-card theme-${theme}`} to={`/app/tournaments/${item.id}`}>
              <span className="arena-reward-tag">LIVE</span>
              <div className="arena-header-mark">{item.title}</div>
              <div className="arena-stat"><strong>Mode</strong><span>{item.subtitle}</span></div>
              <div className="arena-stat"><strong>Prize</strong><span>{item.prize}</span></div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function TournamentDetailsPage() {
  const { tournamentId = 'champions-arena' } = useParams();
  const item = TOURNAMENTS.find((entry) => entry.id === tournamentId) || TOURNAMENTS[0];
  return (
    <section className="tournament-detail-screen">
      <section className="tournament-hero-card wood-card">
        <div className="arena-header-mark">{item.title}</div>
        <p>{item.subtitle}</p>
        <div className="stats-grid"><div><span>الجائزة</span><strong>{item.prize}</strong></div><div><span>الجولة</span><strong>Quarter Finals</strong></div><div><span>النوع</span><strong>Rapid</strong></div><div><span>الحد الأدنى</span><strong>1200 Elo</strong></div></div>
        <div className="inline-actions wrap"><button className="btn" type="button" onClick={() => triggerDeviceFeedback('success')}>تسجيل فوري</button><Link className="btn secondary" to="/app/queue/ranked">ادخل الساحة</Link></div>
      </section>
    </section>
  );
}

function SpectatorPage({ auth }: { auth: AuthState }) {
  const [searchParams] = useSearchParams();
  const [gameId, setGameId] = useState(searchParams.get('gameId') || '');
  const [fen, setFen] = useState(STANDARD_START_FEN);
  const [status, setStatus] = useState('أدخل Game ID للمتابعة كمشاهد.');
  const socket = useMemo(() => (auth.token ? getSocket(auth.token) : null), [auth.token]);
  useEffect(() => {
    if (!socket) return;
    const onGameState = ({ state }: any) => { setFen(state.fen); setStatus('تم تحميل المباراة للمشاهدة'); };
    const onGameUpdate = ({ state }: any) => setFen(state.fen);
    const onFinished = ({ result }: any) => setStatus(`انتهت المباراة: ${result}`);
    socket.on('game:state', onGameState);
    socket.on('game:update', onGameUpdate);
    socket.on('game:finished', onFinished);
    return () => { socket.off('game:state', onGameState); socket.off('game:update', onGameUpdate); socket.off('game:finished', onFinished); };
  }, [socket]);

  useEffect(() => {
    if (socket && gameId) socket.emit('game:join', { gameId });
  }, [gameId, socket]);
  return (
    <div className="two-column">
      <section className="card board-panel"><PageHero eyebrow="SPECTATOR" title="Spectator Mode" body={status} actions={<div className="inline-actions"><input value={gameId} onChange={(event) => setGameId(event.target.value)} placeholder="ألصق Game ID" /><button className="btn" type="button" onClick={() => socket?.emit('game:join', { gameId })}>المشاهدة</button></div>} /><ChessBoard fen={fen} interactive={false} /></section>
      <section className="card"><div className="section-header"><h3>مزايا المشاهدة</h3></div><div className="list-grid"><article className="list-item vertical"><strong>بث مباشر</strong><p>انضم لأي مباراة حية عبر Game ID.</p></article><article className="list-item vertical"><strong>تتبع النقلات</strong><p>يتم تحديث اللوحة فور وصول النقلات.</p></article></div></section>
    </div>
  );
}

function MatchAnalysisPage({ auth }: { auth: AuthState }) {
  const [games, setGames] = useState<any[]>([]);
  const [selectedGameId, setSelectedGameId] = useState('');
  const [game, setGame] = useState<any>(null);
  const [moves, setMoves] = useState<any[]>([]);
  useEffect(() => {
    api<{ games: any[] }>('/api/history', { token: auth.token }).then((response) => {
      setGames(response.games);
      setSelectedGameId(response.games[0]?.id || '');
    });
  }, [auth.token]);
  useEffect(() => {
    if (!selectedGameId) return;
    api<{ game: any; moves: any[] }>(`/api/games/${selectedGameId}`, { token: auth.token }).then((response) => {
      setGame(response.game);
      setMoves(response.moves);
    });
  }, [auth.token, selectedGameId]);
  return (
    <div className="two-column">
      <section className="card board-panel"><PageHero eyebrow="MATCH ANALYSIS" title="تحليل المباراة" body="اختر أي مباراة محفوظة لعرض النقلات والحالة النهائية." actions={<label className="field compact"><span>المباراة</span><select value={selectedGameId} onChange={(event) => setSelectedGameId(event.target.value)}>{games.map((entry) => <option key={entry.id} value={entry.id}>{entry.white_username || 'White'} vs {entry.black_username || 'Black'} · {entry.result}</option>)}</select></label>} /><ChessBoard fen={game?.final_fen || STANDARD_START_FEN} interactive={false} /><div className="stats-grid board-info"><div><span>النتيجة</span><strong>{game?.result || '*'}</strong></div><div><span>النوع</span><strong>{game?.time_control || '-'}</strong></div><div><span>النقلات</span><strong>{moves.length}</strong></div></div></section>
      <section className="card"><div className="section-header"><h3>سجل النقلات</h3></div><div className="list-grid">{moves.map((move) => <article key={`${move.game_id}-${move.ply}`} className="list-item"><strong>#{move.ply}</strong><span>{move.san}</span><code>{move.fen_after}</code></article>)}{moves.length === 0 && <p>اختر مباراة لعرض التحليل.</p>}</div></section>
    </div>
  );
}

function LanguagePage({ auth, setUser }: { auth: AuthState; setUser: (user: User | null) => void }) {
  const [language, setLanguage] = useState<'ar' | 'en' | 'fr'>(auth.user?.language ?? 'ar');
  return <section className="card"><PageHero eyebrow="LANGUAGE" title="Language" body="صفحة مستقلة لضبط اللغة الأساسية للتطبيق." actions={<button className="btn" type="button" onClick={async () => { const response = await api<{ user: User }>('/api/profile', { method: 'PATCH', token: auth.token, body: JSON.stringify({ language }) }); setUser(response.user); }}>حفظ اللغة</button>} /><label className="field"><span>اختيار اللغة</span><select value={language} onChange={(event) => setLanguage(event.target.value as 'ar' | 'en' | 'fr')}><option value="ar">العربية</option><option value="en">English</option><option value="fr">Français</option></select></label></section>;
}

function SupportPage() {
  return <section className="card"><PageHero eyebrow="SUPPORT" title="Support" body="صفحة دعم مستقلة تتضمن مسارات سريعة للمساعدة والأسئلة المتكررة." /><div className="feature-grid"><article className="card"><h3>مساعدة اللعب</h3><p>إرشادات سريعة لحل مشاكل الاتصال والصوت والحساب.</p></article><article className="card"><h3>الدعم التقني</h3><p>تأكد من المتصفح، السماحات، وجودة الشبكة.</p></article><article className="card"><h3>مركز الملاحظات</h3><p>ارسل تقريرًا عن الأخطاء أو اقتراحات التطوير.</p></article></div></section>;
}

function AboutPage() {
  return <section className="card"><PageHero eyebrow="ABOUT WARHEX" title="About" body="WARHEX منصة شطرنج تنافسية بهوية AAA فاخرة، مبنية كمنتج Production Ready داخل نفس المشروع الحالي." /><div className="stats-grid"><div><span>Frontend</span><strong>React + Vite</strong></div><div><span>Backend</span><strong>Node + Express + Socket.IO</strong></div><div><span>Realtime</span><strong>Rooms · Chat · Voice · Replay</strong></div></div></section>;
}

function RoomLobbyPage({ auth }: { auth: AuthState }) {
  const { roomId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const [room, setRoom] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();
  const socket = useMemo(() => (auth.token ? getSocket(auth.token) : null), [auth.token]);
  const loadRoom = useCallback(async () => {
    const response = await api<{ room: any; members: any[]; messages: ChatMessage[]; currentGame: any }>(`/api/rooms/${roomId}`, { token: auth.token });
    setRoom({ ...response.room, currentGame: response.currentGame });
    setMembers(response.members);
    setMessages(response.messages);
  }, [auth.token, roomId]);
  useEffect(() => { loadRoom(); }, [loadRoom]);

  const isMember = members.some((member) => member.user_id === auth.user?.id);
  const joinRequested = searchParams.get('join') === '1';

  const joinRoom = async () => {
    try {
      await api(`/api/rooms/${roomId}/join`, {
        method: 'POST',
        token: auth.token,
        body: JSON.stringify(room?.visibility === 'password' ? { password } : {}),
      });
      triggerDeviceFeedback('success');
      setStatus(`تم الانضمام إلى ${room?.name || 'الغرفة'}`);
      await loadRoom();
    } catch (error) {
      setStatus((error as Error).message);
    }
  };

  const leaveRoom = async () => {
    try {
      await api(`/api/rooms/${roomId}/leave`, { method: 'POST', token: auth.token });
      triggerDeviceFeedback('tap');
      setStatus(`تمت مغادرة ${room?.name || 'الغرفة'}`);
      navigate('/app/rooms');
    } catch (error) {
      setStatus((error as Error).message);
    }
  };

  return (
    <div className="two-column">
      <section className="card">
        <PageHero
          eyebrow="ROOM LOBBY"
          title={room?.name || 'Room Lobby'}
          body={room ? `${room.host_username} · ${room.visibility}` : 'تحميل...'}
          actions={
            <>
              {!isMember && room?.visibility === 'password' ? (
                <label className="field compact">
                  <span>كلمة المرور</span>
                  <input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="أدخل كلمة المرور" />
                </label>
              ) : null}
              {!isMember ? (
                <button className="btn secondary" type="button" onClick={joinRoom}>
                  {joinRequested ? 'انضمام الآن' : 'الانضمام للغرفة'}
                </button>
              ) : (
                <button className="btn secondary" type="button" onClick={leaveRoom}>مغادرة الغرفة</button>
              )}
              {isMember ? (
                <button className="btn" type="button" onClick={() => {
                  if (!socket || !auth.user) return;
                  socket.emit('game:create', { roomId, whiteId: auth.user.id, timeControl: 'rapid', incrementSeconds: 2 }, (response: any) => {
                    if (response?.ok) {
                      setStatus(`تم إنشاء مباراة للغرفة: ${response.gameId}`);
                      navigate(`/app/game?mode=online&gameId=${response.gameId}`);
                    }
                  });
                }}>بدء مباراة الغرفة</button>
              ) : null}
              <Link className="btn secondary" to="/app/chat/room">فتح Room Chat</Link>
            </>
          }
        />
        {status && <p>{status}</p>}
        <div className="list-grid">{members.map((member) => <article key={member.user_id} className="list-item"><strong>{member.username}</strong><span>{member.role}</span></article>)}</div>
      </section>
      <section className="card"><div className="section-header"><h3>آخر رسائل الغرفة</h3></div><div className="chat-box">{messages.map((message, index) => <div key={`${message.senderUserId}-${index}`} className="chat-item"><strong>{message.sender_username || message.senderUserId}</strong><p>{message.content}</p></div>)}{messages.length === 0 && <p>لا توجد رسائل بعد.</p>}</div>{room?.currentGame?.id ? <Link className="btn secondary" to={`/app/spectate?gameId=${room.currentGame.id}`}>مشاهدة المباراة الحالية</Link> : null}</section>
    </div>
  );
}

export default function App() {
  const { auth, booting, login, logout, setUser } = useAuth();

  if (booting) return <LoadingScreen />;

  return (
    <Routes>
      <Route path="/" element={auth.token ? <Navigate to="/app" replace /> : <LandingPage />} />
      <Route path="/login" element={auth.token ? <Navigate to="/app" replace /> : <AuthPage mode="login" onLogin={login} />} />
      <Route path="/register" element={auth.token ? <Navigate to="/app" replace /> : <AuthPage mode="register" onLogin={login} />} />
      <Route path="/app/*" element={auth.token ? <AppShell auth={auth} logout={logout} setUser={setUser} /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}
