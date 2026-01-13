export type AirportCode = 'luton' | 'southend' | 'heathrow' | 'stansted' | 'city' | 'gatwick';

export type AirportSurcharge = { pickup: number; dropoff: number };

type AirportConfig = {
  code: AirportCode;
  label: string;
  pickupRuleCode: string;
  dropoffRuleCode: string;
  matchers: RegExp[];
};

export const AIRPORTS: AirportConfig[] = [
  {
    code: 'luton',
    label: 'Luton',
    pickupRuleCode: 'AIRPORT_PICKUP_LUTON',
    dropoffRuleCode: 'AIRPORT_DROPOFF_LUTON',
    matchers: [/\bluton\b/, /\bltn\b/],
  },
  {
    code: 'southend',
    label: 'Southend',
    pickupRuleCode: 'AIRPORT_PICKUP_SOUTHEND',
    dropoffRuleCode: 'AIRPORT_DROPOFF_SOUTHEND',
    matchers: [/\bsouthend\b/, /\bsen\b/, /eastwoodbury\s+cres/],
  },
  {
    code: 'heathrow',
    label: 'Heathrow',
    pickupRuleCode: 'AIRPORT_PICKUP_HEATHROW',
    dropoffRuleCode: 'AIRPORT_DROPOFF_HEATHROW',
    matchers: [/\bheathrow\b/, /\blhr\b/, /hounslow\s+tw6/],
  },
  {
    code: 'stansted',
    label: 'Stansted',
    pickupRuleCode: 'AIRPORT_PICKUP_STANSTED',
    dropoffRuleCode: 'AIRPORT_DROPOFF_STANSTED',
    matchers: [/\bstansted\b/, /\bstn\b/, /bassingbourn\s+rd/],
  },
  {
    code: 'city',
    label: 'City',
    pickupRuleCode: 'AIRPORT_PICKUP_CITY',
    dropoffRuleCode: 'AIRPORT_DROPOFF_CITY',
    matchers: [/london\s+city/, /city\s+airport/, /\blcy\b/, /hartmann\s+rd,?\s+london\s+e16/],
  },
  {
    code: 'gatwick',
    label: 'Gatwick',
    pickupRuleCode: 'AIRPORT_PICKUP_GATWICK',
    dropoffRuleCode: 'AIRPORT_DROPOFF_GATWICK',
    matchers: [/\bgatwick\b/, /\blgw\b/],
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
