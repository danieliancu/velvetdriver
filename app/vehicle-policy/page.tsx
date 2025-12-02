import React from 'react';
import PolicyPageLayout, { PolicySection, PolicyList } from '@/components/PolicyPageLayout';

const VehiclePolicyPage: React.FC = () => {
  return (
    <PolicyPageLayout title="Vehicle Policy">
      <PolicySection title="Vehicle Requirements">
        <PolicyList
          items={[
            'Vehicles must have valid PHV licence, MOT, insurance, and tax.',
            'Vehicles must be clean, damage-free, smoke-free, and mechanically safe.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Daily Checks">
        <PolicyList
          items={[
            'Tyres',
            'Lights',
            'Brakes',
            'Fuel',
            'Seat belts',
            'Cleanliness',
          ]}
        />
      </PolicySection>

      <PolicySection title="Faults & Replacements">
        <PolicyList
          items={[
            'Faults must be reported immediately.',
            'Unsafe vehicles must not operate.',
            'Replacement vehicles must be reported and documented.',
            'Logs are stored for 12 months.',
          ]}
        />
      </PolicySection>
    </PolicyPageLayout>
  );
};

export default VehiclePolicyPage;
