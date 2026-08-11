import './globals.css';
import type { ReactNode } from 'react';
import Script from 'next/script';
import Providers from './providers';

const GOOGLE_ADS_ID = 'AW-18370543581';

export const metadata = {
  title: 'Velvet Drivers',
  description: 'Luxury chauffeur services',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-ads-tag" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GOOGLE_ADS_ID}');
          `}
        </Script>
      </body>
    </html>
  );
}
