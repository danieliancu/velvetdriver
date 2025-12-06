'use client';

import React, { useEffect, useState } from 'react';
import AdminPageHeader from '@/components/AdminPageHeader';

type DriverDirectoryEntry = {
  name: string;
  phone: string;
  plateNo: string;
  make: string;
  model: string;
};

const driverDirectory: Record<string, DriverDirectoryEntry> = {
  james: {
    name: 'James P.',
    phone: '+447404494690',
    plateNo: 'DL 123 ABC',
    make: 'Mercedes-Benz',
    model: 'S-Class'
  },
  robert: {
    name: 'Robert K.',
    phone: '+44 7700 900234',
    plateNo: 'RX70 DVE',
    make: 'BMW',
    model: '7 Series'
  },
  david: {
    name: 'David C.',
    phone: '+44 7700 900345',
    plateNo: 'DC19 PCO',
    make: 'Audi',
    model: 'A8'
  },
  anna: {
    name: 'Anna B.',
    phone: '+44 7700 900456',
    plateNo: 'AB21 LUX',
    make: 'Mercedes-Benz',
    model: 'E-Class'
  },
  oliver: {
    name: 'Oliver T.',
    phone: '+44 7700 900567',
    plateNo: 'OT69 VEL',
    make: 'Lexus',
    model: 'RX'
  }
};

type BookingDriverId = keyof typeof driverDirectory;

type LiveBooking = {
  id: string;
  pickup: string;
  dropOff: string;
  passenger: string;
  phone: string;
  notes: string;
  time: string;
  date: string;
  priceDetails: string;
  bookedBy: string;
  drivers: BookingDriverId[];
};

type LiveBookingResponse = {
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
};

const formatPhoneForWhatsApp = (phone: string) => phone.replace(/\D/g, '');
const defaultDriverRoster = Object.keys(driverDirectory) as BookingDriverId[];

const jobDoneStatusLabels = ['Client request', 'Client confirmation', 'Driver confirmed'] as const;
const buildGoogleMapsLink = (location: string) => {
  const trimmed = location.trim();
  if (!trimmed) return '';
  const encoded = encodeURIComponent(trimmed);
  return `https://www.google.com/maps/search/?api=1&query=${encoded}`;
};

const formatLocationWithLink = (label: string, location: string) => {
  const link = buildGoogleMapsLink(location);
  if (!link) return `${label}: ${location}`;
  return `${label}: ${location}\nMap: ${link}`;
};

const buildBookingSummary = (booking: LiveBooking) => {
  const pickupLine = formatLocationWithLink('Pickup', booking.pickup);
  const dropOffLine = formatLocationWithLink('Drop-off', booking.dropOff);

  return `Time: ${booking.time}\nDate: ${booking.date}\nPassenger: ${booking.passenger}\nPhone: ${booking.phone}\n\n${pickupLine}\n\nTO\n\n${dropOffLine}\n\nPrice:  ${booking.priceDetails}\n\nNotes: ${booking.notes}`;
};
const AdminDashboardPage: React.FC = () => {
  const [liveBookings, setLiveBookings] = useState<LiveBooking[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [clientConfirmed, setClientConfirmed] = useState<Record<string, boolean>>({});
  const [driverConfirmed, setDriverConfirmed] = useState<Record<string, boolean>>({});
  const [whatsappOpen, setWhatsappOpen] = useState<Record<string, boolean>>({});
  const [driverMessages, setDriverMessages] = useState<Record<string, string>>({});
  const [driversExpanded, setDriversExpanded] = useState<Record<string, boolean>>({});
  const [pendingDriverConfirmKey, setPendingDriverConfirmKey] = useState<string | null>(null);
  const [pendingClientConfirmId, setPendingClientConfirmId] = useState<string | null>(null);
  const [historyToggle, setHistoryToggle] = useState<Record<string, boolean>>({});
  // Manual booking modal removed; navigate to booking page instead.

  useEffect(() => {
    let isMounted = true;
    const loadBookings = async () => {
      setLiveLoading(true);
      try {
        const res = await fetch('/api/admin/live-bookings', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load live bookings');
        const data = await res.json();
        if (!isMounted) return;
        const bookings: LiveBooking[] = (data.bookings || []).map((item: LiveBookingResponse) => ({
          id: item.code,
          pickup: item.pickup,
          dropOff: item.dropOff,
          passenger: item.passenger,
          phone: item.phone,
          notes: item.notes,
          time: item.time,
          date: item.date,
          priceDetails: item.priceDetails,
          bookedBy: item.bookedBy,
          drivers: defaultDriverRoster,
        }));
        setLiveBookings(bookings);
        setLiveError(null);
      } catch (err) {
        console.error(err);
        if (isMounted) {
          setLiveBookings([]);
          setLiveError('Unable to load live bookings right now.');
        }
      } finally {
        if (isMounted) setLiveLoading(false);
      }
    };
    loadBookings();
    return () => {
      isMounted = false;
    };
  }, []);

  const hasDriverConfirmation = (booking: LiveBooking) =>
    booking.drivers.some((driverId) => {
      const driverKey = `${booking.id}-${driverId}`;
      return Boolean(driverConfirmed[driverKey]);
    });

  const isBookingCompleted = (booking: LiveBooking) =>
    Boolean(clientConfirmed[booking.id]) && hasDriverConfirmation(booking);

  const activeBookings = liveBookings.filter((booking) => !isBookingCompleted(booking));
  const completedLiveBookings = liveBookings.filter(isBookingCompleted);
  const jobsDoneEntries = completedLiveBookings;

  const pendingClientConfirmations = activeBookings.filter(
    (booking) => !clientConfirmed[booking.id]
  ).length;
  const liveBadgeCount = pendingClientConfirmations;

  const toggleClientConfirmation = (bookingId: string) => {
    setClientConfirmed((prev) => ({ ...prev, [bookingId]: !prev[bookingId] }));
  };

  const toggleDriverConfirmation = (driverKey: string) => {
    setDriverConfirmed((prev) => ({ ...prev, [driverKey]: !prev[driverKey] }));
  };

  const confirmDriverToggle = (driverKey: string, isAlreadyConfirmed: boolean) => {
    if (isAlreadyConfirmed) {
      toggleDriverConfirmation(driverKey);
      return;
    }
    setPendingDriverConfirmKey(driverKey);
  };

  const handleConfirmDriver = () => {
    if (!pendingDriverConfirmKey) return;
    toggleDriverConfirmation(pendingDriverConfirmKey);
    setPendingDriverConfirmKey(null);
  };

  const handleCancelDriver = () => {
    setPendingDriverConfirmKey(null);
  };

  const toggleWhatsApp = (driverKey: string) => {
    setWhatsappOpen((prev) => ({ ...prev, [driverKey]: !prev[driverKey] }));
  };

  const toggleDriversSection = (bookingId: string) => {
    setDriversExpanded((prev) => ({ ...prev, [bookingId]: !prev[bookingId] }));
  };

  const toggleHistoryStatus = (bookingId: string) => {
    setHistoryToggle((prev) => ({ ...prev, [bookingId]: !prev[bookingId] }));
  };

  const handlePasteInfo = (driverKey: string, booking: LiveBooking) => {
    setDriverMessages((prev) => ({ ...prev, [driverKey]: buildBookingSummary(booking) }));
  };

  const openWhatsAppChat = (driverKey: string, text: string) => {
    if (!text) return;
    const driverId = driverKey.split('-').at(-1);
    if (!driverId) return;
    const driver = driverDirectory[driverId as BookingDriverId];
    if (!driver) return;
    const digits = formatPhoneForWhatsApp(driver.phone);
    if (!digits) return;
    const params = new URLSearchParams();
    params.set('text', text);
    const url = `whatsapp://send?phone=${digits}&${params.toString()}`;
    if (typeof window !== 'undefined') {
      window.location.href = url;
    }
  };

  const handleSend = (driverKey: string, fallbackMessage?: string) => {
    const draft = (driverMessages[driverKey] ?? '').trim();
    const message = draft || fallbackMessage?.trim() || '';
    if (!message) return;
    openWhatsAppChat(driverKey, message);
    setDriverMessages((prev) => ({ ...prev, [driverKey]: '' }));
  };

  const handleClear = (driverKey: string) => {
    setDriverMessages((prev) => ({ ...prev, [driverKey]: '' }));
  };

  const requestClientConfirmation = (bookingId: string) => {
    if (clientConfirmed[bookingId]) {
      toggleClientConfirmation(bookingId);
      return;
    }
    setPendingClientConfirmId(bookingId);
  };

  const handleConfirmClient = () => {
    if (!pendingClientConfirmId) return;
    toggleClientConfirmation(pendingClientConfirmId);
    setPendingClientConfirmId(null);
  };

  const handleCancelClient = () => {
    setPendingClientConfirmId(null);
  };

  const handleReturnToLive = (booking: LiveBooking) => {
    setClientConfirmed((prev) => ({ ...prev, [booking.id]: false }));
    setDriverConfirmed((prev) => {
      const updated = { ...prev };
      booking.drivers.forEach((driverId) => {
        const key = `${booking.id}-${driverId}`;
        delete updated[key];
      });
      return updated;
    });
  };
  return (
    <>
      <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="w-full flex-grow p-4 sm:p-6 md:p-8">
        <div className="max-w-6xl mx-auto w-full space-y-8">
          <AdminPageHeader active="live" liveBadgeCount={liveBadgeCount} />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => window.location.assign('#/booking')}
              className="px-4 py-2 text-sm font-semibold rounded-md bg-amber-500 text-black hover:bg-amber-400 transition shadow-[0_0_12px_rgba(251,191,36,0.4)]"
            >
              Add manual booking
            </button>
          </div>

          <main className="w-full space-y-6">
            <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-6">
              <div className="flex flex-col gap-6">
                {liveLoading ? (
                  <p className="text-sm text-gray-400">Loading live bookings...</p>
                ) : liveError ? (
                  <p className="text-sm text-red-400">{liveError}</p>
                ) : activeBookings.length === 0 ? (
                  <p className="text-sm text-gray-400">All live bookings are completed.</p>
                ) : (
                  activeBookings.map((booking) => {
                    const confirmed = clientConfirmed[booking.id];
                    const bookingDrivers = booking.drivers
                      .map((driverId) => {
                        const driver = driverDirectory[driverId];
                        if (!driver) return null;
                        return { id: driverId, ...driver };
                      })
                      .filter(Boolean) as Array<{ id: BookingDriverId } & DriverDirectoryEntry>;
                    const bookingConfirmed = hasDriverConfirmation(booking);

                    return (
                      <article
                        key={booking.id}
                        className="flex flex-col md:flex-row rounded-2xl border border-white/10 bg-black/40 p-5 gap-12"
                      >
                        <div className="flex flex-col gap-6 lg:flex-column md:basis-1/2 md:min-w-[300px]">
                          <div className="flex-1 space-y-3">
                            <p className="text-sm font-semibold tracking-wide text-white">{booking.id}</p>
                            <p className="text-sm text-gray-300">
                              Pickup: {booking.pickup} � Drop-off: {booking.dropOff}
                            </p>
                            <p className="text-sm text-gray-300">
                              Time: {booking.time} � Date: {booking.date}
                            </p>
                            <p className="text-sm text-gray-300">
                              Passenger: {booking.passenger} � Phone: {booking.phone}
                            </p>
                            <p className="text-sm text-gray-300">
                              Price:{' '}
                              <span className="font-semibold text-white">{booking.priceDetails}</span>
                            </p>
                            <p className="text-sm text-gray-300">Booked by: {booking.bookedBy}</p>
                            <p className="text-xs text-gray-400">Notes: {booking.notes}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 pt-2">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full bg-green-400" />
                              <span className="text-sm font-semibold text-green-400">Client request</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => requestClientConfirmation(booking.id)}
                              className={`flex items-center gap-2 text-sm font-semibold transition ${
                                confirmed ? 'text-green-400' : 'text-gray-300'
                              }`}
                            >
                              <span
                                className={`w-3 h-3 rounded-full ${
                                  confirmed ? 'bg-green-400' : 'bg-red-500 animate-[pulse_0.6s_infinite]'
                                }`}
                              ></span>
                              <span>{confirmed ? 'Client confirmation' : 'Waiting client confirmation'}</span>
                            </button>
                          </div>
                        </div>

                        <div
                          className={`space-y-3 rounded-2xl border border-white/10 bg-black/60 p-4 lg:basis-[55%] md:basis-1/2 md:min-w-[300px] md:shrink-0 transition-[height] duration-300 overflow-hidden ${
                            (driversExpanded[booking.id] ?? false) ? '' : 'h-[52px]'
                          }`}
                        >
                          {(() => {
                            const isExpanded = driversExpanded[booking.id] ?? false;
                            return (
                              <>
                                <button
                                  type="button"
                                  onClick={() => toggleDriversSection(booking.id)}
                                  className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-[0.3em] text-gray-400"
                                >
                                  <span
                                    className={`flex items-center gap-2 ${
                                      bookingConfirmed ? 'text-green-300' : 'text-gray-400'
                                    }`}
                                  >
                                    {bookingConfirmed ? 'Driver confirmed' : 'Drivers available'}
                                    <svg
                                      className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                      viewBox="0 0 10 6"
                                      fill="none"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.25" />
                                    </svg>
                                  </span>
                                  <span className="sr-only">toggle</span>
                                </button>
                                {isExpanded && (
                                  <div className="space-y-3 pt-3">
                                    {bookingDrivers.map((driver) => {
                                      const driverKey = `${booking.id}-${driver.id}`;
                                      const confirmedDriver = driverConfirmed[driverKey];
                                      const isWhatsappOpen = whatsappOpen[driverKey];
                                      const messageValue = driverMessages[driverKey] ?? '';
                                      const bookingLocked = bookingConfirmed && !confirmedDriver;

                                      return (
                                        <div
                                          key={driverKey}
                                          className="space-y-2 rounded-2xl border border-white/5 bg-black/40 p-3"
                                        >
                                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                              <p className="text-sm font-semibold text-white">{driver.name}</p>
                                              <p className="text-[11px] text-gray-400">Phone: {driver.phone}</p>
                                              <p className="text-[11px] text-gray-400">Plate no: {driver.plateNo}</p>
                                              <p className="text-[11px] text-gray-400">Make: {driver.make}</p>
                                              <p className="text-[11px] text-gray-400">Model: {driver.model}</p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-3">
                                              <button
                                                type="button"
                                                onClick={() => confirmDriverToggle(driverKey, Boolean(confirmedDriver))}
                                                disabled={bookingLocked || !confirmed}
                                                className={`bg-gray-900 flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                                                  confirmedDriver
                                                    ? 'bg-green-600/30 text-green-200'
                                                    : 'text-gray-300'
                                                } ${bookingLocked || !confirmed ? 'opacity-50 cursor-not-allowed' : ''}`}
                                              >
                                                <span
                                                  className={`w-3 h-3 rounded-full border border-white ${
                                                    confirmedDriver ? 'bg-green-400' : 'bg-white'
                                                  }`}
                                                ></span>
                                                <span className="text-[11px]">
                                                  {confirmedDriver ? 'Allocated' : 'Allocate to driver'}
                                                </span>
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => toggleWhatsApp(driverKey)}
                                                disabled={!confirmed}
                                                className={`flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.4em] transition-colors ${
                                                  confirmed
                                                    ? 'text-white opacity-80 hover:opacity-100'
                                                    : 'text-gray-500 opacity-40 cursor-not-allowed'
                                                }`}
                                              >
                                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/80 text-[10px]">
                                                  <svg viewBox="0 0 24 24" className="h-3 w-3 text-white">
                                                    <path
                                                      fill="currentColor"
                                                      d="M12 2C6.476 2 2 6.477 2 12a10 10 0 0016.546 8.657l3.225.48-.726-3.734A9.963 9.963 0 0022 12c0-5.523-4.477-10-10-10zm0 18a8 8 0 01-6.325-12.816l.004-.005a7.977 7.977 0 0111.146 11.221A7.952 7.952 0 0112 20zm1.5-5.5h-1l-.2-.006c-.5-.05-1.35-.6-1.8-1.25-.41-.56-.79-1.35-.77-1.89 0-.67.3-.9.8-.96.58-.08 1.02.32 1.5.32.5 0 .86-.15 1.2-.35.22-.13.38-.29.4-.75.02-.2 0-.55-.01-.76-.02-.31-.25-.55-.56-.57-.27-.01-.52.16-.68.28-.38.32-.8.85-1.08 1.2-.2.26-.5.26-.8.17-.3-.09-.62-.28-.92-.44a5.548 5.548 0 00-.82-.34c-.59-.17-1.2-.06-1.64.38a2.148 2.148 0 00-.58 1.6c-.07.7.14 1.46.48 2.03.4.7.92 1.38 1.6 1.88.32.24.64.4 1.04.49.63.13 1.35-.03 1.77-.36.19-.15.36-.3.5-.36.19-.08.4-.1.64-.05.3.06.6.22.82.46.5.52.72 1.24 1.04 2.02.33.82.85 1.67 1.46 2.19H13z"
                                                    />
                                                  </svg>
                                                </span>
                                                WhatsApp
                                              </button>
                                            </div>
                                          </div>
                                          {isWhatsappOpen && (
                                            <div className="space-y-2">
                                              <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">
                                                Send the booking details via WhatsApp.
                                              </p>
                                              <textarea
                                                className="w-full rounded-xl border border-white/15 bg-black/70 px-3 py-2 text-xs text-gray-100 placeholder:text-gray-500"
                                                rows={3}
                                                value={messageValue}
                                                onChange={(event) =>
                                                  setDriverMessages((prev) => ({
                                                    ...prev,
                                                    [driverKey]: event.target.value
                                                  }))
                                                }
                                                placeholder="Write your message..."
                                              />
                                              <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-300">
                                                <button
                                                  type="button"
                                                  onClick={() => handlePasteInfo(driverKey, booking)}
                                                  className="rounded-full border border-white/20 px-3 py-1 text-xs text-white transition hover:border-amber-400"
                                                >
                                                  Paste booking info
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleSend(driverKey, buildBookingSummary(booking))}
                                                  disabled={!messageValue.trim()}
                                                  className="rounded-full border border-white/20 px-3 py-1 text-xs text-white transition hover:border-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                  Send
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => handleClear(driverKey)}
                                                  className="rounded-full border border-white/20 px-3 py-1 text-xs text-white transition hover:border-amber-400"
                                                >
                                                  Clear
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
            <section className="bg-green-900/50 border border-gray-800 rounded-2xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Job history</h2>
                  <p className="text-sm text-gray-400">Completed bookings with client + driver confirmation.</p>
                </div>
                <div className="text-sm text-gray-400">
                  <span className="font-semibold text-white">{jobsDoneEntries.length}</span> trips
                </div>
              </div>
              <div className="flex flex-col gap-4">
                {jobsDoneEntries.length === 0 ? (
                  <p className="text-sm text-gray-500">No completed jobs logged yet.</p>
                ) : (
                  jobsDoneEntries.map((booking) => (
                    <article
                      key={`job-done-${booking.id}`}
                      className="rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-5 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white">{booking.id}</p>
                        {(() => {
                          const isCompleted = historyToggle[booking.id] ?? false;
                          return (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => toggleHistoryStatus(booking.id)}
                                className={`text-[11px] font-semibold uppercase tracking-[0.3em] rounded-full px-3 py-1 transition flex items-center gap-1 ${
                                  isCompleted
                                    ? 'border border-green-300 text-green-300 hover:bg-green-300 hover:text-black'
                                    : 'border border-amber-300 bg-amber-300 text-black hover:brightness-110'
                                }`}
                              >
                                <span
                                  className={`flex h-3 w-3 items-center justify-center rounded-full text-[10px] ${
                                    isCompleted ? 'bg-green-300 text-black' : 'bg-black text-amber-300'
                                  }`}
                                >
                                  {isCompleted ? (
                                    <svg viewBox="0 0 8 8" className="h-2 w-2" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M1 3.5L3.2 5.6 7 1.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                    </svg>
                                  ) : (
                                    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" xmlns="http://www.w3.org/2000/svg">
                                      <path d="M2 6h8M6 2v8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                                    </svg>
                                  )}
                                </span>
                                {isCompleted ? 'Completed' : 'Allocated'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleReturnToLive(booking)}
                                className="text-[11px] font-semibold uppercase tracking-[0.3em] rounded-full px-3 py-1 transition flex items-center gap-1 border border-red-400 bg-red-500 text-white hover:bg-red-400"
                              >
                                Cancel
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                      <p className="text-sm text-gray-300">
                        Pickup: {booking.pickup} � Drop-off: {booking.dropOff}
                      </p>
                      <p className="text-sm text-gray-300">
                        Time: {booking.time} � Date: {booking.date}
                      </p>
                      <p className="text-sm text-gray-300">
                        Passenger: {booking.passenger} � Phone: {booking.phone}
                      </p>
                      <p className="text-sm text-gray-300">
                        Price:{' '}
                        <span className="font-semibold text-white">{booking.priceDetails}</span>
                      </p>
                      <p className="text-xs text-gray-400">Notes: {booking.notes}</p>
                      <div className="flex flex-wrap gap-4 pt-2">
                        {jobDoneStatusLabels.map((label) => (
                          <span
                            key={`${booking.id}-${label}`}
                            className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-green-300"
                          >
                            <span className="w-2 h-2 rounded-full bg-green-400" />
                            {label}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

          </main>
        </div>
      </div>
    </div>

      {pendingClientConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900/90 p-6 shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300 mb-3">Client confirmation</p>
            <p className="text-lg text-white mb-6">Confirm client approval for this booking?</p>
            <div className="flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={handleCancelClient}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-gray-200 hover:border-white/40 transition"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleConfirmClient}
                className="rounded-full border border-amber-400 bg-amber-400 px-5 py-2 text-sm font-semibold text-black shadow-[0_0_20px_rgba(251,191,36,0.4)] hover:shadow-[0_0_30px_rgba(251,191,36,0.6)] transition"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingDriverConfirmKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900/90 p-6 shadow-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300 mb-3">Allocate to driver</p>
          <p className="text-lg text-white mb-6">Do you want to confirm this booking?</p>
            <div className="flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={handleCancelDriver}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-gray-200 hover:border-white/40 transition"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleConfirmDriver}
                className="rounded-full border border-amber-400 bg-amber-400 px-5 py-2 text-sm font-semibold text-black shadow-[0_0_20px_rgba(251,191,36,0.4)] hover:shadow-[0_0_30px_rgba(251,191,36,0.6)] transition"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminDashboardPage;




