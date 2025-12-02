'use client';

import Link from 'next/link';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import FormLayout from '@/components/FormLayout';
import Input from '@/components/Input';
import { useAuth } from '@/lib/auth-context';
import { Role } from '@/types';

export default function CorporateLoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const handleLogin = (event: FormEvent) => {
    event.preventDefault();
    login(Role.CLIENT);
    router.push('/corporate/dashboard');
  };

  return (
    <FormLayout title="Corporate Sign In">
      <form onSubmit={handleLogin} className="space-y-6">
        <Input id="email" label="Work Email Address" type="email" required />
        <Input id="password" label="Password" type="password" required />
        <button
          type="submit"
          className="w-full px-8 py-3 text-lg font-semibold bg-amber-500 text-black rounded-md hover:bg-amber-400 transition-all duration-300 transform hover:scale-105 shadow-[0_0_15px_rgba(251,191,36,0.5)]"
        >
          Sign In
        </button>
        <p className="text-center text-sm text-gray-400">
          Need a corporate account?{' '}
          <Link href="/corporate/signup" className="font-medium text-amber-400 hover:underline">
            Request access
          </Link>
        </p>
      </form>
    </FormLayout>
  );
}
