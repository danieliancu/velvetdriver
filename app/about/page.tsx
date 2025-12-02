import PageShell from '@/components/PageShell';

export default function AboutUsPage() {
  return (
    <PageShell mainClassName="pt-28 pb-16">
      <div className="max-w-4xl mx-auto space-y-8 text-gray-200">
        <header className="space-y-2">
          <p className="text-sm uppercase tracking-[0.3em] text-amber-300/70">About</p>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-white">About Us</h1>
          <p className="text-lg text-gray-300">The Velvet Signature Service - crafted so every mile feels like comfort.</p>
        </header>

        <div className="space-y-6 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur">
          <p>
            At Velvet Drivers, every journey begins long before you step into the car. It starts with a promise - a promise of comfort, elegance, and a
            service that feels effortless.
          </p>
          <p>We believe the road should never feel rushed or stressful. It should glide. It should flow. It should feel like velvet.</p>
          <p>
            Our fleet is chosen not just for its prestige, but for the feeling it gives you the moment the door closes behind you - the quiet, the
            calm, the comfort. From the refined presence of the Mercedes S-Class, to the spacious warmth of the V-Class, every vehicle carries the signature of luxury.
          </p>
          <p>
            But what truly defines us is not the car - it is the care. The way your driver greets you. The way your journey is prepared with precision.
            The way you feel safe, respected, and looked after from start to finish.
          </p>
          <p>
            We operate with integrity, discretion, and a commitment to excellence in every detail. Because to us, you are not just a passenger - you are
            our guest.
          </p>
          <p>
            Velvet Drivers Limited is more than a chauffeur service. It is an experience crafted with heart, care, and a genuine desire to make
            every journey smoother, calmer, and more personal.
          </p>
          <p>This is the Velvet Signature Service - where luxury meets emotion, and every mile feels like comfort.</p>
        </div>
      </div>
    </PageShell>
  );
}
