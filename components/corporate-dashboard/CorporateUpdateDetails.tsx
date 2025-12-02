'use client';

import React, { useState } from 'react';
import Input from '@/components/Input';
import { useAlert } from '@/components/AlertProvider';

const journeyTypeOptions = ['Airport transfers', 'Business meetings', 'Events', 'Roadshows', 'VIP', 'Other'];
const invoiceFrequencyOptions = ['Per journey', 'Weekly', 'Monthly'];
const paymentMethods = ['Bank transfer', 'Online payment link', 'Card to chauffeur', 'Cash to chauffeur'];

const CorporateUpdateDetails: React.FC = () => {
  const { showAlert } = useAlert();
  const [journeyTypes, setJourneyTypes] = useState<string[]>(['Airport transfers', 'Business meetings']);
  const [formData, setFormData] = useState<Record<string, string>>({
    companyName: 'Velvet Partners Ltd',
    businessAddress: '25 Green Park, London',
    companyRegNumber: '12345678',
    vatNumber: 'GB123456789',
    businessType: 'Travel & Hospitality',
    contactName: 'Alex Johnson',
    contactTitle: 'Head of Travel',
    contactEmail: 'alex.johnson@velvetpartners.co.uk',
    contactPhone: '+44 7700 111222',
    accountsName: 'Maria Patel',
    accountsEmail: 'accounts@velvetpartners.co.uk',
    accountsPhone: '+44 7700 333444',
    billingAddress: '',
    invoiceMethod: 'Monthly',
    estimatedJourneys: '25',
    vehicleTypes: 'S-Class, V-Class',
    serviceNotes: 'Evening pickups preferred, water on board.',
    paymentMethod: 'Bank transfer',
    poRequired: 'yes',
    invoiceEmail: 'invoices@velvetpartners.co.uk',
    tandc: 'yes',
    gdpr: 'yes'
  });

  const handleFieldChange =
    (field: string) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setFormData((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const toggleJourneyType = (value: string) => {
    setJourneyTypes((prev) =>
      prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]
    );
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    showAlert('Corporate details updated.');
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
            required
            value={formData.invoiceMethod}
            onChange={handleFieldChange('invoiceMethod')}
          >
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
              const checked = journeyTypes.includes(option);
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
            required
            value={formData.paymentMethod}
            onChange={handleFieldChange('paymentMethod')}
          >
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
              required
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
              required
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

      <section className="space-y-3 text-sm text-gray-200">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            required
            checked={formData.tandc === 'yes'}
            onChange={(event) => setFormData((prev) => ({ ...prev, tandc: event.target.checked ? 'yes' : '' }))}
          />
          <span>I agree to the Terms &amp; Conditions.</span>
        </label>
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            required
            checked={formData.gdpr === 'yes'}
            onChange={(event) => setFormData((prev) => ({ ...prev, gdpr: event.target.checked ? 'yes' : '' }))}
          />
          <span>I consent to data processing under the Privacy Policy.</span>
        </label>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          className="px-8 py-3 text-lg font-semibold bg-amber-500 text-black rounded-md hover:bg-amber-400 transition-all duration-300 transform hover:scale-105 shadow-[0_0_15px_rgba(251,191,36,0.5)]"
        >
          Save Changes
        </button>
      </div>
    </form>
  );
};

export default CorporateUpdateDetails;
