'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import FormLayout from '@/components/FormLayout';
import Input from '@/components/Input';
import { useAlert } from '@/components/AlertProvider';

const steps = ['Personal details', 'Licence documents', 'Your car', 'Create password'];

const fileFields = Object.freeze({
  yourDetails: [
    { id: 'pcoLicenseDoc', label: 'PCO Licence' },
    { id: 'drivingLicenseFront', label: 'Driver Licence Front' },
    { id: 'drivingLicenseBack', label: 'Driver Licence Back' },
    { id: 'profilePhoto', label: 'Your photo' },
  ],
  carDetails: [
    { id: 'motDoc', label: 'MOT' },
    { id: 'insuranceDoc', label: 'Insurance' },
    { id: 'phvDoc', label: 'PHV Car licence' },
    { id: 'logbookDoc', label: 'Log book V5' },
  ],
} as const);

export default function DriverSignUpPage() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isFindingVehicle, setIsFindingVehicle] = useState(false);

  const handleFieldChange =
    (field: string) => (event: ChangeEvent<HTMLInputElement>) => {
      const value = event.target.type === 'file' ? event.target.files?.[0]?.name ?? '' : event.target.value;
      setFormData((prev) => ({ ...prev, [field]: value }));
    };

  const goBack = () => setStep((prev) => Math.max(prev - 1, 1));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (step < steps.length) {
      setStep((prev) => prev + 1);
      return;
    }

    showAlert('Application submitted for review. You will be notified via email.');
    router.push('/driver/login');
  };

  const renderYourDetails = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white">Licence details</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            id="pcoLicenseNumber"
            label="PCO Licence No:"
            type="text"
            value={formData.pcoLicenseNumber ?? ''}
            onChange={handleFieldChange('pcoLicenseNumber')}
          />
          <Input
            id="pcoExpiry"
            label="PCO Expiry Date:"
            type="date"
            value={formData.pcoExpiry ?? ''}
            onChange={handleFieldChange('pcoExpiry')}
          />
          <Input
            id="drivingLicenseNumber"
            label="Driving Licence No:"
            type="text"
            value={formData.drivingLicenseNumber ?? ''}
            onChange={handleFieldChange('drivingLicenseNumber')}
          />
          <Input
            id="dvlaCode"
            label="DVLA Check code:"
            type="text"
            value={formData.dvlaCode ?? ''}
            onChange={handleFieldChange('dvlaCode')}
          />
        </div>
        <p className="text-xs text-gray-400">
          Generate a code from the official DVLA website to share your driving licence information.
        </p>
      </div>
      <div>
        <p className="text-sm font-semibold text-amber-400">Upload documents</p>
        <div className="space-y-4">
          {fileFields.yourDetails.map((field) => (
            <div key={field.id} className="space-y-1">
              <p className="text-sm text-gray-300">
                {field.label}
                {field.id === 'profilePhoto' && (
                  <span className="block text-xs text-gray-400 italic">
                    * Passport type photo to be used on your profile*
                  </span>
                )}
              </p>
              <div className="flex flex-col gap-2">
                <label
                  htmlFor={field.id}
                  className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-amber-400 cursor-pointer"
                >
                  <span>Choose file</span>
                  <span className="text-xs text-gray-200">{formData[field.id] ? 'Ready' : 'Tap to upload'}</span>
                </label>
                <input id={field.id} type="file" className="sr-only" onChange={handleFieldChange(field.id)} />
                {formData[field.id] && <span className="text-xs text-gray-400 truncate">{formData[field.id]}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderCarDetails = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-white">Your car details:</h3>
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
            <Input
              id="vehicleReg"
              label="Vehicle Registration"
              type="text"
              value={formData.vehicleReg ?? ''}
              onChange={handleFieldChange('vehicleReg')}
            />
            <button
              type="button"
              onClick={async () => {
                const registrationNumber = (formData.vehicleReg ?? '').trim().toUpperCase();
                if (!registrationNumber) {
                  showAlert('Please enter a VRM before searching.');
                  return;
                }
                setIsFindingVehicle(true);
                try {
                  const apiKey = process.env.NEXT_PUBLIC_DVLA_API_KEY;
                  const proxy = process.env.NEXT_PUBLIC_DVLA_PROXY_URL;
                  if (!apiKey || !proxy) {
                    showAlert('DVLA lookup unavailable. Configure NEXT_PUBLIC_DVLA_API_KEY and NEXT_PUBLIC_DVLA_PROXY_URL.');
                    return;
                  }
                  const dvlaBaseUrl = proxy.replace(/\/$/, '');
                  const response = await fetch(`${dvlaBaseUrl}/vehicle-enquiry/v1/vehicles`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'x-api-key': apiKey,
                    },
                    body: JSON.stringify({ registrationNumber }),
                  });
                  if (!response.ok) {
                    if (response.status === 404) {
                      showAlert('DVLA: vehicle not found for that VRM.');
                      setFormData((prev) => ({ ...prev, make: '', model: '' }));
                      return;
                    }
                    showAlert(`DVLA lookup failed (${response.status}).`);
                    return;
                  }
                  const data = await response.json();
                  setFormData((prev) => ({
                    ...prev,
                    make: data.make || prev.make || '',
                    model: data.model || prev.model || '',
                  }));
                  showAlert('Vehicle found via DVLA. Fields updated.');
                } catch (err) {
                  console.error('DVLA lookup error', err);
                  showAlert('Could not reach DVLA. Please try again.');
                } finally {
                  setIsFindingVehicle(false);
                }
              }}
              disabled={isFindingVehicle}
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-black bg-amber-400 rounded-md shadow-md shadow-amber-400/40 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isFindingVehicle ? 'Finding...' : 'Find'}
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input id="make" label="Make" type="text" value={formData.make ?? ''} onChange={handleFieldChange('make')} />
            <Input id="model" label="Model" type="text" value={formData.model ?? ''} onChange={handleFieldChange('model')} />
            <Input id="colour" label="Colour" type="text" value={formData.colour ?? ''} onChange={handleFieldChange('colour')} />
          </div>
          <Input
            id="keeperInfo"
            label="Name and address of Keeper (the name on V5)"
            type="text"
            value={formData.keeperInfo ?? ''}
            onChange={handleFieldChange('keeperInfo')}
          />
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-amber-400">Upload documents</p>
        <div className="space-y-4">
          {fileFields.carDetails.map((field) => (
            <div key={field.id} className="space-y-1">
              <p className="text-sm text-gray-300">{field.label}</p>
              <div className="flex flex-col gap-2">
                <label
                  htmlFor={field.id}
                  className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-amber-400 cursor-pointer"
                >
                  <span>Choose file</span>
                  <span className="text-xs text-gray-200">{formData[field.id] ? 'Ready' : 'Tap to upload'}</span>
                </label>
                <input id={field.id} type="file" className="sr-only" onChange={handleFieldChange(field.id)} />
                {formData[field.id] && <span className="text-xs text-gray-400 truncate">{formData[field.id]}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStepContent = () => {
    if (step === 1) {
      return (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="surname"
              label="Surname"
              type="text"
              required
              value={formData.surname ?? ''}
              onChange={handleFieldChange('surname')}
            />
            <Input
              id="firstMiddleNames"
              label="First & Middle Names"
              type="text"
              required
              value={formData.firstMiddleNames ?? ''}
              onChange={handleFieldChange('firstMiddleNames')}
            />
          </div>
          <Input
            id="address"
            label="Address:"
            type="text"
            required
            value={formData.address ?? ''}
            onChange={handleFieldChange('address')}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              id="postcode"
              label="Postcode:"
              type="text"
              required
              value={formData.postcode ?? ''}
              onChange={handleFieldChange('postcode')}
            />
            <Input
              id="dob"
              label="Date of Birth:"
              type="date"
              required
              value={formData.dob ?? ''}
              onChange={handleFieldChange('dob')}
            />
          </div>
          <Input
            id="nationalInsurance"
            label="National insurance No:"
            type="text"
            required
            value={formData.nationalInsurance ?? ''}
            onChange={handleFieldChange('nationalInsurance')}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input id="email" label="Email Address" type="email" required value={formData.email ?? ''} onChange={handleFieldChange('email')} />
            <Input id="phone" label="Phone Number" type="tel" required value={formData.phone ?? ''} onChange={handleFieldChange('phone')} />
          </div>
        </>
      );
    }

    if (step === 2) {
      return renderYourDetails();
    }

    if (step === 3) {
      return renderCarDetails();
    }

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Create password</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            id="password"
            label="Create password"
            type="password"
            required
            value={formData.password ?? ''}
            onChange={handleFieldChange('password')}
          />
          <Input
            id="confirmPassword"
            label="Confirm password"
            type="password"
            required
            value={formData.confirmPassword ?? ''}
            onChange={handleFieldChange('confirmPassword')}
          />
        </div>
        <div className="space-y-2 pt-2">
          <label className="flex items-start gap-3 text-sm text-gray-200">
            <input type="checkbox" required className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500" />
            <span>I agree to the Terms &amp; Conditions.</span>
          </label>
          <label className="flex items-start gap-3 text-sm text-gray-200">
            <input type="checkbox" required className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500" />
            <span>I consent to data processing under the Privacy Policy.</span>
          </label>
        </div>
      </div>
    );
  };

  return (
    <FormLayout title="Driver Application">
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
            {step === steps.length ? 'Submit' : 'Continue'}
          </button>
        </div>
        {step === 1 && (
          <p className="text-center text-sm text-gray-400">
            Already have an account?{' '}
            <Link href="/driver/login" className="font-medium text-amber-400 hover:underline">
              Sign In
            </Link>
          </p>
        )}
      </form>
    </FormLayout>
  );
}
