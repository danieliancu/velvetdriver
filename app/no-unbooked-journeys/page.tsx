import React from 'react';
import PolicyPageLayout, { PolicySection, PolicyList } from '@/components/PolicyPageLayout';

const NoUnbookedJourneysPolicyPage: React.FC = () => {
  return (
    <PolicyPageLayout title="No Unbooked Journeys Policy">
      <PolicySection title="Drivers Must NOT">
        <PolicyList
          items={[
            'Accept street hails.',
            'Take direct passenger bookings.',
            'Exchange numbers for future trips.',
            'Work privately using company branding.',
          ]}
        />
      </PolicySection>

      <PolicySection title="All Journeys Must">
        <PolicyList
          items={[
            'Be pre-booked.',
            'Be logged.',
            'Be dispatched officially.',
            'Have driver allocation before starting.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Breaches">
        <PolicyList
          items={[
            'Suspension',
            'Termination',
            'TfL reporting',
          ]}
        />
      </PolicySection>
    </PolicyPageLayout>
  );
};

export default NoUnbookedJourneysPolicyPage;
