import React from 'react';
import PolicyPageLayout, { PolicySection, PolicyList } from '@/components/PolicyPageLayout';

const CorporateTermsPage: React.FC = () => {
  return (
    <PolicyPageLayout title="Corporate Account Terms">
      <PolicySection title="Eligibility & Bookings">
        <PolicyList
          items={[
            'Accounts available to registered businesses.',
            'All journeys must be pre-booked.',
            'Fares set by operator; extras may apply.',
            'Cancellations follow the Cancellation & Refund Policy.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Invoicing & Payments">
        <PolicyList
          items={[
            'Invoices can be monthly or per journey.',
            'Payment due within 14 days.',
            'Late payment may suspend the account and incur interest.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Liability & Data">
        <PolicyList
          items={[
            'Operator not liable for delays outside control.',
            'Data processed under GDPR.',
          ]}
        />
      </PolicySection>
    </PolicyPageLayout>
  );
};

export default CorporateTermsPage;
