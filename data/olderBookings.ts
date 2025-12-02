export type OlderBooking = {
  id: string;
  date: string;
  time: string;
  pickup: string;
  dropOffs: string[];
  passengerName: string;
  passengerPhone: string;
  driverName: string;
  vehicle: string;
  numberPlate: string;
  notes: string;
  fareQuoted: number;
  bookingCreated: string; // ISO or human-readable datetime
  bookingAccepted?: string;
  bookedBy: string;
  method: 'phone' | 'email' | 'website' | 'app';
};

export const olderBookingsData: OlderBooking[] = [
  {
    id: 'VD-0978',
    date: '2025-11-10',
    time: '07:35',
    pickup: 'Heathrow Terminal 2',
    dropOffs: ['The Langham London'],
    passengerName: 'Elena Brooks',
    passengerPhone: '+44 7700 112233',
    driverName: 'James P.',
    vehicle: 'Mercedes-Benz S-Class',
    numberPlate: 'EK70 MJK',
    notes: 'Baby seat ready, arrival from Munich.',
    fareQuoted: 142.5,
    bookingCreated: '2025-11-08 18:45',
    bookingAccepted: '2025-11-08 19:05',
    bookedBy: 'Roxana Viulet',
    method: 'phone'
  },
  {
    id: 'VD-0974',
    date: '2025-11-10',
    time: '11:20',
    pickup: 'London City Airport',
    dropOffs: ['Grosvenor House'],
    passengerName: 'Marco Silva',
    passengerPhone: '+44 7700 443322',
    driverName: 'Robert K.',
    vehicle: 'BMW 7 Series',
    numberPlate: 'LS24 VWP',
    notes: 'Corporate guest, needs Wi-Fi and water on board.',
    fareQuoted: 118,
    bookingCreated: '2025-11-08 18:45',
    bookingAccepted: '2025-11-08 19:20',
    bookedBy: 'Roxana Viulet',
    method: 'website'
  },
  {
    id: 'VD-0969',
    date: '2025-11-09',
    time: '19:15',
    pickup: 'Gatwick South Terminal',
    dropOffs: ['St. Pancras International'],
    passengerName: 'Amina Patel',
    passengerPhone: '+44 7700 556677',
    driverName: 'David C.',
    vehicle: 'Range Rover Autobiography',
    numberPlate: 'VX57 RFD',
    notes: 'Waiting for clients from Zurich.',
    fareQuoted: 165,
    bookingCreated: '2025-11-08 22:05',
    bookingAccepted: '2025-11-08 22:20',
    bookedBy: 'Roxana Viulet',
    method: 'phone'
  },
  {
    id: 'VD-0965',
    date: '2025-11-09',
    time: '08:05',
    pickup: 'Heathrow Terminal 5',
    dropOffs: ['The Ritz London'],
    passengerName: 'Charles Montgomery',
    passengerPhone: '+44 7700 778899',
    driverName: 'James P.',
    vehicle: 'Mercedes-Benz Maybach',
    numberPlate: 'PE21 ACR',
    notes: 'Requires cool towels and privacy screen.',
    fareQuoted: 210,
    bookingCreated: '2025-11-08 11:30',
    bookingAccepted: '2025-11-08 12:05',
    bookedBy: 'Roxana Viulet',
    method: 'email'
  },
  {
    id: 'VD-0958',
    date: '2025-11-08',
    time: '13:50',
    pickup: 'St. Pancras International',
    dropOffs: ['Gatwick North Terminal'],
    passengerName: 'Naomi Rivers',
    passengerPhone: '+44 7700 990011',
    driverName: 'Robert K.',
    vehicle: 'Audi A8 L',
    numberPlate: 'DN21 YLO',
    notes: 'Late afternoon cancellation, rebooked.',
    fareQuoted: 132,
    bookingCreated: '2025-11-07 09:10',
    bookingAccepted: '2025-11-07 09:35',
    bookedBy: 'Roxana Viulet',
    method: 'phone'
  },
  {
    id: 'VD-0951',
    date: '2025-11-07',
    time: '05:55',
    pickup: 'Heathrow Terminal 3',
    dropOffs: ['Wimbledon Village'],
    passengerName: 'Liam Gallagher',
    passengerPhone: '+44 7700 223344',
    driverName: 'David C.',
    vehicle: 'Bentley Flying Spur',
    numberPlate: 'LR75 QNE',
    notes: 'Early arrival, premium security clearance.',
    fareQuoted: 188,
    bookingCreated: '2025-11-06 19:50',
    bookingAccepted: '2025-11-06 20:10',
    bookedBy: 'Roxana Viulet',
    method: 'phone'
  },
  {
    id: 'VD-0945',
    date: '2025-11-07',
    time: '15:45',
    pickup: 'London Bridge Station',
    dropOffs: ['Four Seasons Ten Trinity Square'],
    passengerName: 'Hannah Lee',
    passengerPhone: '+44 7700 665544',
    driverName: 'Anna B.',
    vehicle: 'Tesla Model S',
    numberPlate: 'EV13 TES',
    notes: 'EV ride requested with quiet cabin.',
    fareQuoted: 124,
    bookingCreated: '2025-11-06 12:05',
    bookingAccepted: '2025-11-06 12:20',
    bookedBy: 'Roxana Viulet',
    method: 'website'
  },
  {
    id: 'VD-0942',
    date: '2025-11-06',
    time: '20:10',
    pickup: 'Kings Cross St Pancras',
    dropOffs: ['The Savoy'],
    passengerName: 'Roy Turner',
    passengerPhone: '+44 7700 334455',
    driverName: 'Oliver T.',
    vehicle: 'Jaguar XJ',
    numberPlate: 'JM52 GKF',
    notes: 'VIP with late arrival, meet at platform 9.',
    fareQuoted: 96,
    bookingCreated: '2025-11-05 23:15',
    bookingAccepted: '2025-11-05 23:30',
    bookedBy: 'Roxana Viulet',
    method: 'app'
  }
];
