'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import AdminPageHeader from '@/components/AdminPageHeader';

type StatementRow = {
  id: number;
  ref: string;
  issuedAt?: string | null;
  personAccepting: string;
  bookingDate: string;
  journeyDate: string;
  customerName: string;
  phoneNumber: string;
  collection: string;
  destination: string;
  fare: number;
  despatcher: string;
  driverName: string;
  driverLicenseNo: string;
  vehicleReg: string;
  subletOperatorNo: string;
  subletOperatorName: string;
  status: 'Paid' | 'Unpaid';
  pdfUrl: string | null;
};

const formatIssuedDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const formatCurrency = (value: number) => `GBP ${value.toFixed(2)}`;

const StatementPage = ({
  row,
  isSelected,
  onToggleSelect,
  expanded,
  onToggleExpanded,
}: {
  row: StatementRow;
  isSelected: boolean;
  onToggleSelect: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
}) => (
  <article className="rounded-[28px] border border-amber-200/20 bg-gradient-to-br from-[#f8f0db] via-[#fffaf0] to-[#efe0ba] text-[#2c2115] shadow-[0_30px_80px_rgba(0,0,0,0.35)] overflow-hidden">
    <div className="border-b border-[#d6c39a] bg-gradient-to-r from-[#2e180f] via-[#51301c] to-[#2e180f] px-6 py-6 text-white sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-amber-100/90">
        <div className="flex flex-wrap items-center gap-3">
          <span>{row.ref}</span>
          <span>Issued: {formatIssuedDate(row.issuedAt)}</span>
          <span>{formatCurrency(row.fare)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onToggleExpanded}
            className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] transition hover:bg-white/15"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {expanded ? 'Collapse' : 'Expand'}
          </button>
          <label className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em]">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              className="h-4 w-4 accent-amber-400"
              aria-label={`Select ${row.ref} for download`}
            />
            Select
          </label>
          {row.pdfUrl ? (
            <a
              href={row.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full bg-amber-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-[#2a1808] transition hover:bg-amber-200"
            >
              Open PDF
            </a>
          ) : null}
        </div>
      </div>
    </div>

    {expanded ? (
    <div className="space-y-6 px-6 py-6 sm:px-8 sm:py-8">
      <div className="grid gap-4 md:grid-cols-[1.25fr_1fr]">
        <div className="rounded-2xl border border-[#d8c49b] bg-white/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#8a6a34]">Statement No</p>
          <p className="mt-2 text-3xl font-semibold tracking-[0.08em] text-[#3a2616]">{row.ref}</p>
        </div>
        <div className="rounded-2xl border border-[#d8c49b] bg-white/70 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[#8a6a34]">Date Issued</p>
          <p className="mt-2 text-2xl font-semibold text-[#3a2616]">{formatIssuedDate(row.issuedAt)}</p>
        </div>
      </div>

      <section className="rounded-[24px] border border-[#d8c49b] bg-white/65 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-[#8a6a34]">Booking Details</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[#eadfbe] bg-[#fffdf8] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[#8b7242]">Booking accepted by</p>
            <p className="mt-2 text-lg font-medium text-[#2f2418]">{row.personAccepting}</p>
          </div>
          <div className="rounded-2xl border border-[#eadfbe] bg-[#fffdf8] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[#8b7242]">Date of booking</p>
            <p className="mt-2 text-lg font-medium text-[#2f2418]">{row.bookingDate}</p>
          </div>
          <div className="rounded-2xl border border-[#eadfbe] bg-[#fffdf8] p-4 md:col-span-2">
            <p className="text-xs uppercase tracking-[0.22em] text-[#8b7242]">Date of journey</p>
            <p className="mt-2 text-lg font-medium text-[#2f2418]">{row.journeyDate}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-[#d8c49b] bg-white/65 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-[#8a6a34]">Customer Details</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[#eadfbe] bg-[#fffdf8] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[#8b7242]">Customer name</p>
            <p className="mt-2 text-lg font-medium text-[#2f2418]">{row.customerName}</p>
          </div>
          <div className="rounded-2xl border border-[#eadfbe] bg-[#fffdf8] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[#8b7242]">Phone number</p>
            <p className="mt-2 text-lg font-medium text-[#2f2418]">{row.phoneNumber}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-[#d8c49b] bg-white/65 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-[#8a6a34]">Journey Details</h3>
        <div className="mt-4 grid gap-4">
          <div className="rounded-2xl border border-[#eadfbe] bg-[#fffdf8] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[#8b7242]">Collection address</p>
            <p className="mt-2 text-lg font-medium leading-relaxed text-[#2f2418]">{row.collection}</p>
          </div>
          <div className="rounded-2xl border border-[#eadfbe] bg-[#fffdf8] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[#8b7242]">Destination</p>
            <p className="mt-2 text-lg font-medium leading-relaxed text-[#2f2418]">{row.destination}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[#eadfbe] bg-[#fffdf8] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-[#8b7242]">Fare quoted</p>
              <p className="mt-2 text-2xl font-semibold text-[#2f2418]">{formatCurrency(row.fare)}</p>
            </div>
            <div className="rounded-2xl border border-[#eadfbe] bg-[#fffdf8] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-[#8b7242]">Status</p>
              <p className="mt-2 text-lg font-medium text-[#2f2418]">{row.status}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-[#d8c49b] bg-white/65 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.28em] text-[#8a6a34]">Driver &amp; Vehicle Details</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[#eadfbe] bg-[#fffdf8] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[#8b7242]">Dispatching operator</p>
            <p className="mt-2 text-lg font-medium text-[#2f2418]">{row.despatcher}</p>
          </div>
          <div className="rounded-2xl border border-[#eadfbe] bg-[#fffdf8] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[#8b7242]">Driver full name</p>
            <p className="mt-2 text-lg font-medium text-[#2f2418]">{row.driverName}</p>
          </div>
          <div className="rounded-2xl border border-[#eadfbe] bg-[#fffdf8] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[#8b7242]">PCO licence number</p>
            <p className="mt-2 text-lg font-medium text-[#2f2418]">{row.driverLicenseNo}</p>
          </div>
          <div className="rounded-2xl border border-[#eadfbe] bg-[#fffdf8] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[#8b7242]">Vehicle registration</p>
            <p className="mt-2 text-lg font-medium text-[#2f2418]">{row.vehicleReg}</p>
          </div>
          <div className="rounded-2xl border border-[#eadfbe] bg-[#fffdf8] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[#8b7242]">Subcontract operator number</p>
            <p className="mt-2 text-lg font-medium text-[#2f2418]">{row.subletOperatorNo}</p>
          </div>
          <div className="rounded-2xl border border-[#eadfbe] bg-[#fffdf8] p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[#8b7242]">Subcontract operator name</p>
            <p className="mt-2 text-lg font-medium text-[#2f2418]">{row.subletOperatorName}</p>
          </div>
        </div>
      </section>

      <footer className="rounded-2xl border border-[#d8c49b] bg-[#f4ead0] px-5 py-4 text-center text-sm text-[#6a5430]">
        Velvet Drivers Limited | Private Hire Operator | This statement was generated for record purposes.
      </footer>
    </div>
    ) : null}
  </article>
);

const AdminStatementsPage: React.FC = () => {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rows, setRows] = useState<StatementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadStatements = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        const query = params.toString();
        const res = await fetch(`/api/admin/statements${query ? `?${query}` : ''}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || 'Failed to load statements');
        }
        const data = await res.json();
        setRows((data.statements || []) as StatementRow[]);
        setSelected({});
        setExpanded({});
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        setError(err?.message || 'Failed to load statements');
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    loadStatements();
    return () => controller.abort();
  }, [startDate, endDate]);

  const toggleSelect = (key: string) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allSelected = useMemo(() => rows.length > 0 && rows.every((row) => selected[String(row.id)]), [rows, selected]);
  const allExpanded = useMemo(() => rows.length > 0 && rows.every((row) => expanded[String(row.id)]), [rows, expanded]);

  const toggleSelectAll = () => {
    const next = rows.reduce<Record<string, boolean>>((acc, row) => {
      acc[String(row.id)] = !allSelected;
      return acc;
    }, {});
    setSelected(next);
  };

  const toggleExpandAll = () => {
    const next = rows.reduce<Record<string, boolean>>((acc, row) => {
      acc[String(row.id)] = !allExpanded;
      return acc;
    }, {});
    setExpanded(next);
  };

  const handleDownload = () => {
    const selectedRows = rows.filter((row) => selected[String(row.id)]);
    if (!selectedRows.length) return;

    const downloadable = selectedRows.filter((row) => row.pdfUrl);
    if (!downloadable.length) {
      alert('No PDF statement available for selected rows.');
      return;
    }

    downloadable.forEach((row) => {
      const link = document.createElement('a');
      link.href = row.pdfUrl as string;
      link.download = `${row.ref}-statement.pdf`;
      link.target = '_blank';
      link.rel = 'noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  const formatDateLabel = (value: string) => {
    if (!value) return 'Any date';
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="w-full flex-grow p-4 sm:p-6 md:p-8">
        <div className="max-w-6xl mx-auto w-full space-y-8">
          <AdminPageHeader active="statements" />

          <main className="w-full space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-200">
                <span className="text-xs uppercase tracking-[0.25em] text-amber-300">
                  Showing: {formatDateLabel(startDate)} to {formatDateLabel(endDate)}
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-md border border-white/10 bg-[#111]/70 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-md border border-white/10 bg-[#111]/70 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 transition-colors disabled:opacity-60"
                  disabled={!rows.some((row) => selected[String(row.id)])}
                >
                  Download selected
                </button>
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-500/50 bg-red-950/40 p-4 text-red-200">{error}</div>
            ) : null}

            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#120c0a]/80 px-4 py-3 text-sm text-gray-300">
              <span>{rows.length} statement(s)</span>
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={toggleExpandAll}
                  className="text-xs uppercase tracking-[0.22em] text-amber-300 transition hover:text-amber-200"
                >
                  {allExpanded ? 'Collapse all' : 'Expand all'}
                </button>
                <label className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-amber-300">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 accent-amber-500"
                    aria-label="Select all statements"
                  />
                  Select all
                </label>
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-sm text-gray-400">
                Loading statements...
              </div>
            ) : rows.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-6 text-sm text-gray-400">
                No statements found for this date range.
              </div>
            ) : (
              <div className="space-y-8">
                {rows.map((row) => {
                  const key = String(row.id);
                  return (
                    <StatementPage
                      key={key}
                      row={row}
                      isSelected={selected[key] ?? false}
                      onToggleSelect={() => toggleSelect(key)}
                      expanded={expanded[key] ?? false}
                      onToggleExpanded={() => toggleExpanded(key)}
                    />
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminStatementsPage;
