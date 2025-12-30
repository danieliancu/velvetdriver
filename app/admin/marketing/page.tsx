'use client';

import { useMemo, useState } from 'react';
import AdminPageHeader from '@/components/AdminPageHeader';

type MarketingRule = {
  id: string;
  name: string;
  from: string;
  to: string;
  amount: number;
  unit: '£' | '%';
};

const seedRules: MarketingRule[] = [
  { id: 'mk-1', name: 'Autumn loyalty push', from: '2025-09-01', to: '2025-11-30', amount: 15, unit: '%' },
  { id: 'mk-2', name: 'Airport flat bonus', from: '2025-10-15', to: '2025-12-31', amount: 12, unit: '£' },
  { id: 'mk-3', name: 'VIP reactivation', from: '2025-11-01', to: '2026-01-15', amount: 20, unit: '%' }
] as const;

const AdminMarketingPage = () => {
  const [rules, setRules] = useState<MarketingRule[]>(seedRules);
  const [name, setName] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [unit, setUnit] = useState<MarketingRule['unit']>('%');

  const isValid = useMemo(() => !!name.trim() && !!from && !!to && amount !== '', [name, from, to, amount]);

  const handleSave = () => {
    if (!isValid || amount === '') return;
    const newRule: MarketingRule = {
      id: `mk-${rules.length + 1}`,
      name: name.trim(),
      from,
      to,
      amount: Number(amount),
      unit
    };
    setRules((prev) => [newRule, ...prev]);
    setName('');
    setFrom('');
    setTo('');
    setAmount('');
    setUnit('%');
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="w-full flex-grow p-4 sm:p-6 md:p-8">
        <div className="max-w-6xl mx-auto w-full space-y-8">
          <AdminPageHeader active="marketing" />

          <section className="rounded-2xl border border-white/10 bg-black/60 p-6 space-y-6 shadow-lg shadow-black/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">Marketing</h2>
                <p className="text-sm text-gray-400">Configure loyalty incentives.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Loyalty Name</label>
                <input
                  className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Example: Airport return"
                />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">From</label>
                <input
                  type="date"
                  className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">To</label>
                <input
                  type="date"
                  className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Amount</label>
                <input
                  type="number"
                  className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  min="0"
                  step="0.5"
                />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Unit</label>
                <select
                  className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as MarketingRule['unit'])}
                >
                  <option value="£">£</option>
                  <option value="%">%</option>
                </select>
              </div>
              <div className="sm:col-span-1 flex items-end">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!isValid}
                  className="w-full rounded-lg border border-amber-400 bg-amber-400 px-3 py-2 text-sm font-semibold text-black shadow-[0_0_15px_rgba(251,191,36,0.35)] hover:shadow-[0_0_25px_rgba(251,191,36,0.55)] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-300">Existing</h3>
              <div className="space-y-2">
                {rules.slice(0, 3).map((rule) => (
                  <div
                    key={rule.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-900/40 bg-gradient-to-r from-[#1A0B0B] via-[#0F0909] to-black px-4 py-3 text-sm text-white"
                  >
                    <span className="font-semibold text-amber-200">{rule.name}</span>
                    <span className="text-gray-400">From {rule.from}</span>
                    <span className="text-gray-400">To {rule.to}</span>
                    <span className="ml-auto font-semibold text-amber-300">
                      {rule.unit === '£' ? '£' : ''}
                      {rule.amount}
                      {rule.unit === '%' ? '%' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AdminMarketingPage;
