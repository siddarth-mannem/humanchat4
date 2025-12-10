'use client';

import styles from './ConversationView.module.css';
import type { PaymentMode } from '../../../src/lib/db';

interface EndCallSummary {
  durationSeconds: number;
  totalAmount: number;
  currency: string;
  paymentIntentId?: string;
  paymentMode: PaymentMode;
  charityName?: string;
  donationAllowed?: boolean;
  peerName?: string;
  confidentialRate?: boolean;
  representativeName?: string | null;
}

interface EndCallFlowProps {
  summary: EndCallSummary;
  onDismiss: () => void;
  onDonate?: () => void;
}

const formatDuration = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
};

export default function EndCallFlow({ summary, onDismiss, onDonate }: EndCallFlowProps) {
  const repName = summary.representativeName ?? summary.peerName ?? 'their representative';
  return (
    <div className={styles.endCallOverlay} role="dialog" aria-modal="true">
      <div className={styles.endCallCard}>
        <h3>Session complete</h3>
        <p>You talked for {formatDuration(summary.durationSeconds)}.</p>
        {summary.confidentialRate ? (
          <>
            <p>
              Session fee: <strong>Private Rate</strong>
            </p>
            <p>{repName} will follow up with the finalized amount.</p>
          </>
        ) : (
          <>
            <p>
              Billing total: <strong>{summary.currency.toUpperCase()} ${summary.totalAmount.toFixed(2)}</strong>
            </p>
            {summary.paymentIntentId ? <p>Stripe payment confirmed (intent {summary.paymentIntentId}).</p> : <p>No payment required.</p>}
          </>
        )}
        {summary.paymentMode === 'charity' && summary.charityName && (
          <p>Your contribution supports {summary.charityName}!</p>
        )}
        {summary.donationAllowed && summary.paymentMode !== 'charity' && !summary.confidentialRate && (
          <p>Want to send a little extra thanks?</p>
        )}
        <div className={styles.endCallActions}>
          {summary.donationAllowed && onDonate && !summary.confidentialRate && (
            <button type="button" className={styles.secondaryButton} onClick={onDonate}>
              Send thanks{summary.peerName ? ` to ${summary.peerName}` : ''}
            </button>
          )}
          <button type="button" className={styles.primaryButton} onClick={onDismiss} autoFocus>
            Return to chat
          </button>
        </div>
      </div>
    </div>
  );
}
