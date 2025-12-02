import React from 'react';
import PolicyPageLayout, { PolicySection, PolicyList } from '@/components/PolicyPageLayout';

const CorporatePaymentPolicyPage: React.FC = () => {
  return (
    <PolicyPageLayout title="Corporate Payment Policy">
      <PolicySection title="Purpose">
        <p className="text-sm text-gray-200 leading-relaxed">
          This Corporate Payment Policy outlines how Velvet Drivers Limited manages billing, invoicing, and payments for
          approved corporate clients in full compliance with TfL regulations.
        </p>
      </PolicySection>

      <PolicySection title="Accepted Payment Methods">
        <PolicyList
          items={[
            'Monthly consolidated invoice (subject to approval).',
            'Bank transfer.',
            'Online payment link (Stripe/SumUp).',
            'Card or cash to chauffeur (pre-booked journeys only).',
          ]}
        />
      </PolicySection>

      <PolicySection title="Billing Structure">
        <PolicyList
          items={[
            'Corporate clients may receive a monthly consolidated invoice summarising all journeys within the billing period.',
            'Each journey remains individually pre-booked and recorded, as required by TfL.',
            'Itemised invoices include passenger name/department, date, pickup, destination, fare, and waiting time (if applicable).',
          ]}
        />
      </PolicySection>

      <PolicySection title="Payment Terms">
        <PolicyList
          items={[
            'Payment terms for corporate accounts are strictly a maximum of 14 days from the invoice date.',
            'Late payments may incur interest charges at the statutory rate.',
            'Invoices are sent via email to the designated accounts contact.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Driver Handling of Payments">
        <PolicyList
          items={[
            'Drivers may accept card or cash payments for pre-booked journeys.',
            'All funds received by drivers are the property of Velvet Drivers Limited and must be reported immediately.',
            'Drivers are not permitted to negotiate or alter fares.',
          ]}
        />
      </PolicySection>

      <PolicySection title="Record Keeping">
        <PolicyList
          items={[
            'All booking and payment records are securely stored for a minimum of 12 months.',
            'Corporate billing information is managed in accordance with GDPR and the company Privacy Policy.',
          ]}
        />
      </PolicySection>
    </PolicyPageLayout>
  );
};

export default CorporatePaymentPolicyPage;
