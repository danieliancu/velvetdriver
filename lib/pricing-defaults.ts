// Canonical fallback pricing used when the database is unavailable.
// Single source of truth — do not duplicate these tables in routes or pages.

export type DefaultPricingVehicle = {
  id: number;
  code: string;
  label: string;
  asDirectedRate: number;
  mileage: { tier1: number; tier2: number; tier3: number };
  innerZoneOverride: number;
  minPrice: number;
};

export const DEFAULT_PRICING_VEHICLES: DefaultPricingVehicle[] = [
  { id: 3, code: 'mpv', label: 'Luxury MPV', asDirectedRate: 60, mileage: { tier1: 20, tier2: 4, tier3: 3.5 }, innerZoneOverride: 20, minPrice: 50 },
  { id: 2, code: 'luxury', label: 'Luxury', asDirectedRate: 60, mileage: { tier1: 8.75, tier2: 3.5, tier3: 3 }, innerZoneOverride: 8.75, minPrice: 40 },
  { id: 1, code: 'executive', label: 'Executive', asDirectedRate: 40, mileage: { tier1: 6.25, tier2: 2.5, tier3: 2 }, innerZoneOverride: 6.25, minPrice: 30 },
];

export const DEFAULT_ZONE_RINGS = [
  { id: 1, name: 'Zone 1', radiusMiles: 3 },
  { id: 2, name: 'Zone 2', radiusMiles: 6 },
  { id: 3, name: 'Zone 3', radiusMiles: 9 },
  { id: 4, name: 'Zone 4', radiusMiles: 12 },
];

export const DEFAULT_NIGHT_SURCHARGE = 30;
export const DEFAULT_CONGESTION_SURCHARGE = 15;
export const DEFAULT_AIRPORT_PICKUP_SURCHARGE = 15;
export const DEFAULT_AIRPORT_DROPOFF_SURCHARGE = 7;
export const DEFAULT_MINIMUM_PRICE_ACTIVE = true;
