'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import AdminPageHeader from '@/components/AdminPageHeader';

type LostItem = {
  id: number;
  refNo: string;
  journeyId?: number | null;
  handedInBy?: string | null;
  receivedAt?: string | null;
  bookingDateTime?: string | null;
  customerName: string;
  customerEmail?: string;
  customerAddress: string;
  customerPhone: string;
  itemDescription: string;
  details: string;
  returnMethod?: string | null;
  result?: string | null;
  representative?: string | null;
  status: string;
  source: string;
  createdAt: string;
};

const formatDateTime = (iso?: string | null) =>
  iso
    ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
    : 'Not provided';

const AdminLostPropertyPage: React.FC = () => {
  const [records, setRecords] = useState<LostItem[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/lost-property', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { items: LostItem[] };
        setRecords(data.items || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load lost property');
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
    return records.filter((r) => {
      const haystack = `${r.refNo} ${r.customerName} ${r.customerEmail || ''} ${r.itemDescription} ${r.details} ${r.status}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query, records]);

  const toggle = (ref: string) => setExpanded((prev) => ({ ...prev, [ref]: !prev[ref] }));

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="w-full flex-grow p-4 sm:p-6 md:p-8">
        <div className="max-w-6xl mx-auto w-full space-y-8">
          <AdminPageHeader active="lost-property" />

          <main className="w-full space-y-4">
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by ref, name or text..."
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-10 py-3 text-white placeholder-gray-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Lost/Found Property</h2>
                  <p className="text-sm text-gray-400">Click a row to review return handling.</p>
                </div>
              </div>

              {error ? (
                <div className="rounded-lg border border-red-500/50 bg-red-950/40 text-red-200 px-4 py-3 text-sm">
                  {error}
                </div>
              ) : null}
              {loading ? <div className="text-sm text-gray-400">Loading reports...</div> : null}

              <div className="space-y-3">
                {filtered.map((r) => {
                  const isOpen = expanded[r.refNo];
                  return (
                    <div
                      key={r.id}
                      className="rounded-xl border border-amber-900/40 bg-gradient-to-br from-[#0F0A0A] via-[#120707] to-black shadow-lg shadow-black/30"
                    >
                      <button
                        type="button"
                        onClick={() => toggle(r.refNo)}
                        className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left"
                      >
                        <div className="flex flex-wrap gap-4 text-sm text-amber-100">
                          <span className="font-semibold">Ref.no: <span className="text-amber-300">{r.refNo}</span></span>
                          <span>Source: <span className="text-amber-200">{r.source}</span></span>
                          <span>Date received: <span className="text-amber-200">{formatDateTime(r.createdAt)}</span></span>
                        </div>
                        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 pt-2 space-y-4 border-t border-amber-900/30">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Name</label>
                              <input
                                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white"
                                value={r.customerName}
                                readOnly
                              />
                            </div>
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Address</label>
                              <input
                                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white"
                                value={r.customerAddress}
                                readOnly
                              />
                            </div>
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Phone No</label>
                              <input
                                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white"
                                value={r.customerPhone}
                                readOnly
                              />
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Email</label>
                              <input
                                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white"
                                value={r.customerEmail || 'N/A'}
                                readOnly
                              />
                            </div>
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Booking</label>
                              <input
                                className="w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-sm text-white/80"
                                value={r.bookingDateTime || 'Not provided'}
                                readOnly
                              />
                            </div>
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Status</label>
                              <input
                                className="w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-sm text-white/80"
                                value={r.status}
                                readOnly
                              />
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Handed in By</label>
                              <input
                                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white"
                                value={r.handedInBy || 'Not provided'}
                                readOnly
                              />
                            </div>
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Date received</label>
                              <input
                                className="w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-sm text-white/80"
                                value={formatDateTime(r.receivedAt)}
                                readOnly
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Details of Property</label>
                            <textarea
                              className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white"
                              rows={3}
                              value={r.details}
                              readOnly
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Method/Enquiry to return property</label>
                            <textarea
                              className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white"
                              rows={2}
                              value={r.returnMethod || 'Not provided'}
                              readOnly
                            />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Result</label>
                              <input
                                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white"
                                value={r.result || 'Pending'}
                                readOnly
                              />
                            </div>
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Company Representative Name</label>
                              <input
                                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white"
                                value={r.representative || 'Not provided'}
                                readOnly
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {!loading && !error && filtered.length === 0 ? (
                  <div className="text-sm text-gray-400">No lost property items found.</div>
                ) : null}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminLostPropertyPage;
