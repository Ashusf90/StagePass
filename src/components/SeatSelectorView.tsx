import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  Lock,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Tag,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { ApiClientError, apiRequest } from '../api/client.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useToast } from '../context/ToastContext.tsx';
import type {
  BookingRecord,
  EventItem,
  SeatItem,
  TierSummary,
} from '../types/api.ts';
import { EventArtwork } from './EventArtwork.tsx';

interface SeatSelectorViewProps {
  eventId: string;
  onBack: () => void;
  onRequireAuth: () => void;
  onViewTickets: () => void;
}

export const SeatSelectorView: React.FC<SeatSelectorViewProps> = ({
  eventId,
  onBack,
  onRequireAuth,
  onViewTickets,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [seats, setSeats] = useState<SeatItem[]>([]);
  const [tierSummary, setTierSummary] = useState<TierSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Selection state before lock
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([]);
  const [tierQuantities, setTierQuantities] = useState<Record<string, number>>({});

  // Active lock & checkout state
  const [activeBooking, setActiveBooking] = useState<BookingRecord | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    crypto.randomUUID()
  );
  const [confirmedBooking, setConfirmedBooking] = useState<BookingRecord | null>(null);
  const [lastProviderEventId, setLastProviderEventId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Live countdown state (seconds remaining)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [lockExpiredModalOpen, setLockExpiredModalOpen] = useState(false);

  const loadEventData = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        const data = await apiRequest<{
          event: EventItem;
          seats: SeatItem[];
          tierSummary: TierSummary[];
        }>(`/api/events/${eventId}`);
        setEvent(data.event);
        setSeats(data.seats);
        setTierSummary(data.tierSummary);
      } catch (err) {
        showToast(
          err instanceof ApiClientError ? err.message : 'Failed to load event map',
          'error'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [eventId, showToast]
  );

  useEffect(() => {
    loadEventData();
  }, [loadEventData]);

  // Countdown tick for active 10-minute lock
  useEffect(() => {
    if (!activeBooking || activeBooking.status !== 'pending_payment' || !activeBooking.lockExpiresAt) {
      setSecondsLeft(null);
      return;
    }

    const updateTimer = () => {
      const diffMs =
        new Date(activeBooking.lockExpiresAt!).getTime() - Date.now();
      if (diffMs <= 0) {
        setSecondsLeft(0);
        setActiveBooking(null);
        setPaymentIntentId(null);
        setLockExpiredModalOpen(true);
        loadEventData(true);
        return;
      }
      setSecondsLeft(Math.ceil(diffMs / 1000));
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeBooking, loadEventData]);

  const seatedSections = useMemo(() => {
    const map = new Map<string, Map<string, SeatItem[]>>();
    for (const s of seats) {
      if (s.kind !== 'seat') continue;
      if (!map.has(s.section)) map.set(s.section, new Map());
      const rowsMap = map.get(s.section)!;
      const rowKey = s.row || 'Row';
      if (!rowsMap.has(rowKey)) rowsMap.set(rowKey, []);
      rowsMap.get(rowKey)!.push(s);
    }
    // Sort seat numbers numerically when possible
    for (const rowsMap of map.values()) {
      for (const list of rowsMap.values()) {
        list.sort((a, b) => Number(a.seatNumber) - Number(b.seatNumber));
      }
    }
    return map;
  }, [seats]);

  const totalSelectedCount = useMemo(() => {
    const tierCount = Object.values(tierQuantities).reduce((s, q) => s + q, 0);
    return selectedSeatIds.length + tierCount;
  }, [selectedSeatIds, tierQuantities]);

  const draftTotal = useMemo(() => {
    const seatSum = selectedSeatIds.reduce((sum, id) => {
      const seat = seats.find((s) => s._id === id);
      return sum + (seat?.price || 0);
    }, 0);
    const tierSum = Object.entries(tierQuantities).reduce((sum, [sec, qty]) => {
      const tier = tierSummary.find((t) => t.section === sec);
      return sum + (tier?.price || 0) * qty;
    }, 0);
    return seatSum + tierSum;
  }, [selectedSeatIds, seats, tierQuantities, tierSummary]);

  const toggleSeat = (seat: SeatItem) => {
    if (activeBooking || confirmedBooking) return;
    if (seat.status === 'booked') return;
    if (seat.status === 'locked' && !seat.isLockedByMe) return;

    setSelectedSeatIds((prev) => {
      if (prev.includes(seat._id)) {
        return prev.filter((id) => id !== seat._id);
      }
      if (totalSelectedCount >= 8) {
        showToast('Maximum 8 tickets per reservation.', 'info');
        return prev;
      }
      return [...prev, seat._id];
    });
  };

  const adjustTier = (section: string, delta: number, maxAvail: number) => {
    if (activeBooking || confirmedBooking) return;
    setTierQuantities((prev) => {
      const current = prev[section] || 0;
      const next = current + delta;
      if (next < 0) return prev;
      if (next > maxAvail) return prev;
      if (delta > 0 && totalSelectedCount >= 8) {
        showToast('Maximum 8 tickets per reservation.', 'info');
        return prev;
      }
      return { ...prev, [section]: next };
    });
  };

  const handleLockSeats = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    setSubmitting(true);
    try {
      const tierSelections = Object.entries(tierQuantities)
        .filter(([, q]) => q > 0)
        .map(([section, quantity]) => ({ section, quantity }));

      const res = await apiRequest<{ booking: BookingRecord }>('/api/bookings/lock', {
        method: 'POST',
        body: JSON.stringify({
          eventId,
          seatIds: selectedSeatIds,
          tierSelections,
        }),
      });
      setActiveBooking(res.booking);
      setPaymentIntentId(null);
      setIdempotencyKey(crypto.randomUUID());
      setSelectedSeatIds([]);
      setTierQuantities({});
      showToast('Seats locked atomically for 10 minutes.', 'success');
      await loadEventData(true);
    } catch (err) {
      showToast(
        err instanceof ApiClientError ? err.message : 'Unable to lock seats',
        'error'
      );
      await loadEventData(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReleaseLock = async () => {
    if (!activeBooking) return;
    setSubmitting(true);
    try {
      await apiRequest(`/api/bookings/${activeBooking._id}/lock`, {
        method: 'DELETE',
      });
      setActiveBooking(null);
      setPaymentIntentId(null);
      showToast('Seat hold released back to public inventory.', 'info');
      await loadEventData(true);
    } catch (err) {
      showToast(
        err instanceof ApiClientError ? err.message : 'Unable to release lock',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCheckoutIntent = async () => {
    if (!activeBooking) return;
    setSubmitting(true);
    try {
      const res = await apiRequest<{
        booking: BookingRecord;
        paymentIntent: { paymentIntentId: string; amount: number };
      }>(`/api/bookings/${activeBooking._id}/checkout`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({
          promoCode: promoCode.trim() || undefined,
          idempotencyKey,
        }),
      });
      setActiveBooking(res.booking);
      setPaymentIntentId(res.paymentIntent.paymentIntentId);
      showToast('Payment intent created. Complete payment to issue QR pass.', 'success');
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'LOCK_EXPIRED') {
        setActiveBooking(null);
        setLockExpiredModalOpen(true);
      } else {
        showToast(
          err instanceof ApiClientError ? err.message : 'Checkout initiation failed',
          'error'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSandboxPay = async () => {
    if (!activeBooking) return;
    setSubmitting(true);
    try {
      const res = await apiRequest<{
        received: boolean;
        duplicate: boolean;
        providerEventId: string;
        booking: BookingRecord;
      }>(`/api/bookings/${activeBooking._id}/confirm-sandbox`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setConfirmedBooking(res.booking);
      setLastProviderEventId(res.providerEventId);
      setActiveBooking(null);
      setPaymentIntentId(null);
      showToast('Payment webhook verified. Tickets confirmed!', 'success');
      await loadEventData(true);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'LOCK_EXPIRED') {
        setActiveBooking(null);
        setLockExpiredModalOpen(true);
      } else {
        showToast(
          err instanceof ApiClientError ? err.message : 'Payment confirmation failed',
          'error'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSimulateDuplicateWebhook = async () => {
    if (!confirmedBooking || !lastProviderEventId) return;
    setSubmitting(true);
    try {
      const res = await apiRequest<{
        received: boolean;
        duplicate: boolean;
        providerEventId: string;
      }>(`/api/bookings/${confirmedBooking._id}/confirm-sandbox`, {
        method: 'POST',
        body: JSON.stringify({
          simulateDuplicateProviderEventId: lastProviderEventId,
        }),
      });
      if (res.duplicate) {
        showToast(
          `Idempotency check passed: duplicate event ${res.providerEventId} ignored with 200 OK.`,
          'success'
        );
      }
    } catch (err) {
      showToast(
        err instanceof ApiClientError ? err.message : 'Webhook test failed',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const formatCountdown = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  if (loading || !event) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="h-8 w-40 bg-slate-200 rounded animate-pulse mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 h-96 bg-slate-200 rounded-xl animate-pulse" />
          <div className="lg:col-span-4 h-96 bg-slate-200 rounded-xl animate-pulse" />
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to events
        </button>

        <button
          type="button"
          onClick={() => loadEventData(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Sync Availability
        </button>
      </div>

      {/* Event Summary Header */}
      <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-4 min-h-52 bg-slate-900">
          <EventArtwork
            theme={event.artworkTheme}
            venueName={event.venueName}
            className="w-full h-full min-h-52"
          />
        </div>
        <div className="lg:col-span-8 p-6 sm:p-8 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{event.category}</span>
              <span aria-hidden="true">·</span>
              <span>{event.organizerId?.organizationName || event.organizerId?.name}</span>
              <span aria-hidden="true">·</span>
              <span>Refund eligible up to {event.cancellationWindowHours}h prior</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 text-balance">
              {event.title}
            </h1>
            {event.subtitle && (
              <p className="text-sm font-medium text-slate-600">{event.subtitle}</p>
            )}
            <p className="text-sm text-slate-600 leading-relaxed pt-1">
              {event.description}
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-6 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="tabular-nums">
                {new Intl.DateTimeFormat('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                }).format(new Date(event.startDate))}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span>
                {event.venueName}, {event.address}, {event.city}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Workspace: Interactive Map / Tiers + Sticky Reservation Module */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Seat Map & Tiers */}
        <section className="lg:col-span-8 space-y-6">
          {seatedSections.size > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="font-display text-lg font-semibold text-slate-900">
                    Interactive Venue Seat Map
                  </h2>
                  <p className="text-xs text-slate-500">
                    Select up to 8 seats to place an atomic 10-minute hold.
                  </p>
                </div>

                {/* Accessible non-color-only legend */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded border border-slate-300 bg-white inline-block" />
                    Available
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded bg-blue-600 inline-flex items-center justify-center text-white text-[10px] font-bold">
                      ✓
                    </span>
                    Selected
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded bg-amber-100 border border-amber-400 inline-flex items-center justify-center text-amber-800 text-[10px]">
                      L
                    </span>
                    Locked
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded bg-slate-200 border border-slate-300 inline-flex items-center justify-center text-slate-500 text-[10px]">
                      ×
                    </span>
                    Booked
                  </span>
                </div>
              </div>

              {/* Stage indicator */}
              <div className="mx-auto max-w-md py-2 px-6 text-center text-xs font-medium tracking-wide text-slate-600 bg-slate-100 border border-slate-200 rounded-lg">
                {event.seatMapConfig.stageLabel}
              </div>

              {/* Sections & Rows */}
              <div className="space-y-8 pt-2">
                {Array.from(seatedSections.entries()).map(([sectionName, rowsMap]) => {
                  const firstRow = rowsMap.values().next().value as SeatItem[] | undefined;
                  const sectionPrice = firstRow?.[0]?.price ?? 0;

                  return (
                    <div key={sectionName} className="space-y-3">
                      <div className="flex items-baseline justify-between border-b border-slate-100 pb-2">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {sectionName}
                        </h3>
                        <span className="text-xs font-mono font-medium text-slate-600 tabular-nums">
                          ${sectionPrice} per seat
                        </span>
                      </div>

                      <div className="space-y-2.5 overflow-x-auto pb-1">
                        {Array.from(rowsMap.entries()).map(([rowName, rowSeats]) => (
                          <div
                            key={rowName}
                            className="flex items-center gap-3 min-w-max"
                          >
                            <span className="w-8 text-xs font-mono font-medium text-slate-500 shrink-0">
                              Row {rowName}
                            </span>
                            <div className="flex items-center gap-2">
                              {rowSeats.map((seat) => {
                                const isSelected = selectedSeatIds.includes(seat._id);
                                const isBooked = seat.status === 'booked';
                                const isLockedOther =
                                  seat.status === 'locked' && !seat.isLockedByMe;
                                const isLockedMine =
                                  seat.status === 'locked' && seat.isLockedByMe;
                                const disabled =
                                  isBooked ||
                                  isLockedOther ||
                                  Boolean(activeBooking) ||
                                  Boolean(confirmedBooking);

                                let cellClass =
                                  'bg-white border-slate-300 text-slate-700 hover:border-blue-600 hover:text-blue-700';
                                if (isBooked) {
                                  cellClass =
                                    'bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed';
                                } else if (isLockedOther) {
                                  cellClass =
                                    'bg-amber-50 border-amber-300 text-amber-700 cursor-not-allowed';
                                } else if (isLockedMine) {
                                  cellClass =
                                    'bg-blue-50 border-blue-600 text-blue-700 ring-1 ring-blue-600';
                                } else if (isSelected) {
                                  cellClass =
                                    'bg-blue-600 border-blue-600 text-white shadow-xs';
                                }

                                return (
                                  <button
                                    key={seat._id}
                                    type="button"
                                    disabled={disabled}
                                    onClick={() => toggleSeat(seat)}
                                    title={`${sectionName} · Row ${rowName} Seat ${seat.seatNumber} ($${seat.price}) — ${seat.status}`}
                                    aria-label={`Section ${sectionName} Row ${rowName} Seat ${seat.seatNumber}, $${seat.price}, ${seat.status}`}
                                    className={`w-9 h-9 rounded-lg border text-xs font-mono font-medium transition-colors flex items-center justify-center shrink-0 ${cellClass}`}
                                  >
                                    {isBooked
                                      ? '×'
                                      : isLockedOther
                                        ? 'L'
                                        : seat.seatNumber}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* General Admission / Ticket Tiers */}
          {tierSummary.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  General Admission & Passes
                </h2>
                <p className="text-xs text-slate-500">
                  Choose pass quantities — inventory locks atomically upon hold.
                </p>
              </div>

              <div className="divide-y divide-slate-100">
                {tierSummary.map((tier) => {
                  const qty = tierQuantities[tier.section] || 0;
                  const disabledControls =
                    Boolean(activeBooking) || Boolean(confirmedBooking);
                  return (
                    <div
                      key={tier.section}
                      className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-slate-900">
                          {tier.section}
                        </div>
                        <div className="text-xs text-slate-500 tabular-nums">
                          ${tier.price} each · {tier.available} available of {tier.total}
                          {tier.locked > 0 ? ` · ${tier.locked} currently held` : ''}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={disabledControls || qty === 0}
                          onClick={() => adjustTier(tier.section, -1, tier.available)}
                          aria-label={`Decrease ${tier.section} quantity`}
                          className="w-9 h-9 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 font-mono text-base"
                        >
                          −
                        </button>
                        <span className="w-6 text-center font-mono text-sm font-semibold tabular-nums">
                          {qty}
                        </span>
                        <button
                          type="button"
                          disabled={disabledControls || qty >= tier.available}
                          onClick={() => adjustTier(tier.section, 1, tier.available)}
                          aria-label={`Increase ${tier.section} quantity`}
                          className="w-9 h-9 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 font-mono text-base"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Right Sticky Purchase / Checkout Module */}
        <aside className="lg:col-span-4 lg:sticky lg:top-24 bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          {confirmedBooking ? (
            <div className="space-y-5">
              <div className="flex items-center gap-2.5 text-emerald-700">
                <ShieldCheck className="w-5 h-5 shrink-0" />
                <div>
                  <h2 className="font-display text-lg font-semibold text-slate-900">
                    Booking Confirmed
                  </h2>
                  <p className="text-xs text-slate-500 font-mono tabular-nums">
                    Ref {confirmedBooking.bookingReference}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center gap-3">
                {confirmedBooking.qrCodeToken && (
                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <QRCodeSVG
                      value={confirmedBooking.qrCodeToken}
                      size={168}
                      level="M"
                    />
                  </div>
                )}
                <p className="text-xs text-slate-600 text-center">
                  Signed QR Entry Pass issued. Present this at venue gate.
                </p>
              </div>

              <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
                {confirmedBooking.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-slate-700">
                    <span>
                      {item.section}
                      {item.row && item.row !== 'GA' ? ` · Row ${item.row}` : ''} ·{' '}
                      {item.seatNumber}
                    </span>
                    <span className="font-mono tabular-nums">${item.unitPrice}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold text-sm text-slate-900 pt-2 border-t border-slate-100">
                  <span>Total Paid</span>
                  <span className="font-mono tabular-nums">
                    ${confirmedBooking.totalAmount}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={onViewTickets}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Open in My Tickets
                </button>
                {lastProviderEventId && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleSimulateDuplicateWebhook}
                    className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg transition-colors"
                  >
                    Test Duplicate Webhook Idempotency
                  </button>
                )}
              </div>
            </div>
          ) : activeBooking ? (
            <div className="space-y-5">
              {/* Active Lock Timer */}
              <div className="flex items-center justify-between p-3.5 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center gap-2 text-blue-900">
                  <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-xs font-semibold">Seat Hold Active</span>
                </div>
                <span className="font-mono text-sm font-bold text-blue-700 tabular-nums">
                  {secondsLeft !== null ? formatCountdown(secondsLeft) : '10:00'}
                </span>
              </div>

              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Checkout Reservation
                </h2>
                <p className="text-xs text-slate-500 font-mono">
                  {activeBooking.bookingReference}
                </p>
              </div>

              <div className="space-y-2 text-sm border-y border-slate-100 py-3">
                {activeBooking.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-slate-700 text-xs">
                    <span>
                      {item.section}
                      {item.row && item.row !== 'GA' ? ` · Row ${item.row}` : ''} ·{' '}
                      {item.seatNumber}
                    </span>
                    <span className="font-mono tabular-nums">${item.unitPrice}</span>
                  </div>
                ))}
              </div>

              {/* Promo Code */}
              {!paymentIntentId && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-slate-400" />
                    Promo Code
                    {event.promoCodes && event.promoCodes.length > 0 && (
                      <span className="text-slate-400 font-normal">
                        (try {event.promoCodes[0].code})
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                    placeholder="EARLY20"
                    className="w-full px-3 py-2 text-xs font-mono uppercase border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              )}

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600 text-xs">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums">
                    ${activeBooking.subtotalAmount}
                  </span>
                </div>
                {activeBooking.discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-700 text-xs">
                    <span>Discount ({activeBooking.promoCode})</span>
                    <span className="font-mono tabular-nums">
                      -${activeBooking.discountAmount}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-slate-900 pt-1">
                  <span>Total</span>
                  <span className="font-mono tabular-nums">
                    ${activeBooking.totalAmount} {activeBooking.currency}
                  </span>
                </div>
              </div>

              {!paymentIntentId ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleCreateCheckoutIntent}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {submitting ? 'Preparing checkout...' : 'Proceed to Payment'}
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleReleaseLock}
                    className="w-full py-2 px-4 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Release Hold & Change Seats
                  </button>
                </div>
              ) : (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                    <div className="font-medium text-slate-800">
                      Sandbox Payment Gateway Ready
                    </div>
                    <div className="font-mono text-slate-500 truncate">
                      Intent: {paymentIntentId}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleSandboxPay}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    {submitting
                      ? 'Confirming Webhook...'
                      : `Pay $${activeBooking.totalAmount} & Issue QR`}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Your Selection
                </h2>
                <p className="text-xs text-slate-500">
                  Select seats on the map or choose ticket tiers to start a 10-minute hold.
                </p>
              </div>

              {totalSelectedCount === 0 ? (
                <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
                  No seats or passes selected yet
                </div>
              ) : (
                <div className="space-y-2.5 text-xs border-y border-slate-100 py-3 max-h-56 overflow-y-auto">
                  {selectedSeatIds.map((id) => {
                    const seat = seats.find((s) => s._id === id);
                    if (!seat) return null;
                    return (
                      <div key={id} className="flex items-center justify-between text-slate-700">
                        <span>
                          {seat.section} · Row {seat.row} · Seat {seat.seatNumber}
                        </span>
                        <span className="font-mono tabular-nums">${seat.price}</span>
                      </div>
                    );
                  })}
                  {Object.entries(tierQuantities)
                    .filter(([, q]) => q > 0)
                    .map(([sec, qty]) => {
                      const tier = tierSummary.find((t) => t.section === sec);
                      return (
                        <div key={sec} className="flex items-center justify-between text-slate-700">
                          <span>
                            {qty}× {sec}
                          </span>
                          <span className="font-mono tabular-nums">
                            ${(tier?.price || 0) * qty}
                          </span>
                        </div>
                      );
                    })}
                </div>
              )}

              <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
                <span>Estimated Total</span>
                <span className="font-mono tabular-nums">
                  ${draftTotal} {event.seatMapConfig.currency}
                </span>
              </div>

              <button
                type="button"
                disabled={totalSelectedCount === 0 || submitting}
                onClick={handleLockSeats}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                {submitting
                  ? 'Locking Seats...'
                  : user
                    ? `Hold ${totalSelectedCount || ''} ${totalSelectedCount === 1 ? 'Seat' : 'Seats'} (10:00)`
                    : 'Sign In to Hold Seats'}
              </button>
            </div>
          )}
        </aside>
      </div>

      {/* Lock Expiration Modal */}
      {lockExpiredModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="font-display text-lg font-semibold text-slate-900">
                Seat Hold Expired
              </h3>
              <button
                type="button"
                onClick={() => setLockExpiredModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Your 10-minute reservation hold timed out and those seats have been automatically released back to public availability.
            </p>
            <button
              type="button"
              onClick={() => setLockExpiredModalOpen(false)}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Select Seats Again
            </button>
          </div>
        </div>
      )}
    </main>
  );
};
