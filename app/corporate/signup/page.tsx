'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import FormLayout from '@/components/FormLayout';
import Input from '@/components/Input';
import { useAlert } from '@/components/AlertProvider';

const steps = [
  'Company Information',
  'Main Contact Person',
  'Billing / Accounts Details',
  'Service Requirements',
  'Payment Preferences',
  'GDPR & Consent',
] as const;

const journeyTypeOptions = ['Airport transfers', 'Business meetings', 'Events', 'Roadshows', 'VIP', 'Other'];
const invoiceFrequencyOptions = ['Per journey', 'Weekly', 'Monthly'];
const paymentMethods = ['Bank transfer', 'Online payment link', 'Card to chauffeur', 'Cash to chauffeur'];

export default function CorporateSignUpPage() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [journeyTypes, setJourneyTypes] = useState<string[]>([]);

  const handleFieldChange =
    (field: string) =>
    (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setFormData((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const toggleJourneyType = (value: string) => {
    setJourneyTypes((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
  };

  const goBack = () => setStep((prev) => Math.max(prev - 1, 1));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (step < steps.length) {
      setStep((prev) => prev + 1);
      return;
    }

    showAlert('Corporate account request submitted. The Velvet team will contact you shortly.');
    router.push('/corporate/login');
  };

  const renderCompanyInfo = () => (
    <div className="space-y-4">
      <Input id="companyName" label="Company Name" required value={formData.companyName ?? ''} onChange={handleFieldChange('companyName')} />
      <Input
        id="businessAddress"
        label="Registered Business Address"
        required
        value={formData.businessAddress ?? ''}
        onChange={handleFieldChange('businessAddress')}
      />
      <Input
        id="companyRegNumber"
        label="Company Registration Number"
        value={formData.companyRegNumber ?? ''}
        onChange={handleFieldChange('companyRegNumber')}
      />
      <Input id="vatNumber" label="VAT Number" value={formData.vatNumber ?? ''} onChange={handleFieldChange('vatNumber')} />
      <Input id="businessType" label="Type of Business / Industry" value={formData.businessType ?? ''} onChange={handleFieldChange('businessType')} />
    </div>
  );

  const renderMainContact = () => (
    <div className="space-y-4">
      <Input id="contactName" label="Full Name" required value={formData.contactName ?? ''} onChange={handleFieldChange('contactName')} />
      <Input id="contactTitle" label="Job Title / Position" required value={formData.contactTitle ?? ''} onChange={handleFieldChange('contactTitle')} />
      <Input
        id="contactEmail"
        label="Work Email Address"
        type="email"
        required
        value={formData.contactEmail ?? ''}
        onChange={handleFieldChange('contactEmail')}
      />
      <Input
        id="contactPhone"
        label="Direct Phone Number"
        type="tel"
        required
        value={formData.contactPhone ?? ''}
        onChange={handleFieldChange('contactPhone')}
      />
    </div>
  );

  const renderBilling = () => (
    <div className="space-y-4">
      <Input id="accountsName" label="Accounts Contact Name" value={formData.accountsName ?? ''} onChange={handleFieldChange('accountsName')} />
      <Input
        id="accountsEmail"
        label="Accounts Email Address"
        type="email"
        value={formData.accountsEmail ?? ''}
        onChange={handleFieldChange('accountsEmail')}
      />
      <Input
        id="accountsPhone"
        label="Accounts Phone Number"
        type="tel"
        value={formData.accountsPhone ?? ''}
        onChange={handleFieldChange('accountsPhone')}
      />
      <Input id="billingAddress" label="Billing Address (if different)" value={formData.billingAddress ?? ''} onChange={handleFieldChange('billingAddress')} />
      <div>
        <label className="block text-sm font-semibold text-gray-200 mb-2">Preferred Invoice Method</label>
        <select
          className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
          required
          value={formData.invoiceMethod ?? ''}
          onChange={handleFieldChange('invoiceMethod')}
        >
          <option value="" disabled>
            Select frequency
          </option>
          {invoiceFrequencyOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </div>
  );

  const renderServiceRequirements = () => (
    <div className="space-y-4">
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
                <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleJourneyType(option)} />
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
        value={formData.estimatedJourneys ?? ''}
        onChange={handleFieldChange('estimatedJourneys')}
      />
      <div>
        <label className="block text-sm font-semibold text-gray-200 mb-2">Preferred Vehicle Types</label>
        <select
          className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
          value={formData.vehicleTypes ?? ''}
          onChange={handleFieldChange('vehicleTypes')}
        >
          <option value="" disabled>
            Select vehicle type
          </option>
          <option value="Luxury MPV">Luxury MPV</option>
          <option value="Luxury">Luxury</option>
          <option value="Executive">Executive</option>
        </select>
      </div>
      <div>
        <label htmlFor="serviceNotes" className="block text-sm font-semibold text-gray-200 mb-2">
          Additional Notes / Special Requirements
        </label>
        <textarea
          id="serviceNotes"
          className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
          rows={3}
          value={formData.serviceNotes ?? ''}
          onChange={handleFieldChange('serviceNotes')}
        />
      </div>
    </div>
  );

  const renderPaymentPreferences = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-200 mb-2">Preferred Payment Method</label>
        <select
          className="w-full rounded-xl border border-white/15 bg-black/50 px-3 py-2 text-sm text-white"
          required
          value={formData.paymentMethod ?? ''}
          onChange={handleFieldChange('paymentMethod')}
        >
          <option value="" disabled>
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
      <Input id="invoiceEmail" label="Invoice Email Address" type="email" value={formData.invoiceEmail ?? ''} onChange={handleFieldChange('invoiceEmail')} />
    </div>
  );

  const renderGDPRConsent = () => (
    <div className="space-y-3 text-sm text-gray-200">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1"
          required
          checked={formData.tandc === 'yes'}
          onChange={(event) => setFormData((prev) => ({ ...prev, tandc: event.target.checked ? 'yes' : '' }))}
        />
        <span>
          I agree to the{' '}
          <Link href="/legal/corporate" className="text-amber-300 hover:text-amber-200 underline underline-offset-4">
            Terms &amp; Conditions
          </Link>
          .
        </span>
      </label>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1"
          required
          checked={formData.gdpr === 'yes'}
          onChange={(event) => setFormData((prev) => ({ ...prev, gdpr: event.target.checked ? 'yes' : '' }))}
        />
        <span>
          I consent to data processing under the{' '}
          <Link href="/legal/privacy-data" className="text-amber-300 hover:text-amber-200 underline underline-offset-4">
            Privacy &amp; Data Policy
          </Link>
          .
        </span>
      </label>
    </div>
  );

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return renderCompanyInfo();
      case 2:
        return renderMainContact();
      case 3:
        return renderBilling();
      case 4:
        return renderServiceRequirements();
      case 5:
        return renderPaymentPreferences();
      default:
        return renderGDPRConsent();
    }
  };

  return (
    <FormLayout title="Corporate Account Request">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-gray-400">
            Step {step} of {steps.length}: {steps[step - 1]}
          </p>
          <div className="h-2 rounded-full bg-white/10">
            <div className="h-full rounded-full bg-amber-400 transition-all duration-300" style={{ width: `${(step / steps.length) * 100}%` }} />
          </div>
        </div>

        {renderStepContent()}

        <div className="flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={goBack}
              className="px-8 py-3 text-lg font-semibold bg-amber-500 text-black rounded-md hover:bg-amber-400 transition-all duration-300 transform hover:scale-105 shadow-[0_0_15px_rgba(251,191,36,0.5)]"
            >
              Back
            </button>
          ) : (
            <div />
          )}
          <button
            type="submit"
            className="px-8 py-3 text-lg font-semibold bg-amber-500 text-black rounded-md hover:bg-amber-400 transition-all duration-300 transform hover:scale-105 shadow-[0_0_15px_rgba(251,191,36,0.5)]"
          >
            {step === steps.length ? 'Submit Corporate Account Request' : 'Continue'}
          </button>
        </div>

        {step === 1 && (
          <p className="text-center text-sm text-gray-400">
            Already approved?{' '}
            <Link href="/corporate/login" className="font-medium text-amber-400 hover:underline">
              Sign In
            </Link>
          </p>
        )}
      </form>
    </FormLayout>
  );
}
