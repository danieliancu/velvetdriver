export type JourneyLocationLine = {
  label: string;
  value: string;
  kind: 'pickup' | 'stop' | 'destination';
};

export const stripStopLabel = (value: string) => value.replace(/^Stop\s+\d+:\s*/i, '').trim();

export const parseDestinationStops = (destination: string) => {
  const raw = String(destination || '').trim();
  if (!raw) return [''];
  if (!raw.includes('Stop ')) return [raw];
  return raw
    .split(', ')
    .map((part) => stripStopLabel(part))
    .filter(Boolean);
};

export const resolveDropOffs = (destination: string, payload?: any) => {
  if (Array.isArray(payload?.dropOffs)) {
    return payload.dropOffs.map((stop: unknown) => String(stop || '').trim()).filter(Boolean);
  }
  return parseDestinationStops(destination).filter(Boolean);
};

export const buildJourneyLocationLines = (pickup: string, dropOffs: string[]): JourneyLocationLine[] => {
  const cleanedStops = dropOffs.map((stop) => String(stop || '').trim()).filter(Boolean);
  const lines: JourneyLocationLine[] = [];

  if (String(pickup || '').trim()) {
    lines.push({
      label: 'Pickup',
      value: String(pickup || '').trim(),
      kind: 'pickup',
    });
  }

  if (!cleanedStops.length) {
    return lines;
  }

  const finalDestination = cleanedStops[cleanedStops.length - 1];
  const intermediateStops = cleanedStops.slice(0, -1);

  intermediateStops.forEach((stop, index) => {
    lines.push({
      label: `Stop ${index + 1}`,
      value: stop,
      kind: 'stop',
    });
  });

  lines.push({
    label: intermediateStops.length ? 'Destination' : 'Destination',
    value: finalDestination,
    kind: 'destination',
  });

  return lines;
};
