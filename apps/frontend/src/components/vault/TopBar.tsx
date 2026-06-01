import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { BalanceChip } from './BalanceChip';
import { Avatar } from './Avatar';
import { SearchIcon, BellIcon, ChatIcon, MenuIcon } from './icons';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useMotionStore } from '../../stores/motionStore';

// Sparkles glyph for the animations toggle; a diagonal slash marks the "off"
// (reduced-motion) state.
function MotionIcon({ off }: { off: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5l1.5 4.2 4.2 1.5-4.2 1.5L12 15l-1.5-4.3L6.3 9.2l4.2-1.5L12 3.5z" />
      <path d="M18.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
      {off && <line x1="3.5" y1="3.5" x2="20.5" y2="20.5" />}
    </svg>
  );
}

// App-wide animations toggle. Reflects the effective state (OS setting + any
// in-app override) and, on click, writes an explicit override that flips it —
// so a user whose OS has "reduce motion" on can force animations back on.
function MotionToggle() {
  const reduced = useReducedMotion();
  return (
    <button
      type="button"
      className={'icon-btn motion-toggle' + (reduced ? ' is-off' : '')}
      aria-label={reduced ? 'Enable animations' : 'Reduce animations'}
      aria-pressed={!reduced}
      title={reduced ? 'Animations off — click to enable' : 'Animations on — click to reduce'}
      onClick={() => {
        const next = reduced ? 'on' : 'off';
        useMotionStore.getState().setPref(next);
        toast(next === 'on' ? 'Animations on' : 'Animations reduced');
      }}
    >
      <MotionIcon off={reduced} />
    </button>
  );
}

// Top bar for the app shell. The search field and bell/chat buttons are
// styled affordances reserved for future features — deliberately carrying NO
// fabricated counts or results (unlike the prototype's hard-coded "3" badge).
//
// `onMenuToggle` opens/closes the mobile navigation drawer; the hamburger that
// triggers it is hidden on desktop via CSS.
export function TopBar({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const { username, avatarColor, avatarImage } = useAuth();

  return (
    <header className="header">
      <button type="button" className="menu-btn" aria-label="Open navigation" onClick={onMenuToggle}>
        <MenuIcon size={18} />
      </button>
      <div className="search">
        <SearchIcon size={14} />
        <input placeholder="Search games, players, transactions…" aria-label="Search" />
        <kbd>⌘ K</kbd>
      </div>
      <div className="header-right">
        <MotionToggle />
        <button type="button" className="icon-btn" aria-label="Notifications">
          <BellIcon size={16} />
        </button>
        <button type="button" className="icon-btn" aria-label="Chat">
          <ChatIcon size={16} />
        </button>
        <BalanceChip />
        <Link className="user-pill" to={username ? `/profile/${username}` : '/dashboard'}>
          <Avatar username={username ?? '?'} avatarColor={avatarColor} avatarImage={avatarImage} className="avatar" />
          <span className="name">
            {username ?? 'Guest'}
            <small>PLAYER</small>
          </span>
        </Link>
      </div>
    </header>
  );
}
