
import React from 'react';
import PolicyPageLayout, { PolicySection, PolicyList } from '@/components/PolicyPageLayout';

const CookiePolicyPage: React.FC = () => {
  return (
    <PolicyPageLayout title="Cookie Notice">
      <p>Our website uses cookies. This notice explains what cookies are, how we use them, and your choices regarding their use.</p>
      
      <PolicySection title="1. What are cookies?">
        <p>Cookies are small text files that are placed on your computer or mobile device when you visit a website. They are widely used to make websites work, or work more efficiently, as well as to provide information to the owners of the site.</p>
      </PolicySection>
      
      <PolicySection title="2. How we use cookies">
        <p>Our website uses cookies for:</p>
        <PolicyList items={[
          "Security: To help secure our website and protect against malicious activity.",
          "Functionality: To enable essential website features and remember your preferences.",
          "Performance: To collect information about how you use our website, so we can improve it.",
          "Analytics (if enabled): To understand user activity and improve our services."
        ]} />
      </PolicySection>
      
      <PolicySection title="3. Your choices">
        <p>You may accept or decline non-essential cookies. Most web browsers automatically accept cookies, but you can usually modify your browser setting to decline cookies if you prefer. This may prevent you from taking full advantage of the website.</p>
      </PolicySection>

    </PolicyPageLayout>
  );
};

export default CookiePolicyPage;
