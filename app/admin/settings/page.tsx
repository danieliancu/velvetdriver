'use client';

import React, { useEffect, useState } from 'react';
import AdminPageHeader from '@/components/AdminPageHeader';

type PricingVehicle = {
  code: string;
  label: string;
  asDirectedRate: number;
  mileage: { tier1: number; tier2: number; tier3: number };
  innerZoneOverride: number;
};
type PricingState = {
  vehicles: PricingVehicle[];
  surcharges: { airportPickup: number; airportDropoff: number; congestion: number };
  nightSurcharge: number;
};

const defaultPricing: PricingState = {
  vehicles: [
    { code: 'executive', label: 'Executive', asDirectedRate: 40, mileage: { tier1: 6.25, tier2: 2.5, tier3: 2 }, innerZoneOverride: 6.25 },
    { code: 'luxury', label: 'Luxury', asDirectedRate: 60, mileage: { tier1: 8.75, tier2: 3.5, tier3: 3 }, innerZoneOverride: 8.75 },
    { code: 'mpv', label: 'Luxury MPV', asDirectedRate: 60, mileage: { tier1: 20, tier2: 4, tier3: 3.5 }, innerZoneOverride: 20 },
  ],
  surcharges: { airportPickup: 15, airportDropoff: 7, congestion: 15 },
  nightSurcharge: 30,
};

const AdminSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<PricingState | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      setError(null);
      try {
        const res = await fetch('/api/admin/settings', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as PricingState;
        setSettings(data);
      } catch (err) {
        console.error('Failed to load settings', err);
        setError('Failed to load settings from database. Using defaults.');
        setSettings(defaultPricing);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const updateVehicleField = (
    code: string,
    updater: (v: PricingVehicle) => PricingVehicle
  ) => {
    setSettings((prev) =>
      prev
        ? {
            ...prev,
            vehicles: prev.vehicles.map((v) => (v.code === code ? updater(v) : v)),
          }
        : prev
    );
  };

  const updateSurcharge = (key: keyof PricingState['surcharges'], value: number) => {
    setSettings((prev) => (prev ? { ...prev, surcharges: { ...prev.surcharges, [key]: value } } : prev));
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save settings', err);
      setError('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-gray-300">Loading settings...</p>
      </div>
    );
  }

  const getVehicle = (code: string) =>
    settings.vehicles.find((v) => v.code === code) ||
    defaultPricing.vehicles.find((v) => v.code === code)!;

  const exec = getVehicle('executive');
  const lux = getVehicle('luxury');
  const mpv = getVehicle('mpv');

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="w-full flex-grow p-4 sm:p-6 md:p-8">
        <div className="max-w-6xl mx-auto w-full space-y-8">
          <AdminPageHeader active="settings" />

          <main className="w-full space-y-6">
            <section className="bg-[#0f0b0b] border border-gray-800 rounded-2xl p-6 space-y-6 shadow-[0_0_50px_rgba(255,193,7,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-amber-500">Settings</p>
                  <h2 className="text-2xl font-semibold text-white">Pricing & Charges</h2>
                  <p className="text-sm text-gray-400">Reference rates visible only to admins.</p>
                </div>
                <div className="flex items-center gap-3">
                  {error && <span className="text-sm text-red-400">{error}</span>}
                  {saved && <span className="text-sm text-green-400">Saved</span>}
                  <button
                    type="button"
                    onClick={handleSave}
                    className="px-4 py-2 font-semibold bg-amber-500 text-black rounded-md hover:bg-amber-400 transition-colors disabled:opacity-60"
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-white/10 bg-black/50 p-4 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">As Directed</h3>
                    <p className="text-xs text-gray-400">Hourly waiting charges</p>
                  </div>
                  <div className="flex flex-col gap-3 text-sm">
                    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-gray-200">
                      <span>Executive</span>
                      <input
                        type="number"
                        className="w-28 rounded-md border border-white/10 bg-[#1c1c1c] px-3 py-2 text-right text-white"
                        value={exec.asDirectedRate}
                        onChange={(e) => updateVehicleField('executive', (v) => ({ ...v, asDirectedRate: Number(e.target.value) || 0 }))}
                      />
                      <span className="text-xs text-gray-400">£/h</span>
                    </div>
                    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-gray-200">
                      <span>Luxury, Luxury MPV</span>
                      <input
                        type="number"
                        className="w-28 rounded-md border border-white/10 bg-[#1c1c1c] px-3 py-2 text-right text-white"
                        value={lux.asDirectedRate}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          updateVehicleField('luxury', (v) => ({ ...v, asDirectedRate: val }));
                          updateVehicleField('mpv', (v) => ({ ...v, asDirectedRate: val }));
                        }}
                      />
                      <span className="text-xs text-gray-400">£/h</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/50 p-4 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Night surcharge</h3>
                    <p className="text-xs text-gray-400">Applies 23:00 - 04:00 across all categories</p>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm text-gray-200">
                    <span>Fixed per booking</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        className="w-24 rounded-md border border-white/10 bg-[#1c1c1c] px-3 py-2 text-right text-white"
                        value={settings.nightSurcharge}
                        onChange={(e) => setSettings((prev) => (prev ? { ...prev, nightSurcharge: Number(e.target.value) || 0 } : prev))}
                      />
                      <span className="text-xs text-gray-400">£</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/50 p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-white">Wait & Return / Transfer (A → B)</h3>
                  <p className="text-xs text-gray-400">Mileage tiers by vehicle</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[exec, lux, mpv].map((veh) => (
                    <div key={veh.code} className="rounded-lg border border-white/10 bg-[#161010] p-3 space-y-3">
                      <p className="text-sm font-semibold text-white">{veh.label}</p>
                      <div className="space-y-3 text-xs text-gray-300">
                        <div className="flex items-center justify-between gap-2">
                          <span>1-10 mile</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              className="w-24 rounded-md border border-white/10 bg-[#1c1c1c] px-2 py-1 text-right text-white"
                              value={veh.mileage.tier1}
                              onChange={(e) =>
                                updateVehicleField(veh.code, (v) => ({
                                  ...v,
                                  mileage: { ...v.mileage, tier1: Number(e.target.value) || 0 },
                                }))
                              }
                            />
                            <span className="text-[11px] text-gray-500">£/mile</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span>10-40 mile</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              className="w-24 rounded-md border border-white/10 bg-[#1c1c1c] px-2 py-1 text-right text-white"
                              value={veh.mileage.tier2}
                              onChange={(e) =>
                                updateVehicleField(veh.code, (v) => ({
                                  ...v,
                                  mileage: { ...v.mileage, tier2: Number(e.target.value) || 0 },
                                }))
                              }
                            />
                            <span className="text-[11px] text-gray-500">£/mile</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span>&gt; 40 mile</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              className="w-24 rounded-md border border-white/10 bg-[#1c1c1c] px-2 py-1 text-right text-white"
                              value={veh.mileage.tier3}
                              onChange={(e) =>
                                updateVehicleField(veh.code, (v) => ({
                                  ...v,
                                  mileage: { ...v.mileage, tier3: Number(e.target.value) || 0 },
                                }))
                              }
                            />
                            <span className="text-[11px] text-gray-500">£/mile</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/50 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-white">Zone 1-4 override</h3>
                  <p className="text-xs text-gray-400">Rate per mile applied to any leg touching Zones 1-4</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-200">
                  {[exec, lux, mpv].map((veh) => (
                    <label key={veh.code} className="rounded-lg border border-white/10 bg-[#161010] p-3 flex items-center justify-between gap-2">
                      <span>{veh.label}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          className="w-20 rounded-md border border-white/10 bg-[#1c1c1c] px-2 py-1 text-right text-white"
                          value={veh.innerZoneOverride}
                          onChange={(e) =>
                            updateVehicleField(veh.code, (v) => ({
                              ...v,
                              innerZoneOverride: Number(e.target.value) || 0,
                            }))
                          }
                        />
                        <span className="text-[11px] text-gray-500">£/mile</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/50 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold text-white">Google Maps surcharges</h3>
                  <p className="text-xs text-gray-400">Control fees applied in fare calculation</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-200">
                  <label className="rounded-lg border border-white/10 bg-[#161010] p-3 flex items-center justify-between gap-2">
                    <span>Pick-up aeroport</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        className="w-20 rounded-md border border-white/10 bg-[#1c1c1c] px-2 py-1 text-right text-white"
                        value={settings.surcharges.airportPickup}
                        onChange={(e) => updateSurcharge('airportPickup', Number(e.target.value) || 0)}
                      />
                      <span className="text-[11px] text-gray-500">£</span>
                    </div>
                  </label>
                  <label className="rounded-lg border border-white/10 bg-[#161010] p-3 flex items-center justify-between gap-2">
                    <span>Drop-off aeroport</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        className="w-20 rounded-md border border-white/10 bg-[#1c1c1c] px-2 py-1 text-right text-white"
                        value={settings.surcharges.airportDropoff}
                        onChange={(e) => updateSurcharge('airportDropoff', Number(e.target.value) || 0)}
                      />
                      <span className="text-[11px] text-gray-500">£</span>
                    </div>
                  </label>
                  <label className="rounded-lg border border-white/10 bg-[#161010] p-3 flex items-center justify-between gap-2">
                    <span>Central London (Congestion)</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        className="w-20 rounded-md border border-white/10 bg-[#1c1c1c] px-2 py-1 text-right text-white"
                        value={settings.surcharges.congestion}
                        onChange={(e) => updateSurcharge('congestion', Number(e.target.value) || 0)}
                        disabled
                      />
                      <span className="text-[11px] text-gray-500">£</span>
                    </div>
                  </label>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsPage;
