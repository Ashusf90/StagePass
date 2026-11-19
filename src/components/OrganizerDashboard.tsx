import React, { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  Plus,
  QrCode,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { ApiClientError, apiRequest } from '../api/client.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import type { BookingRecord, EventItem, SectionConfig } from '../types/api.ts';

type OrganizerTab = 'overview' | 'create' | 'verify';

interface AnalyticsPayload {
  event: EventItem;
  summary: {
    totalRevenue: number;
    confirmedBookings: number;
    ticketsSold: number;
    checkedInBookings: number;
  };
  sectionBreakdown: Array<{
    _id: string;
    price: number;
    total: number;
    booked: number;
    locked: number;
    available: number;
  }>;
  recentBookings: BookingRecord[];
}

export const OrganizerDashboard: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState<OrganizerTab>('overview');
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsPayload | null>(null);

  // Promo creation inside analytics
  const [newPromoCode, setNewPromoCode] = useState('');
  const [newPromoDiscount, setNewPromoDiscount] = useState(15);
  const [newPromoMaxUses, setNewPromoMaxUses] = useState(50);

  // Create event form state
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<EventItem['category']>('Concert');
  const [artworkTheme, setArtworkTheme] = useState<EventItem['artworkTheme']>('symphony');
  const [venueName, setVenueName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 3 * 3600 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [sections, setSections] = useState<SectionConfig[]>([
    { name: 'Main Floor', kind: 'seat', price: 110, rows: ['A', 'B', 'C'], seatsPerRow: 8 },
    { name: 'General Admission', kind: 'tier', price: 55, capacity: 30 },
  ]);
  const [creating, setCreating] = useState(false);

  // Gate QR Verifier state
  const [qrInput, setQrInput] = useState('');
  const [verifyEventId, setVerifyEventId] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    ok: boolean;
    message: string;
    booking?: BookingRecord;
    ticketCode?: string;
  } | null>(null);

  const loadOrganizerEvents = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ events: EventItem[] }>('/api/events/organizer/mine');
      setEvents(data.events);
      if (data.events.length > 0 && !selectedEventId) {
        setSelectedEventId(data.events[0]._id);
      }
    } catch (err) {
      showToast(
        err instanceof ApiClientError ? err.message : 'Unable to load organizer events',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, [selectedEventId, showToast]);

  useEffect(() => {
    loadOrganizerEvents();
  }, [loadOrganizerEvents]);

  const loadEventAnalytics = useCallback(
    async (eventId: string) => {
      try {
        const data = await apiRequest<AnalyticsPayload>(
          `/api/events/${eventId}/analytics`
        );
        setAnalytics(data);
      } catch (err) {
        showToast(
          err instanceof ApiClientError ? err.message : 'Failed to load analytics',
          'error'
        );
      }
    },
    [showToast]
  );

  useEffect(() => {
    if (selectedEventId && tab === 'overview') {
      loadEventAnalytics(selectedEventId);
    }
  }, [selectedEventId, tab, loadEventAnalytics]);

  const totalRevenue = events.reduce((sum, e) => sum + (e.metrics?.revenue || 0), 0);
  const totalBooked = events.reduce((sum, e) => sum + (e.metrics?.booked || 0), 0);
  const totalCheckedIn = events.reduce(
    (sum, e) => sum + (e.metrics?.checkedInCount || 0),
    0
  );

  const handleAddSection = (kind: 'seat' | 'tier') => {
    setSections((prev) => [
      ...prev,
      kind === 'seat'
        ? {
            name: `Section ${prev.length + 1}`,
            kind: 'seat',
            price: 90,
            rows: ['A', 'B'],
            seatsPerRow: 6,
          }
        : {
            name: `Tier ${prev.length + 1}`,
            kind: 'tier',
            price: 60,
            capacity: 25,
          },
    ]);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const hasSeated = sections.some((s) => s.kind === 'seat');
      const hasTiered = sections.some((s) => s.kind === 'tier');
      const mode = hasSeated && hasTiered ? 'hybrid' : hasSeated ? 'seated' : 'tiered';

      const res = await apiRequest<{ event: EventItem; seatCount: number }>('/api/events', {
        method: 'POST',
        body: JSON.stringify({
          title,
          subtitle: subtitle || undefined,
          description,
          category,
          artworkTheme,
          venueName,
          address,
          city,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          status: 'published',
          seatMapConfig: {
            mode,
            currency: 'USD',
            stageLabel: 'Main Stage',
            sections,
          },
        }),
      });
      showToast(
        `Event created with ${res.seatCount} seats/passes generated.`,
        'success'
      );
      setTitle('');
      setSubtitle('');
      setDescription('');
      setVenueName('');
      setAddress('');
      setCity('');
      setSelectedEventId(res.event._id);
      setTab('overview');
      await loadOrganizerEvents();
    } catch (err) {
      showToast(
        err instanceof ApiClientError ? err.message : 'Unable to create event',
        'error'
      );
    } finally {
      setCreating(false);
    }
  };

  const handleAddPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId || !newPromoCode.trim()) return;
    try {
      await apiRequest(`/api/events/${selectedEventId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          promoCode: {
            code: newPromoCode.trim().toUpperCase(),
            discountPercent: newPromoDiscount,
            maxUses: newPromoMaxUses,
          },
        }),
      });
      showToast(`Promo code ${newPromoCode.toUpperCase()} added.`, 'success');
      setNewPromoCode('');
      await loadEventAnalytics(selectedEventId);
    } catch (err) {
      showToast(
        err instanceof ApiClientError ? err.message : 'Unable to save promo code',
        'error'
      );
    }
  };

  const handleVerifyTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qrInput.trim()) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await apiRequest<{
        verified: boolean;
        ticketCode: string;
        booking: BookingRecord;
      }>('/api/tickets/verify', {
        method: 'POST',
        body: JSON.stringify({
          qrToken: qrInput.trim(),
          eventId: verifyEventId || undefined,
        }),
      });
      setVerifyResult({
        ok: true,
        message: `Ticket ${res.booking.bookingReference} verified and checked in.`,
        booking: res.booking,
        ticketCode: res.ticketCode,
      });
      showToast('Ticket admitted at gate!', 'success');
      await loadOrganizerEvents();
    } catch (err) {
      const msg =
        err instanceof ApiClientError ? err.message : 'Verification failed';
      setVerifyResult({ ok: false, message: msg });
      showToast(msg, 'error');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            Organizer Studio
          </h1>
          <p className="text-sm text-slate-600">
            {user?.organizationName || user?.name} · Status: {user?.organizerStatus}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setTab('overview')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              tab === 'overview'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Events & Sales
          </button>
          <button
            type="button"
            onClick={() => setTab('create')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              tab === 'create'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Create Event
          </button>
          <button
            type="button"
            onClick={() => setTab('verify')}
            className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              tab === 'verify'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Gate QR Check-In
          </button>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Gross Ticket Revenue</p>
          <p className="mt-1 text-2xl font-bold font-mono text-slate-900 tabular-nums">
            ${totalRevenue.toLocaleString()}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Seats & Passes Sold</p>
          <p className="mt-1 text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {totalBooked}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Gate Check-Ins</p>
          <p className="mt-1 text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {totalCheckedIn}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Managed Events</p>
          <p className="mt-1 text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {events.length}
          </p>
        </div>
      </section>

      {tab === 'overview' && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Event Selector List */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Your Events
              </h2>
              <button
                type="button"
                onClick={() => setTab('create')}
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                + New Event
              </button>
            </div>

            {loading ? (
              <div className="p-6 text-sm text-slate-500">Loading events...</div>
            ) : events.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No events created yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {events.map((ev) => {
                  const isSelected = ev._id === selectedEventId;
                  return (
                    <button
                      key={ev._id}
                      type="button"
                      onClick={() => setSelectedEventId(ev._id)}
                      className={`w-full text-left p-4 transition-colors ${
                        isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span>
                          {ev.category} · {ev.status} · {ev.approvalStatus}
                        </span>
                        <span className="font-mono tabular-nums font-medium text-slate-800">
                          ${ev.metrics?.revenue || 0}
                        </span>
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {ev.title}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 tabular-nums">
                        {ev.metrics?.booked || 0} sold · {ev.metrics?.locked || 0} locked ·{' '}
                        {ev.metrics?.available || 0} available
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Event Analytics */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
            {!analytics ? (
              <div className="py-12 text-center text-sm text-slate-500">
                <BarChart3 className="w-7 h-7 text-slate-400 mx-auto mb-2" />
                Select an event to inspect seat sales and promo performance.
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-slate-900">
                      {analytics.event.title}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {analytics.event.venueName} ·{' '}
                      {new Date(analytics.event.startDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">Event Revenue</span>
                    <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                      ${analytics.summary.totalRevenue}
                    </span>
                  </div>
                </div>

                {/* Section Breakdown Table */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-700 mb-3">
                    Inventory by Section / Tier
                  </h3>
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3 font-medium">Section</th>
                          <th className="py-2.5 px-3 font-medium text-right">Price</th>
                          <th className="py-2.5 px-3 font-medium text-right">Booked</th>
                          <th className="py-2.5 px-3 font-medium text-right">Locked</th>
                          <th className="py-2.5 px-3 font-medium text-right">Available</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {analytics.sectionBreakdown.map((sec) => (
                          <tr key={sec._id}>
                            <td className="py-2.5 px-3 font-medium text-slate-900">
                              {sec._id}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                              ${sec.price}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700 font-medium">
                              {sec.booked}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-700">
                              {sec.locked}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600">
                              {sec.available}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Add Promo Code */}
                <form
                  onSubmit={handleAddPromo}
                  className="pt-4 border-t border-slate-100 flex flex-wrap items-end gap-3"
                >
                  <div className="flex-1 min-w-36">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Add / Update Promo Code
                    </label>
                    <input
                      type="text"
                      value={newPromoCode}
                      onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                      placeholder="FLASH25"
                      className="w-full px-3 py-1.5 text-xs font-mono uppercase border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Discount %
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={90}
                      value={newPromoDiscount}
                      onChange={(e) => setNewPromoDiscount(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Max Uses
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={newPromoMaxUses}
                      onChange={(e) => setNewPromoMaxUses(Number(e.target.value))}
                      className="w-full px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-blue-600 rounded-lg transition-colors"
                  >
                    Save Promo
                  </button>
                </form>

                {/* Recent Bookings */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-700 mb-2">
                    Recent Bookings ({analytics.recentBookings.length})
                  </h3>
                  {analytics.recentBookings.length === 0 ? (
                    <p className="text-xs text-slate-500">No bookings recorded yet.</p>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3 font-medium">Reference</th>
                            <th className="py-2 px-3 font-medium">Attendee</th>
                            <th className="py-2 px-3 font-medium">Status</th>
                            <th className="py-2 px-3 font-medium text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {analytics.recentBookings.slice(0, 8).map((b) => {
                            const buyer = b.userId as { name?: string; email?: string };
                            return (
                              <tr key={b._id}>
                                <td className="py-2 px-3 font-mono font-medium text-slate-900">
                                  {b.bookingReference}
                                </td>
                                <td className="py-2 px-3 text-slate-600">
                                  {buyer?.name || 'Patron'}
                                </td>
                                <td className="py-2 px-3 text-slate-700">
                                  {b.checkedInAt ? 'checked_in' : b.status}
                                </td>
                                <td className="py-2 px-3 text-right font-mono tabular-nums">
                                  ${b.totalAmount}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {tab === 'create' && (
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-4xl">
          <h2 className="font-display text-xl font-semibold text-slate-900 mb-6">
            Publish New Event & Seat Map
          </h2>
          <form onSubmit={handleCreateEvent} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Event Title
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Midnight Jazz Quartet at Blue Note"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Subtitle
                </label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Acoustic quintet performance with late seating"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as EventItem['category'])}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="Concert">Concert</option>
                  <option value="Festival">Festival</option>
                  <option value="Conference">Conference</option>
                  <option value="Theater">Theater</option>
                  <option value="Sports">Sports</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Venue Visual Theme
                </label>
                <select
                  value={artworkTheme}
                  onChange={(e) =>
                    setArtworkTheme(e.target.value as EventItem['artworkTheme'])
                  }
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  <option value="symphony">Symphony Hall</option>
                  <option value="amphitheater">Outdoor Amphitheater</option>
                  <option value="summit">Conference Auditorium</option>
                  <option value="theater">Black-Box Theater</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Venue Name
                </label>
                <input
                  type="text"
                  required
                  value={venueName}
                  onChange={(e) => setVenueName(e.target.value)}
                  placeholder="Symphony Center"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  City
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Seattle, WA"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Street Address
                </label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="200 University St"
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Start Date & Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  End Date & Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  required
                  minLength={10}
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe program details, doors open time, and venue acoustics..."
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            {/* Dynamic Seat & Tier Builder */}
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Seat Map & Ticket Tiers
                  </h3>
                  <p className="text-xs text-slate-500">
                    Configure assigned seating rows and/or general admission tiers.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddSection('seat')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Seated Section
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddSection('tier')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    GA Tier
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {sections.map((sec, idx) => (
                  <div
                    key={idx}
                    className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
                  >
                    <div className="sm:col-span-4">
                      <label className="block text-xs text-slate-600 mb-1">
                        Section Name ({sec.kind === 'seat' ? 'Seated' : 'GA Tier'})
                      </label>
                      <input
                        type="text"
                        required
                        value={sec.name}
                        onChange={(e) => {
                          const next = [...sections];
                          next[idx].name = e.target.value;
                          setSections(next);
                        }}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs text-slate-600 mb-1">
                        Price ($)
                      </label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={sec.price}
                        onChange={(e) => {
                          const next = [...sections];
                          next[idx].price = Number(e.target.value);
                          setSections(next);
                        }}
                        className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                      />
                    </div>
                    {sec.kind === 'seat' ? (
                      <>
                        <div className="sm:col-span-3">
                          <label className="block text-xs text-slate-600 mb-1">
                            Rows (comma-separated)
                          </label>
                          <input
                            type="text"
                            value={(sec.rows || []).join(',')}
                            onChange={(e) => {
                              const next = [...sections];
                              next[idx].rows = e.target.value
                                .split(',')
                                .map((r) => r.trim())
                                .filter(Boolean);
                              setSections(next);
                            }}
                            className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-xs text-slate-600 mb-1">
                            Seats/Row
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={sec.seatsPerRow || 6}
                            onChange={(e) => {
                              const next = [...sections];
                              next[idx].seatsPerRow = Number(e.target.value);
                              setSections(next);
                            }}
                            className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="sm:col-span-5">
                        <label className="block text-xs text-slate-600 mb-1">
                          Total Pass Capacity
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={1000}
                          value={sec.capacity || 25}
                          onChange={(e) => {
                            const next = [...sections];
                            next[idx].capacity = Number(e.target.value);
                            setSections(next);
                          }}
                          className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
                        />
                      </div>
                    )}
                    <div className="sm:col-span-1 flex justify-end">
                      {sections.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setSections((prev) => prev.filter((_, i) => i !== idx))
                          }
                          aria-label="Remove section"
                          className="p-2 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={creating}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {creating ? 'Generating Seat Inventory...' : 'Publish Event'}
              </button>
            </div>
          </form>
        </section>
      )}

      {tab === 'verify' && (
        <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 max-w-2xl space-y-6">
          <div className="flex items-start gap-3">
            <QrCode className="w-6 h-6 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display text-xl font-semibold text-slate-900">
                Venue Gate QR Verification
              </h2>
              <p className="text-sm text-slate-600">
                Paste a signed attendee QR ticket token to validate cryptographic authenticity and admit once. Duplicate scans are atomically blocked.
              </p>
            </div>
          </div>

          <form onSubmit={handleVerifyTicket} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Target Event Filter (optional)
              </label>
              <select
                value={verifyEventId}
                onChange={(e) => setVerifyEventId(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="">Any of my events</option>
                {events.map((ev) => (
                  <option key={ev._id} value={ev._id}>
                    {ev.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Signed QR Payload Token
              </label>
              <textarea
                required
                rows={4}
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                placeholder="Paste token from attendee's My Tickets → Copy QR Token..."
                className="w-full px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <button
              type="submit"
              disabled={verifying}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {verifying ? 'Verifying Signature...' : 'Verify & Admit Entry'}
            </button>
          </form>

          {verifyResult && (
            <div
              className={`p-5 rounded-xl border ${
                verifyResult.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-red-50 border-red-200 text-red-950'
              }`}
            >
              <div className="flex items-start gap-3">
                {verifyResult.ok ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 text-sm">
                  <div className="font-semibold">
                    {verifyResult.ok ? 'Entry Admitted' : 'Entry Denied'}
                  </div>
                  <p>{verifyResult.message}</p>
                  {verifyResult.booking && (
                    <div className="pt-2 text-xs font-mono space-y-0.5 text-emerald-900">
                      <div>
                        Patron:{' '}
                        {(verifyResult.booking.userId as { name?: string })?.name}
                      </div>
                      <div>Ticket: {verifyResult.ticketCode}</div>
                      <div>Seats: {verifyResult.booking.items.length}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
};
