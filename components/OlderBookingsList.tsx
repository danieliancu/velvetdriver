'use client';

import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { olderBookingsData, OlderBooking } from '../data/olderBookings';

const driverContacts: Record<string, { phone: string; email: string }> = {
  'James P.': { phone: '+44 7700 900123', email: 'james@velvetdrivers.co.uk' },
  'Robert K.': { phone: '+44 7700 900234', email: 'robert@velvetdrivers.co.uk' },
  'David C.': { phone: '+44 7700 900345', email: 'david@velvetdrivers.co.uk' },
  'Anna B.': { phone: '+44 7700 900456', email: 'anna@velvetdrivers.co.uk' },
  'Oliver T.': { phone: '+44 7700 900567', email: 'oliver@velvetdrivers.co.uk' }
};

const formatDateHeading = (date: string) => {
  const parsed = new Date(date);
  return isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
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
                        <div className="flex-1 space-y-3">
                          <div className="space-y-1">
                            <p className="text-xs uppercase tracking-wider text-amber-300">
                              Booking #{booking.id}
                              {booking.bookingCreated ? `. Created: ${booking.bookingCreated}` : ''}
                              {booking.bookingAccepted ? `. Accepted: ${booking.bookingAccepted}` : ''}
                            </p>
                            <p className="text-sm text-gray-400">
                              {booking.vehicle} · {booking.numberPlate}
                            </p>
                          </div>
                          <div>
                            <h3 className="text-xl font-semibold text-white">{booking.pickup}</h3>
                            <p className="text-sm text-gray-400">{booking.dropOffs.join(' · ')}</p>
                          </div>
                          <div className="space-y-1 text-sm text-gray-200">
                            <p>Passenger: {booking.passengerName} · Phone: {booking.passengerPhone}</p>
                            <p>Fare quoted: £{booking.fareQuoted.toFixed(2)}</p>
                            <p>Booked by: {booking.bookedBy}</p>
                          </div>
                          <p className="text-xs text-gray-400">Notes: {booking.notes}</p>
                        </div>
                        <div className="space-y-2 rounded-2xl border border-white/10 bg-black/40 p-4 lg:basis-[45%]">
                          <p className="text-sm font-semibold text-white">Driver contact</p>
                          {driverInfo ? (
                            <>
                              <p className="text-xs text-gray-400">Name: {booking.driverName}</p>
                              <p className="text-xs text-gray-400">Phone: {driverInfo.phone}</p>
                              <p className="text-xs text-gray-400">Email: {driverInfo.email}</p>
                            </>
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
