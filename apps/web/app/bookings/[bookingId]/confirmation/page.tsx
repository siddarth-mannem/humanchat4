'use client';

/**
 * Booking Confirmation Page
 * Shows success message after booking is created
 */

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { getBookingById } from '../../../../services/bookingApi';
import { Booking } from '@/src/lib/db';

export default function BookingConfirmationPage() {
  const router = useRouter();
  const params = useParams();
  const bookingId = params?.bookingId as string;

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const data = await getBookingById(bookingId);
        setBooking(data);
      } catch (err) {
        console.error('Failed to fetch booking:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [bookingId]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center">
        <div className="text-white">Loading booking details...</div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center">
        <div className="text-white">Booking not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e27] via-[#0d1235] to-[#0a0e27] text-white">
      <Link href="/?focus=sam" className="fixed left-6 top-6 text-sm font-semibold tracking-wider text-white/70 hover:text-white transition-colors z-10">
        HUMANCHAT.COM
      </Link>
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Success Icon with Confetti */}
        <div className="relative flex justify-center mb-8">
          {/* Confetti decorations */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute -top-4 -left-8 w-3 h-3 bg-blue-400 rounded-full transform -rotate-12"></div>
            <div className="absolute -top-6 left-4 w-2 h-4 bg-orange-400 rounded-sm transform rotate-45"></div>
            <div className="absolute -top-8 left-16 w-3 h-3 bg-red-400 rounded-full"></div>
            <div className="absolute -top-4 -right-8 w-3 h-3 bg-yellow-400 rounded-full transform rotate-12"></div>
            <div className="absolute -top-6 right-4 w-2 h-4 bg-purple-400 rounded-sm transform -rotate-45"></div>
            <div className="absolute -top-8 right-16 w-3 h-3 bg-pink-400 rounded-full"></div>
            
            <div className="absolute top-4 -left-12 w-2 h-3 bg-green-400 rounded-sm transform rotate-12"></div>
            <div className="absolute top-8 left-2 w-2 h-2 bg-cyan-400 rounded-full"></div>
            <div className="absolute top-4 -right-12 w-2 h-3 bg-orange-400 rounded-sm transform -rotate-12"></div>
            <div className="absolute top-8 right-2 w-2 h-2 bg-yellow-400 rounded-full"></div>
          </div>
          
          {/* Main checkmark circle */}
          <div className="relative w-32 h-32 bg-gradient-to-br from-green-500 to-green-700 rounded-full flex items-center justify-center shadow-2xl shadow-green-500/50 animate-scale-in">
            <svg
              className="w-16 h-16 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-5xl font-bold text-center mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
          Call Scheduled!
        </h1>
        <p className="text-center text-gray-400 text-lg mb-10">
          Your meeting has been booked with
        </p>

        {/* Expert Card */}
        <div className="bg-gradient-to-br from-[#1a1f3a] to-[#141937] rounded-2xl p-8 mb-8 shadow-2xl border border-gray-800/50">
          {/* Expert Info */}
          <div className="flex items-start gap-5 mb-8 pb-6 border-b border-gray-700/50">
            {booking.expertAvatar ? (
              <img
                src={booking.expertAvatar}
                alt={booking.expertName}
                className="w-20 h-20 rounded-full object-cover ring-4 ring-blue-500/30"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold ring-4 ring-blue-500/30">
                {booking.expertName?.charAt(0)}
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white mb-1">
                {booking.expertName}
              </h2>
              {booking.expertHeadline && (
                <p className="text-gray-400 text-base">{booking.expertHeadline}</p>
              )}
            </div>
          </div>

          {/* Date & Time Details */}
          <div className="space-y-5">
            {/* Date */}
            <div className="flex items-center gap-4 bg-[#0f1329] rounded-xl p-4">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <span className="text-white text-lg font-medium">
                {formatDate(booking.startTime)}
              </span>
            </div>

            {/* Time */}
            <div className="flex items-center gap-4 bg-[#0f1329] rounded-xl p-4">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <span className="text-white text-lg font-medium">
                {formatTime(booking.startTime)} – {formatTime(booking.endTime)}{' '}
                <span className="text-gray-400">({booking.durationMinutes} min)</span>
              </span>
            </div>

            {/* Calendar Badge */}
            {booking.calendarEventId && (
              <div className="flex items-center gap-3 justify-center pt-2">
                <div className="flex items-center gap-2 bg-blue-500/10 text-blue-400 px-4 py-2 rounded-lg border border-blue-500/20">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
                  </svg>
                  <span className="text-sm font-medium">Google Calendar</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => router.push('/bookings')}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-lg py-5 rounded-xl shadow-lg shadow-blue-500/30 transition-all duration-200 hover:shadow-blue-500/50 hover:scale-[1.02] active:scale-[0.98]"
        >
          View My Bookings
        </button>

        {/* Footer Note */}
        <div className="mt-10 text-center">
          <div className="inline-flex items-center gap-2 bg-[#1a1f3a] px-6 py-3 rounded-full border border-gray-700/50">
            <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"/>
            </svg>
            <p className="text-sm text-gray-400">
              You'll receive reminders before your call
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes scale-in {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-scale-in {
          animation: scale-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
