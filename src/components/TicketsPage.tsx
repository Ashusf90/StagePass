import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, Copy, MapPin, Printer, RotateCcw, Ticket, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { ApiClientError, apiRequest } from '../api/client.ts';
import { useToast } from '../context/ToastContext.tsx';
import type { BookingRecord, EventItem } from '../types/api.ts';

interface TicketsPageProps {
  onBrowseEvents: () => void;
}

export const TicketsPage: React.FC<TicketsPageProps> = ({ onBrowseEvents }) => {
  const { showToast } = useToast();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<BookingRecord | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<{ bookings: BookingRecord[] }>('/api/bookings/me');
      setBookings(data.bookings);
    } catch (err) {
      showToast(
        err instanceof ApiClientError ? err.message : 'Unable to load tickets',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const handleCopyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      showToast('Signed QR token copied to clipboard for gate check-in testing.', 'success');
    } catch {
      showToast('Could not copy token automatically.', 'error');
    }
  };

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await apiRequest(`/api/bookings/${cancelTarget._id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason || 'Schedule conflict' }),
      });
      showToast('Booking cancelled and seats returned to inventory.', 'success');
      setCancelTarget(null);
      setCancelReason('');
      await loadBookings();
    } catch (err) {
      showToast(
        err instanceof ApiClientError ? err.message : 'Unable to cancel booking',
        'error'
      );
    } finally {
      setCancelling(false);
    }
  };

  const statusLabel = (booking: BookingRecord) => {
    if (booking.status === 'confirmed' && booking.checkedInAt) {
      return { text: 'Checked In', color: 'text-slate-700 bg-slate-100 border-slate-200' };
    }
    switch (booking.status) {
      case 'confirmed':
        return { text: 'Confirmed', color: 'text-emerald-800 bg-emerald-50 border-emerald-200' };
      case 'pending_payment':
        return { text: 'Pending Hold', color: 'text-amber-800 bg-amber-50 border-amber-200' };
      case 'refunded':
        return { text: 'Refunded', color: 'text-slate-600 bg-slate-100 border-slate-200' };
      case 'expired':
        return { text: 'Expired', color: 'text-slate-500 bg-slate-100 border-slate-200' };
      default:
        return { text: booking.status, color: 'text-slate-600 bg-slate-100 border-slate-200' };
    }
  };

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            My Tickets & Passes
          </h1>
          <p className="text-sm text-slate-600">
            Present your signed QR code at the venue gate or manage eligible refunds.
          </p>
        </div>
        <button
          type="button"
          onClick={onBrowseEvents}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors self-start"
        >
          Browse More Events
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="h-48 bg-white border border-slate-200 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <Ticket className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-base font-semibold text-slate-900">No ticket passes yet</p>
          <p className="text-sm text-slate-500">
            Select seats on any published event to issue your verified QR ticket.
          </p>
          <button
            type="button"
            onClick={onBrowseEvents}
            className="mt-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Explore Events
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {bookings.map((booking) => {
            const ev = booking.eventId as Partial<EventItem>;
            const badge = statusLabel(booking);
            const canCancel =
              booking.status === 'confirmed' && !booking.checkedInAt;

            return (
              <article
                key={booking._id}
                className="bg-white border border-slate-200 rounded-2xl p-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center"
              >
                <div className="md:col-span-8 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                      <span className="font-semibold text-slate-800">
                        {booking.bookingReference}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {new Date(booking.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 text-xs font-medium rounded-md border ${badge.color}`}
                    >
                      {badge.text}
                    </span>
                  </div>

                  <div>
                    <h2 className="font-display text-xl font-semibold text-slate-900">
                      {ev?.title || 'Event'}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
                      {ev?.startDate && (
                        <span className="flex items-center gap-1.5 tabular-nums">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {new Intl.DateTimeFormat('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          }).format(new Date(ev.startDate))}
                        </span>
                      )}
                      {ev?.venueName && (
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {ev.venueName}, {ev.city}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 space-y-1.5">
                    <div className="text-xs font-medium text-slate-500">
                      Reserved Seats ({booking.items.length})
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-800 font-mono">
                      {booking.items.map((item, idx) => (
                        <span key={idx}>
                          {item.section}
                          {item.row && item.row !== 'GA' ? ` · ${item.row}` : ''} ·{' '}
                          {item.seatNumber} (${item.unitPrice})
                        </span>
                      ))}
                    </div>
                    <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
                      <span className="text-sm font-semibold text-slate-900 font-mono tabular-nums">
                        Total: ${booking.totalAmount} {booking.currency}
                      </span>

                      <div className="flex flex-wrap items-center gap-2">
                        {booking.qrCodeToken && booking.status === 'confirmed' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCopyToken(booking.qrCodeToken!)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5" />
                              Copy QR Token
                            </button>
                            <button
                              type="button"
                              onClick={() => window.print()}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Print Pass
                            </button>
                          </>
                        )}
                        {canCancel && (
                          <button
                            type="button"
                            onClick={() => setCancelTarget(booking)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Cancel & Refund
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right QR Code Display */}
                <div className="md:col-span-4 flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  {booking.status === 'confirmed' && booking.qrCodeToken ? (
                    <>
                      <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                        <QRCodeSVG
                          value={booking.qrCodeToken}
                          size={140}
                          level="M"
                        />
                      </div>
                      <p className="mt-2.5 text-xs text-slate-600 text-center font-mono">
                        {booking.checkedInAt
                          ? `Admitted ${new Date(booking.checkedInAt).toLocaleTimeString()}`
                          : 'Valid for Entry'}
                      </p>
                    </>
                  ) : (
                    <div className="py-8 text-center text-xs text-slate-500">
                      {booking.status === 'refunded'
                        ? `Refunded${booking.refundReason ? `: ${booking.refundReason}` : ''}`
                        : `QR unavailable (${booking.status})`}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Cancel / Refund Confirmation Modal */}
      {cancelTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleConfirmCancel}
            className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-start justify-between">
              <h3 className="font-display text-lg font-semibold text-slate-900">
                Cancel Booking {cancelTarget.bookingReference}
              </h3>
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              Cancelling this booking will issue a full refund of{' '}
              <span className="font-mono font-semibold text-slate-900">
                ${cancelTarget.totalAmount}
              </span>{' '}
              and immediately release your seats back to public availability.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Reason for cancellation (optional)
              </label>
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Unable to attend"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Keep Tickets
              </button>
              <button
                type="submit"
                disabled={cancelling}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-lg"
              >
                {cancelling ? 'Processing...' : 'Confirm Refund'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
};
