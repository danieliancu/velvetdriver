
import React from 'react';
import { ChevronDown } from 'lucide-react';

interface BookingSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  id: string;
  children: React.ReactNode;
}

const BookingSelect: React.FC<BookingSelectProps> = ({ label, id, children, ...props }) => {
  return (
    <div className="flex flex-col gap-1 w-full">
      <label htmlFor={id} className="text-xs font-bold uppercase text-amber-200/70 tracking-wider">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          className="w-full appearance-none bg-[#2a1a1a] border border-amber-900/60 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
          {...props}
        >
          {children}
        </select>
        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
          <ChevronDown size={20} className="text-gray-400" />
        </div>
      </div>
    </div>
  );
};

export default BookingSelect;
