export type ComputeRouteInput = {
  origin: string;
  destination: string;
  intermediates?: string[];
};

export type ComputeRouteResult = {
  hasTolls: boolean;
  distanceMeters: number | null;
  duration: string | null;
  encodedPolyline: string | null;
};

const GOOGLE_ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

const getRoutesApiKey = () =>
  process.env.GOOGLE_MAPS_SERVER_API_KEY ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  '';

export async function computeGoogleRoute(input: ComputeRouteInput): Promise<ComputeRouteResult> {
  const apiKey = getRoutesApiKey();
  if (!apiKey) {
    throw new Error('Missing Google Routes API key');
  }

  const body = {
    origin: { address: input.origin },
    destination: { address: input.destination },
    intermediates: (input.intermediates || []).filter(Boolean).map((address) => ({ address })),
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_UNAWARE',
    extraComputations: ['TOLLS'],
    routeModifiers: {
      avoidTolls: false,
      avoidHighways: false,
      avoidFerries: false,
      vehicleInfo: {
        emissionType: 'GASOLINE',
      },
    },
    languageCode: 'en-GB',
    units: 'IMPERIAL',
  };

  const res = await fetch(GOOGLE_ROUTES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.travelAdvisory.tollInfo,routes.legs.travelAdvisory.tollInfo',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Google Routes API error ${res.status}${detail ? `: ${detail}` : ''}`);
  }

  const data = (await res.json()) as {
    routes?: Array<{
      distanceMeters?: number;
      duration?: string;
      polyline?: { encodedPolyline?: string };
      travelAdvisory?: { tollInfo?: unknown };
      legs?: Array<{ travelAdvisory?: { tollInfo?: unknown } }>;
    }>;
  };
  const route = data.routes?.[0];
  const tollInfo = route?.travelAdvisory?.tollInfo;
  const hasLegTolls = Boolean(route?.legs?.some((leg) => Boolean(leg?.travelAdvisory?.tollInfo)));

  return {
    hasTolls: Boolean(tollInfo) || hasLegTolls,
    distanceMeters: typeof route?.distanceMeters === 'number' ? route.distanceMeters : null,
    duration: route?.duration ?? null,
    encodedPolyline: route?.polyline?.encodedPolyline ?? null,
  };
}
