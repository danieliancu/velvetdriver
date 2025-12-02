import React from 'react';
import PolicyPageLayout, { PolicySection, PolicyList } from '@/components/PolicyPageLayout';

const SafetyAccessibilityPage: React.FC = () => {
  return (
    <PolicyPageLayout title="Safety & Accessibility">
      <PolicySection title="Passenger Safety Policy">
        <p>TfL-licensed drivers and vehicles only. Journeys are pre-booked, logged, and dispatched with professional conduct at all times.</p>
        <PolicyList
          items={[
            'Seat belts are mandatory for every passenger.',
            'Correct child seats are required where applicable.',
            'All bookings are logged with driver allocation and timestamps.',
            'Zero tolerance for drugs, alcohol, abuse, or unsafe driving.',
          ]}
        />
        <p>Extra care is provided for vulnerable passengers. Incidents must be reported and safety concerns can be sent to info@velvetdrivers.co.uk.</p>
      </PolicySection>

      <PolicySection title="Equality & Accessibility Policy">
        <p>Velvet Drivers Limited provides an inclusive service with no discrimination of any kind.</p>
        <PolicyList
          items={[
            'Drivers assist with luggage, doors, and safe entry/exit.',
            'Assistance dogs are allowed.',
            'Drivers are trained to assist vulnerable persons.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Incident & Accident Reporting Policy">
        <p>Must report immediately: accidents, injuries, aggression, breakdowns, near-misses, and vehicle faults.</p>
        <PolicyList
          items={[
            'Drivers ensure safety, call emergency services if needed, notify Velvet Drivers, and exchange details.',
            'Minor incidents: report within 24 hours. Major incidents: report immediately.',
            'Outcomes may include retraining, suspension, TfL reporting, or insurance actions.',
            'Incident records are stored for 12 months.',
          ]}
        />
      </PolicySection>
    </PolicyPageLayout>
  );
};

export default SafetyAccessibilityPage;
