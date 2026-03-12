
'use client';

import { Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PlusCircle, XCircle } from 'lucide-react';
import { Elements, PaymentElement, PaymentRequestButtonElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import PageShell from '@/components/PageShell';
import BookingInput from '@/components/BookingInput';
import BookingSelect from '@/components/BookingSelect';
import BookingTextArea from '@/components/BookingTextArea';
import Modal from '@/components/Modal';
import { useAlert } from '@/components/AlertProvider';
import { useAuth } from '@/lib/auth-context';
import {
    AIRPORTS,
    buildDefaultAirportSurcharges,
    detectAirportCodeFromCoords,
    detectAirportCodeFromText,
    type AirportCode,
    type AirportSurcharge
} from '@/lib/airports';

type PlaceResult = {
    name?: string;
    formatted_address?: string;
    geometry?: { location?: { lat: () => number; lng: () => number } };
    location?: { lat: number; lng: number } | { lat: () => number; lng: () => number };
};

type FlightDetails = {
    number: string;
    status?: string;
    dep?: string;
    arr?: string;
    depTimeUtc?: string;
    arrTimeUtc?: string;
    latitude?: number;
    longitude?: number;
    altitudeMeters?: number;
    speedKmh?: number;
};

type ZoneRing = {
    id: number;
    name: string;
    radiusMiles: number;
};

type PlaceLike = {
    place_id?: string;
    types?: string[];
    name?: string;
    formatted_address?: string;
    geometry?: { location?: { lat: () => number; lng: () => number } };
    location?: { lat: number; lng: number } | { lat: () => number; lng: () => number };
};

const BOOKING_WHATSAPP_NOTIFY_PHONE = '+447400606640';

const formatPhoneForWhatsApp = (phone: string) => phone.replace(/\D/g, '');

const openWhatsAppBookingNotification = (payload: {
    bookingRef: string;
    date: string;
    time: string;
    passengerName: string;
    passengerPhone: string;
    pickup: string;
    destination: string;
    totalFare: number;
}) => {
    if (typeof window === 'undefined') return;
    const digits = formatPhoneForWhatsApp(BOOKING_WHATSAPP_NOTIFY_PHONE);
    if (!digits) return;
    const text = [
        `New paid booking: ${payload.bookingRef}`,
        `Date/time: ${payload.date} ${payload.time}`,
        `Passenger: ${payload.passengerName}`,
        `Phone: ${payload.passengerPhone}`,
        `Pickup: ${payload.pickup}`,
        `Drop-off: ${payload.destination}`,
        `Amount paid: GBP ${payload.totalFare.toFixed(2)}`,
    ].join('\n');

    const params = new URLSearchParams();
    params.set('text', text);
    const url = `whatsapp://send?phone=${digits}&${params.toString()}`;
    window.location.href = url;
};

const BookingPageInner = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const savedQuoteParam = searchParams?.get('saved');
    const { user } = useAuth();
    const passengerDetailsLocked = Boolean(user);
    const { showAlert } = useAlert();
    const [pickupAddress, setPickupAddress] = useState('');
    const [pickupDisplay, setPickupDisplay] = useState('');
    const [dropOffAddresses, setDropOffAddresses] = useState(['']);
    const [dropOffDisplays, setDropOffDisplays] = useState(['']);
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [vehicle, setVehicle] = useState('Executive');
    const [vehicleTypeId, setVehicleTypeId] = useState('');
    const [serviceType, setServiceType] = useState('Transfer');
    const [passengers, setPassengers] = useState('1');
    const [smallSuitcases, setSmallSuitcases] = useState('0');
    const [largeSuitcases, setLargeSuitcases] = useState('0');
    const [waiting, setWaiting] = useState('0');
    const [miles, setMiles] = useState('');
    const [pickupLatLng, setPickupLatLng] = useState<{ lat: number; lng: number } | null>(null);
    const [dropOffLatLng, setDropOffLatLng] = useState<{ lat: number; lng: number } | null>(null);
    const [stopCoords, setStopCoords] = useState<Array<{ lat: number; lng: number } | null>>([null]);
    const [pickupIsAirport, setPickupIsAirport] = useState(false);
    const [pickupAirportCode, setPickupAirportCode] = useState<AirportCode | null>(null);
    const [dropIsAirportFlags, setDropIsAirportFlags] = useState<boolean[]>([false]);
    const [dropAirportCodes, setDropAirportCodes] = useState<Array<AirportCode | null>>([null]);
    const [congestionDetected, setCongestionDetected] = useState(false);
    const [routesApiWarning, setRoutesApiWarning] = useState<string | null>(null);
    const [legBreakdown, setLegBreakdown] = useState<Array<{
        miles: number;
        originLabel: string;
        destinationLabel: string;
        originZone: number | null;
        destinationZone: number | null;
        appliedZone: number | null;
        zoneSegments: Array<{ zoneId: number | null; miles: number }>;
    }>>([]);
    const googleLoadPromise = useRef<Promise<void> | null>(null);
    const pickupInputRef = useRef<HTMLInputElement | null>(null);
    const dropoffInputRefs = useRef<Array<HTMLInputElement | null>>([]);
    const dropoffAutocompleteRefs = useRef<any[]>([]);
    const distanceServiceRef = useRef<any>(null);
    const directionsServiceRef = useRef<any>(null);
    const placeAutocompleteCleanupRef = useRef<Array<() => void>>([]);
    const [passengerName, setPassengerName] = useState('');
    const [passengerEmail, setPassengerEmail] = useState('');
    const [passengerPhone, setPassengerPhone] = useState('');
    const [specialEvents, setSpecialEvents] = useState('');
    const [notes, setNotes] = useState('');
    const [flightNumber, setFlightNumber] = useState('');
    const [flightDetails, setFlightDetails] = useState<FlightDetails | null>(null);
    const [flightLoading, setFlightLoading] = useState(false);
    const [flightError, setFlightError] = useState<string | null>(null);
    const [prefilledClientData, setPrefilledClientData] = useState(false);
    const [savingQuote, setSavingQuote] = useState(false);
    const [savedQuoteLoading, setSavedQuoteLoading] = useState(false);
    const [savedQuoteMessage, setSavedQuoteMessage] = useState<string | null>(null);
    const [bookingSubmitting, setBookingSubmitting] = useState(false);
    const [showVerificationModal, setShowVerificationModal] = useState(false);
    const [pendingBookingPayload, setPendingBookingPayload] = useState<any>(null);
    const [checkoutActive, setCheckoutActive] = useState(false);
    const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
    const [stripePublishableKey, setStripePublishableKey] = useState<string | null>(null);
    const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const [paymentOption, setPaymentOption] = useState<'pay_now' | 'pay_driver' | 'invoice'>('pay_now');
    const [paymentIntentLoading, setPaymentIntentLoading] = useState(false);
    const [clientJourneyCount, setClientJourneyCount] = useState<number | null>(null);
    const [discountCodeInput, setDiscountCodeInput] = useState('');
    const [discountData, setDiscountData] = useState<{
        code: string;
        name: string;
        type: 'fixed' | 'percent';
        amount: number;
    } | null>(null);
    const [discountError, setDiscountError] = useState<string | null>(null);
    const [discountLoading, setDiscountLoading] = useState(false);
    const draftLoadedRef = useRef(false);
    const draftKey = 'velvetdriver.booking.draft';

    const passengersCount = Math.max(0, Number(passengers) || 0);
    const smallSuitcasesCount = Math.max(0, Number(smallSuitcases) || 0);
    const largeSuitcasesCount = Math.max(0, Number(largeSuitcases) || 0);
    const waitingMinutes = Math.max(0, Number(waiting) || 0);
    const todayIso = new Date().toISOString().slice(0, 10);
    const requiredJourneyFieldsFilled =
        pickupAddress.trim().length > 0 &&
        dropOffAddresses.every((addr) => addr.trim().length > 0) &&
        date.trim().length > 0 &&
        time.trim().length > 0;
    const finalDropIndex = Math.max(0, dropOffAddresses.length - 1);
    const firstFivePrepayRequired = Boolean(user?.email && (clientJourneyCount == null || clientJourneyCount < 5));
    const paymentOptions: Array<{ key: 'pay_now' | 'pay_driver' | 'invoice'; label: string }> = firstFivePrepayRequired
        ? [{ key: 'pay_now', label: 'Pay now' }]
        : [
            { key: 'pay_now', label: 'Pay now' },
            { key: 'pay_driver', label: 'Pay to driver' },
            { key: 'invoice', label: 'Pay by invoice' },
        ];
    const bookingLeadTimeHours = useMemo(() => {
        if (!date.trim() || !time.trim()) return null;
        const journeyDateTime = new Date(`${date}T${time}`);
        if (Number.isNaN(journeyDateTime.getTime())) return null;
        return (journeyDateTime.getTime() - Date.now()) / (1000 * 60 * 60);
    }, [date, time]);
    const showLeadTimeNotice = bookingLeadTimeHours !== null && bookingLeadTimeHours < 24;

    const LONDON_CENTER = { lat: 51.509865, lng: -0.118092 }; // Charing Cross

    const haversineMiles = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
        const toRad = (deg: number) => (deg * Math.PI) / 180;
        const R = 6371; // km
        const dLat = toRad(b.lat - a.lat);
        const dLon = toRad(b.lng - a.lng);
        const lat1 = toRad(a.lat);
        const lat2 = toRad(b.lat);
        const sinLat = Math.sin(dLat / 2);
        const sinLon = Math.sin(dLon / 2);
        const aHarv = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
        const c = 2 * Math.atan2(Math.sqrt(aHarv), Math.sqrt(1 - aHarv));
        const distanceKm = R * c;
        return distanceKm * 0.621371; // miles
    };

    type PricingVehicle = {
        id: number;
        code: string;
        label: string;
        asDirectedRate: number;
        mileage: { tier1: number; tier2: number; tier3: number };
        innerZoneOverride: number;
        minPrice: number;
    };
    type PricingData = {
        vehicles: PricingVehicle[];
        surcharges: { congestion: number; airports: Record<AirportCode, AirportSurcharge> };
        nightSurcharge: number;
        minimumPriceActive: boolean;
        zoneRings: ZoneRing[];
    };

    const fallbackZoneRings: ZoneRing[] = [
        { id: 1, name: 'Zone 1', radiusMiles: 3 },
        { id: 2, name: 'Zone 2', radiusMiles: 6 },
        { id: 3, name: 'Zone 3', radiusMiles: 9 },
        { id: 4, name: 'Zone 4', radiusMiles: 12 },
    ];

    const fallbackPricing: PricingData = {
        vehicles: [
            { id: 3, code: 'mpv', label: 'Luxury MPV', asDirectedRate: 60, mileage: { tier1: 20, tier2: 4, tier3: 3.5 }, innerZoneOverride: 20, minPrice: 50 },
            { id: 2, code: 'luxury', label: 'Luxury', asDirectedRate: 60, mileage: { tier1: 8.75, tier2: 3.5, tier3: 3 }, innerZoneOverride: 8.75, minPrice: 40 },
            { id: 1, code: 'executive', label: 'Executive', asDirectedRate: 40, mileage: { tier1: 6.25, tier2: 2.5, tier3: 2 }, innerZoneOverride: 6.25, minPrice: 30 }
        ],
        surcharges: { congestion: 15, airports: buildDefaultAirportSurcharges(15, 7) },
        nightSurcharge: 30,
        minimumPriceActive: true,
        zoneRings: fallbackZoneRings,
    };
    const normalizeAirportSurcharges = (
        airports: Partial<Record<AirportCode, AirportSurcharge>> | undefined
    ): Record<AirportCode, AirportSurcharge> => {
        const normalized = buildDefaultAirportSurcharges(15, 7);
        for (const airport of AIRPORTS) {
            const existing = airports?.[airport.code];
            if (existing) {
                normalized[airport.code] = {
                    pickup: Number(existing.pickup ?? normalized[airport.code].pickup),
                    dropoff: Number(existing.dropoff ?? normalized[airport.code].dropoff),
                };
            }
        }
        return normalized;
    };
    const normalizePricingData = (data: PricingData): PricingData => ({
        ...data,
        vehicles: (data?.vehicles?.length ? data.vehicles : fallbackPricing.vehicles).map((v) => ({
            ...v,
            minPrice: Number(v.minPrice ?? 0),
        })),
        surcharges: {
            congestion: Number(data?.surcharges?.congestion ?? fallbackPricing.surcharges.congestion),
            airports: normalizeAirportSurcharges(data?.surcharges?.airports),
        },
        minimumPriceActive: Boolean(data?.minimumPriceActive ?? true),
        zoneRings: data?.zoneRings ?? fallbackPricing.zoneRings,
    });
    const [pricing, setPricing] = useState<PricingData | null>(null);
    const [pricingError, setPricingError] = useState<string | null>(null);
    const pricingData = pricing ?? fallbackPricing;

    const zoneRings = (pricingData.zoneRings?.length ? pricingData.zoneRings : fallbackZoneRings)
        .map((z) => ({ ...z, radiusMiles: Number(z.radiusMiles) }))
        .filter((z) => z.radiusMiles > 0)
        .sort((a, b) => a.radiusMiles - b.radiusMiles);

    const stripePromise = useMemo(
        () => (stripePublishableKey ? loadStripe(stripePublishableKey) : null),
        [stripePublishableKey]
    );

    const getZoneForCoords = (coords: { lat: number; lng: number }) => {
        if (!zoneRings.length) return null;
        const milesFromCenter = haversineMiles(coords, LONDON_CENTER);
        const furthestRing = zoneRings[zoneRings.length - 1];
        if (!furthestRing || milesFromCenter > furthestRing.radiusMiles) return null;
        return zoneRings.find((z) => milesFromCenter <= z.radiusMiles) ?? null;
    };

    useEffect(() => {
        const loadPricing = async () => {
            try {
                const res = await fetch('/api/pricing', { cache: 'no-store' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = (await res.json()) as PricingData;
                const normalized = normalizePricingData(data);
                if (normalized?.vehicles?.length) {
                    setPricing(normalized);
                    if (!vehicleTypeId) {
                        const firstAvailable = normalized.vehicles[0];
                        setVehicleTypeId(String(firstAvailable.id));
                        setVehicle(firstAvailable.label);
                    }
                } else {
                    setPricing(fallbackPricing);
                    if (!vehicleTypeId) {
                        const firstAvailable = fallbackPricing.vehicles[0];
                        setVehicleTypeId(String(firstAvailable?.id ?? ''));
                        setVehicle(firstAvailable?.label ?? vehicle);
                    }
                }
            } catch (err) {
                console.warn('Failed to load pricing from API, using defaults', err);
                setPricingError('Using fallback pricing - failed to load from database.');
                setPricing(fallbackPricing);
                if (!vehicleTypeId) {
                    const firstAvailable = fallbackPricing.vehicles[0];
                    setVehicleTypeId(String(firstAvailable?.id ?? ''));
                    setVehicle(firstAvailable?.label ?? vehicle);
                }
            }
        };
        loadPricing();
    }, []);

    const vehiclePricing = (veh: string) =>
        pricingData.vehicles.find((v) => v.label === veh || v.code === veh.toLowerCase().replace(/\s+/g, '-')) ||
        pricingData.vehicles[0];

    const getZoneMileageRate = (veh: string, zoneId: number | null) => {
        const vp = vehiclePricing(veh);
        if (!zoneId) return vp.mileage.tier2;
        if (zoneId <= 3) return vp.innerZoneOverride;
        return vp.mileage.tier2;
    };

    const pickAppliedZone = (originZone: number | null, destinationZone: number | null) => {
        const zones = [originZone, destinationZone].filter((z): z is number => z != null);
        if (!zones.length) return null;
        const touchesInner = zones.some((z) => z <= 3);
        if (touchesInner) {
            return Math.min(...zones);
        }
        return Math.max(...zones);
    };

    const buildZoneSegmentsFromSteps = (steps: any[]) => {
        if (!steps?.length) return null;
        const totals = new Map<string, number>();
        steps.forEach((step) => {
            const stepMeters = Number(step?.distance?.value ?? 0);
            if (!stepMeters) return;
            const path = Array.isArray(step?.path) ? step.path : [];
            if (path.length < 2) return;
            let straightMiles = 0;
            const rawSegments: Array<{ zoneId: number | null; miles: number }> = [];
            for (let i = 0; i < path.length - 1; i += 1) {
                const start = path[i];
                const end = path[i + 1];
                const startCoords = { lat: start.lat(), lng: start.lng() };
                const endCoords = { lat: end.lat(), lng: end.lng() };
                const segmentMiles = haversineMiles(startCoords, endCoords);
                straightMiles += segmentMiles;
                const mid = { lat: (startCoords.lat + endCoords.lat) / 2, lng: (startCoords.lng + endCoords.lng) / 2 };
                const zoneId = getZoneForCoords(mid)?.id ?? null;
                rawSegments.push({ zoneId, miles: segmentMiles });
            }
            if (straightMiles <= 0) return;
            const stepMiles = stepMeters / 1609.34;
            const scale = stepMiles / straightMiles;
            rawSegments.forEach((segment) => {
                const scaledMiles = segment.miles * scale;
                if (scaledMiles <= 0) return;
                const key = segment.zoneId == null ? 'none' : String(segment.zoneId);
                totals.set(key, (totals.get(key) || 0) + scaledMiles);
            });
        });
        return Array.from(totals.entries()).map(([key, miles]) => ({
            zoneId: key === 'none' ? null : Number(key),
            miles,
        }));
    };

    const withinLuxuryExecLuggage = () => {
        const largeOk = largeSuitcasesCount <= 2;
        const smallOk = smallSuitcasesCount <= 2;
        const altComboOk = largeSuitcasesCount <= 1 && smallSuitcasesCount <= 4;
        return (largeOk && smallOk) || altComboOk;
    };

    const luxuryAllowed = passengersCount <= 4 && withinLuxuryExecLuggage();
    const executiveAllowed = passengersCount <= 4 && withinLuxuryExecLuggage();
    const luxuryMpvAllowed = passengersCount <= 7;

    useEffect(() => {
        if (draftLoadedRef.current) return;
        draftLoadedRef.current = true;
        try {
            const raw = typeof window !== 'undefined' ? window.localStorage.getItem(draftKey) : null;
            if (!raw) return;
            const draft = JSON.parse(raw) as Partial<{
                pickupAddress: string;
                pickupDisplay: string;
                dropOffAddresses: string[];
                dropOffDisplays: string[];
                date: string;
                time: string;
                vehicle: string;
                vehicleTypeId: string;
                serviceType: string;
                passengers: string;
                smallSuitcases: string;
                largeSuitcases: string;
                waiting: string;
                miles: string;
                pickupLatLng: { lat: number; lng: number } | null;
                dropOffLatLng: { lat: number; lng: number } | null;
                stopCoords: Array<{ lat: number; lng: number } | null>;
                pickupIsAirport: boolean;
                pickupAirportCode: AirportCode | null;
                dropIsAirportFlags: boolean[];
                dropAirportCodes: Array<AirportCode | null>;
                passengerName: string;
                passengerEmail: string;
                passengerPhone: string;
                specialEvents: string;
                notes: string;
                flightNumber: string;
            }>;

            if (draft.pickupAddress) setPickupAddress(draft.pickupAddress);
            if (draft.pickupDisplay) setPickupDisplay(draft.pickupDisplay);
            if (draft.dropOffAddresses?.length) setDropOffAddresses(draft.dropOffAddresses);
            if (draft.dropOffDisplays?.length) setDropOffDisplays(draft.dropOffDisplays);
            if (draft.date) setDate(draft.date);
            if (draft.time) setTime(draft.time);
            if (draft.vehicle) setVehicle(draft.vehicle);
            if (draft.vehicleTypeId) setVehicleTypeId(draft.vehicleTypeId);
            if (draft.serviceType) setServiceType(draft.serviceType);
            if (draft.passengers) setPassengers(draft.passengers);
            if (draft.smallSuitcases) setSmallSuitcases(draft.smallSuitcases);
            if (draft.largeSuitcases) setLargeSuitcases(draft.largeSuitcases);
            if (draft.waiting) setWaiting(draft.waiting);
            if (draft.miles) setMiles(draft.miles);
            if (draft.pickupLatLng) setPickupLatLng(draft.pickupLatLng);
            if (draft.dropOffLatLng) setDropOffLatLng(draft.dropOffLatLng);
            if (draft.stopCoords?.length) setStopCoords(draft.stopCoords);
            if (typeof draft.pickupIsAirport === 'boolean') setPickupIsAirport(draft.pickupIsAirport);
            if (draft.pickupAirportCode !== undefined) setPickupAirportCode(draft.pickupAirportCode ?? null);
            if (draft.dropIsAirportFlags?.length) setDropIsAirportFlags(draft.dropIsAirportFlags);
            if (draft.dropAirportCodes?.length) setDropAirportCodes(draft.dropAirportCodes);
            if (draft.passengerName) setPassengerName(draft.passengerName);
            if (draft.passengerEmail) setPassengerEmail(draft.passengerEmail);
            if (draft.passengerPhone) setPassengerPhone(draft.passengerPhone);
            if (draft.specialEvents) setSpecialEvents(draft.specialEvents);
            if (draft.notes) setNotes(draft.notes);
            if (draft.flightNumber) setFlightNumber(draft.flightNumber);
        } catch {
            // ignore malformed drafts
        }
    }, [draftKey]);

    useEffect(() => {
        if (user && !prefilledClientData) {
            setPassengerName(user.name || '');
            setPassengerEmail(user.email || '');
            setPassengerPhone(user.phone || '');
            setPrefilledClientData(true);
        } else if (!user && prefilledClientData) {
            setPassengerName('');
            setPassengerEmail('');
            setPassengerPhone('');
            setPrefilledClientData(false);
        }
    }, [user, prefilledClientData]);

    useEffect(() => {
        if (!user?.email) {
            setClientJourneyCount(null);
            return;
        }
        let cancelled = false;
        fetch(`/api/client/history?email=${encodeURIComponent(user.email)}`, { cache: 'no-store' })
            .then(async (res) => {
                if (!res.ok) throw new Error('history');
                const data = await res.json();
                const journeys = Array.isArray(data?.journeys) ? data.journeys : [];
                if (!cancelled) setClientJourneyCount(journeys.length);
            })
            .catch(() => {
                if (!cancelled) setClientJourneyCount(0);
            });
        return () => {
            cancelled = true;
        };
    }, [user?.email]);

    useEffect(() => {
        if (firstFivePrepayRequired && paymentOption !== 'pay_now') {
            setPaymentOption('pay_now');
        }
    }, [firstFivePrepayRequired, paymentOption]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const draft = {
            pickupAddress,
            pickupDisplay,
            dropOffAddresses,
            dropOffDisplays,
            date,
            time,
            vehicle,
            vehicleTypeId,
            serviceType,
            passengers,
            smallSuitcases,
            largeSuitcases,
            waiting,
            miles,
            pickupLatLng,
            dropOffLatLng,
            stopCoords,
            pickupIsAirport,
            pickupAirportCode,
            dropIsAirportFlags,
            dropAirportCodes,
            passengerName,
            passengerEmail,
            passengerPhone,
            specialEvents,
            notes,
            flightNumber,
        };
        try {
            window.localStorage.setItem(draftKey, JSON.stringify(draft));
        } catch {
            // ignore storage errors
        }
    }, [
        pickupAddress,
        pickupDisplay,
        dropOffAddresses,
        dropOffDisplays,
        date,
        time,
        vehicle,
        vehicleTypeId,
        serviceType,
        passengers,
        smallSuitcases,
        largeSuitcases,
        waiting,
        miles,
        pickupLatLng,
        dropOffLatLng,
        stopCoords,
        pickupIsAirport,
        pickupAirportCode,
        dropIsAirportFlags,
        dropAirportCodes,
        passengerName,
        passengerEmail,
        passengerPhone,
        specialEvents,
        notes,
        flightNumber,
        draftKey,
    ]);

    const applyQuotePayload = (payload: any) => {
        const nextPickup = payload.pickup || '';
        const nextDrops = Array.isArray(payload.dropOffs) && payload.dropOffs.length ? payload.dropOffs : [''];
        setPickupAddress(nextPickup);
        setPickupDisplay(nextPickup);
        setDropOffAddresses(nextDrops);
        setDropOffDisplays(nextDrops);
        const stopsCount = nextDrops.length ? nextDrops.length : 1;
        setDropIsAirportFlags(Array.from({ length: stopsCount }, () => false));
        setDropAirportCodes(Array.from({ length: stopsCount }, () => null));
        setPickupIsAirport(false);
        setPickupAirportCode(null);
        setDate(payload.date || '');
        setTime(payload.time || '');
        const nextVehicle = payload.vehicle || 'Luxury MPV';
        setVehicle(nextVehicle);
        const knownVehicleId = payload.vehicleTypeId
            ? String(payload.vehicleTypeId)
            : String(pricingData.vehicles.find((v) => v.label === nextVehicle)?.id ?? '');
        setVehicleTypeId(knownVehicleId);
        setServiceType(payload.serviceType || 'Transfer');
        setPassengers(payload.passengers || '1');
        setSmallSuitcases(payload.smallSuitcases || '0');
        setLargeSuitcases(payload.largeSuitcases || '0');
        setWaiting(payload.waiting || '0');
        setMiles(payload.miles || '');
        setPassengerName(payload.passengerName || user?.name || '');
        setPassengerEmail(payload.passengerEmail || user?.email || '');
        setPassengerPhone(payload.passengerPhone || user?.phone || '');
        setSpecialEvents(payload.specialEvents || '');
        setNotes(payload.notes || '');
    };

    useEffect(() => {
        if (!savedQuoteParam) {
            setSavedQuoteMessage(null);
            setSavedQuoteLoading(false);
            return;
        }
        if (!user?.email) {
            setSavedQuoteMessage('Please sign in to load your saved quote.');
            setSavedQuoteLoading(false);
            return;
        }
        setSavedQuoteLoading(true);
        setSavedQuoteMessage(null);
        fetch(`/api/client/saved-quotes?id=${savedQuoteParam}&email=${encodeURIComponent(user.email)}`, { cache: 'no-store' })
            .then(async (res) => {
                if (!res.ok) throw new Error('Failed to load saved quote');
                const data = await res.json();
                if (data?.payload) {
                    applyQuotePayload(data.payload);
                    setSavedQuoteMessage('Loaded saved quote. Review and send when ready.');
                }
            })
            .catch(() => setSavedQuoteMessage('Unable to load saved quote.'))
            .finally(() => setSavedQuoteLoading(false));
    }, [savedQuoteParam, user?.email]);

    const loadGoogleMaps = () => {
        if ((window as any).google?.maps?.places) {
            return Promise.resolve();
        }
        if (googleLoadPromise.current) {
            return googleLoadPromise.current;
        }
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
        if (!apiKey) {
            console.warn('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');
            return Promise.resolve();
        }
        googleLoadPromise.current = new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
            script.async = true;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = (err) => reject(err);
            document.head.appendChild(script);
        });
        return googleLoadPromise.current;
    };

    const airportLabelByCode = AIRPORTS.reduce<Record<AirportCode, string>>((acc, airport) => {
        acc[airport.code] = airport.label;
        return acc;
    }, {} as Record<AirportCode, string>);

    const resolveAirportMatch = (place: PlaceLike | null | undefined, fallbackText?: string) => {
        const text = [place?.name, place?.formatted_address, fallbackText]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        const placeTypes = place?.types || [];
        const isAirportType = placeTypes.includes('airport') || placeTypes.includes('airport_terminal');
        const isAirportHint = /\b(airport|terminal|air\s*terminal)\b/.test(text);
        const loc = place?.location ?? place?.geometry?.location;
        const lat = loc ? (typeof loc.lat === 'function' ? loc.lat() : loc.lat) : null;
        const lng = loc ? (typeof loc.lng === 'function' ? loc.lng() : loc.lng) : null;
        const codeFromText = text ? detectAirportCodeFromText(text) : null;
        const codeFromCoords =
            lat != null && lng != null && (isAirportType || Boolean(codeFromText) || isAirportHint)
                ? detectAirportCodeFromCoords({ lat, lng }, isAirportHint ? 4 : 8)
                : null;
        const code = codeFromCoords ?? codeFromText;
        const isAirport = isAirportType || Boolean(code);
        return { isAirport, code };
    };

    const attachLegacyAutocomplete = () => {
        const maps = (window as any).google?.maps;
        if (!maps?.places || !pickupInputRef.current) return;
        distanceServiceRef.current = new maps.DistanceMatrixService();
        directionsServiceRef.current = new maps.DirectionsService();
        const opts = {
            fields: ['place_id', 'types', 'name', 'formatted_address', 'geometry'],
            types: ['geocode', 'establishment'],
            componentRestrictions: { country: ['gb'] },
        } as any;

        const placesService = new maps.places.PlacesService(document.createElement('div'));

        const ensurePlaceDetails = (place: any) =>
            new Promise<PlaceLike>((resolve) => {
                if (place?.types?.length || !place?.place_id) return resolve(place);
                placesService.getDetails(
                    { placeId: place.place_id, fields: ['place_id', 'types', 'name', 'formatted_address', 'geometry'] },
                    (detail: any, status: any) => {
                        if (status === maps.places.PlacesServiceStatus.OK && detail) {
                            resolve({ ...place, ...detail });
                        } else {
                            resolve(place);
                        }
                    }
                );
            });

        const pickupAuto = new maps.places.Autocomplete(pickupInputRef.current, opts);
        pickupAuto.addListener('place_changed', () => {
            const place = pickupAuto.getPlace();
            ensurePlaceDetails(place).then((full) => {
                const match = resolveAirportMatch(full, place?.formatted_address);
                const pickupLabel = match.isAirport
                    ? full?.name || full?.formatted_address
                    : full?.formatted_address || full?.name;
                if (pickupLabel) {
                    setPickupDisplay(pickupLabel);
                    setPickupAddress(full?.formatted_address || full?.name || pickupLabel);
                }
                if (full?.geometry?.location) {
                    setPickupLatLng({ lat: full.geometry.location.lat(), lng: full.geometry.location.lng() });
                }
                setPickupIsAirport(match.isAirport);
                setPickupAirportCode(match.code);
            });
        });

        dropoffAutocompleteRefs.current.forEach((auto) => maps.event.clearInstanceListeners(auto));
        dropoffAutocompleteRefs.current = [];

        dropoffInputRefs.current.forEach((input, index) => {
            if (!input) return;
            const dropAuto = new maps.places.Autocomplete(input, opts);
            dropAuto.addListener('place_changed', () => {
                const place = dropAuto.getPlace();
                ensurePlaceDetails(place).then((full) => {
                    const match = resolveAirportMatch(full, place?.formatted_address);
                    const dropoffLabel = match.isAirport
                        ? full?.name || full?.formatted_address
                        : full?.formatted_address || full?.name;
                    if (dropoffLabel) {
                        handleDropOffChange(index, dropoffLabel, full?.formatted_address || full?.name || dropoffLabel);
                    }
                    if (full?.geometry?.location) {
                        const coords = [...stopCoords];
                        coords[index] = { lat: full.geometry.location.lat(), lng: full.geometry.location.lng() };
                        setStopCoords(coords);
                        if (index === finalDropIndex) {
                            setDropOffLatLng({ lat: full.geometry.location.lat(), lng: full.geometry.location.lng() });
                        }
                    }
                    const flags = [...dropIsAirportFlags];
                    flags[index] = match.isAirport;
                    setDropIsAirportFlags(flags);
                    const codes = [...dropAirportCodes];
                    codes[index] = match.code;
                    setDropAirportCodes(codes);
                });
            });
            dropoffAutocompleteRefs.current.push(dropAuto);
        });
    };

    const attachPlaceAutocomplete = async () => {
        const maps = (window as any).google?.maps;
        const places = maps?.places;
        // Use PlaceAutocompleteElement only if available and supports inputElement; otherwise fallback to legacy.
        const PlaceAutocompleteElement = places?.PlaceAutocompleteElement;
        if (!PlaceAutocompleteElement) {
            attachLegacyAutocomplete();
            return;
        }

        const placesService = new maps.places.PlacesService(document.createElement('div'));
        const ensurePlaceDetails = (place: any) =>
            new Promise<PlaceLike>((resolve) => {
                if (place?.types?.length || !place?.place_id) return resolve(place);
                placesService.getDetails(
                    { placeId: place.place_id, fields: ['place_id', 'types', 'name', 'formatted_address', 'geometry'] },
                    (detail: any, status: any) => {
                        if (status === maps.places.PlacesServiceStatus.OK && detail) {
                            resolve({ ...place, ...detail });
                        } else {
                            resolve(place);
                        }
                    }
                );
            });

        const tryAttach = (input: HTMLInputElement | null, onSelect: (place: PlaceResult | null) => void) => {
            if (!input) return false;
            let element: any;
            try {
                element = new PlaceAutocompleteElement();
                (element as any).inputElement = input;
                (element as any).types = ['geocode', 'establishment'];
                (element as any).countries = ['gb'];
                (element as any).fields = ['place_id', 'types', 'name', 'formatted_address', 'geometry'];
            } catch {
                return false;
            }

            const handler = () => {
                const place = (element as any).getPlace ? (element as any).getPlace() : null;
                ensurePlaceDetails(place).then(onSelect);
            };
            ['placechange', 'gmp-placeselect', 'gmpx-placechange', 'place_changed'].forEach((evt) =>
                element.addEventListener(evt, handler)
            );
            placeAutocompleteCleanupRef.current.push(() => {
                ['placechange', 'gmp-placeselect', 'gmpx-placechange', 'place_changed'].forEach((evt) =>
                    element.removeEventListener(evt, handler)
                );
            });
            return true;
        };

        const pickupOk = tryAttach(pickupInputRef.current, (place) => {
            const match = resolveAirportMatch(place, place?.formatted_address);
            const pickupLabel = match.isAirport
                ? place?.name || place?.formatted_address
                : place?.formatted_address || place?.name;
            if (pickupLabel) {
                setPickupDisplay(pickupLabel);
                setPickupAddress(place?.formatted_address || place?.name || pickupLabel);
            }
            const loc = place?.location ?? place?.geometry?.location;
            if (loc) {
                const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
                const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
                setPickupLatLng({ lat, lng });
            }
            setPickupIsAirport(match.isAirport);
            setPickupAirportCode(match.code);
        });

        let allDropsOk = true;
        dropoffInputRefs.current.forEach((input, index) => {
            const ok = tryAttach(input, (place) => {
                const match = resolveAirportMatch(place, place?.formatted_address);
                const dropoffLabel = match.isAirport
                    ? place?.name || place?.formatted_address
                    : place?.formatted_address || place?.name;
                if (dropoffLabel) {
                    handleDropOffChange(index, dropoffLabel, place?.formatted_address || place?.name || dropoffLabel);
                }
                const loc = place?.location ?? place?.geometry?.location;
                if (loc) {
                    const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
                    const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
                    const coords = [...stopCoords];
                    coords[index] = { lat, lng };
                    setStopCoords(coords);
                    if (index === finalDropIndex) setDropOffLatLng({ lat, lng });
                }
                const flags = [...dropIsAirportFlags];
                flags[index] = match.isAirport;
                setDropIsAirportFlags(flags);
                const codes = [...dropAirportCodes];
                codes[index] = match.code;
                setDropAirportCodes(codes);
            });
            if (!ok) allDropsOk = false;
        });

        if (!pickupOk || !allDropsOk) {
            placeAutocompleteCleanupRef.current.forEach((fn) => fn());
            placeAutocompleteCleanupRef.current = [];
            attachLegacyAutocomplete();
        }
    };

    useEffect(() => {
        loadGoogleMaps()
            .then(() => {
                const retryAttach = (attempt = 0) => {
                    const mapsReady = (window as any).google?.maps?.places;
                    if (!mapsReady && attempt < 5) {
                        setTimeout(() => retryAttach(attempt + 1), 250);
                        return;
                    }
                    attachPlaceAutocomplete();
                };
                retryAttach();
            })
            .catch((err) => console.error('Failed to load Google Maps', err));
        // Re-attach when count changes so new stops get autocomplete

        return () => {
            placeAutocompleteCleanupRef.current.forEach((fn) => fn());
        };
    }, [dropOffDisplays.length]);

    useEffect(() => {
        const maps = (window as any).google?.maps;
        if (!maps || !directionsServiceRef.current) return;
        const waypoints = [pickupAddress.trim(), ...dropOffAddresses.map((d) => d.trim())].filter(Boolean);
        const coordChain = [pickupLatLng, ...stopCoords];
        if (waypoints.length < 2) {
            setMiles('');
            setLegBreakdown([]);
            return;
        }

        let isCancelled = false;
        (async () => {
            directionsServiceRef.current.route(
                {
                    origin: waypoints[0],
                    destination: waypoints[waypoints.length - 1],
                    waypoints: waypoints.slice(1, -1).map((location) => ({ location })),
                    travelMode: maps.TravelMode.DRIVING,
                },
                (result: any, status: string) => {
                    if (isCancelled) return;
                    if (status !== 'OK' || !result?.routes?.length) {
                        setMiles('');
                        setLegBreakdown([]);
                        return;
                    }
                    const route = result.routes[0];
                    const legsRaw = Array.isArray(route?.legs) ? route.legs : [];
                    if (!legsRaw.length) {
                        setMiles('');
                        setLegBreakdown([]);
                        return;
                    }
                    let totalMeters = 0;
                    const legs = legsRaw.map((leg: any, index: number) => {
                        const meters = Number(leg?.distance?.value ?? 0);
                        totalMeters += meters;
                        const milesValueLeg = meters / 1609.34;
                        const startCoords = leg?.start_location
                            ? { lat: leg.start_location.lat(), lng: leg.start_location.lng() }
                            : coordChain[index] ?? null;
                        const endCoords = leg?.end_location
                            ? { lat: leg.end_location.lat(), lng: leg.end_location.lng() }
                            : coordChain[index + 1] ?? null;
                        const originZone = startCoords ? getZoneForCoords(startCoords) : null;
                        const destinationZone = endCoords ? getZoneForCoords(endCoords) : null;
                        const appliedZone = pickAppliedZone(originZone?.id ?? null, destinationZone?.id ?? null);
                        const zoneSegments =
                            buildZoneSegmentsFromSteps(leg?.steps) ?? [{ zoneId: appliedZone, miles: milesValueLeg }];
                        return {
                            miles: milesValueLeg,
                            originLabel: waypoints[index],
                            destinationLabel: waypoints[index + 1],
                            originZone: originZone?.id ?? null,
                            destinationZone: destinationZone?.id ?? null,
                            appliedZone,
                            zoneSegments,
                        };
                    });
                    setLegBreakdown(legs);
                    setMiles(totalMeters ? (totalMeters / 1609.34).toFixed(1) : '');
                }
            );
        })();

        return () => {
            isCancelled = true;
        };
    }, [pickupAddress, dropOffAddresses, pickupLatLng, dropOffLatLng, stopCoords]);

    useEffect(() => {
        const stops = [pickupAddress.trim(), ...dropOffAddresses.map((d) => d.trim())].filter(Boolean);
        if (stops.length < 2 || serviceType === 'As Directed') {
            setCongestionDetected(false);
            setRoutesApiWarning(null);
            return;
        }

        const controller = new AbortController();
        const timer = setTimeout(async () => {
            try {
                const response = await fetch('/api/routes/compute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        origin: stops[0],
                        destination: stops[stops.length - 1],
                        intermediates: stops.slice(1, -1),
                    }),
                    signal: controller.signal,
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok || data?.ok === false) {
                    throw new Error(data?.error || 'Google Routes unavailable');
                }
                setCongestionDetected(Boolean(data?.hasTolls));
                setRoutesApiWarning(null);
            } catch (err: any) {
                if (controller.signal.aborted) return;
                setCongestionDetected(false);
                setRoutesApiWarning(err?.message || 'Unable to validate congestion zones via Google Routes.');
            }
        }, 500);

        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [pickupAddress, dropOffAddresses, serviceType]);

    useEffect(() => {
        if (vehicle === 'Luxury' && !luxuryAllowed) {
            const fallback = pricingData.vehicles.find((v) => v.label === 'Luxury MPV') ?? pricingData.vehicles[0];
            if (fallback) {
                setVehicle(fallback.label);
                setVehicleTypeId(String(fallback.id));
            }
        } else if (vehicle === 'Executive' && !executiveAllowed) {
            const fallback = pricingData.vehicles.find((v) => v.label === 'Luxury MPV') ?? pricingData.vehicles[0];
            if (fallback) {
                setVehicle(fallback.label);
                setVehicleTypeId(String(fallback.id));
            }
        } else if (vehicle === 'Luxury MPV' && !luxuryMpvAllowed) {
            setPassengers('7');
        }
    }, [vehicle, luxuryAllowed, executiveAllowed, luxuryMpvAllowed, pricingData.vehicles]);

    const isNightTime = () => {
        if (!time) return false;
        const [hoursStr] = time.split(':');
        const hours = Number(hoursStr);
        if (Number.isNaN(hours)) return false;
        return hours >= 23 || hours < 4;
    };

    const milesValue = Number(miles) || 0;
    const airportDetected = Boolean(pickupAirportCode || dropAirportCodes.some(Boolean));

    const getMileageRate = (veh: string, dist: number) => {
        const vp = vehiclePricing(veh);
        if (dist <= 10) return vp.mileage.tier1;
        if (dist <= 40) return vp.mileage.tier2;
        return vp.mileage.tier3;
    };

    const extras: Array<{ label: string; amount?: number }> = [];

    const resolvedVehicleTypeId =
        vehicleTypeId ||
        String(pricingData.vehicles.find((v) => v.label === vehicle)?.id ?? '');

    const buildQuotePayload = () => ({
        pickup: pickupAddress,
        dropOffs: dropOffAddresses,
        date,
        time,
        vehicle,
        vehicleTypeId: resolvedVehicleTypeId ? Number(resolvedVehicleTypeId) : null,
        serviceType,
        passengers,
        smallSuitcases,
        largeSuitcases,
        waiting,
        miles,
        passengerName,
        passengerEmail,
        passengerPhone,
        specialEvents,
        notes,
        flightNumber,
        flightDetails,
        airportDetected,
        congestionDetected,
    });

    const handleSaveQuote = async () => {
        if (!user?.email) {
            router.push('/client/signup');
            return;
        }
        if (!requiredJourneyFieldsFilled) {
            showAlert('Please complete pickup, drop-offs, date, and time before saving a quote.');
            return;
        }
        setSavingQuote(true);
        try {
            const payload = { ...buildQuotePayload(), totalFare };
            const destination =
                (Array.isArray(payload.dropOffs) ? payload.dropOffs[payload.dropOffs.length - 1] : '') || 'Destination';
            const label = `${pickupDisplay || payload.pickup || 'Journey'} -> ${destination}`;
            const res = await fetch('/api/client/saved-quotes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, label, payload }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Failed to save quote');
            }
            showAlert('Quote saved. You can open it later from the Saved list.');
        } catch (err: any) {
            showAlert(err?.message || 'Failed to save quote.');
        } finally {
            setSavingQuote(false);
        }
    };
    let totalFare = 0;
    const selectedVehicle = vehiclePricing(vehicle);
    const waitingRatePerHour = selectedVehicle.asDirectedRate;
    const waitingCost = serviceType === 'As Directed' ? 0 : waitingMinutes * (waitingRatePerHour / 60);
    const hourlyRate = selectedVehicle.asDirectedRate;

    const segmentedMilesTotal = legBreakdown.length
        ? legBreakdown.reduce(
            (sum, leg) => sum + leg.zoneSegments.reduce((innerSum, segment) => innerSum + segment.miles, 0),
            0
        )
        : 0;
    const chargeableMiles = milesValue > 0 ? milesValue : segmentedMilesTotal;
    const standardMileageRate = getMileageRate(vehicle, chargeableMiles);
    const standardMileageFare = chargeableMiles * standardMileageRate;

    const zoneInnerMiles =
        serviceType === 'As Directed' || !legBreakdown.length
            ? 0
            : legBreakdown.reduce(
                (sum, leg) =>
                    sum +
                    leg.zoneSegments.reduce(
                        (innerSum, segment) => innerSum + (segment.zoneId != null && segment.zoneId <= 3 ? segment.miles : 0),
                        0
                    ),
                0
            );
    const zoneOuterMiles = Math.max(0, segmentedMilesTotal - zoneInnerMiles);
    const hasZoneOverride = serviceType !== 'As Directed' && zoneInnerMiles > 0;
    const zoneOverrideRate = selectedVehicle.innerZoneOverride;
    const zoneMileageFare = hasZoneOverride
        ? (zoneInnerMiles * zoneOverrideRate) + (zoneOuterMiles * standardMileageRate)
        : null;
    const zoneInnerCost = zoneInnerMiles * zoneOverrideRate;
    const zoneOuterCost = zoneOuterMiles * standardMileageRate;

    const mileageFare =
        serviceType === 'As Directed'
            ? hourlyRate
            : (zoneMileageFare ?? milesValue * getMileageRate(vehicle, milesValue));

    totalFare = mileageFare;

    if (serviceType !== 'As Directed') {
        if (waitingCost > 0) extras.push({ label: 'Waiting time', amount: waitingCost });
        totalFare += waitingCost;
    }

    if (isNightTime()) {
        totalFare += pricingData.nightSurcharge;
        extras.push({ label: 'Night surcharge', amount: pricingData.nightSurcharge });
    }
    if (serviceType === 'Wait and Return') {
        const before = totalFare;
        totalFare *= 2;
        const delta = totalFare - before;
        extras.push({ label: 'Wait and Return', amount: delta });
    }
    if (congestionDetected) {
        const congestionSurcharge = pricingData.surcharges.congestion ?? 0;
        if (congestionSurcharge > 0) {
            totalFare += congestionSurcharge;
            extras.push({ label: 'Central London (Congestion)', amount: congestionSurcharge });
        }
    }
    if (pickupAirportCode) {
        const pickupSurcharge = pricingData.surcharges.airports[pickupAirportCode]?.pickup ?? 0;
        if (pickupSurcharge > 0) {
            totalFare += pickupSurcharge;
            const label = airportLabelByCode[pickupAirportCode] ?? 'Airport';
            extras.push({ label: `${label} pickup`, amount: pickupSurcharge });
        }
    }
    dropAirportCodes.forEach((code) => {
        if (!code) return;
        const dropoffSurcharge = pricingData.surcharges.airports[code]?.dropoff ?? 0;
        if (dropoffSurcharge > 0) {
            totalFare += dropoffSurcharge;
            const label = airportLabelByCode[code] ?? 'Airport';
            extras.push({ label: `${label} drop-off`, amount: dropoffSurcharge });
        }
    });
    totalFare = Math.round(totalFare * 100) / 100;
    const baseTotalFare = totalFare;

    const extrasAmount = serviceType === 'As Directed' ? totalFare - hourlyRate : 0;
    const fareDisplay = serviceType === 'As Directed'
        ? extrasAmount > 0
            ? `GBP${hourlyRate.toFixed(2)}/h + GBP${extrasAmount.toFixed(2)}`
            : `GBP${hourlyRate.toFixed(2)}/h`
        : `GBP${totalFare.toFixed(2)}`;

    const extrasForDisplay = extras;
    const outsideZonesBreakdownText =
        zoneOuterMiles > 0
            ? `Outside zones ${zoneOuterMiles.toFixed(1)} mi x GBP${standardMileageRate.toFixed(2)} = GBP${zoneOuterCost.toFixed(2)}`
            : `Outside zones ${zoneOuterMiles.toFixed(1)} mi (no charge)`;
    const mileageBreakdownText =
        serviceType === 'As Directed'
            ? `Mileage: hourly rate GBP${hourlyRate.toFixed(2)}/h`
            : hasZoneOverride
                ? `Mileage: Zone 1-3 ${zoneInnerMiles.toFixed(1)} mi x GBP${zoneOverrideRate.toFixed(2)} = GBP${zoneInnerCost.toFixed(2)}; ${outsideZonesBreakdownText}`
                : `Mileage: ${chargeableMiles.toFixed(1)} mi x GBP${standardMileageRate.toFixed(2)} = GBP${standardMileageFare.toFixed(2)}`;
    const surchargeBreakdownText = extrasForDisplay.length
        ? `Extras: ${extrasForDisplay
            .map((item) => (item.amount != null ? `${item.label} GBP${item.amount.toFixed(2)}` : item.label))
            .join('; ')}`
        : 'Extras: none';
    const extrasText = `Extras applied: ${mileageBreakdownText}; ${surchargeBreakdownText}`;
    const baseFareLabel = serviceType === 'As Directed'
        ? 'Hourly rate'
        : hasZoneOverride
            ? 'Zone mileage fare'
            : 'Mileage fare';
    const baseFareValue = mileageFare;
    const discountAmount = useMemo(() => {
        if (!discountData) return 0;
        const raw = discountData.type === 'percent'
            ? (baseTotalFare * discountData.amount) / 100
            : discountData.amount;
        const capped = Math.min(raw, baseTotalFare);
        return Math.round(capped * 100) / 100;
    }, [discountData, baseTotalFare]);
    const totalFareFinal = Math.max(0, Math.round((baseTotalFare - discountAmount) * 100) / 100);
    const minimumFareForVehicle = Number(selectedVehicle?.minPrice ?? 0);

    const zoneIds = legBreakdown
        .flatMap((leg) => leg.zoneSegments.map((segment) => segment.zoneId))
        .filter((z): z is number => z != null);
    const zonesCovered = Array.from(new Set(zoneIds)).sort((a, b) => a - b);
    const zoneText = '';
    const zoneMilesText = '';

    const handleAddStop = () => {
        const insertAt = Math.max(0, dropOffAddresses.length - 1);
        setDropOffAddresses([
            ...dropOffAddresses.slice(0, insertAt),
            '',
            ...dropOffAddresses.slice(insertAt),
        ]);
        setDropOffDisplays([
            ...dropOffDisplays.slice(0, insertAt),
            '',
            ...dropOffDisplays.slice(insertAt),
        ]);
        setStopCoords([
            ...stopCoords.slice(0, insertAt),
            null,
            ...stopCoords.slice(insertAt),
        ]);
        setDropIsAirportFlags([
            ...dropIsAirportFlags.slice(0, insertAt),
            false,
            ...dropIsAirportFlags.slice(insertAt),
        ]);
        setDropAirportCodes([
            ...dropAirportCodes.slice(0, insertAt),
            null,
            ...dropAirportCodes.slice(insertAt),
        ]);
    };

    const handleRemoveStop = (index: number) => {
        if (dropOffDisplays.length > 1 && index < dropOffDisplays.length - 1) {
            const newDropOffs = dropOffAddresses.filter((_, i) => i !== index);
            const newDropOffDisplays = dropOffDisplays.filter((_, i) => i !== index);
            const newCoords = stopCoords.filter((_, i) => i !== index);
            setDropOffAddresses(newDropOffs);
            setDropOffDisplays(newDropOffDisplays);
            setStopCoords(newCoords);
            const newFlags = dropIsAirportFlags.filter((_, i) => i !== index);
            setDropIsAirportFlags(newFlags);
            const newCodes = dropAirportCodes.filter((_, i) => i !== index);
            setDropAirportCodes(newCodes);
        }
    };

    const handleDropOffChange = (index: number, value: string, address?: string) => {
        const newDropOffDisplays = [...dropOffDisplays];
        newDropOffDisplays[index] = value;
        setDropOffDisplays(newDropOffDisplays);
        const newDropOffs = [...dropOffAddresses];
        newDropOffs[index] = address ?? value;
        setDropOffAddresses(newDropOffs);
        const newCoords = [...stopCoords];
        newCoords[index] = null;
        setStopCoords(newCoords);
        const newFlags = [...dropIsAirportFlags];
        newFlags[index] = false;
        setDropIsAirportFlags(newFlags);
        const newCodes = [...dropAirportCodes];
        newCodes[index] = null;
        setDropAirportCodes(newCodes);
        if (index === finalDropIndex) setDropOffLatLng(null);
    };
    useEffect(() => {
        if (!airportDetected) {
            setFlightNumber('');
            setFlightDetails(null);
            setFlightLoading(false);
            setFlightError(null);
        }
    }, [airportDetected]);

    useEffect(() => {
        if (!flightNumber.trim()) {
            setFlightDetails(null);
            setFlightLoading(false);
            setFlightError(null);
            return;
        }

        const baseUrl = process.env.NEXT_PUBLIC_AIRLABS_PROXY_URL || 'https://airlabs.co/api/v9';
        const apiKey = process.env.NEXT_PUBLIC_AIRLABS_API_KEY;
        if (!apiKey) {
            setFlightError('Configure NEXT_PUBLIC_AIRLABS_API_KEY to fetch live flight data.');
            setFlightDetails(null);
            setFlightLoading(false);
            return;
        }

        const callsign = flightNumber.trim().toUpperCase();
        setFlightLoading(true);
        setFlightError(null);
        const controller = new AbortController();

        const fetchFlight = async () => {
            try {
                const isIcao = /^[A-Z]{3}\d+/i.test(callsign);
                const queryKey = isIcao ? 'flight_icao' : 'flight_iata';
                const fetchOnce = async (base: string) => {
                    const res = await fetch(`${base}/flight?${queryKey}=${encodeURIComponent(callsign)}&api_key=${apiKey}`, {
                        signal: controller.signal,
                    });
                    return res;
                };

                let res = await fetchOnce(baseUrl);
                if (res.status === 404 && baseUrl.startsWith('/api/')) {
                    // Likely missing proxy in production; retry direct AirLabs
                    res = await fetchOnce('https://airlabs.co/api/v9');
                }

                if (!res.ok) {
                    if (res.status === 401) throw new Error('AirLabs auth failed (401). Check API key or quota.');
                    if (res.status === 404) throw new Error('AirLabs flight endpoint not found.');
                    throw new Error(`AirLabs responded ${res.status}`);
                }
                const data = await res.json();
                if (data?.error) {
                    throw new Error(data.error.message || 'AirLabs error');
                }
                const flight = data?.response;
                if (!flight) {
                    setFlightDetails(null);
                    setFlightError('No live flight found for this flight code right now.');
                    return;
                }
                const detail: FlightDetails = {
                    number: flight.flight_icao || flight.flight_iata || callsign,
                    status: flight.status,
                    dep: flight.dep_iata || flight.dep_icao,
                    arr: flight.arr_iata || flight.arr_icao,
                    depTimeUtc: flight.dep_time_utc,
                    arrTimeUtc: flight.arr_time_utc,
                    latitude: flight.lat,
                    longitude: flight.lng,
                    altitudeMeters: typeof flight.alt === 'number' ? flight.alt : undefined,
                    speedKmh: typeof flight.speed === 'number' ? Math.round(flight.speed) : undefined,
                };
                setFlightDetails(detail);
            } catch (err: any) {
                if (controller.signal.aborted) return;
                setFlightDetails(null);
                setFlightError(err?.message || 'Failed to fetch flight');
            } finally {
                if (!controller.signal.aborted) setFlightLoading(false);
            }
        };

        const timer = setTimeout(fetchFlight, 450);
        return () => {
            controller.abort();
            clearTimeout(timer);
        };
    }, [flightNumber]);

    const handleSubmitBooking = async (e: FormEvent) => {
        e.preventDefault();
        if (!requiredJourneyFieldsFilled) {
            showAlert('Please complete pickup, drop-off, date, and time.');
            return;
        }
        const journeyDateTime = new Date(`${date}T${time}`);
        if (Number.isNaN(journeyDateTime.getTime())) {
            showAlert('Please provide a valid date and time.');
            return;
        }
        if (showLeadTimeNotice) {
            showAlert(
                <span>
                    Online bookings require at least 24 hours notice. For urgent requests, please call{' '}
                    <a href="tel:+442081759186" className="text-amber-300 underline underline-offset-2">
                        +44 2081 759 186
                    </a>
                    .
                </span>
            );
            return;
        }
        if (pricingData.minimumPriceActive && totalFareFinal < minimumFareForVehicle) {
            showAlert(`The minimum fare fot your chosen category is GBP${minimumFareForVehicle.toFixed(2)}`);
            return;
        }
        if (typeof window !== 'undefined') {
            try {
                window.localStorage.removeItem(draftKey);
            } catch {
                // ignore storage errors
            }
        }
        // Show verification modal instead of immediately submitting
        const payload = buildQuotePayload();
        setPendingBookingPayload({
            ...payload,
            airportDetected,
            flightNumber,
            flightDetails,
            extras,
            totalFare: totalFareFinal,
            originalTotalFare: baseTotalFare,
            discount: discountData
                ? {
                    code: discountData.code,
                    name: discountData.name,
                    type: discountData.type,
                    amount: discountData.amount,
                    appliedAmount: discountAmount,
                }
                : null,
            clientEmail: user?.email ?? null,
        });
        setCheckoutActive(false);
        setStripeClientSecret(null);
        setStripePublishableKey(null);
        setPaymentIntentId(null);
        setPaymentError(null);
        setShowVerificationModal(true);
    };

    const handleProceedToCheckout = async () => {
        if (!pendingBookingPayload?.totalFare) {
            showAlert('Unable to calculate fare for checkout.');
            return;
        }
        setCheckoutActive(true);
        setStripeClientSecret(null);
        setStripePublishableKey(null);
        setPaymentIntentId(null);
        setPaymentError(null);
    };

    const createPaymentIntent = async () => {
        if (!pendingBookingPayload?.totalFare || paymentIntentLoading || stripeClientSecret) return;
        setPaymentIntentLoading(true);
        setPaymentError(null);
        try {
            const response = await fetch('/api/stripe/create-payment-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: Number(totalFareFinal),
                    currency: 'gbp',
                    passengerName: pendingBookingPayload.passengerName,
                    passengerEmail: pendingBookingPayload.passengerEmail,
                    pickup: pendingBookingPayload.pickup,
                    dropOffs: pendingBookingPayload.dropOffs,
                }),
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data?.error || 'Failed to start checkout');
            }
            const data = await response.json();
            setStripeClientSecret(data?.clientSecret ?? null);
            setStripePublishableKey(data?.publishableKey ?? null);
            setPaymentIntentId(data?.paymentIntentId ?? null);
        } catch (err: any) {
            setPaymentError(err?.message || 'Failed to start checkout.');
        } finally {
            setPaymentIntentLoading(false);
        }
    };

    const finalizeBooking = async (paymentIntent: { id: string; status: string }) => {
        setBookingSubmitting(true);
        try {
            const response = await fetch('/api/booking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...pendingBookingPayload,
                    totalFare: totalFareFinal,
                    originalTotalFare: baseTotalFare,
                    discount: discountData
                        ? {
                            code: discountData.code,
                            name: discountData.name,
                            type: discountData.type,
                            amount: discountData.amount,
                            appliedAmount: discountAmount,
                        }
                        : null,
                    paymentIntentId: paymentIntent.id,
                    paymentStatus: paymentIntent.status,
                    paymentMethod: 'Card',
                    paymentAmount: Number(totalFareFinal),
                    paymentCurrency: 'GBP',
                }),
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data?.error || 'Failed to submit booking');
            }
            const data = await response.json().catch(() => ({}));
            const destinationText = Array.isArray(pendingBookingPayload?.dropOffs) && pendingBookingPayload.dropOffs.length
                ? String(pendingBookingPayload.dropOffs[pendingBookingPayload.dropOffs.length - 1] || '')
                : '';
            const bookingRef = data?.journeyId
                ? `VD-${String(data.journeyId).padStart(4, '0')}`
                : paymentIntent.id
                    ? `PI-${paymentIntent.id}`
                    : `BK-${Date.now()}`;
            openWhatsAppBookingNotification({
                bookingRef,
                date: pendingBookingPayload?.date || '',
                time: pendingBookingPayload?.time || '',
                passengerName: pendingBookingPayload?.passengerName || '',
                passengerPhone: pendingBookingPayload?.passengerPhone || '',
                pickup: pendingBookingPayload?.pickup || '',
                destination: destinationText,
                totalFare: Number(totalFareFinal),
            });
            setShowVerificationModal(false);
            setCheckoutActive(false);
            showAlert('Payment confirmed! Your booking is now complete.');
            router.push(user ? '/client/dashboard' : '/');
        } catch (err: any) {
            showAlert(err?.message || 'Failed to submit booking.');
        } finally {
            setBookingSubmitting(false);
        }
    };

    const finalizeBookingManual = async (method: 'Pay to driver' | 'Pay by invoice') => {
        if (firstFivePrepayRequired) {
            setPaymentOption('pay_now');
            showAlert('For your first 5 journeys, payment must be made in advance by card.');
            return;
        }
        setBookingSubmitting(true);
        try {
            const response = await fetch('/api/booking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...pendingBookingPayload,
                    totalFare: totalFareFinal,
                    originalTotalFare: baseTotalFare,
                    discount: discountData
                        ? {
                            code: discountData.code,
                            name: discountData.name,
                            type: discountData.type,
                            amount: discountData.amount,
                            appliedAmount: discountAmount,
                        }
                        : null,
                    paymentIntentId: null,
                    paymentStatus: 'pending',
                    paymentMethod: method,
                    paymentAmount: Number(totalFareFinal),
                    paymentCurrency: 'GBP',
                }),
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data?.error || 'Failed to submit booking');
            }
            setShowVerificationModal(false);
            setCheckoutActive(false);
            showAlert('Booking request sent. Payment will be arranged separately.');
            router.push(user ? '/client/dashboard' : '/');
        } catch (err: any) {
            showAlert(err?.message || 'Failed to submit booking.');
        } finally {
            setBookingSubmitting(false);
        }
    };

    const handleGoBackAndVerify = () => {
        setShowVerificationModal(false);
        setPendingBookingPayload(null);
        setCheckoutActive(false);
        setStripeClientSecret(null);
        setStripePublishableKey(null);
        setPaymentIntentId(null);
        setPaymentError(null);
    };

    useEffect(() => {
        if (!checkoutActive) return;
        if (paymentOption !== 'pay_now') return;
        createPaymentIntent();
    }, [checkoutActive, paymentOption, stripeClientSecret, totalFareFinal]);

    useEffect(() => {
        if (!checkoutActive || paymentOption !== 'pay_now') return;
        setStripeClientSecret(null);
        setStripePublishableKey(null);
        setPaymentIntentId(null);
    }, [discountAmount, checkoutActive, paymentOption]);

    const applyDiscountCode = async () => {
        const code = discountCodeInput.trim().toUpperCase();
        if (!code) {
            setDiscountError('Enter a discount code.');
            setDiscountData(null);
            return;
        }
        setDiscountLoading(true);
        setDiscountError(null);
        try {
            const res = await fetch(`/api/discount-codes/validate?code=${encodeURIComponent(code)}`, { cache: 'no-store' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Invalid discount code.');
            }
            const data = await res.json();
            setDiscountData({
                code: data.code,
                name: data.name,
                type: data.type,
                amount: Number(data.amount),
            });
        } catch (err: any) {
            setDiscountData(null);
            setDiscountError(err?.message || 'Invalid discount code.');
        } finally {
            setDiscountLoading(false);
        }
    };

    return (
        <PageShell mainClassName="flex items-center justify-center">
            <form onSubmit={handleSubmitBooking} className="relative z-10 w-full max-w-3xl bg-[#1c1010]/80 border border-amber-900/50 rounded-2xl shadow-2xl shadow-red-950/50 backdrop-blur-lg p-8 space-y-8">
                    {pricingError ? (
                        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                            {pricingError}
                        </div>
                    ) : null}
                    {routesApiWarning ? (
                        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                            {routesApiWarning}
                        </div>
                    ) : null}
                    {(savedQuoteLoading || savedQuoteMessage) && (
                        <div className="rounded-xl border border-blue-500/30 bg-blue-900/30 px-4 py-3 text-sm text-blue-100">
                            {savedQuoteLoading ? 'Loading saved quote...' : savedQuoteMessage}
                        </div>
                    )}
                    {/* Journey Details Section */}
                    <div>
                        <h2 className="text-3xl font-bold font-display text-amber-400 mb-2">Book a Journey</h2>
                        {!user && (
                            <p className="text-sm text-gray-400 mb-6">No account needed -- log in to manage bookings later.</p>
                        )}
                        <div className="flex gap-3 mb-6 text-sm flex-nowrap overflow-x-auto no-scrollbar">
                            {['Transfer', 'Wait and Return', 'As Directed'].map((option) => (
                                <label
                                    key={option}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-amber-900/60 bg-[#2a1a1a]/60 text-amber-100 cursor-pointer hover:border-amber-600 transition-colors flex-shrink-0 whitespace-nowrap"
                                    style={{ fontSize: 'clamp(0.75rem, 1vw, 0.95rem)' }}
                                >
                                    <input
                                        type="radio"
                                        name="serviceType"
                                        value={option}
                                        checked={serviceType === option}
                                        onChange={(e) => setServiceType(e.target.value)}
                                        className="text-amber-500 focus:ring-amber-500"
                                    />
                                    {option}
                                </label>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                            <div className="flex flex-col gap-1 w-full">
                                <BookingInput
                                    ref={pickupInputRef}
                                    label="Pickup"
                                    id="pickup"
                                    placeholder="Address or postcode"
                                    value={pickupDisplay}
                                    onChange={e => {
                                        setPickupDisplay(e.target.value);
                                        setPickupAddress(e.target.value);
                                        setPickupLatLng(null);
                                        setPickupIsAirport(false);
                                        setPickupAirportCode(null);
                                    }}
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-1 w-full space-y-3">
                                {dropOffDisplays.map((stop, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <div className="flex-grow">
                                            <BookingInput 
                                                label={index === dropOffDisplays.length - 1 ? "Drop-off" : `Stop ${index + 1}`}
                                                id={`dropoff-${index}`} 
                                                ref={(el) => { dropoffInputRefs.current[index] = el; }}
                                        value={stop}
                                        onChange={(e) => handleDropOffChange(index, e.target.value)}
                                                placeholder="Address or postcode"
                                                required
                                            />
                                        </div>
                                        {index < dropOffDisplays.length - 1 && (
                                            <button type="button" onClick={() => handleRemoveStop(index)} className="mt-5 text-red-500 hover:text-red-400 transition-colors">
                                                <XCircle size={24} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button type="button" onClick={handleAddStop} className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors pt-1">
                                    <PlusCircle size={18} /> Add another stop
                                 </button>
                            </div>

                            {airportDetected && (
                                <div className="md:col-span-2 bg-[#2a1a1a]/60 border border-amber-900/40 rounded-lg p-4 space-y-3">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <p className="text-sm font-semibold text-amber-200">Airport detected</p>
                                        <p className="text-xs text-gray-400">Add flight number so we prep meet & greet</p>
                                    </div>
                                    <BookingInput
                                        label="Flight number"
                                        id="flight-number"
                                        placeholder="e.g. BA984"
                                        value={flightNumber}
                                        onChange={(e) => setFlightNumber(e.target.value.toUpperCase())}
                                    />
                                    {flightNumber && (
                                        <div className="bg-black/30 border border-amber-900/40 rounded-md p-3 text-sm text-amber-100 space-y-2">
                                            {flightLoading && <p className="text-gray-400">Fetching live flight details...</p>}
                                            {!flightLoading && flightError && (
                                                <p className="text-red-300">{flightError}</p>
                                            )}
                                            {!flightLoading && flightDetails && (
                                                <div className="space-y-1">
                                                    <p className="text-amber-300 font-semibold">{flightDetails.number} {flightDetails.status ? `· ${flightDetails.status}` : ''}</p>
                                                    <p className="text-gray-200">Route: {flightDetails.dep || '-'} -&gt; {flightDetails.arr || '-'}</p>
                                                    {flightDetails.depTimeUtc && (
                                                        <p className="text-gray-200 text-xs">Dep (UTC): {flightDetails.depTimeUtc}</p>
                                                    )}
                                                    {flightDetails.arrTimeUtc && (
                                                        <p className="text-gray-200 text-xs">Arr (UTC): {flightDetails.arrTimeUtc}</p>
                                                    )}
                                                    {flightDetails.latitude != null && flightDetails.longitude != null && (
                                                        <p className="text-gray-200">Position: {flightDetails.latitude.toFixed(2)}, {flightDetails.longitude.toFixed(2)}</p>
                                                    )}
                                                    {flightDetails.altitudeMeters != null && (
                                                        <p className="text-gray-200">Altitude: {Math.round(flightDetails.altitudeMeters)} m</p>
                                                    )}
                                                    {flightDetails.speedKmh != null && (
                                                        <p className="text-gray-200">Speed: {flightDetails.speedKmh} km/h</p>
                                                    )}
                                                </div>
                                            )}
                                            {!flightLoading && !flightDetails && !flightError && (
                                                <p className="text-gray-400">Add a valid flight number to see live telemetry.</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            <BookingInput
                                label="Date"
                                id="date"
                                type="date"
                                inputMode="numeric"
                                min={todayIso}
                                placeholder="yyyy-mm-dd"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                required
                            />
                            <BookingInput
                                label="Time"
                                id="time"
                                type="time"
                                inputMode="numeric"
                                placeholder="--:--"
                                value={time}
                                onChange={e => setTime(e.target.value)}
                                required
                            />
                            {showLeadTimeNotice && (
                                <div
                                    role="alert"
                                    aria-live="polite"
                                    className="w-full bg-amber-300 text-black rounded-[10px] flex flex-col justify-center items-center text-center p-[10px] text-sm leading-relaxed"
                                >
                                    <p>
                                        Online bookings require at least 24 hours notice. For urgent requests, please call{' '}
                                        <a href="tel:+442081759186" className="font-semibold underline underline-offset-2 text-black">
                                            +44 2081 759 186
                                        </a>
                                        .
                                    </p>
                                </div>
                            )}
                             <BookingSelect
                                label="Vehicle"
                                id="vehicle"
                                value={vehicleTypeId}
                                onChange={(e) => {
                                    const selectedId = e.target.value;
                                    setVehicleTypeId(selectedId);
                                    const selected = pricingData.vehicles.find((v) => String(v.id) === selectedId);
                                    if (selected) setVehicle(selected.label);
                                }}
                            >
                                {pricingData.vehicles.map((veh) => (
                                    <option
                                        key={veh.id}
                                        value={String(veh.id)}
                                        disabled={(veh.label === 'Luxury' && !luxuryAllowed) || (veh.label === 'Executive' && !executiveAllowed)}
                                    >
                                        {veh.label}
                                    </option>
                                ))}
                            </BookingSelect>
                            <BookingInput label="Passengers" id="passengers" type="number" min="1" max="7" value={passengers} onChange={e => setPassengers(e.target.value)} />
                            <BookingInput label="Small Suitcases" id="small-suitcases" type="number" min="0" value={smallSuitcases} onChange={e => setSmallSuitcases(e.target.value)} />
                            <BookingInput label="Large Suitcases" id="large-suitcases" type="number" min="0" value={largeSuitcases} onChange={e => setLargeSuitcases(e.target.value)} />
                            <BookingInput
                                label="Waiting Time (minutes)"
                                id="waiting"
                                type="number"
                                value={waiting}
                                onChange={e => setWaiting(e.target.value)}
                                disabled={serviceType === 'As Directed'}
                            />
                            <div className="flex flex-col gap-1 w-full">
                                <BookingInput
                                    label="Miles (auto)"
                                    id="miles"
                                    type="number"
                                    value={miles}
                                    placeholder="Auto when pickup & drop-off selected"
                                    readOnly
                                />
                                <p className="text-[11px] text-gray-400">Auto-calculated after you choose Pickup and all Drop-off stops.</p>
                            </div>
                        </div>
                    </div>


                    {/* Fare Estimate Section */}
                    <div className="bg-[#2a1a1a]/50 border border-amber-900/40 rounded-lg p-4">
                        <p className="text-sm text-amber-200/80">Live fare estimate</p>
                        <p className="text-4xl font-bold text-amber-400 my-1">{fareDisplay}</p>
                        <p className="text-xs text-gray-400">{extrasText}</p>
                        {zoneText ? <p className="text-xs text-gray-500 mt-1">{zoneText}</p> : null}
                        {zoneMilesText ? <p className="text-xs text-gray-500">{zoneMilesText}</p> : null}
                    </div>


                    {/* Special Events Section */}
                    <div className="bg-[#2a1a1a]/50 border border-amber-900/40 rounded-lg p-4 space-y-3">
                        <BookingTextArea
                            label="Special events"
                            id="special-events"
                            placeholder="Corporate roadshows, red carpet, weddings, security details..."
                            value={specialEvents}
                            onChange={(e) => setSpecialEvents(e.target.value)}
                        />
                    </div>




                    {/* Passenger Details Section */}
                    <div>
                         <h2 className="text-3xl font-bold font-display text-amber-400 mb-6">Passenger Details</h2>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                             <div className="md:col-span-1">
                                <BookingInput
                                    label="Name"
                                    id="name"
                                    value={passengerName}
                                    onChange={(e) => setPassengerName(e.target.value)}
                                    required
                                    disabled={passengerDetailsLocked}
                                />
                             </div>
                              <div className="md:col-span-1">
                                <BookingInput
                                    label="Email"
                                    id="email"
                                    type="email"
                                    value={passengerEmail}
                                    onChange={(e) => setPassengerEmail(e.target.value)}
                                    required
                                    disabled={passengerDetailsLocked}
                                />
                             </div>
                              <div className="md:col-span-1">
                                <BookingInput
                                    label="Phone"
                                    id="phone"
                                    type="tel"
                                    value={passengerPhone}
                                    onChange={(e) => setPassengerPhone(e.target.value)}
                                    required
                                    disabled={passengerDetailsLocked}
                                />
                             </div>
                             <div className="md:col-span-3">
                                 <BookingTextArea label="Notes for the driver" id="notes" placeholder="Flight number, child seats, meet and greet requirements" value={notes} onChange={e => setNotes(e.target.value)} />
                             </div>
                         </div>
                         {passengerDetailsLocked ? (
                            <p className="text-xs text-gray-400 mt-2">
                                Passenger details are locked to your Velvet profile. Update them from your dashboard.
                            </p>
                         ) : null}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-center justify-start gap-4 pt-4 border-t border-amber-900/50">
                        <button
                            type="submit"
                            disabled={bookingSubmitting || !requiredJourneyFieldsFilled}
                            className="w-full sm:w-auto px-8 py-3 font-semibold bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-all duration-300 transform hover:scale-105 shadow-[0_0_15px_rgba(251,191,36,0.5)] disabled:opacity-60"
                        >
                            {bookingSubmitting ? 'Sending...' : 'Send Booking Request'}
                        </button>
                        {user ? (
                            <button
                                type="button"
                                onClick={handleSaveQuote}
                                disabled={savingQuote || !requiredJourneyFieldsFilled}
                                className="w-full sm:w-auto px-8 py-3 font-semibold bg-transparent border-2 border-amber-600 text-amber-400 rounded-lg hover:bg-amber-900/50 transition-colors disabled:opacity-60"
                            >
                                {savingQuote ? 'Saving quote...' : 'Save Quote'}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => router.push('/client/signup')}
                                className="w-full sm:w-auto px-8 py-3 font-semibold bg-transparent border-2 border-amber-600 text-amber-400 rounded-lg hover:bg-amber-900/50 transition-colors"
                            >
                                Create Account
                            </button>
                        )}
                    </div>
                </form>

                {/* Verification & Checkout Modal */}
                <Modal 
                    isOpen={showVerificationModal} 
                    onClose={handleGoBackAndVerify}
                    title={checkoutActive ? 'Checkout' : 'Verify Your Details'}
                >
                    <div className="space-y-6">
                        {!checkoutActive && (
                            <div className="flex max-h-[calc(100vh-13rem)] flex-col gap-4">
                                <div className="space-y-6 overflow-y-auto pr-1">
                                    <p className="text-amber-100 text-lg leading-relaxed">
                                        Before you confirm, please take a moment to verify your pickup address, date and time details. If we dispatch a car using incorrect information, you may be charged the full fare.
                                    </p>

                                    <div className="bg-black/30 border border-amber-900/40 rounded-lg p-4 space-y-3 text-sm text-gray-300">
                                        <div className="flex flex-col items-start gap-1">
                                            <span className="text-gray-400">Pickup:</span>
                                            <span className="font-semibold text-amber-100">{pickupDisplay || pickupAddress}</span>
                                        </div>
                                        <div className="flex flex-col items-start gap-1">
                                            <span className="text-gray-400">Drop-off:</span>
                                            <span className="font-semibold text-amber-100">
                                                {dropOffDisplays[dropOffDisplays.length - 1] || dropOffAddresses[dropOffAddresses.length - 1]}
                                            </span>
                                        </div>
                                        <div className="flex flex-col items-start gap-1">
                                            <span className="text-gray-400">Date:</span>
                                            <span className="font-semibold text-amber-100">{date}</span>
                                        </div>
                                        <div className="flex flex-col items-start gap-1">
                                            <span className="text-gray-400">Time:</span>
                                            <span className="font-semibold text-amber-100">{time}</span>
                                        </div>
                                        <div className="flex flex-col items-start gap-1">
                                            <span className="text-gray-400">Miles:</span>
                                            <span className="font-semibold text-amber-100">{miles ? `${miles} mi` : 'Auto'}</span>
                                        </div>
                                        <div className="flex flex-col items-start gap-1">
                                            <span className="text-gray-400">{baseFareLabel}:</span>
                                            <span className="font-semibold text-amber-100">GBP{baseFareValue.toFixed(2)}</span>
                                        </div>
                                        {discountAmount > 0 && (
                                            <div className="flex flex-col items-start gap-1">
                                                <span className="text-gray-400">Discount:</span>
                                                <span className="font-semibold text-amber-100">-GBP{discountAmount.toFixed(2)}</span>
                                            </div>
                                        )}
                                        <div className="flex flex-col items-start gap-1">
                                            <span className="text-gray-400">Total fare:</span>
                                            <span className="font-semibold text-amber-100">GBP{totalFareFinal.toFixed(2)}</span>
                                        </div>
                                        {extrasForDisplay.length ? (
                                            <div className="pt-3 border-t border-amber-900/30 space-y-2">
                                                <p className="text-xs uppercase tracking-wider text-amber-300/80">Extras applied</p>
                                                <div className="space-y-1">
                                                    {extrasForDisplay.map((item, idx) => (
                                                        <div key={`${item.label}-${idx}`} className="flex flex-col items-start gap-1">
                                                            <span className="text-gray-400">{item.label}:</span>
                                                            <span className="font-semibold text-amber-100">
                                                                {item.amount != null ? `GBP${item.amount.toFixed(2)}` : '—'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="sticky bottom-0 z-10 border-t border-amber-900/30 bg-[#120909]/95 pt-4 backdrop-blur-sm">
                                    <div className="flex flex-col sm:flex-row gap-4">
                                        <button
                                            type="button"
                                            onClick={handleGoBackAndVerify}
                                            className="w-full sm:w-auto px-6 py-3 font-semibold bg-transparent border-2 border-amber-600 text-amber-400 rounded-lg hover:bg-amber-900/50 transition-colors"
                                        >
                                            Go back and change
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleProceedToCheckout}
                                            disabled={bookingSubmitting}
                                            className="w-full sm:w-auto px-6 py-3 font-semibold bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-all duration-300 transform hover:scale-105 shadow-[0_0_15px_rgba(251,191,36,0.5)] disabled:opacity-60"
                                        >
                                            {bookingSubmitting ? 'Preparing checkout...' : 'Happy to proceed to checkout'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {checkoutActive && (
                            <>
                                {paymentError && (
                                    <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                                        {paymentError}
                                    </div>
                                )}
                                <div className="rounded-lg border border-white/10 bg-black/30 p-4 space-y-3">
                                    <p className="text-sm text-gray-300">Discount code</p>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <input
                                            type="text"
                                            value={discountCodeInput}
                                            onChange={(e) => setDiscountCodeInput(e.target.value)}
                                            placeholder="Enter code"
                                            className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={applyDiscountCode}
                                            disabled={discountLoading}
                                            className="px-4 py-2 text-sm font-semibold bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition disabled:opacity-60"
                                        >
                                            {discountLoading ? 'Applying...' : 'Apply'}
                                        </button>
                                    </div>
                                    {discountError ? <p className="text-xs text-red-300">{discountError}</p> : null}
                                    {discountData ? (
                                        <p className="text-xs text-amber-200">
                                            Applied {discountData.code} ({discountData.type === 'percent' ? `${discountData.amount}%` : `GBP${discountData.amount.toFixed(2)}`})
                                        </p>
                                    ) : null}
                                </div>
                                {user && (
                                    <div className="rounded-lg border border-white/10 bg-black/30 p-4 space-y-3">
                                        <p className="text-sm text-gray-300">Choose payment method</p>
                                        {firstFivePrepayRequired ? (
                                            <p className="text-xs text-amber-300">
                                                Registered clients can use only advance card payment for the first 5 journeys.
                                            </p>
                                        ) : null}
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            {paymentOptions.map((option) => (
                                                <label
                                                    key={option.key}
                                                    className={`flex-1 cursor-pointer rounded-lg border px-4 py-3 text-sm font-semibold transition ${
                                                        paymentOption === option.key
                                                            ? 'border-amber-400 bg-amber-500/10 text-amber-200'
                                                            : 'border-white/10 bg-black/20 text-gray-300 hover:border-amber-500/50'
                                                    }`}
                                                >
                                                    <input
                                                        type="radio"
                                                        name="paymentOption"
                                                        className="mr-2"
                                                        value={option.key}
                                                        checked={paymentOption === option.key}
                                                        onChange={() => setPaymentOption(option.key as typeof paymentOption)}
                                                    />
                                                    {option.label}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {paymentOption === 'pay_now' ? (
                                    stripePromise && stripeClientSecret ? (
                                        <Elements
                                            stripe={stripePromise}
                                            options={{
                                                clientSecret: stripeClientSecret,
                                                appearance: { theme: 'stripe' },
                                            }}
                                        >
                                            <PaymentForm
                                                amount={Number(totalFareFinal ?? 0)}
                                                clientSecret={stripeClientSecret}
                                                onSuccess={finalizeBooking}
                                                onError={setPaymentError}
                                                disabled={bookingSubmitting}
                                            />
                                        </Elements>
                                    ) : (
                                        <p className="text-sm text-gray-300">Preparing secure payment form...</p>
                                    )
                                ) : (
                                    <div className="rounded-lg border border-white/10 bg-black/30 p-4 space-y-3">
                                        <p className="text-sm text-gray-300">
                                            {paymentOption === 'pay_driver'
                                                ? 'You will pay the chauffeur directly on the day of the journey.'
                                                : 'An invoice will be issued to your account after the booking is confirmed.'}
                                        </p>
                                        <button
                                            type="button"
                                            disabled={bookingSubmitting}
                                            onClick={() =>
                                                finalizeBookingManual(paymentOption === 'pay_driver' ? 'Pay to driver' : 'Pay by invoice')
                                            }
                                            className="w-full px-6 py-3 font-semibold bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-all duration-300 disabled:opacity-60"
                                        >
                                            {bookingSubmitting ? 'Submitting...' : 'Confirm booking request'}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </Modal>
        </PageShell>
    );
};

type PaymentFormProps = {
    amount: number;
    clientSecret: string;
    disabled: boolean;
    onSuccess: (paymentIntent: { id: string; status: string }) => void;
    onError: (message: string) => void;
};

const PaymentForm = ({ amount, clientSecret, disabled, onSuccess, onError }: PaymentFormProps) => {
    const stripe = useStripe();
    const elements = useElements();
    const [submitting, setSubmitting] = useState(false);
    const [paymentRequest, setPaymentRequest] = useState<any>(null);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        if (!stripe || !elements) return;
        setSubmitting(true);
        onError('');
        try {
            const { error, paymentIntent } = await stripe.confirmPayment({
                elements,
                redirect: 'if_required',
                confirmParams: {
                    return_url: window.location.href,
                },
            });

            if (error) {
                onError(error.message || 'Payment failed.');
                return;
            }

            if (!paymentIntent || paymentIntent.status !== 'succeeded') {
                onError('Payment not completed. Please try again.');
                return;
            }

            onSuccess({ id: paymentIntent.id, status: paymentIntent.status });
        } finally {
            setSubmitting(false);
        }
    };

    useEffect(() => {
        if (!stripe || !clientSecret) return;
        const pr = stripe.paymentRequest({
            country: 'GB',
            currency: 'gbp',
            total: {
                label: 'Velvet Drivers',
                amount: Math.round(amount * 100),
            },
            requestPayerName: true,
            requestPayerEmail: true,
        });
        pr.canMakePayment().then((result) => {
            if (result) setPaymentRequest(pr);
        });
        pr.on('paymentmethod', async (event: any) => {
            try {
                const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
                    clientSecret,
                    { payment_method: event.paymentMethod.id },
                    { handleActions: false }
                );
                if (confirmError || !paymentIntent) {
                    event.complete('fail');
                    onError(confirmError?.message || 'Payment failed.');
                    return;
                }
                event.complete('success');
                if (paymentIntent.status === 'requires_action') {
                    const { error: actionError, paymentIntent: finalIntent } = await stripe.confirmCardPayment(clientSecret);
                    if (actionError || !finalIntent) {
                        onError(actionError?.message || 'Payment failed.');
                        return;
                    }
                    if (finalIntent.status === 'succeeded') {
                        onSuccess({ id: finalIntent.id, status: finalIntent.status });
                        return;
                    }
                }
                if (paymentIntent.status === 'succeeded') {
                    onSuccess({ id: paymentIntent.id, status: paymentIntent.status });
                    return;
                }
                onError('Payment not completed. Please try again.');
            } catch (err: any) {
                onError(err?.message || 'Payment failed.');
            }
        });
        return () => {
            pr.off('paymentmethod');
        };
    }, [stripe, clientSecret, amount, onError, onSuccess]);

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                <p className="text-sm text-gray-300">Amount due</p>
                <p className="text-2xl font-semibold text-amber-200">GBP{amount.toFixed(2)}</p>
            </div>
            {paymentRequest && (
                <div className="rounded-lg border border-white/10 bg-black/30 p-4 space-y-2">
                    <p className="text-xs uppercase tracking-wider text-amber-300/80">Express checkout</p>
                    <PaymentRequestButtonElement options={{ paymentRequest }} />
                </div>
            )}
            <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                <PaymentElement />
            </div>
            <button
                type="submit"
                disabled={!stripe || !elements || submitting || disabled}
                className="w-full px-6 py-3 font-semibold bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-all duration-300 disabled:opacity-60"
            >
                {submitting ? 'Processing payment...' : 'Pay now'}
            </button>
        </form>
    );
};

const BookingPage = () => (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading booking page...</div>}>
        <BookingPageInner />
    </Suspense>
);

export default BookingPage;
