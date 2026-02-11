'use client';

import React, { useEffect, useState } from 'react';
import AdminPageHeader from '@/components/AdminPageHeader';

type DriverDirectoryEntry = {
  id: string;
  name: string;
  phone: string;
  email: string;
  license: string;
  cars: Array<{
    id: number;
    status: string;
    plateNo: string;
    make: string;
    model: string;
    vehicleTypeId: number | null;
    vehicleTypeLabel: string;
  }>;
};

type LiveBooking = {
  journeyId: number;
  id: string;
  pickup: string;
  dropOff: string;
  passenger: string;
  phone: string;
  email: string;
  notes: string;
  time: string;
  date: string;
  journeyDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  priceDetails: string;
  bookedBy: string;
  bookedByStaffId?: number | null;
  drivers: string[];
  vehicle?: string;
  vehicleTypeId?: number | null;
  clientEmail?: string;
  driverId?: string;
  clientConfirmed?: boolean;
};

type LiveBookingResponse = {
  id: number;
  code: string;
  pickup: string;
  dropOff: string;
  passenger: string;
  phone: string;
  passengerEmail?: string;
  clientEmail?: string;
  notes: string;
  time: string;
  date: string;
  journeyDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  priceDetails: string;
  bookedBy: string;
  bookedByStaffId?: number | null;
  vehicle?: string;
  vehicleTypeId?: number | null;
  driverId?: string;
  clientConfirmed?: boolean;
};

type VehicleTier = 'executive' | 'luxury' | 'luxury_mpv' | null;

const formatPhoneForWhatsApp = (phone: string) => phone.replace(/\D/g, '');

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

const formatCarLabel = (car: {
  make: string;
  model: string;
  plateNo: string;
}) => {
  const makeModel = [car.make, car.model].filter((item) => item && item !== '-').join(' ').trim();
  if (makeModel && car.plateNo && car.plateNo !== '-') return `${makeModel} - ${car.plateNo}`;
  return makeModel || car.plateNo || 'Unknown car';
};

const appendSelectedCarInstruction = (message: string, selectedCarLabel?: string) => {
  if (!selectedCarLabel) return message;
  return `${message}\n\nPlease use the car ${selectedCarLabel}`;
};

const getJourneyTimestamp = (booking: LiveBooking) => {
  if (booking.journeyDate) {
    const parsed = new Date(booking.journeyDate);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  }

  // Fallback for legacy payloads without journeyDate.
  const fallback = new Date(`${booking.date}T${booking.time}`);
  return Number.isNaN(fallback.getTime()) ? null : fallback.getTime();
};

const formatBookingCreatedAt = (createdAt?: string | null) => {
  if (!createdAt) return '';
  const parsed = new Date(createdAt);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

const resolveVehicleTier = (label?: string | null): VehicleTier => {
  if (!label) return null;
  const normalized = label.toLowerCase().trim();
  if (normalized.includes('luxury mpv')) return 'luxury_mpv';
  if (normalized.includes('luxury')) return 'luxury';
  if (normalized.includes('executive')) return 'executive';
  return null;
};

const canServeVehicleType = (
  driverVehicleTypeId: number | null,
  bookingVehicleTypeId: number | null,
  vehicleLabelById: Record<number, string>
) => {
  if (!bookingVehicleTypeId) return true;
  if (!driverVehicleTypeId) return false;

  const bookingTier = resolveVehicleTier(vehicleLabelById[bookingVehicleTypeId]);
  const driverTier = resolveVehicleTier(vehicleLabelById[driverVehicleTypeId]);

  if (!bookingTier || !driverTier) {
    return driverVehicleTypeId === bookingVehicleTypeId;
  }

  if (driverTier === 'luxury_mpv') {
    return bookingTier === 'luxury_mpv' || bookingTier === 'luxury' || bookingTier === 'executive';
  }
  if (driverTier === 'luxury') {
    return bookingTier === 'luxury' || bookingTier === 'executive';
  }
  return bookingTier === 'executive';
};

const getEligibleCarsForBooking = (
  driver: DriverDirectoryEntry,
  bookingVehicleTypeId: number | null,
  vehicleLabelById: Record<number, string>
) =>
  driver.cars.filter((car) =>
    canServeVehicleType(car.vehicleTypeId ?? null, bookingVehicleTypeId, vehicleLabelById)
  );

const AdminDashboardPage: React.FC = () => {
  const [liveBookings, setLiveBookings] = useState<LiveBooking[]>([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [clientConfirmed, setClientConfirmed] = useState<Record<string, boolean>>({});
  const [whatsappOpen, setWhatsappOpen] = useState<Record<string, boolean>>({});
  const [driverMessages, setDriverMessages] = useState<Record<string, string>>({});
  const [driversExpanded, setDriversExpanded] = useState<Record<string, boolean>>({});
  const [pendingDriverConfirmKey, setPendingDriverConfirmKey] = useState<string | null>(null);
  const [pendingClientConfirmId, setPendingClientConfirmId] = useState<string | null>(null);
  const [commissionInputs, setCommissionInputs] = useState<Record<string, string>>({});
  const [selectedCarByDriverKey, setSelectedCarByDriverKey] = useState<Record<string, number>>({});
  const [availableDrivers, setAvailableDrivers] = useState<DriverDirectoryEntry[]>([]);
  // Manual booking modal removed; navigate to booking page instead.
  const [staffOptions, setStaffOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [bookedBySelection, setBookedBySelection] = useState<Record<string, string>>({});
  const [bookedBySaving, setBookedBySaving] = useState<Record<string, boolean>>({});
  const [vehicleLabelById, setVehicleLabelById] = useState<Record<number, string>>({});

  const fallbackActive: LiveBooking[] = [
    {
      journeyId: 0,
      id: 'BK-1024',
      pickup: 'Heathrow T5 Arrivals',
      dropOff: 'The Langham, 1C Portland Pl, London W1B 1JA',
      passenger: 'Maria Popescu',
      phone: '+44 7700 900111',
      email: 'maria.popescu@example.com',
      notes: 'Meet & greet, 1x large suitcase, flight BA0892, watch delays',
      time: '13:15',
      date: '2026-01-10',
      priceDetails: 'GBP 145.00 | Exec | includes parking',
      bookedBy: 'Velvet Concierge',
      drivers: []
    }
  ];

  const fallbackCompleted: LiveBooking[] = [];

  useEffect(() => {
    let isMounted = true;
    const loadDrivers = async () => {
      try {
        const res = await fetch('/api/admin/drivers', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!isMounted) return;
        const pricingVehicleMap = (data.pricingVehicles || []).reduce(
          (acc: Record<number, string>, vehicle: { id?: number; label?: string }) => {
            if (!vehicle?.id) return acc;
            acc[Number(vehicle.id)] = String(vehicle.label || '');
            return acc;
          },
          {}
        );
        setVehicleLabelById(pricingVehicleMap);
        const mapped = (data.drivers || []).map((driver: any) => {
          const cars = Array.isArray(driver.carDetails)
            ? driver.carDetails.map((car: any) => ({
                id: Number(car.id),
                status: String(car.status || 'inactive').toLowerCase(),
                plateNo: car.vrm || '-',
                make: car.make || '-',
                model: car.model || '-',
                vehicleTypeId: car.vehicleTypeId ?? null,
                vehicleTypeLabel: car.vehicleTypeLabel || '-',
              }))
            : [];
          return {
            id: String(driver.id),
            name: driver.name,
            phone: driver.phone || '-',
            email: driver.email || '-',
            license: driver.license || '-',
            cars,
          } as DriverDirectoryEntry;
        });
        setAvailableDrivers(mapped);
      } catch (err) {
        console.error('Failed to load drivers roster', err);
      }
    };
    loadDrivers();
    return () => {
      isMounted = false;
    };
  }, []);

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
          journeyId: item.id,
          id: item.code,
          pickup: item.pickup,
          dropOff: item.dropOff,
          passenger: item.passenger,
          phone: item.phone,
          email: item.passengerEmail || item.clientEmail || '',
          notes: item.notes,
          time: item.time,
          date: item.date,
          journeyDate: item.journeyDate ?? null,
          createdAt: item.createdAt ?? null,
          updatedAt: item.updatedAt ?? null,
          priceDetails: item.priceDetails,
          bookedBy: item.bookedBy,
          bookedByStaffId: item.bookedByStaffId ?? null,
          vehicle: item.vehicle || 'Unknown',
          vehicleTypeId: item.vehicleTypeId ?? null,
          clientEmail: item.clientEmail || '',
          driverId: item.driverId || '',
          clientConfirmed: Boolean(item.clientConfirmed),
          drivers: [],
        }));
        setLiveBookings(bookings);
        const confirmMap: Record<string, boolean> = {};
        bookings.forEach((b) => {
          confirmMap[b.id] = Boolean(b.clientConfirmed);
        });
        setClientConfirmed(confirmMap);
        const defaults: Record<string, string> = {};
        bookings.forEach((b) => {
          defaults[b.id] = b.bookedByStaffId ? String(b.bookedByStaffId) : '';
        });
        setBookedBySelection(defaults);
        setLiveError(null);
      } catch (err) {
        console.error(err);
        if (isMounted) {
          const confirmMap: Record<string, boolean> = {};

          setLiveBookings([...fallbackActive, ...fallbackCompleted]);
          const defaults: Record<string, string> = {};
          [...fallbackActive, ...fallbackCompleted].forEach((b) => {
            defaults[b.id] = '';
          });
          setBookedBySelection(defaults);
          setClientConfirmed(confirmMap);
          setLiveError(null);
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

  useEffect(() => {
    const loadStaff = async () => {
      try {
        const res = await fetch('/api/admin/staff', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const names = (data.staff || [])
          .map((s: { id?: number; fullName?: string }) =>
            s.fullName && s.id ? { id: Number(s.id), name: s.fullName } : null
          )
          .filter(Boolean) as Array<{ id: number; name: string }>;
        setStaffOptions(names);
      } catch (err) {
        console.error('Failed to load staff for booked by dropdown', err);
      }
    };
    loadStaff();
  }, []);

  const handleBookedByChange = async (booking: LiveBooking, staffIdValue: string) => {
    const previous = bookedBySelection[booking.id] || '';
    setBookedBySelection((prev) => ({ ...prev, [booking.id]: staffIdValue }));
    if (!booking.journeyId) return;
    setBookedBySaving((prev) => ({ ...prev, [booking.id]: true }));
    try {
      const staffId = staffIdValue ? Number(staffIdValue) : null;
      const res = await fetch('/api/admin/live-bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: booking.journeyId, bookedByStaffId: staffId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to update booked by');
      }
      const staffName = staffId
        ? staffOptions.find((s) => s.id === staffId)?.name || booking.bookedBy
        : booking.bookedBy;
      setLiveBookings((prev) =>
        prev.map((b) =>
          b.id === booking.id
            ? { ...b, bookedBy: staffName, bookedByStaffId: staffId }
            : b
        )
      );
    } catch (err) {
      console.error(err);
      setBookedBySelection((prev) => ({ ...prev, [booking.id]: previous }));
    } finally {
      setBookedBySaving((prev) => ({ ...prev, [booking.id]: false }));
    }
  };

  const partitionedBookings = React.useMemo(() => {
    const now = Date.now();
    const live: LiveBooking[] = [];
    const history: LiveBooking[] = [];

    for (const booking of liveBookings) {
      const allocatedToDriver = Boolean(booking.driverId);
      const journeyTime = getJourneyTimestamp(booking);
      const shouldBeVisibleInHistory = allocatedToDriver && journeyTime !== null && journeyTime <= now;

      if (shouldBeVisibleInHistory) {
        history.push(booking);
      } else if (!allocatedToDriver) {
        live.push(booking);
      }
    }

    live.sort((a, b) => {
      const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : NaN;
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : NaN;

      if (!Number.isNaN(aCreated) && !Number.isNaN(bCreated)) {
        return bCreated - aCreated;
      }
      if (!Number.isNaN(aCreated)) return -1;
      if (!Number.isNaN(bCreated)) return 1;

      return b.journeyId - a.journeyId;
    });

    return { live, history };
  }, [liveBookings]);

  const activeBookings = partitionedBookings.live;
  const jobHistoryBookings = partitionedBookings.history;

  const pendingClientConfirmations = activeBookings.filter(
    (booking) => !clientConfirmed[booking.id]
  ).length;
  const liveBadgeCount = pendingClientConfirmations;

  const toggleClientConfirmation = (bookingId: string, nextValue: boolean) => {
    setClientConfirmed((prev) => ({ ...prev, [bookingId]: nextValue }));
  };

  const confirmDriverToggle = (driverKey: string, isAlreadyConfirmed: boolean) => {
    if (isAlreadyConfirmed) {
      return;
    }
    setPendingDriverConfirmKey(driverKey);
  };

  const handleConfirmDriver = () => {
    if (!pendingDriverConfirmKey) return;
    const lastDash = pendingDriverConfirmKey.lastIndexOf('-');
    if (lastDash <= 0) {
      setPendingDriverConfirmKey(null);
      return;
    }
    const bookingId = pendingDriverConfirmKey.slice(0, lastDash);
    const driverId = pendingDriverConfirmKey.slice(lastDash + 1);
    const booking = liveBookings.find((entry) => entry.id === bookingId);
    if (!booking) {
      setPendingDriverConfirmKey(null);
      return;
    }
    fetch('/api/admin/allocate-driver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ journeyId: booking.journeyId, driverId }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || 'Failed to allocate driver');
        }
        setLiveBookings((prev) =>
          prev.map((entry) =>
            entry.id === booking.id
              ? { ...entry, driverId, updatedAt: new Date().toISOString() }
              : entry
          )
        );
      })
      .catch((err) => {
        console.error('Failed to allocate driver', err);
      })
      .finally(() => {
        setPendingDriverConfirmKey(null);
      });
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

  const getSelectedCarLabel = (driverKey: string, eligibleCars: DriverDirectoryEntry['cars']) => {
    const selectedCarId = selectedCarByDriverKey[driverKey];
    if (!selectedCarId) return '';
    const selectedCar = eligibleCars.find((car) => car.id === selectedCarId);
    return selectedCar ? formatCarLabel(selectedCar) : '';
  };

  const handlePasteInfo = (
    driverKey: string,
    booking: LiveBooking,
    selectedCarLabel?: string
  ) => {
    const baseMessage = buildBookingSummary(booking);
    setDriverMessages((prev) => ({
      ...prev,
      [driverKey]: appendSelectedCarInstruction(baseMessage, selectedCarLabel),
    }));
  };

  const openWhatsAppChat = (driverKey: string, text: string) => {
    if (!text) return;
    const driverId = driverKey.split('-').at(-1);
    if (!driverId) return;
    const driver = availableDrivers.find((entry) => entry.id === driverId);
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

  const handleSend = (driverKey: string, fallbackMessage?: string, selectedCarLabel?: string) => {
    const draft = (driverMessages[driverKey] ?? '').trim();
    const baseMessage = draft || fallbackMessage?.trim() || '';
    const message = appendSelectedCarInstruction(baseMessage, selectedCarLabel);
    if (!message) return;
    openWhatsAppChat(driverKey, message);
    setDriverMessages((prev) => ({ ...prev, [driverKey]: '' }));
  };

  const handleClear = (driverKey: string) => {
    setDriverMessages((prev) => ({ ...prev, [driverKey]: '' }));
  };

  const sendClientConfirmationEmail = async (booking: LiveBooking) => {
    if (!booking.journeyId) return;
    try {
      const res = await fetch('/api/admin/client-confirmation-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journeyId: booking.journeyId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to send confirmation email');
      }
    } catch (err) {
      console.error('Failed to send client confirmation email', err);
    }
  };

  const requestClientConfirmation = (booking: LiveBooking) => {
    setPendingClientConfirmId(booking.id);
  };

  const updateClientConfirmation = async (bookingId: string, confirmedValue: boolean) => {
    const booking = liveBookings.find((entry) => entry.id === bookingId);
    if (!booking?.journeyId) return false;
    try {
      const res = await fetch('/api/admin/client-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journeyId: booking.journeyId, confirmed: confirmedValue }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to update client confirmation');
      }
      toggleClientConfirmation(bookingId, confirmedValue);
      return true;
    } catch (err) {
      console.error('Failed to update client confirmation', err);
      return false;
    }
  };

  const handleConfirmClient = async () => {
    if (!pendingClientConfirmId) return;
    const updated = await updateClientConfirmation(pendingClientConfirmId, true);
    if (updated) {
      const booking = liveBookings.find((entry) => entry.id === pendingClientConfirmId);
      if (booking) {
        await sendClientConfirmationEmail(booking);
      }
    }
    setPendingClientConfirmId(null);
  };

  const handleCancelClient = () => {
    setPendingClientConfirmId(null);
  };

  const handleCancelAllocation = async (booking: LiveBooking) => {
    if (!booking.journeyId) return;
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
      setLiveBookings((prev) =>
        prev.map((entry) =>
          entry.id === booking.id
            ? { ...entry, driverId: '', updatedAt: new Date().toISOString() }
            : entry
        )
      );
    } catch (err) {
      console.error('Failed to unassign driver', err);
    }
  };
  return (
    <>
      <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="w-full flex-grow p-4 sm:p-6 md:p-8">
        <div className="max-w-6xl mx-auto w-full space-y-8">
          <AdminPageHeader active="live" liveBadgeCount={liveBadgeCount} />

        {/*
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => window.location.assign('#/booking')}
              className="px-4 py-2 text-sm font-semibold rounded-md bg-amber-500 text-black hover:bg-amber-400 transition shadow-[0_0_12px_rgba(251,191,36,0.4)]"
            >
              Add manual booking
            </button>
          </div>
          */}
          
          <main className="w-full space-y-6">
            <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-6">
              <div className="flex flex-col gap-6">
                {liveLoading ? (
                  <p className="text-sm text-gray-400">Loading live bookings...</p>
                ) : liveError ? (
                  <p className="text-sm text-red-400">{liveError}</p>
                ) : activeBookings.length === 0 ? (
                  <p className="text-sm text-gray-400">No live bookings right now.</p>
                ) : (
                  activeBookings.map((booking) => {
                    const confirmed = clientConfirmed[booking.id];
                    const bookingCreatedAt = formatBookingCreatedAt(booking.createdAt);
                    const bookingDrivers = availableDrivers
                      .map((driver) => {
                        const eligibleCars = getEligibleCarsForBooking(
                          driver,
                          booking.vehicleTypeId ?? null,
                          vehicleLabelById
                        );
                        return { ...driver, eligibleCars };
                      })
                      .filter((driver) => driver.eligibleCars.length > 0);
                    const bookingAllocated = Boolean(booking.driverId);

                    return (
                      <article
                        key={booking.id}
                        className="flex flex-col md:flex-row rounded-2xl border border-white/10 bg-black/40 p-5 gap-12"
                      >
                        <div className="flex flex-col gap-6 lg:flex-column md:basis-1/2 md:min-w-[300px]">
                          <div className="flex-1 space-y-3">
                            <p className="text-sm tracking-wide text-white flex items-center gap-3">
                              <span className="inline-flex h-6 items-center font-semibold">{booking.id}</span>
                              {bookingCreatedAt ? (
                                <span className="inline-flex h-6 items-center rounded-full border border-white/25 px-3.5 text-xs font-normal text-gray-300">
                                  {bookingCreatedAt}
                                </span>
                              ) : null}
                            </p>
                            <p className="text-sm text-gray-300">
                              Pickup: <span className="font-semibold text-white">{booking.pickup}</span>
                            </p>
                            <p className="text-sm text-gray-300">
                              Drop-off: <span className="font-semibold text-white">{booking.dropOff}</span>
                            </p>
                            <p className="text-sm text-gray-300">
                              Time: <span className="font-semibold text-white">{booking.time}</span>
                            </p>
                            <p className="text-sm text-gray-300">
                              Date: <span className="font-semibold text-white">{booking.date}</span>
                            </p>
                            <p className="text-sm text-gray-300">
                              Passenger: <span className="font-semibold text-white">{booking.passenger}</span>
                            </p>
                            <p className="text-sm text-gray-300">
                              Phone: <span className="font-semibold text-white">{booking.phone}</span>
                            </p>
                            <p className="text-sm text-gray-300">
                              Email:{' '}
                              <span className="font-semibold text-white">{booking.email || booking.clientEmail || '-'}</span>
                            </p>
                            <p className="text-sm text-gray-300">
                              Price:{' '}
                              <span className="font-semibold text-white">{booking.priceDetails}</span>
                            </p>
                            <p className="text-sm text-gray-300">
                              Vehicle: <span className="font-semibold text-white">{booking.vehicle || 'Unknown'}</span>
                            </p>
                            <div className="text-sm text-gray-300 space-y-1">
                              <span className="block text-gray-400 text-xs uppercase tracking-[0.2em]">Booked by</span>
                              <select
                                className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-sm text-white/80"
                                value={bookedBySelection[booking.id] ?? ''}
                                onChange={(e) => handleBookedByChange(booking, e.target.value)}
                                disabled={bookedBySaving[booking.id]}
                              >
                                <option value="">Select staff</option>
                                {staffOptions.map((staff) => (
                                  <option key={staff.id} value={staff.id}>
                                    {staff.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <p className="text-xs text-gray-400">Notes: {booking.notes}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 pt-2">
                            <div className="flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full bg-green-400" />
                              <span className="text-sm font-semibold text-green-400">Client request</span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                confirmed
                                  ? updateClientConfirmation(booking.id, false)
                                  : requestClientConfirmation(booking)
                              }
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
                                      bookingAllocated ? 'text-green-300' : 'text-gray-400'
                                    }`}
                                  >
                                    {bookingAllocated ? 'Driver confirmed' : 'Drivers available'}
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
                                      const confirmedDriver = booking.driverId === driver.id;
                                      const isWhatsappOpen = whatsappOpen[driverKey];
                                      const messageValue = driverMessages[driverKey] ?? '';
                                      const bookingLocked = bookingAllocated && !confirmedDriver;
                                      const commissionValue = commissionInputs[driverKey] ?? '20';
                                      const selectedCarLabel = getSelectedCarLabel(driverKey, driver.eligibleCars);

                                      return (
                                        <div
                                          key={driverKey}
                                          className="space-y-2 rounded-2xl border border-white/5 bg-black/40 p-3"
                                        >
                                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                              <p className="text-sm font-semibold text-white">{driver.name}</p>
                                              <p className="text-[11px] text-gray-400">Phone: {driver.phone}</p>
                                              <div className="mt-2 space-y-1">
                                                <p className="text-[11px] uppercase tracking-[0.2em] text-gray-400">
                                                  Cars (eligible)
                                                </p>
                                                {driver.eligibleCars.map((car) => {
                                                  const optionId = `${driverKey}-car-${car.id}`;
                                                  const checked = selectedCarByDriverKey[driverKey] === car.id;
                                                  return (
                                                    <label
                                                      key={optionId}
                                                      htmlFor={optionId}
                                                      className="flex items-center gap-2 text-[11px] text-gray-300"
                                                    >
                                                      <input
                                                        id={optionId}
                                                        type="radio"
                                                        name={`${driverKey}-car`}
                                                        checked={checked}
                                                        onChange={() =>
                                                          setSelectedCarByDriverKey((prev) => ({
                                                            ...prev,
                                                            [driverKey]: car.id,
                                                          }))
                                                        }
                                                        className="h-3.5 w-3.5 accent-amber-400"
                                                      />
                                                      <span>
                                                        {formatCarLabel(car)}
                                                        <span className="ml-2 text-gray-500">
                                                          ({car.vehicleTypeLabel} | {car.status})
                                                        </span>
                                                      </span>
                                                    </label>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-3">
                                              <button
                                                type="button"
                                                onClick={() => confirmDriverToggle(driverKey, Boolean(confirmedDriver))}
                                                disabled={bookingLocked || !confirmed || confirmedDriver}
                                                className={`bg-gray-900 flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                                                  confirmedDriver
                                                    ? 'bg-green-600/30 text-green-200'
                                                    : 'text-gray-300'
                                                } ${bookingLocked || !confirmed || confirmedDriver ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                                              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-gray-400">
                                                <span>Commission</span>
                                                <input
                                                  type="number"
                                                  min="0"
                                                  max="100"
                                                  step="0.5"
                                                  value={commissionValue}
                                                  onChange={(event) =>
                                                    setCommissionInputs((prev) => ({
                                                      ...prev,
                                                      [driverKey]: event.target.value
                                                    }))
                                                  }
                                                  className="w-20 rounded-lg border border-white/20 bg-black/70 px-2 py-1 text-xs text-white placeholder:text-gray-600 focus:border-amber-400 focus:outline-none"
                                                />
                                                <span className="text-gray-300">%</span>
                                              </div>
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
                                                  onClick={() =>
                                                    handlePasteInfo(driverKey, booking, selectedCarLabel || undefined)
                                                  }
                                                  className="rounded-full border border-white/20 px-3 py-1 text-xs text-white transition hover:border-amber-400"
                                                >
                                                  Paste booking info
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    handleSend(
                                                      driverKey,
                                                      buildBookingSummary(booking),
                                                      selectedCarLabel || undefined
                                                    )
                                                  }
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

            <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-white">Job History</h3>
                <span className="text-xs text-gray-400">{jobHistoryBookings.length} item(s)</span>
              </div>
              {jobHistoryBookings.length === 0 ? (
                <p className="text-sm text-gray-400">No jobs have started yet.</p>
              ) : (
                <div className="space-y-3">
                  {jobHistoryBookings.map((booking) => (
                    <article
                      key={`history-${booking.id}`}
                      className="rounded-xl border border-white/10 bg-black/40 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white">{booking.id}</p>
                        <p className="text-xs text-gray-400">
                          {booking.date} {booking.time}
                        </p>
                      </div>
                      <p className="mt-2 text-sm text-gray-300">
                        Pickup: <span className="text-white">{booking.pickup}</span>
                      </p>
                      <p className="text-sm text-gray-300">
                        Drop-off: <span className="text-white">{booking.dropOff}</span>
                      </p>
                      <p className="text-sm text-gray-300">
                        Passenger: <span className="text-white">{booking.passenger}</span>
                      </p>
                      <p className="text-sm text-gray-300">
                        Driver: <span className="text-white">{booking.driverId || 'Pending assignment'}</span>
                      </p>
                      <p className="text-sm text-gray-300">
                        Price: <span className="text-white">{booking.priceDetails}</span>
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>

          </main>
        </div>
      </div>
    </div>

      {pendingClientConfirmId && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
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
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
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

