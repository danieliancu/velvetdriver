import React from 'react';
import PolicyPageLayout, { PolicySection, PolicyList } from '@/components/PolicyPageLayout';

const BookingTermsPage: React.FC = () => {
  return (
    <PolicyPageLayout title="Booking & Dispatch Policy">
      <PolicySection title="Bookings Accepted">
        <PolicyList
          items={[
            'Bookings accepted via phone, website, or email.',
            'Bookings must include passenger details, pickup, destination, fare, and any special requirements.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Dispatch & Records">
        <PolicyList
          items={[
            'All journeys are logged with driver allocation, dispatch, start, and end times.',
            'Drivers must not accept direct or private bookings.',
            'Records are stored for 12 months.',
          ]}
        />
      </PolicySection>
    </PolicyPageLayout>
  );
};

export default BookingTermsPage;
