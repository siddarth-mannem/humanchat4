'use client';

import ChatExperience from './ChatExperience';
import HeroExperience from './HeroExperience';
import { useAuthIdentity } from '../hooks/useAuthIdentity';
import { useBreakpoint } from '../hooks/useBreakpoint';

const HomePageExperience = () => {
  const { identity, loading } = useAuthIdentity();
  const { isMobile } = useBreakpoint();
  const showOverlay = !loading && !identity;

  return (
    <div className="relative min-h-screen bg-midnight text-white">
      {(!showOverlay || !isMobile) && <ChatExperience />}
      {showOverlay && (
        <>
          <div className="fixed inset-0 z-[60] bg-[#030519] backdrop-blur-sm" />
          <div className="fixed inset-0 z-[70] flex flex-col sm:justify-center overflow-y-auto p-4 sm:p-8">
            <div className="w-full max-w-4xl mx-auto my-4 sm:my-0 rounded-[48px] border border-white/10 bg-[#050718]/95 backdrop-blur-xl overflow-hidden">
              <HeroExperience />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default HomePageExperience;
