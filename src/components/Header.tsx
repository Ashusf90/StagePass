import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';

export type ActiveRoute = 'discover' | 'event' | 'tickets' | 'organizer' | 'admin';

interface HeaderProps {
  activeRoute: ActiveRoute;
  onNavigate: (route: ActiveRoute) => void;
  onOpenAuth: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeRoute,
  onNavigate,
  onOpenAuth,
}) => {
  const { user, logout } = useAuth();

  const navLinkClass = (isActive: boolean) =>
    `text-sm font-medium transition-colors whitespace-nowrap shrink-0 pb-0.5 border-b-2 ${
      isActive
        ? 'text-slate-900 border-blue-600'
        : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
    }`;

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand wordmark (single text element) */}
        <button
          type="button"
          onClick={() => onNavigate('discover')}
          className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
        >
          StagePass
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav
          aria-label="Primary navigation"
          className="flex items-center gap-6 overflow-x-auto"
        >
          <button
            type="button"
            onClick={() => onNavigate('discover')}
            className={navLinkClass(activeRoute === 'discover' || activeRoute === 'event')}
          >
            Discover
          </button>
          <button
            type="button"
            onClick={() => {
              if (!user) {
                onOpenAuth();
              } else {
                onNavigate('tickets');
              }
            }}
            className={navLinkClass(activeRoute === 'tickets')}
          >
            My Tickets
          </button>
          {(user?.role === 'organizer' || user?.role === 'admin') && (
            <button
              type="button"
              onClick={() => onNavigate('organizer')}
              className={navLinkClass(activeRoute === 'organizer')}
            >
              Organizer
            </button>
          )}
          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={() => onNavigate('admin')}
              className={navLinkClass(activeRoute === 'admin')}
            >
              Admin
            </button>
          )}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="shrink-0">
          {user ? (
            <button
              type="button"
              onClick={async () => {
                await logout();
                onNavigate('discover');
              }}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              Sign Out ({user.name.split(' ')[0]})
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
