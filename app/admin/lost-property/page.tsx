'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import AdminPageHeader from '@/components/AdminPageHeader';

type LostPropertyRecord = {
  id: string;
  handedInBy: string;
  receivedAt: string;
  bookingDateTime: string;
  customer: {
    name: string;
    address: string;
    phone: string;
  };
  propertyDetails: string;
  returnMethod: string;
  result: string;
  representative: string;
};

const seedLost: LostPropertyRecord[] = [
  {
    id: 'LP-2001',
    handedInBy: 'Driver James P.',
    receivedAt: '2025-11-18T09:20:00Z',
    bookingDateTime: '18 Nov 2025, 08:30',
    customer: {
      name: 'Laura Kim',
      address: '15 High Street, London W1',
      phone: '+44 7700 900555',
    },
    propertyDetails: 'Black leather laptop bag left in rear seat.',
    returnMethod: 'Arrange courier delivery to address on file.',
    result: 'Pending customer confirmation',
    representative: 'Michael Ross',
  },
  {
    id: 'LP-2002',
    handedInBy: 'Cleaner Team',
    receivedAt: '2025-11-17T18:45:00Z',
    bookingDateTime: '17 Nov 2025, 17:10',
    customer: {
      name: 'Peter Shaw',
      address: 'Flat 4B, 8 Shoreditch High St, E1',
      phone: '+44 7700 900666',
    },
    propertyDetails: 'iPhone 14 Pro with navy case found under back seat.',
    returnMethod: 'Call customer and schedule pickup from office.',
    result: 'Customer notified',
    representative: 'Amelia Green',
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

const AdminLostPropertyPage: React.FC = () => {
  const [records, setRecords] = useState<LostPropertyRecord[]>(seedLost);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return records;
    const q = query.toLowerCase();
    return records.filter((r) => {
      const haystack = `${r.id} ${r.handedInBy} ${r.customer.name} ${r.propertyDetails} ${r.result}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query, records]);

  const toggle = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const updateRecord = <K extends keyof LostPropertyRecord>(id: string, key: K, value: LostPropertyRecord[K]) => {
    setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  };

  const updateCustomer = (id: string, field: keyof LostPropertyRecord['customer'], value: string) => {
    setRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, customer: { ...r.customer, [field]: value } } : r)),
    );
  };

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
                placeholder="Search by ref, handler, name or text..."
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-10 py-3 text-white placeholder-gray-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Lost/Found Property</h2>
                  <p className="text-sm text-gray-400">Click a row to update return handling.</p>
                </div>
              </div>

              <div className="space-y-3">
                {filtered.map((r) => {
                  const isOpen = expanded[r.id];
                  return (
                    <div
                      key={r.id}
                      className="rounded-xl border border-amber-900/40 bg-gradient-to-br from-[#0F0A0A] via-[#120707] to-black shadow-lg shadow-black/30"
                    >
                      <button
                        type="button"
                        onClick={() => toggle(r.id)}
                        className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left"
                      >
                        <div className="flex flex-wrap gap-4 text-sm text-amber-100">
                          <span className="font-semibold">Ref.no: <span className="text-amber-300">{r.id}</span></span>
                          <span>Handed in By: <span className="text-amber-200">{r.handedInBy || '—'}</span></span>
                          <span>Date Property received: <span className="text-amber-200">{formatDateTime(r.receivedAt)}</span></span>
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
                                value={r.customer.name}
                                onChange={(e) => updateCustomer(r.id, 'name', e.target.value)}
                              />
                            </div>
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Address</label>
                              <input
                                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                value={r.customer.address}
                                onChange={(e) => updateCustomer(r.id, 'address', e.target.value)}
                              />
                            </div>
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Phone No</label>
                              <input
                                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                value={r.customer.phone}
                                onChange={(e) => updateCustomer(r.id, 'phone', e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Date</label>
                              <input
                                className="w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-sm text-white/80"
                                value={formatDateOnly(r.receivedAt)}
                                readOnly
                              />
                            </div>
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Time</label>
                              <input
                                className="w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-sm text-white/80"
                                value={formatTimeOnly(r.receivedAt)}
                                readOnly
                              />
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="sm:col-span-3">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Details of Property</label>
                              <textarea
                                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                rows={3}
                                value={r.propertyDetails}
                                onChange={(e) => updateRecord(r.id, 'propertyDetails', e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="block text-[11px] uppercase tracking-wide text-gray-400">Method/Enquiry to return property</label>
                            <textarea
                              className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                              rows={2}
                              value={r.returnMethod}
                              onChange={(e) => updateRecord(r.id, 'returnMethod', e.target.value)}
                            />
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Result</label>
                              <input
                                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                value={r.result}
                                onChange={(e) => updateRecord(r.id, 'result', e.target.value)}
                              />
                            </div>
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Company Representative Name</label>
                              <input
                                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                value={r.representative}
                                onChange={(e) => updateRecord(r.id, 'representative', e.target.value)}
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

export default AdminLostPropertyPage;
