import React from 'react';
import PolicyPageLayout, { PolicySection, PolicyList } from '@/components/PolicyPageLayout';

const DriverPolicyPage: React.FC = () => {
  return (
    <PolicyPageLayout title="Driver Terms & Conditions">
      <PolicySection title="Eligibility & Compliance">
        <PolicyList
          items={[
            'Drivers must hold valid TfL licences, MOT, insurance, and road tax.',
            'Any changes in licence, insurance, criminal, or medical status must be reported.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Conduct & Standards">
        <PolicyList
          items={[
            'Drivers must act professionally and respectfully.',
            'Vehicles must be clean and safe.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Prohibited Activity">
        <PolicyList
          items={[
            'No street hails.',
            'No private jobs.',
            'No cash outside the system.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Regulatory Obligations">
        <PolicyList
          items={[
            'Drivers must follow TfL rules and cooperate with investigations.',
            'Breaches may lead to suspension or termination.',
          ]}
        />
      </PolicySection>
    </PolicyPageLayout>
  );
};

export default DriverPolicyPage;
