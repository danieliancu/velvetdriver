'use client';

import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import PageShell from '@/components/PageShell';
import AdminPageHeader from '@/components/AdminPageHeader';

type AwaitingDriver = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  license: string;
  pcoExpiry: string;
  rating: string;
  tenure: string;
  lastOnline: string;
  upcomingJobs: number;
  cars: {
    vrm: string;
    make: string;
    model: string;
    motExpiry: string;
    insuranceExpiry: string;
    phvExpiry: string;
    logbook: string;
    status: 'Active' | 'Reserve';
  }[];
};

const awaitingDrivers: AwaitingDriver[] = [
  {
    id: 'james',
    name: 'James P.',
    phone: '+447479666343',
    email: 'james@velvetdrivers.co.uk',
    address: '17 Fleet Street, London, EC4M 9AF',
    license: 'PCO-70934',
    pcoExpiry: '2026-02-14',
    rating: '4.9 / 5',
    tenure: '6 yrs with Velvet',
    lastOnline: '01:20 UTC',
    upcomingJobs: 2,
    cars: [
      {
        vrm: 'LC20 ABC',
        make: 'Mercedes-Benz',
        model: 'S-Class',
        motExpiry: '2025-10-15',
        insuranceExpiry: '2025-08-31',
        phvExpiry: '2025-09-20',
        logbook: 'Uploaded',
        status: 'Active'
      }
    ]
  },
  {
    id: 'anna',
    name: 'Anna B.',
    phone: '+44 7700 900456',
    email: 'anna@velvetdrivers.co.uk',
    address: '29 Berkeley Square, London, W1J 6EN',
    license: 'PCO-70935',
    pcoExpiry: '2026-05-21',
    rating: '4.8 / 5',
    tenure: '4 yrs with Velvet',
    lastOnline: '03:10 UTC',
    upcomingJobs: 1,
    cars: [
      {
        vrm: 'BD68 XYZ',
        make: 'BMW',
        model: '7 Series',
        motExpiry: '2026-01-22',
        insuranceExpiry: '2025-12-01',
        phvExpiry: '2026-01-10',
        logbook: 'Uploaded',
        status: 'Reserve'
      }
    ]
  },
  {
    id: 'david',
    name: 'David C.',
    phone: '+44 7700 900345',
    email: 'david@velvetdrivers.co.uk',
    address: '45 Park Lane, London, W1K 1PN',
    license: 'PCO-70936',
    pcoExpiry: '2026-07-09',
    rating: '5.0 / 5',
    tenure: '3 yrs with Velvet',
    lastOnline: '00:05 UTC',
    upcomingJobs: 0,
    cars: [
      {
        vrm: 'LR75 QNE',
        make: 'Lexus',
        model: 'ES 300h',
        motExpiry: '2025-11-10',
        insuranceExpiry: '2025-12-22',
        phvExpiry: '2025-12-01',
        logbook: 'Uploaded',
        status: 'Active'
      }
    ]
  },
  {
    id: 'robert',
    name: 'Robert K.',
    phone: '+44 7700 900234',
    email: 'robert@velvetdrivers.co.uk',
    address: '10 Downing Street, London, SW1A 2AA',
    license: 'PCO-70937',
    pcoExpiry: '2026-03-11',
    rating: '4.7 / 5',
    tenure: '5 yrs with Velvet',
    lastOnline: '02:40 UTC',
    upcomingJobs: 3,
    cars: [
      {
        vrm: 'EV13 TES',
        make: 'Tesla',
        model: 'Model S',
        motExpiry: '2025-09-18',
        insuranceExpiry: '2025-11-02',
        phvExpiry: '2026-01-12',
        logbook: 'Uploaded',
        status: 'Active'
      }
    ]
  }
];

const tabs = ['Details', 'Car(s)', 'Documents Uploaded', 'Approve Now!'] as const;

const AwaitingApprovalPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [driverTabs, setDriverTabs] = useState<Record<string, typeof tabs[number]>>({});

  const filteredDrivers = useMemo(() => {
    if (!query.trim()) return awaitingDrivers;
    const term = query.toLowerCase();
    return awaitingDrivers.filter((driver) =>
      `${driver.name} ${driver.email} ${driver.id} ${driver.license}`.toLowerCase().includes(term)
    );
  }, [query]);

  const getActiveTab = (driverId: string) => driverTabs[driverId] ?? tabs[0];
  const setActiveTab = (driverId: string, tab: typeof tabs[number]) =>
    setDriverTabs((prev) => ({ ...prev, [driverId]: tab }));

  return (
    <PageShell mainClassName="flex flex-col px-4 sm:px-6 md:px-8 py-10" hideFooter hideHeader>
      <div className="w-full flex-grow">
        <div className="max-w-6xl mx-auto space-y-8">
          <AdminPageHeader active="awaiting" liveBadgeCount={4} />
          <section className="space-y-10">
            <div className="relative w-full">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search drivers by name, email or ID..."
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-10 py-3 text-white placeholder-gray-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            {filteredDrivers.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/50 p-6 text-center text-gray-400">
                No drivers match your search. Try a different name or ID.
              </div>
            ) : (
              filteredDrivers.map((driver) => (
                <article
                  key={driver.id}
                  className="space-y-6 rounded-3xl border border-white/10 bg-black/60 p-6 shadow-lg shadow-black/60"
                >
                  <header className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-amber-300/70">
                        Driver ID {driver.id.toUpperCase()}
                      </p>
                      <h2 className="text-2xl font-bold text-white">{driver.name}</h2>
                      <p className="text-sm text-gray-400">{driver.email}</p>
                    </div>
                    <div className="text-sm text-gray-300">
                      <p>Phone: {driver.phone}</p>
                      <p>PCO Expiry: {driver.pcoExpiry}</p>
                    </div>
                  </header>
                  <div className="flex flex-wrap items-center gap-3">
                    <nav className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-2">
                      {tabs.map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setActiveTab(driver.id, tab)}
                          className={`relative px-4 py-2 text-sm font-semibold rounded-full transition-colors whitespace-nowrap ${
                            getActiveTab(driver.id) === tab
                              ? 'bg-amber-400 text-black shadow-md shadow-amber-400/30'
                              : 'bg-gray-800/40 text-amber-300 hover:bg-gray-700/40'
                          }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </nav>
                  </div>

                  {getActiveTab(driver.id) === 'Details' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-300">
                      <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                        <p className="text-xs uppercase text-amber-200">Phone</p>
                        <p className="text-lg text-white font-semibold">{driver.phone}</p>
                      </div>
                      <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                        <p className="text-xs uppercase text-amber-200">Email</p>
                        <p className="text-lg text-white font-semibold">{driver.email}</p>
                      </div>
                      <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                        <p className="text-xs uppercase text-amber-200">Address</p>
                        <p className="text-lg text-white font-semibold">{driver.address}</p>
                      </div>
                      <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                        <p className="text-xs uppercase text-amber-200">PCO Licence</p>
                        <p className="text-lg text-white font-semibold">{driver.license}</p>
                      </div>
                      <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                        <p className="text-xs uppercase text-amber-200">PCO Expiry</p>
                        <p className="text-lg text-white font-semibold">{driver.pcoExpiry}</p>
                      </div>
                    </div>
                  )}

                  {getActiveTab(driver.id) === 'Car(s)' && (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {driver.cars.map((car) => (
                        <div key={`${driver.id}-${car.vrm}`} className="rounded-2xl border border-amber-900/50 bg-gradient-to-br from-[#1E1212] via-[#100808] to-black p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs uppercase text-amber-300">Vehicle</p>
                              <p className="text-lg font-bold text-white">{car.make} {car.model}</p>
                            </div>
                            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300">
                              {car.status}
                            </span>
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-white/80">
                            <p><span className="text-amber-200 uppercase mr-2">VRM</span>{car.vrm}</p>
                            <p><span className="text-amber-200 uppercase mr-2">MOT</span>{car.motExpiry}</p>
                            <p><span className="text-amber-200 uppercase mr-2">Insurance</span>{car.insuranceExpiry}</p>
                            <p><span className="text-amber-200 uppercase mr-2">PHV</span>{car.phvExpiry}</p>
                            <p><span className="text-amber-200 uppercase mr-2">Logbook</span>{car.logbook}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {getActiveTab(driver.id) === 'Documents Uploaded' && (
                    <div className="rounded-2xl border border-amber-900/50 bg-gradient-to-br from-[#1E1212] via-[#100808] to-black p-4 text-sm text-gray-300">
                      <p className="text-gray-400">Awaiting document review.</p>
                    </div>
                  )}

                  {getActiveTab(driver.id) === 'Approve Now!' && (
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-900/20 p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm text-gray-200">
                        Confirm this driver meets all requirements.
                      </div>
                      <button
                        type="button"
                        className="rounded-full bg-emerald-500 text-black px-6 py-2 text-sm font-semibold hover:bg-emerald-400 transition shadow-[0_0_15px_rgba(52,211,153,0.4)]"
                      >
                        Approve Now!
                      </button>
                    </div>
                  )}
                </article>
              ))
            )}
          </section>
        </div>
      </div>
    </PageShell>
  );
};

export default AwaitingApprovalPage;
