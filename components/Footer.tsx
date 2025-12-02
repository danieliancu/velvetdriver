
'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

const FooterLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <li>
    <Link href={href} className="hover:text-amber-400 transition-colors text-gray-400 text-sm">
      {children}
    </Link>
  </li>
);

const Footer = () => {
  return (
    <footer className="w-full py-12 px-4 text-gray-500 z-10 relative">
      <div className="max-w-7xl mx-auto border-t border-white/10 pt-10">
        <div className="flex flex-col md:flex-row items-start gap-10 md:gap-16">
          <div className="flex flex-col items-start gap-3 md:max-w-xs">
            <Link href="/" className="shrink-0">
              <img src="/assets/logo.png" alt="Velvet Drivers Logo" className="w-32 h-auto" />
            </Link>
            <div className="text-sm text-gray-400">
              <p className="text-white font-semibold">Velvet Drivers Limited</p>
              <p>Licensed, professional, and passenger-first private hire services.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 md:gap-10 w-full md:w-auto md:ml-auto">
            <div className="min-w-[170px]">
              <h4 className="font-bold font-display text-white text-lg mb-4">Discover</h4>
              <ul className="space-y-2">
                <FooterLink href="/blog">Our Blog</FooterLink>
                <FooterLink href="/reviews">Client Reviews</FooterLink>
                <FooterLink href="/about">About Us</FooterLink>
                <FooterLink href="/website-map">Sitemap</FooterLink>
              </ul>
            </div>
            <div className="min-w-[170px]">
              <h4 className="font-bold font-display text-white text-lg mb-4">Company</h4>
              <ul className="space-y-2">
                <FooterLink href="/client/login">Client</FooterLink>
                <FooterLink href="/driver/login">Driver</FooterLink>
                <FooterLink href="/booking">Booking</FooterLink>
                <FooterLink href="/corporate/login">Corporate</FooterLink>
              </ul>
            </div>
            <div className="min-w-[170px]">
              <h4 className="font-bold font-display text-white text-lg mb-4">Legal</h4>
              <ul className="space-y-2">
                <FooterLink href="/legal/operator-policies">Operator Policies</FooterLink>
                <FooterLink href="/legal/passenger-policies">Passenger Policies</FooterLink>
                <FooterLink href="/legal/corporate">Corporate</FooterLink>
                <FooterLink href="/corporate-payment-policy">Corporate Payment Policy</FooterLink>
                <FooterLink href="/legal/safety-accessibility">Safety &amp; Accessibility</FooterLink>
                <FooterLink href="/legal/driver-terms">Driver Terms</FooterLink>
                <FooterLink href="/legal/privacy-data">Privacy &amp; Data</FooterLink>
              </ul>
            </div>
            <div className="min-w-[170px]">
              <h4 className="font-bold font-display text-white text-lg mb-4">Support</h4>
              <ul className="space-y-2">
                <FooterLink href="/client/login#complain">Complain</FooterLink>
                <FooterLink href="/client/login#review">Review</FooterLink>
                <FooterLink href="/client/login#lost-property">Lost Property</FooterLink>
                <FooterLink href="/contact">Contact Us</FooterLink>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-12 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} Velvet Drivers. All Rights Reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
