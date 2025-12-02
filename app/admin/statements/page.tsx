'use client';

import React, { useMemo, useState } from 'react';
import AdminPageHeader from '@/components/AdminPageHeader';

type StatementRow = {
  date: string;
  ref: string;
  pickup: string;
  dropoff: string;
  vehicle: string;
  driver: string;
  fare: number;
  status: 'Paid' | 'Pending' | 'Awaiting Driver';
};

const mockStatements: StatementRow[] = [
  { date: '2025-10-01', ref: 'VD-1001', pickup: 'WD3 4PQ', dropoff: 'Heathrow T5', vehicle: 'Saloon', driver: 'James P.', fare: 64, status: 'Paid' },
  { date: '2025-10-03', ref: 'VD-1002', pickup: 'HA4 0HJ', dropoff: 'LHR T3', vehicle: 'MPV', driver: 'Robert K.', fare: 52.5, status: 'Pending' },
  { date: '2025-10-05', ref: 'VD-1003', pickup: 'SW1A 1AA', dropoff: 'Gatwick South', vehicle: 'Luxury', driver: 'Anna B.', fare: 112, status: 'Paid' },
  { date: '2025-10-06', ref: 'VD-1004', pickup: 'W1J 7NT', dropoff: 'City Airport', vehicle: 'Executive', driver: 'Oliver T.', fare: 74, status: 'Awaiting Driver' },
];

const AdminStatementsPage: React.FC = () => {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const toggleSelect = (ref: string) => {
    setSelected((prev) => ({ ...prev, [ref]: !prev[ref] }));
  };

  const allSelected = useMemo(
    () => mockStatements.every((row) => selected[row.ref]),
    [selected]
  );

  const toggleSelectAll = () => {
    const next = mockStatements.reduce<Record<string, boolean>>((acc, row) => {
      acc[row.ref] = !allSelected;
      return acc;
    }, {});
    setSelected(next);
  };

  const handleDownload = () => {
    const refs = mockStatements.filter((row) => selected[row.ref]).map((row) => row.ref);
    if (refs.length === 0) return;
    // placeholder for future download logic
    alert(`Download initiated for: ${refs.join(', ')}`);
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
                <span className="text-gray-500">—</span>
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
                disabled={!mockStatements.some((row) => selected[row.ref])}
              >
                Download selected
              </button>
            </div>

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
                    <th className="px-3 py-3 text-left">Date</th>
                    <th className="px-3 py-3 text-left">Ref</th>
                    <th className="px-3 py-3 text-left">Pickup</th>
                    <th className="px-3 py-3 text-left">Dropoff</th>
                    <th className="px-3 py-3 text-left">Vehicle</th>
                    <th className="px-3 py-3 text-left">Driver</th>
                    <th className="px-3 py-3 text-left">Fare (£)</th>
                    <th className="px-3 py-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mockStatements.map((row) => {
                    const isSelected = selected[row.ref] ?? false;
                    return (
                      <tr key={row.ref} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(row.ref)}
                            className="h-4 w-4 accent-amber-500"
                            aria-label={`Select ${row.ref} for download`}
                          />
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">{row.date}</td>
                        <td className="px-3 py-3 font-semibold text-white">{row.ref}</td>
                        <td className="px-3 py-3">{row.pickup}</td>
                        <td className="px-3 py-3">{row.dropoff}</td>
                        <td className="px-3 py-3">{row.vehicle}</td>
                        <td className="px-3 py-3">{row.driver}</td>
                        <td className="px-3 py-3 font-semibold text-amber-200">£{row.fare.toFixed(2)}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`text-xs font-semibold uppercase tracking-[0.15em] ${
                              row.status === 'Paid'
                                ? 'text-green-300'
                                : row.status === 'Pending'
                                ? 'text-amber-300'
                              : 'text-gray-300'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
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
