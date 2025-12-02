
export enum Role {
  GUEST,
  CLIENT,
  DRIVER,
  ADMIN
}

export interface User {
  id?: number;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
}

export interface Journey {
  id: number | string;
  date: string;
  pickup: string;
  destination: string;
  serviceType: 'Transfer' | 'Wait and Return' | 'As Directed';
  driver: string;
  car: string;
  plate: string;
  status: 'Completed' | 'Upcoming' | 'Cancelled';
  price: number;
  invoiceUrl?: string | null;
}

export interface SavedQuote {
  id: number | string;
  label?: string | null;
  createdAt?: string;
  payload: Record<string, any>;
}

export interface Booking {
  id: string;
  pickup: string;
  dropOffs: string[];
  date: string;
  time: string;
  vehicle: string;
  passengers: string;
  serviceType: string;
  smallSuitcases: string;
  largeSuitcases: string;
  waiting: string;
  miles: string;
  passengerName: string;
  passengerEmail: string;
  passengerPhone: string;
  specialEvents: string;
  notes: string;
  status: 'Pending Confirmation' | 'Driver Assigned' | 'Completed';
}
