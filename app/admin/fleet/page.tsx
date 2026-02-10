'use client';

import { useEffect, useMemo, useState } from 'react';
import AdminPageHeader from '@/components/AdminPageHeader';

type FleetType = {
  id: number;
  slug: string;
  label: string;
  summary: string | null;
  description: string | null;
  hero_image: string | null;
  features: string | null;
  sort_order: number | null;
  is_active: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type FleetFormState = {
  label: string;
  slug: string;
  summary: string;
  description: string;
  hero_image: string;
  features: string;
  sort_order: string;
  is_active: boolean;
};

const emptyForm: FleetFormState = {
  label: '',
  slug: '',
  summary: '',
  description: '',
  hero_image: '',
  features: '',
  sort_order: '0',
  is_active: true,
};

const AdminFleetPage = () => {
  const [items, setItems] = useState<FleetType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FleetFormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [heroUploading, setHeroUploading] = useState(false);
  const [heroUploadError, setHeroUploadError] = useState<string | null>(null);

  const loadFleet = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/fleet-types?includeInactive=1', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as FleetType[];
      setItems(data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load fleet types');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFleet();
  }, []);

  const isValid = useMemo(() => form.label.trim().length > 0, [form.label]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setHeroUploadError(null);
  };

  const handleEdit = (item: FleetType) => {
    setEditingId(item.id);
    setForm({
      label: item.label || '',
      slug: item.slug || '',
      summary: item.summary || '',
      description: item.description || '',
      hero_image: item.hero_image || '',
      features: item.features || '',
      sort_order: item.sort_order != null ? String(item.sort_order) : '0',
      is_active: Boolean(item.is_active),
    });
  };

  const handleDelete = async (id: number) => {
    const confirmed = window.confirm('Delete this fleet type?');
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/fleet-types?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (editingId === id) resetForm();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const payload = {
        id: editingId,
        label: form.label.trim(),
        slug: form.slug.trim() || undefined,
        summary: form.summary.trim() || null,
        description: form.description.trim() || null,
        hero_image: form.hero_image.trim() || null,
        features: form.features.trim() || null,
        sort_order: Number(form.sort_order || 0),
        is_active: form.is_active,
      };
      const res = await fetch('/api/fleet-types', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Save failed');
      }
      await loadFleet();
      resetForm();
    } catch (err: any) {
      setError(err?.message || 'Failed to save fleet type');
    } finally {
      setSaving(false);
    }
  };

  const handleHeroUpload = async (file: File | null) => {
    if (!file) return;
    setHeroUploading(true);
    setHeroUploadError(null);
    try {
      const payload = new FormData();
      payload.append('file', file);
      if (editingId) {
        payload.append('fleetId', String(editingId));
      }
      if (form.slug.trim()) {
        payload.append('slug', form.slug.trim());
      }
      const res = await fetch('/api/admin/fleet/photo', {
        method: 'POST',
        body: payload,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to upload hero image');
      }
      setForm((prev) => ({ ...prev, hero_image: data?.url || prev.hero_image }));
    } catch (err: any) {
      setHeroUploadError(err?.message || 'Failed to upload hero image');
    } finally {
      setHeroUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="w-full flex-grow p-4 sm:p-6 md:p-8">
        <div className="max-w-6xl mx-auto w-full space-y-8">
          <AdminPageHeader active="fleet" />

          <section className="rounded-2xl border border-white/10 bg-black/60 p-6 space-y-6 shadow-lg shadow-black/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">Fleet Types</h2>
                <p className="text-sm text-gray-400">Manage vehicle classes displayed on the fleet page.</p>
              </div>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-white/20 px-3 py-2 text-sm text-white hover:border-amber-400 transition"
                >
                  Cancel edit
                </button>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Label</label>
                <input
                  className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={form.label}
                  onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
                  placeholder="Luxury"
                />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Slug (optional)</label>
                <input
                  className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={form.slug}
                  onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                  placeholder="luxury-mpv"
                />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Sort order</label>
                <input
                  type="number"
                  className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={form.sort_order}
                  onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))}
                  min="0"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Summary</label>
                <textarea
                  className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  rows={3}
                  value={form.summary}
                  onChange={(e) => setForm((prev) => ({ ...prev, summary: e.target.value }))}
                  placeholder="Short description for the card."
                />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Description</label>
                <textarea
                  className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Full page description."
                />
              </div>
              <div className="sm:col-span-1">
                <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Hero image URL</label>
                <input
                  className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  value={form.hero_image}
                  onChange={(e) => setForm((prev) => ({ ...prev, hero_image: e.target.value }))}
                  placeholder="https://images.unsplash.com/..."
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-xs text-white hover:border-amber-400 transition cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        event.target.value = '';
                        handleHeroUpload(file);
                      }}
                    />
                    {heroUploading ? 'Uploading...' : 'Upload image'}
                  </label>
                  {form.hero_image ? (
                    <span className="text-xs text-gray-400 truncate max-w-[220px]">Saved URL set</span>
                  ) : (
                    <span className="text-xs text-gray-500">No image uploaded yet.</span>
                  )}
                </div>
                {heroUploadError ? (
                  <p className="mt-2 text-xs text-red-300">{heroUploadError}</p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Highlights (one per line)</label>
                <textarea
                  className="w-full rounded-lg bg-black/40 border border-amber-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                  rows={3}
                  value={form.features}
                  onChange={(e) => setForm((prev) => ({ ...prev, features: e.target.value }))}
                  placeholder={`Heated leather interior\nPrivacy glass\nMeet & greet ready`}
                />
              </div>
              <div className="sm:col-span-1 flex flex-col justify-between">
                <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                    className="h-4 w-4 rounded border-white/20 bg-black/50 text-amber-400 focus:ring-amber-400"
                  />
                  Active
                </label>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!isValid || saving}
                  className="mt-4 w-full rounded-lg border border-amber-400 bg-amber-400 px-3 py-2 text-sm font-semibold text-black shadow-[0_0_15px_rgba(251,191,36,0.35)] hover:shadow-[0_0_25px_rgba(251,191,36,0.55)] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingId ? 'Update' : 'Save'}
                </button>
              </div>
            </div>
          </section>

          <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">Existing fleet types</h3>
                <p className="text-sm text-gray-400">Click edit to update a card.</p>
              </div>
            </div>

            {error ? (
              <div className="rounded-lg border border-red-500/50 bg-red-950/40 text-red-200 px-4 py-3 text-sm">
                {error}
              </div>
            ) : null}
            {loading ? <div className="text-sm text-gray-400">Loading fleet types...</div> : null}

            <div className="grid gap-3 md:grid-cols-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/40 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm uppercase tracking-[0.25em] text-amber-300">
                        {item.is_active ? 'Active' : 'Hidden'}
                      </p>
                      <h4 className="text-xl font-semibold text-white">{item.label}</h4>
                      <p className="text-xs text-gray-400">/{item.slug}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        className="rounded-full border border-white/20 px-3 py-1 text-xs text-white hover:border-amber-400 transition"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        className="rounded-full border border-red-500/40 px-3 py-1 text-xs text-red-200 hover:border-red-400 transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-300">{item.summary || 'No summary added yet.'}</p>
                </div>
              ))}
              {!loading && items.length === 0 ? (
                <div className="text-sm text-gray-400">No fleet types found.</div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AdminFleetPage;
