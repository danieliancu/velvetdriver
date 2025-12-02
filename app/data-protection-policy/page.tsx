import React from 'react';
import PolicyPageLayout from '@/components/PolicyPageLayout';
import DataProtectionContent from '@/components/DataProtectionContent';

const DataProtectionPolicyPage: React.FC = () => {
  return (
    <PolicyPageLayout title="Data Protection & GDPR Policy">
      <DataProtectionContent />
    </PolicyPageLayout>
  );
};

export default DataProtectionPolicyPage;
