'use client';

import React from 'react';
import { Search } from 'lucide-react';
import AdminPageHeader from '@/components/AdminPageHeader';

type Severity = 'critical' | 'warning' | 'info' | 'success';

type NotificationItem = {
  id: string;
  category: string;
  title: string;
  message: string;
  datetime: string;
  severity: Severity;
  tags: string[];
};

const notifications: NotificationItem[] = [
  {
    id: 'notif-driver-pco',
    category: 'Driver Document',
    title: 'PCO licence expiring in 14 days',
    message: 'James P. (PCO-70934) needs renewal submitted before 02 Dec.',
    datetime: '2025-11-18T09:10:00Z',
    severity: 'critical',
    tags: ['Driver: James P.', 'PCO Licence', 'Renewal']
  },
  {
    id: 'notif-car-mot',
    category: 'Vehicle MOT',
    title: 'MOT expiring soon for LC20 ABC',
    message: 'Mercedes-Benz S-Class MOT due 15 Oct 2025. Schedule inspection.',
    datetime: '2025-11-17T17:00:00Z',
    severity: 'warning',
    tags: ['VRM: LC20 ABC', 'MOT', 'Vehicle']
  },
  {
    id: 'notif-car-insurance',
    category: 'Vehicle Insurance',
    title: 'Insurance expiring for BD68 XYZ',
    message: 'BMW 7 Series insurance ends 01 Dec 2025. Upload renewed certificate.',
    datetime: '2025-11-17T08:00:00Z',
    severity: 'critical',
    tags: ['VRM: BD68 XYZ', 'Insurance', 'Upload needed']
  },
  {
    id: 'notif-car-phv',
    category: 'PHV Vehicle Licence',
    title: 'PHV licence renewal required for OT69 VEL',
    message: 'Lexus RX PHV licence expires 10 Jan 2026. Start renewal pack.',
    datetime: '2025-11-16T14:20:00Z',
    severity: 'warning',
    tags: ['VRM: OT69 VEL', 'PHV Licence', 'Vehicle']
  },
  {
    id: 'notif-complaint',
    category: 'Client Submission',
    title: 'Complaint submitted (Ref: VD-1001)',
    message: 'Passenger reported driver punctuality issue. Review and respond within SLA.',
    datetime: '2025-11-18T11:35:00Z',
    severity: 'critical',
    tags: ['Complaint', 'Client', 'SLA 48h']
  },
  {
    id: 'notif-review',
    category: 'Client Submission',
    title: 'New 5* review received',
    message: '"Great ride, clean car, on time." from Kings Cross Hotel transfer.',
    datetime: '2025-11-17T19:40:00Z',
    severity: 'success',
    tags: ['Review', 'Customer', 'Reputation']
  },
  {
    id: 'notif-lost',
    category: 'Lost Property',
    title: 'Lost property form submitted',
    message: 'Client reports missing laptop bag on VD-1010. Check vehicle BD68 XYZ.',
    datetime: '2025-11-17T21:15:00Z',
    severity: 'info',
    tags: ['Lost Property', 'VD-1010', 'Follow-up']
  },
  {
    id: 'notif-booking',
    category: 'Booking Request',
    title: 'Book a Journey request received',
    message: 'New Heathrow to The Ned booking request. Awaiting client confirmation.',
    datetime: '2025-11-18T08:55:00Z',
    severity: 'info',
    tags: ['New Booking', 'Dispatch', 'Heathrow']
  },
  {
    id: 'notif-login',
    category: 'Security',
    title: 'New admin login detected',
    message: 'Admin session opened from London IP 81.xx. Verify if expected.',
    datetime: '2025-11-18T06:45:00Z',
    severity: 'warning',
    tags: ['Login', 'Audit', 'Security']
  }
] as const;

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
    label: 'Positive'
  }
};

const notificationActions = ['Archive', 'Delete'] as const;

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
  const [query, setQuery] = React.useState('');
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  const filtered = React.useMemo(() => {
    if (!query.trim()) return notifications;
    const q = query.toLowerCase();
    return notifications.filter((item) => {
      const haystack = `${item.id} ${item.category} ${item.title} ${item.message} ${item.tags.join(' ')}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [query]);

  const sortedNotifications = [...filtered].sort((a, b) => {
    const severityDiff = severityRank[a.severity] - severityRank[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return new Date(b.datetime).getTime() - new Date(a.datetime).getTime();
  });

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <div className="w-full flex-grow p-4 sm:p-6 md:p-8">
        <div className="max-w-6xl mx-auto w-full space-y-8">
          <AdminPageHeader active="notifications" />

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
                <div>
                  <h2 className="text-xl font-semibold text-white">Notifications</h2>
                  <p className="text-sm text-gray-400">
                    Document expiries, client submissions, logins — sorted by urgency & date.
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {sortedNotifications.map((item) => {
                  const styles = severityStyleMap[item.severity];
                  const isOpen = expanded[item.id] ?? false;
                  return (
                    <article
                      key={item.id}
                      className={`rounded-2xl border p-4 md:p-5 shadow-lg ${styles.card}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleExpand(item.id)}
                            className="h-7 w-7 flex items-center justify-center rounded-full border border-white/15 text-gray-200 hover:border-amber-400 hover:text-amber-300 transition"
                            aria-label={isOpen ? 'Collapse notification' : 'Expand notification'}
                          >
                            <span className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                          </button>
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] font-semibold uppercase tracking-[0.3em] ${styles.accent}`}>
                              {item.category}
                            </span>
                            <span className={`text-[11px] px-2 py-1 rounded-full font-bold uppercase ${styles.pill}`}>
                              {styles.label}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-xs text-gray-300">{formatDateTime(item.datetime)}</p>
                          <div className="flex flex-wrap gap-2">
                            {notificationActions.map((action) => (
                              <button
                                key={`${item.id}-${action}`}
                                type="button"
                                className={`px-3 py-1 text-xs font-semibold rounded-full border transition ${styles.button}`}
                              >
                                {action}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      {isOpen && (
                        <div className="mt-3 space-y-3">
                          <div className="space-y-1">
                            <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                            <p className="text-sm text-gray-300">{item.message}</p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {item.tags.map((tag) => (
                              <span
                                key={`${item.id}-${tag}`}
                                className="text-[11px] rounded-full border border-white/10 bg-white/5 px-2 py-1 text-gray-200"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminNotificationsPage;
