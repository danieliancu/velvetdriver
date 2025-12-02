'use client';

import React, { createContext, useCallback, useContext, useState } from 'react';

type AlertContextType = {
  showAlert: (message: string) => void;
};

const AlertContext = createContext<AlertContextType | null>(null);

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [message, setMessage] = useState<string | null>(null);

  const showAlert = useCallback((msg: string) => {
    setMessage(msg);
  }, []);

  const closeAlert = useCallback(() => {
    setMessage(null);
  }, []);

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}
      {message && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
          <div className="w-full max-w-md rounded-2xl border border-white/20 bg-black/90 p-6 text-left text-white shadow-2xl">
            <p className="mb-4 text-sm text-gray-200">{message}</p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={closeAlert}
                className="rounded-full border border-amber-400 bg-amber-400 px-4 py-2 text-sm font-semibold uppercase tracking-wider text-black transition hover:bg-white/90"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </AlertContext.Provider>
  );
};

export default AlertProvider;
