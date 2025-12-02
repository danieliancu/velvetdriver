import PolicyPageLayout from '@/components/PolicyPageLayout';
import { PolicySection, PolicyList } from '@/components/PolicyPageLayout';

export default function DriverHubPage() {
  return (
    <PolicyPageLayout title="Driver Terms & Conditions">
      <p>
        These Terms and Conditions set out the standards, responsibilities, and expectations for all drivers engaged by Velvet Drivers Limited.
      </p>

      <PolicySection title="1. Introduction">
        <p>By driving for Velvet Drivers Limited you agree to comply with these Terms and all applicable laws and Transport for London (TfL) regulations.</p>
      </PolicySection>

      <PolicySection title="2. Licensing and Compliance">
        <PolicyList
          items={[
            'Maintain a valid TfL private hire driver licence and provide copies on request.',
            'Keep private hire vehicle licence, MOT, road tax, and insurance valid at all times.',
            'Notify Velvet Drivers Limited immediately of changes to licence, insurance, criminal record, or medical condition.',
            'Comply with all TfL regulations, road traffic legislation, and Velvet Drivers Limited policies and procedures.',
          ]}
        />
      </PolicySection>

      <PolicySection title="3. Conduct and Professionalism">
        <PolicyList
          items={[
            'Act professionally, respectfully, and courteously towards passengers, staff, and third parties.',
            'No discrimination, harassment, abuse, or inappropriate behaviour.',
            'Be well presented with good personal hygiene and suitable clothing.',
            'Keep vehicles clean, safe, and presentable at all times.',
          ]}
        />
      </PolicySection>

      <PolicySection title="4. Bookings and Work Allocation">
        <PolicyList
          items={[
            'All journeys must be pre-booked and dispatched through Velvet Drivers Limited in accordance with TfL regulations.',
            'Do not accept street hails or operate independently using Company licences or branding.',
            'Do not arrange private bookings or accept cash/alternative payments directly outside the authorised process.',
            'Report any booking declined or cancelled to Velvet Drivers Limited with a reason.',
          ]}
        />
      </PolicySection>

      <PolicySection title="5. Fares, Payments, and Charges">
        <PolicyList
          items={[
            'Fares, waiting time, and additional charges are set by Velvet Drivers Limited and/or agreed at the time of booking.',
            'Do not overcharge, request unauthorised tips, or negotiate separate fares with passengers.',
            'Process all payments in accordance with Velvet Drivers Limited procedures.',
          ]}
        />
      </PolicySection>

      <PolicySection title="6. Safety and Vehicle Standards">
        <PolicyList
          items={[
            'Drive safely and responsibly, obeying all speed limits and traffic laws.',
            'Seat belts must be worn by the driver and passengers must be encouraged to wear them.',
            'Never drive under the influence of alcohol, drugs, or impairing substances.',
            'Report accidents, incidents, breakdowns, or safety concerns to Velvet Drivers Limited as soon as possible.',
          ]}
        />
      </PolicySection>

      <PolicySection title="7. Passenger Care and Confidentiality">
        <PolicyList
          items={[
            'Provide reasonable assistance to passengers where safe to do so.',
            'Keep passenger details confidential and use data only for completing the booked journey in accordance with GDPR.',
          ]}
        />
      </PolicySection>

      <PolicySection title="8. Complaints and Investigations">
        <p>Cooperate fully with any investigation by Velvet Drivers Limited, TfL, the police, or any relevant authority.</p>
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
