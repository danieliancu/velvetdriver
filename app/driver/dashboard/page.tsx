'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useAlert } from '@/components/AlertProvider';
import { Clock, User, Car } from 'lucide-react';
import PageShell from '@/components/PageShell';
import DashboardInput from '@/components/DashboardInput';

const mockJobs = [
    { id: 'j1', client: 'Alice Wonderland', time: '14:30', pickup: 'Heathrow T5', destination: 'The Ritz Hotel', pay: 75.00 },
    { id: 'j2', client: 'Bob Builder', time: '18:00', pickup: 'Canary Wharf', destination: 'Gatwick North', pay: 90.00 },
];

const mockCompletedJobs = [
    { id: 'c1', client: 'Charlie Chaplin', time: '2023-10-28 10:00', pickup: 'The Savoy', destination: 'Heathrow T2', pay: 80.00 },
    { id: 'c2', client: 'Diana Prince', time: '2023-10-25 15:00', pickup: 'Buckingham Palace', destination: 'Windsor Castle', pay: 120.00 },
    { id: 'c3', client: 'Peter Parker', time: '2023-10-22 09:00', pickup: 'Daily Bugle', destination: 'Stark Tower', pay: 55.00 },
];

const mockStatementData = [
    { date: '2025-09-01', ref: 'VD-1001', pickup: 'WD3 4PQ', dropoff: 'Heathrow T5', vehicle: 'Saloon', miles: 18, wait: 10, fare: 64.00 },
    { date: '2025-09-03', ref: 'VD-1002', pickup: 'HA4 0HJ', dropoff: 'LHR T3', vehicle: 'MPV', miles: 12, wait: 0, fare: 52.50 },
];

type DocumentItem = {
    name: string;
    type: 'jpg' | 'png' | 'pdf' | 'docx';
};

const mockCars = [
    {
        id: 'car-1',
        vrm: 'LC20 ABC',
        make: 'Mercedes-Benz',
        model: 'S-Class',
        motExpiry: '2025-10-15',
        insuranceExpiry: '2025-08-31',
        phvExpiry: '2025-09-20',
        logbookStatus: 'Uploaded',
        otherDocumentsStatus: 'Uploaded',
        otherDocuments: [
            { name: 'inspection-sheet.jpg', type: 'jpg' },
            { name: 'service-log.png', type: 'png' },
            { name: 'driver-certification.pdf', type: 'pdf' }
        ] as DocumentItem[],
    },
    {
        id: 'car-2',
        vrm: 'BD68 XYZ',
        make: 'BMW',
        model: '7 Series',
        motExpiry: '2026-01-22',
        insuranceExpiry: '2025-12-01',
        phvExpiry: '2026-01-10',
        logbookStatus: 'Uploaded',
        otherDocumentsStatus: 'Not uploaded',
        otherDocuments: [] as DocumentItem[],
    }
];

const actionButtonClass = (isSaving: boolean) =>
  `px-10 py-2.5 font-semibold rounded-lg transition-colors ${
    isSaving ? 'bg-green-600 text-white hover:bg-green-500' : 'bg-amber-500 text-black hover:bg-amber-400'
  }`;
const uploadButtonClass = "cursor-pointer bg-amber-500 text-black px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-400 transition-colors";

const DriverJobs: React.FC = () => (
    <div>
        <h2 className="text-2xl font-semibold mb-4">Tomorrow's Jobs</h2>
        {mockJobs.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {mockJobs.map(job => (
                <div key={job.id} className="bg-gray-900/50 border border-gray-800 rounded-lg p-6 space-y-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-xl font-bold text-amber-400">{job.pickup}</h3>
                            <p className="text-lg text-white">to {job.destination}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-bold flex items-center gap-2"><Clock size={20} /> {job.time}</p>
                        </div>
                    </div>
                    <div className="border-t border-gray-700 pt-4 space-y-2">
                    <p className="flex items-center gap-2 text-gray-300"><User size={16} /> Client: {job.client}</p>
                    <p className="text-gray-300">Est. Pay: £{job.pay.toFixed(2)}</p>
                    </div>
                    <div className="flex gap-4 pt-2">
                        <button className="flex-1 px-4 py-2 bg-green-600/80 hover:bg-green-600 rounded-md transition-colors">Accept</button>
                        <button className="flex-1 px-4 py-2 bg-red-600/80 hover:bg-red-600 rounded-md transition-colors">Decline</button>
                    </div>
                </div>
            ))}
        </div>
        ) : (
        <div className="text-center py-16 bg-gray-900/50 border border-gray-800 rounded-lg">
            <p className="text-gray-400">No new jobs available at the moment.</p>
        </div>
        )}

        <h2 className="text-2xl font-semibold mt-12 mb-4">Completed Jobs</h2>
        <div className="space-y-3">
            {mockCompletedJobs.map(job => (
                <div
                  key={job.id}
                  className="rounded-lg border border-gray-800 bg-gray-900/60 px-4 py-3 shadow-inner shadow-black/30"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <p className="text-base font-semibold text-white">
                      {job.pickup} <span className="text-amber-300">to</span> {job.destination}
                    </p>
                    <p className="text-sm text-gray-300 flex items-center gap-2">
                      <Clock size={14} /> {job.time}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-2 text-sm text-gray-300">
                    <span className="flex items-center gap-2"><User size={14} /> Client: {job.client}</span>
                    <span className="font-semibold text-white">Pay: £{job.pay.toFixed(2)}</span>
                  </div>
                </div>
            ))}
        </div>
    </div>
);
  
type StatusVariant = 'success' | 'warning' | 'neutral';
const statusVariantStyles: Record<StatusVariant, string> = {
  success: 'bg-emerald-600',
  warning: 'bg-amber-600',
  neutral: 'bg-gray-600'
};
const inferStatusVariant = (text: string): StatusVariant => {
  const normalized = text.toLowerCase();
  if (normalized.includes('not')) return 'warning';
  if (normalized.includes('upload')) return 'success';
  return 'neutral';
};

const StatusPill: React.FC<{ text: string; variant?: StatusVariant }> = ({ text, variant }) => {
  const appliedVariant = variant || inferStatusVariant(text);
  return (
    <span className={`text-[11px] font-semibold rounded-full px-3 py-0.5 text-white ${statusVariantStyles[appliedVariant]}`}>
      {text}
    </span>
  );
};

const NewUploadButton: React.FC<{ htmlFor: string }> = ({ htmlFor }) => (
  <label
    htmlFor={htmlFor}
    className="rounded-full border border-amber-500 bg-amber-500 px-4 py-1 text-xs font-semibold text-black uppercase transition hover:bg-amber-400 cursor-pointer"
  >
    New Upload
  </label>
);

const UploadStatusItem: React.FC<{ label: string }> = ({ label }) => {
  const id = `upload-${label.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 border-b border-amber-900/40">
      <span className="text-white/90 text-sm">{label}</span>
      <div className="flex items-center gap-3">
        <StatusPill text="Uploaded" />
        <NewUploadButton htmlFor={id} />
        <input id={id} type="file" className="hidden" />
      </div>
    </div>
  );
};
  
const initialDriverDetails = {
  firstName: 'Daniel',
  lastName: 'Iancu',
  email: 'daniel@velvetdrivers.co.uk',
  phone: '+44 7700 112233',
  drivingLicense: 'D1234567',
  address: '25 Green Park, London',
  pcoLicenceNo: 'PCO-908172',
  pcoExpiry: '2026-10-15'
};

const DriverProfile = () => {
  const [detailsEditable, setDetailsEditable] = useState(false);
  const [details, setDetails] = useState(initialDriverDetails);

  const handleDetailChange = (field: keyof typeof initialDriverDetails) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setDetails((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const toggleDetailsEdit = () => {
    setDetailsEditable((prev) => !prev);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
      <div className="xl:col-span-3 bg-gradient-to-br from-[#1E1212] via-[#100808] to-black border border-amber-900/50 rounded-2xl p-8">
        <h2 className="text-2xl font-bold font-display text-amber-400 mb-6">Your Details</h2>
        <form className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <DashboardInput
            id="first-name"
            label="First Name"
            type="text"
            value={details.firstName}
            readOnly={!detailsEditable}
            onChange={handleDetailChange('firstName')}
          />
          <DashboardInput
            id="last-name"
            label="Last Name"
            type="text"
            value={details.lastName}
            readOnly={!detailsEditable}
            onChange={handleDetailChange('lastName')}
          />
          <DashboardInput
            id="email"
            label="Email"
            type="email"
            value={details.email}
            readOnly={!detailsEditable}
            onChange={handleDetailChange('email')}
          />
          <DashboardInput
            id="phone"
            label="Phone"
            type="tel"
            value={details.phone}
            readOnly={!detailsEditable}
            onChange={handleDetailChange('phone')}
          />
          <div className="sm:col-span-2">
            <DashboardInput
              id="driving-license"
              label="Driving License"
              type="text"
              value={details.drivingLicense}
              readOnly={!detailsEditable}
              onChange={handleDetailChange('drivingLicense')}
            />
          </div>
          <div className="sm:col-span-2">
            <DashboardInput
              id="address"
              label="Address"
              type="text"
              value={details.address}
              readOnly={!detailsEditable}
              onChange={handleDetailChange('address')}
            />
          </div>
          <DashboardInput
            id="pco-licence-no"
            label="PCO Licence No"
            type="text"
            value={details.pcoLicenceNo}
            readOnly={!detailsEditable}
            onChange={handleDetailChange('pcoLicenceNo')}
          />
          <DashboardInput
            id="pco-expiry"
            label="PCO Expiry"
            type="date"
            value={details.pcoExpiry}
            readOnly={!detailsEditable}
            onChange={handleDetailChange('pcoExpiry')}
          />
          <div className="sm:col-span-2 mt-2 flex justify-start">
            <button
              type="button"
              onClick={toggleDetailsEdit}
              className={actionButtonClass(detailsEditable)}
            >
              {detailsEditable ? 'Save' : 'Edit'}
            </button>
          </div>
        </form>
      </div>

      <div className="xl:col-span-2 bg-gradient-to-br from-[#1E1212] via-[#100808] to-black border border-amber-900/50 rounded-2xl p-8">
        <h2 className="text-2xl font-bold font-display text-amber-400 mb-6">Upload Documents</h2>
        <div className="space-y-1">
          <UploadStatusItem label="PCO Licence No" />
          <UploadStatusItem label="Driving License front" />
          <UploadStatusItem label="Driving License back side" />
        </div>
        <p className="text-xs text-amber-200/60 mt-6">
          We store all documents securely. Reminders are sent before expiry.
        </p>
      </div>
    </div>
  );
};

const MonthlyStatement: React.FC = () => {
    const handleDownloadCSV = () => {
        const headers = ['Date', 'Ref', 'Pickup', 'Dropoff', 'Vehicle', 'Miles', 'Wait', 'Fare (£)'];
        const csvRows = [
            headers.join(','),
            ...mockStatementData.map(row => 
                [
                    row.date,
                    row.ref,
                    `"${row.pickup}"`,
                    `"${row.dropoff}"`,
                    row.vehicle,
                    row.miles,
                    row.wait,
                    row.fare.toFixed(2)
                ].join(',')
            )
        ];
        
        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'monthly-statement.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="bg-gradient-to-br from-[#1E1212] via-[#100808] to-black border border-amber-900/50 rounded-2xl p-8">
            <h2 className="text-2xl font-bold font-display text-amber-400 mb-2">Monthly Statement</h2>
            <p className="text-sm text-amber-200/60 mb-8">Export bookings and earnings</p>
            
            <div className="overflow-x-auto">
                <table className="w-full min-w-max text-left">
                    <thead>
                        <tr className="border-b-2 border-amber-900/50">
                            <th className="p-3 text-sm font-semibold text-amber-400 uppercase tracking-wider">Date</th>
                            <th className="p-3 text-sm font-semibold text-amber-400 uppercase tracking-wider">Ref</th>
                            <th className="p-3 text-sm font-semibold text-amber-400 uppercase tracking-wider">Pickup</th>
                            <th className="p-3 text-sm font-semibold text-amber-400 uppercase tracking-wider">Dropoff</th>
                            <th className="p-3 text-sm font-semibold text-amber-400 uppercase tracking-wider">Vehicle</th>
                            <th className="p-3 text-sm font-semibold text-amber-400 uppercase tracking-wider">Miles</th>
                            <th className="p-3 text-sm font-semibold text-amber-400 uppercase tracking-wider">Wait</th>
                            <th className="p-3 text-sm font-semibold text-amber-400 uppercase tracking-wider text-right">Fare (£)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {mockStatementData.map((row, index) => (
                            <tr key={row.ref} className="border-b border-amber-900/40">
                                <td className="p-3 text-white/90">{row.date}</td>
                                <td className="p-3 text-white/90">{row.ref}</td>
                                <td className="p-3 text-white/90">{row.pickup}</td>
                                <td className="p-3 text-white/90">{row.dropoff}</td>
                                <td className="p-3 text-white/90">{row.vehicle}</td>
                                <td className="p-3 text-white/90">{row.miles}</td>
                                <td className="p-3 text-white/90">{row.wait}</td>
                                <td className="p-3 text-amber-400 font-semibold text-right">£{row.fare.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="mt-8">
                <button 
                    onClick={handleDownloadCSV}
                    className="px-10 py-2.5 font-semibold bg-transparent border-2 border-amber-500 text-amber-400 rounded-lg hover:bg-amber-500 hover:text-black transition-colors"
                >
                    Download CSV
                </button>
            </div>
        </div>
    );
};

const UploadItemWithExpiry: React.FC<{ label: string }> = ({ label }) => {
    const id = label.toLowerCase().replace(/ /g, '-');
    return (
        <div className="flex flex-col sm:flex-row justify-between py-2 border-b border-amber-900/40 gap-2">
            <span className="text-white/90 text-sm flex-grow">{label}</span>
            <div className="flex items-center gap-2">
                <span style={{ fontSize:"12px" }}>Expiring:</span> 
                <input type="date" className="bg-gray-100/90 border border-amber-900/60 rounded-md px-2 py-1 text-xs text-black w-32" />
                 <label htmlFor={id} className="cursor-pointer bg-amber-500 text-black px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-400 transition-colors">
                    Upload
                </label>
                <input type="file" id={id} className="hidden" />
            </div>
        </div>
    );
}

const AddCarUploadItem: React.FC<{ label: string; showExpiry?: boolean }> = ({ label, showExpiry = true }) => {
    const id = `add-car-${label.toLowerCase().replace(/ /g, '-')}`;
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3 border-b border-amber-900/40">
            <span className="text-white/90 text-sm">{label}</span>
            <div className="flex items-center gap-3">
                {showExpiry && (
                    <>
                        <span className="text-xs text-white/80 uppercase tracking-[0.3em]">Expiring:</span>
                        <input
                            type="date"
                            className="add-car-date bg-white border border-amber-900/60 rounded-md px-3 py-1 text-xs text-black w-32"
                        />
                    </>
                )}
                <label htmlFor={id} className="cursor-pointer bg-amber-500 text-black px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-400 transition-colors">
                    Upload
                </label>
                <input type="file" id={id} className="hidden" />
            </div>
        </div>
    );
}

const CarsPage: React.FC = () => {
    const [vrm, setVrm] = useState('');
    const [make, setMake] = useState('');
    const [model, setModel] = useState('');
    const [isFindingVehicle, setIsFindingVehicle] = useState(false);
    const authTokenRef = useRef<string | null>(null);
    const { showAlert } = useAlert();
    const [cars, setCars] = useState(mockCars);
    const [carEditing, setCarEditing] = useState<Record<string, boolean>>(() =>
        mockCars.reduce((acc, car) => ({ ...acc, [car.id]: false }), {})
    );

    const toggleCarEdit = (carId: string) => {
        setCarEditing(prev => ({ ...prev, [carId]: !prev[carId] }));
    };

    const handleCarChange = (carId: string, field: keyof typeof mockCars[number]) => (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setCars(prev => prev.map(car => (car.id === carId ? { ...car, [field]: value } : car)));
    };

    const handleRemoveOtherDocument = (carId: string, docName: string) => {
        setCars(prev =>
            prev.map(car =>
                car.id === carId
                    ? { ...car, otherDocuments: (car.otherDocuments ?? []).filter(doc => doc.name !== docName) }
                    : car
            )
        );
    };

    const authenticateWithDvla = async () => {
        const username = process.env.NEXT_PUBLIC_DVLA_USERNAME;
        const password = process.env.NEXT_PUBLIC_DVLA_PASSWORD;
        if (!username || !password) return null; // optional, VES also works with api key only

        try {
            const res = await fetch('https://driver-vehicle-licensing.api.gov.uk/thirdparty-access/v1/authenticate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json'
                },
                body: JSON.stringify({ userName: username, password })
            });
            if (!res.ok) {
                console.warn('DVLA auth failed', res.status);
                return null;
            }
            const data = await res.json();
            return data['id-token'] as string | undefined;
        } catch (err) {
            console.error('DVLA auth error', err);
            return null;
        }
    };

    const handleFindVehicle = async () => {
        const registrationNumber = vrm.trim().toUpperCase();
        if (!registrationNumber) {
            showAlert('Please enter a VRM before searching.');
            return;
        }

        setIsFindingVehicle(true);
        try {
            const apiKey = process.env.NEXT_PUBLIC_DVLA_API_KEY || 'CHOAXmkCon26O2FuJrYxd2eySH9U9Rz44790QpWf';
            if (!apiKey) {
                showAlert('DVLA API key missing. Add NEXT_PUBLIC_DVLA_API_KEY to your environment.');
                return;
            }

            if (!authTokenRef.current) {
                authTokenRef.current = await authenticateWithDvla();
            }

            const dvlaProxy = process.env.NEXT_PUBLIC_DVLA_PROXY_URL;
            if (!dvlaProxy) {
                showAlert('DVLA proxy is missing (NEXT_PUBLIC_DVLA_PROXY_URL). Direct DVLA calls are blocked by CORS.');
                return;
            }
            const dvlaBaseUrl = dvlaProxy.replace(/\/$/, '');
            const response = await fetch(`${dvlaBaseUrl}/vehicle-enquiry/v1/vehicles`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Proxy injects the API key; keep header for fallback/non-proxied environments (direct DVLA endpoint).
                    'x-api-key': apiKey,
                    ...(authTokenRef.current ? { Authorization: `Bearer ${authTokenRef.current}` } : {})
                },
                body: JSON.stringify({ registrationNumber })
            });

            if (!response.ok) {
                const errorBody = await response.json().catch(() => null);
                if (response.status === 404) {
                    setMake('');
                    setModel('');
                    showAlert('DVLA: vehicle not found for that VRM. Please double-check the registration and try again.');
                    return;
                }
                if (response.status === 429) {
                    showAlert('DVLA rate limit reached. Please wait a moment and try again.');
                    return;
                }
                const fallbackError = typeof errorBody === 'string' ? errorBody : errorBody?.errors?.[0]?.detail || 'Check the VRM and try again.';
                showAlert(`DVLA lookup failed (${response.status}). ${fallbackError}`);
                return;
            }

            const data = await response.json();
            setMake(data.make || '');
            setModel(data.model || '');
            if (!data.model) {
                showAlert('Please enter the model manually.');
            } else {
                showAlert('Vehicle found via DVLA. Fields updated.');
            }
        } catch (err) {
            console.error('DVLA lookup error', err);
            showAlert('Could not reach DVLA. Please try again.');
        } finally {
            setIsFindingVehicle(false);
        }
    }
    
    return (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
            <div className="xl:col-span-3 bg-gradient-to-br from-[#1E1212] via-[#100808] to-black border border-amber-900/50 rounded-2xl p-8">
                <h2 className="text-2xl font-bold font-display text-amber-400 mb-6">My Car(s)</h2>
                 <div className="space-y-6">
                      {cars.map(car => {
                          const editing = !!carEditing[car.id];
                          return (
                          <div key={car.id} className="border-b-2 border-amber-900/50 pb-6 last:border-b-0 last:pb-0">
                                  <div className="flex items-center justify-between gap-3 mb-3">
                                      <div className="flex items-center gap-4">
                                          <Car className="text-amber-400" size={24} />
                                          <h3 className="text-xl font-bold text-amber-400">{car.make} {car.model}</h3>
                                      </div>
                                      <button
                                          type="button"
                                          onClick={() => toggleCarEdit(car.id)}
                                      className={actionButtonClass(editing)}
                                  >
                                      {editing ? 'Save' : 'Edit'}
                                  </button>
                                  </div>
                             <div className="space-y-1 pl-10">
                                  <DashboardInput
                                      id={`${car.id}-vrm`}
                                     label="Vehicle Reg (VRM)"
                                     type="text"
                                     value={car.vrm}
                                     readOnly={!editing}
                                      onChange={handleCarChange(car.id, 'vrm')}
                                 />
                                  <div className="flex items-end gap-3">
                                      <div className="flex-1">
                                          <DashboardInput
                                              id={`${car.id}-mot`}
                                             label="MOT Expiry"
                                             type="date"
                                             value={car.motExpiry}
                                             readOnly={!editing}
                                              onChange={handleCarChange(car.id, 'motExpiry')}
                                         />
                                      </div>
                                      {editing && (
                                          <div className="pb-1">
                                              <label htmlFor={`${car.id}-mot-upload`} className={uploadButtonClass}>
                                                  Upload
                                              </label>
                                              <input type="file" id={`${car.id}-mot-upload`} className="hidden" />
                                          </div>
                                      )}
                                  </div>
                                  <div className="flex items-end gap-3">
                                      <div className="flex-1">
                                          <DashboardInput
                                              id={`${car.id}-insurance`}
                                             label="Insurance Expiry"
                                             type="date"
                                             value={car.insuranceExpiry}
                                             readOnly={!editing}
                                              onChange={handleCarChange(car.id, 'insuranceExpiry')}
                                         />
                                      </div>
                                      {editing && (
                                          <div className="pb-1">
                                              <label htmlFor={`${car.id}-insurance-upload`} className={uploadButtonClass}>
                                                  Upload
                                              </label>
                                              <input type="file" id={`${car.id}-insurance-upload`} className="hidden" />
                                          </div>
                                      )}
                                  </div>
                                  <div className="flex items-end gap-3">
                                      <div className="flex-1">
                                          <DashboardInput
                                              id={`${car.id}-phv`}
                                             label="PHV Car License Expiry"
                                             type="date"
                                             value={car.phvExpiry}
                                             readOnly={!editing}
                                              onChange={handleCarChange(car.id, 'phvExpiry')}
                                         />
                                      </div>
                                      {editing && (
                                          <div className="pb-1">
                                              <label htmlFor={`${car.id}-phv-upload`} className={uploadButtonClass}>
                                                  Upload
                                              </label>
                                              <input type="file" id={`${car.id}-phv-upload`} className="hidden" />
                                          </div>
                                      )}
                                  </div>
                                  <div className="flex items-center justify-between py-2 gap-3 border-b border-amber-900/40">
                                      <span className="text-white/90 text-sm">Logbook V5a</span>
                                      <div className="flex items-center gap-3">
                                          <StatusPill text={car.logbookStatus} variant="success" />

                                          <input id={`${car.vrm}-logbook`} type="file" className="hidden" />
                                      </div>
                                  </div>
                                  <div className="flex flex-col gap-2 py-2 border-b border-amber-900/40">
                                      <div className="flex items-center justify-between gap-3">
                                          <span className="text-white/90 text-sm">Other documents</span>
                                          <div className="flex items-center gap-3">
                                              <StatusPill
                                                  text={editing ? 'Upload' : car.otherDocumentsStatus}
                                                  variant={editing ? 'warning' : undefined}
                                              />
                                              {editing && (
                                                  <label htmlFor={`${car.vrm}-other-docs-upload`} className={uploadButtonClass}>
                                                      Upload
                                                  </label>
                                              )}
                                              <input id={`${car.vrm}-other-docs-upload`} type="file" className="hidden" />
                                          </div>
                                      </div>
                                      {car.otherDocuments?.length ? (
                                          <div className="flex flex-wrap gap-2 text-xs text-white/80">
                                              {car.otherDocuments.map((doc) => (
                                                  <span
                                                      key={`${car.id}-${doc.name}`}
                                                      className="flex items-center gap-2 rounded-full border border-amber-900/60 bg-white/5 px-3 py-1 max-w-[200px] text-amber-100"
                                                  >
                                                      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-amber-200">
                                                          .{doc.type}
                                                      </span>
                                                      <span className="truncate">{doc.name}</span>
                                                      {editing && (
                                                          <button
                                                              type="button"
                                                              onClick={() => handleRemoveOtherDocument(car.id, doc.name)}
                                                              className="text-red-400 hover:text-red-300"
                                                              aria-label={`Remove ${doc.name}`}
                                                          >
                                                              ×
                                                          </button>
                                                      )}
                                                  </span>
                                              ))}
                                          </div>
                                      ) : (
                                          <p className="text-xs text-gray-400">No documents uploaded yet.</p>
                                      )}
                                  </div>
                             </div>
                         </div>
                         );
                     })}
                 </div>
            </div>

            <div className="xl:col-span-2 bg-gradient-to-br from-[#1E1212] via-[#100808] to-black border border-amber-900/50 rounded-2xl p-8">
                 <h2 className="text-2xl font-bold font-display text-amber-400 mb-6">Add New Car</h2>
                 <form className="space-y-4">
                    <div>
                        <label htmlFor="vrm" className="block text-xs font-semibold text-amber-200/70 uppercase tracking-wider mb-2">Vehicle Reg (VRM)</label>
                        <div className="flex gap-2">
                            <input id="vrm" type="text" value={vrm} onChange={(e) => setVrm(e.target.value)} className="flex-grow w-full bg-black/40 border border-amber-900/60 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500" />
                            <button
                                type="button"
                                onClick={handleFindVehicle}
                                disabled={isFindingVehicle}
                                className="px-4 py-2 font-semibold bg-amber-600 text-black rounded-lg hover:bg-amber-500 transition-colors text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isFindingVehicle ? 'Finding...' : 'Find'}
                            </button>
                        </div>
                        <p className="text-xs text-amber-200/60 mt-1">Uses DVLA Vehicle Enquiry Service; model may need manual entry.</p>
                    </div>
                    
                    <DashboardInput
                        id="make"
                        label="Make"
                        type="text"
                        value={make}
                        onChange={(e) => setMake(e.target.value)}
                        placeholder="Enter make"
                    />
                    <DashboardInput
                        id="model"
                        label="Model"
                        type="text"
                        value={model}
                        placeholder="Enter model"
                        onChange={(e) => setModel(e.target.value)}
                    />

                    <div className="pt-2">
                        <AddCarUploadItem label="MOT" />
                        <AddCarUploadItem label="Insurance" />
                        <AddCarUploadItem label="PHV Car License" />
                        <AddCarUploadItem label="Logbook V5" showExpiry={false} />
                        <AddCarUploadItem label="Other documents" showExpiry={false} />
                    </div>
                    
                    <div className="pt-4 flex justify-start">
                        <button type="submit" className="px-10 py-2.5 font-semibold bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-colors">
                            Save New Car
                        </button>
                    </div>
                 </form>
            </div>
        </div>
    );
};


const DriverDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const { user, logout } = useAuth();
  const router = useRouter();
  const { showAlert } = useAlert();

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const tabs = ['Jobs', 'Dashboard', 'Car(s)', 'Monthly Statement'];

  const renderContent = () => {
    switch (activeTab) {
      case 'Jobs':
        return <DriverJobs />;
      case 'Dashboard':
        return <DriverProfile />;
      case 'Car(s)':
        return <CarsPage />;
      case 'Monthly Statement':
        return <MonthlyStatement />;
      default:
        return <DriverJobs />;
    }
  };
  
  return (
    <PageShell mainClassName="flex flex-col px-4 sm:px-6 md:px-8 py-10">
      <div className="w-full flex-grow">
        <div className="max-w-7xl mx-auto">
          <header className="mb-8">
            <div className="flex flex-wrap justify-between items-center gap-4 pb-4 border-b border-gray-800">
              <div>
                <h1 className="text-3xl font-bold font-display text-amber-400">Driver Dashboard</h1>
                <p className="text-gray-400">Welcome back, {user?.name}</p>
              </div>
              <button
                onClick={handleLogout}
                className="px-4 py-2 font-semibold bg-transparent border border-amber-400 text-amber-400 rounded-md hover:bg-amber-400 hover:text-black transition-colors"
              >
                Logout
              </button>
            </div>
            <nav className="mt-6 flex items-center space-x-2 overflow-x-auto pb-2">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative px-4 py-2 text-sm font-semibold rounded-md transition-colors whitespace-nowrap ${
                    activeTab === tab
                      ? 'bg-amber-400 text-black shadow-md shadow-amber-400/20'
                      : 'bg-gray-800/50 text-amber-300 hover:bg-gray-700/50'
                  }`}
                >
                  {tab}
                  {tab === 'Jobs' && mockJobs.length > 0 && (
                    <span className="absolute -top-0 -right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-xs font-bold text-white">
                      {mockJobs.length}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </header>

          <main>{renderContent()}</main>
        </div>
      </div>
    </PageShell>
  );
};

export default DriverDashboardPage;
