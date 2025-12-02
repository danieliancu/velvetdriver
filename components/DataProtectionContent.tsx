import React from 'react';
import { PolicySection, PolicyList } from './PolicyPageLayout';

const DataProtectionContent: React.FC = () => (
  <>
    <p>Explains how personal data is processed under GDPR and TfL rules for Velvet Drivers Limited.</p>

    <PolicySection title="Data Collected">
      <PolicyList
        items={[
          'Passenger information and booking details.',
          'Driver documentation and licensing records.',
          'Corporate billing and invoicing details.',
        ]}
      />
    </PolicySection>

    <PolicySection title="Storage & Security">
      <p>Data is stored securely with restricted access and handled only for operational needs and legal compliance.</p>
    </PolicySection>

    <PolicySection title="Retention">
      <PolicyList
        items={[
          'Booking records retained for a minimum of 12 months.',
          'Corporate invoices may be retained longer where required for accounting or legal reasons.',
        ]}
      />
    </PolicySection>

    <PolicySection title="Your Rights">
      <PolicyList
        items={[
          'Individuals may request access to their data.',
          'You may request correction or deletion of inaccurate data.',
          'We respond to GDPR rights requests promptly and lawfully.',
        ]}
      />
      <p>
        Contact: <a href="mailto:info@velvetdrivers.co.uk" className="text-amber-400 hover:underline">info@velvetdrivers.co.uk</a>
      </p>
    </PolicySection>
  </>
);

export default DataProtectionContent;
