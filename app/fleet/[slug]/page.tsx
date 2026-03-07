import Link from 'next/link';
import { notFound } from 'next/navigation';
import PageShell from '@/components/PageShell';
import { getFleetDisplayImages } from '@/lib/fleet-gallery';
import { getPublicFleetTypes } from '@/lib/fleet-types';

const parseFeatures = (value?: string | null) =>
  (value || '')
    .split(/\r?\n|,/g)
    .map((feature) => feature.trim())
    .filter(Boolean);

export default async function FleetDetailPage({ params }: { params: { slug: string } }) {
  const fleet = await getPublicFleetTypes();
  const item = fleet.find((entry) => entry.slug === params.slug);

  if (!item) {
    notFound();
  }

  const features = parseFeatures(item.features);
  const images = getFleetDisplayImages(item.hero_image, item.gallery_images);
  const [primaryImage, ...secondaryImages] = images;

  return (
    <PageShell mainClassName="flex flex-col items-center px-4 sm:px-6 md:px-8 py-16 bg-black text-white min-h-screen">
      <div className="max-w-5xl w-full space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Link href="/fleet" className="text-sm font-semibold text-amber-300 hover:text-amber-200">
            {'<-'} Back to fleet
          </Link>
          <Link
            href="/booking"
            className="rounded-full border border-amber-400 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-400 hover:text-black transition"
          >
            Book this vehicle
          </Link>
        </div>

        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.4em] text-amber-300">Fleet Class</p>
          <h1 className="text-4xl md:text-5xl font-bold font-display text-white">{item.label}</h1>
          <p className="text-gray-300 max-w-2xl">{item.summary}</p>
        </header>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/40">
          <img
            src={primaryImage || 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1400&q=80'}
            alt={item.label}
            className="w-full h-[360px] object-cover"
          />
        </div>

        {secondaryImages.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {secondaryImages.map((imageUrl) => (
              <div key={imageUrl} className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                <img src={imageUrl} alt={item.label} className="h-48 w-full object-cover" />
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6 space-y-4">
            <h2 className="text-xl font-semibold text-white">Overview</h2>
            <p className="text-sm text-gray-300 leading-relaxed">
              {item.description || 'A refined cabin experience with tailored amenities and calm, professional driving.'}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/40 p-6 space-y-4">
            <h2 className="text-xl font-semibold text-white">Highlights</h2>
            {features.length ? (
              <ul className="space-y-2 text-sm text-gray-300">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="mt-1 h-2 w-2 rounded-full bg-amber-400" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">Premium amenities tailored to your itinerary.</p>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
