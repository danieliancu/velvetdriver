'use client';

import type { ReactNode } from 'react';
import AlertProvider from '@/components/AlertProvider';
import { AuthProvider } from '@/lib/auth-context';
import { BookingProvider } from '@/lib/booking-context';

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AlertProvider>
        <BookingProvider>{children}</BookingProvider>
      </AlertProvider>
    </AuthProvider>
  );
}
