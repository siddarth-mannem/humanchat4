'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { INSTANT_INVITE_TARGETED_EVENT, type InstantInviteTargetedDetail } from '../constants/events';
import { PENDING_INVITE_CONVERSATION_KEY } from '../constants/storageKeys';

export default function InstantInviteNavigator() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleInvite = (event: Event) => {
      const detail = (event as CustomEvent<InstantInviteTargetedDetail>).detail;
      if (!detail?.conversationId) {
        return;
      }

      try {
        window.sessionStorage?.setItem(PENDING_INVITE_CONVERSATION_KEY, detail.conversationId);
      } catch {
        /* ignore session storage failures */
      }

      if (pathname !== '/chat') {
        router.push(`/chat?conversationId=${detail.conversationId}`);
      }
    };

    window.addEventListener(INSTANT_INVITE_TARGETED_EVENT, handleInvite as EventListener);
    return () => {
      window.removeEventListener(INSTANT_INVITE_TARGETED_EVENT, handleInvite as EventListener);
    };
  }, [pathname, router]);

  return null;
}
