'use client';

import { useEffect } from 'react';
import ChatExperience from './ChatExperience';
import HeroExperience from './HeroExperience';
import { useAuthIdentity } from '../hooks/useAuthIdentity';
import { useBreakpoint } from '../hooks/useBreakpoint';

const HomePageExperience = () => {
  const { identity, loading } = useAuthIdentity();
  const { isMobile } = useBreakpoint();
  const showOverlay = !loading && !identity;

  // Prevent body scrolling when overlay is shown on mobile
  useEffect(() => {
    if (showOverlay && isMobile) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    };
  }, [showOverlay, isMobile]);

  return (
    <div className="relative min-h-screen bg-midnight text-white">
      {(!showOverlay || !isMobile) && <ChatExperience />}
      {showOverlay && (
        <>
          <div className="fixed inset-0 z-[60] bg-[#030519] backdrop-blur-sm" />
          <div className="fixed inset-0 z-[70] flex flex-col justify-center sm:justify-center p-4 sm:p-8 overflow-hidden touch-none">
            <div 
              className="w-full max-w-4xl mx-auto rounded-[48px] border border-white/10 bg-[#050718]/95 backdrop-blur-xl overflow-y-auto flex flex-col touch-auto"
              style={{ maxHeight: 'calc(100dvh - 2rem)' }}
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
