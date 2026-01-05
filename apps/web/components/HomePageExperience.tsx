'use client';

import ChatExperience from './ChatExperience';
import HeroExperience from './HeroExperience';
import { useAuthIdentity } from '../hooks/useAuthIdentity';

const HomePageExperience = () => {
  const { identity, loading } = useAuthIdentity();
  const showOverlay = !loading && !identity;

  return (
    <div className="relative min-h-screen bg-midnight text-white">
      <ChatExperience />
      {showOverlay && (
        <>
          <div className="fixed inset-0 z-30 bg-[#030519]/80 backdrop-blur-sm" />
          <div className="fixed inset-0 z-40 flex justify-center overflow-y-auto p-4 sm:items-center sm:p-8">
            <div
              className="w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-[#050718]/95 shadow-2xl backdrop-blur-xl"
              style={{ maxHeight: 'calc(100vh - 2rem)' }}
            >
              <HeroExperience />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HomePageExperience;
