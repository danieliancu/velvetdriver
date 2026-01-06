'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import AdminPageHeader from '@/components/AdminPageHeader';

type Severity = 'critical' | 'warning' | 'info' | 'success';

type AuditEvent = {
  id: number;
  table_name: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  pk: string | null;
  changed_at: string;
  changed_by: number | null;
  changed_by_email: string | null;
  ip: string | null;
  payload: any;
};

type NotificationItem = {
  id: string | number;
  category: string;
  title: string;
  message: string;
  datetime: string;
  severity: Severity;
  tags: string[];
  details: Array<{ label: string; value: string }>;
};

const severityStyleMap: Record<
  Severity,
  { card: string; pill: string; accent: string; button: string; label: string }
> = {
  critical: {
    card: 'border-red-500/40 bg-red-950/40 shadow-red-900/30',
    pill: 'bg-red-500 text-white',
    accent: 'text-red-200',
    button: 'border-red-400/60 text-red-200 hover:bg-red-500 hover:text-white',
    label: 'Critical'
  },
  warning: {
    card: 'border-amber-500/40 bg-amber-950/30 shadow-amber-900/20',
    pill: 'bg-amber-500 text-black',
    accent: 'text-amber-200',
    button: 'border-amber-400/70 text-amber-200 hover:bg-amber-400 hover:text-black',
    label: 'Warning'
  },
  info: {
    card: 'border-blue-400/40 bg-blue-950/30 shadow-blue-900/20',
    pill: 'bg-blue-400 text-black',
    accent: 'text-blue-200',
    button: 'border-blue-400/70 text-blue-100 hover:bg-blue-400 hover:text-black',
    label: 'Info'
  },
  success: {
    card: 'border-emerald-500/40 bg-emerald-950/30 shadow-emerald-900/20',
    pill: 'bg-emerald-500 text-black',
    accent: 'text-emerald-200',
    button: 'border-emerald-400/70 text-emerald-100 hover:bg-emerald-400 hover:text-black',
    label: 'Notice'
  }
};

const severityRank: Record<Severity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
  success: 3
};

const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(iso)
  );

const AdminNotificationsPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCount, setNewCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/notifications', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { events: AuditEvent[] };
        const mapped: NotificationItem[] = (data.events || []).map((evt) => {
          const payload = evt.payload || {};
          const toPairs = (obj: any) =>
            Object.entries(obj || {})
              .filter(([, v]) => v !== undefined && v !== null && `${v}`.trim() !== '')
              .map(([k, v]) => `${k}: ${v}`);

          const messageParts: string[] = [];
          const details: Array<{ label: string; value: string }> = [];

          if (payload.old) {
            const oldPairs = toPairs(payload.old);
            if (oldPairs.length) {
              messageParts.push(`Old: ${oldPairs.join(' | ')}`);
              details.push({ label: 'Old', value: oldPairs.join(' | ') });
            }
          }
          if (payload.new) {
            const newPairs = toPairs(payload.new);
            if (newPairs.length) {
              messageParts.push(`New: ${newPairs.join(' | ')}`);
              details.push({ label: 'New', value: newPairs.join(' | ') });
            }
          }

          const severityFromPayload = payload.severity as Severity | undefined;
          const severity: Severity =
            severityFromPayload && ['critical', 'warning', 'info', 'success'].includes(severityFromPayload)
              ? severityFromPayload
              : evt.operation === 'DELETE'
              ? 'warning'
              : evt.operation === 'UPDATE'
              ? 'info'
              : 'success';

          const tagsFromPayload: string[] = [];
          if (payload.tags && typeof payload.tags === 'object') {
            Object.entries(payload.tags).forEach(([k, v]) => tagsFromPayload.push(`${k}: ${v ?? '-'}`));
          }

          const defaultTags = [
            evt.changed_by ? `User ID: ${evt.changed_by}` : 'System',
            evt.changed_by_email ? `Email: ${evt.changed_by_email}` : 'Unknown email',
            evt.ip ? `IP: ${evt.ip}` : 'IP: n/a',
          ];

          return {
            id: evt.id,
            category: payload.category || evt.table_name,
            title: payload.title || `${evt.operation} on ${evt.table_name}`,
            message: payload.message || messageParts.join(' | ') || 'Change recorded.',
            datetime: evt.changed_at,
            severity,
            tags: [...tagsFromPayload, ...defaultTags],
            details,
          };
        });
        setNotifications(mapped);
        const lastSeen = sessionStorage.getItem('audit:lastSeenAt');
        const latestChanged = data.events?.[0]?.changed_at;
        if (latestChanged) {
          const unseen = (data.events || []).filter((evt) =>
            lastSeen ? new Date(evt.changed_at) > new Date(lastSeen) : true
          ).length;
          setNewCount(unseen);
          sessionStorage.setItem('audit:latestFetchedAt', latestChanged);
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load notifications');
      } finally {
        setLoading(false);
      }
    };
    load();

    return () => {
      const latest = sessionStorage.getItem('audit:latestFetchedAt');
      if (latest) {
        sessionStorage.setItem('audit:lastSeenAt', latest);
      }
      setNewCount(0);
    };
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return notifications;
    const q = query.toLowerCase();
    return notifications.filter((item) => {
      const haystack = `${item.id} ${item.category} ${item.title} ${item.message} ${item.tags.join(' ')} ${item.details.map((d) => `${d.label} ${d.value}`).join(' ')}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [notifications, query]);

  const sortedNotifications = [...filtered].sort((a, b) => {
    const severityDiff = severityRank[a.severity] - severityRank[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return new Date(b.datetime).getTime() - new Date(a.datetime).getTime();
  });

  const totalPages = Math.max(1, Math.ceil(sortedNotifications.length / itemsPerPage));
  const page = Math.min(currentPage, totalPages);
  const start = (page - 1) * itemsPerPage;
  const pageItems = sortedNotifications.slice(start, start + itemsPerPage);

  const toggleExpand = (id: string | number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="w-full flex-grow p-4 sm:p-6 md:p-8">
        <div className="max-w-6xl mx-auto w-full space-y-8">
          <AdminPageHeader active="notifications" notificationsBadgeCount={newCount} />

          <main className="w-full space-y-4">
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search any notification..."
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-10 py-3 text-white placeholder-gray-500 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <section className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold text-white">Notifications</h2>
                  <p className="text-sm text-gray-400">
                    Live audit feed from database changes (sorted by urgency & date).
                  </p>
                </div>
              </div>
              {error ? (
                <div className="rounded-lg border border-red-500/50 bg-red-950/40 text-red-200 px-4 py-3 text-sm">
                  {error}
                </div>
              ) : null}
              {loading ? (
                <div className="text-sm text-gray-400">Loading notifications...</div>
              ) : null}

              <div className="grid grid-cols-1 gap-4">
                {pageItems.length === 0 ? (
                  <div className="text-sm text-gray-400">No notifications match your filters.</div>
                ) : (
                  pageItems.map((notif) => {
                    const styles = severityStyleMap[notif.severity];
                    const isOpen = expanded[notif.id];
                    return (
                      <article
                        key={notif.id}
                        className={`rounded-2xl border ${styles.card} p-4 sm:p-5 shadow-lg transition duration-200`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`text-[11px] font-semibold tracking-wide uppercase ${styles.pill} px-2 py-1 rounded-full`}>
                                {styles.label}
                              </span>
                              <span className="text-xs text-gray-400">{notif.category}</span>
                              <span className={`text-xs font-semibold ${styles.accent}`}>{formatDateTime(notif.datetime)}</span>
                            </div>
                            <h3 className="text-lg font-semibold text-white">{notif.title}</h3>
                            <p className="text-sm text-gray-200 break-words">
                              {isOpen ? notif.message : notif.message.slice(0, 280)}
                              {notif.message.length > 280 ? (
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(notif.id)}
                                  className="ml-2 text-amber-300 hover:text-amber-200 text-xs"
                                >
                                  {isOpen ? 'Show less' : 'Show more'}
                                </button>
                              ) : null}
                            </p>
                            <div className="flex flex-wrap gap-2 text-[11px] text-gray-400">
                              {notif.tags.map((tag) => (
                                <span key={tag} className="px-2 py-1 rounded-full bg-white/5 border border-white/10">
                                  {tag}
                                </span>
                              ))}
                            </div>
                            {notif.details.length ? (
                              <div className="mt-2 space-y-1 text-xs text-gray-200">
                                {notif.details.map((d) => (
                                  <div key={d.label}>
                                    <span className="text-amber-200 font-semibold">{d.label}:</span>{' '}
                                    <span className="text-gray-200">{d.value || '-'}</span>
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
              {sortedNotifications.length > itemsPerPage ? (
                <div className="flex items-center justify-between text-sm text-gray-300">
                  <span>
                    Page {page} of {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1 rounded-md border border-white/10 bg-white/5 disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="px-3 py-1 rounded-md border border-white/10 bg-white/5 disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminNotificationsPage;
