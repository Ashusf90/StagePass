import { useState } from 'react';
import { AdminPanel } from './components/AdminPanel.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { DiscoveryPage } from './components/DiscoveryPage.tsx';
import { Header, type ActiveRoute } from './components/Header.tsx';
import { OrganizerDashboard } from './components/OrganizerDashboard.tsx';
import { SeatSelectorView } from './components/SeatSelectorView.tsx';
import { TicketsPage } from './components/TicketsPage.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';

function StagePassShell() {
  const { user } = useAuth();
  const [route, setRoute] = useState<ActiveRoute>('discover');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const handleSelectEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    setRoute('event');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigate = (nextRoute: ActiveRoute) => {
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header
        activeRoute={route}
        onNavigate={handleNavigate}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      <div className="flex-1">
        {route === 'discover' && (
          <DiscoveryPage onSelectEvent={handleSelectEvent} />
        )}

        {route === 'event' && selectedEventId && (
          <SeatSelectorView
            eventId={selectedEventId}
            onBack={() => handleNavigate('discover')}
            onRequireAuth={() => setAuthModalOpen(true)}
            onViewTickets={() => handleNavigate('tickets')}
          />
        )}

        {route === 'tickets' &&
          (user ? (
            <TicketsPage onBrowseEvents={() => handleNavigate('discover')} />
          ) : (
            <DiscoveryPage onSelectEvent={handleSelectEvent} />
          ))}

        {route === 'organizer' &&
          (user?.role === 'organizer' || user?.role === 'admin' ? (
            <OrganizerDashboard />
          ) : (
            <DiscoveryPage onSelectEvent={handleSelectEvent} />
          ))}

        {route === 'admin' &&
          (user?.role === 'admin' ? (
            <AdminPanel />
          ) : (
            <DiscoveryPage onSelectEvent={handleSelectEvent} />
          ))}
      </div>

      <footer className="border-t border-slate-200 bg-white mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>StagePass Multi-Vendor Ticketing & Seat Reservations</span>
          <span>Atomic 10-minute seat holds · HMAC-verified payment webhooks · Signed QR passes</span>
        </div>
      </footer>

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <StagePassShell />
      </AuthProvider>
    </ToastProvider>
  );
}
