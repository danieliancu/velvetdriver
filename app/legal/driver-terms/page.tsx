import PolicyPageLayout, { PolicyList, PolicySection } from '@/components/PolicyPageLayout';

export default function DriverTermsPage() {
  return (
    <PolicyPageLayout title="Driver Terms &amp; Conditions">
      <PolicySection title="1. Introduction">
        <p>
          These Terms and Conditions set out the standards, responsibilities, and expectations for all drivers engaged by Velvet Drivers Limited
          (&quot;the Company&quot;). By driving for Velvet Drivers Limited you agree to comply with these Terms and all applicable laws and Transport for
          London (TfL) regulations.
        </p>
      </PolicySection>

      <PolicySection title="2. Licensing and Compliance">
        <PolicyList
          items={[
            'Drivers must hold and maintain a valid TfL private hire driver licence and provide copies to Velvet Drivers Limited on request.',
            'Drivers must ensure their private hire vehicle licence, MOT, road tax, and insurance are valid at all times.',
            'Drivers must notify Velvet Drivers Limited immediately of any change to their licence, insurance, criminal record, or medical condition that may affect their ability to drive.',
            'Drivers must comply with all TfL regulations, road traffic legislation, and Velvet Drivers Limited policies and procedures.',
          ]}
        />
      </PolicySection>

      <PolicySection title="3. Conduct and Professionalism">
        <PolicyList
          items={[
            'Drivers must act professionally, respectfully, and courteously towards all passengers, staff, and third parties while representing Velvet Drivers Limited.',
            'Discrimination, harassment, abuse, or inappropriate behaviour is strictly prohibited.',
            'Drivers must be well presented, maintain good personal hygiene, and wear suitable clothing when working.',
            'Vehicles must be kept clean, safe, and presentable at all times.',
          ]}
        />
      </PolicySection>

      <PolicySection title="4. Bookings and Work Allocation">
        <PolicyList
          items={[
            'All journeys must be pre-booked and dispatched through Velvet Drivers Limited in accordance with TfL regulations.',
            'Drivers must not accept street hails or operate independently of Velvet Drivers Limited using its licences or branding.',
            'Drivers must not arrange private bookings or accept cash or alternative payments directly from passengers outside the authorised process.',
            'Any booking declined or cancelled by the driver must be reported to Velvet Drivers Limited with a reason.',
          ]}
        />
      </PolicySection>

      <PolicySection title="5. Fares, Payments, and Charges">
        <PolicyList
          items={[
            'Fares, waiting time, and additional charges are calculated and set by Velvet Drivers Limited and/or agreed with the passenger at the time of booking.',
            'Drivers must not overcharge, request unauthorised tips, or negotiate separate fares with passengers.',
            'All payments for bookings must be processed in accordance with Velvet Drivers Limited procedures.',
          ]}
        />
      </PolicySection>

      <PolicySection title="6. Safety and Vehicle Standards">
        <PolicyList
          items={[
            'Drivers must drive safely and responsibly, obeying all speed limits and traffic laws.',
            'Seat belts must be worn by the driver and passengers must be encouraged to wear them.',
            'Drivers must not drive under the influence of alcohol, drugs, or any impairing substances.',
            'Any accident, incident, breakdown, or safety concern must be reported to Velvet Drivers Limited as soon as possible.',
          ]}
        />
      </PolicySection>

      <PolicySection title="7. Passenger Care and Confidentiality">
        <PolicyList
          items={[
            'Drivers must provide reasonable assistance to passengers where safe to do so.',
            'Passenger details and any information obtained must remain confidential.',
            'Data must only be used for completing the booked journey in accordance with GDPR.',
          ]}
        />
      </PolicySection>

      <PolicySection title="8. Complaints and Investigations">
        <p>Drivers must cooperate fully with any investigation by Velvet Drivers Limited, TfL, the police, or any relevant authority.</p>
      </PolicySection>

      <PolicySection title="9. Termination">
        <PolicyList
          items={[
            "Velvet Drivers Limited may suspend or terminate a driver's agreement for serious or repeated breaches of these Terms, TfL rules, or the law.",
            'Drivers may cease working by providing reasonable notice.',
          ]}
        />
      </PolicySection>

      <PolicySection title="10. Acceptance">
        <p>By undertaking bookings, the driver confirms acceptance of these Terms and Conditions.</p>
      </PolicySection>
    </PolicyPageLayout>
  );
}
