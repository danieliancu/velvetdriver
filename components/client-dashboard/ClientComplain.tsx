'use client';

import React from 'react';
import DashboardInput from '@/components/DashboardInput';
import DashboardSelect from '@/components/DashboardSelect';
import { useAlert } from '@/components/AlertProvider';
import type { Journey } from '@/types';

interface ClientComplainProps {
  email?: string;
  journeys?: Journey[];
  isGuest?: boolean;
}

const ClientComplain: React.FC<ClientComplainProps> = ({ email, journeys = [], isGuest = false }) => {
  const { showAlert } = useAlert();
  const [journeyId, setJourneyId] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [details, setDetails] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest || !email) {
      showAlert('Complaint submitted. We will get back to you within 48 hours.');
      return;
    }
    if (!journeyId) {
      showAlert('Select a journey to continue.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/client/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, journeyId, subject, details }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to submit complaint');
      }
      showAlert('Complaint submitted. We will get back to you within 48 hours.');
      setJourneyId('');
      setSubject('');
      setDetails('');
    } catch (err: any) {
      showAlert(err?.message || 'Failed to submit complaint');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {isGuest || !email ? (
        <DashboardInput id="booking-ref" label="Booking Reference or Date of Journey" type="text" required />
      ) : (
        <>
          <DashboardSelect
            id="booking-ref"
            label="Your Bookings"
            required
            value={journeyId}
            onChange={(e) => setJourneyId(e.target.value)}
            disabled={!journeys.length}
          >
            <option value="" disabled className="bg-gray-900 text-white">
              {journeys.length ? 'Select a journey' : 'No journeys available yet'}
            </option>
            {journeys.map((journey) => (
              <option key={journey.id} value={journey.id} className="bg-gray-900 text-white">
                {journey.date} - {journey.pickup} to {journey.destination.split(',')[0]} ({journey.status})
              </option>
            ))}
          </DashboardSelect>
          {!journeys.length && (
            <p className="text-xs text-gray-400">
              Once you book a journey while signed in, it will appear here automatically.
            </p>
          )}
        </>
      )}
      <DashboardInput id="subject" label="Subject" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} required />
      <div>
        <label htmlFor="details" className="block text-xs font-semibold text-amber-200/70 uppercase tracking-wider mb-2">
          Complaint Details
        </label>
        <textarea
          id="details"
          rows={5}
          required
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          className="w-full bg-gray-900 border border-amber-900/60 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
          placeholder="Please provide as much detail as possible..."
        />
      </div>
      <div className="pt-2 flex justify-start">
        <button type="submit" className="px-10 py-2.5 font-semibold bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-60" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit Complaint'}
        </button>
      </div>
    </form>
  );
};

export default ClientComplain;
