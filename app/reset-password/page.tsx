'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import FormLayout from '@/components/FormLayout';
import Input from '@/components/Input';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordFallback />}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = String(searchParams?.get('token') ?? '').trim();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token) {
      setError('Missing reset token. Please use the link from your email.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to reset password');
      }
      setSuccess(data?.message || 'Password updated successfully. You can sign in now.');
      setPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormLayout title="Reset Password">
      <form onSubmit={handleSubmit} className="space-y-6">
        <Input
          id="new-password"
          label="New Password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          id="confirm-password"
          label="Confirm New Password"
          type="password"
          required
          minLength={8}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
        <button
          type="submit"
          disabled={loading || !token}
          className="w-full px-8 py-3 text-lg font-semibold bg-amber-500 text-black rounded-md hover:bg-amber-400 transition-all duration-300 transform hover:scale-105 shadow-[0_0_15px_rgba(251,191,36,0.5)] disabled:opacity-60"
        >
          {loading ? 'Updating...' : 'Update Password'}
        </button>
        <div className="text-center text-sm text-gray-400 space-y-2">
          <p>
            Back to <Link href="/client/login" className="text-amber-400 hover:underline">Client Login</Link>
          </p>
          <p>
            Back to <Link href="/driver/login" className="text-amber-400 hover:underline">Driver Login</Link>
          </p>
        </div>
      </form>
    </FormLayout>
  );
}

function ResetPasswordFallback() {
  return (
    <FormLayout title="Reset Password">
      <div className="space-y-4">
        <p className="text-sm text-gray-300">Loading reset form...</p>
      </div>
    </FormLayout>
  );
}
