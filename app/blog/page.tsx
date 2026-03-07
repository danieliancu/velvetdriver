import Link from 'next/link';
import PageShell from '@/components/PageShell';
import { getDbPool } from '@/lib/db';
import { ensureBlogPostsTable, type BlogPostRow } from '@/lib/blog-posts';

export const dynamic = 'force-dynamic';

type BlogArticle = {
  id: string | number;
  slug: string;
  title: string;
  summary: string | null;
  hero_image: string | null;
  tag: string | null;
  published_at: string | null;
};

const pool = getDbPool();

async function fetchArticles(): Promise<BlogArticle[]> {
  try {
    await ensureBlogPostsTable(pool);
    const [rows] = await pool.query<BlogPostRow[]>(
      `SELECT id, slug, title, summary, hero_image, tag, published_at, created_at
       FROM blog_posts
       ORDER BY COALESCE(published_at, created_at) DESC, id DESC`
    );
    return rows as unknown as BlogArticle[];
  } catch {
    return [];
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

        {articles.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map((article) => (
              <Link
                href={`/blog/${article.slug}`}
                key={article.slug}
                className="group rounded-2xl overflow-hidden border border-white/10 bg-black/40 shadow-lg shadow-black/30 hover:border-amber-400/50 transition-all"
              >
                <div className="relative h-48 overflow-hidden">
                  {article.hero_image ? (
                    <img
                      src={article.hero_image}
                      alt={article.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-neutral-800 to-neutral-950" />
                  )}
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
                  <p className="text-sm text-gray-300 leading-relaxed">{article.summary || 'No summary available.'}</p>
                  <span className="text-sm font-semibold text-amber-300 group-hover:text-amber-200 transition-colors">
                    Read article -&gt;
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-10 text-center">
            <p className="text-lg text-white">No blog posts published yet.</p>
            <p className="mt-2 text-sm text-gray-400">Add the first article from Admin -&gt; Blog.</p>
          </div>
        )}
      </div>
    </PageShell>
  );
}
