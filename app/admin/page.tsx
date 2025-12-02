'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import FormLayout from '@/components/FormLayout';
import Input from '@/components/Input';
import { useAuth } from '@/lib/auth-context';
import { Role } from '@/types';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    if (username === 'admin' && password === 'admin') {
      setError('');
      login(Role.ADMIN);
      router.push('/admin/dashboard');
    } else {
      setError('Invalid username or password');
    }
  };

  return (
    <FormLayout title="Admin Sign In">
      <form onSubmit={handleLogin} className="space-y-6">
        <Input
          id="username"
          label="Username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <Input
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-red-500 text-sm text-center -mt-2">{error}</p>}
        <button
          type="submit"
          className="w-full px-8 py-3 text-lg font-semibold bg-amber-500 text-black rounded-md hover:bg-amber-400 transition-all duration-300 transform hover:scale-105 shadow-[0_0_15px_rgba(251,191,36,0.5)]"
        >
          Sign In
        </button>
      </form>
    </FormLayout>
  );
}
