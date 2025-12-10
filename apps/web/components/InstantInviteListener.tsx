'use client';

import { useEffect } from 'react';
import { disposeInstantInviteChannel, initInstantInviteChannel } from '../services/instantInviteChannel';

export default function InstantInviteListener() {
  useEffect(() => {
    initInstantInviteChannel();
    return () => {
      disposeInstantInviteChannel();
    };
  }, []);

  return null;
}
