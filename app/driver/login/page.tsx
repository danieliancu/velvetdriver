'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import FormLayout from '@/components/FormLayout';
import Input from '@/components/Input';
import Modal from '@/components/Modal';
import { useAuth } from '@/lib/auth-context';
import { Role } from '@/types';

export default function DriverLoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [isRecoverModalOpen, setRecoverModalOpen] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState('');
  const [recoverMessage, setRecoverMessage] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to sign in');
      }
      const data = await res.json();
      if (data.role !== 'driver') {
        throw new Error('This account is not a driver.');
      }
      login(Role.DRIVER, { id: data.id, name: data.name, email: data.email, phone: data.phone });
      router.push('/driver/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverSubmit = (event: FormEvent) => {
    event.preventDefault();
    setRecoverMessage('If this email is on file, we will send reset instructions shortly.');
  };

  return (
    <FormLayout title="Driver Sign In">
      <form onSubmit={handleLogin} className="space-y-6">
        <Input id="email" label="Email Address" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input id="password" label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          className="w-full px-8 py-3 text-lg font-semibold bg-amber-500 text-black rounded-md hover:bg-amber-400 transition-all duration-300 transform hover:scale-105 shadow-[0_0_15px_rgba(251,191,36,0.5)] disabled:opacity-60"
          disabled={loading}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
        <p className="text-center text-sm text-gray-400">
          Not a registered driver?{' '}
          <Link href="/driver/signup" className="font-medium text-amber-400 hover:underline">
            Sign Up
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
            id="recover-email-driver"
            label="Email Address"
            type="email"
            required
            value={recoverEmail}
            onChange={(e) => setRecoverEmail(e.target.value)}
          />
          {recoverMessage && <p className="text-sm text-amber-300">{recoverMessage}</p>}
          <button
            type="submit"
            className="w-full rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-amber-400"
          >
            Continue
          </button>
        </form>
      </Modal>
    </FormLayout>
  );
}
