
import React from 'react';
import PolicyPageLayout from '@/components/PolicyPageLayout';
import DataProtectionContent from '@/components/DataProtectionContent';

const PrivacyPolicyPage: React.FC = () => {
  return (
    <PolicyPageLayout title="Privacy Policy (GDPR)">
      <DataProtectionContent />
    </PolicyPageLayout>
  );
};

export default PrivacyPolicyPage;
