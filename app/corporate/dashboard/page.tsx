'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import PageShell from '@/components/PageShell';
import type { Journey } from '@/types';

import ClientHistory from '@/components/client-dashboard/ClientHistory';
import ClientComplain from '@/components/client-dashboard/ClientComplain';
import ClientReview from '@/components/client-dashboard/ClientReview';
import ClientLostProperty from '@/components/client-dashboard/ClientLostProperty';
import CorporateUpdateDetails from '@/components/corporate-dashboard/CorporateUpdateDetails';

const DashboardContentWrapper: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-gradient-to-br from-[#1E1212] via-[#100808] to-black border border-amber-900/50 rounded-2xl p-8 max-w-2xl mx-auto">
    <h2 className="text-2xl font-bold font-display text-amber-400 mb-6">{title}</h2>
    {children}
  </div>
);

const corporateJourneys: Journey[] = [
  {
    id: 1,
    date: '2025-02-01 09:00',
    pickup: 'Canary Wharf',
    destination: 'The Shard',
    driver: 'Robert K.',
    car: 'BMW 7 Series',
    plate: 'RX70DVE',
    serviceType: 'As Directed',
    status: 'Completed',
    price: 95,
    invoiceUrl: null,
  },
  {
    id: 2,
    date: '2025-02-10 14:00',
    pickup: 'LHR T5',
    destination: 'The Ned',
    driver: 'Anna B.',
    car: 'Mercedes V-Class',
    plate: 'AB21LUX',
    serviceType: 'Transfer',
    status: 'Upcoming',
    price: 180,
    invoiceUrl: null,
  },
];

const CorporateDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('History');
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const completedJourneys = corporateJourneys.filter((j) => j.status === 'Completed');

  const tabs = ['History', 'Complain', 'Review', 'Lost property', 'Update Details'];

  const renderContent = () => {
    switch (activeTab) {
      case 'History':
        return <ClientHistory journeys={corporateJourneys} />;
      case 'Complain':
        return (
            <DashboardContentWrapper title="Submit a Complaint">
                <ClientComplain journeys={completedJourneys} isGuest />
            </DashboardContentWrapper>
        );
      case 'Review':
        return (
          <DashboardContentWrapper title="Leave a Review">
                <ClientReview journeys={completedJourneys} isGuest />
          </DashboardContentWrapper>
        );
      case 'Lost property':
        return (
          <DashboardContentWrapper title="Report Lost Property">
                <ClientLostProperty journeys={completedJourneys} isGuest />
          </DashboardContentWrapper>
        );
      case 'Update Details':
        return (
          <DashboardContentWrapper title="Update Your Details">
            <CorporateUpdateDetails />
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
                <h1 className="text-3xl font-bold font-display text-amber-400">Corporate Dashboard</h1>
                <p className="text-gray-400">Welcome back, {user?.name}</p>
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

          <main>{renderContent()}</main>
        </div>
      </div>
    </PageShell>
  );
};

export default CorporateDashboardPage;
