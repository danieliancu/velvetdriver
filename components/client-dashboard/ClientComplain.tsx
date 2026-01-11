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
  showSubjectInput?: boolean;
  userName?: string | null;
  userPhone?: string | null;
}

const ClientComplain: React.FC<ClientComplainProps> = ({
  email,
  journeys = [],
  isGuest = false,
  showSubjectInput = true,
  userName,
  userPhone,
}) => {
  const { showAlert } = useAlert();
  const [journeyId, setJourneyId] = React.useState('');
  const [subject, setSubject] = React.useState('');
  const [details, setDetails] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [fullName, setFullName] = React.useState(userName || '');
  const [address, setAddress] = React.useState(email || '');
  const [phone, setPhone] = React.useState(userPhone || '');
  const [bookingReference, setBookingReference] = React.useState('');
  const [bookingDateTime, setBookingDateTime] = React.useState('');

  React.useEffect(() => {
    setFullName((prev) => (prev ? prev : userName || ''));
  }, [userName]);

  React.useEffect(() => {
    setPhone((prev) => (prev ? prev : userPhone || ''));
  }, [userPhone]);

  React.useEffect(() => {
    setAddress((prev) => (prev ? prev : email || ''));
  }, [email]);

  React.useEffect(() => {
    if (isGuest) return;
    if (!journeyId) {
      setBookingDateTime('');
      return;
    }
    const selected = journeys.find((j) => String(j.id) === String(journeyId));
    if (selected?.date) {
      setBookingDateTime(selected.date);
    }
  }, [journeyId, journeys, isGuest]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedDetails = details.trim();
    const contactEmail = (email || address || '').trim();
    const dateTimeValue = bookingDateTime.trim();

    if ((showSubjectInput && !subject) || !trimmedDetails || !fullName || !contactEmail || !phone || !dateTimeValue) {
      showAlert('Please fill in all required fields, including complaint details.');
      return;
    }
    const effectiveSubject = showSubjectInput ? subject : 'Complaint/Compliment';

    if (!isGuest && email && !journeyId) {
      showAlert('Select a journey to continue.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/client/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: isGuest ? 'guest' : 'client',
          email: email || contactEmail,
          journeyId: journeyId || undefined,
          subject: effectiveSubject,
          details: trimmedDetails,
          fullName,
          address: contactEmail,
          phone,
          bookingReference: bookingReference || (journeyId ? `VD_${journeyId}` : ''),
          bookingDateTime: bookingDateTime || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to submit complaint');
      }
      showAlert('Complaint submitted. We will get back to you within 48 hours.');
      setJourneyId('');
      setSubject(showSubjectInput ? '' : subject);
      setDetails('');
      setFullName(isGuest ? '' : userName || fullName);
      setAddress(isGuest ? '' : email || address);
      setPhone(isGuest ? '' : userPhone || phone);
      setBookingReference('');
      setBookingDateTime('');
    } catch (err: any) {
      showAlert(err?.message || 'Failed to submit complaint');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {showSubjectInput ? (
      <DashboardInput
        id="subject"
        label="Complaint/Compliment"
        type="text"
        value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
        />
      ) : null}

      {isGuest || !email ? (
        <>
          <DashboardInput
            id="booking-ref"
            label="Booking Reference (if known)"
            type="text"
            value={bookingReference}
            onChange={(e) => setBookingReference(e.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <DashboardInput
              id="booking-datetime"
              label="Date and Time"
              type="text"
              required
              value={bookingDateTime}
              onChange={(e) => setBookingDateTime(e.target.value)}
            />
            <DashboardInput
              id="your-name"
              label="Your Name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              readOnly={!isGuest && Boolean(email)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <DashboardInput
              id="your-address"
              label="Email Address"
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              readOnly={!isGuest && Boolean(email)}
            />
            <DashboardInput
              id="your-phone"
              label="Your Phone No"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              readOnly={!isGuest && Boolean(email)}
            />
          </div>
        </>
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
                Ref. no. VD_{journey.id} - {journey.date} - {journey.pickup} to {journey.destination.split(',')[0]} ({journey.status})
              </option>
            ))}
          </DashboardSelect>
          {!journeys.length && (
            <p className="text-xs text-gray-400">
              Once you book a journey while signed in, it will appear here automatically.
            </p>
          )}
          <DashboardInput
            id="your-name"
            label="Your Name"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            readOnly
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <DashboardInput
              id="your-address"
              label="Email Address"
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              readOnly
            />
            <DashboardInput
              id="your-phone"
              label="Your Phone No"
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              readOnly
            />
          </div>
          <DashboardInput
            id="booking-datetime"
            label="Booking Date"
            type="text"
            value={bookingDateTime}
            readOnly
            required
          />
        </>
      )}
      <div>
        <label htmlFor="details" className="block text-xs font-semibold text-amber-200/70 uppercase tracking-wider mb-2">
          Details of Complaint
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
