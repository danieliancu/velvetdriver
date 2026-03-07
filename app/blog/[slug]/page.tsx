import Link from 'next/link';
import { getDbPool } from '@/lib/db';
import { ensureBlogPostsTable, type BlogPostRow } from '@/lib/blog-posts';

export const dynamic = 'force-dynamic';

type BlogArticle = {
  id: string | number;
  slug: string;
  title: string;
  summary: string | null;
  body: string | null;
  hero_image: string | null;
  tag: string | null;
  published_at: string | null;
};

const pool = getDbPool();

async function fetchArticleBySlug(slug: string): Promise<BlogArticle | null> {
  try {
    await ensureBlogPostsTable(pool);
    const [rows] = await pool.query<BlogPostRow[]>(
      `SELECT id, slug, title, summary, body, hero_image, tag, published_at
       FROM blog_posts
       WHERE slug = ?
       LIMIT 1`,
      [slug]
    );
    return rows.length ? (rows[0] as unknown as BlogArticle) : null;
  } catch {
    return null;
  }
}

export default async function BlogArticlePage({ params }: { params: { slug: string } }) {
  const article = await fetchArticleBySlug(params.slug);

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
          if (Array.isArray(parsed)) return parsed.map((paragraph) => String(paragraph));
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
            &lt;- Back to Blog
          </Link>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">
            {article.published_at
              ? new Date(article.published_at).toLocaleDateString('en-GB', {
                  month: 'short',
                  day: '2-digit',
                  year: 'numeric',
                })
              : ''}{' '}
            - {article.tag || 'News'}
          </p>
          <h1 className="text-4xl md:text-5xl font-bold font-display text-white">{article.title}</h1>
        </div>
        <div className="rounded-3xl overflow-hidden border border-white/10 shadow-xl shadow-black/30">
          {article.hero_image ? (
            <img src={article.hero_image} alt={article.title} className="w-full h-[360px] object-cover" />
          ) : (
            <div className="w-full h-[360px] bg-gradient-to-br from-neutral-800 to-neutral-950" />
          )}
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
