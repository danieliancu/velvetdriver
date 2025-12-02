import React from 'react';
import PolicyPageLayout, { PolicySection, PolicyList } from '@/components/PolicyPageLayout';

const RecordKeepingPolicyPage: React.FC = () => {
  return (
    <PolicyPageLayout title="Record Keeping Policy (12 Months)">
      <p>Velvet Drivers Limited retains operational records securely for a minimum of 12 months.</p>

      <PolicySection title="Records Maintained">
        <PolicyList
          items={[
            'Bookings and dispatch logs',
            'Driver allocations and journey times',
            'Complaints and lost property logs',
            'Incident reports and vehicle checks',
            'Payments and driver documentation',
          ]}
        />
      </PolicySection>

      <PolicySection title="Access & Security">
        <p>Records are stored securely, protected by passwords, and made available to TfL, police, or lawful authorities upon request.</p>
      </PolicySection>

      <PolicySection title="Retention & Disposal">
        <p>Data is securely deleted or archived after the retention period in line with legal and regulatory obligations.</p>
      </PolicySection>
    </PolicyPageLayout>
  );
};

export default RecordKeepingPolicyPage;
