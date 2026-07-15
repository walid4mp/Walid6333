from pathlib import Path
import re

path = Path('/home/user/work/warhex_app/apps/web/src/App.tsx')
text = path.read_text()

# Add shared data constants after TOURNAMENTS
needle = """const TOURNAMENTS = [
  { id: 'champions-arena', title: 'Champions Arena', subtitle: 'بطولة عالمية سريعة', prize: '50,000 Gold + 2,000 Gems' },
  { id: 'royal-gauntlet', title: 'Royal Gauntlet', subtitle: 'إقصائيات نخبة المصنفين', prize: 'Premium + Tickets' },
  { id: 'winter-siege', title: 'Winter Siege', subtitle: 'حدث موسمي محدود', prize: 'Skins + Gold' },
];
"""
replacement = needle + """

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
"""
if needle in text and 'const ARENA_CARDS' not in text:
    text = text.replace(needle, replacement)

# Replace AppShell
pattern = r"function AppShell\([\s\S]*?\n}\n\nfunction LandingPage"
new_block = """function AppShell({ auth, logout, setUser }: { auth: AuthState; logout: () => void; setUser: (user: User | null) => void }) {
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
    { to: '/app', label: 'Home', icon: '⌂', active: location.pathname === '/app' },
    { to: '/app/friends', label: 'Friends', icon: '●●', active: location.pathname.startsWith('/app/friends') || location.pathname.startsWith('/app/chat/private') },
    { to: '/app/equipment', label: 'Equipment', icon: '♞', active: location.pathname.startsWith('/app/equipment') },
    { to: '/app/tournaments', label: 'Events', icon: '★', active: location.pathname.startsWith('/app/events') || location.pathname.startsWith('/app/missions') || location.pathname.startsWith('/app/achievements') || location.pathname.startsWith('/app/tournaments') },
    { to: '/app/shop', label: 'Shop', icon: '▦', active: location.pathname.startsWith('/app/shop') || location.pathname.startsWith('/app/store') || location.pathname.startsWith('/app/wallet') || location.pathname.startsWith('/app/recharge') || location.pathname.startsWith('/app/premium') },
  ];

  const hideFrameForGame = location.pathname.startsWith('/app/game') || location.pathname.startsWith('/app/spectate');

  return (
    <div className={`mobile-shell ${hideFrameForGame ? 'game-frame' : ''}`}>
      <header className="resource-topbar wood-card">
        <div className="resource-left">
          <Link className="avatar-chip" to="/app/profile">
            {auth.user?.avatar_url ? <img src={auth.user.avatar_url} alt={auth.user.username} /> : <span>{(auth.user?.username || 'W').slice(0, 1).toUpperCase()}</span>}
            <b className="level-badge">6</b>
          </Link>
          <Link className="top-icon" to="/app/settings" aria-label="Settings">⚙</Link>
          <Link className="top-icon" to="/app/mailbox" aria-label="Mailbox">✉</Link>
        </div>
        <div className="resource-right">
          <Link className="currency-pill gem-pill" to="/app/store/gems"><span className="currency-orb">💎</span><strong>{wallet?.gems ?? 16}</strong><em>+</em></Link>
          <Link className="currency-pill coin-pill" to="/app/store/gold"><span className="currency-orb">🪙</span><strong>{wallet?.coins ?? 8997}</strong><em>+</em></Link>
        </div>
      </header>

      {!hideFrameForGame ? (
        <div className="page-title-row">
          <h2>{currentTitle}</h2>
          <div className="page-title-actions">
            <Link className="mini-link" to="/app/notifications">Alerts</Link>
            <button className="mini-link button-reset" type="button" onClick={logout}>{t('logout')}</button>
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
              <span className="dock-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

function LandingPage"""
text = re.sub(pattern, new_block, text, count=1)

# Replace LobbyPage
text = re.sub(r"function LobbyPage\([\s\S]*?\n}\n\nfunction GamePage", """function LobbyPage({ auth }: { auth: AuthState }) {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api<DashboardPayload>('/api/dashboard', { token: auth.token }).then((response) => setDashboard(response));
  }, [auth.token]);

  return (
    <div className="home-screen">
      <section className="quick-actions-strip">
        <button className="quick-top-btn" type="button" onClick={() => navigate('/app/daily-rewards')}>Free Rewards</button>
        <button className="quick-top-btn" type="button" onClick={() => navigate('/app/lucky-wheel')}>Lucky Box</button>
        <button className="quick-top-btn" type="button" onClick={() => navigate('/app/leaderboards')}>Leaderboards</button>
      </section>

      <section className="pass-banner wood-card">
        <div>
          <span className="pass-kicker">CHESS PASS</span>
          <strong>30d 04h</strong>
        </div>
        <div className="progress-track"><span style={{ width: '35%' }} /></div>
        <b className="pass-badge">1</b>
      </section>

      <button className="mode-card classic" type="button" onClick={() => navigate('/app/queue/quick')}>
        <div>
          <strong>Classic Chess</strong>
          <span>Prize arenas · VS screens · ranked flow</span>
        </div>
        <span className="mode-piece-stack">♟ ♔ ♜</span>
      </button>

      <button className="mode-card quick" type="button" onClick={() => navigate('/app/quick-play')}>
        <div>
          <strong>Quick Chess</strong>
          <span>Fast match with auto matchmaking</span>
        </div>
        <span className="mode-piece-stack">♙ ♞</span>
      </button>

      <div className="dual-mode-grid">
        <button className="mode-card danger compact" type="button" onClick={() => navigate('/app/game?mode=ai')}>
          <div><strong>vs. Computer</strong><span>Practice and training</span></div>
        </button>
        <button className="mode-card success compact" type="button" onClick={() => navigate('/app/chat/private')}>
          <div><strong>Mail Chess</strong><span>Private play and messages</span></div>
        </button>
      </div>

      <section className="home-mini-grid">
        <Link className="mini-home-card wood-card" to="/app/friends"><strong>Friends</strong><span>{dashboard?.friends.length ?? 0} online</span></Link>
        <Link className="mini-home-card wood-card" to="/app/equipment"><strong>Equipment</strong><span>Pieces · Boards</span></Link>
        <Link className="mini-home-card wood-card" to="/app/tournaments"><strong>Events</strong><span>Paris · Delhi · London</span></Link>
        <Link className="mini-home-card wood-card" to="/app/shop"><strong>Shop</strong><span>Gold · Gems · Premium</span></Link>
      </section>

      <section className="chest-row">
        <Link className="chest-card open" to="/app/daily-rewards"><span>Tap to Unlock</span><strong>Chest</strong><small>03h 00m</small></Link>
        <div className="chest-card empty"><strong>Chest Slot</strong></div>
        <div className="chest-card empty"><strong>Chest Slot</strong></div>
        <Link className="chest-card silver" to="/app/lucky-wheel"><span>Tap to Unlock</span><strong>Chest</strong><small>08h 00m</small></Link>
      </section>
    </div>
  );
}

function GamePage""", text, count=1)

# Replace QueuePage
text = re.sub(r"function QueuePage\([\s\S]*?\n}\n\nfunction WalletPage", """function QueuePage({ auth }: { auth: AuthState }) {
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

function WalletPage""", text, count=1)

# Replace StorePage
text = re.sub(r"function StorePage\([\s\S]*?\n}\n\nfunction RewardsPage", """function StorePage({ auth, category }: { auth: AuthState; category: 'gold' | 'gems' | 'recharge' | 'premium' }) {
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
      <PageHero eyebrow="SHOP" title={category === 'gold' ? 'Coins' : category === 'gems' ? 'Gems' : category === 'recharge' ? 'Recharge' : 'Premium Membership'} body="تصميم متجر أقرب لواجهة اللعبة المرجعية مع بطاقات شراء كبيرة وزر سعر أخضر." />
      <div className="shop-grid-view">
        {catalog[category].map((pack) => (
          <article key={pack.id} className="shop-pack-card">
            <span className="discount-star">{pack.bonus}</span>
            <h3>{pack.title}</h3>
            <div className="shop-pack-art">{category === 'gems' ? '💎' : category === 'premium' ? '👑' : '🪙'}</div>
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

function RewardsPage""", text, count=1)

# Insert EquipmentPage before StaticCollectionPage if absent
if 'function EquipmentPage()' not in text:
    insert_before = 'function StaticCollectionPage({ sectionKey, title }: { sectionKey: \'events\' | \'missions\' | \'achievements\'; title: string }) {'
    equipment_block = """
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
            <div className="equipment-preview">{tab === 'boards' ? '▣' : '♞'}</div>
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

"""
    text = text.replace(insert_before, equipment_block + insert_before)

path.write_text(text)
print('Patched mobile-style UI components.')
