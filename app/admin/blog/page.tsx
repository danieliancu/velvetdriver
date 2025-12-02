'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AdminPageHeader from '@/components/AdminPageHeader';

type AdminBlogPost = {
  id: number | string;
  subtitle: string;
  title: string;
  slug: string;
  image: string;
  summary: string;
  content: string;
  status: 'Published' | 'Draft';
  date: string;
};

// Fallback seeds if API fails
const seedPosts: AdminBlogPost[] = [
  {
    id: 'seed-velvet-airport-playbook',
    title: 'Airport Playbook: Heathrow, Gatwick, City',
    subtitle: 'Corporate',
    slug: 'velvet-airport-playbook',
    summary: 'Cum gestionăm întârzieri de zbor, Wi‑Fi la bord și pickup-uri rapide.',
    image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80',
    status: 'Published',
    content: 'Monitorizăm zborurile, ținem șoferii aproape de terminal și confirmăm contactul & plăcuța.',
    date: '2025-12-01',
  },
  {
    id: 'seed-winter-london-routes',
    title: 'Iarna în Londra: rute, timing și confort',
    subtitle: 'City Guides',
    slug: 'winter-london-routes',
    summary: 'Rute alternative, ferestre de timp realiste și confort termic pentru serile reci.',
    image: 'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1200&q=80',
    status: 'Published',
    content: 'Ocolim aglomerația, adăugăm buffer pentru vreme și pregătim cabinele.',
    date: '2025-12-01',
  },
  {
    id: 'seed-dispatch-automation',
    title: 'Cum automatizăm dispatch-ul la Velvet',
    subtitle: 'Product',
    slug: 'dispatch-automation',
    summary: 'Pipeline de alocare șofer + notificări și audit trail din events/notifications.',
    image: 'https://images.unsplash.com/photo-1473181488821-2d23949a045a?auto=format&fit=crop&w=1200&q=80',
    status: 'Published',
    content: 'Fiecare booking creează un event, notificările au event_id și fan-out către destinatari.',
    date: '2025-12-01',
  },
];

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || `post-${Date.now()}`;

const statusBadgeStyles: Record<AdminBlogPost['status'], string> = {
  Published: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30',
  Draft: 'bg-yellow-500/20 text-yellow-200 border-yellow-400/30',
};

type Tab = 'list' | 'new';

const AdminBlogPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('list');
  const [posts, setPosts] = useState<AdminBlogPost[]>(seedPosts);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [form, setForm] = useState<Omit<AdminBlogPost, 'id' | 'slug' | 'date'>>({
    subtitle: '',
    title: '',
    image: '',
    summary: '',
    content: '',
    status: 'Draft',
  });
  const [imageError, setImageError] = useState<string | null>(null);

  const editingPost = useMemo(() => posts.find((p) => p.id === editingId), [editingId, posts]);

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/blog-posts');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as Array<{
          id: number;
          slug: string;
          title: string;
          summary: string | null;
          body: string | null;
          hero_image: string | null;
          tag: string | null;
          published_at: string | null;
        }>;
        const mapped = data.map<AdminBlogPost>((item) => ({
          id: item.id,
          slug: item.slug || slugify(item.title ?? ''),
          title: item.title ?? 'Untitled',
          subtitle: item.tag ?? '',
          summary: item.summary ?? '',
          content: item.body ?? '',
          image: item.hero_image ?? '',
          status: item.published_at ? 'Published' : 'Draft',
          date: item.published_at ? item.published_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
        }));
        setPosts(mapped.length ? mapped : seedPosts);
      } catch (err) {
        console.error('Failed to load posts', err);
        setError('Nu am putut încărca postările din API. Afișăm fallback local.');
        setPosts(seedPosts);
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, []);

  const resetForm = () => {
    setForm({
      subtitle: '',
      title: '',
      image: '',
      summary: '',
      content: '',
      status: 'Draft',
    });
    setImageError(null);
    setEditingId(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setImageError('Max 2MB, PNG/JPG only.');
      return;
    }
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setImageError('Only PNG or JPG are allowed.');
      return;
    }
    setImageError(null);
    const url = URL.createObjectURL(file);
    setForm((prev) => ({ ...prev, image: url }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    setError(null);
    const payload = {
      title: form.title,
      slug: slugify(form.title),
      summary: form.summary,
      body: form.content,
      hero_image: form.image,
      tag: form.subtitle,
      published_at: form.status === 'Published' ? new Date().toISOString().slice(0, 10) : null,
    };
    try {
      if (editingPost) {
        const res = await fetch('/api/blog-posts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingPost.id, ...payload }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setPosts((prev) =>
          prev.map((p) =>
            p.id === editingPost.id
              ? {
                  ...p,
                  ...form,
                  slug: payload.slug,
                  date: payload.published_at ?? p.date,
                }
              : p
          )
        );
      } else {
        const res = await fetch('/api/blog-posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { id: number; slug: string };
        setPosts((prev) => [
          {
            id: data.id,
            slug: data.slug,
            date: payload.published_at ?? new Date().toISOString().slice(0, 10),
            ...form,
          },
          ...prev,
        ]);
      }
      resetForm();
      setTab('list');
    } catch (err) {
      console.error('Failed to save post', err);
      setError('Failed to save post to database.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (post: AdminBlogPost) => {
    setEditingId(post.id);
    setForm({
      subtitle: post.subtitle,
      title: post.title,
      image: post.image,
      summary: post.summary,
      content: post.content,
      status: post.status,
    });
    setTab('new');
  };

  const handleDelete = async (id: number | string) => {
    setError(null);
    try {
      const res = await fetch(`/api/blog-posts?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      if (editingId === id) resetForm();
    } catch (err) {
      console.error('Failed to delete post', err);
      setError('Failed to delete post.');
    }
  };

  const toggleStatus = async (post: AdminBlogPost) => {
    const nextStatus = post.status === 'Published' ? 'Draft' : 'Published';
    try {
      const res = await fetch('/api/blog-posts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: post.id,
          title: post.title,
          slug: post.slug,
          summary: post.summary,
          body: post.content,
          hero_image: post.image,
          tag: post.subtitle,
          published_at: nextStatus === 'Published' ? post.date || new Date().toISOString().slice(0, 10) : null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, status: nextStatus } : p)));
    } catch (err) {
      console.error('Failed to update status', err);
      setError('Failed to update status.');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="w-full flex-grow p-4 sm:p-6 md:p-8">
        <div className="max-w-6xl mx-auto w-full space-y-8">
          <AdminPageHeader active="blog" />

          <div className="flex gap-3 flex-wrap">
            {(['list', 'new'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                  tab === t ? 'bg-amber-400 text-black' : 'bg-gray-800/60 text-amber-200 hover:bg-gray-700/70'
                }`}
              >
                {t === 'list' ? 'Manage Posts' : editingPost ? 'Edit Blog' : 'New Blog'}
              </button>
            ))}
          </div>

          {tab === 'list' && (
            <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-semibold text-white">Blog Manager</h1>
                  <p className="text-sm text-gray-400">Edit, publish, or delete existing posts.</p>
                  {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
                  {loading && <p className="text-xs text-amber-300 mt-1">Se încarcă postările din API...</p>}
                </div>
                <span className="text-sm text-amber-300 bg-amber-500/10 border border-amber-400/30 px-3 py-1 rounded-full">
                  {posts.length} posts
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-max text-left">
                  <thead className="bg-gray-800/60">
                    <tr>
                      <th className="p-3">Title</th>
                      <th className="p-3">Subtitle</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Date</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posts.map((post) => (
                      <tr key={post.id} className="border-t border-gray-800">
                        <td className="p-3">
                          <div className="font-semibold text-white">{post.title}</div>
                          <div className="text-xs text-gray-400">/{post.slug}</div>
                        </td>
                        <td className="p-3 text-sm text-gray-300">{post.subtitle || '-'}</td>
                        <td className="p-3">
                          <span
                            className={`text-xs font-semibold px-3 py-1 rounded-full border ${statusBadgeStyles[post.status]}`}
                          >
                            {post.status}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-gray-300">{post.date}</td>
                        <td className="p-3 text-right space-x-2">
                          <button
                            className="text-xs px-3 py-1 rounded-md bg-amber-500 text-black font-semibold hover:bg-amber-400 transition-colors"
                            onClick={() => handleEdit(post)}
                          >
                            Edit
                          </button>
                          <button
                            className="text-xs px-3 py-1 rounded-md bg-gray-800 text-amber-200 border border-gray-700 hover:bg-gray-700 transition-colors"
                            onClick={() => toggleStatus(post)}
                          >
                            {post.status === 'Published' ? 'Draft' : 'Publish'}
                          </button>
                          <button
                            className="text-xs px-3 py-1 rounded-md bg-red-600 text-white font-semibold hover:bg-red-500 transition-colors"
                            onClick={() => handleDelete(post.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'new' && (
            <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-white">{editingPost ? 'Edit Blog' : 'New Blog'}</h2>
                <p className="text-sm text-gray-400">
                  Subtitle, title, image (max 2MB, PNG/JPG) and body. Save to add it to the list.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-amber-200 uppercase tracking-wide">Subtitle</label>
                  <input
                    type="text"
                    value={form.subtitle}
                    onChange={(e) => setForm((prev) => ({ ...prev, subtitle: e.target.value }))}
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white focus:border-amber-400 focus:outline-none"
                    placeholder="Ex: Lifestyle, Corporate, City Guide"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-amber-200 uppercase tracking-wide">Title</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white focus:border-amber-400 focus:outline-none"
                    placeholder="Article title"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-amber-200 uppercase tracking-wide">Image (upload)</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleFileChange}
                    className="text-sm text-gray-300"
                  />
                  {imageError && <p className="text-xs text-red-400">{imageError}</p>}
                  {form.image && !imageError && (
                    <div className="relative h-28 rounded-lg overflow-hidden border border-white/10">
                      <img src={form.image} alt="preview" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        className="absolute top-2 right-2 text-xs bg-black/60 px-2 py-1 rounded-md"
                        onClick={() => setForm((prev) => ({ ...prev, image: '' }))}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-amber-200 uppercase tracking-wide">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as AdminBlogPost['status'] }))}
                    className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white focus:border-amber-400 focus:outline-none"
                  >
                    <option value="Draft">Draft</option>
                    <option value="Published">Publish</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-amber-200 uppercase tracking-wide">Summary (card)</label>
                <textarea
                  value={form.summary}
                  onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))}
                  rows={2}
                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white focus:border-amber-400 focus:outline-none"
                  placeholder="Short text that appears in the articles list."
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-amber-200 uppercase tracking-wide">Body</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                  rows={6}
                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-white focus:border-amber-400 focus:outline-none"
                  placeholder="Article body."
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-6 py-2 font-semibold bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-60"
                  disabled={!form.title.trim() || saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                {editingPost && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 text-sm font-semibold bg-gray-800 text-amber-200 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Cancel edit
                  </button>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminBlogPage;
