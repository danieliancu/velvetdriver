import React from 'react';
import PolicyPageLayout, { PolicySection, PolicyList } from '@/components/PolicyPageLayout';

const SafetyPolicyPage: React.FC = () => {
  return (
    <PolicyPageLayout title="Passenger Safety Policy">
      <p>TfL-licensed drivers and vehicles only. Journeys are pre-booked, logged, and dispatched with professional conduct at all times.</p>

      <PolicySection title="Licensed Drivers & Vehicles">
        <PolicyList
          items={[
            'All drivers and vehicles are TfL licensed and compliant.',
            'Seat belts are mandatory for every passenger.',
            'Correct child seats are required where applicable.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Bookings & Records">
        <PolicyList
          items={[
            'Pre-booked journeys only.',
            'All bookings are logged with driver allocation and timestamps.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Conduct & Zero Tolerance">
        <PolicyList
          items={[
            'Professional conduct is required at all times.',
            'Zero tolerance for drugs, alcohol, abuse, or unsafe driving.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Vulnerable Passengers">
        <p>Extra care is provided for vulnerable passengers.</p>
      </PolicySection>

      <PolicySection title="Incidents & Reporting">
        <PolicyList
          items={[
            'Incidents must be reported.',
            'Lost property is handled per policy.',
            'Safety concerns: info@velvetdrivers.co.uk',
          ]}
        />
      </PolicySection>
    </PolicyPageLayout>
  );
};

export default SafetyPolicyPage;
