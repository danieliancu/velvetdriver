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
  gallery_images: string[];
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
  gallery_images: string[];
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
  gallery_images: [],
  features: '',
  sort_order: '0',
  is_active: true,
};

const fallbackFleetImage = 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1400&q=80';

const uniqueImages = (urls: string[]) =>
  Array.from(new Set(urls.map((url) => url.trim()).filter(Boolean)));

const AdminFleetPage = () => {
  const [items, setItems] = useState<FleetType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FleetFormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryUploadError, setGalleryUploadError] = useState<string | null>(null);

  const loadFleet = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/fleet-types?includeInactive=1', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as FleetType[];
      const nextItems = Array.isArray(data) ? data : [];
      setItems(nextItems);
      return nextItems;
    } catch (err: any) {
      setError(err?.message || 'Failed to load fleet types');
      setItems([]);
      return [] as FleetType[];
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
    setGalleryUploadError(null);
  };

  const handleEdit = (item: FleetType) => {
    setEditingId(item.id);
    setForm({
      label: item.label || '',
      slug: item.slug || '',
      summary: item.summary || '',
      description: item.description || '',
      hero_image: item.hero_image || '',
      gallery_images: item.gallery_images || [],
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
        gallery_images: form.gallery_images,
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
      const refreshed = await loadFleet();
      if (editingId) {
        const updated = refreshed.find((item) => item.id === editingId);
        if (updated) {
          handleEdit(updated);
        } else {
          resetForm();
        }
      } else {
        resetForm();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to save fleet type');
    } finally {
      setSaving(false);
    }
  };

  const handleGalleryUpload = async (queue: File[]) => {
    if (!queue.length) return;
    setGalleryUploading(true);
    setGalleryUploadError(null);
    try {
      const uploadedUrls: string[] = [];
      for (const file of queue) {
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
          throw new Error(data?.error || 'Failed to upload fleet image');
        }
        if (data?.url) {
          uploadedUrls.push(String(data.url));
        }
      }

      setForm((prev) => {
        const shouldUseLatestAsCover = queue.length === 1;
        const latestUploaded = uploadedUrls[uploadedUrls.length - 1] || '';
        const nextHero = shouldUseLatestAsCover ? latestUploaded : prev.hero_image || uploadedUrls[0] || '';
        const nextGallerySource = shouldUseLatestAsCover
          ? [prev.hero_image, ...uploadedUrls, ...prev.gallery_images]
          : [...uploadedUrls, ...prev.gallery_images];
        const nextGallery = uniqueImages(nextGallerySource).filter((url) => url !== nextHero);
        return {
          ...prev,
          hero_image: nextHero,
          gallery_images: nextGallery,
        };
      });
    } catch (err: any) {
      setGalleryUploadError(err?.message || 'Failed to upload fleet images');
    } finally {
      setGalleryUploading(false);
    }
  };

  const handleSetCover = (imageUrl: string) => {
    setForm((prev) => {
      const nextHero = imageUrl.trim();
      if (!nextHero || nextHero === prev.hero_image) {
        return prev;
      }
      const nextGallery = uniqueImages([prev.hero_image, ...prev.gallery_images]).filter((url) => url && url !== nextHero);
      return {
        ...prev,
        hero_image: nextHero,
        gallery_images: nextGallery,
      };
    });
  };

  const handleRemoveImage = (imageUrl: string) => {
    setForm((prev) => {
      const trimmed = imageUrl.trim();
      if (!trimmed) {
        return prev;
      }

      if (prev.hero_image === trimmed) {
        const [nextHero = '', ...remaining] = prev.gallery_images.filter((url) => url !== trimmed);
        return {
          ...prev,
          hero_image: nextHero,
          gallery_images: remaining,
        };
      }

      return {
        ...prev,
        gallery_images: prev.gallery_images.filter((url) => url !== trimmed),
      };
    });
  };

  const previewImages = uniqueImages([form.hero_image, ...form.gallery_images]);

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
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const selectedFiles = Array.from(event.target.files || []);
                        event.target.value = '';
                        handleGalleryUpload(selectedFiles);
                      }}
                    />
                    {galleryUploading ? 'Uploading...' : 'Upload images'}
                  </label>
                  {form.hero_image ? (
                    <span className="text-xs text-gray-400 truncate max-w-[220px]">Cover image set</span>
                  ) : (
                    <span className="text-xs text-gray-500">No image uploaded yet.</span>
                  )}
                </div>
                {galleryUploadError ? (
                  <p className="mt-2 text-xs text-red-300">{galleryUploadError}</p>
                ) : null}
                <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                  <img
                    src={form.hero_image || previewImages[0] || fallbackFleetImage}
                    alt={form.label || 'Fleet cover'}
                    className="h-44 w-full object-cover"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wide text-gray-400">Fleet gallery</label>
                  <p className="text-xs text-gray-500">Upload multiple photos. The cover image is used on cards; all images are shown on the detail page.</p>
                </div>
                <span className="text-xs text-gray-400">{previewImages.length} image{previewImages.length === 1 ? '' : 's'}</span>
              </div>
              {previewImages.length ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {previewImages.map((imageUrl) => {
                    const isCover = imageUrl === form.hero_image;
                    return (
                      <div key={imageUrl} className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
                        <img src={imageUrl} alt={form.label || 'Fleet image'} className="h-36 w-full object-cover" />
                        <div className="flex items-center justify-between gap-2 border-t border-white/10 px-3 py-2">
                          <span className={`text-[11px] uppercase tracking-[0.2em] ${isCover ? 'text-amber-300' : 'text-gray-500'}`}>
                            {isCover ? 'Cover' : 'Gallery'}
                          </span>
                          <div className="flex gap-2">
                            {!isCover ? (
                              <button
                                type="button"
                                onClick={() => handleSetCover(imageUrl)}
                                className="text-xs text-amber-300 hover:text-amber-200"
                              >
                                Set cover
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(imageUrl)}
                              className="text-xs text-red-300 hover:text-red-200"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-6 text-sm text-gray-500">
                  No gallery images added yet.
                </div>
              )}
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
                      <p className="text-xs text-gray-400">ID {item.id} • /{item.slug}</p>
                      {item.updated_at ? <p className="text-[11px] text-gray-500">Updated: {item.updated_at}</p> : null}
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
                  <div className="flex items-center gap-2 overflow-x-auto">
                    {uniqueImages([item.hero_image || '', ...(item.gallery_images || [])]).slice(0, 4).map((imageUrl) => (
                      <img
                        key={imageUrl}
                        src={imageUrl}
                        alt={item.label}
                        className="h-16 w-20 rounded-xl border border-white/10 object-cover"
                      />
                    ))}
                    <span className="text-xs text-gray-500">
                      {uniqueImages([item.hero_image || '', ...(item.gallery_images || [])]).length} image
                      {uniqueImages([item.hero_image || '', ...(item.gallery_images || [])]).length === 1 ? '' : 's'}
                    </span>
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
