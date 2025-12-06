'use client';

import React, { useMemo, useState } from 'react';
import type { Journey, SavedQuote } from '@/types';

const StatusBadge: React.FC<{ status: Journey['status'] }> = ({ status }) => {
  const baseClasses = 'px-2 py-1 text-xs font-semibold rounded-full';
  const statusClasses = {
    Completed: 'bg-green-500/20 text-green-300',
    Upcoming: 'bg-yellow-500/20 text-yellow-300',
    Cancelled: 'bg-red-500/20 text-red-300',
  };
  return <span className={`${baseClasses} ${statusClasses[status]}`}>{status}</span>;
};

type FilterStatus = 'All' | 'Completed' | 'Upcoming' | 'Saved';

interface Props {
  journeys: Journey[];
  loading?: boolean;
  savedQuotes?: SavedQuote[];
  savedLoading?: boolean;
  onSelectSaved?: (quoteId: SavedQuote['id']) => void;
  onDeleteSaved?: (quoteId: SavedQuote['id']) => void;
  deletingSavedId?: SavedQuote['id'] | null;
}

const ClientHistory: React.FC<Props> = ({
  journeys,
  loading = false,
  savedQuotes = [],
  savedLoading = false,
  onSelectSaved,
  onDeleteSaved,
  deletingSavedId = null,
}) => {
  const [filter, setFilter] = useState<FilterStatus>('Upcoming');
  const [query, setQuery] = useState('');

  const filteredJourneys = useMemo(() => {
    if (filter === 'Saved') {
      return journeys;
    }
    return journeys.filter((journey) => {
      const matchesStatus = filter === 'All' ? true : journey.status === filter;
      const search = query.trim().toLowerCase();
      const matchesQuery = !search
        ? true
        : `${journey.pickup} ${journey.destination} ${journey.driver} ${journey.car}`
            .toLowerCase()
            .includes(search);
      return matchesStatus && matchesQuery;
    });
  }, [journeys, filter, query]);

  const FilterButton: React.FC<{ status: FilterStatus }> = ({ status }) => (
    <button
      onClick={() => setFilter(status)}
      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
        filter === status ? 'bg-amber-400/90 text-black' : 'bg-gray-700/50 text-amber-300 hover:bg-gray-600/50'
      }`}
    >
      {status}
    </button>
  );

  const renderSavedQuotes = () => {
    if (savedLoading) {
      return (
        <div className="rounded-xl border border-gray-700/80 bg-black/30 p-6 text-center text-sm text-gray-400">
          Loading saved quotes...
        </div>
      );
    }
    if (!savedQuotes.length) {
      return (
        <div className="rounded-xl border border-gray-700/80 bg-black/30 p-6 text-center text-sm text-gray-400">
          You have no saved quotes yet.
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {savedQuotes.map((quote) => {
          const payload = quote.payload || {};
          const pickup = payload.pickup || 'Pickup TBD';
          const dropOffs: string[] = Array.isArray(payload.dropOffs) ? payload.dropOffs.filter(Boolean) : payload.dropOff ? [payload.dropOff] : [];
          const primaryDrop = dropOffs[0] || 'Drop-off TBD';
          const iso = payload.date && payload.time ? `${payload.date}T${payload.time}` : payload.date;
          let formatted = null;
          if (iso) {
            const date = new Date(iso);
            if (!Number.isNaN(date.getTime())) {
              formatted = date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            }
          } else if (quote.createdAt) {
            const created = new Date(quote.createdAt);
            if (!Number.isNaN(created.getTime())) {
              formatted = created.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            }
          }

          const detailItems = [
            { label: 'Service', value: payload.serviceType || 'Transfer' },
            { label: 'Vehicle', value: payload.vehicle || 'Executive' },
            { label: 'Passengers', value: payload.passengers || '1' },
            {
              label: 'Suitcases',
              value: `${payload.smallSuitcases || 0} small / ${payload.largeSuitcases || 0} large`,
            },
            { label: 'Miles', value: payload.miles ? `${payload.miles} mi` : 'Auto' },
            { label: 'Waiting', value: payload.waiting ? `${payload.waiting} min` : '0 min' },
          ];

          return (
            <div key={quote.id} className="rounded-2xl border border-amber-900/40 bg-gray-900/40 px-4 py-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-amber-200">{quote.label || `${pickup} -> ${primaryDrop}`}</p>
                  {formatted ? <p className="text-xs text-gray-400">{formatted}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectSaved?.(quote.id)}
                    className="px-3 py-1 text-xs font-semibold rounded-md bg-amber-500/80 text-black hover:bg-amber-400/80 transition-colors disabled:opacity-60"
                    disabled={!onSelectSaved}
                  >
                    Load in Booking
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSaved?.(quote.id)}
                    className="px-3 py-1 text-xs font-semibold rounded-md border border-red-500/60 text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    disabled={!onDeleteSaved || deletingSavedId === quote.id}
                  >
                    {deletingSavedId === quote.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
              <div className="text-sm text-gray-300">
                {pickup} <span className="text-gray-500">-&gt;</span> {primaryDrop}
                {dropOffs.length > 1 ? (
                  <div className="mt-1 text-xs text-gray-400">
                    {dropOffs.slice(1).map((stop, idx) => (
                      <div key={stop + idx}>Stop {idx + 2}: {stop}</div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-gray-300">
                {detailItems.map((item) => (
                  <div key={item.label}>
                    <p className="uppercase tracking-wide text-[10px] text-gray-500">{item.label}</p>
                    <p className="font-semibold text-amber-100/90">{item.value}</p>
                  </div>
                ))}
              </div>
              {(payload.specialEvents || payload.notes) && (
                <div className="text-xs text-gray-400 space-y-2">
                  {payload.specialEvents ? (
                    <p><span className="text-amber-200 font-semibold">Special events:</span> {payload.specialEvents}</p>
                  ) : null}
                  {payload.notes ? (
                    <p><span className="text-amber-200 font-semibold">Notes:</span> {payload.notes}</p>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
        <h2 className="text-2xl font-semibold font-display text-amber-300">Journey History</h2>
        <div className="flex items-center gap-2">
          <FilterButton status="Upcoming" />
          <FilterButton status="Completed" />
          <FilterButton status="All" />
          <FilterButton status="Saved" />
        </div>
      </div>
      {filter !== 'Saved' ? (
        <div className="relative mb-6">
          <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
            </svg>
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by Pickup, Destination, Driver, Car"
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-10 py-3 text-white placeholder-gray-500 focus:border-amber-400 focus:outline-none"
          />
        </div>
      ) : null}

      {filter === 'Saved' ? (
        renderSavedQuotes()
      ) : (
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-left">
            <thead className="bg-gray-800/60">
              <tr>
                <th className="p-4">Ref. no.</th>
                <th className="p-4">Date & Time</th>
                <th className="p-4">Pickup</th>
                <th className="p-4">Destination</th>
                <th className="p-4">Service</th>
                <th className="p-4">Driver</th>
                <th className="p-4">Car</th>
                <th className="p-4">Plate</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Price</th>
                <th className="p-4">Invoice</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} className="text-center p-8 text-gray-400">
                    Loading journeys...
                  </td>
                </tr>
              ) : filteredJourneys.length > 0 ? (
                filteredJourneys.map((journey, index) => (
                  <tr key={journey.id} className={`border-t border-gray-800 ${index % 2 === 0 ? 'bg-black/20' : ''}`}>
                    <td className="p-4 align-top font-semibold text-amber-200">VD_{journey.id}</td>
                    <td className="p-4 align-top">{journey.date}</td>
                    <td className="p-4 align-top">{journey.pickup}</td>
                    <td className="p-4 align-top">
                      {journey.destination.includes('Stop ')
                        ? journey.destination.split(', ').map((stop, i) => <div key={i}>{stop}</div>)
                        : journey.destination}
                    </td>
                    <td className="p-4 align-top">{journey.serviceType}</td>
                    <td className="p-4 align-top">{journey.driver}</td>
                    <td className="p-4 align-top">{journey.car}</td>
                    <td className="p-4 align-top">{journey.plate}</td>
                    <td className="p-4 align-top">
                      <StatusBadge status={journey.status} />
                    </td>
                    <td className="p-4 align-top text-right font-semibold">£{journey.price.toFixed(2)}</td>
                    <td className="p-4 align-top">
                      {journey.invoiceUrl ? (
                        <a
                          href={journey.invoiceUrl}
                          className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-amber-500/15 text-amber-200 border border-amber-400/40 hover:bg-amber-500/25 transition-colors"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Download
                        </a>
                      ) : (
                        <span className="text-xs text-gray-500">Not available</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="text-center p-8 text-gray-400">
                    No {filter !== 'All' ? filter.toLowerCase() : ''} journeys found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
};

export default ClientHistory;
