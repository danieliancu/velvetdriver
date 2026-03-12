'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import FormLayout from '@/components/FormLayout';
import Input from '@/components/Input';
import Modal from '@/components/Modal';
import { useAuth } from '@/lib/auth-context';
import { Role } from '@/types';

export default function CorporateLoginPage() {
  const router = useRouter();
  const { login, user } = useAuth();
  const [isRecoverModalOpen, setRecoverModalOpen] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState('');
  const [recoverMessage, setRecoverMessage] = useState<string | null>(null);
  const [recoverLoading, setRecoverLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, expectedRole: 'corporate' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to sign in');
      }
      const data = await res.json();
      if (data.role !== 'corporate') {
        throw new Error('This account is not a corporate account.');
      }
      login(Role.CORPORATE, { id: data.id, name: data.name, email: data.email, phone: data.phone });
      router.push('/corporate/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    if (user.role === Role.CORPORATE) {
      router.replace('/corporate/dashboard');
      return;
    }
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

  const handleRecoverSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setRecoverMessage(null);
    setRecoverLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoverEmail, expectedRole: 'corporate' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to process password recovery.');
      }
      setRecoverMessage(data?.message || 'If this email is on file, we will send reset instructions shortly.');
    } catch (err: any) {
      setRecoverMessage(err?.message || 'Failed to process password recovery.');
    } finally {
      setRecoverLoading(false);
    }
  };

  return (
    <FormLayout title="Corporate Sign In">
      <form onSubmit={handleLogin} className="space-y-6">
        <Input id="email" label="Work Email Address" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input id="password" label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full px-8 py-3 text-lg font-semibold bg-amber-500 text-black rounded-md hover:bg-amber-400 transition-all duration-300 transform hover:scale-105 shadow-[0_0_15px_rgba(251,191,36,0.5)]"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
        <p className="text-center text-sm text-gray-400">
          Need a corporate account?{' '}
          <Link href="/corporate/signup" className="font-medium text-amber-400 hover:underline">
            Request access
          </Link>
        </p>
        <p className="text-center text-sm text-gray-400">
          <button
            type="button"
            onClick={() => {
              setRecoverEmail('');
              setRecoverMessage(null);
              setRecoverModalOpen(true);
            }}
            className="font-medium text-amber-400 hover:underline"
          >
            Forgot Password?
          </button>
        </p>
      </form>
      <Modal
        isOpen={isRecoverModalOpen}
        onClose={() => setRecoverModalOpen(false)}
        title="Recover Password"
      >
        <form onSubmit={handleRecoverSubmit} className="space-y-4">
          <Input
            id="recover-email-corporate"
            label="Email Address"
            type="email"
            required
            value={recoverEmail}
            onChange={(e) => setRecoverEmail(e.target.value)}
          />
          {recoverMessage && <p className="text-sm text-amber-300">{recoverMessage}</p>}
          <button
            type="submit"
            disabled={recoverLoading}
            className="w-full rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-400"
          >
            {recoverLoading ? 'Sending...' : 'Continue'}
          </button>
        </form>
      </Modal>
    </FormLayout>
  );
}
