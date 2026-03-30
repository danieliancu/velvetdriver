'use client';

type PlaceLike = {
  name?: string;
  formatted_address?: string;
};

declare global {
  interface Window {
    google?: any;
  }
}

let googleLoadPromise: Promise<void> | null = null;

export const loadGoogleMapsPlaces = () => {
  if (window.google?.maps?.places) {
    return Promise.resolve();
  }
  if (googleLoadPromise) {
    return googleLoadPromise;
  }
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    console.warn('Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY');
    return Promise.resolve();
  }
  googleLoadPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-google-maps-places="true"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', (err) => reject(err), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsPlaces = 'true';
    script.onload = () => resolve();
    script.onerror = (err) => reject(err);
    document.head.appendChild(script);
  });
  return googleLoadPromise;
};

export const attachGooglePlacesAutocomplete = (
  input: HTMLInputElement,
  onSelect: (value: string, place: PlaceLike | null) => void
) => {
  const maps = window.google?.maps;
  if (!maps?.places) {
    return () => {};
  }

  const autocomplete = new maps.places.Autocomplete(input, {
    fields: ['name', 'formatted_address', 'geometry'],
    types: ['geocode', 'establishment'],
    componentRestrictions: { country: ['gb'] },
  });

  const listener = autocomplete.addListener('place_changed', () => {
    const place = autocomplete.getPlace() as PlaceLike | null;
    const value = place?.formatted_address || place?.name || input.value || '';
    if (value) {
      onSelect(value, place);
    }
  });

  return () => {
    if (maps?.event && listener) {
      maps.event.removeListener(listener);
    }
    if (maps?.event) {
      maps.event.clearInstanceListeners(autocomplete);
    }
  };
};
