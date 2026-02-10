'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Clock, User, DollarSign, Car, Search } from 'lucide-react';
import AdminPageHeader from '@/components/AdminPageHeader';
import PageShell from '@/components/PageShell';
import Modal from '@/components/Modal';

type LogEntry = {
  timestamp: string;
  action: string;
  actor: string;
};

type DriverJob = {
  id: string;
  pickup: string;
  destination: string;
  client: string;
  time: string;
  pay: number;
  notes: string;
};

type DriverCar = {
  vrm: string;
  make: string;
  model: string;
  motExpiry: string;
  insuranceExpiry: string;
  phvExpiry: string;
  logbook: string;
  status: 'Active' | 'Reserve';
  startDate: string;
};

type StatementRow = {
  date: string;
  ref: string;
  pickup: string;
  dropoff: string;
  vehicle: string;
  miles: number;
  wait: number;
  fare: number;
  status: 'Paid' | 'Unpaid';
};

type DocumentRow = {
  name: string;
  type: string;
  url: string;
};

type DriverProfileData = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  license: string;
  pcoExpiry: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  profilePhotoUrl?: string | null;
  rating: string;
  tenure: string;
  lastOnline: string;
  dateStarted: string;
  dateStopped?: string | null;
  cars: DriverCar[];
  carDetails: Array<{
    id?: string;
    vrm: string;
    make: string;
    model: string;
    colour: string;
    keeper: string;
    status?: string;
    vehicleTypeId?: number | null;
    vehicleTypeLabel?: string;
    documents?: Array<{ docType: string; name: string; url: string; type: string; expiryDate: string | null }>;
  }>;
  upcomingJobs: DriverJob[];
  completedJobs: DriverJob[];
  statementRows: StatementRow[];
  documents: DocumentRow[];
  logs: LogEntry[];
  commission: number;
};

type DriverStatusAction = 'holiday' | 'resume' | 'block';

type ConfirmationState =
  | { type: 'driver-status'; driverId: string; action: DriverStatusAction; message: string }
  | { type: 'vehicle-cease'; driverId: string; vrm: string; message: string }
  | null;

const tabs = ['Details', 'Jobs', 'Car(s)', 'Monthly Statement', 'Documents Uploaded', 'Logs', 'New Photo Upload'] as const;

const InfoItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
    <p className="text-xs uppercase tracking-wider text-amber-200/70">{label}</p>
    <p className="text-lg font-semibold text-white/90">{value}</p>
  </div>
);

const JobCard: React.FC<{ job: DriverJob }> = ({ job }) => (
  <div className="space-y-2 rounded-2xl border border-gray-800/80 bg-gray-900/60 p-4">
    <div className="flex flex-col gap-2">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-amber-300">{job.pickup}</h3>
          <p className="text-sm text-white/80">to {job.destination}</p>
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">#{job.id}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-300">
        <span className="flex items-center gap-1">
          <Clock size={14} /> {job.time}
        </span>
        <span className="flex items-center gap-1">
          <User size={14} /> {job.client}
        </span>
        <span className="flex items-center gap-1">
          <DollarSign size={14} /> £{job.pay.toFixed(2)}
        </span>
      </div>
      <p className="text-sm text-gray-400">{job.notes}</p>
    </div>
  </div>
);

const CarCard: React.FC<{
  car: DriverCar;
  isCeased: boolean;
  onVehicleCease: () => void;
}> = ({ car, isCeased, onVehicleCease }) => (
  <div className="space-y-3 rounded-2xl border border-gray-800/80 bg-gradient-to-br from-[#111111] to-black p-4">
    <div className="flex items-center gap-3">
      <Car className="text-amber-400" size={20} />
      <div>
        <p className="text-lg font-bold text-white">
          {car.make} {car.model}
        </p>
        <p className="text-sm text-gray-400">{car.vrm}</p>
      </div>
      <span className="ml-auto rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-200 border-amber-500/50">
        {isCeased ? 'Ceased' : car.status}
      </span>
    </div>
    <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
      <span>MOT: {car.motExpiry}</span>
      <span>Insurance: {car.insuranceExpiry}</span>
      <span>PHV: {car.phvExpiry}</span>
      <span>Logbook: {car.logbook}</span>
      <span>Start date: {car.startDate}</span>
      <span className="flex items-center gap-2">
        <button
          type="button"
          onClick={onVehicleCease}
          disabled={isCeased}
          className="rounded-full border border-red-500/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-red-200 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Vehicle ceased
        </button>
      </span>
    </div>
  </div>
);

const downloadStatementCSV = (rows: StatementRow[]) => {
  const headers = ['Date', 'Ref', 'Pickup', 'Dropoff', 'Vehicle', 'Miles', 'Wait', 'Fare', 'Status'];
  const csvRows = [
    headers.join(','),
    ...rows.map((row) =>
      [
        row.date,
        row.ref,
        `"${row.pickup}"`,
        `"${row.dropoff}"`,
        row.vehicle,
        row.miles,
        row.wait,
        row.fare.toFixed(2),
        row.status
      ].join(',')
    )
  ];

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'statement.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const AdminDriversPage: React.FC = () => {
  const [driverProfiles, setDriverProfiles] = useState<DriverProfileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commissionError, setCommissionError] = useState<string | null>(null);
  const [commissionSaving, setCommissionSaving] = useState<Record<string, boolean>>({});
  const [photoUploading, setPhotoUploading] = useState<Record<string, boolean>>({});
  const [photoError, setPhotoError] = useState<Record<string, string | null>>({});
  const [query, setQuery] = useState('');
  const [activeTabs, setActiveTabs] = useState<Record<string, (typeof tabs)[number]>>({});
  const [pricingVehicles, setPricingVehicles] = useState<Array<{ id: number; label: string }>>([]);
  const [rowStatuses, setRowStatuses] = useState<Record<string, Record<string, 'Paid' | 'Unpaid'>>>({});
  const [carCeasedState, setCarCeasedState] = useState<Record<string, Record<string, boolean>>>({});
  const [commissions, setCommissions] = useState<Record<string, { value: string; editing: boolean }>>({});
  const [confirmation, setConfirmation] = useState<ConfirmationState>(null);

  const formatDate = (value: string) => {
    if (!value || value === '-') return '-';
    const dateValue = new Date(value);
    if (Number.isNaN(dateValue.getTime())) return value;
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(dateValue);
  };

  const formatShortDate = (value: string) => {
    if (!value || value === '-') return 'n/a';
    const dateValue = new Date(value);
    if (Number.isNaN(dateValue.getTime())) return value;
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(dateValue);
  };

  const formatTenure = (startValue: string) => {
    if (!startValue || startValue === '-') return 'n/a';
    const start = new Date(startValue);
    if (Number.isNaN(start.getTime())) return 'n/a';
    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - start.getTime());
    const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (totalDays < 31) {
      return `${totalDays} day${totalDays === 1 ? '' : 's'}`;
    }
    if (totalDays < 365) {
      const months = Math.floor(totalDays / 30);
      const days = totalDays % 30;
      return `${months} month${months === 1 ? '' : 's'}${days ? ` ${days} day${days === 1 ? '' : 's'}` : ''}`;
    }
    const years = Math.floor(totalDays / 365);
    const months = Math.floor((totalDays % 365) / 30);
    return `${years} year${years === 1 ? '' : 's'}${months ? ` ${months} month${months === 1 ? '' : 's'}` : ''}`;
  };

  useEffect(() => {
    const loadDrivers = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/admin/drivers', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const mapped = (data.drivers || []).map((driver: any) => ({
          id: String(driver.id),
          name: driver.name,
          phone: driver.phone,
          email: driver.email,
          address: driver.address,
          license: driver.license,
          pcoExpiry: driver.pcoExpiry,
          status: driver.status || 'active',
          createdAt: driver.createdAt || '-',
          updatedAt: driver.updatedAt || '-',
          profilePhotoUrl: driver.profilePhotoUrl || null,
          rating: 'n/a',
          tenure: formatTenure(driver.createdAt || '-'),
          lastOnline: 'n/a',
          dateStarted: formatShortDate(driver.createdAt || '-'),
          dateStopped: null,
          cars: [],
          carDetails: (driver.carDetails || []).map((car: any) => ({
            ...car,
            documents: Array.isArray(car.documents) ? car.documents : [],
          })),
          upcomingJobs: [],
          completedJobs: [],
          statementRows: [],
          documents: driver.documents || [],
          logs: [],
          commission: Number(driver.commission ?? 20),
        })) as DriverProfileData[];
        setDriverProfiles(mapped);
        setPricingVehicles(data.pricingVehicles || []);
      } catch (err: any) {
        setError(err?.message || 'Failed to load drivers');
        setDriverProfiles([]);
      } finally {
        setLoading(false);
      }
    };
    loadDrivers();
  }, []);

  useEffect(() => {
    setCarCeasedState((prev) => {
      const next = { ...prev };
      driverProfiles.forEach((driver) => {
        if (!next[driver.id]) next[driver.id] = {};
      });
      return next;
    });
    setCommissions((prev) => {
      const next = { ...prev };
      driverProfiles.forEach((driver) => {
        if (!next[driver.id]) {
          next[driver.id] = { value: String(driver.commission ?? 20), editing: false };
        }
      });
      return next;
    });
  }, [driverProfiles]);

  const getActiveTab = (driverId: string) => activeTabs[driverId] ?? tabs[0];
  const handleTabChange = (driverId: string, tab: (typeof tabs)[number]) => {
    setActiveTabs((prev) => ({ ...prev, [driverId]: tab }));
  };

  const filteredDrivers = useMemo(() => {
    if (!query.trim()) return driverProfiles;
    const searchTerm = query.toLowerCase();
    return driverProfiles.filter((driver) => {
      return (
        driver.name.toLowerCase().includes(searchTerm) ||
        driver.email.toLowerCase().includes(searchTerm) ||
        driver.id.toLowerCase().includes(searchTerm) ||
        driver.phone.toLowerCase().includes(searchTerm)
      );
    });
  }, [query, driverProfiles]);

  const getRowStatus = (driverId: string, ref: string): 'Paid' | 'Unpaid' => {
    return rowStatuses[driverId]?.[ref] ?? driverProfiles.find((d) => d.id === driverId)?.statementRows.find((r) => r.ref === ref)?.status ?? 'Unpaid';
  };

  const toggleRowStatus = (driverId: string, ref: string) => {
    setRowStatuses((prev) => ({
      ...prev,
      [driverId]: {
        ...prev[driverId],
        [ref]: prev[driverId]?.[ref] === 'Paid' ? 'Unpaid' : 'Paid'
      }
    }));
  };

  const applyDriverStatusChange = async (driverId: string, action: DriverStatusAction) => {
    const nextStatus = action === 'resume' ? 'active' : action === 'holiday' ? 'holiday' : 'blocked';
    setCommissionError(null);
    try {
      const res = await fetch('/api/admin/drivers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId, status: nextStatus }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to update status');
      }
      const data = await res.json().catch(() => ({}));
      setDriverProfiles((prev) =>
        prev.map((driver) =>
          driver.id === driverId
            ? {
                ...driver,
                status: data.status || nextStatus,
                updatedAt: data.updatedAt || driver.updatedAt,
                tenure: formatTenure(driver.createdAt),
              }
            : driver
        )
      );
    } catch (err: any) {
      setCommissionError(err?.message || 'Failed to update status');
    }
  };

  const handleVehicleTypeChange = async (driverId: string, driverCarId: string | undefined, vehicleTypeId: number) => {
    if (!driverCarId) return;
    setCommissionError(null);
    try {
      const res = await fetch('/api/admin/drivers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverCarId, vehicleTypeId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to update vehicle type');
      }
      setDriverProfiles((prev) =>
        prev.map((driver) =>
          driver.id !== driverId
            ? driver
            : {
                ...driver,
                carDetails: driver.carDetails.map((car) =>
                  car.id === driverCarId
                    ? { ...car, vehicleTypeId }
                    : car
                ),
              }
        )
      );
    } catch (err: any) {
      setCommissionError(err?.message || 'Failed to update vehicle type');
    }
  };

  const handlePhotoUpload = async (driverId: string, file: File | null) => {
    if (!file) return;
    setPhotoUploading((prev) => ({ ...prev, [driverId]: true }));
    setPhotoError((prev) => ({ ...prev, [driverId]: null }));
    try {
      const payload = new FormData();
      payload.append('driverId', driverId);
      payload.append('file', file);
      const res = await fetch('/api/admin/drivers/photo', {
        method: 'POST',
        body: payload,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to upload photo');
      }
      const data = await res.json().catch(() => ({}));
      setDriverProfiles((prev) =>
        prev.map((driver) => {
          if (driver.id !== driverId) return driver;
          const nextDocs = driver.documents.slice();
          const existingIndex = nextDocs.findIndex((doc) => doc.name === 'Profile Photo');
          const docEntry = {
            name: 'Profile Photo',
            type: (data.format || 'FILE').toUpperCase(),
            url: data.url,
          };
          if (existingIndex >= 0) {
            nextDocs[existingIndex] = docEntry;
          } else {
            nextDocs.push(docEntry);
          }
          return {
            ...driver,
            profilePhotoUrl: data.url || driver.profilePhotoUrl,
            documents: nextDocs,
          };
        })
      );
    } catch (err: any) {
      setPhotoError((prev) => ({ ...prev, [driverId]: err?.message || 'Failed to upload photo' }));
    } finally {
      setPhotoUploading((prev) => ({ ...prev, [driverId]: false }));
    }
  };

  const requestDriverStatusChange = (driverId: string, action: DriverStatusAction) => {
    const driverName = driverProfiles.find((d) => d.id === driverId)?.name ?? 'driver';
    const messages: Record<DriverStatusAction, string> = {
      holiday: `Put ${driverName} on Holiday Mode?`,
      resume: `Resume work for ${driverName}?`,
      block: `Block ${driverName}?`
    };
    setConfirmation({
      type: 'driver-status',
      driverId,
      action,
      message: messages[action]
    });
  };

  const applyVehicleCease = (driverId: string, vrm: string) => {
    setCarCeasedState((prev) => ({
      ...prev,
      [driverId]: {
        ...prev[driverId],
        [vrm]: true
      }
    }));
  };

  const requestVehicleCease = (driverId: string, vrm: string) => {
    const driver = driverProfiles.find((d) => d.id === driverId);
    const car = driver?.cars.find((c) => c.vrm === vrm);
    const carLabel = car ? `${car.make} ${car.model} (${vrm})` : vrm;
    setConfirmation({
      type: 'vehicle-cease',
      driverId,
      vrm,
      message: `Mark ${carLabel} as ceased?`
    });
  };

  const toggleCommissionEditing = async (driverId: string) => {
    const current = commissions[driverId] ?? { value: '20', editing: false };
    if (!current.editing) {
      setCommissions((prev) => ({ ...prev, [driverId]: { ...current, editing: true } }));
      return;
    }
    const numericValue = Number(current.value);
    if (Number.isNaN(numericValue)) {
      setCommissionError('Commission must be a number.');
      return;
    }
    setCommissionSaving((prev) => ({ ...prev, [driverId]: true }));
    setCommissionError(null);
    try {
      const res = await fetch('/api/admin/drivers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId, commission: numericValue }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to update commission');
      }
      setCommissions((prev) => ({ ...prev, [driverId]: { ...current, editing: false } }));
    } catch (err: any) {
      setCommissionError(err?.message || 'Failed to update commission');
    } finally {
      setCommissionSaving((prev) => ({ ...prev, [driverId]: false }));
    }
  };

  const handleCommissionChange = (driverId: string, value: string) => {
    setCommissions((prev) => {
      const current = prev[driverId] ?? { value: '20', editing: false };
      return { ...prev, [driverId]: { ...current, value } };
    });
  };

  const handleConfirmAction = () => {
    if (!confirmation) return;
    if (confirmation.type === 'driver-status') {
      applyDriverStatusChange(confirmation.driverId, confirmation.action);
    } else if (confirmation.type === 'vehicle-cease') {
      applyVehicleCease(confirmation.driverId, confirmation.vrm);
    }
    setConfirmation(null);
  };

  const handleCancelAction = () => setConfirmation(null);

  const renderTabContent = (driver: DriverProfileData) => {
    const tab = getActiveTab(driver.id);
    const commissionState = commissions[driver.id] ?? { value: '20', editing: false };
    const status = driver.status || 'active';
    const dateStopped =
      status !== 'active' ? formatShortDate(driver.updatedAt || '-') : '—';
    switch (tab) {
      case 'Details':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <InfoItem label="Phone" value={driver.phone} />
              <InfoItem label="Email" value={driver.email} />
              <InfoItem label="Address" value={driver.address} />
              <InfoItem label="PCO Licence" value={driver.license} />
              <InfoItem label="PCO Expiry" value={formatDate(driver.pcoExpiry)} />
              <InfoItem label="Rating" value={driver.rating} />
              <InfoItem label="Tenure" value={formatTenure(driver.createdAt)} />
              <InfoItem label="Last online" value={driver.lastOnline} />
              <div className="relative rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wider text-amber-200/70">Commission</p>
                {commissionState.editing ? (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={commissionState.value}
                      onChange={(event) => handleCommissionChange(driver.id, event.target.value)}
                      className="w-24 rounded-lg border border-amber-400/40 bg-black/40 px-3 py-1.5 text-white focus:border-amber-400 focus:outline-none"
                    />
                    <span className="text-lg font-semibold text-white/90">%</span>
                  </div>
                ) : (
                  <p className="text-lg font-semibold text-white/90">{commissionState.value}%</p>
                )}
                <button
                  type="button"
                  onClick={() => toggleCommissionEditing(driver.id)}
                  className="absolute bottom-3 right-3 rounded-full border border-amber-400/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-200 transition hover:bg-amber-400/10"
                  disabled={commissionSaving[driver.id]}
                >
                  {commissionSaving[driver.id] ? 'Saving...' : commissionState.editing ? 'Save' : 'Edit'}
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wider text-amber-200/70">Date started</p>
                  <p className="text-lg font-semibold text-white/90">{formatShortDate(driver.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-amber-200/70">Date stopped</p>
                  <p className="text-lg font-semibold text-white/90">
                    {dateStopped}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => requestDriverStatusChange(driver.id, 'holiday')}
                  disabled={status === 'holiday'}
                  className="rounded-full border border-amber-500/60 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-amber-200 hover:bg-amber-500/10 disabled:opacity-50"
                >
                  Holiday mode
                </button>
                <button
                  type="button"
                  onClick={() => requestDriverStatusChange(driver.id, 'resume')}
                  disabled={status === 'active'}
                  className="rounded-full border border-emerald-500/60 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50"
                >
                  Resume work
                </button>
                <button
                  type="button"
                  onClick={() => requestDriverStatusChange(driver.id, 'block')}
                  disabled={status === 'blocked'}
                  className="rounded-full border border-red-500/60 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-red-200 hover:bg-red-500/10 disabled:opacity-50"
                >
                  Block driver
                </button>
              </div>
            </div>
          </div>
        );
      case 'Jobs':
        return (
          <div className="space-y-6">
            {driver.upcomingJobs.length > 0 && (
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-amber-300">Upcoming Jobs</h3>
                  <p className="text-xs text-gray-400">{driver.upcomingJobs.length} pending</p>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {driver.upcomingJobs.map((job) => (
                    <JobCard job={job} key={job.id} />
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-amber-300">Completed Jobs</h3>
                <p className="text-xs text-gray-400">{driver.completedJobs.length} logged</p>
              </div>
              {driver.completedJobs.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {driver.completedJobs.map((job) => (
                    <JobCard job={job} key={job.id} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">No completed jobs recorded.</p>
              )}
            </div>
          </div>
        );
      case 'Car(s)':
        return (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {driver.carDetails.length === 0 ? (
              <div className="rounded-2xl border border-amber-900/50 bg-gradient-to-br from-[#1E1212] via-[#100808] to-black p-4 text-sm text-gray-300">
                <p className="text-gray-400">No car details submitted yet.</p>
              </div>
            ) : (
              driver.carDetails.map((car, index) => (
                <div
                  key={`${driver.id}-car-${index}`}
                  className="rounded-2xl border border-amber-900/50 bg-gradient-to-br from-[#1E1212] via-[#100808] to-black p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase text-amber-300">Vehicle</p>
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-bold text-white">{car.make} {car.model}</p>
                        {car.status === 'active' ? (
                          <span className="rounded-full border border-emerald-500/60 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-200">
                            Active
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                            <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-white/80">
                              <p><span className="text-amber-200 uppercase mr-2">VRM</span>{car.vrm}</p>
                              <p><span className="text-amber-200 uppercase mr-2">Colour</span>{car.colour}</p>
                              <p><span className="text-amber-200 uppercase mr-2">Keeper</span>{car.keeper}</p>
                              <div className="mt-2">
                                <label className="block text-[11px] uppercase tracking-wide text-amber-200/70 mb-1">
                                  Vehicle Type
                                </label>
                                <select
                                  value={car.vehicleTypeId ?? ''}
                                  onChange={(event) =>
                                    handleVehicleTypeChange(driver.id, car.id, Number(event.target.value))
                                  }
                                  className="w-full rounded-lg border border-amber-900/60 bg-black/40 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
                                >
                                  <option value="" disabled>
                                    Select vehicle type
                                  </option>
                                  {pricingVehicles.map((vehicle) => (
                                    <option key={vehicle.id} value={vehicle.id}>
                                      {vehicle.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                  <div className="mt-4 border-t border-amber-900/40 pt-3 text-xs text-white/80">
                    <p className="text-xs uppercase text-amber-300 mb-2">Documents</p>
                    {car.documents && car.documents.length > 0 ? (
                      <div className="space-y-2">
                        {[
                          { label: 'MOT', type: 'mot' },
                          { label: 'Insurance', type: 'insurance' },
                          { label: 'PHV Car Licence', type: 'phv_car_licence' },
                          { label: 'Logbook V5 Page 1', type: 'logbook_v5' },
                          { label: 'Logbook V5 Page 2', type: 'logbook_v5_page2' },
                          { label: 'Other', type: 'other' },
                        ].map((entry) => {
                          const doc = car.documents?.find((item) => item.docType === entry.type);
                          return (
                            <div key={`${driver.id}-${car.vrm}-${entry.type}`} className="flex items-center justify-between">
                              <span>{entry.label}</span>
                              <span className="flex items-center gap-2">
                                <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                                  {doc ? 'Uploaded' : 'Missing'}
                                </span>
                                {doc?.url ? (
                                  <a
                                    href={doc.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-amber-200 hover:text-amber-100"
                                  >
                                    View
                                  </a>
                                ) : null}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">No documents uploaded for this car yet.</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        );
      case 'Monthly Statement':
        const rowsWithStatus = driver.statementRows.map((row) => ({
          ...row,
          status: getRowStatus(driver.id, row.ref)
        }));
        return (
          <div className="space-y-4">
            <div className="overflow-x-auto rounded-2xl border border-amber-900/50 bg-gradient-to-br from-[#1E1212] via-[#100808] to-black p-4">
              <table className="w-full min-w-max text-left text-sm text-white/80">
                <thead>
                  <tr className="border-b border-amber-900/50 text-xs uppercase tracking-wider text-amber-300">
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Ref</th>
                    <th className="py-2 px-3">Pickup</th>
                    <th className="py-2 px-3">Dropoff</th>
                    <th className="py-2 px-3">Vehicle</th>
                    <th className="py-2 px-3 text-right">Fare (£)</th>
                    <th className="py-2 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rowsWithStatus.map((row) => (
                    <tr key={row.ref} className="border-b border-white/5">
                      <td className="py-2 px-3 text-white/90">{row.date}</td>
                      <td className="py-2 px-3 text-white/90">{row.ref}</td>
                      <td className="py-2 px-3 text-white/90">{row.pickup}</td>
                      <td className="py-2 px-3 text-white/90">{row.dropoff}</td>
                      <td className="py-2 px-3 text-white/90">{row.vehicle}</td>
                      <td className="py-2 px-3 text-right text-amber-300 font-semibold">£{row.fare.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => toggleRowStatus(driver.id, row.ref)}
                          className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full transition ${
                            row.status === 'Paid'
                              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/40'
                              : 'bg-amber-500 text-black shadow-lg shadow-amber-500/40'
                          }`}
                        >
                          {row.status}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => downloadStatementCSV(rowsWithStatus)}
              className="w-max rounded-full border border-amber-500/60 bg-transparent px-6 py-2 text-sm font-semibold uppercase tracking-wide text-amber-300 transition hover:border-amber-400 hover:text-black hover:bg-amber-400"
            >
              Download CSV
            </button>
          </div>
        );
      case 'Documents Uploaded':
        return (
          <div className="overflow-x-auto rounded-2xl border border-amber-900/50 bg-gradient-to-br from-[#1E1212] via-[#100808] to-black p-4">
            {driver.documents.length === 0 ? (
              <p className="text-sm text-gray-400">No documents uploaded yet.</p>
            ) : (
              <table className="w-full min-w-max text-left text-sm text-white/80">
                <thead>
                  <tr className="border-b border-amber-900/50 text-xs uppercase tracking-wider text-amber-300">
                    <th className="py-2 px-3">Name</th>
                    <th className="py-2 px-3">Type</th>
                    <th className="py-2 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {driver.documents.map((doc) => (
                    <tr key={`${driver.id}-${doc.name}`} className="border-b border-white/5">
                      <td className="py-2 px-3 text-white/90">{doc.name}</td>
                      <td className="py-2 px-3 text-white/70">{doc.type}</td>
                      <td className="py-2 px-3 text-right">
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white transition hover:border-amber-400 hover:text-amber-300"
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      case 'Logs':
        return (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-black/50 p-4">
            {driver.logs.length === 0 ? (
              <p className="text-sm text-gray-400">No activity logged yet.</p>
            ) : (
              <ul className="space-y-2">
                {driver.logs.map((log, index) => (
                  <li
                    key={`${driver.id}-log-${index}`}
                    className="flex flex-col rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/90"
                  >
                    <span className="text-xs uppercase tracking-wide text-amber-300">{log.timestamp}</span>
                    <span className="font-semibold">{log.action}</span>
                    <span className="text-xs text-gray-400">{log.actor}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      case 'New Photo Upload':
        return (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <label className="block text-[11px] uppercase tracking-wide text-gray-400 mb-2">
              Upload image
            </label>
            <input
              type="file"
              accept="image/*"
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-amber-400 file:px-3 file:py-1 file:text-black file:font-semibold file:cursor-pointer"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                handlePhotoUpload(driver.id, file);
              }}
            />
            {photoUploading[driver.id] ? (
              <p className="mt-2 text-xs text-amber-300">Uploading...</p>
            ) : null}
            {photoError[driver.id] ? (
              <p className="mt-2 text-xs text-red-300">{photoError[driver.id]}</p>
            ) : null}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <PageShell mainClassName="flex flex-col px-4 sm:px-6 md:px-8 py-10" hideFooter hideHeader>
        <div className="w-full flex-grow">
          <div className="max-w-6xl mx-auto space-y-8">
            <AdminPageHeader active="drivers" />
            <section className="space-y-10">
              <div className="relative w-full">
                <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                  <Search size={16} />
                </span>
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search drivers by name, email or ID..."
                  className="w-full rounded-2xl border border-white/10 bg-black/40 px-10 py-3 text-white placeholder-gray-500 focus:border-amber-400 focus:outline-none"
                />
              </div>
              {error ? (
                <div className="rounded-2xl border border-red-500/50 bg-red-950/40 p-6 text-center text-red-200">
                  {error}
                </div>
              ) : null}
              {commissionError ? (
                <div className="rounded-2xl border border-red-500/50 bg-red-950/40 p-4 text-center text-red-200 text-sm">
                  {commissionError}
                </div>
              ) : null}
              {loading ? (
                <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-center text-gray-400">
                  Loading drivers...
                </div>
              ) : null}
              {!loading && filteredDrivers.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-center text-gray-400">
                  No drivers match your search. Try a different name or ID.
                </div>
              ) : (
                <>
                  {filteredDrivers.map((driver) => (
                    <article
                      key={driver.id}
                      className="space-y-6 rounded-3xl border border-white/10 bg-black/60 p-6 shadow-lg shadow-black/60"
                    >
                      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                        <div className="flex items-center gap-[10px]">
                          <div className="w-[100px] min-h-[90px] rounded-xl bg-gray-800/70 overflow-hidden">
                            {driver.profilePhotoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={driver.profilePhotoUrl}
                                alt={`${driver.name} profile`}
                                className="h-full w-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wider text-amber-300/70">
                              Driver ID {driver.id.toUpperCase()}
                              <span
                                className={`ml-2 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                                  driver.status === 'holiday'
                                    ? 'border-amber-500/60 bg-amber-500/20 text-amber-200'
                                    : driver.status === 'blocked'
                                      ? 'border-red-500/60 bg-red-500/20 text-red-200'
                                      : 'border-emerald-500/60 bg-emerald-500/20 text-emerald-200'
                                }`}
                              >
                                {driver.status || 'active'}
                              </span>
                            </p>
                            <h2 className="text-2xl font-bold text-white">{driver.name}</h2>
                            <p className="text-sm text-gray-400">{driver.email}</p>
                          </div>
                        </div>
                        <div className="text-sm text-gray-300">
                          <p>Phone: {driver.phone}</p>
                          <p>PCO Expiry: {formatDate(driver.pcoExpiry)}</p>
                        </div>
                      </header>
                      <div className="flex flex-wrap items-center gap-3">
                        <nav className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-2">
                          {tabs.map((tab) => (
                            <button
                              key={tab}
                              type="button"
                              onClick={() => handleTabChange(driver.id, tab)}
                              className={`relative px-4 py-2 text-sm font-semibold rounded-full transition-colors whitespace-nowrap ${
                                getActiveTab(driver.id) === tab
                                  ? 'bg-amber-400 text-black shadow-md shadow-amber-400/30'
                                  : 'bg-gray-800/40 text-amber-300 hover:bg-gray-700/40'
                              }`}
                            >
                              {tab}
                              {tab === 'Jobs' && driver.upcomingJobs.length > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[11px] font-bold text-white">
                                  {driver.upcomingJobs.length}
                                </span>
                              )}
                            </button>
                          ))}
                        </nav>
                      </div>
                      <div>{renderTabContent(driver)}</div>
                    </article>
                  ))}
                </>
              )}
            </section>
          </div>
        </div>
      </PageShell>
      {confirmation && (
        <Modal
          isOpen={true}
          onClose={handleCancelAction}
          title="Confirm action"
        >
          <p className="text-sm text-gray-200">{confirmation.message}</p>
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={handleCancelAction}
              className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-gray-100 hover:border-white/40 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmAction}
              className="rounded-full border border-amber-400 bg-amber-400 px-6 py-2 text-sm font-semibold text-black shadow-[0_0_15px_rgba(251,191,36,0.4)] hover:shadow-[0_0_25px_rgba(251,191,36,0.6)] transition"
            >
              Confirm
            </button>
          </div>
        </Modal>
      )}
    </>
  );
};

export default AdminDriversPage;
