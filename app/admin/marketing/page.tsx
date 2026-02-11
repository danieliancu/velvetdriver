'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminPageHeader from '@/components/AdminPageHeader';

type MarketingRule = {
  id: number;
  code: string;
  name: string;
  from: string | null;
  to: string | null;
  amount: number;
  unit: 'fixed' | 'percent';
  isActive: boolean;
};

const AdminMarketingPage = () => {
  const [rules, setRules] = useState<MarketingRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [unit, setUnit] = useState<MarketingRule['unit']>('percent');
  const [isActive, setIsActive] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);

  const isValid = useMemo(
    () => !!code.trim() && !!name.trim() && amount !== '',
    [code, name, amount]
  );

  const loadRules = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/discount-codes', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load discount codes');
      const data = await res.json();
      const mapped = Array.isArray(data.codes)
        ? data.codes.map((entry: any) => ({
            id: Number(entry.id),
            code: String(entry.code || ''),
            name: String(entry.name || ''),
            from: entry.startsAt ? String(entry.startsAt).slice(0, 10) : null,
            to: entry.endsAt ? String(entry.endsAt).slice(0, 10) : null,
            amount: Number(entry.amount || 0),
            unit: entry.type === 'fixed' ? 'fixed' : 'percent',
            isActive: Boolean(entry.isActive),
          }))
        : [];
      setRules(mapped);
    } catch (err: any) {
      setError(err?.message || 'Failed to load discount codes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, []);

  const handleSave = async () => {
    if (!isValid || amount === '') return;
    try {
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch('/api/admin/discount-codes', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          code: code.trim(),
          name: name.trim(),
          amount: Number(amount),
          type: unit,
          startsAt: from || null,
          endsAt: to || null,
          isActive,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to save discount code');
      }
      await loadRules();
    } catch (err: any) {
      setError(err?.message || 'Failed to save discount code');
      return;
    }
    setCode('');
    setName('');
    setFrom('');
    setTo('');
    setAmount('');
    setUnit('percent');
    setIsActive(true);
    setEditingId(null);
  };

  const toggleActive = async (id: number, next: boolean) => {
    try {
      const res = await fetch('/api/admin/discount-codes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: next }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, isActive: next } : rule)));
    } catch (err: any) {
      setError(err?.message || 'Failed to update status');
    }
  };

  const handleEdit = (rule: MarketingRule) => {
    setEditingId(rule.id);
    setCode(rule.code);
    setName(rule.name);
    setFrom(rule.from || '');
    setTo(rule.to || '');
    setAmount(rule.amount);
    setUnit(rule.unit);
    setIsActive(rule.isActive);
  };

  const handleDelete = async (id: number) => {
    setActionBusyId(id);
    try {
      const res = await fetch('/api/admin/discount-codes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to delete discount code');
      }
      setRules((prev) => prev.filter((rule) => rule.id !== id));
      if (editingId === id) {
        setEditingId(null);
        setCode('');
        setName('');
        setFrom('');
        setTo('');
        setAmount('');
        setUnit('percent');
        setIsActive(true);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to delete discount code');
    } finally {
      setActionBusyId(null);
    }
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
                <p className="text-sm text-gray-400">Configure discount codes.</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-4">
              <div className="sm:col-span-1">
                <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Code</label>
                <input
                  className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="SAVE10"
                />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Name</label>
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

            <div className="grid gap-4 sm:grid-cols-4">
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
                <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Type</label>
                <select
                  className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as MarketingRule['unit'])}
                >
                  <option value="fixed">Fixed (£)</option>
                  <option value="percent">Percent (%)</option>
                </select>
              </div>
              <div className="sm:col-span-1">
                <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Active</label>
                <button
                  type="button"
                  onClick={() => setIsActive((prev) => !prev)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                    isActive
                      ? 'border-emerald-400 bg-emerald-500/15 text-emerald-200'
                      : 'border-white/10 bg-black/30 text-gray-400'
                  }`}
                >
                  {isActive ? 'Active' : 'Inactive'}
                </button>
              </div>
              <div className="sm:col-span-1 flex items-end">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!isValid}
                  className="w-full rounded-lg border border-amber-400 bg-amber-400 px-3 py-2 text-sm font-semibold text-black shadow-[0_0_15px_rgba(251,191,36,0.35)] hover:shadow-[0_0_25px_rgba(251,191,36,0.55)] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingId ? 'Update' : 'Save'}
                </button>
              </div>
            </div>

            {error ? (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-300">Existing</h3>
              <div className="space-y-2">
                {loading ? (
                  <p className="text-sm text-gray-400">Loading...</p>
                ) : rules.length ? (
                  rules.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-900/40 bg-gradient-to-r from-[#1A0B0B] via-[#0F0909] to-black px-4 py-3 text-sm text-white"
                    >
                      <span className="font-semibold text-amber-200">{rule.code}</span>
                      <span className="text-white/80">{rule.name}</span>
                      {rule.from ? <span className="text-gray-400">From {rule.from}</span> : null}
                      {rule.to ? <span className="text-gray-400">To {rule.to}</span> : null}
                      <span className="ml-auto font-semibold text-amber-300">
                        {rule.unit === 'fixed' ? '£' : ''}
                        {rule.amount}
                        {rule.unit === 'percent' ? '%' : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleActive(rule.id, !rule.isActive)}
                        className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-wide ${
                          rule.isActive
                            ? 'border-emerald-400 text-emerald-200'
                            : 'border-white/10 text-gray-400'
                        }`}
                      >
                        {rule.isActive ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEdit(rule)}
                        className="rounded-full border border-amber-400/70 px-3 py-1 text-[11px] uppercase tracking-wide text-amber-200 hover:bg-amber-500/10"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(rule.id)}
                        disabled={actionBusyId === rule.id}
                        className="rounded-full border border-red-500/70 px-3 py-1 text-[11px] uppercase tracking-wide text-red-200 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionBusyId === rule.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400">No discount codes yet.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AdminMarketingPage;
