import React, { useCallback, useEffect, useState } from 'react';
import { ApiClientError, apiRequest } from '../api/client.ts';
import { useToast } from '../context/ToastContext.tsx';
import type {
  AuditLogEntry,
  BookingRecord,
  EventItem,
  UserProfile,
  WebhookEventLog,
} from '../types/api.ts';

type AdminTab = 'moderation' | 'bookings' | 'webhooks' | 'audit';

interface AdminOverviewResponse {
  metrics: {
    grossVolume: number;
    confirmedBookings: number;
    totalEvents: number;
    pendingApprovals: number;
  };
  organizers: Array<UserProfile & { _id: string }>;
  events: EventItem[];
  bookings: BookingRecord[];
  webhookEvents: WebhookEventLog[];
  auditLogs: AuditLogEntry[];
}

export const AdminPanel: React.FC = () => {
  const { showToast } = useToast();
  const [tab, setTab] = useState<AdminTab>('moderation');
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<AdminOverviewResponse>('/api/admin/overview');
      setData(res);
    } catch (err) {
      showToast(
        err instanceof ApiClientError ? err.message : 'Unable to load admin overview',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleOrganizerStatus = async (
    organizerId: string,
    status: 'approved' | 'suspended'
  ) => {
    try {
      await apiRequest(`/api/admin/organizers/${organizerId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      showToast(`Organizer marked as ${status}.`, 'success');
      await loadOverview();
    } catch (err) {
      showToast(
        err instanceof ApiClientError ? err.message : 'Failed to update organizer',
        'error'
      );
    }
  };

  const handleEventModeration = async (
    eventId: string,
    approvalStatus: 'approved' | 'rejected'
  ) => {
    try {
      await apiRequest(`/api/admin/events/${eventId}/moderation`, {
        method: 'PATCH',
        body: JSON.stringify({ approvalStatus }),
      });
      showToast(`Event ${approvalStatus}.`, 'success');
      await loadOverview();
    } catch (err) {
      showToast(
        err instanceof ApiClientError ? err.message : 'Failed to moderate event',
        'error'
      );
    }
  };

  if (loading || !data) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div className="h-8 w-56 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-24 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
            Platform Governance
          </h1>
          <p className="text-sm text-slate-600">
            Vendor moderation, platform-wide bookings, idempotent webhook logs, and audit history.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start overflow-x-auto">
          {(
            [
              ['moderation', 'Moderation'],
              ['bookings', 'Bookings'],
              ['webhooks', 'Webhook Logs'],
              ['audit', 'Audit Trail'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                tab === key
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Platform KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Gross Platform Volume</p>
          <p className="mt-1 text-2xl font-bold font-mono text-slate-900 tabular-nums">
            ${data.metrics.grossVolume.toLocaleString()}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Confirmed Bookings</p>
          <p className="mt-1 text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {data.metrics.confirmedBookings}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Published & Draft Events</p>
          <p className="mt-1 text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {data.metrics.totalEvents}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Pending Approvals</p>
          <p className="mt-1 text-2xl font-bold font-mono text-amber-700 tabular-nums">
            {data.metrics.pendingApprovals}
          </p>
        </div>
      </section>

      {tab === 'moderation' && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Organizers */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Registered Organizers ({data.organizers.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {data.organizers.map((org) => (
                <div
                  key={org._id}
                  className="p-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {org.organizationName || org.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {org.name} · {org.email} · Status:{' '}
                      <span className="font-medium text-slate-800">
                        {org.organizerStatus}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {org.organizerStatus !== 'approved' && (
                      <button
                        type="button"
                        onClick={() => handleOrganizerStatus(org._id, 'approved')}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                      >
                        Approve
                      </button>
                    )}
                    {org.organizerStatus !== 'suspended' && (
                      <button
                        type="button"
                        onClick={() => handleOrganizerStatus(org._id, 'suspended')}
                        className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg"
                      >
                        Suspend
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Events Moderation */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Event Listings Moderation ({data.events.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {data.events.map((ev) => (
                <div
                  key={ev._id}
                  className="p-4 flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {ev.title}
                    </div>
                    <div className="text-xs text-slate-500">
                      {ev.organizerId?.organizationName || ev.organizerId?.name} ·{' '}
                      {ev.category} · Approval:{' '}
                      <span className="font-medium text-slate-800">
                        {ev.approvalStatus}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {ev.approvalStatus !== 'approved' && (
                      <button
                        type="button"
                        onClick={() => handleEventModeration(ev._id, 'approved')}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                      >
                        Approve
                      </button>
                    )}
                    {ev.approvalStatus !== 'rejected' && (
                      <button
                        type="button"
                        onClick={() => handleEventModeration(ev._id, 'rejected')}
                        className="px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg"
                      >
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === 'bookings' && (
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Platform Bookings Ledger
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-medium">Reference</th>
                  <th className="py-3 px-4 font-medium">Event</th>
                  <th className="py-3 px-4 font-medium">Attendee</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium text-right">Seats</th>
                  <th className="py-3 px-4 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.bookings.map((b) => {
                  const buyer = b.userId as { name?: string; email?: string };
                  const ev = b.eventId as { title?: string };
                  return (
                    <tr key={b._id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                        {b.bookingReference}
                      </td>
                      <td className="py-3 px-4 text-slate-800">{ev?.title || '—'}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {buyer?.email || buyer?.name}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {b.checkedInAt ? 'checked_in' : b.status}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {b.items.length}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium">
                        ${b.totalAmount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'webhooks' && (
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Payment Webhook Events (Idempotency Store)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-medium">Provider Event ID</th>
                  <th className="py-3 px-4 font-medium">Event Type</th>
                  <th className="py-3 px-4 font-medium">Payment Intent</th>
                  <th className="py-3 px-4 font-medium">Signature</th>
                  <th className="py-3 px-4 font-medium">Processed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.webhookEvents.map((w) => (
                  <tr key={w._id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">
                      {w.providerEventId}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-700">
                      {w.eventType}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {w.paymentIntentId || '—'}
                    </td>
                    <td className="py-3 px-4 text-emerald-700 font-medium">
                      {w.signatureVerified ? 'HMAC Verified' : 'Unverified'}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-500">
                      {new Date(w.processedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'audit' && (
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Platform Audit Trail
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-medium">Timestamp</th>
                  <th className="py-3 px-4 font-medium">Action</th>
                  <th className="py-3 px-4 font-medium">Actor</th>
                  <th className="py-3 px-4 font-medium">Target</th>
                  <th className="py-3 px-4 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.auditLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-900">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {log.actorEmail || log.actorRole}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {log.targetType}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 max-w-xs truncate">
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
};
