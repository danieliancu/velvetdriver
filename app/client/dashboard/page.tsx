'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import PageShell from '@/components/PageShell';
import type { Journey, SavedQuote } from '@/types';
import ClientHistory from '@/components/client-dashboard/ClientHistory';
import ClientComplain from '@/components/client-dashboard/ClientComplain';
import ClientReview from '@/components/client-dashboard/ClientReview';
import ClientLostProperty from '@/components/client-dashboard/ClientLostProperty';
import ClientUpdateDetails from '@/components/client-dashboard/ClientUpdateDetails';

const DashboardContentWrapper: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-gradient-to-br from-[#1E1212] via-[#100808] to-black border border-amber-900/50 rounded-2xl p-8 max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold font-display text-amber-400 mb-6">{title}</h2>
        {children}
    </div>
);


const ClientDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('History');
  const { user, logout } = useAuth();
  const router = useRouter();
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [profile, setProfile] = useState<{ name: string; phone?: string | null } | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [deletingQuoteId, setDeletingQuoteId] = useState<SavedQuote['id'] | null>(null);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  useEffect(() => {
    if (!user) {
      router.replace('/client/login');
    }
  }, [user, router]);

  useEffect(() => {
    if (!user?.email) {
      setHistoryLoading(false);
      setProfileLoading(false);
      setSavedQuotes([]);
      setSavedLoading(false);
      return;
    }
    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const res = await fetch(`/api/client/history?email=${encodeURIComponent(user.email)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('history');
        const data = (await res.json()) as { journeys: Journey[] };
        setJourneys(data.journeys || []);
      } catch {
        setJourneys([]);
      } finally {
        setHistoryLoading(false);
      }
    };
    const loadProfile = async () => {
      setProfileLoading(true);
      try {
        const res = await fetch(`/api/client/profile?email=${encodeURIComponent(user.email)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('profile');
        const data = await res.json();
        setProfile({ name: data.name, phone: data.phone });
      } catch {
        setProfile({ name: user.name, phone: user.phone });
      } finally {
        setProfileLoading(false);
      }
    };
    const loadSavedQuotes = async () => {
      setSavedLoading(true);
      try {
        const res = await fetch(`/api/client/saved-quotes?email=${encodeURIComponent(user.email)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('saved');
        const data = (await res.json()) as { quotes: SavedQuote[] };
        setSavedQuotes(data.quotes || []);
      } catch {
        setSavedQuotes([]);
      } finally {
        setSavedLoading(false);
      }
    };
    loadHistory();
    loadProfile();
    loadSavedQuotes();
  }, [user?.email]);

  const handleDeleteQuote = async (quoteId: SavedQuote['id']) => {
    if (!user?.email) return;
    setDeletingQuoteId(quoteId);
    try {
      const res = await fetch('/api/client/saved-quotes', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, id: quoteId }),
      });
      if (!res.ok) throw new Error('delete');
      setSavedQuotes((prev) => prev.filter((quote) => quote.id !== quoteId));
    } catch (err) {
      console.error('Failed to delete quote', err);
    } finally {
      setDeletingQuoteId(null);
    }
  };

  const memoizedJourneys = useMemo(() => journeys, [journeys]);

  const tabs = ['History', 'Complain', 'Review', 'Lost property', 'Update Details'];

  const renderContent = () => {
    switch (activeTab) {
      case 'History':
        return (
          <ClientHistory
            journeys={journeys}
            loading={historyLoading}
            savedQuotes={savedQuotes}
            savedLoading={savedLoading}
            onSelectSaved={(quoteId) => router.push(`/booking?saved=${quoteId}`)}
            onDeleteSaved={handleDeleteQuote}
            deletingSavedId={deletingQuoteId}
          />
        );
      case 'Complain':
        return (
            <DashboardContentWrapper title="Complaint/Compliment">
                <ClientComplain email={user?.email || ''} journeys={memoizedJourneys} showSubjectInput={false} />
            </DashboardContentWrapper>
        );
      case 'Review':
        return (
            <DashboardContentWrapper title="Leave a Review">
                <ClientReview email={user?.email || ''} journeys={memoizedJourneys} />
            </DashboardContentWrapper>
        );
      case 'Lost property':
        return (
            <DashboardContentWrapper title="Report Lost Property">
                <ClientLostProperty email={user?.email || ''} journeys={memoizedJourneys} />
            </DashboardContentWrapper>
        );
      case 'Update Details':
        return (
             <DashboardContentWrapper title="Update Your Details">
                {profileLoading ? <p className="text-sm text-gray-400">Loading profile...</p> : user?.email ? <ClientUpdateDetails email={user.email} profile={profile || undefined} /> : <p className="text-sm text-gray-400">Please sign in.</p>}
            </DashboardContentWrapper>
        );
      default:
        return <ClientHistory />;
    }
  };

  return (
    <PageShell mainClassName="flex flex-col px-4 sm:px-6 md:px-8 py-10">
      <div className="w-full flex-grow">
        <div className="max-w-7xl mx-auto">
          <header className="mb-8">
            <div className="flex flex-wrap justify-between items-center gap-4 pb-4 border-b border-gray-800">
              <div>
                <h1 className="text-3xl font-bold font-display text-amber-400">Client Dashboard</h1>
                <p className="text-gray-400">Welcome back, {profile?.name || user?.name}</p>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 font-semibold bg-transparent border border-amber-400 text-amber-400 rounded-md hover:bg-amber-400 hover:text-black transition-colors"
              >
                Logout
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

          <main>{user?.email ? renderContent() : <p className="text-center text-gray-400">Please sign in to view your dashboard.</p>}</main>
        </div>
      </div>
    </PageShell>
  );
};

export default ClientDashboardPage;
