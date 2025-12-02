import Link from 'next/link';

type BlogArticle = {
  id: string | number;
  slug: string;
  title: string;
  summary: string;
  body: string | null;
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
    body:
      'Monitorizăm zborurile în timp real, ținem șoferii aproape de terminal și confirmăm contactul & plăcuța pentru preluare rapidă.',
    hero_image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1400&q=80',
    tag: 'Corporate',
    published_at: '2025-12-01'
  },
  {
    id: 'seed-winter-london-routes',
    title: 'Iarna în Londra: rute, timing și confort',
    slug: 'winter-london-routes',
    summary: 'Rute alternative, ferestre de timp realiste și confort termic pentru serile reci.',
    body:
      'Ocolim aglomerația din West End în weekend, adăugăm buffer pentru vreme și pregătim cabinele cu căldură, apă și pături.',
    hero_image: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1400&q=80',
    tag: 'City Guides',
    published_at: '2025-12-01'
  },
  {
    id: 'seed-dispatch-automation',
    title: 'Cum automatizăm dispatch-ul la Velvet',
    slug: 'dispatch-automation',
    summary: 'Pipeline de alocare șofer + notificări și audit trail din events/notifications.',
    body:
      'Fiecare booking creează un event cu event_id, notificările au fan-out către destinatari, iar alocările șoferilor sunt auditate.',
    hero_image: 'https://images.unsplash.com/photo-1473181488821-2d23949a045a?auto=format&fit=crop&w=1400&q=80',
    tag: 'Product',
    published_at: '2025-12-01'
  }
];

async function fetchArticles(): Promise<BlogArticle[]> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  try {
    const resp = await fetch(`${base}/api/blog-posts`, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = (await resp.json()) as BlogArticle[];
    return data.length ? data : fallbackArticles;
  } catch {
    return fallbackArticles;
  }
}

export default async function BlogArticlePage({ params }: { params: { slug: string } }) {
  const articles = await fetchArticles();
  const article = articles.find((a) => a.slug === params.slug);

  if (!article) {
    return (
      <main className="flex flex-col items-center px-4 sm:px-6 md:px-8 py-16 bg-black text-white min-h-screen">
        <div className="max-w-4xl w-full text-center space-y-4">
          <h1 className="text-3xl font-bold text-white">Article not found</h1>
          <Link
            href="/blog"
            className="inline-flex px-6 py-3 rounded-md border border-amber-400 text-amber-300 hover:bg-amber-400 hover:text-black transition-colors"
          >
            Back to Blog
          </Link>
        </div>
      </main>
    );
  }

  const paragraphs = article.body
    ? (() => {
        try {
          const parsed = JSON.parse(article.body);
          if (Array.isArray(parsed)) return parsed.map((p) => String(p));
          return [String(article.body)];
        } catch {
          return [article.body];
        }
      })()
    : [];

  return (
    <main className="flex flex-col items-center px-4 sm:px-6 md:px-8 py-16 bg-black text-white min-h-screen">
      <div className="max-w-4xl w-full space-y-8">
        <div className="space-y-2">
          <Link href="/blog" className="text-sm text-amber-300 hover:text-amber-200">
            ← Back to Blog
          </Link>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">
            {article.published_at
              ? new Date(article.published_at).toLocaleDateString('en-GB', {
                  month: 'short',
                  day: '2-digit',
                  year: 'numeric',
                })
              : ''}{' '}
            · {article.tag || 'News'}
          </p>
          <h1 className="text-4xl md:text-5xl font-bold font-display text-white">{article.title}</h1>
        </div>
        <div className="rounded-3xl overflow-hidden border border-white/10 shadow-xl shadow-black/30">
          <img
            src={article.hero_image || 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1400&q=80'}
            alt={article.title}
            className="w-full h-[360px] object-cover"
          />
        </div>
        <div className="space-y-4 text-gray-200 leading-relaxed">
          {paragraphs.length > 0 ? (
            paragraphs.map((paragraph, index) => (
              <p key={index} className="text-lg text-gray-200/90">
                {paragraph}
              </p>
            ))
          ) : (
            <p className="text-gray-400 text-sm">No content available for this article.</p>
          )}
        </div>
        <div className="pt-4">
          <Link
            href="/booking"
            className="px-8 py-3 text-lg font-semibold bg-amber-500 text-black rounded-md hover:bg-amber-400 transition-all duration-300 transform hover:scale-105 shadow-[0_0_15px_rgba(251,191,36,0.5)]"
          >
            Book a Journey
          </Link>
        </div>
      </div>
    </main>
  );
}
