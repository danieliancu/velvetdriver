'use client';

import React, { useEffect, useState } from 'react';
import DashboardInput from '@/components/DashboardInput';
import { useAlert } from '@/components/AlertProvider';

interface Props {
  email: string;
  profile?: { name: string; phone?: string | null };
}

const ClientUpdateDetails: React.FC<Props> = ({ email, profile }) => {
  const { showAlert } = useAlert();
  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setPhone(profile.phone ?? '');
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword && newPassword !== confirmPassword) {
      showAlert('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/client/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, phone, newPassword: newPassword || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to update profile');
      }
      showAlert('Details updated successfully.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      showAlert(err?.message || 'Failed to update details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <DashboardInput id="full-name" label="Full Name" type="text" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
        <DashboardInput id="phone" label="Phone Number" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <DashboardInput id="email" label="Email Address" type="email" autoComplete="email" value={email} readOnly />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <DashboardInput id="new-password" label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        <DashboardInput id="confirm-password" label="Confirm New Password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
      </div>

      <div className="pt-2 flex justify-start">
        <button type="submit" className="px-10 py-2.5 font-semibold bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-60" disabled={loading}>
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
};

export default ClientUpdateDetails;
