'use client';

import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { Booking } from '@/types';

type BookingContextType = {
  bookings: Booking[];
  addBooking: (bookingData: Omit<Booking, 'id' | 'status'>) => void;
};

const BookingContext = createContext<BookingContextType | null>(null);

export const useBookings = () => {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBookings must be used within a BookingProvider');
  }
  return context;
};

export function BookingProvider({ children }: { children: ReactNode }) {
  const [bookings, setBookings] = useState<Booking[]>([]);

  const addBooking = (bookingData: Omit<Booking, 'id' | 'status'>) => {
    const newBooking: Booking = {
      ...bookingData,
      id: `VD-${1001 + bookings.length}`,
      status: 'Pending Confirmation',
    };
    setBookings((prev) => [...prev, newBooking]);
  };

  return <BookingContext.Provider value={{ bookings, addBooking }}>{children}</BookingContext.Provider>;
}
