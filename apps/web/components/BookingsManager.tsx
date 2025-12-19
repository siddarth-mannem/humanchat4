'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { cancelBooking, getExpertBookings, getUserBookings } from '../services/bookingApi';
import type { Booking } from '../../../src/lib/db';

export type BookingTab = 'upcoming' | 'past' | 'canceled';

interface BookingsManagerProps {
  embedded?: boolean;
}

const panelBackground = 'bg-[#1a1f3a] border border-white/10';
const panelBackgroundEmbedded = 'bg-black/20 border border-white/10';

export function BookingsManager({ embedded = false }: BookingsManagerProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<BookingTab>('upcoming');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ upcoming: 0, past: 0, canceled: 0 });

  useEffect(() => {
    void fetchBookings(activeTab);
    void fetchCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchBookings = async (tab: BookingTab) => {
    setLoading(true);
    try {
      const [clientBookings, expertBookings] = await Promise.all([
        getUserBookings(tab),
        getExpertBookings(tab)
      ]);
      // Deduplicate bookings by bookingId before merging
      const bookingMap = new Map<string, Booking>();
      [...clientBookings, ...expertBookings].forEach(booking => {
        bookingMap.set(booking.bookingId, booking);
      });
      const allBookings = Array.from(bookingMap.values()).sort((a, b) => b.startTime - a.startTime);
      setBookings(allBookings);
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCounts = async () => {
    try {
      const [upcomingClient, pastClient, canceledClient, upcomingExpert, pastExpert, canceledExpert] = await Promise.all([
        getUserBookings('upcoming'),
        getUserBookings('past'),
        getUserBookings('canceled'),
        getExpertBookings('upcoming'),
        getExpertBookings('past'),
        getExpertBookings('canceled')
      ]);
      setCounts({
        upcoming: upcomingClient.length + upcomingExpert.length,
        past: pastClient.length + pastExpert.length,
        canceled: canceledClient.length + canceledExpert.length
      });
    } catch (err) {
      console.error('Failed to fetch counts:', err);
    }
  };

  const handleCancel = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    try {
      await cancelBooking(bookingId);
      void fetchBookings(activeTab);
      void fetchCounts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to cancel booking.');
    }
  };

  const formatDate = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });

  const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-emerald-500/10 text-emerald-200 border-emerald-400/70';
      case 'completed':
        return 'bg-blue-500/10 text-blue-200 border-blue-400/70';
      case 'cancelled_by_user':
      case 'cancelled_by_expert':
        return 'bg-rose-500/10 text-rose-200 border-rose-400/70';
      case 'in_progress':
        return 'bg-indigo-500/10 text-indigo-200 border-indigo-400/70';
      default:
        return 'bg-white/5 text-white/70 border-white/20';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'Scheduled';
      case 'in_progress':
        return 'In Progress';
      case 'completed':
        return 'Finished';
      case 'cancelled_by_user':
        return 'Cancelled';
      case 'cancelled_by_expert':
        return 'Cancelled by Expert';
      case 'no_show':
        return 'No Show';
      default:
        return status;
    }
  };

  const canJoinCall = (booking: Booking) => {
    const now = Date.now();
    const startTime = booking.startTime;
    const fifteenMinutesBefore = startTime - 15 * 60 * 1000;
    return booking.status === 'scheduled' && now >= fifteenMinutesBefore && now <= booking.endTime;
  };

  const containerClass = embedded ? 'space-y-6 text-white' : 'min-h-screen bg-[#0a0e27] text-white p-6';
  const innerClass = embedded ? 'space-y-4' : 'max-w-5xl mx-auto';
  const cardClass = embedded ? panelBackgroundEmbedded : panelBackground;

  const tabTextClass = (tab: BookingTab) =>
    `pb-3 px-1 transition-colors relative ${
      activeTab === tab ? 'text-white' : 'text-white/50 hover:text-white'
    }`;

  return (
    <div className={containerClass}>
      {!embedded && (
        <Link href="/?focus=sam" className="fixed left-6 top-6 text-sm font-semibold tracking-wider text-white/70 hover:text-white transition-colors z-50">
          HUMANCHAT.COM
        </Link>
      )}
      <div className={innerClass}>
        <div className={embedded ? 'flex items-center justify-between' : 'mb-8'}>
          <div>
            <h2 className={embedded ? 'text-xl font-semibold' : 'text-3xl font-bold mb-2'}>
              {embedded ? 'Full calendar' : 'My Bookings'}
            </h2>
            <p className="text-white/60">{embedded ? 'Manage every session without leaving the hub.' : 'Manage your scheduled calls.'}</p>
          </div>
        </div>

        <div className={`flex gap-6 border-b border-white/15 ${embedded ? 'text-sm' : 'mb-6'}`}>
          {(['upcoming', 'past', 'canceled'] as BookingTab[]).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={tabTextClass(tab)}>
              {tab === 'upcoming' && 'Upcoming'}
              {tab === 'past' && 'Past'}
              {tab === 'canceled' && 'Canceled'}
              {counts[tab] > 0 && (
                <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/80">{counts[tab]}</span>
              )}
              {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-12 text-center text-white/60">Loading bookings…</div>
        ) : bookings.length === 0 ? (
          <div className={`${cardClass} rounded-2xl p-6 text-center text-white/70`}>
            <p>No {activeTab} bookings yet.</p>
            <button onClick={() => router.push('/account')} className="mt-3 text-white underline-offset-4 hover:underline">
              Browse experts
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => {
              console.log('Booking avatar data:', {
                bookingId: booking.bookingId,
                expertName: booking.expertName,
                expertAvatar: booking.expertAvatar,
                hasAvatar: !!booking.expertAvatar
              });
              return (
              <div key={booking.bookingId} className={`${cardClass} rounded-3xl p-6 transition hover:border-white/30`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex flex-1 items-start gap-4">
                    <img 
                      src={booking.expertAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(booking.expertName ?? 'Expert')}&background=4f46e5&color=fff&size=128`}
                      alt={booking.expertName ?? 'Expert'} 
                      className="h-12 w-12 rounded-full object-cover ring-1 ring-white/10" 
                    />
                    <div>
                      <p className="text-lg font-semibold">{booking.expertName ?? 'Pending match'}</p>
                      {booking.expertHeadline && <p className="text-sm text-white/60">{booking.expertHeadline}</p>}
                      <div className="mt-3 flex flex-wrap gap-4 text-xs uppercase tracking-[0.2em] text-white/50">
                        <span>{formatDate(booking.startTime)}</span>
                        <span>
                          {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
                        </span>
                        <span>{booking.durationMinutes} min</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${getStatusColor(booking.status)}`}>
                      {getStatusLabel(booking.status)}
                    </span>
                    <div className="flex flex-wrap justify-end gap-2">
                      {activeTab === 'upcoming' && canJoinCall(booking) && (
                        <button
                          onClick={() => router.push(`/call/${booking.bookingId}`)}
                          className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-400"
                        >
                          Join call
                        </button>
                      )}
                      {activeTab === 'upcoming' && booking.status === 'scheduled' && (
                        <>
                          <button
                            onClick={() => router.push(`/bookings/${booking.bookingId}/reschedule`)}
                            className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white/70 transition hover:border-white/50"
                          >
                            Reschedule
                          </button>
                          <button
                            onClick={() => handleCancel(booking.bookingId)}
                            className="rounded-full border border-rose-400/50 px-4 py-2 text-xs font-semibold text-rose-200 transition hover:border-rose-300"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {activeTab === 'canceled' && (
                        <button
                          onClick={() => router.push(`/experts/${booking.expertId}/schedule`)}
                          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white/80 transition hover:border-white/50"
                        >
                          Rebook
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default BookingsManager;
