'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import AdminPageHeader from '@/components/AdminPageHeader';

type Complaint = {
  id: number;
  refNo: string;
  journeyId?: number | null;
  bookingDateTime?: string | null;
  fullName: string;
  email?: string;
  address: string;
  phone: string;
  subject: string;
  details: string;
  methodEnquiry?: string | null;
  resolutionResult?: string | null;
  representativeName?: string | null;
  status: string;
  source: string;
  createdAt: string;
};

const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso),
  );

const AdminComplaintsPage: React.FC = () => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState<Record<number, boolean>>({});
  const [staffOptions, setStaffOptions] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/complaints', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { complaints: Complaint[] };
        setRecords(data.complaints || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load complaints');
        setRecords([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const loadStaff = async () => {
      try {
        const res = await fetch('/api/admin/staff', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const names: string[] = (data.staff || []).map((s: { fullName?: string }) => s.fullName).filter(Boolean);
        setStaffOptions(names);
      } catch (err) {
        console.error('Failed to load staff for representative dropdown', err);
      }
    };
    loadStaff();
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return records;
    const q = query.toLowerCase();
    return records.filter((c) => {
      const haystack = `${c.refNo} ${c.fullName} ${c.email || ''} ${c.details} ${c.subject} ${c.status}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query, records]);

  const toggle = (ref: string) => setExpanded((prev) => ({ ...prev, [ref]: !prev[ref] }));

  const handleStatusSelect = (id: number, status: string) => {
    setRecords((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
  };

  const handleFieldChange = (id: number, key: keyof Complaint, value: string) => {
    setRecords((prev) => prev.map((c) => (c.id === id ? { ...c, [key]: value } : c)));
  };

  const saveStatus = async (id: number) => {
    const record = records.find((c) => c.id === id);
    if (!record) return;
    const previous = record.status;
    setSavingStatus((prev) => ({ ...prev, [id]: true }));
    setSaveError(null);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/admin/complaints', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status: record.status,
          methodEnquiry: record.methodEnquiry,
          resolutionResult: record.resolutionResult,
          representativeName: record.representativeName,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Failed to update complaint ${record.refNo}`);
      }
      setSaveMessage(`Status updated for ${record.refNo}`);
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to update status');
      setRecords((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                status: previous,
              }
            : c
        )
      );
    } finally {
      setSavingStatus((prev) => ({ ...prev, [id]: false }));
    }
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
                placeholder="Search by ref, name, email or text..."
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-10 py-3 text-white placeholder-gray-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Complaints</h2>
                  <p className="text-sm text-gray-400">Click a row to review the submission.</p>
                </div>
              </div>

              {error ? (
                <div className="rounded-lg border border-red-500/50 bg-red-950/40 text-red-200 px-4 py-3 text-sm">
                  {error}
                </div>
              ) : null}
              {saveError ? (
                <div className="rounded-lg border border-red-500/50 bg-red-950/40 text-red-200 px-4 py-3 text-sm">
                  {saveError}
                </div>
              ) : null}
              {saveMessage ? (
                <div className="rounded-lg border border-emerald-500/50 bg-emerald-950/40 text-emerald-100 px-4 py-3 text-sm">
                  {saveMessage}
                </div>
              ) : null}
              {loading ? <div className="text-sm text-gray-400">Loading complaints...</div> : null}

              <div className="space-y-3">
                {filtered.map((c) => {
                  const isOpen = expanded[c.refNo];
                  return (
                    <div
                      key={c.id}
                      className="rounded-xl border border-amber-900/40 bg-gradient-to-br from-[#1A0B0B] via-[#0F0909] to-black shadow-lg shadow-black/30"
                    >
                      <button
                        type="button"
                        onClick={() => toggle(c.refNo)}
                        className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left"
                      >
                        <div className="flex flex-wrap gap-4 text-sm text-amber-100">
                          <span className="font-semibold">Ref. no.: <span className="text-amber-300">{c.refNo}</span></span>
                          <span>Source: <span className="text-amber-200">{c.source}</span></span>
                          <span>Date received: <span className="text-amber-200">{formatDateTime(c.createdAt)}</span></span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] ${
                              c.status === 'open'
                                ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40'
                                : c.status === 'closed'
                                ? 'bg-red-500/20 text-red-200 border border-red-400/40'
                                : 'bg-gray-500/20 text-gray-200 border border-gray-400/40'
                            }`}
                          >
                            {c.status}
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
                                value={c.fullName}
                                readOnly
                              />
                            </div>
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Email Address</label>
                              <input
                                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white"
                                value={c.email || c.address || 'N/A'}
                                readOnly
                              />
                            </div>
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Phone No</label>
                              <input
                                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white"
                                value={c.phone}
                                readOnly
                              />
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Date and Time</label>
                              <input
                                className="w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-sm text-white/80"
                                value={c.bookingDateTime || 'Not provided'}
                                readOnly
                              />
                            </div>
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Status</label>
                              <select
                                className="w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-sm text-white/80"
                                value={c.status}
                                onChange={(e) => handleStatusSelect(c.id, e.target.value)}
                              >
                                {['open', 'closed'].map((statusOption) => (
                                  <option key={statusOption} value={statusOption}>
                                    {statusOption}
                                  </option>
                                ))}
                                {!['open', 'closed'].includes(c.status) ? (
                                  <option value={c.status}>{c.status}</option>
                                ) : null}
                              </select>
                            </div>
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Source</label>
                              <input
                                className="w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 text-sm text-white/80"
                                value={c.source}
                                readOnly
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="block text-[11px] uppercase tracking-wide text-gray-400">Subject</label>
                            <input
                              className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white"
                              value={c.subject}
                              readOnly
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="block text-[11px] uppercase tracking-wide text-gray-400">Details of Complaint</label>
                            <textarea
                              className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white"
                              rows={3}
                              value={c.details}
                              readOnly
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="block text-[11px] uppercase tracking-wide text-gray-400">Method/Enquiry to resolve complaint</label>
                            <textarea
                              className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white"
                              rows={3}
                              value={c.methodEnquiry || ''}
                              onChange={(e) => handleFieldChange(c.id, 'methodEnquiry', e.target.value)}
                            />
                          </div>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Result</label>
                              <input
                                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white"
                                value={c.resolutionResult || ''}
                                onChange={(e) => handleFieldChange(c.id, 'resolutionResult', e.target.value)}
                              />
                            </div>
                            <div className="sm:col-span-1">
                              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Company Representative Name</label>
                              <select
                                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white"
                                value={c.representativeName || ''}
                                onChange={(e) => handleFieldChange(c.id, 'representativeName', e.target.value)}
                              >
                                <option value="">Select representative</option>
                                {staffOptions.map((name) => (
                                  <option key={name} value={name}>
                                    {name}
                                  </option>
                                ))}
                                {c.representativeName && !staffOptions.includes(c.representativeName) ? (
                                  <option value={c.representativeName}>{c.representativeName}</option>
                                ) : null}
                              </select>
                            </div>
                          </div>

                          <div className="pt-2 flex justify-end">
                            <button
                              type="button"
                              onClick={() => saveStatus(c.id)}
                              className="rounded-lg bg-amber-500 text-black px-4 py-2.5 text-sm font-semibold hover:bg-amber-400 disabled:opacity-60"
                              disabled={savingStatus[c.id]}
                            >
                              {savingStatus[c.id] ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {!loading && !error && filtered.length === 0 ? (
                  <div className="text-sm text-gray-400">No complaints found.</div>
                ) : null}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminComplaintsPage;
