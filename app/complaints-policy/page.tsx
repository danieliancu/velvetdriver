import React from 'react';
import PolicyPageLayout, { PolicySection, PolicyList } from '@/components/PolicyPageLayout';

const ComplaintsPolicyPage: React.FC = () => {
  return (
    <PolicyPageLayout title="Complaints Handling Procedure">
      <p>Complaints must be emailed to <a href="mailto:info@velvetdrivers.co.uk" className="text-amber-400 hover:underline">info@velvetdrivers.co.uk</a> including booking reference, time, driver details, and the issue.</p>

      <PolicySection title="Acknowledgement">
        <p>Complaints are acknowledged within 48 hours.</p>
      </PolicySection>

      <PolicySection title="Investigation">
        <p>Complaints are investigated using booking logs, evidence, and internal notes.</p>
      </PolicySection>

      <PolicySection title="Response Time">
        <p>A full response is provided within 7-10 business days.</p>
      </PolicySection>

      <PolicySection title="Outcomes">
        <PolicyList
          items={[
            'Refund',
            'Retraining',
            'Warnings',
            'Suspension',
            'Reporting to TfL',
          ]}
        />
      </PolicySection>

      <PolicySection title="Escalation">
        <p>Escalation: <a href="mailto:tph.complaints@tfl.gov.uk" className="text-amber-400 hover:underline">tph.complaints@tfl.gov.uk</a></p>
      </PolicySection>

      <PolicySection title="Retention">
        <p>Complaints are stored for 12 months.</p>
      </PolicySection>
    </PolicyPageLayout>
  );
};

export default ComplaintsPolicyPage;
