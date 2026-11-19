import React, { useEffect, useState } from 'react';
import { Search, Calendar, MapPin, ArrowRight } from 'lucide-react';
import { apiRequest } from '../api/client.ts';
import type { EventItem } from '../types/api.ts';
import { EventArtwork } from './EventArtwork.tsx';

interface DiscoveryPageProps {
  onSelectEvent: (eventId: string) => void;
}

const CATEGORIES = ['All', 'Concert', 'Festival', 'Conference', 'Theater'] as const;
const DATE_FILTERS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
] as const;

export const DiscoveryPage: React.FC<DiscoveryPageProps> = ({ onSelectEvent }) => {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('All');
  const [dateFilter, setDateFilter] = useState<string>('upcoming');

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set('search', search.trim());
        if (category !== 'All') params.set('category', category);
        if (dateFilter) params.set('date', dateFilter);

        const data = await apiRequest<{ events: EventItem[] }>(
          `/api/events?${params.toString()}`,
          { auth: false, signal: controller.signal }
        );
        if (active) setEvents(data.events);
      } catch (err) {
        if (active && (err as Error).name !== 'AbortError') {
          setError('Unable to load events right now.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    const timer = setTimeout(load, 180);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, category, dateFilter]);

  const formatEventDate = (iso: string) =>
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10">
      {/* Storefront Hero */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10">
        <div className="max-w-3xl space-y-4">
          <p className="text-xs font-medium tracking-wide text-slate-500">
            Verified Multi-Vendor Box Office · Real-Time Seat Holds
          </p>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 text-balance leading-[1.12]">
            Reserve exact seats for concerts, theater, and technical summits.
          </h1>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
            Every seat selection locks atomically for 10 minutes while you complete checkout, issuing a cryptographically signed QR pass ready for venue admission.
          </p>
        </div>

        {/* Search & Filter Controls */}
        <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events, venues, or cities..."
              aria-label="Search events"
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              role="group"
              aria-label="Event category filter"
              className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto"
            >
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    category === cat
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div
              role="group"
              aria-label="Date range filter"
              className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
            >
              {DATE_FILTERS.map((df) => (
                <button
                  key={df.key}
                  type="button"
                  onClick={() => setDateFilter(df.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    dateFilter === df.key
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {df.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Featured Events Grid */}
      <section aria-label="Published events">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="font-display text-2xl font-semibold text-slate-900">
            Available Events
          </h2>
          {!loading && (
            <span className="text-sm text-slate-500 tabular-nums">
              {events.length} {events.length === 1 ? 'event' : 'events'} listed
            </span>
          )}
        </div>

        {error && (
          <div className="bg-white border border-red-200 rounded-xl p-6 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden animate-pulse"
              >
                <div className="aspect-4/3 bg-slate-200" />
                <div className="p-5 space-y-3">
                  <div className="h-3 w-32 bg-slate-200 rounded" />
                  <div className="h-5 w-3/4 bg-slate-200 rounded" />
                  <div className="h-4 w-1/2 bg-slate-200 rounded" />
                  <div className="pt-3 border-t border-slate-100 flex justify-between">
                    <div className="h-4 w-20 bg-slate-200 rounded" />
                    <div className="h-8 w-28 bg-slate-200 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
            <p className="text-base font-semibold text-slate-900">
              No matching events found
            </p>
            <p className="text-sm text-slate-500">
              Adjust your search terms or reset the category and date filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setCategory('All');
                setDateFilter('upcoming');
              }}
              className="mt-2 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => {
              const available = event.availability?.availableSeats ?? 0;
              const minPrice = event.availability?.minPrice ?? 0;
              return (
                <article
                  key={event._id}
                  onClick={() => onSelectEvent(event._id)}
                  className="group cursor-pointer bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="aspect-4/3 w-full overflow-hidden bg-slate-900">
                    <EventArtwork
                      theme={event.artworkTheme}
                      venueName={event.venueName}
                      className="w-full h-full transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      {/* Clean unboxed metadata */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">
                          {event.category}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{event.city}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums shrink-0">
                          {available} left
                        </span>
                      </div>

                      <h3 className="font-display text-lg font-semibold text-slate-900 leading-snug group-hover:text-blue-700 transition-colors">
                        {event.title}
                      </h3>

                      <div className="space-y-1 text-xs text-slate-600 pt-1">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="tabular-nums">
                            {formatEventDate(event.startDate)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {event.venueName}
                            {event.organizerId?.organizationName
                              ? ` · ${event.organizerId.organizationName}`
                              : ''}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-xs text-slate-500 block">
                          Starting from
                        </span>
                        <span className="text-base font-semibold text-slate-900 font-mono tabular-nums">
                          ${minPrice}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEvent(event._id);
                        }}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-slate-900 group-hover:bg-blue-600 rounded-lg transition-colors whitespace-nowrap shrink-0"
                      >
                        Select Seats
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
};
