'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import AdminPageHeader from '@/components/AdminPageHeader';

type Complaint = {
  id: string;
  handledBy: string;
  receivedAt: string;
  complainant: {
    name: string;
    address: string;
    phone: string;
  };
  details: string;
  resolutionMethod: string;
  result: string;
  representative: string;
  signature: string;
};

const seedComplaints: Complaint[] = [
  {
    id: 'VD-1201',
    handledBy: 'Sarah Lewis',
    receivedAt: '2025-11-18T10:45:00Z',
    complainant: {
      name: 'John Carter',
      address: '221B Baker Street, London NW1',
      phone: '+44 7700 900111',
    },
    details: 'Passenger reported driver was 10 minutes late for Heathrow pickup. No safety concerns.',
    resolutionMethod: 'Offer partial refund and remind driver of punctuality SLA.',
    result: 'Pending review',
    representative: 'Sarah Lewis',
    signature: '',
  },
  {
    id: 'VD-1202',
    handledBy: 'David Nguyen',
    receivedAt: '2025-11-17T16:20:00Z',
    complainant: {
      name: 'Emily Stone',
      address: 'Apartment 12, 5 Limehouse Basin, E14',
      phone: '+44 7700 900222',
    },
    details: 'Compliment: driver was courteous and vehicle immaculate during City Airport transfer.',
    resolutionMethod: 'Log praise and notify driver manager.',
    result: 'Acknowledged',
    representative: 'David Nguyen',
    signature: 'D.N.',
  },
] as const;

const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );

const formatDateOnly = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(iso));

const formatTimeOnly = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeStyle: 'short' }).format(new Date(iso));

const AdminComplaintsPage: React.FC = () => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<Complaint[]>(seedComplaints);

  const filtered = useMemo(() => {
    if (!query.trim()) return records;
    const q = query.toLowerCase();
    return records.filter((c) => {
      const haystack = `${c.id} ${c.handledBy} ${c.complainant.name} ${c.details} ${c.result}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query, records]);

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const updateField = <K extends keyof Complaint>(id: string, key: K, value: Complaint[K]) => {
    setRecords((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [key]: value } : c)),
    );
  };

  const updateComplainant = (id: string, field: keyof Complaint['complainant'], value: string) => {
    setRecords((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, complainant: { ...c.complainant, [field]: value } } : c,
      ),
    );
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="w-full flex-grow p-4 sm:p-6 md:p-8">
        <div className="max-w-6xl mx-auto w-full space-y-8">
          <AdminPageHeader active="complaints" />

          <main className="w-full space-y-4">
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by ref, handler, name or text..."
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-10 py-3 text-white placeholder-gray-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Complaints</h2>
                  <p className="text-sm text-gray-400">Click a row to review and update details.</p>
                </div>
              </div>

              <div className="space-y-3">
                {filtered.map((c) => {
                  const isOpen = expanded[c.id];
                  return (
                    <div
                      key={c.id}
                      className="rounded-xl border border-amber-900/40 bg-gradient-to-br from-[#1A0B0B] via-[#0F0909] to-black shadow-lg shadow-black/30"
                    >
                      <button
                        type="button"
                        onClick={() => toggle(c.id)}
                        className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left"
                      >
                        <div className="flex flex-wrap gap-4 text-sm text-amber-100">
                          <span className="font-semibold">Ref. no.: <span className="text-amber-300">{c.id}</span></span>
                          <span>Handled By: <span className="text-amber-200">{c.handledBy || '—'}</span></span>
                          <span>Date Complaint received: <span className="text-amber-200">{formatDateTime(c.receivedAt)}</span></span>
                        </div>
                        {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4 pt-2 space-y-4 border-t border-amber-900/30">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Name</label>
                              <input
                                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                value={c.complainant.name}
                                onChange={(e) => updateComplainant(c.id, 'name', e.target.value)}
                              />
                            </div>
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Address</label>
                              <input
                                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                value={c.complainant.address}
                                onChange={(e) => updateComplainant(c.id, 'address', e.target.value)}
                              />
                            </div>
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Phone No</label>
                              <input
                                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                value={c.complainant.phone}
                                onChange={(e) => updateComplainant(c.id, 'phone', e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Date</label>
                              <input
                                className="w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-sm text-white/80"
                                value={formatDateOnly(c.receivedAt)}
                                readOnly
                              />
                            </div>
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Time</label>
                              <input
                                className="w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-sm text-white/80"
                                value={formatTimeOnly(c.receivedAt)}
                                readOnly
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="block text-[11px] uppercase tracking-wide text-gray-400">Details of Complaint</label>
                            <textarea
                              className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                              rows={3}
                              value={c.details}
                              onChange={(e) => updateField(c.id, 'details', e.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="block text-[11px] uppercase tracking-wide text-gray-400">Method/Enquiry to resolve complaint</label>
                            <textarea
                              className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                              rows={2}
                              value={c.resolutionMethod}
                              onChange={(e) => updateField(c.id, 'resolutionMethod', e.target.value)}
                            />
                          </div>

                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Result</label>
                              <input
                                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                value={c.result}
                                onChange={(e) => updateField(c.id, 'result', e.target.value)}
                              />
                            </div>
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Company Representative Name</label>
                              <input
                                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                value={c.representative}
                                onChange={(e) => updateField(c.id, 'representative', e.target.value)}
                              />
                            </div>
                            <div className="sm:col-span-1 flex items-end">
                              <button
                                type="button"
                                className="w-full rounded-lg border border-emerald-400/60 bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminComplaintsPage;
