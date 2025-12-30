'use client';

import React, { useMemo, useState } from 'react';
import AdminPageHeader from '@/components/AdminPageHeader';

type StatementRow = {
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
};

const mockStatements: StatementRow[] = [
  {
    personAccepting: 'Sarah Lewis',
    bookingDate: '2025-10-01',
    journeyDate: '2025-10-02',
    customerName: 'John Carter',
    phoneNumber: '+44 7700 900111',
    collection: 'WD3 4PQ',
    destination: 'Heathrow T5',
    fare: 64,
    despatcher: 'Michael Ross',
    driverName: 'James P.',
    driverLicenseNo: 'PCO-70934',
    vehicleReg: 'LC20 ABC',
    subletOperatorNo: 'SUB-101',
    subletOperatorName: 'Velvet Ops'
  },
  {
    personAccepting: 'David Nguyen',
    bookingDate: '2025-10-03',
    journeyDate: '2025-10-04',
    customerName: 'Emily Stone',
    phoneNumber: '+44 7700 900222',
    collection: 'HA4 0HJ',
    destination: 'LHR T3',
    fare: 52.5,
    despatcher: 'Laura Blake',
    driverName: 'Robert K.',
    driverLicenseNo: 'PCO-70937',
    vehicleReg: 'EV13 TES',
    subletOperatorNo: 'SUB-102',
    subletOperatorName: 'CityWide'
  },
  {
    personAccepting: 'Amelia Green',
    bookingDate: '2025-10-05',
    journeyDate: '2025-10-05',
    customerName: 'Anna B.',
    phoneNumber: '+44 7700 900456',
    collection: 'SW1A 1AA',
    destination: 'Gatwick South',
    fare: 112,
    despatcher: 'Oliver T.',
    driverName: 'Anna B.',
    driverLicenseNo: 'PCO-70935',
    vehicleReg: 'BD68 XYZ',
    subletOperatorNo: 'SUB-103',
    subletOperatorName: 'Skyline Cars'
  },
  {
    personAccepting: 'Michael Ross',
    bookingDate: '2025-10-06',
    journeyDate: '2025-10-07',
    customerName: 'Peter Shaw',
    phoneNumber: '+44 7700 900666',
    collection: 'W1J 7NT',
    destination: 'City Airport',
    fare: 74,
    despatcher: 'Sarah Lewis',
    driverName: 'Oliver T.',
    driverLicenseNo: 'PCO-70938',
    vehicleReg: 'RX70 DVE',
    subletOperatorNo: 'SUB-104',
    subletOperatorName: 'Prime Fleet'
  }
];

const AdminStatementsPage: React.FC = () => {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const toggleSelect = (key: string) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const allSelected = useMemo(() => mockStatements.every((_row, idx) => selected[String(idx)]), [selected]);

  const toggleSelectAll = () => {
    const next = mockStatements.reduce<Record<string, boolean>>((acc, _row, idx) => {
      acc[String(idx)] = !allSelected;
      return acc;
    }, {});
    setSelected(next);
  };

  const handleDownload = () => {
    const refs = mockStatements
      .map((row, idx) => ({ row, idx }))
      .filter(({ idx }) => selected[String(idx)])
      .map(({ row }) => row.customerName);
    if (refs.length === 0) return;
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
                <span className="text-gray-500">ƒ?"</span>
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
                disabled={!mockStatements.some((_row, idx) => selected[String(idx)])}
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
                  {mockStatements.map((row, idx) => {
                    const key = String(idx);
                    const isSelected = selected[key] ?? false;
                    return (
                      <tr key={key} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(key)}
                            className="h-4 w-4 accent-amber-500"
                            aria-label={`Select ${row.customerName} for download`}
                          />
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">{row.personAccepting}</td>
                        <td className="px-3 py-3 whitespace-nowrap">{row.bookingDate}</td>
                        <td className="px-3 py-3 whitespace-nowrap">{row.journeyDate}</td>
                        <td className="px-3 py-3 whitespace-nowrap">{row.customerName}</td>
                        <td className="px-3 py-3 whitespace-nowrap">{row.phoneNumber}</td>
                        <td className="px-3 py-3">{row.collection}</td>
                        <td className="px-3 py-3">{row.destination}</td>
                        <td className="px-3 py-3 font-semibold text-amber-200">£{row.fare.toFixed(2)}</td>
                        <td className="px-3 py-3 whitespace-nowrap">{row.despatcher}</td>
                        <td className="px-3 py-3 whitespace-nowrap">{row.driverName}</td>
                        <td className="px-3 py-3 whitespace-nowrap">{row.driverLicenseNo}</td>
                        <td className="px-3 py-3 whitespace-nowrap">{row.vehicleReg}</td>
                        <td className="px-3 py-3 whitespace-nowrap">{row.subletOperatorNo}</td>
                        <td className="px-3 py-3 whitespace-nowrap">{row.subletOperatorName}</td>
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
