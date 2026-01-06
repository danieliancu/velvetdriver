'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Search, Star } from 'lucide-react';
import AdminPageHeader from '@/components/AdminPageHeader';

type Review = {
  id: number;
  refNo: string;
  journeyId?: number | null;
  reviewerName?: string | null;
  reviewerEmail?: string | null;
  rating: number;
  review: string;
  source: string;
  createdAt: string;
};

const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

const AdminReviewsPage: React.FC = () => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/reviews', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { reviews: Review[] };
        setRecords(data.reviews || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load reviews');
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
      const haystack = `${r.refNo} ${r.reviewerName || ''} ${r.reviewerEmail || ''} ${r.review} ${r.rating}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query, records]);

  const toggle = (ref: string) => setExpanded((prev) => ({ ...prev, [ref]: !prev[ref] }));

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="w-full flex-grow p-4 sm:p-6 md:p-8">
        <div className="max-w-6xl mx-auto w-full space-y-8">
          <AdminPageHeader active="reviews" />

          <main className="w-full space-y-4">
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by ref, name, email or text..."
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-10 py-3 text-white placeholder-gray-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Reviews</h2>
                  <p className="text-sm text-gray-400">Click a row to view details.</p>
                </div>
              </div>

              {error ? (
                <div className="rounded-lg border border-red-500/50 bg-red-950/40 text-red-200 px-4 py-3 text-sm">
                  {error}
                </div>
              ) : null}
              {loading ? <div className="text-sm text-gray-400">Loading reviews...</div> : null}

              <div className="space-y-3">
                {filtered.map((r) => {
                  const isOpen = expanded[r.refNo];
                  return (
                    <div
                      key={r.id}
                      className="rounded-xl border border-amber-900/40 bg-gradient-to-br from-[#1A0B0B] via-[#0F0909] to-black shadow-lg shadow-black/30"
                    >
                      <button
                        type="button"
                        onClick={() => toggle(r.refNo)}
                        className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left"
                      >
                        <div className="flex flex-wrap gap-4 text-sm text-amber-100">
                          <span className="font-semibold">
                            Ref. no.: <span className="text-amber-300">{r.refNo}</span>
                          </span>
                          <span>
                            Rating:{' '}
                            <span className="inline-flex items-center gap-1 text-amber-200">
                              <Star size={14} className="fill-amber-400 text-amber-400" />
                              {r.rating}
                            </span>
                          </span>
                          <span>
                            Date: <span className="text-amber-200">{formatDateTime(r.createdAt)}</span>
                          </span>
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
                                value={r.reviewerName || 'N/A'}
                                readOnly
                              />
                            </div>
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Email</label>
                              <input
                                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white"
                                value={r.reviewerEmail || 'N/A'}
                                readOnly
                              />
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Source</label>
                              <input
                                className="w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-sm text-white/80"
                                value={r.source}
                                readOnly
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Review Text</label>
                              <textarea
                                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white"
                                rows={3}
                                value={r.review}
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
                  <div className="text-sm text-gray-400">No reviews found.</div>
                ) : null}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminReviewsPage;
