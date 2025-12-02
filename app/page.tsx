import Link from 'next/link';
import { Car, FileText, Star, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import PageShell from '@/components/PageShell';

const FeatureCard = ({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) => (
  <div className="bg-black/20 border border-white/10 rounded-xl p-6 backdrop-blur-sm transform hover:scale-105 hover:border-amber-400/50 transition-all duration-300 ease-in-out">
    <div className="flex items-center gap-4 mb-3">
      <div className="text-amber-400">{icon}</div>
      <h3 className="text-xl font-semibold font-display tracking-wide">{title}</h3>
    </div>
    <p className="text-gray-300 text-sm leading-relaxed">{children}</p>
  </div>
);

export default function HomePage() {
  return (
    <PageShell
      decorations={
        <div className="absolute top-1/2 left-1/2 w-[50vw] h-[50vh] bg-red-900/50 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
      }
      mainClassName="flex flex-col items-center justify-center gap-20 pt-32 pb-16"
    >
      <div className="relative z-10 text-center">
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold font-display tracking-tight text-shadow-lg">
          Experience the Velvet Signature Service
        </h1>
        <p className="mt-6 text-lg md:text-xl text-gray-300">
          Unparalleled luxury and professionalism. Your journey, our passion.
        </p>
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/client/login"
            className="w-full sm:w-48 px-8 py-3 text-lg font-semibold bg-transparent border-2 border-amber-400 text-amber-400 rounded-md hover:bg-amber-400 hover:text-black transition-all duration-300 transform hover:scale-105 shadow-[0_0_15px_rgba(251,191,36,0.5)] text-center"
          >
            Client
          </Link>
          <Link
            href="/driver/login"
            className="w-full sm:w-48 px-8 py-3 text-lg font-semibold bg-white/10 border-2 border-white/50 text-white rounded-md hover:bg-white hover:text-black transition-all duration-300 transform hover:scale-105 text-center"
          >
            Driver
          </Link>
          <Link
            href="/corporate/login"
            className="w-full sm:w-48 px-8 py-3 text-lg font-semibold bg-white/10 border-2 border-white/50 text-white rounded-md hover:bg-white hover:text-black transition-all duration-300 transform hover:scale-105 text-center"
          >
            Corporate
          </Link>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard icon={<Car size={28} />} title="Luxury Fleet">
            Travel in style with our premium selection of high-end vehicles, ensuring comfort and elegance.
          </FeatureCard>
          <FeatureCard icon={<FileText size={28} />} title="Our Blog">
            Latest stories on luxury travel, company news, and insider tips.{' '}
            <Link href="/blog" className="text-amber-400 underline underline-offset-4">
              See more
            </Link>
          </FeatureCard>
          <FeatureCard icon={<Star size={28} />} title="Client Reviews">
            Hear directly from our passengers about their Velvet journeys.{' '}
            <Link href="/reviews" className="text-amber-400 underline underline-offset-4">
              See more
            </Link>
          </FeatureCard>
          <FeatureCard icon={<Sparkles size={28} />} title="Bespoke Service">
            Tailored experiences to meet your specific needs, whether for business or special occasions.
          </FeatureCard>
        </div>
      </div>
    </PageShell>
  );
}
