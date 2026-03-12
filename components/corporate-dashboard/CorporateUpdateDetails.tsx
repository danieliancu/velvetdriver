'use client';

import React, { useEffect, useState } from 'react';
import Input from '@/components/Input';

type CorporateProfileFormData = {
  companyName: string;
  businessAddress: string;
  companyRegNumber: string;
  vatNumber: string;
  businessType: string;
  contactName: string;
  contactTitle: string;
  contactEmail: string;
  contactPhone: string;
  accountsName: string;
  accountsEmail: string;
  accountsPhone: string;
  billingAddress: string;
  invoiceMethod: string;
  estimatedJourneys: string;
  vehicleTypes: string;
  serviceNotes: string;
  paymentMethod: string;
  poRequired: string;
  invoiceEmail: string;
  journeyTypes: string[];
};

type CorporateUpdateDetailsProps = {
  profile?: Partial<CorporateProfileFormData> | null;
  onSubmit: (payload: CorporateProfileFormData & { newPassword?: string }) => Promise<void>;
  saving?: boolean;
};

const journeyTypeOptions = ['Airport transfers', 'Business meetings', 'Events', 'Roadshows', 'VIP', 'Other'];
const invoiceFrequencyOptions = ['Per journey', 'Weekly', 'Monthly'];
const paymentMethods = ['Bank transfer', 'Online payment link', 'Card to chauffeur', 'Cash to chauffeur'];

const toFormState = (profile?: Partial<CorporateProfileFormData> | null): CorporateProfileFormData => ({
  companyName: String(profile?.companyName ?? ''),
  businessAddress: String(profile?.businessAddress ?? ''),
  companyRegNumber: String(profile?.companyRegNumber ?? ''),
  vatNumber: String(profile?.vatNumber ?? ''),
  businessType: String(profile?.businessType ?? ''),
  contactName: String(profile?.contactName ?? ''),
  contactTitle: String(profile?.contactTitle ?? ''),
  contactEmail: String(profile?.contactEmail ?? ''),
  contactPhone: String(profile?.contactPhone ?? ''),
  accountsName: String(profile?.accountsName ?? ''),
  accountsEmail: String(profile?.accountsEmail ?? ''),
  accountsPhone: String(profile?.accountsPhone ?? ''),
  billingAddress: String(profile?.billingAddress ?? ''),
  invoiceMethod: String(profile?.invoiceMethod ?? ''),
  estimatedJourneys: String(profile?.estimatedJourneys ?? ''),
  vehicleTypes: String(profile?.vehicleTypes ?? ''),
  serviceNotes: String(profile?.serviceNotes ?? ''),
  paymentMethod: String(profile?.paymentMethod ?? ''),
  poRequired: String(profile?.poRequired ?? ''),
  invoiceEmail: String(profile?.invoiceEmail ?? ''),
  journeyTypes: Array.isArray(profile?.journeyTypes)
    ? profile!.journeyTypes!.map((item) => String(item ?? '')).filter(Boolean)
    : [],
});

const CorporateUpdateDetails: React.FC<CorporateUpdateDetailsProps> = ({ profile, onSubmit, saving = false }) => {
  const [formData, setFormData] = useState<CorporateProfileFormData>(() => toFormState(profile));
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFormData(toFormState(profile));
  }, [profile]);

  const handleFieldChange =
    (field: keyof CorporateProfileFormData) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setFormData((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const toggleJourneyType = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      journeyTypes: prev.journeyTypes.includes(value)
        ? prev.journeyTypes.filter((item) => item !== value)
        : [...prev.journeyTypes, value],
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!formData.companyName.trim() || !formData.contactName.trim() || !formData.contactPhone.trim()) {
      setError('Company name, contact name and contact phone are required.');
      return;
    }
    if ((newPassword || repeatPassword) && newPassword !== repeatPassword) {
      setError('Passwords do not match.');
      return;
    }
    await onSubmit({ ...formData, newPassword: newPassword || undefined });
    setNewPassword('');
    setRepeatPassword('');
  };

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Company Information</h3>
        <Input id="companyName" label="Company Name" required value={formData.companyName} onChange={handleFieldChange('companyName')} />
        <Input
          id="businessAddress"
          label="Registered Business Address"
          required
          value={formData.businessAddress}
          onChange={handleFieldChange('businessAddress')}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="companyRegNumber"
            label="Company Registration Number"
            value={formData.companyRegNumber}
            onChange={handleFieldChange('companyRegNumber')}
          />
          <Input id="vatNumber" label="VAT Number" value={formData.vatNumber} onChange={handleFieldChange('vatNumber')} />
        </div>
        <Input
          id="businessType"
          label="Type of Business / Industry"
          value={formData.businessType}
          onChange={handleFieldChange('businessType')}
        />
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Main Contact Person</h3>
        <Input id="contactName" label="Full Name" required value={formData.contactName} onChange={handleFieldChange('contactName')} />
        <Input id="contactTitle" label="Job Title / Position" required value={formData.contactTitle} onChange={handleFieldChange('contactTitle')} />
        <Input
          id="contactEmail"
          label="Work Email Address"
          type="email"
          required
          value={formData.contactEmail}
          onChange={handleFieldChange('contactEmail')}
          readOnly
        />
        <Input
          id="contactPhone"
          label="Direct Phone Number"
          type="tel"
          required
          value={formData.contactPhone}
          onChange={handleFieldChange('contactPhone')}
        />
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Billing / Accounts Details</h3>
        <Input id="accountsName" label="Accounts Contact Name" value={formData.accountsName} onChange={handleFieldChange('accountsName')} />
        <Input
          id="accountsEmail"
          label="Accounts Email Address"
          type="email"
          value={formData.accountsEmail}
          onChange={handleFieldChange('accountsEmail')}
        />
        <Input
          id="accountsPhone"
          label="Accounts Phone Number"
          type="tel"
          value={formData.accountsPhone}
          onChange={handleFieldChange('accountsPhone')}
        />
        <Input
          id="billingAddress"
          label="Billing Address (if different)"
          value={formData.billingAddress}
          onChange={handleFieldChange('billingAddress')}
        />
        <div>
          <label className="block text-sm font-semibold text-gray-200 mb-2">Preferred Invoice Method</label>
          <select
            className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
            value={formData.invoiceMethod}
            onChange={handleFieldChange('invoiceMethod')}
          >
            <option value="" className="bg-gray-900 text-white">
              Select invoice frequency
            </option>
            {invoiceFrequencyOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Service Requirements</h3>
        <div>
          <p className="text-sm font-semibold text-gray-200 mb-2">Typical Journey Types (multi-select)</p>
          <div className="flex flex-wrap gap-3">
            {journeyTypeOptions.map((option) => {
              const checked = formData.journeyTypes.includes(option);
              return (
                <label
                  key={option}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold cursor-pointer transition ${
                    checked ? 'border-amber-400 bg-amber-400/10 text-amber-200' : 'border-white/20 text-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => toggleJourneyType(option)}
                  />
                  <span>{option}</span>
                </label>
              );
            })}
          </div>
        </div>
        <Input
          id="estimatedJourneys"
          label="Estimated Monthly Journeys"
          type="number"
          value={formData.estimatedJourneys}
          onChange={handleFieldChange('estimatedJourneys')}
        />
        <Input
          id="vehicleTypes"
          label="Preferred Vehicle Types"
          value={formData.vehicleTypes}
          onChange={handleFieldChange('vehicleTypes')}
        />
        <div>
          <label htmlFor="serviceNotes" className="block text-sm font-semibold text-gray-200 mb-2">
            Additional Notes / Special Requirements
          </label>
          <textarea
            id="serviceNotes"
            className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
            rows={3}
            value={formData.serviceNotes}
            onChange={handleFieldChange('serviceNotes')}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Payment Preferences</h3>
        <div>
          <label className="block text-sm font-semibold text-gray-200 mb-2">Preferred Payment Method</label>
          <select
            className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
            value={formData.paymentMethod}
            onChange={handleFieldChange('paymentMethod')}
          >
            <option value="" className="bg-gray-900 text-white">
              Select payment method
            </option>
            {paymentMethods.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-200">
            <input
              type="radio"
              name="poRequired"
              value="yes"
              checked={formData.poRequired === 'yes'}
              onChange={handleFieldChange('poRequired')}
            />
            PO Numbers Required: Yes
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-200">
            <input
              type="radio"
              name="poRequired"
              value="no"
              checked={formData.poRequired === 'no'}
              onChange={handleFieldChange('poRequired')}
            />
            PO Numbers Required: No
          </label>
        </div>
        <Input
          id="invoiceEmail"
          label="Invoice Email Address"
          type="email"
          value={formData.invoiceEmail}
          onChange={handleFieldChange('invoiceEmail')}
        />
      </section>

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Security</h3>
        <Input
          id="new-password-corporate"
          label="New Password (optional)"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <Input
          id="repeat-new-password-corporate"
          label="Repeat New Password"
          type="password"
          value={repeatPassword}
          onChange={(e) => setRepeatPassword(e.target.value)}
        />
      </section>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="px-8 py-3 text-lg font-semibold bg-amber-500 text-black rounded-md hover:bg-amber-400 transition-all duration-300 transform hover:scale-105 shadow-[0_0_15px_rgba(251,191,36,0.5)] disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
};

export default CorporateUpdateDetails;
