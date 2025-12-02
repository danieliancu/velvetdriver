import '../global.css';
import type { ReactNode } from 'react';
import Providers from './providers';

export const metadata = {
  title: 'Velvet Drivers',
  description: 'Luxury chauffeur services',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
