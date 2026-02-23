
'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div 
      className="fixed inset-0 bg-black/90 flex items-start sm:items-center justify-center p-4 z-[99999] overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl my-4 sm:my-0 max-h-[calc(100vh-2rem)] bg-gradient-to-br from-[#1E1212] via-[#100808] to-black border border-amber-900/50 rounded-2xl p-8 shadow-2xl shadow-red-950/50 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>
        <h2 className="text-2xl font-bold font-display text-amber-400 mb-6 pr-10 shrink-0">{title}</h2>
        <div className="overflow-y-auto min-h-0">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
