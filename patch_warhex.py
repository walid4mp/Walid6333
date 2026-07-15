from pathlib import Path

root = Path('/home/user/work/warhex_app')
app_path = root / 'apps/web/src/App.tsx'
server_path = root / 'apps/server/src/server.ts'

app = app_path.read_text()
server = server_path.read_text()

old = """function triggerDeviceFeedback(kind: 'tap' | 'success' | 'danger' = 'tap') {
  if (typeof window === 'undefined') return;
  if ('vibrate' in navigator) {
    navigator.vibrate(kind === 'success' ? [18, 28, 18] : kind === 'danger' ? [50, 25, 50] : 10);
  }
  const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextCtor) return;
  const context = new AudioContextCtor();
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
  setTimeout(() => context.close().catch(() => undefined), 260);
}
"""
new = """function triggerDeviceFeedback(kind: 'tap' | 'success' | 'danger' = 'tap') {
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
"""
if old not in app:
    raise SystemExit('triggerDeviceFeedback block not found')
app = app.replace(old, new)

old = """  const mode = params.get('mode') || 'local';
  const queue = params.get('queue') || 'quick';
  const initialGameId = params.get('gameId') || '';
"""
new = """  const mode = params.get('mode') || 'local';
  const queue = params.get('queue') || 'quick';
  const initialGameId = params.get('gameId') || '';
  const autoStart = params.get('autostart') === '1';
"""
if old not in app:
    raise SystemExit('game params block not found')
app = app.replace(old, new, 1)

old = """  const recorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
"""
new = """  const recorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const autoQueueStartedRef = useRef(false);
"""
if old not in app:
    raise SystemExit('game refs block not found')
app = app.replace(old, new, 1)

old = """    const onGameFinished = ({ result }: any) => {
      setStatusText(result === '1/2-1/2' ? 'انتهت المباراة بالتعادل' : `انتهت المباراة: ${result}`);
    };

    instance.on('chat:message', onChatMessage);
    instance.on('game:update', onGameUpdate);
    instance.on('game:state', onGameState);
    instance.on('game:finished', onGameFinished);

    return () => {
      instance.off('chat:message', onChatMessage);
      instance.off('game:update', onGameUpdate);
      instance.off('game:state', onGameState);
      instance.off('game:finished', onGameFinished);
    };
"""
new = """    const onGameFinished = ({ result }: any) => {
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
"""
if old not in app:
    raise SystemExit('game socket listener block not found')
app = app.replace(old, new, 1)

old = """  const startOnline = () => {
    if (!socket || !auth.user) return;
    socket.emit('game:create', { whiteId: auth.user.id, timeControl: 'rapid', incrementSeconds: 2 }, (response: any) => {
      if (response.ok) {
        setGameId(response.gameId);
        setJoinGameId(response.gameId);
        setFen(response.state.fen);
        setHistory([response.state.fen]);
        socket.emit('game:join', { gameId: response.gameId });
        setStatusText('تم إنشاء مباراة أونلاين');
      }
    });
  };
"""
new = """  const startOnline = () => {
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
"""
if old not in app:
    raise SystemExit('startOnline block not found')
app = app.replace(old, new, 1)

old = """  const resignGame = () => {
    if (!socket || !gameId) return;
    socket.emit('game:resign', { gameId }, (response: any) => {
      if (response?.ok) setStatusText(`استسلام: ${response.result}`);
    });
  };
"""
new = """  const resignGame = () => {
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
"""
if old not in app:
    raise SystemExit('resign block not found')
app = app.replace(old, new, 1)

old = """function RoomsPage({ auth }: { auth: AuthState }) {
  const [rooms, setRooms] = useState<Room[]>([]);
"""
new = """function RoomsPage({ auth }: { auth: AuthState }) {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
"""
if old not in app:
    raise SystemExit('RoomsPage signature not found')
app = app.replace(old, new, 1)

old = """                {!room.is_member ? (
                  <button className="btn secondary" type="button" onClick={async () => {
                    try {
                      setError('');
                      await api(`/api/rooms/${room.id}/join`, { method: 'POST', token: auth.token, body: JSON.stringify(room.visibility === 'password' ? { password: prompt('كلمة المرور') || '' } : {}) });
                      triggerDeviceFeedback('success');
                      setFeedback(`تم الانضمام إلى ${room.name}`);
                      loadRooms();
                    } catch (err) {
                      setError((err as Error).message);
                    }
                  }}>انضمام</button>
                ) : (
"""
new = """                {!room.is_member ? (
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
"""
if old not in app:
    raise SystemExit('room join button block not found')
app = app.replace(old, new, 1)

old = """function RoomLobbyPage({ auth }: { auth: AuthState }) {
  const { roomId = '' } = useParams();
  const [room, setRoom] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState('');
  const navigate = useNavigate();
  const socket = useMemo(() => (auth.token ? getSocket(auth.token) : null), [auth.token]);
  const loadRoom = useCallback(async () => {
    const response = await api<{ room: any; members: any[]; messages: ChatMessage[]; currentGame: any }>(`/api/rooms/${roomId}`, { token: auth.token });
    setRoom({ ...response.room, currentGame: response.currentGame });
    setMembers(response.members);
    setMessages(response.messages);
  }, [auth.token, roomId]);
  useEffect(() => { loadRoom(); }, [loadRoom]);
  return (
    <div className="two-column">
      <section className="card"><PageHero eyebrow="ROOM LOBBY" title={room?.name || 'Room Lobby'} body={room ? `${room.host_username} · ${room.visibility}` : 'تحميل...'} actions={<><button className="btn" type="button" onClick={() => { if (!socket || !auth.user) return; socket.emit('game:create', { roomId, whiteId: auth.user.id, timeControl: 'rapid', incrementSeconds: 2 }, (response: any) => { if (response?.ok) { setStatus(`تم إنشاء مباراة للغرفة: ${response.gameId}`); navigate(`/app/game?mode=online&gameId=${response.gameId}`); } }); }}>بدء مباراة الغرفة</button><Link className="btn secondary" to="/app/chat/room">فتح Room Chat</Link></>} />{status && <p>{status}</p>}<div className="list-grid">{members.map((member) => <article key={member.user_id} className="list-item"><strong>{member.username}</strong><span>{member.role}</span></article>)}</div></section>
      <section className="card"><div className="section-header"><h3>آخر رسائل الغرفة</h3></div><div className="chat-box">{messages.map((message, index) => <div key={`${message.senderUserId}-${index}`} className="chat-item"><strong>{message.sender_username || message.senderUserId}</strong><p>{message.content}</p></div>)}{messages.length === 0 && <p>لا توجد رسائل بعد.</p>}</div>{room?.currentGame?.id ? <Link className="btn secondary" to={`/app/spectate?gameId=${room.currentGame.id}`}>مشاهدة المباراة الحالية</Link> : null}</section>
    </div>
  );
}
"""
new = """function RoomLobbyPage({ auth }: { auth: AuthState }) {
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
"""
if old not in app:
    raise SystemExit('RoomLobbyPage block not found')
app = app.replace(old, new, 1)

old = """          <Route path="queue/:queueType" element={<QueuePage auth={auth} />} />
          <Route path="game" element={<GamePage auth={auth} />} />
          <Route path="spectate" element={<SpectatorPage auth={auth} />} />
"""
new = """          <Route path="queue/:queueType" element={<QueuePage auth={auth} />} />
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
"""
if old not in app:
    raise SystemExit('route alias insertion point 1 not found')
app = app.replace(old, new, 1)

old = """          <Route path="chat/private" element={<PrivateChatPage auth={auth} />} />
          <Route path="chat/global" element={<GlobalChatPage auth={auth} />} />
          <Route path="chat/room" element={<RoomChatPage auth={auth} />} />
          <Route path="voice/messages" element={<VoiceMessagesPage auth={auth} />} />
          <Route path="voice/calls" element={<VoiceCallsPage auth={auth} />} />
"""
new = """          <Route path="chat/private" element={<PrivateChatPage auth={auth} />} />
          <Route path="chat/global" element={<GlobalChatPage auth={auth} />} />
          <Route path="chat/room" element={<RoomChatPage auth={auth} />} />
          <Route path="private-chat" element={<PrivateChatPage auth={auth} />} />
          <Route path="global-chat" element={<GlobalChatPage auth={auth} />} />
          <Route path="room-chat" element={<RoomChatPage auth={auth} />} />
          <Route path="voice/messages" element={<VoiceMessagesPage auth={auth} />} />
          <Route path="voice/calls" element={<VoiceCallsPage auth={auth} />} />
          <Route path="voice-messages" element={<VoiceMessagesPage auth={auth} />} />
          <Route path="voice-calls" element={<VoiceCallsPage auth={auth} />} />
"""
if old not in app:
    raise SystemExit('route alias insertion point 2 not found')
app = app.replace(old, new, 1)

old = """          <Route path="friends" element={<FriendsPage auth={auth} />} />
          <Route path="friends/requests" element={<FriendRequestsPage auth={auth} />} />
          <Route path="search" element={<SearchPage auth={auth} />} />
"""
new = """          <Route path="friends" element={<FriendsPage auth={auth} />} />
          <Route path="friends/requests" element={<FriendRequestsPage auth={auth} />} />
          <Route path="friend-requests" element={<FriendRequestsPage auth={auth} />} />
          <Route path="search" element={<SearchPage auth={auth} />} />
          <Route path="search-players" element={<SearchPage auth={auth} />} />
"""
if old not in app:
    raise SystemExit('route alias insertion point 3 not found')
app = app.replace(old, new, 1)

app_path.write_text(app)

old = """const liveGames = new Map<string, { engine: ChessEngine; whiteId?: string; blackId?: string; roomId?: string; timeControl: string; incrementSeconds: number }>();
"""
new = """const liveGames = new Map<string, { engine: ChessEngine; whiteId?: string; blackId?: string; roomId?: string; timeControl: string; incrementSeconds: number; queueType?: string; waiting?: boolean }>();
"""
if old not in server:
    raise SystemExit('liveGames type block not found')
server = server.replace(old, new, 1)

old = """  socket.on('game:create', ({ roomId, whiteId, blackId, timeControl = 'blitz', incrementSeconds = 0 }, callback) => {
    const gameId = uuid();
    const engine = new ChessEngine();
    liveGames.set(gameId, { engine, whiteId, blackId, roomId, timeControl, incrementSeconds });
    db.prepare('INSERT INTO games (id, white_user_id, black_user_id, mode, status, initial_fen, final_fen, time_control, increment_seconds, started_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(gameId, whiteId ?? null, blackId ?? null, blackId ? 'online' : 'training', 'active', engine.exportFEN(), engine.exportFEN(), timeControl, incrementSeconds, now(), now());
    if (roomId) db.prepare('UPDATE rooms SET current_game_id = ?, status = ?, updated_at = ? WHERE id = ?').run(gameId, 'playing', now(), roomId);
    callback?.({ ok: true, gameId, state: engine.exportState() });
  });
"""
new = """  socket.on('game:create', ({ roomId, whiteId, blackId, timeControl = 'blitz', incrementSeconds = 0, queueType }, callback) => {
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
"""
if old not in server:
    raise SystemExit('game:create block not found')
server = server.replace(old, new, 1)

server_path.write_text(server)
print('Patched App.tsx and server.ts successfully.')
