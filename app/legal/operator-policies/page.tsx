import React from 'react';
import PolicyPageLayout, { PolicySection, PolicyList } from '@/components/PolicyPageLayout';

const OperatorPoliciesPage: React.FC = () => {
  return (
    <PolicyPageLayout title="Operator Policies">
      <PolicySection title="Booking & Dispatch Policy">
        <PolicyList
          items={[
            'Bookings accepted via phone, website, or email.',
            'Bookings must include passenger details, pickup, destination, fare, and special requirements.',
            'All journeys are logged with driver allocation, dispatch, start, and end times.',
            'Drivers must not accept direct or private bookings.',
            'Records are stored for 12 months.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Driver Terms & Conditions">
        <PolicyList
          items={[
            'Drivers must hold valid TfL licences, MOT, insurance, and road tax.',
            'Changes in licence, insurance, criminal, or medical status must be reported.',
            'Drivers must act professionally and respectfully; vehicles must be clean and safe.',
            'Prohibited: street hails, private jobs, and cash outside the system.',
            'Drivers must follow TfL rules and cooperate with investigations; breaches may lead to suspension or termination.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Vehicle Policy">
        <PolicyList
          items={[
            'Vehicles must have valid PHV licence, MOT, insurance, and tax.',
            'Vehicles must be clean, damage-free, smoke-free, and mechanically safe.',
            'Daily checks: tyres, lights, brakes, fuel, seat belts, cleanliness.',
            'Faults must be reported immediately; unsafe vehicles must not operate.',
            'Replacement vehicles must be reported and documented; logs stored for 12 months.',
          ]}
        />
      </PolicySection>

      <PolicySection title="No Unbooked Journeys Policy">
        <PolicyList
          items={[
            'Drivers must not accept street hails or direct passenger bookings.',
            'No exchanging numbers for future trips or working privately using company branding.',
            'All journeys must be pre-booked, logged, dispatched officially, and have driver allocation before starting.',
            'Breaches can result in suspension, termination, and TfL reporting.',
          ]}
        />
      </PolicySection>
    </PolicyPageLayout>
  );
};

export default OperatorPoliciesPage;
