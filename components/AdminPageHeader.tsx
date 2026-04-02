'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

type NavItem = {
  id:
    | 'live'
    | 'clients'
    | 'older'
    | 'drivers'
    | 'blog'
    | 'staff'
    | 'awaiting'
    | 'notifications'
    | 'statements'
    | 'complaints'
    | 'reviews'
    | 'lost-property'
    | 'marketing'
    | 'fleet'
    | 'settings';
  label: string;
  to: string;
  badge?: number;
};

type AdminPageHeaderProps = {
  active: NavItem['id'];
  liveBadgeCount?: number;
  notificationsBadgeCount?: number;
};

const Logo = () => (
  <img src="/assets/logo.png" alt="Velvet Drivers Logo" className="w-[220px] h-auto" />
);

const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({ active, liveBadgeCount, notificationsBadgeCount }) => {
  const { logout } = useAuth();
  const router = useRouter();
  const defaultLiveBadgeCount = 2; // keep visible when no live count is passed from page
  const computedLiveBadge = liveBadgeCount ?? defaultLiveBadgeCount;
  const computedNotificationsBadge = notificationsBadgeCount ?? 0;

  const navItems: NavItem[] = [
    {
      id: 'live',
      label: 'Live Bookings',
      to: '/admin/dashboard',
      badge: computedLiveBadge
    },
    {
      id: 'clients',
      label: 'Clients',
      to: '/admin/clients'
    },
    {
      id: 'staff',
      label: 'Staff',
      to: '/admin/staff'
    },
    {
      id: 'older',
      label: 'Job history',
      to: '/older-bookings'
    },
    {
      id: 'drivers',
      label: 'Drivers',
      to: '/admin/drivers'
    },
    {
      id: 'awaiting',
      label: 'Awaiting Approval',
      to: '/admin/awaiting'
    },
    {
      id: 'notifications',
      label: 'Notifications',
      to: '/admin/notifications',
      badge: computedNotificationsBadge
    },
    {
      id: 'statements',
      label: 'Statements',
      to: '/admin/statements'
    },
    {
      id: 'complaints',
      label: 'Complaint',
      to: '/admin/complaints'
    },
    {
      id: 'reviews',
      label: 'Reviews',
      to: '/admin/reviews'
    },
    {
      id: 'lost-property',
      label: 'Lost Property',
      to: '/admin/lost-property'
    },
    {
      id: 'marketing',
      label: 'Marketing',
      to: '/admin/marketing'
    },
    {
      id: 'blog',
      label: 'Blog',
      to: '/admin/blog'
    },
    {
      id: 'fleet',
      label: 'Fleet Types',
      to: '/admin/fleet'
    },
    {
      id: 'settings',
      label: 'Settings',
      to: '/admin/settings'
    }
  ] as const;

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-b from-black via-[#2d0303] to-black">
      <div className="border-b border-gray-900/80 px-6 py-8" style={{ display:"none" }}>
        <div className="flex justify-center">
          <Logo />
        </div>
      </div>
      <div className="px-6 py-6">
        <div className="border-b border-gray-800/80 pb-6">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div>
              <h1 className="text-3xl font-display font-bold text-amber-400">Admin Dashboard</h1>
              <p className="text-gray-400">Welcome, Administrator</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="px-4 py-2 font-semibold bg-transparent border border-amber-400 text-amber-400 rounded-md hover:bg-amber-400 hover:text-black transition-colors"
            >
              Logout
            </button>
          </div>
          <nav className="mt-6 flex items-center space-x-2 overflow-x-auto pb-2">
            {navItems.map((item) => {
              const isActive = active === item.id;
              const baseClasses =
                'relative px-4 py-2 text-sm font-semibold rounded-md transition-colors whitespace-nowrap flex-shrink-0';
              const activeClasses = 'bg-amber-400 text-black shadow-md shadow-amber-400/20';
              const inactiveClasses = 'bg-gray-800/50 text-amber-300 hover:bg-gray-700/50';
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => router.push(item.to)}
                  className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
                >
                  {item.label}
                  {typeof item.badge === 'number' && item.id === 'notifications' ? (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-[1rem] px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white border border-white/20">
                      {item.badge}
                    </span>
                  ) : typeof item.badge === 'number' && item.badge > 0 ? (
                    <span className="absolute -top-0 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
};

export default AdminPageHeader;
