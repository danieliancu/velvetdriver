import React from 'react';
import PolicyPageLayout, { PolicySection, PolicyList } from '@/components/PolicyPageLayout';

const CorporatePoliciesPage: React.FC = () => {
  return (
    <PolicyPageLayout title="Corporate Terms and Conditions">
      <PolicySection title="Account Eligibility">
        <PolicyList
          items={[
            'Corporate accounts are available to registered businesses subject to approval by Velvet Drivers Limited.',
            'The operator reserves the right to refuse or withdraw account facilities at any time.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Booking Requirements">
        <PolicyList
          items={[
            'All journeys must be pre-booked through Velvet Drivers Limited via website, email, or an approved corporate method.',
            'No unbooked journeys or direct bookings with drivers are permitted.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Fares & Charges">
        <PolicyList
          items={[
            'Fares are calculated and confirmed by the operator.',
            'Additional charges (waiting time, parking, congestion zones, tolls) may apply.',
            'Clients will be notified of such charges on the final invoice.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Cancellations">
        <PolicyList
          items={[
            'Cancellations must be made in accordance with the Cancellation & Refund Policy.',
            'Late cancellations or no-shows may be chargeable.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Invoicing">
        <PolicyList
          items={[
            'Invoices are issued monthly or per journey depending on the corporate agreement.',
            'Clients are responsible for ensuring accurate billing details are provided.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Payments">
        <PolicyList
          items={[
            'Payment must be made within 14 days from the invoice date.',
            'Failure to settle invoices may result in suspension or termination of the corporate account.',
            'Velvet Drivers Limited reserves the right to charge interest on overdue invoices.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Liability">
        <PolicyList
          items={[
            'Velvet Drivers Limited is not liable for delays caused by circumstances beyond its control including traffic, weather, or road closures.',
            'Corporate clients are responsible for ensuring authorised individuals use the account.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Data Protection">
        <PolicyList
          items={[
            'Corporate client data is processed in accordance with GDPR and the company Privacy Policy.',
            'Booking and passenger information is stored securely for 12 months as required by TfL.',
          ]}
        />
      </PolicySection>
    </PolicyPageLayout>
  );
};

export default CorporatePoliciesPage;
