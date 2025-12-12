'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { InstantInvite } from '../../../src/lib/db';
import { acceptInstantInvite, cancelInstantInvite, declineInstantInvite } from '../services/instantInviteApi';
import { useAuthIdentity } from '../hooks/useAuthIdentity';
import styles from './ConversationView.module.css';

interface InstantInvitePanelProps {
  invite: InstantInvite;
  currentUserId: string | null;
}

type PendingAction = 'accept' | 'decline' | 'cancel' | null;

const getInviteMessage = (invite: InstantInvite, currentUserId: string | null): string => {
  const isRequester = invite.requesterUserId === currentUserId;
  const isTarget = invite.targetUserId === currentUserId;

  switch (invite.status) {
    case 'pending':
      if (isRequester) {
        return 'Waiting for your host to accept. We will notify you as soon as they hop in.';
      }
      if (isTarget) {
        return 'A member is ready to connect instantly. Accept when you are ready to join the room.';
      }
      return 'Invite pending response.';
    case 'accepted':
      return 'Invite accepted. Setting up the live room now…';
    case 'declined':
      return isRequester ? 'Your host declined this request.' : 'You declined this request.';
    case 'cancelled':
      return isTarget ? 'The member cancelled their request.' : 'You cancelled this request.';
    case 'expired':
      return 'This invite expired. Start a new one anytime.';
    default:
      return 'Invite status updated.';
  }
};

export default function InstantInvitePanel({ invite, currentUserId }: InstantInvitePanelProps) {
  const [action, setAction] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const { identity } = useAuthIdentity();
  const resolvedUserId = currentUserId ?? identity?.id ?? null;
  const isRequester = invite.requesterUserId === resolvedUserId;
  const isTarget = invite.targetUserId === resolvedUserId;
  const isPending = invite.status === 'pending';
  const primaryButtonRef = useRef<HTMLButtonElement>(null);

  const handleAction = async (nextAction: PendingAction, handler: () => Promise<unknown>) => {
    setAction(nextAction);
    setError(null);
    try {
      await handler();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to update that invite yet. Please retry.';
      setError(message);
    } finally {
      setAction(null);
    }
  };

  const { primaryCta, secondaryCta } = useMemo(() => {
    if (!isPending) {
      return { primaryCta: null, secondaryCta: null };
    }

    if (isTarget) {
      return {
        primaryCta: {
          label: action === 'accept' ? 'Connecting…' : 'Accept & Join',
          onClick: () => handleAction('accept', () => acceptInstantInvite(invite.inviteId))
        },
        secondaryCta: {
          label: action === 'decline' ? 'Declining…' : 'Not ready right now',
          onClick: () => handleAction('decline', () => declineInstantInvite(invite.inviteId))
        }
      };
    }

    if (isRequester) {
      return {
        primaryCta: {
          label: action === 'cancel' ? 'Cancelling…' : 'Cancel request',
          onClick: () => handleAction('cancel', () => cancelInstantInvite(invite.inviteId))
        },
        secondaryCta: null
      };
    }

    return { primaryCta: null, secondaryCta: null };
  }, [isPending, isTarget, isRequester, action, invite.inviteId]);

  useEffect(() => {
    if (isPending && primaryCta) {
      primaryButtonRef.current?.focus();
    }
  }, [isPending, primaryCta]);

  return (
    <div className={styles.invitePanel}>
      <div className={styles.inviteMessage}>{getInviteMessage(invite, resolvedUserId)}</div>
      {error && <div className={styles.error}>{error}</div>}
      {primaryCta && (
        <div className={styles.inviteActions}>
          <button
            ref={primaryButtonRef}
            type="button"
            className={`${styles.inviteActionButton} ${styles.inviteActionPrimary}`}
            disabled={action !== null}
            onClick={primaryCta.onClick}
          >
            {primaryCta.label}
          </button>
          {secondaryCta && (
            <button
              type="button"
              className={`${styles.inviteActionButton} ${styles.inviteLinkButton}`}
              disabled={action !== null}
              onClick={secondaryCta.onClick}
            >
              {secondaryCta.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
