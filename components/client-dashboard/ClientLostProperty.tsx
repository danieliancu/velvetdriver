'use client';

import React from 'react';
import DashboardInput from '@/components/DashboardInput';
import DashboardSelect from '@/components/DashboardSelect';
import { useAlert } from '@/components/AlertProvider';
import type { Journey } from '@/types';

interface ClientLostPropertyProps {
  email?: string;
  journeys?: Journey[];
  isGuest?: boolean;
}

const ClientLostProperty: React.FC<ClientLostPropertyProps> = ({ email, journeys = [], isGuest = false }) => {
  const { showAlert } = useAlert();
  const [journeyId, setJourneyId] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [details, setDetails] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest || !email) {
      showAlert('Lost property report submitted. We will contact you shortly.');
      return;
    }
    if (!journeyId) {
      showAlert('Select a journey to continue.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/client/lost-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, journeyId, description, details }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to submit report');
      }
      showAlert('Lost property report submitted. We will contact you shortly.');
      setJourneyId('');
      setDescription('');
      setDetails('');
    } catch (err: any) {
      showAlert(err?.message || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {isGuest || !email ? (
        <DashboardInput id="booking-ref-lost" label="Booking Reference or Date of Journey" type="text" required />
      ) : (
        <>
          <DashboardSelect
            id="booking-ref-lost"
            label="Your Bookings"
            required
            value={journeyId}
            onChange={(e) => setJourneyId(e.target.value)}
            disabled={!journeys.length}
          >
            <option value="" disabled className="bg-gray-900 text-white">
              {journeys.length ? 'Select the relevant journey' : 'No journeys available yet'}
            </option>
            {journeys.map(journey => (
              <option key={journey.id} value={journey.id} className="bg-gray-900 text-white">
                {journey.date} - {journey.pickup} to {journey.destination.split(',')[0]} ({journey.status})
              </option>
            ))}
          </DashboardSelect>
          {!journeys.length && (
            <p className="text-xs text-gray-400">
              Sign in and book a journey to have it appear here for lost property reports.
            </p>
          )}
        </>
      )}
      <DashboardInput id="item-description" label="Description of Item" type="text" required value={description} onChange={(e) => setDescription(e.target.value)} />
      
      <div>
        <label htmlFor="lost-details" className="block text-xs font-semibold text-amber-200/70 uppercase tracking-wider mb-2">
          Additional Details
        </label>
        <textarea
          id="lost-details"
          rows={4}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          className="w-full bg-gray-900 border border-amber-900/60 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
          placeholder="E.g., where you think you left it, brand, color..."
        />
      </div>
      <div className="pt-2 flex justify-start">
        <button type="submit" className="px-10 py-2.5 font-semibold bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-60" disabled={loading}>
          {loading ? 'Sending...' : 'Report Item'}
        </button>
      </div>
    </form>
  );
};

export default ClientLostProperty;
