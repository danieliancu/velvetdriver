
import React from 'react';
import PolicyPageLayout, { PolicySection, PolicyList } from '@/components/PolicyPageLayout';

const RefundPolicyPage: React.FC = () => {
  return (
    <PolicyPageLayout title="Cancellation & Refund Policy">
      <PolicySection title="Cancellation">
        <PolicyList
          items={[
            'Cancellations more than 2 hours before pickup: no charge.',
            'Cancellations less than 2 hours before pickup: up to 100% charge.',
            'Airport journeys require 3 hours notice.',
            'If a driver is en-route or has arrived: full fare applies.',
            'No-show equals full fare (15 minutes for standard pickup / 60 minutes for airport).',
          ]}
        />
      </PolicySection>

      <PolicySection title="Refunds">
        <p>Refunds are issued within 3-5 business days.</p>
      </PolicySection>

      <PolicySection title="Disputes">
        <p>Disputes should be submitted to <a href="mailto:info@velvetdrivers.co.uk" className="text-amber-400 hover:underline">info@velvetdrivers.co.uk</a>.</p>
      </PolicySection>
    </PolicyPageLayout>
  );
};

export default RefundPolicyPage;
