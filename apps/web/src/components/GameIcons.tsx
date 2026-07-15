import type { CSSProperties } from 'react';

type IconName =
  | 'settings'
  | 'mail'
  | 'gem'
  | 'coin'
  | 'home'
  | 'friends'
  | 'equipment'
  | 'events'
  | 'shop'
  | 'knight'
  | 'board'
  | 'chest'
  | 'gift'
  | 'trophy'
  | 'search'
  | 'sound'
  | 'crown'
  | 'bell'
  | 'ticket'
  | 'spark'
  | 'swords'
  | 'chat'
  | 'room'
  | 'replay'
  | 'analysis'
  | 'hint'
  | 'player';

export function GameIcon({ name, className = '', title, style }: { name: IconName; className?: string; title?: string; style?: CSSProperties }) {
  return (
    <span className={`ui-icon ${className}`.trim()} style={style} aria-hidden={title ? undefined : true} title={title}>
      <svg viewBox="0 0 64 64" role="img" aria-label={title || name}>
        {name === 'settings' && <><circle cx="32" cy="32" r="11" fill="#ffe4a6" /><path d="M32 6l4 7 8 2 6-4 6 10-6 5 1 8 7 5-6 10-8-2-6 4-6 7-6-7-8-2-6 4-6-10 6-5-1-8-7-5 6-10 8 2 6-4 4-7Z" fill="none" stroke="#6c3c20" strokeWidth="5" strokeLinejoin="round" /></>}
        {name === 'mail' && <><rect x="10" y="16" width="44" height="32" rx="8" fill="#f8e1af" stroke="#6c3c20" strokeWidth="4" /><path d="M14 20l18 15 18-15" fill="none" stroke="#9e5326" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></>}
        {name === 'gem' && <><path d="M16 25 26 12h12l10 13-16 27Z" fill="#4fe4f0" stroke="#0e4e80" strokeWidth="4" strokeLinejoin="round" /><path d="M26 12l6 13 6-13M16 25h32" fill="none" stroke="#d3fbff" strokeWidth="3" strokeLinecap="round" /></>}
        {name === 'coin' && <><ellipse cx="32" cy="22" rx="16" ry="8" fill="#ffe38d" /><path d="M16 22v16c0 4 7 8 16 8s16-4 16-8V22" fill="#f6c13b" stroke="#7a4413" strokeWidth="4" /><ellipse cx="32" cy="22" rx="16" ry="8" fill="none" stroke="#7a4413" strokeWidth="4" /><circle cx="32" cy="31" r="7" fill="#ffd873" stroke="#9f5c16" strokeWidth="3" /></>}
        {name === 'home' && <><path d="M12 30 32 13l20 17" fill="none" stroke="#fff4d7" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /><path d="M18 28v20h28V28" fill="#f4b547" stroke="#8b4a17" strokeWidth="4" strokeLinejoin="round" /><rect x="28" y="35" width="8" height="13" rx="3" fill="#8b4a17" /></>}
        {name === 'friends' && <><circle cx="24" cy="25" r="9" fill="#f9ddb0" stroke="#7a431d" strokeWidth="4" /><circle cx="42" cy="22" r="7" fill="#f2c882" stroke="#7a431d" strokeWidth="4" /><path d="M11 48c2-8 9-13 17-13s15 5 17 13" fill="#6fd15a" stroke="#35661a" strokeWidth="4" strokeLinecap="round" /><path d="M33 48c1-6 6-10 12-10 4 0 8 2 10 5" fill="none" stroke="#35661a" strokeWidth="4" strokeLinecap="round" /></>}
        {name === 'equipment' && <><rect x="11" y="12" width="18" height="18" rx="4" fill="#f4d08d" stroke="#7a431d" strokeWidth="4" /><rect x="35" y="12" width="18" height="18" rx="4" fill="#ffd873" stroke="#7a431d" strokeWidth="4" /><rect x="11" y="34" width="18" height="18" rx="4" fill="#8b6af1" stroke="#472683" strokeWidth="4" /><rect x="35" y="34" width="18" height="18" rx="4" fill="#4ecfd4" stroke="#1d6876" strokeWidth="4" /></>}
        {name === 'events' && <><path d="M32 10 38 24l15 1-12 9 5 15-13-8-13 8 5-15-12-9 15-1Z" fill="#ffd95e" stroke="#8a4a18" strokeWidth="4" strokeLinejoin="round" /></>}
        {name === 'shop' && <><path d="M16 20h32l-3 29H19Z" fill="#f4c273" stroke="#7a431d" strokeWidth="4" strokeLinejoin="round" /><path d="M23 25c0-5 4-9 9-9s9 4 9 9" fill="none" stroke="#7a431d" strokeWidth="4" strokeLinecap="round" /><circle cx="25" cy="36" r="4" fill="#52d42a" /><circle cx="39" cy="36" r="4" fill="#4cc9f0" /></>}
        {name === 'knight' && <><path d="M21 48h22l-3-9 5-12-8-14-14 7 5 8-7 5Z" fill="#f3efe8" stroke="#5b2f19" strokeWidth="4" strokeLinejoin="round" /><circle cx="34" cy="19" r="2.5" fill="#5b2f19" /></>}
        {name === 'board' && <><rect x="11" y="11" width="42" height="42" rx="7" fill="#f6ddc3" stroke="#7a431d" strokeWidth="4" /><path d="M21 11v42M32 11v42M43 11v42M11 21h42M11 32h42M11 43h42" stroke="#ad764c" strokeWidth="3" /><path d="M21 11h11v11H21zM43 11h10v10H43zM11 21h10v11H11zM32 21h11v11H32zM21 32h11v11H21zM43 32h10v11H43zM11 43h10v10H11zM32 43h11v10H32z" fill="#c88f68" opacity=".9" /></>}
        {name === 'chest' && <><path d="M13 26h38v22H13z" fill="#c68a41" stroke="#6f3917" strokeWidth="4" /><path d="M16 26c2-10 9-16 16-16s14 6 16 16" fill="#e0b365" stroke="#6f3917" strokeWidth="4" /><rect x="28" y="31" width="8" height="10" rx="3" fill="#ffd85a" stroke="#8b4a18" strokeWidth="3" /></>}
        {name === 'gift' && <><rect x="12" y="24" width="40" height="28" rx="6" fill="#ffcf73" stroke="#7a431d" strokeWidth="4" /><path d="M32 24v28M12 33h40" stroke="#d4483b" strokeWidth="5" /><path d="M23 24c-5 0-8-3-8-6 0-3 3-5 6-5 5 0 8 5 11 11M41 24c5 0 8-3 8-6 0-3-3-5-6-5-5 0-8 5-11 11" fill="none" stroke="#d4483b" strokeWidth="4" strokeLinecap="round" /></>}
        {name === 'trophy' && <><path d="M20 14h24v8c0 8-5 16-12 19-7-3-12-11-12-19Z" fill="#ffd95e" stroke="#8a4a18" strokeWidth="4" /><path d="M18 18h-6c0 8 3 13 11 13M46 18h6c0 8-3 13-11 13" fill="none" stroke="#8a4a18" strokeWidth="4" strokeLinecap="round" /><path d="M25 41h14v6H25zM21 51h22" stroke="#8a4a18" strokeWidth="4" strokeLinecap="round" /></>}
        {name === 'search' && <><circle cx="28" cy="28" r="12" fill="none" stroke="#fff4d7" strokeWidth="6" /><path d="m38 38 12 12" stroke="#fff4d7" strokeWidth="6" strokeLinecap="round" /></>}
        {name === 'sound' && <><path d="M14 36h11l11 10V18L25 28H14Z" fill="#fff2d1" stroke="#7a431d" strokeWidth="4" strokeLinejoin="round" /><path d="M43 24c4 4 4 12 0 16M48 19c7 7 7 19 0 26" fill="none" stroke="#53d322" strokeWidth="4" strokeLinecap="round" /></>}
        {name === 'crown' && <><path d="M13 46 18 19l14 13 14-13 5 27Z" fill="#ffd95e" stroke="#8a4a18" strokeWidth="4" strokeLinejoin="round" /><circle cx="18" cy="18" r="4" fill="#ff8f6c" /><circle cx="32" cy="13" r="4" fill="#6ad7ff" /><circle cx="46" cy="18" r="4" fill="#8ef064" /></>}
        {name === 'bell' && <><path d="M20 45h24c-2-5-4-9-4-18 0-5-4-10-8-10s-8 5-8 10c0 9-2 13-4 18Z" fill="#f6d28b" stroke="#7a431d" strokeWidth="4" strokeLinejoin="round" /><path d="M27 49c1 3 3 5 5 5s4-2 5-5" fill="none" stroke="#7a431d" strokeWidth="4" strokeLinecap="round" /></>}
        {name === 'ticket' && <><path d="M13 22h38v8c-4 0-7 3-7 7s3 7 7 7v8H13v-8c4 0 7-3 7-7s-3-7-7-7Z" fill="#80d94d" stroke="#35661a" strokeWidth="4" /><path d="M32 22v30" stroke="#c4f7aa" strokeDasharray="4 4" strokeWidth="3" /></>}
        {name === 'spark' && <><path d="M32 11 37 27l16 5-16 5-5 16-5-16-16-5 16-5Z" fill="#ffe173" stroke="#8a4a18" strokeWidth="4" strokeLinejoin="round" /></>}
        {name === 'swords' && <><path d="M22 16 14 24l10 10-9 14 6 4 11-17 10 17 6-4-9-14 10-10-8-8-9 9Z" fill="#f0e7db" stroke="#5b2f19" strokeWidth="3" strokeLinejoin="round" /></>}
        {name === 'chat' && <><path d="M14 16h36v24H31l-11 9v-9H14Z" fill="#f9ddb0" stroke="#7a431d" strokeWidth="4" strokeLinejoin="round" /><path d="M22 28h20" stroke="#9e5326" strokeWidth="4" strokeLinecap="round" /></>}
        {name === 'room' && <><rect x="12" y="18" width="40" height="28" rx="7" fill="#f6ddc3" stroke="#7a431d" strokeWidth="4" /><path d="M20 46v6M44 46v6" stroke="#7a431d" strokeWidth="4" strokeLinecap="round" /><circle cx="24" cy="30" r="5" fill="#4ecfd4" /><circle cx="40" cy="30" r="5" fill="#ffd95e" /></>}
        {name === 'replay' && <><path d="M18 22H8l7-8" fill="none" stroke="#fff4d7" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /><path d="M18 22c3-6 8-10 15-10 10 0 19 8 19 19S43 50 32 50c-9 0-16-5-18-13" fill="none" stroke="#fff4d7" strokeWidth="6" strokeLinecap="round" /></>}
        {name === 'analysis' && <><rect x="13" y="14" width="38" height="36" rx="7" fill="#f6ddc3" stroke="#7a431d" strokeWidth="4" /><path d="M22 39 29 31l6 4 8-10" fill="none" stroke="#2aa2e8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /><circle cx="22" cy="39" r="3" fill="#2aa2e8" /><circle cx="29" cy="31" r="3" fill="#2aa2e8" /><circle cx="35" cy="35" r="3" fill="#2aa2e8" /><circle cx="43" cy="25" r="3" fill="#2aa2e8" /></>}
        {name === 'hint' && <><circle cx="32" cy="32" r="21" fill="#46b8ff" stroke="#184f95" strokeWidth="4" /><path d="M32 18c5 0 9 4 9 8 0 5-4 7-6 9-1 1-2 3-2 5" fill="none" stroke="#fff8e7" strokeWidth="5" strokeLinecap="round" /><circle cx="32" cy="46" r="3" fill="#fff8e7" /></>}
        {name === 'player' && <><circle cx="32" cy="25" r="10" fill="#f9ddb0" stroke="#7a431d" strokeWidth="4" /><path d="M15 49c3-8 10-13 17-13s14 5 17 13" fill="#5cb1ff" stroke="#184f95" strokeWidth="4" strokeLinecap="round" /></>}
      </svg>
    </span>
  );
}

export function ResourceIcon({ kind, className = '' }: { kind: 'gem' | 'coin'; className?: string }) {
  return <GameIcon name={kind} className={`resource-svg ${className}`.trim()} />;
}

export function NavIcon({ kind, className = '' }: { kind: 'home' | 'friends' | 'equipment' | 'events' | 'shop'; className?: string }) {
  return <GameIcon name={kind} className={`nav-svg ${className}`.trim()} />;
}

export function ModeArt({ kind, className = '' }: { kind: 'classic' | 'quick' | 'ai' | 'mail'; className?: string }) {
  const icon = kind === 'classic' ? 'swords' : kind === 'quick' ? 'spark' : kind === 'ai' ? 'knight' : 'mail';
  return <GameIcon name={icon} className={`mode-art ${className}`.trim()} />;
}

export function PackArt({ kind, className = '' }: { kind: 'gold' | 'gems' | 'recharge' | 'premium'; className?: string }) {
  const icon = kind === 'gold' ? 'coin' : kind === 'gems' ? 'gem' : kind === 'recharge' ? 'ticket' : 'crown';
  return <GameIcon name={icon} className={`pack-art-svg ${className}`.trim()} />;
}

export function EquipmentArt({ kind, className = '' }: { kind: 'piece' | 'board'; className?: string }) {
  return <GameIcon name={kind === 'piece' ? 'knight' : 'board'} className={`equipment-art-svg ${className}`.trim()} />;
}
