'use client';

import React, { useState } from 'react';
import DashboardInput from '@/components/DashboardInput';
import DashboardSelect from '@/components/DashboardSelect';
import { Star } from 'lucide-react';
import type { Journey } from '@/types';
import { useAlert } from '@/components/AlertProvider';

interface ClientReviewProps {
  email?: string;
  journeys?: Journey[];
  isGuest?: boolean;
}

const ClientReview: React.FC<ClientReviewProps> = ({ email, journeys = [], isGuest = false }) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [journeyId, setJourneyId] = useState('');
  const [review, setReview] = useState('');
  const [loading, setLoading] = useState(false);
  const { showAlert } = useAlert();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGuest || !email) {
      showAlert(`Thank you for your ${rating}-star review!`);
      return;
    }
    if (!journeyId || rating <= 0) {
      showAlert('Select a journey and rating to continue.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/client/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, journeyId, rating, review }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to submit review');
      }
      showAlert(`Thank you for your ${rating}-star review!`);
      setJourneyId('');
      setRating(0);
      setReview('');
    } catch (err: any) {
      showAlert(err?.message || 'Failed to submit review');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {isGuest || !email ? (
        <DashboardInput id="booking-ref-review" label="Booking Reference or Date of Journey" type="text" required />
      ) : (
        <>
          <DashboardSelect
            id="booking-ref-review"
            label="Your Bookings"
            required
            value={journeyId}
            onChange={(e) => setJourneyId(e.target.value)}
            disabled={!journeys.length}
          >
            <option value="" disabled className="bg-gray-900 text-white">
              {journeys.length ? 'Select a journey to review' : 'No journeys available yet'}
            </option>
            {journeys.map(journey => (
              <option key={journey.id} value={journey.id} className="bg-gray-900 text-white">
                {journey.date} - {journey.pickup} to {journey.destination.split(',')[0]} ({journey.status})
              </option>
            ))}
          </DashboardSelect>
          {!journeys.length && (
            <p className="text-xs text-gray-400">
              Book a journey while signed in and it will appear here for follow-up reviews.
            </p>
          )}
        </>
      )}
      
      <div>
        <label className="block text-xs font-semibold text-amber-200/70 uppercase tracking-wider mb-2">
          Your Rating
        </label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              size={32}
              className={`cursor-pointer transition-colors ${
                (hoverRating || rating) >= star ? 'text-amber-400' : 'text-gray-600'
              }`}
              fill={(hoverRating || rating) >= star ? 'currentColor' : 'none'}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
            />
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="review-details" className="block text-xs font-semibold text-amber-200/70 uppercase tracking-wider mb-2">
          Review
        </label>
        <textarea
          id="review-details"
          rows={5}
          value={review}
          onChange={(e) => setReview(e.target.value)}
          className="w-full bg-gray-900 border border-amber-900/60 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
          placeholder="Share your experience..."
        />
      </div>
      <div className="pt-2 flex justify-start">
        <button type="submit" className="px-10 py-2.5 font-semibold bg-amber-500 text-black rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-60" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit Review'}
        </button>
      </div>
    </form>
  );
};

export default ClientReview;
