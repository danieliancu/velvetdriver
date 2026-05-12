'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { PaymentElement, PaymentRequestButtonElement, useElements, useStripe } from '@stripe/react-stripe-js';

type Props = {
  amount: number;
  clientSecret: string;
  disabled: boolean;
  onSuccess: (intent: { id: string; status: string }) => void;
  onError: (message: string) => void;
  buttonLabel?: string;
  mode?: 'payment' | 'authorization' | 'setup';
};

const StripePaymentForm = ({
  amount,
  clientSecret,
  disabled,
  onSuccess,
  onError,
  buttonLabel = 'Pay now',
  mode = 'payment',
}: Props) => {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState<any>(null);
  const successfulStatus = mode === 'authorization' ? 'requires_capture' : 'succeeded';
  const isSetupMode = mode === 'setup';

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    onError('');
    try {
      if (isSetupMode) {
        const { error, setupIntent } = await stripe.confirmSetup({
          elements,
          redirect: 'if_required',
          confirmParams: {
            return_url: window.location.href,
          },
        });

        if (error) {
          onError(error.message || 'Card setup failed.');
          return;
        }

        if (!setupIntent || setupIntent.status !== 'succeeded') {
          onError('Card was not saved. Please try again.');
          return;
        }

        onSuccess({ id: setupIntent.id, status: setupIntent.status });
        return;
      }

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: window.location.href,
        },
      });

      if (error) {
        onError(error.message || 'Payment failed.');
        return;
      }

      if (!paymentIntent || paymentIntent.status !== successfulStatus) {
        onError(mode === 'authorization' ? 'Card hold was not authorized. Please try again.' : 'Payment not completed. Please try again.');
        return;
      }

      onSuccess({ id: paymentIntent.id, status: paymentIntent.status });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (isSetupMode) {
      setPaymentRequest(null);
      return;
    }
    if (!stripe || !clientSecret) return;
    const pr = stripe.paymentRequest({
      country: 'GB',
      currency: 'gbp',
      total: {
        label: 'Velvet Drivers',
        amount: Math.round(amount * 100),
      },
      requestPayerName: true,
      requestPayerEmail: true,
    });
    pr.canMakePayment().then((result) => {
      if (result) setPaymentRequest(pr);
    });
    pr.on('paymentmethod', async (event: any) => {
      try {
        const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
          clientSecret,
          { payment_method: event.paymentMethod.id },
          { handleActions: false }
        );
        if (confirmError || !paymentIntent) {
          event.complete('fail');
          onError(confirmError?.message || 'Payment failed.');
          return;
        }
        event.complete('success');
        if (paymentIntent.status === 'requires_action') {
          const { error: actionError, paymentIntent: finalIntent } = await stripe.confirmCardPayment(clientSecret);
          if (actionError || !finalIntent) {
            onError(actionError?.message || 'Payment failed.');
            return;
          }
          if (finalIntent.status === successfulStatus) {
            onSuccess({ id: finalIntent.id, status: finalIntent.status });
            return;
          }
        }
        if (paymentIntent.status === successfulStatus) {
          onSuccess({ id: paymentIntent.id, status: paymentIntent.status });
          return;
        }
        onError(mode === 'authorization' ? 'Card hold was not authorized. Please try again.' : 'Payment not completed. Please try again.');
      } catch (err: any) {
        onError(err?.message || 'Payment failed.');
      }
    });
    return () => {
      pr.off('paymentmethod');
    };
  }, [stripe, clientSecret, amount, onError, onSuccess, successfulStatus, mode, isSetupMode]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-white/10 bg-black/30 p-4">
        <p className="text-sm text-gray-300">{isSetupMode ? 'Card setup' : 'Amount due'}</p>
        <p className="text-2xl font-semibold text-amber-200">
          {isSetupMode ? 'No charge now' : `GBP${amount.toFixed(2)}`}
        </p>
      </div>
      {paymentRequest ? (
        <div className="rounded-lg border border-white/10 bg-black/30 p-4 space-y-2">
          <p className="text-xs uppercase tracking-wider text-amber-300/80">Express checkout</p>
          <PaymentRequestButtonElement options={{ paymentRequest }} />
        </div>
      ) : null}
      <div className="rounded-lg border border-white/10 bg-black/30 p-4">
        <PaymentElement />
      </div>
      <button
        type="submit"
        disabled={!stripe || !elements || submitting || disabled}
        className="w-full px-6 py-3 font-semibold bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-all duration-300 disabled:opacity-60"
      >
        {submitting ? 'Processing payment...' : buttonLabel}
      </button>
    </form>
  );
};

export default StripePaymentForm;
