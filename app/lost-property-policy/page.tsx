import React from 'react';
import PolicyPageLayout, { PolicySection, PolicyList } from '@/components/PolicyPageLayout';

const LostPropertyPolicyPage: React.FC = () => {
  return (
    <PolicyPageLayout title="Lost Property Policy">
      <PolicySection title="Driver Responsibilities">
        <PolicyList
          items={[
            'Drivers must check their vehicle at the end of each journey.',
            'Found items are reported immediately and logged with date, time, vehicle, and description.',
            'Items are stored securely for up to 12 months.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Passenger Collection">
        <PolicyList
          items={[
            'ID required for collection.',
            'Unclaimed valuables may be given to the police.',
          ]}
        />
      </PolicySection>
    </PolicyPageLayout>
  );
};

export default LostPropertyPolicyPage;
