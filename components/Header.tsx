
'use client';

import Link from 'next/link';
import { Lock, User } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

const Logo = () => (
  <Link href="/" className="z-10">
    <img src="/assets/logo.png" alt="Velvet Drivers Logo" className="w-[220px] h-auto" />
  </Link>
);

const Header = () => {
  const { user } = useAuth();
  const isLoggedIn = Boolean(user);
  const StatusIcon = isLoggedIn ? Lock : User;
  const statusLabel = isLoggedIn ? user?.name || 'Client' : 'Sign In';
  const href = isLoggedIn ? '/client/dashboard' : '/';
  const iconColor = isLoggedIn ? 'text-green-400' : 'text-amber-300';

  return (
    <header className="relative top-0 left-0 right-0 p-6 md:p-8 pb-0 md:pb-0 z-50">
      <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent absolute top-0 left-0" />
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex-1" aria-hidden="true" />
        <div className="flex-shrink-0">
          <Logo />
        </div>
        <div className="flex-1 flex justify-end">
          <Link
            href={href}
            className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-black/30 px-4 py-2 text-xs uppercase tracking-wide text-amber-100/90 hover:bg-black/50 transition-colors"
          >
            <StatusIcon className={`h-4 w-4 ${iconColor}`} />
            <div className="text-left leading-tight login-status hidden md:block">
              <div className="text-sm font-semibold text-white">{statusLabel}</div>
            </div>
          </Link>
        </div>
      </div>
      <div className="w-full h-[1px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent absolute bottom-0 left-0" />
    </header>
  );
};

export default Header;
