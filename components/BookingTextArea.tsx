
import React from 'react';

interface BookingTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  id: string;
}

const BookingTextArea: React.FC<BookingTextAreaProps> = ({ label, id, ...props }) => {
  return (
    <div className="flex flex-col gap-1 w-full">
      <label htmlFor={id} className="text-xs font-bold uppercase text-amber-200/70 tracking-wider">
        {label}
      </label>
      <textarea
        id={id}
        rows={3}
        className="w-full bg-[#2a1a1a] border border-amber-900/60 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 resize-none"
        {...props}
      />
    </div>
  );
};

export default BookingTextArea;
