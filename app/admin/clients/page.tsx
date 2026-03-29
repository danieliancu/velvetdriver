'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import AdminPageHeader from '@/components/AdminPageHeader';

type ClientBooking = {
  id: number;
  purchasedAt: string | null;
  journeyDate: string | null;
  pickup: string;
  destination: string;
  price: number;
  status: string;
};

type ClientRecord = {
  id: number;
  name: string;
  email: string;
  phone: string;
  status: string;
  bookingCount: number;
  firstPurchaseAt: string | null;
  lastPurchaseAt: string | null;
  bookings: ClientBooking[];
};

const formatDateTime = (iso?: string | null, emptyLabel = 'No bookings yet') => {
  if (!iso) return emptyLabel;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Invalid date';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

const formatMoney = (value: number) => `GBP ${Number(value || 0).toFixed(2)}`;

const AdminClientsPage: React.FC = () => {
  const [records, setRecords] = useState<ClientRecord[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/clients', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { clients: ClientRecord[] };
        setRecords(data.clients || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load clients');
        setRecords([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return records;
    const q = query.toLowerCase();
    return records.filter((client) => {
      const bookingText = client.bookings
        .map((booking) => `${booking.pickup} ${booking.destination} ${booking.status}`)
        .join(' ');
      const haystack = `${client.name} ${client.email} ${client.phone} ${client.status} ${bookingText}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query, records]);

  const toggle = (id: number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="w-full flex-grow p-4 sm:p-6 md:p-8">
        <div className="max-w-6xl mx-auto w-full space-y-8">
          <AdminPageHeader active="clients" />

          <main className="w-full space-y-4">
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by client, email, phone or booking..."
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-10 py-3 text-white placeholder-gray-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Clients</h2>
                  <p className="text-sm text-gray-400">Registered clients and when they purchased journeys.</p>
                </div>
                <div className="text-sm text-gray-400">{filtered.length} client(s)</div>
              </div>

              {error ? (
                <div className="rounded-lg border border-red-500/50 bg-red-950/40 text-red-200 px-4 py-3 text-sm">
                  {error}
                </div>
              ) : null}
              {loading ? <div className="text-sm text-gray-400">Loading clients...</div> : null}

              <div className="space-y-3">
                {filtered.map((client) => {
                  const isOpen = Boolean(expanded[client.id]);
                  return (
                    <div
                      key={client.id}
                      className="rounded-xl border border-amber-900/40 bg-gradient-to-br from-[#120909] via-[#0F0909] to-black shadow-lg shadow-black/30"
                    >
                      <button
                        type="button"
                        onClick={() => toggle(client.id)}
                        className="w-full flex items-center justify-between gap-4 px-4 py-4 text-left"
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap gap-4 text-sm text-amber-100">
                            <span className="font-semibold">
                              Client: <span className="text-amber-300">{client.name}</span>
                            </span>
                            <span>
                              Email: <span className="text-amber-200">{client.email}</span>
                            </span>
                            <span>
                              Journeys: <span className="text-amber-200">{client.bookingCount}</span>
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-4 text-xs text-gray-300">
                            <span>Phone: {client.phone || 'N/A'}</span>
                            <span>First purchase: {formatDateTime(client.firstPurchaseAt)}</span>
                            <span>Last purchase: {formatDateTime(client.lastPurchaseAt)}</span>
                          </div>
                        </div>
                        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>

                      {isOpen ? (
                        <div className="border-t border-amber-900/30 px-4 pb-4 pt-3 space-y-4">
                          <div className="grid gap-3 sm:grid-cols-4">
                            <div>
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Name</label>
                              <input
                                readOnly
                                value={client.name}
                                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Email</label>
                              <input
                                readOnly
                                value={client.email}
                                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Phone</label>
                              <input
                                readOnly
                                value={client.phone || 'N/A'}
                                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Status</label>
                              <input
                                readOnly
                                value={client.status}
                                className="w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-sm text-white/80"
                              />
                            </div>
                          </div>

                          <div className="rounded-xl border border-white/10 bg-black/30 overflow-hidden">
                            <div className="overflow-x-auto">
                              <div className="min-w-[980px]">
                                <div className="grid grid-cols-[120px_170px_170px_1fr_1fr_120px_120px] gap-3 border-b border-white/10 px-4 py-3 text-[11px] uppercase tracking-[0.2em] text-gray-400">
                                  <span>Ref</span>
                                  <span>Purchased</span>
                                  <span>Journey date</span>
                                  <span>Pickup</span>
                                  <span>Destination</span>
                                  <span>Price</span>
                                  <span>Status</span>
                                </div>
                                {client.bookings.length === 0 ? (
                                  <div className="px-4 py-4 text-sm text-gray-400">This client has not purchased any journey yet.</div>
                                ) : (
                                  client.bookings.map((booking, index) => (
                                    <div
                                      key={booking.id}
                                      className={`grid grid-cols-[120px_170px_170px_1fr_1fr_120px_120px] gap-3 px-4 py-3 text-sm ${
                                        index > 0 ? 'border-t border-white/10' : ''
                                      }`}
                                    >
                                      <span className="text-amber-300">VD-{String(booking.id).padStart(4, '0')}</span>
                                      <span className="text-gray-200">{formatDateTime(booking.purchasedAt)}</span>
                                      <span className="text-gray-200">{formatDateTime(booking.journeyDate, '-')}</span>
                                      <span className="text-white">{booking.pickup || '-'}</span>
                                      <span className="text-white">{booking.destination || '-'}</span>
                                      <span className="text-gray-200">{formatMoney(booking.price)}</span>
                                      <span className="text-gray-200">{booking.status || '-'}</span>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
                {!loading && !error && filtered.length === 0 ? (
                  <div className="text-sm text-gray-400">No clients found.</div>
                ) : null}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminClientsPage;
