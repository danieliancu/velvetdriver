
import React from 'react';
import { ChevronDown } from 'lucide-react';

interface DashboardSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  id: string;
  children: React.ReactNode;
}

const DashboardSelect: React.FC<DashboardSelectProps> = ({ label, id, children, ...props }) => (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-amber-200/70 uppercase tracking-wider mb-2">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          className="w-full appearance-none bg-gray-900 border border-amber-900/60 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
          {...props}
        >
          {children}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none">
          <ChevronDown size={20} className="text-gray-400" />
        </div>
      </div>
    </div>
);

export default DashboardSelect;