'use client';

import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { olderBookingsData, OlderBooking } from '../data/olderBookings';

const driverContacts: Record<
  string,
  { fullName: string; phone: string; email: string; pcoLicenceNumber: string }
> = {
  'James P.': {
    fullName: 'James Parker',
    phone: '+44 7700 900123',
    email: 'james@velvetdrivers.co.uk',
    pcoLicenceNumber: 'PCO-445566',
  },
  'Robert K.': {
    fullName: 'Robert King',
    phone: '+44 7700 900234',
    email: 'robert@velvetdrivers.co.uk',
    pcoLicenceNumber: 'PCO-223311',
  },
  'David C.': {
    fullName: 'David Carden',
    phone: '+44 7700 900345',
    email: 'david@velvetdrivers.co.uk',
    pcoLicenceNumber: 'PCO-998877',
  },
  'Anna B.': {
    fullName: 'Anna Beaumont',
    phone: '+44 7700 900456',
    email: 'anna@velvetdrivers.co.uk',
    pcoLicenceNumber: 'PCO-667788',
  },
  'Oliver T.': {
    fullName: 'Oliver Turner',
    phone: '+44 7700 900567',
    email: 'oliver@velvetdrivers.co.uk',
    pcoLicenceNumber: 'PCO-114422',
  },
};

const formatDateHeading = (date: string) => {
  const parsed = new Date(date);
  return isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
};

const formatDateTime = (value?: string) => {
  if (!value) return null;
  const normalized = value.replace(' ', 'T');
  const parsed = new Date(normalized);
  if (isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDateOnly = (value: string) => {
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const OlderBookingsList: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [query, setQuery] = useState('');

  const filteredBookings = useMemo<OlderBooking[]>(() => {
    if (!query.trim()) {
      return olderBookingsData;
    }
    const searchTerm = query.toLowerCase();
    return olderBookingsData.filter((booking) => {
      const haystack = `${booking.id} ${booking.pickup} ${booking.dropOffs.join(' ')} ${booking.passengerName} ${booking.passengerPhone} ${booking.driverName} ${booking.vehicle} ${booking.notes} ${booking.bookedBy} ${booking.method} ${booking.bookingCreated}`.toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [query]);

  const groupedBookings = useMemo(() => {
    const map = new Map<string, OlderBooking[]>();
    filteredBookings.forEach((booking) => {
      const existing = map.get(booking.date) ?? [];
      map.set(booking.date, [...existing, booking]);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredBookings]);

  return (
    <div className={className}>
      <div className="relative mb-4">
        <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
          <Search size={16} />
        </span>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by booking ID, pickup, passenger or driver..."
          className="w-full rounded-2xl border border-white/10 bg-black/40 px-10 py-3 text-white placeholder-gray-500 focus:border-amber-400 focus:outline-none"
        />
      </div>

      {groupedBookings.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-8 text-center text-gray-400">
          No bookings match your search. Try a different keyword.
        </div>
      ) : (
        <div className="space-y-6">
          {groupedBookings.map(([date, bookings]) => (
            <div key={date} className="space-y-4 rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Date</p>
                  <h2 className="text-xl font-semibold text-white">{formatDateHeading(date)}</h2>
                </div>
                <p className="text-sm text-gray-400">{bookings.length} bookings</p>
              </div>

              <div className="space-y-4">
                {bookings.map((booking) => {
                  const driverInfo = driverContacts[booking.driverName];
                  return (
                    <div
                      key={booking.id}
                      className="rounded-2xl border border-white/10 bg-black/60 p-5 shadow-inner shadow-black/40"
                    >
                      <div className="flex flex-col gap-6 lg:flex-row">
                        <div className="flex-1 space-y-4">
                          <div className="space-y-1 text-sm text-gray-200">
                            <p>
                              <span className="font-semibold text-white">Booking #{booking.id}.</span>{' '}
                              Date of booking : {formatDateTime(booking.bookingCreated) ?? booking.bookingCreated}
                              {booking.bookingAccepted
                                ? `. Accepted: ${formatDateTime(booking.bookingAccepted)}`
                                : ''}
                            </p>
                            <p>Booked and dispatched by: {booking.bookedBy}</p>
                          </div>

                          <div className="space-y-1 text-sm text-gray-200">
                            <p>Date of journey : {formatDateOnly(booking.date)}</p>
                            <p>Time: {booking.time}</p>
                            <p>Passenger: {booking.passengerName}</p>
                            <p>Phone: {booking.passengerPhone}</p>
                            <p>Pickup: {booking.pickup}</p>
                            <p>Drop-off: {booking.dropOffs.join(', ')}</p>
                            <p>Notes: {booking.notes}</p>
                            <p>Fare quoted: £{booking.fareQuoted.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="space-y-2 rounded-2xl border border-white/10 bg-black/40 p-4 lg:basis-[45%]">
                          <p className="text-sm font-semibold text-white">Driver contact</p>
                          {driverInfo ? (
                            <div className="space-y-1 text-xs text-gray-300">
                              <p>
                                Name: {driverInfo.fullName} ({booking.driverName})
                              </p>
                              <p>Phone: {driverInfo.phone}</p>
                              <p>PCO licence number: {driverInfo.pcoLicenceNumber}</p>
                              <p>
                                {booking.vehicle} · {booking.numberPlate}
                              </p>
                              <p>Email: {driverInfo.email}</p>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500">No driver contact on file.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OlderBookingsList;
