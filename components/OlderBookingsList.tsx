'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Search } from 'lucide-react';

type LiveBooking = {
  journeyId: number;
  id: number;
  code: string;
  pickup: string;
  dropOff: string;
  passenger: string;
  phone: string;
  notes: string;
  time: string;
  date: string;
  priceDetails: string;
  bookedBy: string;
  vehicle?: string;
  driverId?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  journeyDate?: string | null;
};

type DriverEntry = {
  id: string;
  name: string;
  phone: string;
  email: string;
  license: string;
  carLabel: string;
};

const formatDateHeading = (date: string) => {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDateOnly = (value?: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const buildDriverLabel = (driver: any) => {
  const activeCar = Array.isArray(driver.carDetails)
    ? driver.carDetails.find((car: any) => car.status === 'active')
    : null;
  const fallbackCar = !activeCar && Array.isArray(driver.carDetails) ? driver.carDetails[0] : null;
  const selectedCar = activeCar || fallbackCar;
  const make = selectedCar?.make || '-';
  const model = selectedCar?.model || '-';
  const plateNo = selectedCar?.vrm || '-';
  if (make === '-' && model === '-' && plateNo === '-') return '-';
  const carName = [make, model].filter((value) => value && value !== '-').join(' ');
  return carName ? `${carName} · ${plateNo}` : plateNo;
};

const OlderBookingsList: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [query, setQuery] = useState('');
  const [bookings, setBookings] = useState<LiveBooking[]>([]);
  const [drivers, setDrivers] = useState<Record<string, DriverEntry>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const [bookingsRes, driversRes] = await Promise.all([
          fetch('/api/admin/live-bookings', { cache: 'no-store' }),
          fetch('/api/admin/drivers', { cache: 'no-store' }),
        ]);
        if (!bookingsRes.ok) {
          throw new Error('Failed to load bookings');
        }
        if (!driversRes.ok) {
          throw new Error('Failed to load drivers');
        }
        const bookingData = await bookingsRes.json();
        const driverData = await driversRes.json();
        if (!mounted) return;
        const mappedBookings = (bookingData.bookings || []).map((item: any) => ({
          journeyId: Number(item.journeyId ?? item.id),
          id: Number(item.id ?? item.journeyId),
          code: item.code || `VD-${String(item.id ?? item.journeyId).padStart(4, '0')}`,
          pickup: item.pickup,
          dropOff: item.dropOff,
          passenger: item.passenger,
          phone: item.phone,
          notes: item.notes,
          time: item.time,
          date: item.date,
          priceDetails: item.priceDetails,
          bookedBy: item.bookedBy,
          vehicle: item.vehicle || 'Unknown',
          driverId: item.driverId || '',
          createdAt: item.createdAt ?? null,
          updatedAt: item.updatedAt ?? null,
          journeyDate: item.journeyDate ?? null,
        })) as LiveBooking[];

        const driverLookup = (driverData.drivers || []).reduce((acc: Record<string, DriverEntry>, driver: any) => {
          const id = String(driver.id);
          acc[id] = {
            id,
            name: driver.name || `Driver ${id}`,
            phone: driver.phone || '-',
            email: driver.email || '-',
            license: driver.license || '-',
            carLabel: buildDriverLabel(driver),
          };
          return acc;
        }, {});

        setBookings(mappedBookings);
        setDrivers(driverLookup);
        setError(null);
      } catch (err) {
        console.error(err);
        if (mounted) setError('Failed to load job history.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const allocatedBookings = useMemo(() => {
    const now = Date.now();
    return bookings.filter((booking) => {
      if (!booking.driverId) return false;
      const source = booking.journeyDate || `${booking.date}T${booking.time}`;
      const journeyTime = new Date(source);
      if (Number.isNaN(journeyTime.getTime())) return false;
      return journeyTime.getTime() <= now;
    });
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    if (!query.trim()) {
      return allocatedBookings;
    }
    const searchTerm = query.toLowerCase();
    return allocatedBookings.filter((booking) => {
      const driver = booking.driverId ? drivers[booking.driverId] : null;
      const haystack = [
        booking.code,
        booking.pickup,
        booking.dropOff,
        booking.passenger,
        booking.phone,
        booking.notes,
        booking.bookedBy,
        booking.priceDetails,
        driver?.name,
        driver?.phone,
        driver?.email,
        driver?.license,
        driver?.carLabel,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(searchTerm);
    });
  }, [allocatedBookings, drivers, query]);

  const groupedBookings = useMemo(() => {
    const map = new Map<string, LiveBooking[]>();
    filteredBookings.forEach((booking) => {
      const journeyKey = booking.journeyDate || '';
      const groupKey = journeyKey ? journeyKey.split('T')[0] : booking.date || 'Unknown date';
      const existing = map.get(groupKey) ?? [];
      map.set(groupKey, [...existing, booking]);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredBookings]);

  const handleCancel = async (booking: LiveBooking) => {
    if (!booking.journeyId) return;
    setCancelBusy((prev) => ({ ...prev, [booking.journeyId]: true }));
    try {
      const res = await fetch('/api/admin/unassign-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journeyId: booking.journeyId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to unassign driver');
      }
      setBookings((prev) =>
        prev.map((entry) =>
          entry.id === booking.id ? { ...entry, driverId: '' } : entry
        )
      );
    } catch (err) {
      console.error('Failed to unassign driver', err);
    } finally {
      setCancelBusy((prev) => ({ ...prev, [booking.journeyId]: false }));
    }
  };

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

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-8 text-center text-gray-400">
          Loading job history...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-8 text-center text-red-400">
          {error}
        </div>
      ) : groupedBookings.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-8 text-center text-gray-400">
          No jobs in history yet.
        </div>
      ) : (
        <div className="space-y-6">
          {groupedBookings.map(([date, entries]) => (
            <div key={date} className="space-y-4 rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-400">Date</p>
                  <h2 className="text-xl font-semibold text-white">{formatDateHeading(date)}</h2>
                </div>
                <p className="text-sm text-gray-400">{entries.length} bookings</p>
              </div>

              <div className="space-y-4">
                {entries.map((booking) => {
                  const driverInfo = booking.driverId ? drivers[booking.driverId] : null;
                  const bookingCreated = formatDateTime(booking.createdAt);
                  const bookingAccepted = formatDateTime(booking.updatedAt);
                  const journeyDate = booking.date || formatDateOnly(booking.journeyDate);
                  return (
                    <div
                      key={booking.id}
                      className="rounded-2xl border border-white/10 bg-black/60 p-5 shadow-inner shadow-black/40"
                    >
                      <div className="flex flex-col gap-6 lg:flex-row">
                        <div className="flex-1 space-y-4">
                          <div className="space-y-1 text-sm text-gray-200">
                            <p>
                              <span className="font-semibold text-white">Booking #{booking.code}.</span>{' '}
                              Date of booking : {bookingCreated || booking.createdAt || '-'}
                              {bookingAccepted ? `. Accepted: ${bookingAccepted}` : ''}
                            </p>
                            <p>Booked and dispatched by: {booking.bookedBy}</p>
                          </div>

                          <div className="space-y-1 text-sm text-gray-200">
                            <p>
                              Date of journey : <span className="font-semibold text-white">{journeyDate || '-'}</span>
                            </p>
                            <p>
                              Time: <span className="font-semibold text-white">{booking.time}</span>
                            </p>
                            <p>
                              Passenger: <span className="font-semibold text-white">{booking.passenger}</span>
                            </p>
                            <p>
                              Phone: <span className="font-semibold text-white">{booking.phone}</span>
                            </p>
                            <p>
                              Pickup: <span className="font-semibold text-white">{booking.pickup}</span>
                            </p>
                            <p>
                              Drop-off: <span className="font-semibold text-white">{booking.dropOff}</span>
                            </p>
                            <p>
                              Notes: <span className="font-semibold text-white">{booking.notes}</span>
                            </p>
                            <p>
                              Fare quoted: <span className="font-semibold text-white">{booking.priceDetails}</span>
                            </p>
                          </div>
                        </div>
                        <div className="space-y-3 rounded-2xl border border-white/10 bg-black/40 p-4 lg:basis-[45%]">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-white">Driver contact</p>
                            <button
                              type="button"
                              onClick={() => handleCancel(booking)}
                              disabled={cancelBusy[booking.journeyId]}
                              className="text-[11px] font-semibold uppercase tracking-[0.3em] rounded-full px-3 py-1 transition flex items-center gap-1 border border-red-400 bg-red-500 text-white hover:bg-red-400 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              Cancel
                            </button>
                          </div>
                          {driverInfo ? (
                            <div className="space-y-1 text-xs text-gray-300">
                              <p>Name: {driverInfo.name}</p>
                              <p>Phone: {driverInfo.phone}</p>
                              <p>PCO licence number: {driverInfo.license}</p>
                              <p>{driverInfo.carLabel}</p>
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
