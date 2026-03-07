'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminPageHeader from '@/components/AdminPageHeader';

type AdminBlogPost = {
  id: number;
  slug: string;
  title: string;
  summary: string | null;
  body: string | null;
  hero_image: string | null;
  tag: string | null;
  published_at: string | null;
};

const toInputDateTime = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
};

const getNowInputDateTime = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(
    now.getMinutes()
  )}`;
};

const AdminBlogPage = () => {
  const [posts, setPosts] = useState<AdminBlogPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [imageUploadSuccess, setImageUploadSuccess] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [tag, setTag] = useState('');
  const [heroImage, setHeroImage] = useState('');
  const [publishedAt, setPublishedAt] = useState(getNowInputDateTime());
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');

  const isValid = useMemo(() => title.trim().length > 0, [title]);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setSlug('');
    setTag('');
    setHeroImage('');
    setPublishedAt(getNowInputDateTime());
    setSummary('');
    setBody('');
    setImageUploadError(null);
    setImageUploadSuccess(null);
  };

  const loadPosts = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/blog-posts', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to load blog posts');
      const data = await response.json();
      setPosts(Array.isArray(data?.posts) ? data.posts : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const handleSave = async () => {
    if (!isValid) return;

    setError(null);

    try {
      const method = editingId ? 'PUT' : 'POST';
      const response = await fetch('/api/admin/blog-posts', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingId,
          title: title.trim(),
          slug: slug.trim() || null,
          tag: tag.trim() || null,
          hero_image: heroImage.trim() || null,
          published_at: publishedAt ? new Date(publishedAt).toISOString() : null,
          summary: summary.trim() || null,
          body: body.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to save blog post');
      }

      await loadPosts();
      resetForm();
    } catch (err: any) {
      setError(err?.message || 'Failed to save blog post');
    }
  };

  const handleEdit = (post: AdminBlogPost) => {
    setEditingId(post.id);
    setTitle(post.title || '');
    setSlug(post.slug || '');
    setTag(post.tag || '');
    setHeroImage(post.hero_image || '');
    setPublishedAt(toInputDateTime(post.published_at));
    setSummary(post.summary || '');
    setBody(post.body || '');
    setImageUploadError(null);
    setImageUploadSuccess(null);
  };

  const handleImageUpload = async (file: File | null) => {
    if (!file) return;

    setImageUploading(true);
    setImageUploadError(null);
    setImageUploadSuccess(null);

    try {
      const payload = new FormData();
      payload.append('file', file);
      if (editingId) {
        payload.append('postId', String(editingId));
      }
      if (slug.trim()) {
        payload.append('slug', slug.trim());
      }

      const response = await fetch('/api/admin/blog/photo', {
        method: 'POST',
        body: payload,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to upload blog image');
      }

      if (data?.url) {
        setHeroImage(String(data.url));
        setImageUploadSuccess('Image uploaded to Cloudinary successfully.');
        if (editingId) {
          await loadPosts();
        }
      }
    } catch (err: any) {
      setImageUploadError(err?.message || 'Failed to upload blog image');
    } finally {
      setImageUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    const post = posts.find((entry) => entry.id === id);
    const shouldDelete = window.confirm(`Delete blog post "${post?.title || 'Untitled'}"?`);
    if (!shouldDelete) return;

    setActionBusyId(id);
    setError(null);

    try {
      const response = await fetch(`/api/admin/blog-posts?id=${id}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to delete blog post');
      }

      setPosts((current) => current.filter((entry) => entry.id !== id));
      if (editingId === id) resetForm();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete blog post');
    } finally {
      setActionBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="w-full flex-grow p-4 sm:p-6 md:p-8">
        <div className="max-w-6xl mx-auto w-full space-y-8">
          <AdminPageHeader active="blog" />

          <section className="rounded-2xl border border-white/10 bg-black/60 p-6 space-y-6 shadow-lg shadow-black/50">
            <div>
              <h2 className="text-xl font-semibold text-white">Blog Manager</h2>
              <p className="text-sm text-gray-400">Create, edit and delete posts shown on /blog.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Title</label>
                <input
                  className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Article title"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Slug (optional)</label>
                <input
                  className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="airport-playbook"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Tag</label>
                <input
                  className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                  placeholder="Corporate"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Publish Date</label>
                <input
                  type="datetime-local"
                  className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={publishedAt}
                  onChange={(e) => setPublishedAt(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Hero Image URL</label>
              <input
                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                value={heroImage}
                onChange={(e) => setHeroImage(e.target.value)}
                placeholder="https://..."
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs text-white hover:border-amber-400 transition cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const pickedFile = event.target.files?.[0] ?? null;
                      event.target.value = '';
                      handleImageUpload(pickedFile);
                    }}
                  />
                  {imageUploading ? 'Uploading...' : 'Upload image'}
                </label>
                {heroImage ? (
                  <span className="text-xs text-gray-400 truncate max-w-[260px]">Cover image selected</span>
                ) : (
                  <span className="text-xs text-gray-500">No image selected.</span>
                )}
              </div>
              {imageUploadError ? <p className="mt-2 text-xs text-red-300">{imageUploadError}</p> : null}
              {imageUploadSuccess ? <p className="mt-2 text-xs text-emerald-300">{imageUploadSuccess}</p> : null}
              {heroImage ? (
                <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                  <img src={heroImage} alt={title || 'Blog cover'} className="h-44 w-full object-cover" />
                </div>
              ) : null}
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Summary</label>
              <textarea
                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500 min-h-[90px]"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Short summary shown in blog listing"
              />
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Body</label>
              <textarea
                className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500 min-h-[180px]"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Article content"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={!isValid}
                className="rounded-lg border border-amber-400 bg-amber-400 px-4 py-2 text-sm font-semibold text-black shadow-[0_0_15px_rgba(251,191,36,0.35)] hover:shadow-[0_0_25px_rgba(251,191,36,0.55)] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingId ? 'Update Post' : 'Create Post'}
              </button>

              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-gray-200 hover:bg-white/5"
                >
                  Cancel Edit
                </button>
              ) : null}
            </div>

            {error ? (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div className="space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-300">Existing posts</h3>
              <div className="space-y-2">
                {loading ? (
                  <p className="text-sm text-gray-400">Loading...</p>
                ) : posts.length ? (
                  posts.map((post) => (
                    <div
                      key={post.id}
                      className="rounded-xl border border-amber-900/40 bg-gradient-to-r from-[#1A0B0B] via-[#0F0909] to-black px-4 py-3 text-sm text-white"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        {post.hero_image ? (
                          <img
                            src={post.hero_image}
                            alt={post.title}
                            className="h-12 w-16 rounded-lg border border-white/10 object-cover"
                          />
                        ) : (
                          <div className="h-12 w-16 rounded-lg border border-white/10 bg-gradient-to-br from-neutral-800 to-neutral-950" />
                        )}
                        <span className="font-semibold text-amber-200">{post.title}</span>
                        <span className="text-gray-400">/{post.slug}</span>
                        <span className="ml-auto text-gray-400">
                          {post.published_at
                            ? new Date(post.published_at).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })
                            : 'Unscheduled'}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {post.tag ? (
                          <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-[11px] uppercase tracking-wide text-amber-300">
                            {post.tag}
                          </span>
                        ) : null}
                        <a
                          href={`/blog/${post.slug}`}
                          target="_blank"
                          className="rounded-full border border-white/20 px-3 py-1 text-[11px] uppercase tracking-wide text-gray-200 hover:bg-white/5"
                          rel="noreferrer"
                        >
                          View
                        </a>
                        <button
                          type="button"
                          onClick={() => handleEdit(post)}
                          className="rounded-full border border-amber-400/70 px-3 py-1 text-[11px] uppercase tracking-wide text-amber-200 hover:bg-amber-500/10"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(post.id)}
                          disabled={actionBusyId === post.id}
                          className="rounded-full border border-red-500/70 px-3 py-1 text-[11px] uppercase tracking-wide text-red-200 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actionBusyId === post.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400">No posts yet.</p>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AdminBlogPage;
