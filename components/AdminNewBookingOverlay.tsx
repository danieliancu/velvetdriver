'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type StreamBooking = {
  journeyId: number;
  code: string;
  pickup: string;
  dropOff: string;
  passenger: string;
  phone: string;
  email: string;
  date: string;
  time: string;
  priceDetails: string;
  createdAt: string | null;
};

const LAST_SEEN_KEY = 'admin.liveBookings.lastSeenId';
const REFRESH_EVENT = 'admin-live-bookings-refresh';

const readLastSeenId = () => {
  if (typeof window === 'undefined') return null;
  const raw = window.sessionStorage.getItem(LAST_SEEN_KEY);
  if (raw == null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const saveLastSeenId = (id: number) => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(LAST_SEEN_KEY, String(id));
};

const AdminNewBookingOverlay = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [queue, setQueue] = useState<StreamBooking[]>([]);
  const [visibleBooking, setVisibleBooking] = useState<StreamBooking | null>(null);
  const lastSeenRef = useRef<number | null>(null);

  useEffect(() => {
    lastSeenRef.current = readLastSeenId();

    let disposed = false;
    let eventSource: EventSource | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (disposed) return;
      const query =
        lastSeenRef.current == null ? '' : `?afterId=${encodeURIComponent(String(lastSeenRef.current))}`;
      eventSource = new EventSource(`/api/admin/live-bookings/stream${query}`);

      eventSource.addEventListener('booking-created', (evt) => {
        try {
          const parsed = JSON.parse((evt as MessageEvent).data || '{}') as { booking?: StreamBooking };
          const booking = parsed.booking;
          if (!booking?.journeyId) return;
          if (lastSeenRef.current != null && booking.journeyId <= lastSeenRef.current) return;
          lastSeenRef.current = booking.journeyId;
          saveLastSeenId(lastSeenRef.current);

          setQueue((prev) => {
            const exists = prev.some((entry) => entry.journeyId === booking.journeyId);
            if (exists) return prev;
            return [...prev, booking];
          });
          setVisibleBooking((current) => current ?? booking);
        } catch (err) {
          console.error('Failed to parse booking-created event', err);
        }
      });

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (!disposed) {
          reconnectTimeout = setTimeout(connect, 2000);
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) eventSource.close();
    };
  }, []);

  useEffect(() => {
    if (visibleBooking) return;
    if (!queue.length) return;
    setVisibleBooking(queue[0]);
  }, [queue, visibleBooking]);

  if (pathname === '/admin') return null;
  if (!visibleBooking) return null;

  const handleOk = () => {
    const currentId = visibleBooking.journeyId;
    setQueue((prev) => prev.filter((entry) => entry.journeyId !== currentId));
    setVisibleBooking(null);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(REFRESH_EVENT));
    }

    if (pathname !== '/admin/dashboard') {
      router.push('/admin/dashboard');
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-red-900/20 via-transparent to-amber-700/20" />
      <div className="relative h-full w-full flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-3xl rounded-2xl border-2 border-amber-400 bg-[#120707] shadow-[0_0_40px_rgba(251,191,36,0.35)]">
          <div className="px-6 py-4 border-b border-amber-600/50 bg-gradient-to-r from-red-900/60 to-black/40">
            <p className="text-xs tracking-[0.2em] uppercase text-amber-300">New Booking Alert</p>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">New booking received</h2>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm sm:text-base">
            <div>
              <p className="text-amber-300 text-xs uppercase tracking-wide">Ref</p>
              <p className="text-white font-semibold">{visibleBooking.code}</p>
            </div>
            <div>
              <p className="text-amber-300 text-xs uppercase tracking-wide">Data/Ora</p>
              <p className="text-white font-semibold">{visibleBooking.date} {visibleBooking.time}</p>
            </div>
            <div>
              <p className="text-amber-300 text-xs uppercase tracking-wide">Pasager</p>
              <p className="text-white font-semibold">{visibleBooking.passenger}</p>
            </div>
            <div>
              <p className="text-amber-300 text-xs uppercase tracking-wide">Telefon</p>
              <p className="text-white font-semibold">{visibleBooking.phone || '-'}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-amber-300 text-xs uppercase tracking-wide">Email</p>
              <p className="text-white font-semibold break-all">{visibleBooking.email || '-'}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-amber-300 text-xs uppercase tracking-wide">Pickup</p>
              <p className="text-white font-semibold">{visibleBooking.pickup}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-amber-300 text-xs uppercase tracking-wide">Drop-off</p>
              <p className="text-white font-semibold">{visibleBooking.dropOff}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-amber-300 text-xs uppercase tracking-wide">Pret</p>
              <p className="text-white font-semibold">{visibleBooking.priceDetails}</p>
            </div>
          </div>
          <div className="px-6 pb-6">
            <button
              type="button"
              onClick={handleOk}
              className="w-full rounded-xl bg-amber-400 text-black font-bold uppercase tracking-wide py-3 hover:bg-amber-300 transition-colors"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminNewBookingOverlay;
