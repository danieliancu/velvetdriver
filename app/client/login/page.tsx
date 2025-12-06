'use client';

import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import FormLayout from '@/components/FormLayout';
import Input from '@/components/Input';
import Modal from '@/components/Modal';
import { useAuth } from '@/lib/auth-context';
import { Role } from '@/types';
import ClientComplain from '@/components/client-dashboard/ClientComplain';
import ClientReview from '@/components/client-dashboard/ClientReview';
import ClientLostProperty from '@/components/client-dashboard/ClientLostProperty';

export default function ClientLoginPage() {
  const router = useRouter();
  const { login, user } = useAuth();
  const [isComplainModalOpen, setComplainModalOpen] = useState(false);
  const [isReviewModalOpen, setReviewModalOpen] = useState(false);
  const [isLostPropertyModalOpen, setLostPropertyModalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      login(Role.CLIENT, { id: data.id, name: data.name, email: data.email, phone: data.phone });
      router.push('/client/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const updateFromHash = () => {
      const hash = window.location.hash.replace('#', '');
      setComplainModalOpen(hash === 'complain');
      setReviewModalOpen(hash === 'review');
      setLostPropertyModalOpen(hash === 'lost-property');
    };
    updateFromHash();
    window.addEventListener('hashchange', updateFromHash);
    return () => window.removeEventListener('hashchange', updateFromHash);
  }, []);

  useEffect(() => {
    if (user) {
      router.replace('/client/dashboard');
    }
  }, [user, router]);

  return (
    <FormLayout title="Client Sign In">
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
        <div className="flex items-center !mt-4 !mb-4">
          <div className="flex-grow border-t border-gray-700"></div>
          <span className="flex-shrink mx-4 text-gray-500 text-sm">OR</span>
          <div className="flex-grow border-t border-gray-700"></div>
        </div>
        <Link
          href="/booking"
          className="block text-center w-full px-8 py-3 text-lg font-semibold bg-transparent border-2 border-gray-600 text-gray-300 rounded-md hover:bg-gray-800 hover:border-gray-500 transition-all duration-300"
        >
          Continue as Guest
        </Link>
        <p className="text-center text-sm text-gray-400 !mt-8">
          Don't have an account?{' '}
          <Link href="/client/signup" className="font-medium text-amber-400 hover:underline">
            Sign up now
          </Link>
        </p>
        <p className="text-center text-sm text-gray-400">
          You have a corporate account?{' '}
          <Link href="/corporate/login" className="font-medium text-amber-400 hover:underline">
            Sign up now
          </Link>
        </p>
      </form>

      <div className="mt-8 pt-6 border-t border-gray-800 text-center">
        <h3 className="text-sm text-gray-400 mb-3">Need help with a journey?</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={() => setComplainModalOpen(true)} className="flex-1 text-sm text-amber-400 hover:underline">
            Complain
          </button>
          <button onClick={() => setReviewModalOpen(true)} className="flex-1 text-sm text-amber-400 hover:underline">
            Review
          </button>
          <button onClick={() => setLostPropertyModalOpen(true)} className="flex-1 text-sm text-amber-400 hover:underline">
            Lost Property
          </button>
        </div>
      </div>

      <Modal isOpen={isComplainModalOpen} onClose={() => setComplainModalOpen(false)} title="Complaint/Compliment">
        <ClientComplain isGuest showSubjectInput={false} />
      </Modal>
      <Modal isOpen={isReviewModalOpen} onClose={() => setReviewModalOpen(false)} title="Leave a Review">
        <ClientReview isGuest />
      </Modal>
      <Modal
        isOpen={isLostPropertyModalOpen}
        onClose={() => setLostPropertyModalOpen(false)}
        title="Report Lost Property"
      >
        <ClientLostProperty isGuest />
      </Modal>
    </FormLayout>
  );
}
