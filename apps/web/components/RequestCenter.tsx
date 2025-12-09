'use client';

import { useEffect } from 'react';
import type { ManagedRequest } from '../../../src/lib/db';
import styles from './RequestCenter.module.css';

interface RequestCenterProps {
  open: boolean;
  requests: ManagedRequest[];
  loading: boolean;
  error: string | null;
  updatingId: string | null;
  onClose: () => void;
  onRefresh: () => void;
  onUpdateStatus: (requestId: string, status: ManagedRequest['status']) => Promise<unknown>;
}

const formatRelativeTime = (timestamp: number): string => {
  const diffMs = Date.now() - timestamp;
  if (diffMs < 60000) return 'just now';
  if (diffMs < 3600000) return `${Math.round(diffMs / 60000)}m ago`;
  if (diffMs < 86400000) return `${Math.round(diffMs / 3600000)}h ago`;
  return new Date(timestamp).toLocaleString();
};

export default function RequestCenter({
  open,
  requests,
  loading,
  error,
  updatingId,
  onClose,
  onRefresh,
  onUpdateStatus
}: RequestCenterProps) {
  useEffect(() => {
    if (!open) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const handleAction = async (requestId: string, status: ManagedRequest['status']) => {
    await onUpdateStatus(requestId, status);
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Managed request center">
      <aside className={styles.drawer}>
        <header className={styles.header}>
          <div>
            <p className={styles.kicker}>Managed queue</p>
            <h2 className={styles.title}>Requests waiting on you</h2>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.ghostButton} onClick={onRefresh} disabled={loading}>
              Refresh
            </button>
            <button type="button" className={styles.closeButton} onClick={onClose}>
              ×
            </button>
          </div>
        </header>
        {error && <div className={styles.errorBanner}>{error}</div>}
        <div className={styles.list}>
          {loading && !requests.length && <div className={styles.placeholder}>Loading requests…</div>}
          {!loading && !requests.length && <div className={styles.placeholder}>Nothing queued right now.</div>}
          {requests.map((request) => {
            const isPending = request.status === 'pending';
            return (
              <article key={request.requestId} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div>
                    <p className={styles.cardRequester}>{request.requesterId}</p>
                    {request.representativeName && <p className={styles.cardRep}>For {request.representativeName}</p>}
                  </div>
                  <span className={styles.badge} data-status={request.status}>
                    {request.status}
                  </span>
                </div>
                <p className={styles.message}>{request.message}</p>
                <dl className={styles.metaGrid}>
                  {request.preferredTime && (
                    <div>
                      <dt>Preferred time</dt>
                      <dd>{request.preferredTime}</dd>
                    </div>
                  )}
                  {request.budgetRange && (
                    <div>
                      <dt>Budget</dt>
                      <dd>{request.budgetRange}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Submitted</dt>
                    <dd>{formatRelativeTime(request.createdAt)}</dd>
                  </div>
                </dl>
                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => handleAction(request.requestId, 'declined')}
                    disabled={updatingId === request.requestId || !isPending}
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => handleAction(request.requestId, 'approved')}
                    disabled={updatingId === request.requestId || !isPending}
                  >
                    {request.status === 'approved' ? 'Approved' : 'Accept & connect'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
