
'use client';

import { Suspense, useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PlusCircle, XCircle, Calendar, Clock } from 'lucide-react';
import PageShell from '@/components/PageShell';
import BookingInput from '@/components/BookingInput';
import BookingSelect from '@/components/BookingSelect';
import BookingTextArea from '@/components/BookingTextArea';
import Modal from '@/components/Modal';
import { useAlert } from '@/components/AlertProvider';
import { useAuth } from '@/lib/auth-context';

type PlaceResult = {
    formatted_address?: string;
    geometry?: { location?: { lat: () => number; lng: () => number } };
    location?: { lat: number; lng: number };
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

const BookingPageInner = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const savedQuoteParam = searchParams?.get('saved');
    const { user } = useAuth();
    const passengerDetailsLocked = Boolean(user);
    const { showAlert } = useAlert();
    const [pickup, setPickup] = useState('');
    const [dropOffs, setDropOffs] = useState(['']);
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [vehicle, setVehicle] = useState('Executive');
    const [serviceType, setServiceType] = useState('Transfer');
    const [passengers, setPassengers] = useState('1');
    const [smallSuitcases, setSmallSuitcases] = useState('0');
    const [largeSuitcases, setLargeSuitcases] = useState('0');
    const [waiting, setWaiting] = useState('0');
    const [miles, setMiles] = useState('');
    const [pickupLatLng, setPickupLatLng] = useState<{ lat: number; lng: number } | null>(null);
    const [dropOffLatLng, setDropOffLatLng] = useState<{ lat: number; lng: number } | null>(null);
    const [stopCoords, setStopCoords] = useState<Array<{ lat: number; lng: number } | null>>([null]);
    const [legBreakdown, setLegBreakdown] = useState<Array<{
        miles: number;
        originLabel: string;
        destinationLabel: string;
        originZone: number | null;
        destinationZone: number | null;
        appliedZone: number | null;
    }>>([]);
    const googleLoadPromise = useRef<Promise<void> | null>(null);
    const pickupInputRef = useRef<HTMLInputElement | null>(null);
    const dropoffInputRefs = useRef<Array<HTMLInputElement | null>>([]);
    const dropoffAutocompleteRefs = useRef<any[]>([]);
    const distanceServiceRef = useRef<any>(null);
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

    const passengersCount = Math.max(0, Number(passengers) || 0);
    const smallSuitcasesCount = Math.max(0, Number(smallSuitcases) || 0);
    const largeSuitcasesCount = Math.max(0, Number(largeSuitcases) || 0);
    const waitingMinutes = Math.max(0, Number(waiting) || 0);
    const todayIso = new Date().toISOString().slice(0, 10);
    const requiredJourneyFieldsFilled =
        pickup.trim().length > 0 &&
        dropOffs.every((addr) => addr.trim().length > 0) &&
        date.trim().length > 0 &&
        time.trim().length > 0;

    const LONDON_CENTER = { lat: 51.509865, lng: -0.118092 }; // Charing Cross
    // Zones are concentric rings around central London; tweak radii to match your own map pricing.
    const zoneRings = [
        { id: 1, name: 'Zone 1', radiusMiles: 3 },
        { id: 2, name: 'Zone 2', radiusMiles: 6 },
        { id: 3, name: 'Zone 3', radiusMiles: 9 },
        { id: 4, name: 'Zone 4', radiusMiles: 12 },
        { id: 5, name: 'Zone 5', radiusMiles: 15 },
        { id: 6, name: 'Zone 6', radiusMiles: 20 },
        { id: 7, name: 'Zone 7', radiusMiles: 25 },
        { id: 8, name: 'Zone 8', radiusMiles: 30 },
        { id: 9, name: 'Zone 9', radiusMiles: 40 },
    ];

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

    const getZoneForCoords = (coords: { lat: number; lng: number }) => {
        const milesFromCenter = haversineMiles(coords, LONDON_CENTER);
        const zone = zoneRings.find((z) => milesFromCenter <= z.radiusMiles);
        return zone ?? zoneRings[zoneRings.length - 1];
    };

    type PricingVehicle = {
        code: string;
        label: string;
        asDirectedRate: number;
        mileage: { tier1: number; tier2: number; tier3: number };
        innerZoneOverride: number;
    };
    type PricingData = {
        vehicles: PricingVehicle[];
        surcharges: { airportPickup: number; airportDropoff: number; congestion: number };
        nightSurcharge: number;
    };

    const fallbackPricing: PricingData = {
        vehicles: [
            { code: 'mpv', label: 'Luxury MPV', asDirectedRate: 60, mileage: { tier1: 20, tier2: 4, tier3: 3.5 }, innerZoneOverride: 20 },
            { code: 'luxury', label: 'Luxury', asDirectedRate: 60, mileage: { tier1: 8.75, tier2: 3.5, tier3: 3 }, innerZoneOverride: 8.75 },
            { code: 'executive', label: 'Executive', asDirectedRate: 40, mileage: { tier1: 6.25, tier2: 2.5, tier3: 2 }, innerZoneOverride: 6.25 }
        ],
        surcharges: { airportPickup: 15, airportDropoff: 7, congestion: 15 },
        nightSurcharge: 30
    };
    const [pricing, setPricing] = useState<PricingData | null>(null);
    const [pricingError, setPricingError] = useState<string | null>(null);
    const pricingData = pricing ?? fallbackPricing;

    useEffect(() => {
        const loadPricing = async () => {
            try {
                const res = await fetch('/api/pricing', { cache: 'no-store' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = (await res.json()) as PricingData;
                if (data?.vehicles?.length) {
                    setPricing(data);
                } else {
                    setPricing(fallbackPricing);
                }
            } catch (err) {
                console.warn('Failed to load pricing from API, using defaults', err);
                setPricingError('Using fallback pricing — failed to load from database.');
                setPricing(fallbackPricing);
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
        if (zoneId <= 4) return vp.innerZoneOverride;
        return vp.mileage.tier2;
    };

    const pickAppliedZone = (originZone: number | null, destinationZone: number | null) => {
        if (originZone && destinationZone) return Math.max(originZone, destinationZone);
        return originZone ?? destinationZone ?? null;
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

    const applyQuotePayload = (payload: any) => {
        setPickup(payload.pickup || '');
        setDropOffs(Array.isArray(payload.dropOffs) && payload.dropOffs.length ? payload.dropOffs : ['']);
        setDate(payload.date || '');
        setTime(payload.time || '');
        setVehicle(payload.vehicle || 'Luxury MPV');
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

    const attachLegacyAutocomplete = () => {
        const maps = (window as any).google?.maps;
        if (!maps?.places || !pickupInputRef.current) return;
        distanceServiceRef.current = new maps.DistanceMatrixService();
        const opts = {
            fields: ['formatted_address', 'geometry'],
            types: ['geocode', 'establishment'],
            componentRestrictions: { country: ['gb'] },
        } as any;

        const pickupAuto = new maps.places.Autocomplete(pickupInputRef.current, opts);
        pickupAuto.addListener('place_changed', () => {
            const place = pickupAuto.getPlace();
            if (place?.formatted_address) setPickup(place.formatted_address);
            if (place?.geometry?.location) {
                setPickupLatLng({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
            }
        });

        dropoffAutocompleteRefs.current.forEach((auto) => maps.event.clearInstanceListeners(auto));
        dropoffAutocompleteRefs.current = [];

        dropoffInputRefs.current.forEach((input, index) => {
            if (!input) return;
            const dropAuto = new maps.places.Autocomplete(input, opts);
            dropAuto.addListener('place_changed', () => {
                const place = dropAuto.getPlace();
                if (place?.formatted_address) handleDropOffChange(index, place.formatted_address);
                if (place?.geometry?.location) {
                    const coords = [...stopCoords];
                    coords[index] = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
                    setStopCoords(coords);
                    if (index === 0) {
                        setDropOffLatLng({ lat: place.geometry.location.lat(), lng: place.geometry.location.lng() });
                    }
                }
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

        const tryAttach = (input: HTMLInputElement | null, onSelect: (place: PlaceResult | null) => void) => {
            if (!input) return false;
            let element: any;
            try {
                element = new PlaceAutocompleteElement();
                (element as any).inputElement = input;
                (element as any).types = ['geocode', 'establishment'];
                (element as any).countries = ['gb'];
            } catch {
                return false;
            }

            const handler = () => {
                const place = (element as any).getPlace ? (element as any).getPlace() : null;
                onSelect(place);
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
            if (place?.formatted_address) setPickup(place.formatted_address);
            const loc = place?.location ?? place?.geometry?.location;
            if (loc) {
                const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
                const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
                setPickupLatLng({ lat, lng });
            }
        });

        let allDropsOk = true;
        dropoffInputRefs.current.forEach((input, index) => {
            const ok = tryAttach(input, (place) => {
                if (place?.formatted_address) handleDropOffChange(index, place.formatted_address);
                const loc = place?.location ?? place?.geometry?.location;
                if (loc) {
                    const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
                    const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
                    const coords = [...stopCoords];
                    coords[index] = { lat, lng };
                    setStopCoords(coords);
                    if (index === 0) setDropOffLatLng({ lat, lng });
                }
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
    }, [dropOffs.length]);

    useEffect(() => {
        const maps = (window as any).google?.maps;
        if (!maps || !distanceServiceRef.current) return;
        const waypoints = [pickup.trim(), ...dropOffs.map((d) => d.trim())].filter(Boolean);
        const coordChain = [pickupLatLng, ...stopCoords];
        if (waypoints.length < 2) {
            setMiles('');
            setLegBreakdown([]);
            return;
        }

        const getLegDistance = (origin: any, destination: any) =>
            new Promise<number | null>((resolve) => {
                distanceServiceRef.current.getDistanceMatrix(
                    {
                        origins: [origin],
                        destinations: [destination],
                        travelMode: maps.TravelMode.DRIVING,
                    },
                    (response: any, status: string) => {
                        if (status !== 'OK') return resolve(null);
                        const meters = response?.rows?.[0]?.elements?.[0]?.distance?.value;
                        resolve(typeof meters === 'number' ? meters : null);
                    }
                );
            });

        let isCancelled = false;
        (async () => {
            let totalMeters = 0;
            const legs: Array<{
                miles: number;
                originLabel: string;
                destinationLabel: string;
                originZone: number | null;
                destinationZone: number | null;
                appliedZone: number | null;
            }> = [];
            for (let i = 0; i < waypoints.length - 1; i += 1) {
                const originCandidate = coordChain[i];
                const destCandidate = coordChain[i + 1];
                const origin = originCandidate ?? waypoints[i];
                const destination = destCandidate ?? waypoints[i + 1];
                const meters = await getLegDistance(origin, destination);
                if (meters == null) continue;
                totalMeters += meters;
                const milesValueLeg = meters / 1609.34;
                const originZone = originCandidate ? getZoneForCoords(originCandidate) : null;
                const destinationZone = destCandidate ? getZoneForCoords(destCandidate) : null;
                const appliedZone = pickAppliedZone(originZone?.id ?? null, destinationZone?.id ?? null);
                legs.push({
                    miles: milesValueLeg,
                    originLabel: waypoints[i],
                    destinationLabel: waypoints[i + 1],
                    originZone: originZone?.id ?? null,
                    destinationZone: destinationZone?.id ?? null,
                    appliedZone,
                });
            }
            if (!isCancelled && totalMeters > 0) {
                setLegBreakdown(legs);
                const milesValue = (totalMeters / 1609.34).toFixed(1);
                setMiles(milesValue);
            } else if (!isCancelled) {
                setMiles('');
                setLegBreakdown([]);
            }
        })();

        return () => {
            isCancelled = true;
        };
    }, [pickup, dropOffs, pickupLatLng, dropOffLatLng, stopCoords]);

    useEffect(() => {
        if (vehicle === 'Luxury' && !luxuryAllowed) {
            setVehicle('Luxury MPV');
        } else if (vehicle === 'Executive' && !executiveAllowed) {
            setVehicle('Luxury MPV');
        } else if (vehicle === 'Luxury MPV' && !luxuryMpvAllowed) {
            setPassengers('7');
        }
    }, [vehicle, luxuryAllowed, executiveAllowed, luxuryMpvAllowed]);

    const isNightTime = () => {
        if (!time) return false;
        const [hoursStr] = time.split(':');
        const hours = Number(hoursStr);
        if (Number.isNaN(hours)) return false;
        return hours >= 23 || hours < 4;
    };

    const milesValue = Number(miles) || 0;
    const isAirportOrTerminal = (value: string) => {
        const lowered = value.toLowerCase();
        if (/(airport|terminal)/i.test(value)) return true;
        // Explicit fallback for Google’s Luton drop-off label
        return lowered.includes('express drop off, luton lu2, uk');
    };
    const airportDetected = isAirportOrTerminal(pickup) || dropOffs.some((addr) => isAirportOrTerminal(addr));

    const getMileageRate = (veh: string, dist: number) => {
        const vp = vehiclePricing(veh);
        if (dist <= 10) return vp.mileage.tier1;
        if (dist <= 40) return vp.mileage.tier2;
        return vp.mileage.tier3;
    };

    const extras: string[] = [];

    const buildQuotePayload = () => ({
        pickup,
        dropOffs,
        date,
        time,
        vehicle,
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
            const payload = buildQuotePayload();
            const label = `${payload.pickup || 'Journey'} -> ${payload.dropOffs?.[0] || 'Destination'}`;
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

    const includesZoneOneToFour =
        legBreakdown.length > 0 &&
        legBreakdown.some((leg) => {
            const zones = [leg.appliedZone, leg.originZone, leg.destinationZone].filter((z): z is number => z != null);
            return zones.some((z) => z <= 4);
        });

    const zoneMileageFare =
        serviceType === 'As Directed'
            ? 0
            : legBreakdown.length && legBreakdown.every((leg) => leg.appliedZone !== null)
                ? legBreakdown.reduce((sum, leg) => sum + leg.miles * getZoneMileageRate(vehicle, leg.appliedZone), 0)
                : null;

    const mileageFare =
        serviceType === 'As Directed'
            ? hourlyRate
            : includesZoneOneToFour
                ? milesValue * getZoneMileageRate(vehicle, 1)
                : (zoneMileageFare ?? milesValue * getMileageRate(vehicle, milesValue));

    totalFare = mileageFare;

    if (serviceType !== 'As Directed') {
        if (waitingCost > 0) extras.push(`Waiting time GBP${waitingCost.toFixed(2)}`);
        totalFare += waitingCost;
    }

    if (isNightTime()) {
        totalFare += pricingData.nightSurcharge;
        extras.push(`Night surcharge GBP${pricingData.nightSurcharge.toFixed(2)}`);
    }
    if (isAirportOrTerminal(pickup)) {
        totalFare += pricingData.surcharges.airportPickup;
        extras.push(`Airport/terminal pickup GBP${pricingData.surcharges.airportPickup.toFixed(2)}`);
    }
    if (dropOffs.some(addr => isAirportOrTerminal(addr))) {
        totalFare += pricingData.surcharges.airportDropoff;
        extras.push(`Airport/terminal drop-off GBP${pricingData.surcharges.airportDropoff.toFixed(2)}`);
    }
    totalFare = Math.round(totalFare * 100) / 100;

    const extrasAmount = serviceType === 'As Directed' ? totalFare - hourlyRate : 0;
    const fareDisplay = serviceType === 'As Directed'
        ? extrasAmount > 0
            ? `GBP${hourlyRate.toFixed(2)}/h + GBP${extrasAmount.toFixed(2)}`
            : `GBP${hourlyRate.toFixed(2)}/h`
        : `GBP${totalFare.toFixed(2)}`;

    const extrasText =
        extras.length
            ? `Extras applied: ${extras.join('; ')}`
            : serviceType === 'As Directed'
                ? 'Includes hourly rate. No extras applied.'
                : 'Includes mileage (tiered by vehicle). No extras applied.';

    const zoneIds = legBreakdown
        .flatMap((leg) => [leg.originZone, leg.destinationZone, leg.appliedZone])
        .filter((z): z is number => z != null);
    const zonesCovered = Array.from(new Set(zoneIds)).sort((a, b) => a - b);
    const zoneText = serviceType === 'As Directed'
        ? ''
        : includesZoneOneToFour && zonesCovered.length
            ? `Zones detected: ${zonesCovered.map((z) => `Zone ${z}`).join(', ')}`
            : '';

    const handleAddStop = () => {
        setDropOffs([...dropOffs, '']);
        setStopCoords([...stopCoords, null]);
    };

    const handleRemoveStop = (index: number) => {
        if (dropOffs.length > 1) {
            const newDropOffs = dropOffs.filter((_, i) => i !== index);
            const newCoords = stopCoords.filter((_, i) => i !== index);
            setDropOffs(newDropOffs);
            setStopCoords(newCoords);
        }
    };

    const handleDropOffChange = (index: number, value: string) => {
        const newDropOffs = [...dropOffs];
        newDropOffs[index] = value;
        setDropOffs(newDropOffs);
        const newCoords = [...stopCoords];
        newCoords[index] = null;
        setStopCoords(newCoords);
        if (index === 0) setDropOffLatLng(null);
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
        // Show verification modal instead of immediately submitting
        const payload = buildQuotePayload();
        setPendingBookingPayload({
            ...payload,
            airportDetected,
            flightNumber,
            flightDetails,
            extras,
            totalFare,
            clientEmail: user?.email ?? null,
        });
        setShowVerificationModal(true);
    };

    const handleConfirmBooking = async () => {
        setBookingSubmitting(true);
        try {
            const response = await fetch('/api/booking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pendingBookingPayload),
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data?.error || 'Failed to submit booking');
            }
            setShowVerificationModal(false);
            showAlert('Booking submitted! An operator will call you shortly to confirm.');
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
    };

    return (
        <PageShell mainClassName="flex items-center justify-center py-24">
            <form onSubmit={handleSubmitBooking} className="relative z-10 w-full max-w-3xl bg-[#1c1010]/80 border border-amber-900/50 rounded-2xl shadow-2xl shadow-red-950/50 backdrop-blur-lg p-8 space-y-8">
                    {pricingError ? (
                        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                            {pricingError}
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
                                    value={pickup}
                                    onChange={e => {
                                        setPickup(e.target.value);
                                        setPickupLatLng(null);
                                    }}
                                    required
                                />
                            </div>
                            <div className="flex flex-col gap-1 w-full space-y-3">
                                {dropOffs.map((stop, index) => (
                                    <div key={index} className="flex items-center gap-2">
                                        <div className="flex-grow">
                                            <BookingInput 
                                                label={index === 0 ? "Drop-off" : `Stop ${index + 1}`}
                                                id={`dropoff-${index}`} 
                                                ref={(el) => { dropoffInputRefs.current[index] = el; }}
                                                value={stop}
                                                onChange={(e) => handleDropOffChange(index, e.target.value)}
                                                placeholder="Address or postcode"
                                                required
                                            />
                                        </div>
                                        {index > 0 && (
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
                                                    <p className="text-gray-200">Route: {flightDetails.dep || '—'} ? {flightDetails.arr || '—'}</p>
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
                                icon={<Calendar size={20} className="text-gray-400" />}
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
                                icon={<Clock size={20} className="text-gray-400" />}
                                value={time}
                                onChange={e => setTime(e.target.value)}
                                required
                            />
                             <BookingSelect label="Vehicle" id="vehicle" value={vehicle} onChange={e => setVehicle(e.target.value)}>
                                <option value="Luxury MPV">Luxury MPV</option>
                                <option value="Luxury" disabled={!luxuryAllowed}>Luxury</option>
                                <option value="Executive" disabled={!executiveAllowed}>Executive</option>
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

                {/* Verification Modal */}
                <Modal 
                    isOpen={showVerificationModal} 
                    onClose={handleGoBackAndVerify}
                    title="Verify Your Details"
                >
                    <div className="space-y-6">
                        <p className="text-amber-100 text-lg leading-relaxed">
                            Before you confirm, please take a moment to verify your pickup address, date and time details. If we dispatch a car using incorrect information, you may be charged the full fare.
                        </p>
                        
                        <div className="bg-black/30 border border-amber-900/40 rounded-lg p-4 space-y-3 text-sm text-gray-300">
                            <div className="flex justify-between items-start">
                                <span className="text-gray-400">Pickup:</span>
                                <span className="font-semibold text-amber-100">{pickup}</span>
                            </div>
                            <div className="flex justify-between items-start">
                                <span className="text-gray-400">Drop-off:</span>
                                <span className="font-semibold text-amber-100">{dropOffs[0]}</span>
                            </div>
                            <div className="flex justify-between items-start">
                                <span className="text-gray-400">Date:</span>
                                <span className="font-semibold text-amber-100">{date}</span>
                            </div>
                            <div className="flex justify-between items-start">
                                <span className="text-gray-400">Time:</span>
                                <span className="font-semibold text-amber-100">{time}</span>
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 pt-4">
                            <button
                                type="button"
                                onClick={handleGoBackAndVerify}
                                className="w-full sm:w-auto px-6 py-3 font-semibold bg-transparent border-2 border-amber-600 text-amber-400 rounded-lg hover:bg-amber-900/50 transition-colors"
                            >
                                Go back and change
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmBooking}
                                disabled={bookingSubmitting}
                                className="w-full sm:w-auto px-6 py-3 font-semibold bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-all duration-300 transform hover:scale-105 shadow-[0_0_15px_rgba(251,191,36,0.5)] disabled:opacity-60"
                            >
                                {bookingSubmitting ? 'Processing...' : 'Happy to proceed'}
                            </button>
                        </div>
                    </div>
                </Modal>
        </PageShell>
    );
};

const BookingPage = () => (
    <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading booking page...</div>}>
        <BookingPageInner />
    </Suspense>
);

export default BookingPage;

