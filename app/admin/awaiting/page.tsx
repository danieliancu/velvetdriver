'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
  documents: Array<{ label: string; url: string; type: string }>;
  cars: Array<{ vrm: string; make: string; model: string; colour: string; keeper: string }>;
};

const tabs = ['Details', 'Car(s)', 'Documents Uploaded', 'Approve Now!'] as const;

const AwaitingApprovalPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [driverTabs, setDriverTabs] = useState<Record<string, typeof tabs[number]>>({});
  const [drivers, setDrivers] = useState<AwaitingDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<Record<string, boolean>>({});

  const formatDate = (value: string) => {
    if (!value || value === '-') return '-';
    const dateValue = new Date(value);
    if (Number.isNaN(dateValue.getTime())) return value;
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(dateValue);
  };

  useEffect(() => {
    const loadDrivers = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/awaiting', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setDrivers(data.drivers || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load awaiting drivers');
        setDrivers([]);
      } finally {
        setLoading(false);
      }
    };
    loadDrivers();
  }, []);

  const filteredDrivers = useMemo(() => {
    if (!query.trim()) return drivers;
    const term = query.toLowerCase();
    return drivers.filter((driver) =>
      `${driver.name} ${driver.email} ${driver.id} ${driver.license}`.toLowerCase().includes(term)
    );
  }, [query, drivers]);

  const getActiveTab = (driverId: string) => driverTabs[driverId] ?? tabs[0];
  const setActiveTab = (driverId: string, tab: typeof tabs[number]) =>
    setDriverTabs((prev) => ({ ...prev, [driverId]: tab }));

  const approveDriver = async (driverId: string) => {
    setApproving((prev) => ({ ...prev, [driverId]: true }));
    try {
      const res = await fetch('/api/admin/awaiting', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to approve driver');
      }
      setDrivers((prev) => prev.filter((driver) => driver.id !== driverId));
    } catch (err: any) {
      setError(err?.message || 'Failed to approve driver');
    } finally {
      setApproving((prev) => ({ ...prev, [driverId]: false }));
    }
  };

  return (
    <PageShell mainClassName="flex flex-col px-4 sm:px-6 md:px-8 py-10" hideFooter hideHeader>
      <div className="w-full flex-grow">
        <div className="max-w-6xl mx-auto space-y-8">
          <AdminPageHeader active="awaiting" liveBadgeCount={drivers.length} />
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

            {error ? (
              <div className="rounded-2xl border border-red-500/50 bg-red-950/40 p-6 text-center text-red-200">
                {error}
              </div>
            ) : null}
            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-black/50 p-6 text-center text-gray-400">
                Loading awaiting drivers...
              </div>
            ) : !loading && filteredDrivers.length === 0 ? (
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
                      <p>PCO Expiry: {formatDate(driver.pcoExpiry)}</p>
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
                        <p className="text-lg text-white font-semibold">{formatDate(driver.pcoExpiry)}</p>
                      </div>
                    </div>
                  )}

                  {getActiveTab(driver.id) === 'Car(s)' && (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {driver.cars.length === 0 ? (
                        <div className="rounded-2xl border border-amber-900/50 bg-gradient-to-br from-[#1E1212] via-[#100808] to-black p-4 text-sm text-gray-300">
                          <p className="text-gray-400">No car details submitted yet.</p>
                        </div>
                      ) : (
                        driver.cars.map((car, index) => (
                          <div
                            key={`${driver.id}-car-${index}`}
                            className="rounded-2xl border border-amber-900/50 bg-gradient-to-br from-[#1E1212] via-[#100808] to-black p-4"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs uppercase text-amber-300">Vehicle</p>
                                <p className="text-lg font-bold text-white">{car.make} {car.model}</p>
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-white/80">
                              <p><span className="text-amber-200 uppercase mr-2">VRM</span>{car.vrm}</p>
                              <p><span className="text-amber-200 uppercase mr-2">Colour</span>{car.colour}</p>
                              <p><span className="text-amber-200 uppercase mr-2">Keeper</span>{car.keeper}</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {getActiveTab(driver.id) === 'Documents Uploaded' && (
                    <div className="overflow-x-auto rounded-2xl border border-amber-900/50 bg-gradient-to-br from-[#1E1212] via-[#100808] to-black p-4">
                      {driver.documents.length === 0 ? (
                        <p className="text-sm text-gray-400">No documents uploaded yet.</p>
                      ) : (
                        <table className="w-full min-w-max text-left text-sm text-white/80">
                          <thead>
                            <tr className="border-b border-amber-900/50 text-xs uppercase tracking-wider text-amber-300">
                              <th className="py-2 px-3">Name</th>
                              <th className="py-2 px-3">Type</th>
                              <th className="py-2 px-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {driver.documents.map((doc) => (
                              <tr key={`${driver.id}-${doc.label}`} className="border-b border-white/5">
                                <td className="py-2 px-3 text-white/90">{doc.label}</td>
                                <td className="py-2 px-3 text-white/70">{doc.type}</td>
                                <td className="py-2 px-3 text-right">
                                  <a
                                    href={doc.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white transition hover:border-amber-400 hover:text-amber-300"
                                  >
                                    View
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {getActiveTab(driver.id) === 'Approve Now!' && (
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-900/20 p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm text-gray-200">
                        Confirm this driver meets all requirements.
                      </div>
                      <button
                        type="button"
                        onClick={() => approveDriver(driver.id)}
                        className="rounded-full bg-emerald-500 text-black px-6 py-2 text-sm font-semibold hover:bg-emerald-400 transition shadow-[0_0_15px_rgba(52,211,153,0.4)]"
                        disabled={approving[driver.id]}
                      >
                        {approving[driver.id] ? 'Approving...' : 'Approve Now!'}
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
