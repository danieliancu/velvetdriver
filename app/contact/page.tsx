import PageShell from '@/components/PageShell';
import { Mail, Phone } from 'lucide-react';

const contactChannels = [
  {
    title: 'General Enquiries',
    detail: 'info@velvetdrivers.co.uk',
    description: 'Send us an email and we will reply within 24 hours.',
    icon: Mail,
  },
  {
    title: 'Operations Desk',
    detail: '+40 2081 759 186',
    description: 'Contact an expert from our team',
    icon: Phone,
  },
];

export default function ContactPage() {
  return (
    <PageShell mainClassName="flex flex-col px-4 sm:px-6 lg:px-8 py-16">
      <div className="w-full max-w-4xl mx-auto space-y-10">
        <div>
          <p className="text-sm uppercase tracking-wider text-gray-400">Reach out</p>
          <h1 className="text-4xl font-display font-bold text-amber-400">Contact Velvet Drivers</h1>
          <p className="mt-3 text-lg text-gray-300">
            Our team is available around the clock to coordinate journeys, changes or bespoke requests.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {contactChannels.map((channel) => {
            const Icon = channel.icon;
            return (
              <div key={channel.title} className="rounded-2xl border border-white/10 bg-black/30 p-6 space-y-3 shadow-2xl shadow-black/60">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-300">
                  <Icon size={20} />
                </div>
                <h3 className="text-lg font-semibold text-white">{channel.title}</h3>
                <p className="text-sm text-gray-400">{channel.description}</p>
                <p className="text-sm font-semibold text-gray-100">{channel.detail}</p>
              </div>
            );
          })}
        </div>
      </div>
    </PageShell>
  );
}
