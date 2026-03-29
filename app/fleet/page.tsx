import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { getFleetDisplayImages } from '@/lib/fleet-gallery';
import { getPublicFleetTypes } from '@/lib/fleet-types';

export default async function FleetPage() {
  const fleet = await getPublicFleetTypes();

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

        {fleet.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-8 text-center text-gray-300">
            No fleet types are currently available.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {fleet.map((item) => (
              (() => {
                const images = getFleetDisplayImages(item.hero_image, item.gallery_images);
                const primaryImage = images[0] || 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80';
                const secondaryImages = images.slice(1, 4);

                return (
                  <Link
                    href={`/fleet/${item.slug}`}
                    key={item.slug}
                    className="group rounded-2xl overflow-hidden border border-white/10 bg-black/40 shadow-lg shadow-black/30 hover:border-amber-400/50 transition-all"
                  >
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={primaryImage}
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
                        View details {'>'}
                      </span>
                    </div>
                  </Link>
                );
              })()
            ))}
          </div>
        )}
      </div>
    </PageShell>
  );
}
