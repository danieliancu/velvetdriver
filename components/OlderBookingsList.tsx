'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';

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
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  const parts = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).formatToParts(parsed);
  const weekday = parts.find((part) => part.type === 'weekday')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  const year = parts.find((part) => part.type === 'year')?.value;
  return weekday && month && day && year ? `${weekday} ${month} ${day} ${year}` : date;
};

const toDateKey = (booking: LiveBooking) => {
  if (booking.journeyDate) {
    const rawKey = booking.journeyDate.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(rawKey)) return rawKey;
    const parsed = new Date(booking.journeyDate);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(booking.date || '')) {
    const [day, month, year] = String(booking.date).split('/');
    return `${year}-${month}-${day}`;
  }
  return booking.date || 'Unknown date';
};

const toTimeRank = (booking: LiveBooking) => {
  if (booking.journeyDate) {
    const parsed = new Date(booking.journeyDate);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }
  const dateKey = toDateKey(booking);
  const timeMatch = (booking.time || '').match(/^(\d{1,2}):(\d{2})/);
  if (timeMatch && /^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    const [, hour, minute] = timeMatch;
    const parsed = new Date(`${dateKey}T${hour.padStart(2, '0')}:${minute}:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed.getTime();
  }
  return Number.MAX_SAFE_INTEGER;
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
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const [bookingsRes, driversRes] = await Promise.all([
          fetch('/api/admin/older-bookings', { cache: 'no-store' }),
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

  const filteredBookings = useMemo(() => {
    if (!query.trim()) {
      return bookings;
    }
    const searchTerm = query.toLowerCase();
    return bookings.filter((booking) => {
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
  }, [bookings, drivers, query]);

  const groupedBookings = useMemo(() => {
    const map = new Map<string, LiveBooking[]>();
    filteredBookings.forEach((booking) => {
      const groupKey = toDateKey(booking);
      const existing = map.get(groupKey) ?? [];
      map.set(groupKey, [...existing, booking]);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, entries]) => [date, [...entries].sort((a, b) => toTimeRank(a) - toTimeRank(b))] as const);
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
          {groupedBookings.map(([date, entries]) => {
            const isCollapsed = collapsedDates[date] ?? true;

            return (
              <div key={date} className="space-y-4 rounded-2xl border border-white/10 bg-black/30 p-5">
                <button
                  type="button"
                  onClick={() => setCollapsedDates((prev) => ({ ...prev, [date]: !(prev[date] ?? true) }))}
                  className="flex w-full items-center justify-between text-left"
                  aria-expanded={!isCollapsed}
                >
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400">Date</p>
                    <h2 className="text-xl font-semibold text-white">{formatDateHeading(date)}</h2>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <p>{entries.length} bookings</p>
                    {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                  </div>
                </button>

                {!isCollapsed && (
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
                                Date of journey :{' '}
                                <span className="font-semibold text-white">{journeyDate || '-'}</span>
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
                            <p className="text-sm font-semibold text-white">Driver contact</p>
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
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OlderBookingsList;
