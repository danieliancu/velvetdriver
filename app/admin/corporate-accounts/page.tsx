'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AdminPageHeader from '@/components/AdminPageHeader';

type CorporateAccount = {
  id: number;
  email: string;
  companyName: string;
  contactName: string;
  phone: string;
  billingAddress: string;
  billingEmail: string;
  companyRegNumber: string;
  vatNumber: string;
  estimatedMonthlyJourneys: number | null;
  status: 'pending_approval' | 'approved' | 'rejected' | 'suspended';
  internalNotes: string;
  invoicePaymentsEnabled: boolean;
  creditLimit: number;
  unpaidTotal: number;
  paidTotal: number;
  bookingCount: number;
};

type ReadyBooking = {
  id: number;
  code: string;
  corporateId: number;
  companyName: string;
  journeyDate: string;
  pickup: string;
  destination: string;
  passengerName: string;
  amount: number;
};

type Invoice = {
  id: number;
  reference: string;
  corporateId: number | null;
  companyName: string;
  status: string;
  amount: number;
  subtotal: number;
  vatAmount: number;
  issuedAt: string | null;
  dueAt: string | null;
  bookingRefs: string;
};

const statusLabels: Record<string, string> = {
  pending_approval: 'Pending approval',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
};

const money = (value: number) => `GBP ${Number(value || 0).toFixed(2)}`;

export default function AdminCorporateAccountsPage() {
  const [accounts, setAccounts] = useState<CorporateAccount[]>([]);
  const [readyBookings, setReadyBookings] = useState<ReadyBooking[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState('pending_approval');
  const [drafts, setDrafts] = useState<Record<number, Pick<CorporateAccount, 'status' | 'internalNotes' | 'invoicePaymentsEnabled' | 'creditLimit'>>>({});
  const [selectedBookings, setSelectedBookings] = useState<Record<number, boolean>>({});

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/corporate-accounts', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load corporate accounts');
      setAccounts(data.accounts || []);
      setReadyBookings(data.readyBookings || []);
      setInvoices(data.invoices || []);
      const nextDrafts: typeof drafts = {};
      for (const account of data.accounts || []) {
        nextDrafts[account.id] = {
          status: account.status,
          internalNotes: account.internalNotes || '',
          invoicePaymentsEnabled: Boolean(account.invoicePaymentsEnabled),
          creditLimit: Number(account.creditLimit || 2000),
        };
      }
      setDrafts(nextDrafts);
    } catch (err: any) {
      setError(err?.message || 'Failed to load corporate accounts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const visibleAccounts = useMemo(
    () => accounts.filter((account) => account.status === activeStatus),
    [accounts, activeStatus]
  );

  const updateAccount = async (account: CorporateAccount) => {
    const draft = drafts[account.id];
    if (!draft) return;
    setSaving(`account-${account.id}`);
    setError(null);
    try {
      const res = await fetch('/api/admin/corporate-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_account', corporateId: account.id, ...draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to update account');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update account');
    } finally {
      setSaving(null);
    }
  };

  const generateInvoice = async (corporateId: number) => {
    const bookingIds = readyBookings.filter((b) => b.corporateId === corporateId && selectedBookings[b.id]).map((b) => b.id);
    if (!bookingIds.length) {
      setError('Select at least one completed booking for this company.');
      return;
    }
    setSaving(`invoice-${corporateId}`);
    setError(null);
    try {
      const res = await fetch('/api/admin/corporate-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_invoice', corporateId, bookingIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to generate invoice');
      setSelectedBookings({});
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to generate invoice');
    } finally {
      setSaving(null);
    }
  };

  const updateInvoiceStatus = async (invoiceId: number, status: string) => {
    setSaving(`invoice-status-${invoiceId}`);
    setError(null);
    try {
      const res = await fetch('/api/admin/corporate-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_invoice_status', invoiceId, status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to update invoice');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update invoice');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="w-full p-4 sm:p-6 md:p-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <AdminPageHeader active="corporate" />

          <main className="space-y-6">
            <section className="rounded-2xl border border-gray-800 bg-[#0f0b0b] p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-amber-500">Corporate</p>
                  <h2 className="text-2xl font-semibold">Corporate Accounts</h2>
                </div>
                {error ? <p className="text-sm text-red-300">{error}</p> : null}
              </div>

              <div className="mb-5 flex flex-wrap gap-2">
                {['pending_approval', 'approved', 'rejected', 'suspended'].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setActiveStatus(status)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${
                      activeStatus === status ? 'bg-amber-400 text-black' : 'border border-white/15 text-amber-200'
                    }`}
                  >
                    {statusLabels[status]} ({accounts.filter((a) => a.status === status).length})
                  </button>
                ))}
              </div>

              {loading ? (
                <p className="text-sm text-gray-400">Loading corporate accounts...</p>
              ) : (
                <div className="space-y-4">
                  {visibleAccounts.map((account) => {
                    const draft = drafts[account.id] || account;
                    const companyReadyBookings = readyBookings.filter((booking) => booking.corporateId === account.id);
                    const overLimit = account.unpaidTotal >= Number(draft.creditLimit || 0);
                    return (
                      <article key={account.id} className="rounded-xl border border-white/10 bg-black/40 p-4">
                        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                          <div className="space-y-2 text-sm text-gray-300">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-xl font-semibold text-white">{account.companyName}</h3>
                              <span className="rounded-full border border-amber-400/50 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-amber-200">
                                {statusLabels[account.status]}
                              </span>
                              {overLimit ? (
                                <span className="rounded-full border border-red-400/50 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-red-200">
                                  Credit limit reached
                                </span>
                              ) : null}
                            </div>
                            <p>Contact: <span className="text-white">{account.contactName}</span> / {account.email} / {account.phone}</p>
                            <p>Billing email: <span className="text-white">{account.billingEmail || '-'}</span></p>
                            <p>Billing address: <span className="text-white">{account.billingAddress || '-'}</span></p>
                            <p>Company reg: {account.companyRegNumber || '-'} | VAT number: {account.vatNumber || '-'}</p>
                            <p>Bookings: {account.bookingCount} | Total spent: {money(account.paidTotal + account.unpaidTotal)} | Unpaid: {money(account.unpaidTotal)}</p>
                          </div>
                          <div className="space-y-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <label className="text-xs text-gray-400">
                                Status
                                <select
                                  className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white"
                                  value={draft.status}
                                  onChange={(e) => setDrafts((prev) => ({ ...prev, [account.id]: { ...draft, status: e.target.value as any } }))}
                                >
                                  <option value="pending_approval">Pending approval</option>
                                  <option value="approved">Approved</option>
                                  <option value="rejected">Rejected</option>
                                  <option value="suspended">Suspended</option>
                                </select>
                              </label>
                              <label className="text-xs text-gray-400">
                                Credit limit
                                <input
                                  type="number"
                                  min="0"
                                  className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white"
                                  value={draft.creditLimit}
                                  onChange={(e) => setDrafts((prev) => ({ ...prev, [account.id]: { ...draft, creditLimit: Number(e.target.value) || 0 } }))}
                                />
                              </label>
                            </div>
                            <label className="flex items-center gap-2 text-sm text-gray-200">
                              <input
                                type="checkbox"
                                checked={Boolean(draft.invoicePaymentsEnabled)}
                                onChange={(e) => setDrafts((prev) => ({ ...prev, [account.id]: { ...draft, invoicePaymentsEnabled: e.target.checked } }))}
                              />
                              Pay by Invoice enabled for this account
                            </label>
                            <label className="block text-xs text-gray-400">
                              Internal notes
                              <textarea
                                rows={3}
                                className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white"
                                value={draft.internalNotes}
                                onChange={(e) => setDrafts((prev) => ({ ...prev, [account.id]: { ...draft, internalNotes: e.target.value } }))}
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => updateAccount(account)}
                              disabled={saving === `account-${account.id}`}
                              className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-60"
                            >
                              {saving === `account-${account.id}` ? 'Saving...' : 'Save account'}
                            </button>
                          </div>
                        </div>

                        {companyReadyBookings.length ? (
                          <div className="mt-5 rounded-lg border border-white/10 bg-black/30 p-4">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                              <h4 className="font-semibold text-white">Ready for invoicing</h4>
                              <button
                                type="button"
                                onClick={() => generateInvoice(account.id)}
                                disabled={saving === `invoice-${account.id}`}
                                className="rounded-md border border-emerald-400 bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
                              >
                                Generate invoice
                              </button>
                            </div>
                            <div className="space-y-2">
                              {companyReadyBookings.map((booking) => (
                                <label key={booking.id} className="flex items-start gap-3 text-sm text-gray-300">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(selectedBookings[booking.id])}
                                    onChange={(e) => setSelectedBookings((prev) => ({ ...prev, [booking.id]: e.target.checked }))}
                                    className="mt-1"
                                  />
                                  <span>
                                    <span className="font-semibold text-white">{booking.code}</span> {booking.passengerName} - {money(booking.amount)}
                                    <span className="block text-xs text-gray-500">{booking.pickup} to {booking.destination}</span>
                                  </span>
                                </label>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                  {!visibleAccounts.length ? <p className="text-sm text-gray-400">No corporate accounts in this status.</p> : null}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-gray-800 bg-[#0f0b0b] p-6">
              <h2 className="mb-4 text-2xl font-semibold">Invoice Management</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase tracking-[0.18em] text-gray-400">
                    <tr>
                      <th className="px-3 py-2">Invoice</th>
                      <th className="px-3 py-2">Company</th>
                      <th className="px-3 py-2">Bookings</th>
                      <th className="px-3 py-2">Due</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="px-3 py-3 font-semibold text-white">{invoice.reference}</td>
                        <td className="px-3 py-3 text-gray-300">{invoice.companyName}</td>
                        <td className="px-3 py-3 text-gray-300">{invoice.bookingRefs || '-'}</td>
                        <td className="px-3 py-3 text-gray-300">{invoice.dueAt ? new Date(invoice.dueAt).toLocaleDateString('en-GB') : '-'}</td>
                        <td className="px-3 py-3 text-gray-300">{money(invoice.amount)}</td>
                        <td className="px-3 py-3">
                          <select
                            className="rounded-lg border border-white/10 bg-black px-2 py-1 text-sm text-white"
                            value={invoice.status}
                            onChange={(e) => updateInvoiceStatus(invoice.id, e.target.value)}
                            disabled={saving === `invoice-status-${invoice.id}`}
                          >
                            {['Pending', 'Sent', 'Paid', 'Overdue', 'Cancelled'].map((status) => (
                              <option key={status} value={status}>{status}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!invoices.length ? <p className="text-sm text-gray-400">No invoices yet.</p> : null}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
