import Link from 'next/link';
import PageShell from '@/components/PageShell';

type BlogArticle = {
  id: string | number;
  slug: string;
  title: string;
  summary: string;
  hero_image: string | null;
  tag: string | null;
  published_at: string | null;
};

const fallbackArticles: BlogArticle[] = [
  {
    id: 'seed-velvet-airport-playbook',
    title: 'Airport Playbook: Heathrow, Gatwick, City',
    slug: 'velvet-airport-playbook',
    summary: 'Cum gestionăm întârzieri de zbor, Wi‑Fi la bord și pickup-uri rapide.',
    hero_image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80',
    tag: 'Corporate',
    published_at: '2025-12-01'
  },
  {
    id: 'seed-winter-london-routes',
    title: 'Iarna în Londra: rute, timing și confort',
    slug: 'winter-london-routes',
    summary: 'Rute alternative, ferestre de timp realiste și confort termic pentru serile reci.',
    hero_image: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80',
    tag: 'City Guides',
    published_at: '2025-12-01'
  },
  {
    id: 'seed-dispatch-automation',
    title: 'Cum automatizăm dispatch-ul la Velvet',
    slug: 'dispatch-automation',
    summary: 'Pipeline de alocare șofer + notificări și audit trail din events/notifications.',
    hero_image: 'https://images.unsplash.com/photo-1473181488821-2d23949a045a?auto=format&fit=crop&w=1200&q=80',
    tag: 'Product',
    published_at: '2025-12-01'
  }
];

async function fetchArticles(): Promise<BlogArticle[]> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  try {
    const resp = await fetch(`${base}/api/blog-posts`, { next: { revalidate: 60 } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = (await resp.json()) as BlogArticle[];
    return data.length ? data : fallbackArticles;
  } catch {
    return fallbackArticles;
  }
}

export default async function BlogPage() {
  const articles = await fetchArticles();

  return (
    <PageShell mainClassName="flex flex-col items-center px-4 sm:px-6 md:px-8 py-16 bg-black text-white min-h-screen">
      <div className="max-w-6xl w-full space-y-8">
        <header className="space-y-3 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-amber-300">Our Blog</p>
          <h1 className="text-4xl md:text-5xl font-bold font-display text-white">Latest from Velvet Drivers</h1>
          <p className="text-gray-300 max-w-2xl mx-auto">
            Stories on luxury travel, company news, and insider tips to make every journey effortless.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map((article) => (
            <Link
              href={`/blog/${article.slug}`}
              key={article.slug}
              className="group rounded-2xl overflow-hidden border border-white/10 bg-black/40 shadow-lg shadow-black/30 hover:border-amber-400/50 transition-all"
            >
              <div className="relative h-48 overflow-hidden">
                <img
                  src={article.hero_image || 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80'}
                  alt={article.title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <span className="absolute top-3 left-3 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-amber-300">
                  {article.tag || 'News'}
                </span>
              </div>
              <div className="p-5 space-y-3">
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">
                  {article.published_at
                    ? new Date(article.published_at).toLocaleDateString('en-GB', {
                        month: 'short',
                        day: '2-digit',
                        year: 'numeric',
                      })
                    : ''}
                </p>
                <h3 className="text-xl font-semibold text-white">{article.title}</h3>
                <p className="text-sm text-gray-300 leading-relaxed">{article.summary}</p>
                <span className="text-sm font-semibold text-amber-300 group-hover:text-amber-200 transition-colors">
                  Read article →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
