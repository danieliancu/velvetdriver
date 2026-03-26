'use client';

import React, { useMemo, useState } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import type { Journey, SavedQuote } from '@/types';
import Modal from '@/components/Modal';
import StripePaymentForm from '@/components/payments/StripePaymentForm';

type RenderStatus = Journey['status'] | 'Modified';

type PricePreview = {
  oldPrice: number;
  newPrice: number;
  difference: number;
  payNowAmount: number;
  creditAmount: number;
};

const BOOKING_DRAFT_KEY = 'velvetdriver.booking.draft';

const stripStopLabel = (value: string) => value.replace(/^Stop\s+\d+:\s*/i, '').trim();

const parseDestinationStops = (destination: string) => {
  const raw = String(destination || '').trim();
  if (!raw) return [''];
  if (!raw.includes('Stop ')) return [raw];
  return raw
    .split(', ')
    .map((part) => stripStopLabel(part))
    .filter(Boolean);
};

const StatusBadge: React.FC<{ status: RenderStatus }> = ({ status }) => {
  const baseClasses = 'px-2 py-1 text-xs font-semibold rounded-full';
  const statusClasses: Record<RenderStatus, string> = {
    Completed: 'bg-green-500/20 text-green-300',
    Upcoming: 'bg-yellow-500/20 text-yellow-300',
    Cancelled: 'bg-red-500/20 text-red-300',
    Saved: 'bg-blue-500/20 text-blue-300',
    Modified: 'bg-amber-500/20 text-amber-200 border border-amber-500/40',
  };
  return <span className={`${baseClasses} ${statusClasses[status]}`}>{status}</span>;
};

type FilterStatus = 'Completed' | 'Upcoming' | 'Saved';

interface Props {
  journeys?: Journey[];
  loading?: boolean;
  savedQuotes?: SavedQuote[];
  savedLoading?: boolean;
  onSelectSaved?: (quoteId: SavedQuote['id']) => void;
  onDeleteSaved?: (quoteId: SavedQuote['id']) => void;
  deletingSavedId?: SavedQuote['id'] | null;
  clientEmail?: string;
  onJourneyModified?: () => Promise<void> | void;
}

const toDateTimeInputs = (iso?: string | null) => {
  const parsed = iso ? new Date(iso) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return { date: '', time: '' };
  }
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');
  return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
};

const ClientHistory: React.FC<Props> = ({
  journeys = [],
  loading = false,
  savedQuotes = [],
  savedLoading = false,
  onSelectSaved,
  onDeleteSaved,
  deletingSavedId = null,
  clientEmail,
  onJourneyModified,
}) => {
  const [filter, setFilter] = useState<FilterStatus>('Upcoming');
  const [query, setQuery] = useState('');
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null);
  const [pickup, setPickup] = useState('');
  const [dropOff, setDropOff] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [flightNumber, setFlightNumber] = useState('');
  const [passengers, setPassengers] = useState('1');
  const [specialRequests, setSpecialRequests] = useState('');
  const [preview, setPreview] = useState<PricePreview | null>(null);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [recalcError, setRecalcError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentIntentLoading, setPaymentIntentLoading] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [stripePublishableKey, setStripePublishableKey] = useState<string | null>(null);
  const stripePromise = useMemo(
    () => (stripePublishableKey ? loadStripe(stripePublishableKey) : null),
    [stripePublishableKey]
  );

  const handleBookAgain = (journey: Journey) => {
    const nextDateTime = toDateTimeInputs(journey.journeyDateIso);
    const dropOffs = parseDestinationStops(journey.destination);
    const draft = {
      pickupAddress: journey.pickup || '',
      pickupDisplay: journey.pickup || '',
      dropOffAddresses: dropOffs,
      dropOffDisplays: dropOffs,
      date: nextDateTime.date,
      time: nextDateTime.time,
      serviceType: journey.serviceType || 'Transfer',
      passengers: String(journey.passengers || 1),
      passengerEmail: clientEmail || '',
      flightNumber: journey.flightNumber || '',
      notes: journey.specialRequests || '',
    };

    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(BOOKING_DRAFT_KEY, JSON.stringify(draft));
        window.location.assign('/booking');
      }
    } catch {
      if (typeof window !== 'undefined') {
        window.location.assign('/booking');
      }
    }
  };

  const filteredJourneys = useMemo(() => {
    return journeys.filter((journey) => {
      const matchesStatus = filter === 'Saved' ? journey.status === 'Saved' : journey.status === filter;
      const search = query.trim().toLowerCase();
      const matchesQuery = !search
        ? true
        : `${journey.pickup} ${journey.destination} ${journey.driver} ${journey.car}`
            .toLowerCase()
            .includes(search);
      return matchesStatus && matchesQuery;
    });
  }, [journeys, filter, query]);

  const canPreview = Boolean(selectedJourney && clientEmail && pickup && dropOff && date && time);

  const fetchPreview = React.useCallback(async () => {
    if (!selectedJourney || !clientEmail || !pickup || !dropOff || !date || !time) return;
    setRecalcLoading(true);
    setRecalcError(null);
    setShowPaymentForm(false);
    setStripeClientSecret(null);
    setStripePublishableKey(null);
    try {
      const response = await fetch('/api/client/bookings/modify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview',
          email: clientEmail,
          journeyId: selectedJourney.id,
          pickup,
          dropOff,
          date,
          time,
          flightNumber,
          passengers,
          specialRequests,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to recalculate fare.');
      }
      setPreview({
        oldPrice: Number(data.oldPrice || 0),
        newPrice: Number(data.newPrice || 0),
        difference: Number(data.difference || 0),
        payNowAmount: Number(data.payNowAmount || 0),
        creditAmount: Number(data.creditAmount || 0),
      });
    } catch (err: any) {
      setPreview(null);
      setRecalcError(err?.message || 'Unable to recalculate fare.');
    } finally {
      setRecalcLoading(false);
    }
  }, [selectedJourney, clientEmail, pickup, dropOff, date, time, flightNumber, passengers, specialRequests]);

  React.useEffect(() => {
    if (!canPreview) return;
    const timer = window.setTimeout(() => {
      fetchPreview();
    }, 450);
    return () => window.clearTimeout(timer);
  }, [canPreview, fetchPreview]);

  const openModifyModal = (journey: Journey) => {
    const dt = toDateTimeInputs(journey.journeyDateIso);
    setSelectedJourney(journey);
    setPickup(journey.pickup || '');
    setDropOff(journey.destination || '');
    setDate(dt.date);
    setTime(dt.time);
    setFlightNumber(journey.flightNumber || '');
    setPassengers(String(journey.passengers || 1));
    setSpecialRequests(journey.specialRequests || '');
    setPreview(null);
    setRecalcError(null);
    setSuccessMessage(null);
    setShowPaymentForm(false);
    setStripeClientSecret(null);
    setStripePublishableKey(null);
  };

  const closeModifyModal = () => {
    setSelectedJourney(null);
    setPreview(null);
    setRecalcError(null);
    setSubmitLoading(false);
    setSuccessMessage(null);
    setShowPaymentForm(false);
    setStripeClientSecret(null);
    setStripePublishableKey(null);
  };

  const submitModification = async (payment?: { id: string; status: string; method?: string }) => {
    if (!selectedJourney || !clientEmail) return;
    setSubmitLoading(true);
    setRecalcError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch('/api/client/bookings/modify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          email: clientEmail,
          journeyId: selectedJourney.id,
          pickup,
          dropOff,
          date,
          time,
          flightNumber,
          passengers,
          specialRequests,
          paymentIntentId: payment?.id,
          paymentStatus: payment?.status,
          paymentMethod: payment?.method || 'Card',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Unable to update booking.');
      }
      setShowPaymentForm(false);
      setStripeClientSecret(null);
      setStripePublishableKey(null);
      setSuccessMessage(
        data?.creditIssued
          ? `Your booking has been successfully updated. GBP ${Number(data.creditIssued).toFixed(2)} credit has been added to your account.`
          : 'Your booking has been successfully updated. Your chauffeur will be informed accordingly.'
      );
      await onJourneyModified?.();
    } catch (err: any) {
      setRecalcError(err?.message || 'Unable to update booking.');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleConfirmChanges = async () => {
    if (!selectedJourney || !clientEmail || !preview) return;
    if (preview.difference > 0) {
      setPaymentIntentLoading(true);
      setRecalcError(null);
      try {
        const response = await fetch('/api/stripe/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: Number(preview.payNowAmount),
            currency: 'gbp',
            passengerName: 'Client',
            passengerEmail: clientEmail,
            pickup,
            dropOffs: [dropOff],
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data?.error || 'Failed to start payment.');
        }
        setStripeClientSecret(data?.clientSecret ?? null);
        setStripePublishableKey(data?.publishableKey ?? null);
        setShowPaymentForm(true);
      } catch (err: any) {
        setRecalcError(err?.message || 'Failed to start payment.');
      } finally {
        setPaymentIntentLoading(false);
      }
      return;
    }
    await submitModification();
  };

  const FilterButton: React.FC<{ status: FilterStatus }> = ({ status }) => (
    <button
      onClick={() => setFilter(status)}
      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
        filter === status ? 'bg-amber-400/90 text-black' : 'bg-gray-700/50 text-amber-300 hover:bg-gray-600/50'
      }`}
    >
      {status}
    </button>
  );

  const renderSavedQuotes = () => {
    if (savedLoading) {
      return (
        <div className="rounded-xl border border-gray-700/80 bg-black/30 p-6 text-center text-sm text-gray-400">
          Loading saved quotes...
        </div>
      );
    }
    if (!savedQuotes.length) {
      return (
        <div className="rounded-xl border border-gray-700/80 bg-black/30 p-6 text-center text-sm text-gray-400">
          You have no saved quotes yet.
        </div>
      );
    }
    return (
      <div className="space-y-3">
        {savedQuotes.map((quote) => {
          const payload = quote.payload || {};
          const pickupSaved = payload.pickup || 'Pickup TBD';
          const dropOffs: string[] = Array.isArray(payload.dropOffs) ? payload.dropOffs.filter(Boolean) : payload.dropOff ? [payload.dropOff] : [];
          const primaryDrop = dropOffs[dropOffs.length - 1] || 'Drop-off TBD';
          const intermediateStops = dropOffs.slice(0, -1);
          const iso = payload.date && payload.time ? `${payload.date}T${payload.time}` : payload.date;
          let formatted: string | null = null;
          if (iso) {
            const dateSaved = new Date(iso);
            if (!Number.isNaN(dateSaved.getTime())) {
              formatted = dateSaved.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            }
          } else if (quote.createdAt) {
            const created = new Date(quote.createdAt);
            if (!Number.isNaN(created.getTime())) {
              formatted = created.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            }
          }

          const detailItems = [
            { label: 'Service', value: payload.serviceType || 'Transfer' },
            { label: 'Vehicle', value: payload.vehicle || 'Executive' },
            { label: 'Passengers', value: payload.passengers || '1' },
            {
              label: 'Suitcases',
              value: `${payload.smallSuitcases || 0} small / ${payload.largeSuitcases || 0} large`,
            },
            { label: 'Miles', value: payload.miles ? `${payload.miles} mi` : 'Auto' },
            { label: 'Waiting', value: payload.waiting ? `${payload.waiting} min` : '0 min' },
          ];

          return (
            <div key={quote.id} className="rounded-2xl border border-amber-900/40 bg-gray-900/40 px-4 py-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-amber-200">{quote.label || `${pickupSaved} -> ${primaryDrop}`}</p>
                  {formatted ? <p className="text-xs text-gray-400">{formatted}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectSaved?.(quote.id)}
                    className="px-3 py-1 text-xs font-semibold rounded-md bg-amber-500/80 text-black hover:bg-amber-400/80 transition-colors disabled:opacity-60"
                    disabled={!onSelectSaved}
                  >
                    Book now!
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSaved?.(quote.id)}
                    className="px-3 py-1 text-xs font-semibold rounded-md border border-red-500/60 text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    disabled={!onDeleteSaved || deletingSavedId === quote.id}
                  >
                    {deletingSavedId === quote.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
              <div className="text-sm text-gray-300">
                {pickupSaved} <span className="text-gray-500">-&gt;</span> {primaryDrop}
                {intermediateStops.length > 0 ? (
                  <div className="mt-1 text-xs text-gray-400">
                    {intermediateStops.map((stop, idx) => (
                      <div key={stop + idx}>Stop {idx + 1}: {stop}</div>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-gray-300">
                {detailItems.map((item) => (
                  <div key={item.label}>
                    <p className="uppercase tracking-wide text-[10px] text-gray-500">{item.label}</p>
                    <p className="font-semibold text-amber-100/90">{item.value}</p>
                  </div>
                ))}
              </div>
              {(payload.specialEvents || payload.notes) && (
                <div className="text-xs text-gray-400 space-y-2">
                  {payload.specialEvents ? (
                    <p><span className="text-amber-200 font-semibold">Special events:</span> {payload.specialEvents}</p>
                  ) : null}
                  {payload.notes ? (
                    <p><span className="text-amber-200 font-semibold">Notes:</span> {payload.notes}</p>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const selectedJourneyCanModify = selectedJourney?.canModify !== false;

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
        <h2 className="text-2xl font-semibold font-display text-amber-300">Journey History</h2>
        <div className="flex items-center gap-2">
          <FilterButton status="Upcoming" />
          <FilterButton status="Completed" />
          <FilterButton status="Saved" />
        </div>
      </div>
      {filter !== 'Saved' ? (
        <div className="relative mb-6">
          <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
            </svg>
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by Pickup, Destination, Driver, Car"
            className="w-full rounded-2xl border border-white/10 bg-black/40 px-10 py-3 text-white placeholder-gray-500 focus:border-amber-400 focus:outline-none"
          />
        </div>
      ) : null}

      {filter === 'Saved' ? (
        renderSavedQuotes()
      ) : (
      <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-left">
            <thead className="bg-gray-800/60">
              <tr>
                <th className="p-4">Ref. no.</th>
                <th className="p-4">Date & Time</th>
                <th className="p-4">Pickup</th>
                <th className="p-4">Destination</th>
                <th className="p-4">Service</th>
                <th className="p-4">Driver</th>
                <th className="p-4">Car</th>
                <th className="p-4">Plate</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Price</th>
                <th className="p-4">Invoice</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="text-center p-8 text-gray-400">
                    Loading journeys...
                  </td>
                </tr>
              ) : filteredJourneys.length > 0 ? (
                filteredJourneys.map((journey, index) => {
                  const statusLabel: RenderStatus = journey.displayStatus === 'Modified' ? 'Modified' : journey.status;
                  return (
                  <tr key={journey.id} className={`border-t border-gray-800 ${index % 2 === 0 ? 'bg-black/20' : ''}`}>
                    <td className="p-4 align-top font-semibold text-amber-200">VD_{journey.id}</td>
                    <td className="p-4 align-top">{journey.date}</td>
                    <td className="p-4 align-top">{journey.pickup}</td>
                    <td className="p-4 align-top">
                      {journey.destination.includes('Stop ')
                        ? journey.destination.split(', ').map((stop, i) => <div key={i}>{stop}</div>)
                        : journey.destination}
                    </td>
                    <td className="p-4 align-top">{journey.serviceType}</td>
                    <td className="p-4 align-top">{journey.driver}</td>
                    <td className="p-4 align-top">{journey.car}</td>
                    <td className="p-4 align-top">{journey.plate}</td>
                    <td className="p-4 align-top">
                      <StatusBadge status={statusLabel} />
                      {journey.modifiedAt ? (
                        <p className="mt-1 text-[10px] text-gray-500">
                          {new Date(journey.modifiedAt).toLocaleString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      ) : null}
                    </td>
                    <td className="p-4 align-top text-right font-semibold">GBP {journey.price.toFixed(2)}</td>
                    <td className="p-4 align-top">
                      {journey.invoiceUrl ? (
                        <a
                          href={journey.invoiceUrl}
                          className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-amber-500/15 text-amber-200 border border-amber-400/40 hover:bg-amber-500/25 transition-colors"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Download
                        </a>
                      ) : (
                        <span className="text-xs text-gray-500">Not available</span>
                      )}
                    </td>
                    <td className="p-4 align-top">
                      {journey.status === 'Upcoming' ? (
                        <button
                          type="button"
                          onClick={() => openModifyModal(journey)}
                          className="px-3 py-1 text-xs font-semibold rounded-md border border-amber-400/60 text-amber-200 hover:bg-amber-400/10 transition-colors"
                        >
                          Modify Booking
                        </button>
                      ) : journey.status === 'Completed' ? (
                        <button
                          type="button"
                          onClick={() => handleBookAgain(journey)}
                          className="px-3 py-1 text-xs font-semibold rounded-md border border-emerald-400/60 text-emerald-200 hover:bg-emerald-400/10 transition-colors"
                        >
                          Book again
                        </button>
                      ) : (
                        <span className="text-xs text-gray-500">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
              ) : (
                <tr>
                  <td colSpan={12} className="text-center p-8 text-gray-400">
                    No {filter.toLowerCase()} journeys found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      <Modal
        isOpen={Boolean(selectedJourney)}
        onClose={closeModifyModal}
        title="Modify Booking"
      >
        <div className="space-y-5">
          <div className="rounded-xl border border-amber-900/40 bg-black/30 p-4 text-sm text-amber-100/90 space-y-1">
            <p>Changes are complimentary up to 6 hours before pickup.</p>
            <p>Within 6 hours, please contact our team directly.</p>
          </div>

          <div className="rounded-xl border border-gray-700/70 bg-black/20 p-4 text-sm text-gray-300 space-y-1">
            <p className="text-amber-200 font-semibold">What you can modify</p>
            <p>Pickup time</p>
            <p>Pickup address</p>
            <p>Drop-off address</p>
            <p>Flight number</p>
            <p>Passenger count</p>
            <p>Special requests</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs uppercase tracking-wide text-amber-200/70">
              Pickup address
              <input
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
                disabled={!selectedJourneyCanModify || submitLoading}
                className="mt-1 w-full rounded-md border border-amber-900/60 bg-[#2a1a1a] px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
              />
            </label>
            <label className="text-xs uppercase tracking-wide text-amber-200/70">
              Drop-off address
              <input
                value={dropOff}
                onChange={(e) => setDropOff(e.target.value)}
                disabled={!selectedJourneyCanModify || submitLoading}
                className="mt-1 w-full rounded-md border border-amber-900/60 bg-[#2a1a1a] px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
              />
            </label>
            <label className="text-xs uppercase tracking-wide text-amber-200/70">
              Pickup date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={!selectedJourneyCanModify || submitLoading}
                className="mt-1 w-full rounded-md border border-amber-900/60 bg-[#2a1a1a] px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
              />
            </label>
            <label className="text-xs uppercase tracking-wide text-amber-200/70">
              Pickup time
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                disabled={!selectedJourneyCanModify || submitLoading}
                className="mt-1 w-full rounded-md border border-amber-900/60 bg-[#2a1a1a] px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
              />
            </label>
            <label className="text-xs uppercase tracking-wide text-amber-200/70">
              Flight number
              <input
                value={flightNumber}
                onChange={(e) => setFlightNumber(e.target.value.toUpperCase())}
                disabled={!selectedJourneyCanModify || submitLoading}
                className="mt-1 w-full rounded-md border border-amber-900/60 bg-[#2a1a1a] px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
              />
            </label>
            <label className="text-xs uppercase tracking-wide text-amber-200/70">
              Passenger count
              <input
                type="number"
                min={1}
                max={9}
                value={passengers}
                onChange={(e) => setPassengers(e.target.value)}
                disabled={!selectedJourneyCanModify || submitLoading}
                className="mt-1 w-full rounded-md border border-amber-900/60 bg-[#2a1a1a] px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
              />
            </label>
          </div>

          <label className="block text-xs uppercase tracking-wide text-amber-200/70">
            Special requests
            <textarea
              rows={3}
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
              disabled={!selectedJourneyCanModify || submitLoading}
              className="mt-1 w-full rounded-md border border-amber-900/60 bg-[#2a1a1a] px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
            />
          </label>

          {recalcLoading ? <p className="text-xs text-gray-400">Recalculating fare...</p> : null}
          {preview ? (
            <div className="rounded-xl border border-gray-700/70 bg-black/30 p-4 text-sm text-gray-300 space-y-1">
              <p>Current fare: GBP {preview.oldPrice.toFixed(2)}</p>
              <p>Updated fare: GBP {preview.newPrice.toFixed(2)}</p>
              {preview.difference > 0 ? (
                <p className="text-amber-200 font-semibold">Pay GBP {preview.payNowAmount.toFixed(2)} to confirm changes.</p>
              ) : preview.difference < 0 ? (
                <p className="text-green-300">Credit will be applied to your next booking.</p>
              ) : (
                <p className="text-gray-300">No price change.</p>
              )}
            </div>
          ) : null}

          {!selectedJourneyCanModify ? (
            <p className="text-sm text-amber-200">Within 6 hours, please contact our team directly to amend this journey.</p>
          ) : null}

          {recalcError ? <p className="text-sm text-red-300">{recalcError}</p> : null}
          {successMessage ? <p className="text-sm text-green-300">{successMessage}</p> : null}
          {showPaymentForm && stripePromise && stripeClientSecret ? (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret: stripeClientSecret,
                appearance: { theme: 'stripe' },
              }}
            >
              <StripePaymentForm
                amount={Number(preview?.payNowAmount ?? 0)}
                clientSecret={stripeClientSecret}
                onSuccess={(paymentIntent) => submitModification({ ...paymentIntent, method: 'Card' })}
                onError={setRecalcError}
                disabled={submitLoading}
                buttonLabel="Pay and confirm changes"
              />
            </Elements>
          ) : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={closeModifyModal}
              className="px-4 py-2 text-sm rounded-md border border-gray-600 text-gray-300 hover:bg-gray-800/50 transition-colors"
            >
              Close
            </button>
            {!successMessage ? (
              <button
                type="button"
                onClick={handleConfirmChanges}
                disabled={!selectedJourneyCanModify || submitLoading || !canPreview || paymentIntentLoading || showPaymentForm}
                className="px-4 py-2 text-sm rounded-md bg-amber-500 text-black font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50"
              >
                {paymentIntentLoading
                  ? 'Opening payment...'
                  : submitLoading
                  ? 'Updating...'
                  : preview && preview.difference > 0
                    ? `Proceed to payment: GBP ${preview.payNowAmount.toFixed(2)}`
                    : 'Confirm changes'}
              </button>
            ) : null}
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ClientHistory;
