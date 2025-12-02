
import React from 'react';

interface BookingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  id: string;
  icon?: React.ReactNode;
}

const BookingInput = React.forwardRef<HTMLInputElement, BookingInputProps>(({ label, id, icon, ...props }, ref) => {
  return (
    <div className="flex flex-col gap-1 w-full">
      <label htmlFor={id} className="text-xs font-bold uppercase text-amber-200/70 tracking-wider">
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          ref={ref}
          id={id}
          className={`w-full bg-[#2a1a1a] border border-amber-900/60 rounded-md py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 ${icon ? 'pl-3 pr-10' : 'px-3'} `}
          {...props}
        />
        {icon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
});

BookingInput.displayName = 'BookingInput';

export default BookingInput;
