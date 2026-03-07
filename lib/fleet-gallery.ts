const toTrimmedString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export function parseFleetGalleryImages(value: unknown): string[] {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map(toTrimmedString).filter(Boolean)));
  }

  if (typeof value !== 'string') {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return Array.from(new Set(parsed.map(toTrimmedString).filter(Boolean)));
  } catch {
    // Backward-compatible fallback for comma/newline separated values.
    return Array.from(
      new Set(
        trimmed
          .split(/\r?\n|,/g)
          .map((part) => part.trim())
          .filter(Boolean)
      )
    );
  }
}

export function sanitizeFleetGalleryImages(value: unknown, heroImage?: string | null): string[] {
  const hero = toTrimmedString(heroImage);
  return parseFleetGalleryImages(value).filter((url) => url !== hero);
}

export function getFleetDisplayImages(heroImage?: string | null, galleryImages?: unknown): string[] {
  const hero = toTrimmedString(heroImage);
  const gallery = parseFleetGalleryImages(galleryImages);
  return Array.from(new Set([hero, ...gallery].filter(Boolean)));
}
