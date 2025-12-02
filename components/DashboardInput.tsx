
import React from 'react';

type DashboardInputProps = {
    label: string;
    id: string;
    type?: string;
    value?: string;
    readOnly?: boolean;
    required?: boolean;
    autoComplete?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    placeholder?: string;
};

const DashboardInput: React.FC<DashboardInputProps> = ({ label, id, ...props }) => (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-amber-200/70 uppercase tracking-wider mb-2">
        {label}
      </label>
      <input
        id={id}
        className="w-full bg-gray-900 border border-amber-900/60 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50"
        {...props}
      />
    </div>
);

export default DashboardInput;
