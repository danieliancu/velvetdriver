import Link from 'next/link';
import PageShell from '@/components/PageShell';

type FleetType = {
  id: number | string;
  slug: string;
  label: string;
  summary: string | null;
  description: string | null;
  hero_image: string | null;
  features: string | null;
  sort_order?: number | null;
  is_active?: number | null;
};

const fallbackFleet: FleetType[] = [
  {
    id: 'seed-luxury',
    slug: 'luxury',
    label: 'Luxury',
    summary: 'Mercedes S-Class and equivalent — flawless finishes, serene cabin, and VIP presence.',
    description:
      'For executives, wedding transfers, and premium arrivals. Every detail is curated: fragrance, temperature, and calm.',
    hero_image:
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
    features: 'Heated leather interior\nPrivacy glass\nMeet & greet ready',
  },
  {
    id: 'seed-executive',
    slug: 'executive',
    label: 'Executive',
    summary: 'Mercedes E-Class and equivalent — elegant, discreet, and efficient for business travel.',
    description:
      'Perfect for city meetings and airport connections. A smart, understated premium experience.',
    hero_image:
      'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
    features: 'Silent cabin\nPremium audio\nOn-time guarantee',
  },
  {
    id: 'seed-mpv',
    slug: 'mpv',
    label: 'Luxury MPV',
    summary: 'Mercedes V-Class and equivalent — spacious, lounge-like comfort for families or teams.',
    description:
      'Ideal for group transfers, corporate roadshows, and travel with extra luggage.',
    hero_image:
      'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80',
    features: 'Captain seats\nExtra luggage space\nUSB charging',
  },
  {
    id: 'seed-suv',
    slug: 'suv',
    label: 'Luxury SUV',
    summary: 'Range Rover and equivalent — commanding comfort for weekend escapes or family travel.',
    description:
      'A premium SUV option with space, height, and a confident presence on the road.',
    hero_image:
      'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    features: 'All-wheel drive\nPanoramic roof\nPremium sound',
  },
];

async function fetchFleetTypes(): Promise<FleetType[]> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  try {
    const resp = await fetch(`${base}/api/fleet-types`, { next: { revalidate: 60 } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = (await resp.json()) as FleetType[];
    return data.length ? data : fallbackFleet;
  } catch {
    return fallbackFleet;
  }
}

export default async function FleetPage() {
  const fleet = await fetchFleetTypes();

  return (
    <PageShell mainClassName="flex flex-col items-center px-4 sm:px-6 md:px-8 py-16 bg-black text-white min-h-screen">
      <div className="max-w-6xl w-full space-y-8">
        <header className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-amber-300">Luxury Fleet</p>
          <h1 className="text-4xl md:text-5xl font-bold font-display text-white">
            Travel in style with our premium vehicles
          </h1>
          <p className="text-gray-300 max-w-2xl mx-auto">
            Explore the available vehicle classes and choose the perfect cabin for every journey.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {fleet.map((item) => (
            <Link
              href={`/fleet/${item.slug}`}
              key={item.slug}
              className="group rounded-2xl overflow-hidden border border-white/10 bg-black/40 shadow-lg shadow-black/30 hover:border-amber-400/50 transition-all"
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src={item.hero_image || 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80'}
                  alt={item.label}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute top-3 left-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-amber-300">
                  Available
                </span>
              </div>
              <div className="p-5 space-y-3">
                <h3 className="text-xl font-semibold text-white">{item.label}</h3>
                <p className="text-sm text-gray-300 leading-relaxed">{item.summary}</p>
                <span className="text-sm font-semibold text-amber-300 group-hover:text-amber-200 transition-colors">
                  View details →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
