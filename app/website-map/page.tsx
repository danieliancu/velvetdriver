import Link from 'next/link';
import PageShell from '@/components/PageShell';

interface SitemapSection {
  title: string;
  description: string;
  links: { label: string; to: string; note?: string }[];
}

const sitemapSections: SitemapSection[] = [
  {
    title: 'Discover',
    description: 'Learn more about the Velvet experience and keep up with updates.',
    links: [
      { label: 'Home', to: '/' },
      { label: 'Our Blog', to: '/blog' },
      { label: 'Client Reviews', to: '/reviews' },
      { label: 'Contact', to: '/contact' },
      { label: 'Sitemap', to: '/website-map', note: 'You are here' },
    ],
  },
  {
    title: 'Book & Manage',
    description: 'Start a new journey or access your account to manage bookings.',
    links: [
      { label: 'Book a Journey', to: '/booking' },
      { label: 'Older Bookings', to: '/older-bookings' },
      { label: 'Client Login', to: '/client/login' },
      { label: 'Driver Login', to: '/driver/login' },
      { label: 'Corporate Login', to: '/corporate/login' },
    ],
  },
  {
    title: 'Drivers & Partners',
    description: 'Resources for professional drivers and corporate partners.',
    links: [
      { label: 'Driver Hub', to: '/driver-hub' },
      { label: 'Driver Sign Up', to: '/driver/signup' },
      { label: 'Corporate Sign Up', to: '/corporate/signup' },
      { label: 'Corporate Dashboard', to: '/corporate/dashboard', note: 'Requires login' },
      { label: 'Corporate Terms', to: '/corporate-terms' },
    ],
  },
  {
    title: 'Policies & Safety',
    description: 'All legal, safety, and compliance information in one place.',
    links: [
      { label: 'Operator Policies', to: '/legal/operator-policies' },
      { label: 'Passenger Policies', to: '/legal/passenger-policies' },
      { label: 'Safety & Accessibility', to: '/legal/safety-accessibility' },
      { label: 'Driver Terms', to: '/legal/driver-terms' },
      { label: 'Privacy & Data', to: '/legal/privacy-data' },
      { label: 'Corporate Payment Policy', to: '/corporate-payment-policy' },
      { label: 'Terms of Service', to: '/terms-of-service' },
      { label: 'Cookie Policy', to: '/cookie-policy' },
    ],
  },
];

export default function WebsiteMapPage() {
  return (
    <PageShell mainClassName="pt-28 pb-16">
      <div className="max-w-6xl mx-auto space-y-10">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.3em] text-amber-300/70">Navigate</p>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white">Sitemap</h1>
        </div>

        <div className="grid gap-6 grid-cols-1">
          {sitemapSections.map((section) => (
            <section key={section.title} className="p-0">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-display font-semibold text-amber-300">{section.title}</h2>
                  <p className="text-sm text-gray-400">{section.description}</p>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {section.links.map((link) => (
                  <Link
                    key={link.label}
                    href={link.to}
                    className="group flex items-center justify-between px-0 py-2 text-sm text-gray-200 hover:text-white transition-all border-b border-white/10"
                  >
                    <span className="flex flex-col">
                      {link.label}
                      {link.note && <span className="text-[11px] text-gray-400">{link.note}</span>}
                    </span>
                    <span className="text-amber-300 opacity-0 group-hover:opacity-100 transition-opacity">&#8594;</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
