import PageShell from '@/components/PageShell';
import { Star } from 'lucide-react';

type Review = {
  name: string;
  date: string;
  rating: number;
  message: string;
};

const reviews: Review[] = [
  {
    name: 'Alice W.',
    date: '02 Mar 2025',
    rating: 5,
    message: 'Immaculate S-Class, early arrival, and a discreet, kind chauffeur. Best London transfer we have booked.',
  },
  {
    name: 'Daniel K.',
    date: '18 Feb 2025',
    rating: 4,
    message: 'Great communication from dispatch. Would love chilled water standard, otherwise flawless airport pickup.',
  },
  {
    name: 'Priya S.',
    date: '05 Feb 2025',
    rating: 5,
    message: 'Handled a three-stop itinerary smoothly. Appreciated the quiet route and help with luggage at each stop.',
  },
  {
    name: 'Tom H.',
    date: '26 Jan 2025',
    rating: 5,
    message: 'Driver knew the venue drop-off perfectly. Car spotless, felt unrushed even with traffic changes.',
  },
];

const Stars = ({ count }: { count: number }) => (
  <div className="flex items-center gap-1 text-amber-400">
    {Array.from({ length: 5 }).map((_, idx) => (
      <Star key={idx} size={16} className={idx < count ? 'fill-amber-400' : 'text-gray-700'} />
    ))}
  </div>
);

export default function ReviewsPage() {
  return (
    <PageShell mainClassName="flex flex-col items-center px-4 sm:px-6 md:px-8 py-16">
      <div className="max-w-5xl w-full space-y-8">
        <header className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-amber-300">Client Reviews</p>
          <h1 className="text-4xl md:text-5xl font-bold font-display text-white">Hear from our passengers</h1>
          <p className="text-gray-300 max-w-2xl mx-auto">
            A selection of recent feedback from Velvet travellers across airport transfers, events, and corporate journeys.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reviews.map((review) => (
            <article
              key={`${review.name}-${review.date}`}
              className="rounded-2xl border border-white/10 bg-black/40 p-6 shadow-lg shadow-black/30"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-white">{review.name}</p>
                  <p className="text-xs text-gray-400">{review.date}</p>
                </div>
                <Stars count={review.rating} />
              </div>
              <p className="text-sm text-gray-200 leading-relaxed">{review.message}</p>
            </article>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
