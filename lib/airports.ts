export type AirportCode = 'luton' | 'southend' | 'heathrow' | 'stansted' | 'city' | 'gatwick';

export type AirportSurcharge = { pickup: number; dropoff: number };

type AirportConfig = {
  code: AirportCode;
  label: string;
  pickupRuleCode: string;
  dropoffRuleCode: string;
  matchers: RegExp[];
  location: { lat: number; lng: number };
};

export const AIRPORTS: AirportConfig[] = [
  {
    code: 'luton',
    label: 'Luton',
    pickupRuleCode: 'AIRPORT_PICKUP_LUTON',
    dropoffRuleCode: 'AIRPORT_DROPOFF_LUTON',
    matchers: [/\blondon\s+luton\s+airport\b/, /\bluton\s+airport\b/, /\bluton\s+airport\s+parkway\b/, /\bltn\b/],
    location: { lat: 51.8747, lng: -0.3683 },
  },
  {
    code: 'southend',
    label: 'Southend',
    pickupRuleCode: 'AIRPORT_PICKUP_SOUTHEND',
    dropoffRuleCode: 'AIRPORT_DROPOFF_SOUTHEND',
    matchers: [/\blondon\s+southend\s+airport\b/, /\bsouthend\s+airport\b/, /\bsen\b/, /eastwoodbury\s+cres/],
    location: { lat: 51.5714, lng: 0.6956 },
  },
  {
    code: 'heathrow',
    label: 'Heathrow',
    pickupRuleCode: 'AIRPORT_PICKUP_HEATHROW',
    dropoffRuleCode: 'AIRPORT_DROPOFF_HEATHROW',
    matchers: [/\bheathrow\s+airport\b/, /\bheathrow\s+terminal\b/, /\bheathrow\s+t\d\b/, /\blhr\b/, /hounslow\s+tw6/],
    location: { lat: 51.47, lng: -0.4543 },
  },
  {
    code: 'stansted',
    label: 'Stansted',
    pickupRuleCode: 'AIRPORT_PICKUP_STANSTED',
    dropoffRuleCode: 'AIRPORT_DROPOFF_STANSTED',
    matchers: [/\blondon\s+stansted\s+airport\b/, /\bstansted\s+airport\b/, /\bstn\b/, /bassingbourn\s+rd/],
    location: { lat: 51.886, lng: 0.2389 },
  },
  {
    code: 'city',
    label: 'City',
    pickupRuleCode: 'AIRPORT_PICKUP_CITY',
    dropoffRuleCode: 'AIRPORT_DROPOFF_CITY',
    matchers: [/\blondon\s+city\s+airport\b/, /\bcity\s+airport\b/, /\blcy\b/, /hartmann\s+rd,?\s+london\s+e16/],
    location: { lat: 51.5053, lng: 0.0553 },
  },
  {
    code: 'gatwick',
    label: 'Gatwick',
    pickupRuleCode: 'AIRPORT_PICKUP_GATWICK',
    dropoffRuleCode: 'AIRPORT_DROPOFF_GATWICK',
    matchers: [/\blondon\s+gatwick\s+airport\b/, /\bgatwick\s+airport\b/, /\blgw\b/],
    location: { lat: 51.1537, lng: -0.1821 },
  },
];

export const buildDefaultAirportSurcharges = (
  pickup: number,
  dropoff: number
): Record<AirportCode, AirportSurcharge> =>
  AIRPORTS.reduce((acc, airport) => {
    acc[airport.code] = { pickup, dropoff };
    return acc;
  }, {} as Record<AirportCode, AirportSurcharge>);

export const detectAirportCodeFromText = (text: string): AirportCode | null => {
  const normalized = text.toLowerCase();
  for (const airport of AIRPORTS) {
    if (airport.matchers.some((pattern) => pattern.test(normalized))) {
      return airport.code;
    }
  }
  return null;
};

const haversineMiles = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const c =
    2 *
    Math.atan2(
      Math.sqrt(sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon),
      Math.sqrt(1 - (sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon))
    );
  return earthRadiusKm * c * 0.621371;
};

export const detectAirportCodeFromCoords = (
  coords: { lat: number; lng: number },
  maxDistanceMiles = 8
): AirportCode | null => {
  let closest: { code: AirportCode; miles: number } | null = null;
  for (const airport of AIRPORTS) {
    const miles = haversineMiles(coords, airport.location);
    if (!closest || miles < closest.miles) {
      closest = { code: airport.code, miles };
    }
  }
  if (!closest || closest.miles > maxDistanceMiles) return null;
  return closest.code;
};
