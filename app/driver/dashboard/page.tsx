'use client';

import React, { useEffect, useRef, useState } from 'react';
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
    type: string;
    docType?: string;
    url?: string | null;
    fileName?: string | null;
};

type CarDocumentItem = {
    docType: string;
    name: string;
    url?: string | null;
    type?: string | null;
    expiryDate?: string | null;
    fileName?: string | null;
};

type DriverCarEntry = {
    id: string;
    vrm: string;
    make: string;
    model: string;
    colour: string;
    keeperInfo: string;
    motExpiry: string;
    insuranceExpiry: string;
    phvExpiry: string;
    logbookStatus: string;
    otherDocumentsStatus: string;
    otherDocuments: DocumentItem[];
    documents: CarDocumentItem[];
};

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

const UploadStatusItem: React.FC<{
  label: string;
  statusText: string;
  buttonLabel?: string;
  helperText?: string;
  onUpload?: (file: File) => void;
  uploading?: boolean;
  error?: string | null;
}> = ({ label, statusText, buttonLabel = 'New Upload', helperText, onUpload, uploading, error }) => {
  const id = `upload-${label.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`;
  return (
    <div className="flex flex-col gap-1 py-3 border-b border-amber-900/40">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <span className="text-white/90 text-sm">{label}</span>
        <div className="flex items-center gap-3">
          <StatusPill text={statusText} />
          <label
            htmlFor={id}
            className="rounded-full border border-amber-500 bg-amber-500 px-4 py-1 text-xs font-semibold text-black uppercase transition hover:bg-amber-400 cursor-pointer"
          >
            {buttonLabel}
          </label>
          <input
            id={id}
            type="file"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file && onUpload) onUpload(file);
            }}
          />
        </div>
      </div>
      {helperText && <p className="text-[11px] text-amber-200/70">{helperText}</p>}
      {uploading ? <p className="text-[11px] text-amber-300">Uploading...</p> : null}
      {error ? <p className="text-[11px] text-red-300">{error}</p> : null}
    </div>
  );
};
  
const emptyDriverDetails = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  drivingLicense: '',
  address: '',
  pcoLicenceNo: '',
  pcoExpiry: ''
};

const emptyBankDetails = {
  bankName: '',
  accountName: '',
  sortCode: '',
  accountNumber: ''
};

const documentConfig = [
  { label: 'PCO Licence', docType: 'pco_license' },
  { label: 'Driver Licence Front', docType: 'driving_license_front' },
  { label: 'Driver Licence Back', docType: 'driving_license_back' },
  { label: 'Your photo', docType: 'profile_photo', helperText: '* Passport type photo to be used on your profile*' },
] as const;

const DriverProfile = () => {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [detailsEditable, setDetailsEditable] = useState(false);
  const [details, setDetails] = useState(emptyDriverDetails);
  const [bankEditable, setBankEditable] = useState(false);
  const [bankDetails, setBankDetails] = useState(emptyBankDetails);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [docUploading, setDocUploading] = useState<Record<string, boolean>>({});
  const [docError, setDocError] = useState<Record<string, string | null>>({});
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [bankSaving, setBankSaving] = useState(false);

  const toDateInput = (value: string | null | undefined) => {
    if (!value) return '';
    const dateValue = new Date(value);
    if (Number.isNaN(dateValue.getTime())) return value;
    return dateValue.toISOString().slice(0, 10);
  };

  useEffect(() => {
    if (!user?.email) return;
    const loadProfile = async () => {
      setLoadingProfile(true);
      try {
        const res = await fetch(`/api/driver/profile?email=${encodeURIComponent(user.email)}`, { cache: 'no-store' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || 'Failed to load profile');
        }
        const data = await res.json();
        const driver = data.driver || {};
        setDetails({
          firstName: driver.firstAndMiddleName || '',
          lastName: driver.surname || '',
          email: driver.email || user.email,
          phone: driver.phone || '',
          drivingLicense: driver.drivingLicenseNo || '',
          address: driver.address || '',
          pcoLicenceNo: driver.pcoLicenseNo || '',
          pcoExpiry: toDateInput(driver.pcoExpiresDate || ''),
        });
        setBankDetails({
          bankName: data.bank?.bankName || '',
          accountName: data.bank?.accountName || '',
          sortCode: data.bank?.sortCode || '',
          accountNumber: data.bank?.accountNumber || '',
        });
        setDocuments(
          (data.documents || []).map((doc: any) => ({
            name: doc.name,
            type: doc.type,
            docType: doc.docType,
            url: doc.url,
            fileName: doc.fileName,
          }))
        );
      } catch (err: any) {
        showAlert(err?.message || 'Failed to load profile');
      } finally {
        setLoadingProfile(false);
      }
    };
    loadProfile();
  }, [user?.email]);

  const handleDocumentUpload = async (docType: string, file: File) => {
    if (!user?.email) {
      showAlert('Please sign in again.');
      return;
    }
    setDocUploading((prev) => ({ ...prev, [docType]: true }));
    setDocError((prev) => ({ ...prev, [docType]: null }));
    try {
      const form = new FormData();
      form.append('email', user.email);
      form.append('docType', docType);
      form.append('file', file);
      const res = await fetch('/api/driver/documents', { method: 'POST', body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to upload document');
      }
      const data = await res.json();
      setDocuments((prev) => {
        const next = prev.filter((doc) => doc.docType !== docType);
        next.push({
          name: documentConfig.find((d) => d.docType === docType)?.label || docType,
          type: data.type,
          docType,
          url: data.url,
          fileName: data.fileName,
        });
        return next;
      });
    } catch (err: any) {
      setDocError((prev) => ({ ...prev, [docType]: err?.message || 'Failed to upload document' }));
    } finally {
      setDocUploading((prev) => ({ ...prev, [docType]: false }));
    }
  };

  const handleDetailChange = (field: keyof typeof initialDriverDetails) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setDetails((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleBankChange = (field: keyof typeof initialBankDetails) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setBankDetails((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const toggleDetailsEdit = () => {
    setDetailsEditable((prev) => !prev);
  };

  const toggleBankEdit = async () => {
    if (!bankEditable) {
      setBankEditable(true);
      return;
    }
    if (!user?.email) {
      showAlert('Please sign in again.');
      return;
    }
    setBankSaving(true);
    try {
      const res = await fetch('/api/driver/bank-details', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, ...bankDetails }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to update bank details');
      }
      setBankEditable(false);
      showAlert('Bank details updated.');
    } catch (err: any) {
      showAlert(err?.message || 'Failed to update bank details');
    } finally {
      setBankSaving(false);
    }
  };

  const documentsByType = documents.reduce<Record<string, DocumentItem>>((acc, doc) => {
    if (doc.docType) acc[doc.docType] = doc;
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
      <div className="xl:col-span-3 bg-gradient-to-br from-[#1E1212] via-[#100808] to-black border border-amber-900/50 rounded-2xl p-8">
        <h2 className="text-2xl font-bold font-display text-amber-400 mb-6">Your Details</h2>
        {loadingProfile ? (
          <p className="text-xs text-amber-200/70 mb-4">Loading profile...</p>
        ) : null}
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
        <div className="space-y-4">
          {documents.length === 0 ? (
            <p className="text-xs text-amber-200/60">No documents uploaded yet.</p>
          ) : (
            <div className="rounded-xl border border-amber-900/40 bg-black/30 p-3">
              <table className="w-full text-left text-xs text-white/80">
                <thead>
                  <tr className="border-b border-amber-900/40 text-[10px] uppercase tracking-wider text-amber-300">
                    <th className="py-2 px-2">Name</th>
                    <th className="py-2 px-2">Type</th>
                    <th className="py-2 px-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={`${doc.docType || doc.name}`} className="border-b border-amber-900/20">
                      <td className="py-2 px-2 text-white/90">{doc.name}</td>
                      <td className="py-2 px-2 text-white/70">{doc.type}</td>
                      <td className="py-2 px-2 text-right">
                        {doc.url ? (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-white/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white transition hover:border-amber-400 hover:text-amber-300"
                          >
                            View
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="space-y-1">
            {documentConfig.map((doc) => {
              const uploaded = documentsByType[doc.docType];
              return (
                <UploadStatusItem
                  key={doc.docType}
                  label={doc.label}
                  statusText={uploaded ? 'Uploaded' : 'Not uploaded'}
                  buttonLabel="NEW UPLOAD"
                  helperText={doc.helperText}
                  uploading={Boolean(docUploading[doc.docType])}
                  error={docError[doc.docType] || null}
                  onUpload={(file) => handleDocumentUpload(doc.docType, file)}
                />
              );
            })}
          </div>
        </div>
        <p className="text-xs text-amber-200/60 mt-6">
          We store all documents securely. Reminders are sent before expiry.
        </p>
      </div>

      <div className="xl:col-span-5 bg-gradient-to-br from-[#1E1212] via-[#100808] to-black border border-amber-900/50 rounded-2xl p-8">
        <h2 className="text-2xl font-bold font-display text-amber-400 mb-6">Bank details</h2>
        <form className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <DashboardInput
            id="bank-name"
            label="Bank Name"
            type="text"
            value={bankDetails.bankName}
            readOnly={!bankEditable}
            onChange={handleBankChange('bankName')}
            placeholder="e.g. Barclays"
          />
          <DashboardInput
            id="account-name"
            label="Account Name"
            type="text"
            value={bankDetails.accountName}
            readOnly={!bankEditable}
            onChange={handleBankChange('accountName')}
            placeholder="e.g. John Smith"
          />
          <DashboardInput
            id="sort-code"
            label="Sort Code"
            type="text"
            value={bankDetails.sortCode}
            readOnly={!bankEditable}
            onChange={handleBankChange('sortCode')}
            placeholder="e.g. 12-34-56"
          />
          <DashboardInput
            id="account-number"
            label="Account Number"
            type="text"
            value={bankDetails.accountNumber}
            readOnly={!bankEditable}
            onChange={handleBankChange('accountNumber')}
            placeholder="e.g. 12345678"
          />
          <div className="sm:col-span-2 mt-2 flex justify-start">
            <button
              type="button"
              onClick={toggleBankEdit}
              className={actionButtonClass(bankEditable)}
              disabled={bankSaving}
            >
              {bankSaving ? 'Saving...' : bankEditable ? 'Save' : 'Edit'}
            </button>
          </div>
        </form>
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

type AddCarUploadItemProps = {
    label: string;
    showExpiry?: boolean;
    value?: string;
    onDateChange?: (value: string) => void;
    onFileChange?: (file: File | null) => void;
    uploading?: boolean;
    error?: string | null;
    statusText?: string;
};

const AddCarUploadItem: React.FC<AddCarUploadItemProps> = ({
    label,
    showExpiry = true,
    value,
    onDateChange,
    onFileChange,
    uploading,
    error,
    statusText,
}) => {
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
                            value={value ?? ''}
                            onChange={(event) => onDateChange?.(event.target.value)}
                        />
                    </>
                )}
                <label htmlFor={id} className="cursor-pointer bg-amber-500 text-black px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-400 transition-colors">
                    Upload
                </label>
                <input
                    type="file"
                    id={id}
                    className="hidden"
                    onChange={(event) => onFileChange?.(event.target.files?.[0] ?? null)}
                />
            </div>
            {statusText ? <span className="text-[11px] text-amber-200">{statusText}</span> : null}
            {uploading ? <span className="text-[11px] text-amber-200">Uploading...</span> : null}
            {error ? <span className="text-[11px] text-red-300">{error}</span> : null}
        </div>
    );
}

const CarsPage: React.FC = () => {
    const [vrm, setVrm] = useState('');
    const [make, setMake] = useState('');
    const [model, setModel] = useState('');
    const [colour, setColour] = useState('');
    const [keeperInfo, setKeeperInfo] = useState('');
    const [isFindingVehicle, setIsFindingVehicle] = useState(false);
    const authTokenRef = useRef<string | null>(null);
    const { showAlert } = useAlert();
    const { user } = useAuth();
    const [cars, setCars] = useState<DriverCarEntry[]>([]);
    const [carEditing, setCarEditing] = useState<Record<string, boolean>>({});
    const [carSaving, setCarSaving] = useState(false);
    const [carDeleting, setCarDeleting] = useState<Record<string, boolean>>({});
    const [carUpdating, setCarUpdating] = useState<Record<string, boolean>>({});
    const [carDocUploading, setCarDocUploading] = useState<Record<string, boolean>>({});
    const [carDocError, setCarDocError] = useState<Record<string, string | null>>({});
    const [newCarDocs, setNewCarDocs] = useState({
        mot: { expiryDate: '', file: null as File | null, status: '' },
        insurance: { expiryDate: '', file: null as File | null, status: '' },
        phv_car_licence: { expiryDate: '', file: null as File | null, status: '' },
        logbook_v5: { expiryDate: '', file: null as File | null, status: '' },
        other: { expiryDate: '', file: null as File | null, status: '' },
    });

    const normalizeDateInput = (value?: string | null) => {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return date.toISOString().slice(0, 10);
    };

    const docStatusText = (doc?: CarDocumentItem) => (doc?.url ? 'Uploaded' : 'Not uploaded');

    const applyDocsToCar = (car: DriverCarEntry, documents: CarDocumentItem[]) => {
        const motDoc = documents.find((doc) => doc.docType === 'mot');
        const insuranceDoc = documents.find((doc) => doc.docType === 'insurance');
        const phvDoc = documents.find((doc) => doc.docType === 'phv_car_licence');
        const logbookDoc = documents.find((doc) => doc.docType === 'logbook_v5');
        const otherDocs = documents.filter((doc) => doc.docType === 'other');
        return {
            ...car,
            documents,
            motExpiry: normalizeDateInput(motDoc?.expiryDate),
            insuranceExpiry: normalizeDateInput(insuranceDoc?.expiryDate),
            phvExpiry: normalizeDateInput(phvDoc?.expiryDate),
            logbookStatus: docStatusText(logbookDoc),
            otherDocumentsStatus: otherDocs.length ? 'Uploaded' : 'Not uploaded',
            otherDocuments: otherDocs.map((doc) => ({
                name: doc.fileName || doc.name,
                type: (doc.type || 'FILE').toUpperCase(),
                docType: doc.docType,
                url: doc.url,
                fileName: doc.fileName,
            })),
        };
    };

    useEffect(() => {
        if (!user?.email) return;
        const loadCars = async () => {
            try {
                const res = await fetch(`/api/driver/profile?email=${encodeURIComponent(user.email)}`, { cache: 'no-store' });
                if (!res.ok) return;
                const data = await res.json();
                const carRows = Array.isArray(data.cars) ? data.cars : [];
                const mappedCars: DriverCarEntry[] = carRows.map((car: any) => {
                    const documents = Array.isArray(car.documents) ? car.documents : [];
                    const baseCar: DriverCarEntry = {
                        id: String(car.id),
                        vrm: car.vehicle_registration || '-',
                        make: car.make || '-',
                        model: car.model || '-',
                        colour: car.colour || '-',
                        keeperInfo: car.keeper_info || '-',
                        motExpiry: '',
                        insuranceExpiry: '',
                        phvExpiry: '',
                        logbookStatus: 'Not uploaded',
                        otherDocumentsStatus: 'Not uploaded',
                        otherDocuments: [],
                        documents,
                    };
                    return applyDocsToCar(baseCar, documents);
                });
                setCars(mappedCars);
                setCarEditing(Object.fromEntries(mappedCars.map((car) => [car.id, false])));
            } catch (err) {
                console.error('Driver car fetch error', err);
            }
        };
        loadCars();
    }, [user?.email]);

    const toggleCarEdit = async (carId: string) => {
        const isEditing = !!carEditing[carId];
        if (!isEditing) {
            setCarEditing(prev => ({ ...prev, [carId]: true }));
            return;
        }
        if (!user?.email) {
            showAlert('Please sign in again.');
            return;
        }
        const car = cars.find((item) => item.id === carId);
        if (!car) return;
        setCarUpdating((prev) => ({ ...prev, [carId]: true }));
        try {
            const res = await fetch('/api/driver/cars', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email,
                    driverCarId: carId,
                    vehicleReg: car.vrm,
                    make: car.make,
                    model: car.model,
                    colour: car.colour,
                    keeperInfo: car.keeperInfo,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Failed to update car');
            }
            setCarEditing((prev) => ({ ...prev, [carId]: false }));
            showAlert('Car updated.');
        } catch (err: any) {
            showAlert(err?.message || 'Failed to update car');
        } finally {
            setCarUpdating((prev) => ({ ...prev, [carId]: false }));
        }
    };

    const handleCarChange = (carId: string, field: keyof DriverCarEntry) => (event: React.ChangeEvent<HTMLInputElement>) => {
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

    const handleDeleteCar = async (carId: string) => {
        if (!user?.email) {
            showAlert('Please sign in again.');
            return;
        }
        if (!window.confirm('Delete this car?')) return;
        setCarDeleting((prev) => ({ ...prev, [carId]: true }));
        try {
            const res = await fetch('/api/driver/cars', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: user.email, driverCarId: carId }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Failed to delete car');
            }
            setCars((prev) => prev.filter((car) => car.id !== carId));
            setCarEditing((prev) => {
                const next = { ...prev };
                delete next[carId];
                return next;
            });
            showAlert('Car deleted.');
        } catch (err: any) {
            showAlert(err?.message || 'Failed to delete car');
        } finally {
            setCarDeleting((prev) => ({ ...prev, [carId]: false }));
        }
    };

    const uploadCarDocument = async (carId: string, docType: string, file: File, expiryDate?: string) => {
        if (!user?.email) {
            throw new Error('Please sign in again.');
        }
        const payload = new FormData();
        payload.append('email', user.email);
        payload.append('carId', carId);
        payload.append('docType', docType);
        if (expiryDate) payload.append('expiryDate', expiryDate);
        payload.append('file', file);
        const res = await fetch('/api/driver/car-documents', {
            method: 'POST',
            body: payload,
        });
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data?.error || 'Failed to upload document');
        }
        const data = await res.json();
        return {
            docType,
            name: data.fileName || data.name || docType,
            url: data.url,
            type: data.type || 'FILE',
            expiryDate: data.expiryDate || expiryDate || null,
            fileName: data.fileName || null,
        } as CarDocumentItem;
    };

    const handleCarDocUpload = async (carId: string, docType: string, file: File | null, expiryDate?: string) => {
        if (!file) return;
        const key = `${carId}-${docType}`;
        setCarDocUploading((prev) => ({ ...prev, [key]: true }));
        setCarDocError((prev) => ({ ...prev, [key]: null }));
        try {
            const uploadedDoc = await uploadCarDocument(carId, docType, file, expiryDate);
            setCars((prev) =>
                prev.map((car) => {
                    if (car.id !== carId) return car;
                    const docs = car.documents.slice();
                    const existingIndex = docs.findIndex((doc) => doc.docType === docType);
                    if (existingIndex >= 0) {
                        docs[existingIndex] = uploadedDoc;
                    } else {
                        docs.push(uploadedDoc);
                    }
                    return applyDocsToCar(car, docs);
                })
            );
            showAlert('Document uploaded.');
        } catch (err: any) {
            setCarDocError((prev) => ({ ...prev, [key]: err?.message || 'Failed to upload document' }));
        } finally {
            setCarDocUploading((prev) => ({ ...prev, [key]: false }));
        }
    };

    const updateNewCarDoc = (
        key: keyof typeof newCarDocs,
        update: Partial<{ expiryDate: string; file: File | null; status: string }>
    ) => {
        setNewCarDocs((prev) => ({
            ...prev,
            [key]: {
                ...prev[key],
                ...update,
            },
        }));
    };

    const authenticateWithDvla = async (): Promise<string | null> => {
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
            const token = data['id-token'];
            return typeof token === 'string' ? token : null;
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
    };

    const handleAddCar = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!user?.email) {
            showAlert('Please sign in again.');
            return;
        }
        if (!vrm.trim() || !make.trim() || !model.trim()) {
            showAlert('Please complete vehicle reg, make and model.');
            return;
        }
        if (!newCarDocs.mot.file || !newCarDocs.insurance.file || !newCarDocs.phv_car_licence.file) {
            showAlert('MOT, Insurance, and PHV Car License uploads are required.');
            return;
        }
        setCarSaving(true);
        try {
            const res = await fetch('/api/driver/cars', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email,
                    vehicleReg: vrm.trim().toUpperCase(),
                    make: make.trim(),
                    model: model.trim(),
                    colour: colour.trim(),
                    keeperInfo: keeperInfo.trim(),
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || 'Failed to add car');
            }
            const data = await res.json();
            const carId = String(data.id);
            const uploadedDocs: CarDocumentItem[] = [];
            const docEntries = [
                { key: 'mot', docType: 'mot', expiryDate: newCarDocs.mot.expiryDate, file: newCarDocs.mot.file },
                { key: 'insurance', docType: 'insurance', expiryDate: newCarDocs.insurance.expiryDate, file: newCarDocs.insurance.file },
                { key: 'phv_car_licence', docType: 'phv_car_licence', expiryDate: newCarDocs.phv_car_licence.expiryDate, file: newCarDocs.phv_car_licence.file },
                { key: 'logbook_v5', docType: 'logbook_v5', expiryDate: '', file: newCarDocs.logbook_v5.file },
                { key: 'other', docType: 'other', expiryDate: '', file: newCarDocs.other.file },
            ] as const;
            for (const entry of docEntries) {
                if (!entry.file) continue;
                try {
                    const uploaded = await uploadCarDocument(carId, entry.docType, entry.file, entry.expiryDate || undefined);
                    uploadedDocs.push(uploaded);
                    updateNewCarDoc(entry.key, { status: 'Uploaded' });
                } catch (err) {
                    console.error('Car doc upload failed', err);
                    updateNewCarDoc(entry.key, { status: 'Upload failed' });
                }
            }
            const newCar: DriverCarEntry = {
                id: carId,
                vrm: data.vehicleReg || vrm.trim().toUpperCase(),
                make: data.make || make.trim(),
                model: data.model || model.trim(),
                colour: data.colour || colour.trim(),
                keeperInfo: data.keeperInfo || keeperInfo.trim(),
                motExpiry: '',
                insuranceExpiry: '',
                phvExpiry: '',
                logbookStatus: 'Not uploaded',
                otherDocumentsStatus: 'Not uploaded',
                otherDocuments: [],
                documents: uploadedDocs,
            };
            setCars((prev) => [applyDocsToCar(newCar, uploadedDocs), ...prev]);
            setCarEditing((prev) => ({ ...prev, [newCar.id]: false }));
            setVrm('');
            setMake('');
            setModel('');
            setColour('');
            setKeeperInfo('');
            setNewCarDocs({
                mot: { expiryDate: '', file: null, status: '' },
                insurance: { expiryDate: '', file: null, status: '' },
                phv_car_licence: { expiryDate: '', file: null, status: '' },
                logbook_v5: { expiryDate: '', file: null, status: '' },
                other: { expiryDate: '', file: null, status: '' },
            });
            showAlert('Car added.');
        } catch (err: any) {
            showAlert(err?.message || 'Failed to add car');
        } finally {
            setCarSaving(false);
        }
    };
    
    const getCarDoc = (car: DriverCarEntry, docType: string) =>
        car.documents?.find((doc) => doc.docType === docType);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
            <div className="xl:col-span-3 bg-gradient-to-br from-[#1E1212] via-[#100808] to-black border border-amber-900/50 rounded-2xl p-8">
                <h2 className="text-2xl font-bold font-display text-amber-400 mb-6">My Car(s)</h2>
                 <div className="space-y-6">
                      {cars.length === 0 ? (
                          <p className="text-sm text-gray-400">No cars linked to your profile yet.</p>
                      ) : cars.map(car => {
                          const editing = !!carEditing[car.id];
                          return (
                          <div key={car.id} className="border-b-2 border-amber-900/50 pb-6 last:border-b-0 last:pb-0">
                              <div className="flex items-center justify-between gap-3 mb-3">
                                  <div className="flex items-center gap-4">
                                      <Car className="text-amber-400" size={24} />
                                      <h3 className="text-xl font-bold text-amber-400">{car.make} {car.model}</h3>
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <button
                                          type="button"
                                          onClick={() => toggleCarEdit(car.id)}
                                          className={actionButtonClass(editing)}
                                      >
                                          {carUpdating[car.id] ? 'Saving...' : editing ? 'Save' : 'Edit'}
                                      </button>
                                      <button
                                          type="button"
                                          onClick={() => handleDeleteCar(car.id)}
                                          disabled={!!carDeleting[car.id]}
                                          className="px-6 py-2.5 font-semibold rounded-lg border border-red-500/60 text-red-200 hover:bg-red-500/20 transition-colors disabled:opacity-60"
                                      >
                                          {carDeleting[car.id] ? 'Deleting...' : 'Delete'}
                                      </button>
                                  </div>
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
                                 <DashboardInput
                                     id={`${car.id}-colour`}
                                     label="Colour"
                                     type="text"
                                     value={car.colour}
                                     readOnly={!editing}
                                     onChange={handleCarChange(car.id, 'colour')}
                                 />
                                 <DashboardInput
                                     id={`${car.id}-keeper`}
                                     label="Keeper"
                                     type="text"
                                     value={car.keeperInfo}
                                     readOnly={!editing}
                                     onChange={handleCarChange(car.id, 'keeperInfo')}
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
                                      {!editing && <StatusPill text={getCarDoc(car, 'mot') ? 'Uploaded' : 'Missing'} />}
                                      {editing && (
                                          <div className="pb-1">
                                              <label htmlFor={`${car.id}-mot-upload`} className={uploadButtonClass}>
                                                  Upload
                                              </label>
                                              <input
                                                  type="file"
                                                  id={`${car.id}-mot-upload`}
                                                  className="hidden"
                                                  onChange={(event) =>
                                                      handleCarDocUpload(car.id, 'mot', event.target.files?.[0] ?? null, car.motExpiry)
                                                  }
                                              />
                                          </div>
                                      )}
                                  </div>
                                  {carDocError[`${car.id}-mot`] ? (
                                      <p className="text-[11px] text-red-300">{carDocError[`${car.id}-mot`]}</p>
                                  ) : null}
                                  {carDocUploading[`${car.id}-mot`] ? (
                                      <p className="text-[11px] text-amber-200">Uploading...</p>
                                  ) : null}
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
                                      {!editing && <StatusPill text={getCarDoc(car, 'insurance') ? 'Uploaded' : 'Missing'} />}
                                      {editing && (
                                          <div className="pb-1">
                                              <label htmlFor={`${car.id}-insurance-upload`} className={uploadButtonClass}>
                                                  Upload
                                              </label>
                                              <input
                                                  type="file"
                                                  id={`${car.id}-insurance-upload`}
                                                  className="hidden"
                                                  onChange={(event) =>
                                                      handleCarDocUpload(car.id, 'insurance', event.target.files?.[0] ?? null, car.insuranceExpiry)
                                                  }
                                              />
                                          </div>
                                      )}
                                  </div>
                                  {carDocError[`${car.id}-insurance`] ? (
                                      <p className="text-[11px] text-red-300">{carDocError[`${car.id}-insurance`]}</p>
                                  ) : null}
                                  {carDocUploading[`${car.id}-insurance`] ? (
                                      <p className="text-[11px] text-amber-200">Uploading...</p>
                                  ) : null}
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
                                      {!editing && <StatusPill text={getCarDoc(car, 'phv_car_licence') ? 'Uploaded' : 'Missing'} />}
                                      {editing && (
                                          <div className="pb-1">
                                              <label htmlFor={`${car.id}-phv-upload`} className={uploadButtonClass}>
                                                  Upload
                                              </label>
                                              <input
                                                  type="file"
                                                  id={`${car.id}-phv-upload`}
                                                  className="hidden"
                                                  onChange={(event) =>
                                                      handleCarDocUpload(car.id, 'phv_car_licence', event.target.files?.[0] ?? null, car.phvExpiry)
                                                  }
                                              />
                                          </div>
                                      )}
                                  </div>
                                  {carDocError[`${car.id}-phv_car_licence`] ? (
                                      <p className="text-[11px] text-red-300">{carDocError[`${car.id}-phv_car_licence`]}</p>
                                  ) : null}
                                  {carDocUploading[`${car.id}-phv_car_licence`] ? (
                                      <p className="text-[11px] text-amber-200">Uploading...</p>
                                  ) : null}
                                  <div className="flex items-center justify-between py-2 gap-3 border-b border-amber-900/40">
                                      <span className="text-white/90 text-sm">Logbook V5a</span>
                                      <div className="flex items-center gap-3">
                                          <StatusPill text={car.logbookStatus} />
                                          {editing && (
                                              <label htmlFor={`${car.id}-logbook-upload`} className={uploadButtonClass}>
                                                  Upload
                                              </label>
                                          )}
                                          <input
                                              id={`${car.id}-logbook-upload`}
                                              type="file"
                                              className="hidden"
                                              onChange={(event) =>
                                                  handleCarDocUpload(car.id, 'logbook_v5', event.target.files?.[0] ?? null)
                                              }
                                          />
                                      </div>
                                  </div>
                                  {carDocError[`${car.id}-logbook_v5`] ? (
                                      <p className="text-[11px] text-red-300">{carDocError[`${car.id}-logbook_v5`]}</p>
                                  ) : null}
                                  {carDocUploading[`${car.id}-logbook_v5`] ? (
                                      <p className="text-[11px] text-amber-200">Uploading...</p>
                                  ) : null}
                                  <div className="flex flex-col gap-2 py-2 border-b border-amber-900/40">
                                      <div className="flex items-center justify-between gap-3">
                                          <span className="text-white/90 text-sm">Other documents</span>
                                          <div className="flex items-center gap-3">
                                              <StatusPill
                                                  text={editing ? 'Upload' : car.otherDocumentsStatus}
                                                  variant={editing ? 'warning' : undefined}
                                              />
                                              {editing && (
                                                  <label htmlFor={`${car.id}-other-docs-upload`} className={uploadButtonClass}>
                                                      Upload
                                                  </label>
                                              )}
                                              <input
                                                  id={`${car.id}-other-docs-upload`}
                                                  type="file"
                                                  className="hidden"
                                                  onChange={(event) =>
                                                      handleCarDocUpload(car.id, 'other', event.target.files?.[0] ?? null)
                                                  }
                                              />
                                          </div>
                                      </div>
                                      {carDocError[`${car.id}-other`] ? (
                                          <p className="text-[11px] text-red-300">{carDocError[`${car.id}-other`]}</p>
                                      ) : null}
                                      {carDocUploading[`${car.id}-other`] ? (
                                          <p className="text-[11px] text-amber-200">Uploading...</p>
                                      ) : null}
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
                                                              x
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
                 <form className="space-y-4" onSubmit={handleAddCar}>
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
                    <DashboardInput
                        id="colour"
                        label="Colour"
                        type="text"
                        value={colour}
                        placeholder="Enter colour"
                        onChange={(e) => setColour(e.target.value)}
                    />
                    <DashboardInput
                        id="keeperInfo"
                        label="Keeper"
                        type="text"
                        value={keeperInfo}
                        placeholder="Enter keeper"
                        onChange={(e) => setKeeperInfo(e.target.value)}
                    />

                    <div className="pt-2">
                        <AddCarUploadItem
                            label="MOT"
                            value={newCarDocs.mot.expiryDate}
                            onDateChange={(value) => updateNewCarDoc('mot', { expiryDate: value })}
                            onFileChange={(file) => updateNewCarDoc('mot', { file, status: file ? 'Queued' : '' })}
                            statusText={newCarDocs.mot.status}
                        />
                        <AddCarUploadItem
                            label="Insurance"
                            value={newCarDocs.insurance.expiryDate}
                            onDateChange={(value) => updateNewCarDoc('insurance', { expiryDate: value })}
                            onFileChange={(file) => updateNewCarDoc('insurance', { file, status: file ? 'Queued' : '' })}
                            statusText={newCarDocs.insurance.status}
                        />
                        <AddCarUploadItem
                            label="PHV Car License"
                            value={newCarDocs.phv_car_licence.expiryDate}
                            onDateChange={(value) => updateNewCarDoc('phv_car_licence', { expiryDate: value })}
                            onFileChange={(file) => updateNewCarDoc('phv_car_licence', { file, status: file ? 'Queued' : '' })}
                            statusText={newCarDocs.phv_car_licence.status}
                        />
                        <AddCarUploadItem
                            label="Logbook V5"
                            showExpiry={false}
                            onFileChange={(file) => updateNewCarDoc('logbook_v5', { file, status: file ? 'Queued' : '' })}
                            statusText={newCarDocs.logbook_v5.status}
                        />
                        <AddCarUploadItem
                            label="Other documents"
                            showExpiry={false}
                            onFileChange={(file) => updateNewCarDoc('other', { file, status: file ? 'Queued' : '' })}
                            statusText={newCarDocs.other.status}
                        />
                    </div>
                    
                    <div className="pt-4 flex justify-start">
                        <button
                            type="submit"
                            className="px-10 py-2.5 font-semibold bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-60"
                            disabled={carSaving}
                        >
                            {carSaving ? 'Saving...' : 'Save New Car'}
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
