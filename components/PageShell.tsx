'use client';

import React from 'react';
import Header from './Header';
import Footer from './Footer';

interface PageShellProps {
  children: React.ReactNode;
  mainClassName?: string;
  decorations?: React.ReactNode;
  hideFooter?: boolean;
  hideHeader?: boolean;
}

const PageShell: React.FC<PageShellProps> = ({
  children,
  mainClassName = '',
  decorations,
  hideFooter = false,
  hideHeader = false
}) => {
  return (
    <div className="min-h-screen w-full bg-black text-white overflow-hidden relative flex flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-950/80 via-black to-black opacity-80"></div>
      {decorations}
      {!hideHeader && <Header />}
      <main className={`relative z-10 flex-grow px-4 sm:px-6 lg:px-8 py-10 ${mainClassName}`}>
        {children}
      </main>
      {!hideFooter && <Footer />}
    </div>
  );
};

export default PageShell;
