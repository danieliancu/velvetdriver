import Stripe from 'stripe';

const stripeSecret = process.env.STRIPE_SECRET_KEY;
export const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY || '';

export const stripe = stripeSecret
  ? new Stripe(stripeSecret, { apiVersion: '2023-10-16' })
  : null;

export function requireStripe() {
  if (!stripe || !stripePublishableKey) {
    throw new Error('Stripe is not configured');
  }
  return stripe;
}

export const toStripeAmount = (amount: number) => Math.max(0, Math.round(Number(amount || 0) * 100));
export const fromStripeAmount = (amount: number | null | undefined) =>
  Math.round(Number(amount || 0)) / 100;
