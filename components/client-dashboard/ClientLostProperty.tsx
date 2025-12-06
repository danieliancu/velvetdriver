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
  const [bookingReference, setBookingReference] = React.useState('');
  const [bookingDateTime, setBookingDateTime] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [handedInBy, setHandedInBy] = React.useState('');
  const [receivedDate, setReceivedDate] = React.useState('');
  const [returnMethod, setReturnMethod] = React.useState('');
  const [result, setResult] = React.useState('');
  const [representative, setRepresentative] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !address || !phone || !details || !description || !returnMethod || !representative) {
      showAlert('Please fill in all required fields.');
      return;
    }
    const composedDetails = `Ref no: ${bookingReference || 'N/A'}
Handed in By: ${handedInBy || 'N/A'}
Date Property received: ${receivedDate || 'N/A'}
Date and Time of related booking: ${bookingDateTime || 'N/A'}
Customer details - Name: ${fullName}
Customer details - Address: ${address}
Customer details - Phone No: ${phone}
Details of Property: ${details}
Method/Enquiry to return property: ${returnMethod}
Result: ${result || 'Pending'}
Company Representative Name: ${representative}`;

    if (isGuest || !email) {
      showAlert('Lost property report submitted. We will contact you shortly.');
      setBookingReference('');
      setBookingDateTime('');
      setFullName('');
      setAddress('');
      setPhone('');
      setHandedInBy('');
      setReceivedDate('');
      setReturnMethod('');
      setResult('');
      setRepresentative('');
      setDescription('');
      setDetails('');
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
        body: JSON.stringify({ email, journeyId, description, details: composedDetails }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to submit report');
      }
      showAlert('Lost property report submitted. We will contact you shortly.');
      setJourneyId('');
      setBookingReference('');
      setBookingDateTime('');
      setFullName('');
      setAddress('');
      setPhone('');
      setHandedInBy('');
      setReceivedDate('');
      setReturnMethod('');
      setResult('');
      setRepresentative('');
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
        <>
          <DashboardInput
            id="ref-no"
            label="Ref. no."
            type="text"
            value={bookingReference}
            onChange={(e) => setBookingReference(e.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <DashboardInput
              id="handed-in-by"
              label="Handed in By"
              type="text"
              value={handedInBy}
              onChange={(e) => setHandedInBy(e.target.value)}
            />
            <DashboardInput
              id="received-date"
              label="Date Property received"
              type="text"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <DashboardInput
              id="booking-datetime-lost"
              label="Date and Time of related booking"
              type="text"
              value={bookingDateTime}
              onChange={(e) => setBookingDateTime(e.target.value)}
            />
            <DashboardInput
              id="full-name-lost"
              label="Name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <DashboardInput
              id="address-lost"
              label="Address"
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <DashboardInput
              id="phone-lost"
              label="Phone No"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </>
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
                #{journey.id} - {journey.date} - {journey.pickup} to {journey.destination.split(',')[0]} ({journey.status})
              </option>
            ))}
          </DashboardSelect>
          {!journeys.length && (
            <p className="text-xs text-gray-400">
              Sign in and book a journey to have it appear here for lost property reports.
            </p>
          )}
          <DashboardInput
            id="ref-no"
            label="Ref. no."
            type="text"
            value={bookingReference}
            onChange={(e) => setBookingReference(e.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <DashboardInput
              id="handed-in-by"
              label="Handed in By"
              type="text"
              value={handedInBy}
              onChange={(e) => setHandedInBy(e.target.value)}
            />
            <DashboardInput
              id="received-date"
              label="Date Property received"
              type="text"
              value={receivedDate}
              onChange={(e) => setReceivedDate(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <DashboardInput
              id="booking-datetime-lost"
              label="Date and Time of related booking"
              type="text"
              value={bookingDateTime}
              onChange={(e) => setBookingDateTime(e.target.value)}
            />
            <DashboardInput
              id="full-name-lost"
              label="Name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <DashboardInput
              id="address-lost"
              label="Address"
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <DashboardInput
              id="phone-lost"
              label="Phone No"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </>
      )}
      <div>
        <label className="block text-xs font-semibold text-amber-200/70 uppercase tracking-wider mb-2">
          Details of Property
        </label>
        <textarea
          className="w-full bg-gray-900 border border-amber-900/60 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
          value={details}
          onChange={(e) => {
            setDetails(e.target.value);
            setDescription(e.target.value);
          }}
          rows={3}
          placeholder="Please provide as much detail as possible..."
        />
      </div>

      <div>
        <label htmlFor="lost-details" className="block text-xs font-semibold text-amber-200/70 uppercase tracking-wider mb-2">
          Method/Enquiry to return property
        </label>
        <textarea
          id="lost-details"
          rows={4}
          value={returnMethod}
          onChange={(e) => setReturnMethod(e.target.value)}
          className="w-full bg-gray-900 border border-amber-900/60 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
          placeholder="How should we return the item?"
        />
      </div>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-amber-200/70 uppercase tracking-wider mb-2">
            Result
          </label>
          <input
            className="w-full bg-gray-900 border border-amber-900/60 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            value={result}
            onChange={(e) => setResult(e.target.value)}
            placeholder="Outcome or next step"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-amber-200/70 uppercase tracking-wider mb-2">
            Company Representative Name
          </label>
          <input
            className="w-full bg-gray-900 border border-amber-900/60 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            value={representative}
            onChange={(e) => setRepresentative(e.target.value)}
            placeholder="Who is handling this?"
          />
        </div>
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
