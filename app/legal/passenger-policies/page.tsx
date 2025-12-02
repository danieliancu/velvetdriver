import React from 'react';
import PolicyPageLayout, { PolicySection, PolicyList } from '@/components/PolicyPageLayout';

const PassengerPoliciesPage: React.FC = () => {
  return (
    <PolicyPageLayout title="Passenger Policies">
      <PolicySection title="Passenger Terms & Conditions">
        <p>These Terms apply to all passengers using Velvet Drivers Limited.</p>
        <PolicyList
          items={[
            'All journeys must be pre-booked and are confirmed only when the Company issues confirmation.',
            'Passengers must provide accurate information.',
            'Fares are quoted at booking or calculated by tariff; extra charges may apply (waiting time, tolls, parking).',
            'Payments must be through approved methods only; cash paid privately to drivers is prohibited.',
            'Passengers must behave respectfully; smoking, vaping, aggression, or damage is prohibited. Cleaning or damage fees may apply.',
            'Charges may apply for late cancellations or no-shows.',
            'Seat belts must be worn; children must use correct restraints.',
            'The Company is not responsible for delays beyond its control or missed flights unless agreed.',
            'Passengers are responsible for belongings; the Company is not liable for loss/damage unless negligent.',
            'Complaints must be submitted in writing and are investigated promptly. Governing law: England & Wales.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Cancellation & Refund Policy">
        <PolicyList
          items={[
            'Cancellations more than 2 hours before pickup: no charge.',
            'Cancellations less than 2 hours before pickup: up to 100% charge.',
            'Airport journeys require 3 hours notice.',
            'If a driver is en-route or has arrived: full fare applies.',
            'No-show equals full fare (15 minutes for standard pickup / 60 minutes for airport).',
            'Refunds issued within 3-5 business days.',
            'Disputes: info@velvetdrivers.co.uk.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Complaints Handling Procedure">
        <p>Complaints must be emailed to info@velvetdrivers.co.uk including booking reference, time, driver details, and the issue.</p>
        <PolicyList
          items={[
            'Acknowledged within 48 hours.',
            'Investigated using booking logs, evidence, and internal notes.',
            'Full response within 7-10 business days.',
            'Outcomes may include refund, retraining, warnings, suspension, or reporting to TfL.',
            'Escalation: tph.complaints@tfl.gov.uk.',
            'Complaints stored for 12 months.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Lost Property Policy">
        <PolicyList
          items={[
            'Drivers must check their vehicle at the end of each journey and report found items immediately.',
            'Found items are logged with date, time, vehicle, and description and stored securely for up to 12 months.',
            'Passengers must provide ID for collection; unclaimed valuables may be given to the police.',
          ]}
        />
      </PolicySection>
    </PolicyPageLayout>
  );
};

export default PassengerPoliciesPage;
