'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import AdminPageHeader from '@/components/AdminPageHeader';
import { attachGooglePlacesAutocomplete, loadGoogleMapsPlaces } from '@/lib/google-places-autocomplete';
import { buildJourneyLocationLines } from '@/lib/journey-locations';

type DriverDirectoryEntry = {
  id: string;
  name: string;
  phone: string;
  email: string;
  license: string;
  commission: number;
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
  dropOffs: string[];
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
  paymentMethod?: string;
  paymentFlow?: string;
  isDriverCollect?: boolean;
  driverCollectionStatus?: string;
  isPaid?: boolean;
  isRefundable?: boolean;
  canReleaseHold?: boolean;
  canCancelNoCharge?: boolean;
  paymentAction?: 'refund' | 'cancel_hold' | 'cancel_no_charge' | 'manual_cancel' | null;
  bookedBy: string;
  bookedByStaffId?: number | null;
  drivers: string[];
  vehicle?: string;
  serviceType?: string;
  vehicleTypeId?: number | null;
  clientEmail?: string;
  driverId?: string;
  driverName?: string;
  driverPrice?: number | null;
  driverCommissionApplied?: number | null;
  clientConfirmed?: boolean;
  rideStatus?: string;
  paymentStatus?: string;
  originalEstimate?: number | null;
  currentEstimate?: number | null;
  finalFare?: number | null;
  authorizedAmount?: number | null;
  capturedAmount?: number | null;
  primaryPaymentIntentId?: string;
  stripeCustomerId?: string;
  stripePaymentMethodId?: string;
  paymentFailureReason?: string;
};

type LiveBookingResponse = {
  id: number;
  code: string;
  pickup: string;
  dropOff: string;
  dropOffs?: string[];
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
  paymentMethod?: string;
  paymentFlow?: string;
  isDriverCollect?: boolean;
  driverCollectionStatus?: string;
  isPaid?: boolean;
  isRefundable?: boolean;
  canReleaseHold?: boolean;
  canCancelNoCharge?: boolean;
  paymentAction?: 'refund' | 'cancel_hold' | 'cancel_no_charge' | 'manual_cancel' | null;
  bookedBy: string;
  bookedByStaffId?: number | null;
  vehicle?: string;
  serviceType?: string;
  vehicleTypeId?: number | null;
  driverId?: string;
  driverName?: string;
  driverPrice?: number | null;
  driverCommissionApplied?: number | null;
  clientConfirmed?: boolean;
  rideStatus?: string;
  paymentStatus?: string;
  originalEstimate?: number | null;
  currentEstimate?: number | null;
  finalFare?: number | null;
  authorizedAmount?: number | null;
  capturedAmount?: number | null;
  primaryPaymentIntentId?: string;
  stripeCustomerId?: string;
  stripePaymentMethodId?: string;
  paymentFailureReason?: string;
};

type VehicleTier = 'executive' | 'luxury' | 'luxury_mpv' | null;

const FALLBACK_ACTIVE: LiveBooking[] = [
  {
    journeyId: 0,
    id: 'BK-1024',
    pickup: 'Heathrow T5 Arrivals',
    dropOff: 'The Langham, 1C Portland Pl, London W1B 1JA',
    passenger: 'Maria Popescu',
    phone: '+44 7700 900111',
    email: 'maria.popescu@example.com',
    dropOffs: ['The Langham, 1C Portland Pl, London W1B 1JA'],
    notes: 'Meet & greet, 1x large suitcase, flight BA0892, watch delays',
    time: '13:15',
    date: '2026-01-10',
    priceDetails: 'GBP 145.00 | Exec | includes parking',
    bookedBy: 'Velvet Concierge',
    drivers: []
  }
];

const FALLBACK_COMPLETED: LiveBooking[] = [];
const LIVE_BOOKINGS_REFRESH_EVENT = 'admin-live-bookings-refresh';
const HOLD_PAYMENT_STATUSES = new Set([
  'authorized',
  'authorization_updated',
  'additional_authorization_created',
  'partially_captured',
]);

const formatCurrencyValue = (value?: number | null) =>
  value === null || value === undefined || !Number.isFinite(value) ? '' : `GBP ${Number(value).toFixed(2)}`;

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

const parseBookingPriceAmount = (priceDetails: string) => {
  const numericMatch = String(priceDetails || '').match(/(\d+(?:\.\d+)?)/);
  if (!numericMatch) return null;
  const amount = Number(numericMatch[1]);
  if (!Number.isFinite(amount)) return null;
  return amount;
};

const formatDriverNetAmount = (priceDetails: string, commissionPercent: number) => {
  const originalAmount = parseBookingPriceAmount(priceDetails);
  if (originalAmount === null) return null;
  const normalizedCommission = Number.isFinite(commissionPercent)
    ? Math.min(100, Math.max(0, commissionPercent))
    : 0;
  const driverAmount = originalAmount * (1 - normalizedCommission / 100);
  return Number(driverAmount.toFixed(2));
};

const formatClientFareAmount = (priceDetails: string) => {
  const amount = parseBookingPriceAmount(priceDetails);
  return amount === null ? null : Number(amount.toFixed(2));
};

const getDriverCollectKind = (booking: Pick<LiveBooking, 'paymentFlow' | 'paymentMethod'>) => {
  const flow = String(booking.paymentFlow || '').toLowerCase();
  const method = String(booking.paymentMethod || '').toLowerCase();
  if (flow === 'cash_to_driver' || method.includes('cash')) return 'cash';
  if (flow === 'card_to_driver' || method.includes('card')) return 'card';
  return null;
};

const getPaymentDisplay = (booking: Pick<LiveBooking, 'paymentFlow' | 'paymentStatus' | 'paymentMethod'>) => {
  const flow = String(booking.paymentFlow || '').toLowerCase();
  const status = String(booking.paymentStatus || '').toLowerCase();
  if (status === 'paid_by_stripe_link') return 'Paid by Stripe link';
  if (status === 'payment_link_sent') return 'Payment link sent';
  if (status === 'not_collected') return 'Not collected';
  if (status === 'collected_by_driver') return 'Collected by driver';
  if (flow === 'cash_to_driver') return 'Driver to collect cash';
  if (flow === 'card_to_driver') return 'Driver to collect card';
  if (flow === 'fixed_pay_now') return 'Fixed Price - paid online';
  if (flow === 'flexible_after_journey') return 'Flexible Fare - card saved';
  if (HOLD_PAYMENT_STATUSES.has(status)) return 'Card on hold / pre-authorized';
  return booking.paymentStatus || booking.paymentMethod || 'Unknown';
};

const getPaymentBadgeClass = (booking: Pick<LiveBooking, 'paymentFlow' | 'paymentStatus'>) => {
  const status = String(booking.paymentStatus || '').toLowerCase();
  const flow = String(booking.paymentFlow || '').toLowerCase();
  if (status === 'paid_by_stripe_link' || status === 'collected_by_driver') {
    return 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200';
  }
  if (status === 'not_collected') return 'border-red-400/60 bg-red-500/15 text-red-200';
  if (status === 'payment_link_sent') return 'border-sky-400/50 bg-sky-500/15 text-sky-200';
  if (flow === 'cash_to_driver' || flow === 'card_to_driver' || status === 'driver_to_collect') {
    return 'border-orange-400/60 bg-orange-500/15 text-orange-200';
  }
  if (flow === 'flexible_after_journey' || HOLD_PAYMENT_STATUSES.has(status)) {
    return 'border-amber-400/50 bg-amber-500/15 text-amber-200';
  }
  return 'border-white/20 bg-white/10 text-gray-200';
};

const resolveWhatsappJobType = (vehicle?: string) => {
  const normalized = String(vehicle || '').toLowerCase();
  if (normalized.includes('luxury mpv')) return 'LUXURY MPV';
  if (normalized.includes('luxury')) return 'LUXURY';
  return 'EXECUTIVE';
};

const resolveWhatsappPriceType = (paymentMethod?: string) => {
  const normalized = String(paymentMethod || '').toLowerCase();
  if (normalized.includes('account')) return 'ACCOUNT';
  if (normalized.includes('cash') || normalized.includes('card')) return 'CASH/CARD';
  if (normalized.includes('pay') || normalized.includes('stripe') || normalized.includes('online')) {
    return 'PAYED';
  }
  return 'PAYED';
};

const buildBookingSummary = (booking: LiveBooking, commissionPercent = 0) => {
  const routeLines = buildJourneyLocationLines(booking.pickup, booking.dropOffs);
  const routeBlock = routeLines
    .map((line) => formatLocationWithLink(line.label, line.value))
    .join('\n\n');
  const jobType = resolveWhatsappJobType(booking.vehicle);
  const collectKind = getDriverCollectKind(booking);
  const priceType = collectKind ? '' : resolveWhatsappPriceType(booking.paymentMethod);
  const amount = collectKind
    ? formatClientFareAmount(booking.priceDetails)
    : formatDriverNetAmount(booking.priceDetails, commissionPercent);
  const priceLine =
    collectKind && amount !== null
      ? `Collect ${collectKind} £${amount.toFixed(2)}`
      : amount !== null
        ? `${priceType}  GBP ${amount.toFixed(2)}`
        : `${priceType}  ${booking.priceDetails}`;
  const notes = booking.notes?.trim() ? booking.notes.trim() : '-';

  return `JOB TYPE: ${jobType}\nTime: ${booking.time}\nDate: ${booking.date}\nPassenger: ${booking.passenger}\nPhone: ${booking.phone}\n\n${routeBlock}\nPrice: ${priceLine}\n\nNotes: ${notes}`;
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

const getDriverDisplayCarLabel = (driver?: DriverDirectoryEntry) => {
  if (!driver) return '';
  const activeCar = driver.cars.find((car) => String(car.status || '').toLowerCase() === 'active');
  const fallbackCar = !activeCar ? driver.cars[0] : null;
  const selectedCar = activeCar || fallbackCar;
  return selectedCar ? formatCarLabel(selectedCar) : '';
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
  return null;
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

const formatDriverCommission = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
};

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

const canEditJourneyTime = (iso?: string | null) => {
  if (!iso) return true;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return true;
  return parsed.getTime() - Date.now() >= 2 * 60 * 60 * 1000;
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
  const [confirmDriverBusy, setConfirmDriverBusy] = useState(false);
  const [allocationWarning, setAllocationWarning] = useState<string | null>(null);
  const [allocationSuccess, setAllocationSuccess] = useState<string | null>(null);
  const [pendingCancelAllocation, setPendingCancelAllocation] = useState<LiveBooking | null>(null);
  const [pendingClientConfirmId, setPendingClientConfirmId] = useState<string | null>(null);
  const [commissionInputs, setCommissionInputs] = useState<Record<string, string>>({});
  const [selectedCarByDriverKey, setSelectedCarByDriverKey] = useState<Record<string, number>>({});
  const [availableDrivers, setAvailableDrivers] = useState<DriverDirectoryEntry[]>([]);
  // Manual booking modal removed; navigate to booking page instead.
  const [staffOptions, setStaffOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [bookedBySelection, setBookedBySelection] = useState<Record<string, string>>({});
  const [bookedBySaving, setBookedBySaving] = useState<Record<string, boolean>>({});
  const [vehicleLabelById, setVehicleLabelById] = useState<Record<number, string>>({});
  const [cancelAllocationBusy, setCancelAllocationBusy] = useState<Record<string, boolean>>({});
  const [completeAllocationBusy, setCompleteAllocationBusy] = useState<Record<string, boolean>>({});
  const [collectionActionBusy, setCollectionActionBusy] = useState<Record<string, boolean>>({});
  const [pendingCompleteBooking, setPendingCompleteBooking] = useState<LiveBooking | null>(null);
  const [completeFinalFare, setCompleteFinalFare] = useState('');
  const [refundBusy, setRefundBusy] = useState<Record<string, boolean>>({});
  const [pendingRefundBooking, setPendingRefundBooking] = useState<LiveBooking | null>(null);
  const [pendingEditBooking, setPendingEditBooking] = useState<LiveBooking | null>(null);
  const [editPickup, setEditPickup] = useState('');
  const [editDropOffs, setEditDropOffs] = useState<string[]>(['']);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editReason, setEditReason] = useState('admin_route_update');
  const [editNote, setEditNote] = useState('');
  const [editManualFare, setEditManualFare] = useState('');
  const [editBookingBusy, setEditBookingBusy] = useState(false);
  const [editPreviewFare, setEditPreviewFare] = useState<number | null>(null);
  const [editPreviewDifference, setEditPreviewDifference] = useState<number | null>(null);
  const [editPreviewLoading, setEditPreviewLoading] = useState(false);
  const [editPreviewError, setEditPreviewError] = useState<string | null>(null);
  const editPickupInputRef = useRef<HTMLInputElement | null>(null);
  const editDropOffInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const editInitialValuesRef = useRef<{
    rideId: number;
    pickup: string;
    dropOffs: string[];
    date: string;
    time: string;
  } | null>(null);
  const editTimeLocked = pendingEditBooking ? !canEditJourneyTime(pendingEditBooking.journeyDate) : false;
  const editBookingCurrentFare = pendingEditBooking
    ? pendingEditBooking.currentEstimate ?? parseBookingPriceAmount(pendingEditBooking.priceDetails)
    : null;
  const editBookingTitle = pendingEditBooking
    ? pendingEditBooking.driverId
      ? 'Edit allocated ride'
      : 'Edit ride'
    : '';
  const pendingCompleteFlow = String(pendingCompleteBooking?.paymentFlow || '').toLowerCase();
  const pendingCompleteIsFlexible = pendingCompleteFlow === 'flexible_after_journey';

  const applyLiveBookingsResponse = useCallback((data: { bookings?: LiveBookingResponse[] }) => {
    const bookings: LiveBooking[] = (data.bookings || []).map((item: LiveBookingResponse) => ({
      journeyId: item.id,
      id: item.code,
      pickup: item.pickup,
      dropOff: item.dropOff,
      dropOffs: Array.isArray(item.dropOffs) && item.dropOffs.length ? item.dropOffs : [item.dropOff],
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
      paymentMethod: item.paymentMethod || '',
      paymentFlow: item.paymentFlow || '',
      isDriverCollect: Boolean(item.isDriverCollect),
      driverCollectionStatus: item.driverCollectionStatus || '',
      isPaid: Boolean(item.isPaid),
      isRefundable: Boolean(item.isRefundable),
      canReleaseHold: Boolean(item.canReleaseHold),
      canCancelNoCharge: Boolean(item.canCancelNoCharge),
      paymentAction: item.paymentAction || null,
      bookedBy: item.bookedBy,
      bookedByStaffId: item.bookedByStaffId ?? null,
      vehicle: item.vehicle || 'Unknown',
      serviceType: item.serviceType || 'Transfer',
      vehicleTypeId: item.vehicleTypeId ?? null,
      clientEmail: item.clientEmail || '',
      driverId: item.driverId || '',
      driverName: item.driverName || '',
      driverPrice:
        item.driverPrice !== null && item.driverPrice !== undefined
          ? Number(item.driverPrice)
          : null,
      driverCommissionApplied:
        item.driverCommissionApplied !== null && item.driverCommissionApplied !== undefined
          ? Number(item.driverCommissionApplied)
          : null,
      clientConfirmed: Boolean(item.clientConfirmed),
      rideStatus: item.rideStatus || '',
      paymentStatus: item.paymentStatus || '',
      originalEstimate:
        item.originalEstimate !== null && item.originalEstimate !== undefined ? Number(item.originalEstimate) : null,
      currentEstimate:
        item.currentEstimate !== null && item.currentEstimate !== undefined ? Number(item.currentEstimate) : null,
      finalFare: item.finalFare !== null && item.finalFare !== undefined ? Number(item.finalFare) : null,
      authorizedAmount:
        item.authorizedAmount !== null && item.authorizedAmount !== undefined ? Number(item.authorizedAmount) : null,
      capturedAmount:
        item.capturedAmount !== null && item.capturedAmount !== undefined ? Number(item.capturedAmount) : null,
      primaryPaymentIntentId: item.primaryPaymentIntentId || '',
      stripeCustomerId: item.stripeCustomerId || '',
      stripePaymentMethodId: item.stripePaymentMethodId || '',
      paymentFailureReason: item.paymentFailureReason || '',
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
  }, []);

  const fetchLiveBookings = useCallback(
    async (options?: { withLoading?: boolean; useFallbackOnError?: boolean }) => {
      const withLoading = Boolean(options?.withLoading);
      const useFallbackOnError = Boolean(options?.useFallbackOnError);
      if (withLoading) setLiveLoading(true);
      try {
        const res = await fetch('/api/admin/live-bookings', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load live bookings');
        const data = await res.json();
        applyLiveBookingsResponse(data);
      } catch (err) {
        console.error(err);
        if (useFallbackOnError) {
          const confirmMap: Record<string, boolean> = {};
          setLiveBookings([...FALLBACK_ACTIVE, ...FALLBACK_COMPLETED]);
          const defaults: Record<string, string> = {};
          [...FALLBACK_ACTIVE, ...FALLBACK_COMPLETED].forEach((b) => {
            defaults[b.id] = '';
          });
          setBookedBySelection(defaults);
          setClientConfirmed(confirmMap);
          setLiveError(null);
        }
      } finally {
        if (withLoading) setLiveLoading(false);
      }
    },
    [applyLiveBookingsResponse]
  );

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
            commission: Number(driver.commission ?? 20),
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
    fetchLiveBookings({ withLoading: true, useFallbackOnError: true });
  }, [fetchLiveBookings]);

  useEffect(() => {
    const refreshOnDemand = () => {
      fetchLiveBookings({ withLoading: false, useFallbackOnError: false });
    };
    window.addEventListener(LIVE_BOOKINGS_REFRESH_EVENT, refreshOnDemand);
    return () => {
      window.removeEventListener(LIVE_BOOKINGS_REFRESH_EVENT, refreshOnDemand);
    };
  }, [fetchLiveBookings]);

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

  useEffect(() => {
    if (!pendingEditBooking) return;
    let cleanupFns: Array<() => void> = [];
    let cancelled = false;

    loadGoogleMapsPlaces()
      .then(() => {
        if (cancelled) return;
        if (editPickupInputRef.current) {
          cleanupFns.push(
            attachGooglePlacesAutocomplete(editPickupInputRef.current, (value) => {
              setEditPickup(value);
            })
          );
        }
        editDropOffInputRefs.current.forEach((input, index) => {
          if (!input) return;
          cleanupFns.push(
            attachGooglePlacesAutocomplete(input, (value) => {
              setEditDropOffs((prev) => prev.map((stop, stopIndex) => (stopIndex === index ? value : stop)));
            })
          );
        });
      })
      .catch((err) => console.error('Failed to load Google Maps Places', err));

    return () => {
      cancelled = true;
      cleanupFns.forEach((fn) => fn());
      cleanupFns = [];
    };
  }, [pendingEditBooking, editDropOffs.length]);

  useEffect(() => {
    if (!pendingEditBooking?.journeyId) return;

    const pickup = editPickup.trim();
    const dropOffs = editDropOffs.map((stop) => stop.trim()).filter(Boolean);
    if (!pickup || !dropOffs.length || !editDate || !editTime) {
      setEditPreviewFare(null);
      setEditPreviewDifference(null);
      setEditPreviewError(null);
      setEditPreviewLoading(false);
      return;
    }

    const initialValues = editInitialValuesRef.current;
    const valuesAreUnchanged =
      initialValues?.rideId === pendingEditBooking.journeyId &&
      pickup === initialValues.pickup &&
      editDate === initialValues.date &&
      editTime === initialValues.time &&
      dropOffs.length === initialValues.dropOffs.length &&
      dropOffs.every((stop, index) => stop === initialValues.dropOffs[index]);

    if (valuesAreUnchanged) {
      setEditPreviewFare(pendingEditBooking.currentEstimate ?? parseBookingPriceAmount(pendingEditBooking.priceDetails));
      setEditPreviewDifference(null);
      setEditPreviewError(null);
      setEditPreviewLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setEditPreviewLoading(true);
      setEditPreviewError(null);
      try {
        const res = await fetch('/api/admin/rides/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            rideId: pendingEditBooking.journeyId,
            pickup,
            dropOffs,
            serviceType: pendingEditBooking.serviceType || 'Transfer',
            vehicleTypeId: pendingEditBooking.vehicleTypeId ?? null,
            journeyDate: new Date(`${editDate}T${editTime}`).toISOString(),
            journeyTime: editTime,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || 'Failed to preview ride');
        }
        setEditPreviewFare(Number(data?.newFare ?? 0));
        setEditPreviewDifference(Number(data?.difference ?? 0));
      } catch (err: any) {
        if (controller.signal.aborted) return;
        setEditPreviewFare(null);
        setEditPreviewDifference(null);
        setEditPreviewError(err?.message || 'Failed to preview ride');
      } finally {
        if (!controller.signal.aborted) {
          setEditPreviewLoading(false);
        }
      }
    }, 450);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [pendingEditBooking, editPickup, editDropOffs, editDate, editTime]);

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
    const live: LiveBooking[] = [];
    const allocated: LiveBooking[] = [];

    for (const booking of liveBookings) {
      const allocatedToDriver = Boolean(booking.driverId);
      if (allocatedToDriver) {
        allocated.push(booking);
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

    return { live, allocated };
  }, [liveBookings]);

  const activeBookings = partitionedBookings.live;
  const allocatedBookings = partitionedBookings.allocated;

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

  const handleConfirmDriver = async () => {
    if (!pendingDriverConfirmKey || confirmDriverBusy) return;
    const driverKey = pendingDriverConfirmKey;
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
    setConfirmDriverBusy(true);
    try {
      const res = await fetch('/api/admin/allocate-driver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          journeyId: booking.journeyId,
          driverId,
          commission: getCommissionValueForDriverKey(driverKey),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to allocate driver');
      }
      if (data?.warning) {
        setAllocationWarning(String(data.warning));
      } else {
        setAllocationSuccess('Booking allocation updated successfully. Client and driver notifications were processed.');
      }
      setLiveBookings((prev) =>
        prev.map((entry) =>
          entry.id === booking.id
            ? {
                ...entry,
                driverId,
                driverPrice:
                  data?.driverPrice !== undefined && data?.driverPrice !== null
                    ? Number(data.driverPrice)
                    : entry.driverPrice ?? null,
                driverCommissionApplied:
                  data?.commissionApplied !== undefined && data?.commissionApplied !== null
                    ? Number(data.commissionApplied)
                    : entry.driverCommissionApplied ?? null,
                updatedAt: new Date().toISOString(),
              }
            : entry
        )
      );
    } catch (err) {
      console.error('Failed to allocate driver', err);
    } finally {
      setConfirmDriverBusy(false);
      setPendingDriverConfirmKey(null);
    }
  };

  const handleCancelDriver = () => {
    if (confirmDriverBusy) return;
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

  const getDefaultCommissionByDriverKey = (driverKey: string) => {
    const lastDash = driverKey.lastIndexOf('-');
    if (lastDash <= 0) return 20;
    const driverId = driverKey.slice(lastDash + 1);
    const driver = availableDrivers.find((entry) => entry.id === driverId);
    const value = Number(driver?.commission ?? 20);
    return Number.isFinite(value) ? value : 20;
  };

  const getCommissionValueForDriverKey = (driverKey: string) => {
    const rawInput = commissionInputs[driverKey];
    if (rawInput === undefined) return getDefaultCommissionByDriverKey(driverKey);
    const parsed = Number(rawInput);
    return Number.isFinite(parsed) ? parsed : getDefaultCommissionByDriverKey(driverKey);
  };

  const getDriverNameById = (driverId?: string, driverName?: string) => {
    if (!driverId && driverName) return driverName;
    if (!driverId) return 'Pending assignment';
    const driver = availableDrivers.find((entry) => entry.id === driverId);
    return driver?.name || driverName || driverId;
  };

  const getDriverById = (driverId?: string) => {
    if (!driverId) return null;
    return availableDrivers.find((entry) => entry.id === driverId) || null;
  };

  const handlePasteInfo = (
    driverKey: string,
    booking: LiveBooking,
    selectedCarLabel?: string
  ) => {
    const commissionValue = getCommissionValueForDriverKey(driverKey);
    const baseMessage = buildBookingSummary(booking, commissionValue);
    setDriverMessages((prev) => ({
      ...prev,
      [driverKey]: appendSelectedCarInstruction(baseMessage, selectedCarLabel),
    }));
  };

  const openWhatsAppChat = (driverKey: string, text: string) => {
    if (!text.trim()) {
      setAllocationWarning('WhatsApp message is empty.');
      return false;
    }
    const driverId = driverKey.split('-').at(-1);
    if (!driverId) {
      setAllocationWarning('Unable to resolve driver for WhatsApp message.');
      return false;
    }
    const driver = availableDrivers.find((entry) => entry.id === driverId);
    if (!driver) {
      setAllocationWarning('Driver not found for WhatsApp message.');
      return false;
    }
    const digits = formatPhoneForWhatsApp(driver.phone);
    if (!digits) {
      setAllocationWarning(`Driver ${driver.name} has no valid phone number.`);
      return false;
    }
    const encodedText = encodeURIComponent(text);
    const webUrl = `https://wa.me/${digits}?text=${encodedText}`;
    const nativeUrl = `whatsapp://send?phone=${digits}&text=${encodedText}`;
    if (typeof window !== 'undefined') {
      const popup = window.open(webUrl, '_blank', 'noopener,noreferrer');
      if (!popup) {
        window.location.href = nativeUrl;
      }
    }
    return true;
  };

  const handleSend = (driverKey: string, fallbackMessage?: string, selectedCarLabel?: string) => {
    const draft = (driverMessages[driverKey] ?? '').trim();
    const baseMessage = draft || fallbackMessage?.trim() || '';
    const message = appendSelectedCarInstruction(baseMessage, selectedCarLabel);
    if (!message) {
      setAllocationWarning('Nothing to send on WhatsApp.');
      return;
    }
    const sent = openWhatsAppChat(driverKey, message);
    if (sent) {
      setAllocationSuccess('WhatsApp chat opened with prepared message.');
      setDriverMessages((prev) => ({ ...prev, [driverKey]: '' }));
    }
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
    setCancelAllocationBusy((prev) => ({ ...prev, [booking.id]: true }));
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
            ? {
                ...entry,
                driverId: '',
                driverPrice: null,
                driverCommissionApplied: null,
                updatedAt: new Date().toISOString(),
              }
            : entry
        )
      );
    } catch (err) {
      console.error('Failed to unassign driver', err);
    } finally {
      setCancelAllocationBusy((prev) => ({ ...prev, [booking.id]: false }));
    }
  };

  const requestCancelAllocation = (booking: LiveBooking) => {
    setPendingCancelAllocation(booking);
  };

  const requestCompleteAllocation = (booking: LiveBooking) => {
    if (!booking.journeyId) return;
    const defaultFinalFare = booking.currentEstimate ?? parseBookingPriceAmount(booking.priceDetails) ?? 0;
    setPendingCompleteBooking(booking);
    setCompleteFinalFare(defaultFinalFare.toFixed(2));
  };

  const closeCompleteModal = () => {
    setPendingCompleteBooking(null);
    setCompleteFinalFare('');
  };

  const confirmCompleteAllocation = async () => {
    const booking = pendingCompleteBooking;
    if (!booking?.journeyId) return;
    const finalFare = Number(completeFinalFare);
    if (!Number.isFinite(finalFare) || finalFare < 0) {
      setAllocationWarning('Enter a valid final fare.');
      return;
    }

    setCompleteAllocationBusy((prev) => ({ ...prev, [booking.id]: true }));
    try {
      const res = await fetch('/api/admin/complete-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journeyId: booking.journeyId, finalFare }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to mark booking as completed');
      }

      setLiveBookings((prev) => prev.filter((entry) => entry.id !== booking.id));
      closeCompleteModal();
      if (data?.warning) {
        setAllocationWarning(String(data.warning));
        setAllocationSuccess('Job marked as completed.');
      } else if (data?.payment?.strategy === 'flexible_final_charge_succeeded') {
        setAllocationSuccess('Flexible fare charged and job marked as completed.');
      } else if (data?.payment?.strategy === 'captured') {
        setAllocationSuccess('Card hold captured and job marked as completed.');
      } else {
        setAllocationSuccess('Job marked as completed and statement generated.');
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(LIVE_BOOKINGS_REFRESH_EVENT));
      }
    } catch (err: any) {
      setAllocationWarning(err?.message || 'Failed to mark job as completed.');
    } finally {
      setCompleteAllocationBusy((prev) => ({ ...prev, [booking.id]: false }));
    }
  };

  const updateDriverCollection = async (
    booking: LiveBooking,
    action: 'collected' | 'not_collected' | 'send_payment_link'
  ) => {
    if (!booking.journeyId) return;
    const key = `${booking.id}:${action}`;
    setCollectionActionBusy((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await fetch('/api/admin/driver-collection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journeyId: booking.journeyId, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to update driver collection status');
      }
      const paymentStatus = String(data?.paymentStatus || '').trim();
      setLiveBookings((prev) =>
        prev.map((entry) =>
          entry.id === booking.id
            ? {
                ...entry,
                paymentStatus: paymentStatus || entry.paymentStatus,
                driverCollectionStatus: paymentStatus || entry.driverCollectionStatus,
                isDriverCollect: true,
                rideStatus: paymentStatus || entry.rideStatus,
                updatedAt: new Date().toISOString(),
              }
            : entry
        )
      );
      if (action === 'send_payment_link') {
        setAllocationSuccess(data?.emailSent ? 'Stripe payment link sent to client.' : 'Stripe payment link created.');
      } else {
        setAllocationSuccess(action === 'collected' ? 'Marked collected by driver.' : 'Marked not collected.');
      }
    } catch (err: any) {
      setAllocationWarning(err?.message || 'Failed to update driver collection status.');
    } finally {
      setCollectionActionBusy((prev) => ({ ...prev, [key]: false }));
    }
  };

  const requestRefund = (booking: LiveBooking) => {
    setPendingRefundBooking(booking);
  };

  const closeRefundModal = () => {
    setPendingRefundBooking(null);
  };

  const openEditBookingModal = (booking: LiveBooking) => {
    if (String(booking.paymentFlow || '').toLowerCase() === 'fixed_pay_now') {
      setAllocationWarning('Fixed Price bookings cannot have fare-changing edits after booking.');
      return;
    }
    const dt = toDateTimeInputs(booking.journeyDate);
    setPendingEditBooking(booking);
    setEditPickup(booking.pickup || '');
    setEditDropOffs(
      Array.isArray(booking.dropOffs) && booking.dropOffs.length ? booking.dropOffs : [booking.dropOff || '']
    );
    setEditDate(dt.date);
    setEditTime(dt.time);
    setEditReason('admin_route_update');
    setEditNote('');
    setEditManualFare('');
    setEditPreviewFare(booking.currentEstimate ?? parseBookingPriceAmount(booking.priceDetails));
    setEditPreviewDifference(null);
    setEditPreviewError(null);
    setEditPreviewLoading(false);
    editInitialValuesRef.current = {
      rideId: booking.journeyId,
      pickup: String(booking.pickup || '').trim(),
      dropOffs: (Array.isArray(booking.dropOffs) && booking.dropOffs.length ? booking.dropOffs : [booking.dropOff || ''])
        .map((stop) => String(stop || '').trim())
        .filter(Boolean),
      date: dt.date,
      time: dt.time,
    };
  };

  const closeEditBookingModal = () => {
    setPendingEditBooking(null);
    setEditPickup('');
    setEditDropOffs(['']);
    setEditDate('');
    setEditTime('');
    setEditReason('admin_route_update');
    setEditNote('');
    setEditManualFare('');
    setEditPreviewFare(null);
    setEditPreviewDifference(null);
    setEditPreviewError(null);
    setEditPreviewLoading(false);
    editInitialValuesRef.current = null;
  };

  const updateEditDropOff = (index: number, value: string) => {
    setEditDropOffs((prev) => prev.map((stop, stopIndex) => (stopIndex === index ? value : stop)));
  };

  const addEditDropOff = () => {
    setEditDropOffs((prev) => [...prev, '']);
  };

  const removeEditDropOff = (index: number) => {
    setEditDropOffs((prev) => {
      if (prev.length === 1) return [''];
      return prev.filter((_, stopIndex) => stopIndex !== index);
    });
  };

  const submitEditBooking = async () => {
    if (!pendingEditBooking?.journeyId) return;
    const pickup = editPickup.trim();
    const dropOffs = editDropOffs.map((stop) => stop.trim()).filter(Boolean);
    if (!pickup || dropOffs.length === 0 || !editDate || !editTime) {
      setAllocationWarning('Pickup, date, time, and at least one destination are required.');
      return;
    }
    const nextJourneyDate = new Date(`${editDate}T${editTime}`);
    if (Number.isNaN(nextJourneyDate.getTime())) {
      setAllocationWarning('Invalid journey date or time.');
      return;
    }
    const manualFareValue = editManualFare.trim() ? Number(editManualFare) : null;
    if (manualFareValue !== null && (!Number.isFinite(manualFareValue) || manualFareValue < 0)) {
      setAllocationWarning('Manual fare must be a valid positive amount.');
      return;
    }
    if (editPreviewError && manualFareValue === null) {
      setAllocationWarning('Preview failed. Enter a manual fare before saving this edit.');
      return;
    }
    if (!editPreviewError && editPreviewFare === null && manualFareValue === null) {
      setAllocationWarning('Wait for the fare preview or enter a manual fare before saving.');
      return;
    }

    setEditBookingBusy(true);
    try {
      const res = await fetch('/api/admin/rides/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rideId: pendingEditBooking.journeyId,
          pickup,
          dropOffs,
          reason: editReason.trim() || 'admin_route_update',
          note: editNote.trim() || null,
          vehicleTypeId: pendingEditBooking.vehicleTypeId ?? null,
          serviceType: pendingEditBooking.serviceType || 'Transfer',
          journeyDate: nextJourneyDate.toISOString(),
          manualFare: manualFareValue,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to update ride');
      }

      const paymentMessage =
        data?.payment?.strategy === 'covered_by_existing_authorization'
          ? 'Card hold already covers the updated estimate.'
          : data?.payment?.strategy === 'additional_authorization_off_session'
            ? 'Fare updated and Stripe created an additional authorization hold for the difference.'
            : data?.payment?.strategy === 'additional_authorization_on_session'
              ? 'Fare updated, but an extra authorization now needs customer confirmation.'
              : data?.payment?.strategy === 'manual_payment_fare_updated'
                ? 'Fare updated for this manual payment booking. No Stripe action was required.'
              : 'Fare updated successfully.';

      setAllocationSuccess(paymentMessage);
      closeEditBookingModal();
      await fetchLiveBookings({ withLoading: false, useFallbackOnError: false });
      window.dispatchEvent(new Event(LIVE_BOOKINGS_REFRESH_EVENT));
    } catch (err: any) {
      console.error(err);
      setAllocationWarning(err?.message || 'Failed to update ride');
    } finally {
      setEditBookingBusy(false);
    }
  };

  const confirmRefund = async () => {
    if (!pendingRefundBooking?.journeyId) return;
    const booking = pendingRefundBooking;
    setRefundBusy((prev) => ({ ...prev, [booking.id]: true }));
    try {
      const res = await fetch('/api/admin/refund-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journeyId: booking.journeyId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to refund booking');
      }
      setLiveBookings((prev) => prev.filter((entry) => entry.id !== booking.id));
      setAllocationSuccess(
        data?.warning
          ? `Cancellation completed. ${data.warning}`
          : 'Cancellation completed and job removed from queue.'
      );
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(LIVE_BOOKINGS_REFRESH_EVENT));
      }
      setPendingRefundBooking(null);
    } catch (err: any) {
      setAllocationWarning(err?.message || 'Failed to process refund.');
    } finally {
      setRefundBusy((prev) => ({ ...prev, [booking.id]: false }));
    }
  };

  const confirmCancelAllocation = async () => {
    if (!pendingCancelAllocation) return;
    await handleCancelAllocation(pendingCancelAllocation);
    setPendingCancelAllocation(null);
  };

  const closeCancelAllocationModal = () => {
    setPendingCancelAllocation(null);
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
                    const selectedStaffId =
                      bookedBySelection[booking.id] ??
                      (booking.bookedByStaffId ? String(booking.bookedByStaffId) : '');
                    const hasSelectedStaff = Boolean(String(selectedStaffId).trim());
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
                            <p className="text-sm tracking-wide text-white flex items-center gap-3 flex-wrap">
                              <span className="inline-flex h-6 items-center font-semibold">{booking.id}</span>
                              {booking.paymentAction ? (
                                <button
                                  type="button"
                                  onClick={() => requestRefund(booking)}
                                  disabled={refundBusy[booking.id]}
                                  className="rounded-full border border-red-400 bg-red-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {refundBusy[booking.id]
                                    ? booking.paymentAction === 'cancel_hold' || booking.paymentAction === 'cancel_no_charge' || booking.paymentAction === 'manual_cancel'
                                      ? 'Cancelling...'
                                      : 'Refunding...'
                                    : 'Cancel Job'}
                                </button>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => openEditBookingModal(booking)}
                                disabled={String(booking.paymentFlow || '').toLowerCase() === 'fixed_pay_now'}
                                className="rounded-full border border-amber-400 bg-amber-400 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.25em] text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                                title={
                                  String(booking.paymentFlow || '').toLowerCase() === 'fixed_pay_now'
                                    ? 'Fixed Price bookings cannot have fare-changing edits.'
                                    : undefined
                                }
                              >
                                Edit
                              </button>
                              {bookingCreatedAt ? (
                                <span className="inline-flex h-6 items-center rounded-full border border-white/25 px-3.5 text-xs font-normal text-gray-300">
                                  {bookingCreatedAt}
                                </span>
                              ) : null}
                              <span className={`inline-flex h-6 items-center rounded-full border px-3.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${getPaymentBadgeClass(booking)}`}>
                                {getPaymentDisplay(booking)}
                              </span>
                            </p>
                            {buildJourneyLocationLines(booking.pickup, booking.dropOffs).map((line) => (
                              <p key={`${booking.id}-${line.label}-${line.value}`} className="text-sm text-gray-300">
                                {line.label}: <span className="font-semibold text-white">{line.value}</span>
                              </p>
                            ))}
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
                              Payment: <span className="font-semibold text-white">{getPaymentDisplay(booking)}</span>
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
                                !confirmed && !hasSelectedStaff
                                  ? null
                                  : confirmed
                                  ? updateClientConfirmation(booking.id, false)
                                  : requestClientConfirmation(booking)
                              }
                              disabled={!confirmed && !hasSelectedStaff}
                              className={`flex items-center gap-2 text-sm font-semibold transition ${
                                confirmed ? 'text-green-400' : 'text-gray-300'
                              } ${
                                !confirmed && !hasSelectedStaff ? 'cursor-not-allowed opacity-50' : ''
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
                                      const commissionValue =
                                        commissionInputs[driverKey] ??
                                        String(getDefaultCommissionByDriverKey(driverKey));
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
                                                {driver.eligibleCars.map((car) => {
                                                  const optionId = `${driverKey}-car-${car.id}`;
                                                  const checked = selectedCarByDriverKey[driverKey] === car.id;
                                                  return (
                                                    <label
                                                      key={optionId}
                                                      htmlFor={optionId}
                                                      className="flex items-start gap-2 text-[11px] text-gray-300"
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
                                                        <div className="flex items-center gap-1 text-gray-500">
                                                          {String(car.status).toLowerCase() === 'active' ? (
                                                            <span className="rounded-full bg-green-500/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-200">
                                                              {car.status}
                                                            </span>
                                                          ) : (
                                                            <span className="rounded-full bg-red-500/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-200">
                                                              {car.status}
                                                            </span>
                                                          )}
                                                          <span className="font-bold">{car.vehicleTypeLabel}</span>
                                                        </div>
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
                                                      buildBookingSummary(
                                                        booking,
                                                        getCommissionValueForDriverKey(driverKey)
                                                      ),
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
                <h3 className="text-base font-semibold text-white">Allocated</h3>
                <span className="text-xs text-gray-400">{allocatedBookings.length} item(s)</span>
              </div>
              {allocatedBookings.length === 0 ? (
                <p className="text-sm text-gray-400">No allocated jobs.</p>
              ) : (
                <div className="space-y-3">
                  {allocatedBookings.map((booking) => (
                    <article
                      key={`allocated-${booking.id}`}
                      className={`rounded-xl border p-4 ${
                        String(booking.paymentStatus || '').toLowerCase() === 'not_collected'
                          ? 'border-red-400/40 bg-red-950/20'
                          : booking.isDriverCollect
                            ? 'border-orange-400/35 bg-orange-950/15'
                            : 'border-emerald-400/20 bg-black/40'
                      }`}
                    >
                      {(() => {
                        const driverInfo = getDriverById(booking.driverId);
                        const driverCarLabel = getDriverDisplayCarLabel(driverInfo || undefined);
                        return (
                          <div className="flex flex-col gap-5 lg:flex-row">
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center justify-start gap-2">
                                <div>
                                  <p className="text-sm font-semibold text-white">{booking.id}</p>
                                  <p className="text-xs text-gray-400">
                                    {booking.date} {booking.time}
                                  </p>
                                </div>
                                {booking.paymentAction ? (
                                  <button
                                    type="button"
                                    onClick={() => requestRefund(booking)}
                                    disabled={refundBusy[booking.id]}
                                    className="rounded-full border border-red-400 bg-red-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {refundBusy[booking.id]
                                      ? booking.paymentAction === 'cancel_hold' || booking.paymentAction === 'cancel_no_charge' || booking.paymentAction === 'manual_cancel'
                                        ? 'Releasing...'
                                        : 'Refunding...'
                                      : booking.paymentAction === 'cancel_hold' || booking.paymentAction === 'cancel_no_charge' || booking.paymentAction === 'manual_cancel'
                                        ? 'Cancel Job'
                                    : 'Refund'}
                                  </button>
                                ) : null}
                                <span className={`inline-flex h-6 items-center rounded-full border px-3.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${getPaymentBadgeClass(booking)}`}>
                                  {getPaymentDisplay(booking)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => openEditBookingModal(booking)}
                                  disabled={String(booking.paymentFlow || '').toLowerCase() === 'fixed_pay_now'}
                                  className="rounded-full border border-amber-400 bg-amber-400 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                                  title={
                                    String(booking.paymentFlow || '').toLowerCase() === 'fixed_pay_now'
                                      ? 'Fixed Price bookings cannot have fare-changing edits.'
                                      : undefined
                                  }
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => requestCancelAllocation(booking)}
                                  disabled={cancelAllocationBusy[booking.id]}
                                  className="rounded-full border border-red-400 bg-red-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Detached Driver
                                </button>
                                <button
                                  type="button"
                                  onClick={() => requestCompleteAllocation(booking)}
                                  disabled={completeAllocationBusy[booking.id]}
                                  className="rounded-full border border-emerald-400 bg-emerald-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {completeAllocationBusy[booking.id] ? 'Completing...' : 'Job Completed'}
                                </button>
                                {booking.isDriverCollect ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => updateDriverCollection(booking, 'collected')}
                                      disabled={collectionActionBusy[`${booking.id}:collected`]}
                                      className="rounded-full border border-emerald-300/70 bg-emerald-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-100 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {collectionActionBusy[`${booking.id}:collected`] ? 'Saving...' : 'Mark collected by driver'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => updateDriverCollection(booking, 'not_collected')}
                                      disabled={collectionActionBusy[`${booking.id}:not_collected`]}
                                      className="rounded-full border border-red-300/70 bg-red-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {collectionActionBusy[`${booking.id}:not_collected`] ? 'Saving...' : 'Not collected'}
                                    </button>
                                    {String(booking.paymentStatus || '').toLowerCase() === 'not_collected' ? (
                                      <button
                                        type="button"
                                        onClick={() => updateDriverCollection(booking, 'send_payment_link')}
                                        disabled={collectionActionBusy[`${booking.id}:send_payment_link`]}
                                        className="rounded-full border border-sky-300/70 bg-sky-500/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-100 transition hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        {collectionActionBusy[`${booking.id}:send_payment_link`] ? 'Sending...' : 'Send Stripe payment link'}
                                      </button>
                                    ) : null}
                                  </>
                                ) : null}
                              </div>
                              {buildJourneyLocationLines(booking.pickup, booking.dropOffs).map((line, index) => (
                                <p
                                  key={`allocated-${booking.id}-${line.label}-${line.value}`}
                                  className={`${index === 0 ? 'mt-2 ' : ''}text-sm text-gray-300`}
                                >
                                  {line.label}: <span className="text-white">{line.value}</span>
                                </p>
                              ))}
                              <p className="text-sm text-gray-300">
                                Passenger: <span className="text-white">{booking.passenger}</span>
                              </p>
                              <p className="text-sm text-gray-300">
                                Driver: <span className="text-emerald-300">{getDriverNameById(booking.driverId, booking.driverName)}</span>
                              </p>
                              <p className="text-sm text-gray-300">
                                Price: <span className="text-white">{booking.priceDetails}</span>
                              </p>
                              {booking.currentEstimate !== null && booking.currentEstimate !== undefined ? (
                                <p className="text-sm text-gray-300">
                                  Current Estimate: <span className="text-white">{formatCurrencyValue(booking.currentEstimate)}</span>
                                </p>
                              ) : null}
                              {booking.authorizedAmount !== null && booking.authorizedAmount !== undefined && booking.authorizedAmount > 0 ? (
                                <p className="text-sm text-gray-300">
                                  Authorized Hold:{' '}
                                  <span className="text-amber-300">{formatCurrencyValue(booking.authorizedAmount)}</span>
                                </p>
                              ) : null}
                              <p className="text-sm text-gray-300">
                                Payment:{' '}
                                <span className={HOLD_PAYMENT_STATUSES.has(String(booking.paymentStatus || '').toLowerCase()) ? 'text-amber-300' : 'text-white'}>
                                  {getPaymentDisplay(booking)}
                                </span>
                              </p>
                              {booking.paymentFailureReason ? (
                                <p className="text-sm text-red-300">
                                  Payment issue: <span className="text-red-200">{booking.paymentFailureReason}</span>
                                </p>
                              ) : null}
                              {booking.driverPrice !== null && booking.driverPrice !== undefined ? (
                                <p className="text-sm text-gray-300">
                                  Driver Price:{' '}
                                  <span className="text-emerald-300">
                                    GBP {Number(booking.driverPrice).toFixed(2)}
                                    {booking.driverCommissionApplied !== null &&
                                    booking.driverCommissionApplied !== undefined
                                      ? ` (${formatDriverCommission(booking.driverCommissionApplied)}%)`
                                      : ''}
                                  </span>
                                </p>
                              ) : null}
                            </div>
                            <div className="space-y-3 rounded-2xl border border-white/10 bg-black/40 p-4 lg:basis-[45%]">
                              <p className="text-sm font-semibold text-white">Driver contact</p>
                              {driverInfo ? (
                                <div className="space-y-1 text-xs text-gray-300">
                                  <p>Name: {driverInfo.name}</p>
                                  <p>Phone: {driverInfo.phone}</p>
                                  <p>PCO licence number: {driverInfo.license}</p>
                                  {driverCarLabel ? <p>{driverCarLabel}</p> : null}
                                  <p>Email: {driverInfo.email}</p>
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500">No driver contact on file.</p>
                              )}
                            </div>
                          </div>
                        );
                      })()}
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
                disabled={confirmDriverBusy}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-gray-200 hover:border-white/40 transition"
              >
                No
              </button>
              <button
                type="button"
                onClick={handleConfirmDriver}
                disabled={confirmDriverBusy}
                className="rounded-full border border-amber-400 bg-amber-400 px-5 py-2 text-sm font-semibold text-black shadow-[0_0_20px_rgba(251,191,36,0.4)] hover:shadow-[0_0_30px_rgba(251,191,36,0.6)] transition"
              >
                {confirmDriverBusy ? 'Saving...' : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {allocationWarning && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-red-400/50 bg-gray-900/90 p-6 shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-red-300 mb-3">Allocation warning</p>
            <p className="text-lg text-white mb-6">{allocationWarning}</p>
            <div className="flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={() => setAllocationWarning(null)}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-gray-200 hover:border-white/40 transition"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {allocationSuccess && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-emerald-400/50 bg-gray-900/90 p-6 shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300 mb-3">Allocation confirmed</p>
            <p className="text-lg text-white mb-6">{allocationSuccess}</p>
            <div className="flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={() => setAllocationSuccess(null)}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-gray-200 hover:border-white/40 transition"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingCancelAllocation && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900/90 p-6 shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300 mb-3">Cancel job</p>
            <p className="text-lg text-white mb-6">
              Are you sure you want to cancel this allocation and move the booking back to pending?
            </p>
            <div className="flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={closeCancelAllocationModal}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-gray-200 hover:border-white/40 transition"
              >
                No
              </button>
              <button
                type="button"
                onClick={confirmCancelAllocation}
                className="rounded-full border border-red-400 bg-red-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-400"
              >
                Yes, cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingCompleteBooking && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900/90 p-6 shadow-2xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">Complete job</p>
            <p className="mb-4 text-lg text-white">Confirm final fare for {pendingCompleteBooking.id}</p>
            <label className="mb-4 block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">
                Final fare
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={completeFinalFare}
                onChange={(event) => setCompleteFinalFare(event.target.value)}
                className="w-full rounded-xl border border-white/15 bg-black/70 px-3 py-2 text-sm text-gray-100"
              />
            </label>
            <p className="mb-6 text-sm text-gray-300">
              {pendingCompleteBooking.isDriverCollect
                ? 'This is a driver-collection job. No Stripe charge will be attempted when completing it.'
                : pendingCompleteIsFlexible
                ? 'This will charge the saved card off-session for the final fare, then mark the job as completed.'
                : HOLD_PAYMENT_STATUSES.has(String(pendingCompleteBooking.paymentStatus || '').toLowerCase())
                  ? 'This will capture the existing Stripe authorization hold, then mark the job as completed.'
                  : 'This will mark the job as completed. No additional Stripe charge will be made.'}
            </p>
            <div className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeCompleteModal}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:border-white/40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCompleteAllocation}
                disabled={completeAllocationBusy[pendingCompleteBooking.id]}
                className="rounded-full border border-emerald-400 bg-emerald-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {completeAllocationBusy[pendingCompleteBooking.id] ? 'Completing...' : 'Confirm completion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingRefundBooking && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900/90 p-6 shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300 mb-3">
              Cancel job
            </p>
            <p className="text-lg text-white mb-2">
              {pendingRefundBooking.paymentAction === 'cancel_hold'
                ? `Release the Stripe authorization hold and cancel ${pendingRefundBooking.id}?`
                : pendingRefundBooking.paymentAction === 'cancel_no_charge'
                  ? `Cancel ${pendingRefundBooking.id} without charging the saved card?`
                  : pendingRefundBooking.paymentAction === 'manual_cancel'
                    ? `Cancel ${pendingRefundBooking.id} without Stripe action?`
                : `Confirm full refund and cancellation for ${pendingRefundBooking.id}?`}
            </p>
            <p className="text-sm text-gray-300 mb-6">
              {pendingRefundBooking.paymentAction === 'cancel_hold'
                ? 'The authorized card hold will be released in Stripe, the client will receive a cancellation email, and the assigned driver will be notified.'
                : pendingRefundBooking.paymentAction === 'cancel_no_charge'
                  ? 'No Stripe payment has been taken yet. The booking will be cancelled and the saved card will not be charged.'
                  : pendingRefundBooking.paymentAction === 'manual_cancel'
                    ? 'No Stripe refund or hold release will be attempted. The booking will be cancelled and notifications will be sent.'
                : 'The client will receive a refund email, the assigned driver will be notified, and the job will be removed from queue.'}
            </p>
            <div className="flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={closeRefundModal}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-gray-200 hover:border-white/40 transition"
              >
                No
              </button>
              <button
                type="button"
                onClick={confirmRefund}
                disabled={refundBusy[pendingRefundBooking.id]}
                className="rounded-full border border-red-400 bg-red-500 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {refundBusy[pendingRefundBooking.id]
                  ? pendingRefundBooking.paymentAction === 'cancel_hold' || pendingRefundBooking.paymentAction === 'cancel_no_charge' || pendingRefundBooking.paymentAction === 'manual_cancel'
                    ? 'Cancelling...'
                    : 'Refunding...'
                  : 'Yes, cancel job'}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingEditBooking && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-gray-900/90 p-6 shadow-2xl">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">{editBookingTitle}</p>
            <p className="mb-6 text-lg text-white">
              Update route and stops for {pendingEditBooking.id}. Fare will be recalculated and the authorization hold will be checked against the new estimate.
            </p>
            <div className="mb-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">Current amount</p>
                  <p className="mt-1 text-2xl font-semibold text-white">
                    {editBookingCurrentFare !== null ? formatCurrencyValue(editBookingCurrentFare) : 'Unavailable'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">Live preview</p>
                  <p className="mt-1 text-2xl font-semibold text-white">
                    {editPreviewLoading
                      ? 'Recalculating...'
                      : editPreviewFare !== null
                        ? formatCurrencyValue(editPreviewFare)
                        : 'Unavailable'}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-amber-100/80">
                {editPreviewDifference !== null && Number.isFinite(editPreviewDifference) ? (
                  <span>
                    Change:{' '}
                    <span className={editPreviewDifference > 0 ? 'text-red-200' : 'text-emerald-200'}>
                      {editPreviewDifference > 0 ? '+' : ''}
                      {formatCurrencyValue(Math.abs(editPreviewDifference))}
                    </span>
                  </span>
                ) : null}
                {editPreviewError ? <span className="text-red-200">{editPreviewError}</span> : null}
                {!editPreviewLoading && !editPreviewError ? (
                  <span>This is the amount that will be checked against the authorization hold on save.</span>
                ) : null}
              </div>
              {editPreviewError ? (
                <label className="mt-4 block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                    Manual fare
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editManualFare}
                    onChange={(event) => setEditManualFare(event.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-black/70 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500"
                    placeholder="Enter updated fare"
                  />
                </label>
              ) : null}
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Route</p>
                <p className="text-[11px] text-gray-400">Pickup and stops are entered one after the other, top to bottom.</p>
              </div>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Pickup</span>
                <input
                  ref={editPickupInputRef}
                  type="text"
                  value={editPickup}
                  onChange={(event) => setEditPickup(event.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/70 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500"
                  placeholder="Pickup address"
                />
                <p className="mt-1 text-[11px] text-gray-400">Start typing to search with Google Maps.</p>
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Date</span>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(event) => setEditDate(event.target.value)}
                    className="w-full rounded-xl border border-white/15 bg-black/70 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Time</span>
                  <input
                    type="time"
                    value={editTime}
                    onChange={(event) => setEditTime(event.target.value)}
                    disabled={editTimeLocked}
                    className="w-full rounded-xl border border-white/15 bg-black/70 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500"
                  />
                </label>
              </div>
              {editTimeLocked ? (
                <p className="text-sm text-amber-200">Pickup time can no longer be changed within 2 hours of the journey.</p>
              ) : null}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Stops / drop-off</span>
                  <button
                    type="button"
                    onClick={addEditDropOff}
                    className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white transition hover:border-amber-400"
                  >
                    Add stop
                  </button>
                </div>
                <p className="text-[11px] text-gray-400">Start typing a new address to see Google Maps suggestions.</p>
                {editDropOffs.map((stop, index) => (
                  <div key={`edit-stop-${index}`} className="flex gap-2">
                    <input
                      ref={(node) => {
                        editDropOffInputRefs.current[index] = node;
                      }}
                      type="text"
                      value={stop}
                      onChange={(event) => updateEditDropOff(index, event.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/70 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500"
                      placeholder={index === editDropOffs.length - 1 ? 'Final destination' : `Stop ${index + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => removeEditDropOff(index)}
                      className="rounded-xl border border-red-400/60 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-red-200 transition hover:border-red-300 hover:text-white"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Reason</span>
                <input
                  type="text"
                  value={editReason}
                  onChange={(event) => setEditReason(event.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/70 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500"
                  placeholder="admin_route_update"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Admin note</span>
                <textarea
                  rows={3}
                  value={editNote}
                  onChange={(event) => setEditNote(event.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-black/70 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500"
                  placeholder="Reason for route / fare correction"
                />
              </label>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={closeEditBookingModal}
                className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-gray-200 hover:border-white/40 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitEditBooking}
                disabled={editBookingBusy}
                className="rounded-full border border-amber-400 bg-amber-400 px-5 py-2 text-sm font-semibold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {editBookingBusy ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminDashboardPage;
