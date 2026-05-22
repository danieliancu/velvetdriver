'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Role, type Journey } from '@/types';
import PageShell from '@/components/PageShell';
import ClientHistory from '@/components/client-dashboard/ClientHistory';
import ClientComplain from '@/components/client-dashboard/ClientComplain';
import ClientReview from '@/components/client-dashboard/ClientReview';
import ClientLostProperty from '@/components/client-dashboard/ClientLostProperty';
import CorporateUpdateDetails from '@/components/corporate-dashboard/CorporateUpdateDetails';
import { useAlert } from '@/components/AlertProvider';

type CorporateProfile = {
  email: string;
  companyName: string;
  businessAddress: string;
  companyRegNumber: string;
  vatNumber: string;
  businessType: string;
  contactName: string;
  contactTitle: string;
  contactPhone: string;
  accountsName: string;
  accountsEmail: string;
  accountsPhone: string;
  billingAddress: string;
  invoiceMethod: string;
  estimatedJourneys: string;
  vehicleTypes: string;
  serviceNotes: string;
  paymentMethod: string;
  poRequired: string;
  invoiceEmail: string;
  journeyTypes: string[];
  corporateStatus?: string | null;
};

type CorporateInvoice = {
  id: number;
  reference: string;
  status: string;
  amount: number;
  issuedAt: string;
  dueAt: string;
  paidAt?: string;
  bookingRefs: string;
  pdfUrl?: string | null;
};

const DashboardContentWrapper: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-gradient-to-br from-[#1E1212] via-[#100808] to-black border border-amber-900/50 rounded-2xl p-8 max-w-2xl mx-auto">
    <h2 className="text-2xl font-bold font-display text-amber-400 mb-6">{title}</h2>
    {children}
  </div>
);

const CorporateDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('History');
  const { user, logout } = useAuth();
  const { showAlert } = useAlert();
  const router = useRouter();

  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [invoices, setInvoices] = useState<CorporateInvoice[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [profile, setProfile] = useState<CorporateProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const handleDeleteAccount = async () => {
    if (!user?.email) return;
    const confirmed = window.confirm('Are you sure you want to permanently delete your corporate account?');
    if (!confirmed) return;
    setDeletingAccount(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, expectedRole: 'corporate' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to delete account');
      logout();
      router.push('/');
    } catch (err: any) {
      showAlert(err?.message || 'Failed to delete account');
    } finally {
      setDeletingAccount(false);
    }
  };

  useEffect(() => {
    if (!user) {
      router.replace('/corporate/login');
      return;
    }
    if (user.role === Role.CORPORATE) return;
    if (user.role === Role.ADMIN) {
      router.replace('/admin/dashboard');
      return;
    }
    if (user.role === Role.DRIVER) {
      router.replace('/driver/dashboard');
      return;
    }
    router.replace('/client/dashboard');
  }, [router, user]);

  const loadHistory = React.useCallback(async () => {
    if (!user?.email) {
      setJourneys([]);
      setHistoryLoading(false);
      return;
    }
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/corporate/history?email=${encodeURIComponent(user.email)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('history');
      const data = (await res.json()) as { journeys: Journey[]; invoices?: CorporateInvoice[] };
      setJourneys(Array.isArray(data.journeys) ? data.journeys : []);
      setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
    } catch {
      setJourneys([]);
      setInvoices([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [user?.email]);

  const loadProfile = React.useCallback(async () => {
    if (!user?.email) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/corporate/profile?email=${encodeURIComponent(user.email)}`, { cache: 'no-store' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to load profile');
      }
      const data = await res.json();
      setProfile(data as CorporateProfile);
    } catch (err: any) {
      showAlert(err?.message || 'Failed to load corporate profile.');
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, [showAlert, user?.email]);

  useEffect(() => {
    if (!user?.email || user.role !== Role.CORPORATE) {
      setHistoryLoading(false);
      setProfileLoading(false);
      return;
    }
    loadHistory();
    loadProfile();
  }, [loadHistory, loadProfile, user?.email, user?.role]);

  const handleSaveProfile = async (payload: {
    companyName: string;
    businessAddress: string;
    companyRegNumber: string;
    vatNumber: string;
    businessType: string;
    contactName: string;
    contactTitle: string;
    contactEmail: string;
    contactPhone: string;
    accountsName: string;
    accountsEmail: string;
    accountsPhone: string;
    billingAddress: string;
    invoiceMethod: string;
    estimatedJourneys: string;
    vehicleTypes: string;
    serviceNotes: string;
    paymentMethod: string;
    poRequired: string;
    invoiceEmail: string;
    journeyTypes: string[];
    newPassword?: string;
  }) => {
    if (!user?.email) return;
    setProfileSaving(true);
    try {
      const res = await fetch('/api/corporate/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, email: user.email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to update profile');
      }
      showAlert('Corporate details updated.');
      await loadProfile();
    } catch (err: any) {
      showAlert(err?.message || 'Failed to update corporate details.');
    } finally {
      setProfileSaving(false);
    }
  };

  const completedJourneys = useMemo(() => journeys.filter((j) => j.status === 'Completed'), [journeys]);
  const tabs = ['History', 'Invoices', 'Complain', 'Review', 'Lost property', 'Update Details'];

  const renderContent = () => {
    switch (activeTab) {
      case 'History':
        return <ClientHistory journeys={journeys} loading={historyLoading} />;
      case 'Invoices':
        return (
          <DashboardContentWrapper title="Invoices">
            {historyLoading ? (
              <p className="text-sm text-gray-400">Loading invoices...</p>
            ) : invoices.length ? (
              <div className="space-y-3">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-gray-300">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-white">{invoice.reference}</p>
                      <span className="rounded-full border border-amber-400/50 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-amber-200">
                        {invoice.status}
                      </span>
                    </div>
                    <p className="mt-2">Bookings: {invoice.bookingRefs || '-'}</p>
                    <p>Amount: GBP {invoice.amount.toFixed(2)}</p>
                    <p>Issued: {invoice.issuedAt} | Due: {invoice.dueAt}</p>
                    {invoice.pdfUrl ? (
                      <a href={invoice.pdfUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-amber-300 underline">
                        Download invoice PDF
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No corporate invoices yet.</p>
            )}
          </DashboardContentWrapper>
        );
      case 'Complain':
        return (
          <DashboardContentWrapper title="Submit a Complaint">
            <ClientComplain
              isGuest
              email={user?.email || ''}
              userName={profile?.contactName || user?.name || ''}
              userPhone={profile?.contactPhone || user?.phone || ''}
              journeys={completedJourneys}
              showSubjectInput={false}
            />
          </DashboardContentWrapper>
        );
      case 'Review':
        return (
          <DashboardContentWrapper title="Leave a Review">
            <ClientReview
              isGuest
              email={user?.email || ''}
              userName={profile?.contactName || user?.name || ''}
              journeys={completedJourneys}
            />
          </DashboardContentWrapper>
        );
      case 'Lost property':
        return (
          <DashboardContentWrapper title="Report Lost Property">
            <ClientLostProperty
              isGuest
              email={user?.email || ''}
              userName={profile?.contactName || user?.name || ''}
              userPhone={profile?.contactPhone || user?.phone || ''}
              journeys={completedJourneys}
            />
          </DashboardContentWrapper>
        );
      case 'Update Details':
        return (
          <DashboardContentWrapper title="Update Your Details">
            {profileLoading ? (
              <p className="text-sm text-gray-400">Loading profile...</p>
            ) : (
              <CorporateUpdateDetails
                profile={{
                  ...profile,
                  contactEmail: user?.email || profile?.email || '',
                }}
                onSubmit={handleSaveProfile}
                saving={profileSaving}
              />
            )}
          </DashboardContentWrapper>
        );
      default:
        return <ClientHistory journeys={journeys} loading={historyLoading} />;
    }
  };

  return (
    <PageShell mainClassName="flex flex-col px-4 sm:px-6 md:px-8 py-10">
      <div className="w-full flex-grow">
        <div className="max-w-7xl mx-auto">
          <header className="mb-8">
            <div className="flex flex-wrap justify-between items-center gap-4 pb-4 border-b border-gray-800">
              <div>
                <h1 className="text-3xl font-bold font-display text-amber-400">Corporate Dashboard</h1>
                <p className="text-gray-400">Welcome back, {profile?.contactName || user?.name}</p>
                {profile?.corporateStatus && !['active', 'approved'].includes(profile.corporateStatus) ? (
                  <p className="text-xs text-amber-300 mt-1 uppercase tracking-[0.2em]">
                    Account status: {profile.corporateStatus}
                  </p>
                ) : null}
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 font-semibold bg-transparent border border-amber-400 text-amber-400 rounded-md hover:bg-amber-400 hover:text-black transition-colors"
              >
                Logout
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deletingAccount}
                className="px-4 py-2 font-semibold bg-red-600 border border-red-500 text-white rounded-md hover:bg-red-500 transition-colors disabled:opacity-60"
              >
                {deletingAccount ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
            <nav className="mt-6 flex items-center space-x-2 overflow-x-auto pb-2">
              <button
                onClick={() => router.push('/booking')}
                className="px-6 py-2 text-sm font-semibold rounded-md transition-colors whitespace-nowrap bg-green-600 text-white"
              >
                Book a Journey!
              </button>
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative px-4 py-2 text-sm font-semibold rounded-md transition-colors whitespace-nowrap ${
                    activeTab === tab
                      ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20'
                      : 'bg-gray-800/50 text-amber-300 hover:bg-gray-700/50'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </header>

          <main>{user?.role === Role.CORPORATE ? renderContent() : null}</main>
        </div>
      </div>
    </PageShell>
  );
};

export default CorporateDashboardPage;
