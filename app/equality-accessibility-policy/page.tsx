import React from 'react';
import PolicyPageLayout, { PolicySection, PolicyList } from '@/components/PolicyPageLayout';

const EqualityAccessibilityPolicyPage: React.FC = () => {
  return (
    <PolicyPageLayout title="Equality & Accessibility Policy">
      <PolicySection title="Commitment">
        <p>Velvet Drivers Limited provides an inclusive service with no discrimination of any kind.</p>
      </PolicySection>

      <PolicySection title="Driver Support">
        <PolicyList
          items={[
            'Drivers assist with luggage, doors, and safe entry/exit.',
            'Assistance dogs are allowed.',
            'Drivers are trained to assist vulnerable persons.',
          ]}
        />
      </PolicySection>
    </PolicyPageLayout>
  );
};

export default EqualityAccessibilityPolicyPage;
