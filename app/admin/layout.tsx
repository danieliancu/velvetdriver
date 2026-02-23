import type { ReactNode } from 'react';
import AdminNewBookingOverlay from '@/components/AdminNewBookingOverlay';

type AdminLayoutProps = {
  children: ReactNode;
};

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <>
      {children}
      <AdminNewBookingOverlay />
    </>
  );
}

