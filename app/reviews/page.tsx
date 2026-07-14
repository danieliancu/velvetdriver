import PageShell from '@/components/PageShell';
import { Star } from 'lucide-react';
import { getDbPool, DbRow } from '@/lib/db';
import { ensureReviewsVisibleColumn } from '@/lib/client-reviews';

export const dynamic = 'force-dynamic';

type ReviewRow = DbRow<{
  id: number;
  reviewer_name: string | null;
  rating: number;
  review: string;
  created_at: string;
}>;

type Review = {
  id: number;
  name: string;
  date: string;
  rating: number;
  message: string;
};

const pool = getDbPool();

async function fetchReviews(): Promise<Review[]> {
  try {
    await ensureReviewsVisibleColumn(pool);
    const [rows] = await pool.query<ReviewRow[]>(
      `SELECT id, reviewer_name, rating, review, created_at
       FROM client_reviews
       WHERE visible = 1
       ORDER BY created_at DESC
       LIMIT 100`
    );
    return rows.map((row) => ({
      id: row.id,
      name: row.reviewer_name || 'Velvet client',
      date: new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(
        new Date(row.created_at)
      ),
      rating: row.rating,
      message: row.review,
    }));
  } catch {
    return [];
  }
}

const Stars = ({ count }: { count: number }) => (
  <div className="flex items-center gap-1 text-amber-400">
    {Array.from({ length: 5 }).map((_, idx) => (
      <Star key={idx} size={16} className={idx < count ? 'fill-amber-400' : 'text-gray-700'} />
    ))}
  </div>
);

export default async function ReviewsPage() {
  const reviews = await fetchReviews();

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

        {reviews.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reviews.map((review) => (
              <article
                key={review.id}
                className="rounded-2xl border border-white/10 bg-black/40 p-6 shadow-lg shadow-black/30"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{review.name}</p>
                    <p className="text-xs text-gray-400">{review.date}</p>
                  </div>
                  <Stars count={review.rating} />
                </div>
                <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-line">{review.message}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-10 text-center">
            <p className="text-lg text-white">No reviews yet.</p>
            <p className="mt-2 text-sm text-gray-400">Check back soon for feedback from our passengers.</p>
          </div>
        )}
      </div>
    </PageShell>
  );
}
