import React from 'react';
import PolicyPageLayout, { PolicySection, PolicyList } from '@/components/PolicyPageLayout';
import DataProtectionContent from '@/components/DataProtectionContent';

const PrivacyDataPage: React.FC = () => {
  return (
    <PolicyPageLayout title="Privacy & Data">
      <PolicySection title="Privacy Policy (GDPR)">
        <DataProtectionContent />
      </PolicySection>

      <PolicySection title="Data Protection Policy">
        <DataProtectionContent />
      </PolicySection>

      <PolicySection title="Record Keeping Policy (12 Months)">
        <p>Records are kept securely for a minimum of 12 months and provided to TfL, police, or lawful authorities upon request.</p>
        <PolicyList
          items={[
            'Bookings and dispatch logs',
            'Driver allocations and journey times',
            'Complaints and lost property logs',
            'Incident reports and vehicle checks',
            'Payments and driver documentation',
          ]}
        />
        <p>Data is securely deleted or archived after the retention period in line with legal obligations.</p>
      </PolicySection>

      <PolicySection title="Cookie Notice">
        <p>We use cookies for security, functionality, performance, and (if enabled) analytics. You may accept or decline non-essential cookies in your browser settings, though disabling cookies may reduce site functionality.</p>
      </PolicySection>
    </PolicyPageLayout>
  );
};

export default PrivacyDataPage;
