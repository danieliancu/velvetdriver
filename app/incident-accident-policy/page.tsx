import React from 'react';
import PolicyPageLayout, { PolicySection, PolicyList } from '@/components/PolicyPageLayout';

const IncidentAccidentPolicyPage: React.FC = () => {
  return (
    <PolicyPageLayout title="Incident & Accident Reporting Policy">
      <PolicySection title="Report Immediately">
        <PolicyList
          items={[
            'Accidents',
            'Injuries',
            'Aggression',
            'Breakdowns',
            'Near-misses',
            'Vehicle faults',
          ]}
        />
      </PolicySection>

      <PolicySection title="Driver Steps">
        <PolicyList
          items={[
            'Ensure safety.',
            'Call emergency services if needed.',
            'Notify Velvet Drivers.',
            'Exchange details.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Internal Reporting">
        <PolicyList
          items={[
            'Minor incidents: within 24 hours.',
            'Major incidents: immediately.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Outcomes">
        <PolicyList
          items={[
            'Retraining',
            'Suspension',
            'TfL reporting',
            'Insurance actions',
          ]}
        />
      </PolicySection>

      <PolicySection title="Retention">
        <p>Incident records are stored for 12 months.</p>
      </PolicySection>
    </PolicyPageLayout>
  );
};

export default IncidentAccidentPolicyPage;
