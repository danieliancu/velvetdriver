
import React from 'react';
import PolicyPageLayout, { PolicySection, PolicyList } from '@/components/PolicyPageLayout';

const TermsOfServicePage: React.FC = () => {
  return (
    <PolicyPageLayout title="Passenger Terms & Conditions">
      <p>These Terms and Conditions apply to all passengers using the services of Velvet Drivers Limited ("the Company").</p>

      <PolicySection title="Introduction">
        <p>All journeys must be pre-booked and are confirmed only when the Company issues a booking confirmation.</p>
      </PolicySection>

      <PolicySection title="Bookings">
        <PolicyList
          items={[
            'All journeys must be pre-booked.',
            'Bookings are confirmed only when the Company issues a confirmation.',
            'Passengers must provide accurate information at the time of booking.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Fares and Payments">
        <PolicyList
          items={[
            'Fares are quoted at booking or calculated by tariff.',
            'Extra charges may apply for waiting time, tolls, or parking.',
            'Payments must be made through approved methods only.',
            'Cash paid privately to drivers is prohibited.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Passenger Conduct">
        <PolicyList
          items={[
            'Passengers must behave respectfully.',
            'Smoking, vaping, aggression, or damage to the vehicle is prohibited.',
            'Cleaning or damage fees may apply.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Cancellations and No-Shows">
        <p>Charges may apply for late cancellations or no-shows.</p>
      </PolicySection>

      <PolicySection title="Safety">
        <PolicyList
          items={[
            'Seat belts must be worn.',
            'Children must use correct restraints.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Delays and Liability">
        <PolicyList
          items={[
            'The Company is not responsible for delays beyond its control.',
            'The Company is not liable for missed flights unless agreed in writing.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Luggage and Property">
        <PolicyList
          items={[
            'Passengers are responsible for their belongings.',
            'The Company is not liable for loss or damage unless negligent.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Data Protection">
        <p>Passenger data is processed under GDPR for operational needs only.</p>
      </PolicySection>

      <PolicySection title="Complaints">
        <PolicyList
          items={[
            'Complaints must be submitted in writing.',
            'All complaints are investigated fairly and promptly.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Governing Law">
        <p>These Terms are governed by the laws of England &amp; Wales.</p>
      </PolicySection>
    </PolicyPageLayout>
  );
};

export default TermsOfServicePage;
