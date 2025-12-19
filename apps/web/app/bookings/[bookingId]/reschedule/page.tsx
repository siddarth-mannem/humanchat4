'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getBookingById, getExpertAvailability, rescheduleBooking, type TimeSlot } from '../../../../services/bookingApi';
import { Booking } from '@/src/lib/db';

export default function RescheduleBookingPage() {
  const router = useRouter();
  const params = useParams();
  const bookingId = params?.bookingId as string;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [timezone, setTimezone] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setTimezone(userTimezone);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedDate(tomorrow.toISOString().split('T')[0]);

    fetchBooking();
  }, [bookingId]);

  useEffect(() => {
    if (selectedDate && timezone && booking) {
      fetchAvailability();
    }
  }, [selectedDate, timezone, booking]);

  const fetchBooking = async () => {
    try {
      const data = await getBookingById(bookingId);
      setBooking(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load booking');
    }
  };

  const fetchAvailability = async () => {
    if (!booking) return;
    
    setLoading(true);
    setError('');
    try {
      const slots = await getExpertAvailability(booking.expertId, selectedDate, timezone);
      setAvailableSlots(slots);
    } catch (err: any) {
      setError(err.message || 'Failed to load availability');
    } finally {
      setLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!selectedSlot || !booking) return;

    setSubmitting(true);
    setError('');

    try {
      const startTime = new Date(selectedSlot.start);
      const endTime = new Date(selectedSlot.end);

      const rescheduledBooking = await rescheduleBooking(bookingId, startTime.toISOString(), endTime.toISOString());
      
      // Redirect to confirmation page with the new booking ID
      router.push(`/bookings/${rescheduledBooking.bookingId}/confirmation`);
    } catch (err: any) {
      setError(err.message || 'Failed to reschedule booking');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (!booking) {
    return (
      <div className="min-h-screen bg-[#0a0e27] text-white flex items-center justify-center">
        <div className="text-gray-400">Loading booking...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e27] text-white p-6">
      <Link href="/" className="fixed left-6 top-6 text-sm font-semibold tracking-wider text-white/70 hover:text-white transition-colors z-50">
        HUMANCHAT.COM
      </Link>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-blue-400 hover:text-blue-300 mb-4"
          >
            ← Back to bookings
          </button>
          <h1 className="text-3xl font-bold mb-2">Reschedule Booking</h1>
          <p className="text-gray-400">Select a new time for your call with {booking.expertName}</p>
        </div>

        {/* Current Booking Info */}
        <div className="bg-[#1a1f3a] rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Current Booking</h2>
          <div className="space-y-2 text-gray-300">
            <p>📅 {new Date(booking.startTime).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
            <p>🕐 {new Date(booking.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</p>
            <p>⏱️ {booking.durationMinutes} minutes</p>
          </div>
        </div>

        {/* Date Selector */}
        <div className="bg-[#1a1f3a] rounded-lg p-6 mb-6">
          <label className="block text-sm font-medium mb-2">Select New Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full bg-[#0a0e27] border border-gray-700 rounded-lg px-4 py-2 text-white"
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/20 border border-red-500 text-red-400 rounded-lg p-4 mb-6">
            {error}
          </div>
        )}

        {/* Available Slots */}
        {loading ? (
          <div className="text-center text-gray-400 py-12">Loading available times...</div>
        ) : availableSlots.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            No available slots for this date. Try another day.
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            <h2 className="text-xl font-semibold mb-4">Available Time Slots</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {availableSlots.map((slot, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedSlot(slot)}
                  className={`p-4 rounded-lg border transition-colors ${
                    selectedSlot === slot
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-[#1a1f3a] border-gray-700 text-gray-300 hover:border-blue-500'
                  }`}
                >
                  {formatTime(slot.start)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Reschedule Button */}
        {selectedSlot && (
          <button
            onClick={handleReschedule}
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {submitting ? 'Rescheduling...' : 'Confirm Reschedule'}
          </button>
        )}
      </div>
    </div>
  );
}
