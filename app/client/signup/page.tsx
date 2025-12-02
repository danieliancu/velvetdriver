'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import FormLayout from '@/components/FormLayout';
import Input from '@/components/Input';
import { useAuth } from '@/lib/auth-context';
import { Role } from '@/types';

export default function ClientSignUpPage() {
  const router = useRouter();
  const { login, user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== repeatPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      login(Role.CLIENT, { id: data?.id, name, email, phone });
      router.push('/client/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      router.replace('/client/dashboard');
    }
  }, [user, router]);

  return (
    <FormLayout title="Sign Up">
      <form onSubmit={handleSignUp} className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-300 pb-2">Personal Details</h3>
        <Input id="name" label="Full Name" type="text" required value={name} onChange={(e) => setName(e.target.value)} />
        <Input id="email" label="Email Address" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input id="phone" label="Phone Number" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input id="password" label="Create Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Input
          id="repeatPassword"
          label="Repeat Password"
          type="password"
          required
          value={repeatPassword}
          onChange={(e) => setRepeatPassword(e.target.value)}
        />

        <div className="space-y-2 pt-2">
          <label className="flex items-start gap-3 text-sm text-gray-200">
            <input
              type="checkbox"
              required
              className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
            />
            <span>
              I agree to the{' '}
              <Link href="/legal/passenger-policies" className="text-amber-300 hover:text-amber-200 underline underline-offset-4">
                Terms &amp; Conditions
              </Link>
              .
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-gray-200">
            <input
              type="checkbox"
              required
              className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
            />
            <span>
              I consent to data processing under the{' '}
              <Link href="/legal/privacy-data" className="text-amber-300 hover:text-amber-200 underline underline-offset-4">
                Privacy Policy
              </Link>
              .
            </span>
          </label>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="pt-4">
          <button
            type="submit"
            className="w-full px-8 py-3 text-lg font-semibold bg-amber-500 text-black rounded-md hover:bg-amber-400 transition-all duration-300 transform hover:scale-105 shadow-[0_0_15px_rgba(251,191,36,0.5)] disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </div>
        <p className="text-center text-sm text-gray-400 pt-4">
          Already have an account?{' '}
          <Link href="/client/login" className="font-medium text-amber-400 hover:underline">
            Sign In
          </Link>
        </p>
      </form>
    </FormLayout>
  );
}
