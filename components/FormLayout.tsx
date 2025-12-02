
'use client';

import React from 'react';
import PageShell from './PageShell';

const FormLayout: React.FC<{ children: React.ReactNode; title: string }> = ({ children, title }) => {
  return (
    <PageShell mainClassName="flex flex-col items-center justify-center py-16">
      <div className="relative z-10 w-full max-w-md bg-black/30 border border-white/10 rounded-2xl shadow-2xl shadow-red-950/50 backdrop-blur-lg p-8">
        <h2 className="text-4xl font-bold font-display text-center mb-8 text-amber-400">{title}</h2>
        {children}
      </div>
    </PageShell>
  );
};

export default FormLayout;
