'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error('Schedule page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0a0e27] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#1a1f3a] rounded-lg p-8 text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Something went wrong</h2>
        <p className="text-gray-400 mb-6">
          We encountered an error loading the schedule page.
        </p>
        <div className="space-y-3">
          <button
            onClick={reset}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => router.push('/?focus=sam')}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
}
