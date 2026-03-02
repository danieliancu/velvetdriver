'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AdminPageHeader from '@/components/AdminPageHeader';

type StatementRow = {
  id: number;
  ref: string;
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

const AdminStatementsPage: React.FC = () => {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
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

  const allSelected = useMemo(() => rows.length > 0 && rows.every((row) => selected[String(row.id)]), [rows, selected]);

  const toggleSelectAll = () => {
    const next = rows.reduce<Record<string, boolean>>((acc, row) => {
      acc[String(row.id)] = !allSelected;
      return acc;
    }, {});
    setSelected(next);
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

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="w-full flex-grow p-4 sm:p-6 md:p-8">
        <div className="max-w-6xl mx-auto w-full space-y-8">
          <AdminPageHeader active="statements" />

          <main className="w-full space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-200">
                <span className="text-xs uppercase tracking-[0.25em] text-amber-300">Select between dates</span>
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
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 transition-colors disabled:opacity-60"
                disabled={!rows.some((row) => selected[String(row.id)])}
              >
                Download selected
              </button>
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-500/50 bg-red-950/40 p-4 text-red-200">{error}</div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-gray-100">
                <thead className="text-xs uppercase tracking-[0.2em] text-amber-300">
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-3 text-left">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 accent-amber-500"
                          aria-label="Select all statements"
                        />
                        <span className="text-[10px] uppercase tracking-[0.2em] text-amber-300">Download</span>
                      </div>
                    </th>
                    <th className="px-3 py-3 text-left">Person accepting booking</th>
                    <th className="px-3 py-3 text-left">Date of booking</th>
                    <th className="px-3 py-3 text-left">Date of journey</th>
                    <th className="px-3 py-3 text-left">Customer name</th>
                    <th className="px-3 py-3 text-left">Phone number</th>
                    <th className="px-3 py-3 text-left">Place of collection</th>
                    <th className="px-3 py-3 text-left">Main destination</th>
                    <th className="px-3 py-3 text-left">Fare quoted</th>
                    <th className="px-3 py-3 text-left">Person despatching booking</th>
                    <th className="px-3 py-3 text-left">Driver Full Name</th>
                    <th className="px-3 py-3 text-left">Driver PHP License Number</th>
                    <th className="px-3 py-3 text-left">Vehcle Reg Number</th>
                    <th className="px-3 py-3 text-left">Sublet Operator No.</th>
                    <th className="px-3 py-3 text-left">Sublet Operator Name</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="px-3 py-5 text-gray-400" colSpan={15}>
                        Loading statements...
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td className="px-3 py-5 text-gray-400" colSpan={15}>
                        No statements found for this date range.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const key = String(row.id);
                      const isSelected = selected[key] ?? false;
                      return (
                        <tr key={key} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(key)}
                              className="h-4 w-4 accent-amber-500"
                              aria-label={`Select ${row.ref} for download`}
                            />
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">{row.personAccepting}</td>
                          <td className="px-3 py-3 whitespace-nowrap">{row.bookingDate}</td>
                          <td className="px-3 py-3 whitespace-nowrap">{row.journeyDate}</td>
                          <td className="px-3 py-3 whitespace-nowrap">{row.customerName}</td>
                          <td className="px-3 py-3 whitespace-nowrap">{row.phoneNumber}</td>
                          <td className="px-3 py-3">{row.collection}</td>
                          <td className="px-3 py-3">{row.destination}</td>
                          <td className="px-3 py-3 font-semibold text-amber-200">GBP {row.fare.toFixed(2)}</td>
                          <td className="px-3 py-3 whitespace-nowrap">{row.despatcher}</td>
                          <td className="px-3 py-3 whitespace-nowrap">{row.driverName}</td>
                          <td className="px-3 py-3 whitespace-nowrap">{row.driverLicenseNo}</td>
                          <td className="px-3 py-3 whitespace-nowrap">{row.vehicleReg}</td>
                          <td className="px-3 py-3 whitespace-nowrap">{row.subletOperatorNo}</td>
                          <td className="px-3 py-3 whitespace-nowrap">{row.subletOperatorName}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminStatementsPage;
