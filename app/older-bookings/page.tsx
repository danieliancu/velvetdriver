import PageShell from '@/components/PageShell';
import OlderBookingsList from '@/components/OlderBookingsList';
import AdminPageHeader from '@/components/AdminPageHeader';

export default function OlderBookingsPage() {
  return (
    <PageShell mainClassName="flex flex-col px-4 sm:px-6 lg:px-8 py-10" hideFooter hideHeader>
      <div className="w-full max-w-6xl mx-auto space-y-6">
        <AdminPageHeader active="older" />
        <OlderBookingsList />
      </div>
    </PageShell>
  );
}
