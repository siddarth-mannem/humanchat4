import Stripe from 'stripe';
import { env } from '../config/env.js';
import { ApiError } from '../errors/ApiError.js';
import { query } from '../db/postgres.js';
import { logger } from '../utils/logger.js';
import type { SessionPayment, SessionPaymentStatus } from '../types/index.js';

const stripe = new Stripe(env.stripeSecretKey);
const DEFAULT_CURRENCY = 'usd';
const PLATFORM_FEE_BPS = env.stripePlatformFeeBps ?? 1000;

type CaptureMethod = 'automatic' | 'manual';

interface SessionPaymentRow {
	session_id: string;
	payment_intent_id: string | null;
	amount: number;
	currency: string;
	status: SessionPaymentStatus;
	platform_fee: number;
	host_payout: number;
	charity_id: string | null;
	donation_amount: number | null;
	donation_intent_id: string | null;
	donation_checkout_id: string | null;
	metadata: Record<string, unknown> | null;
	created_at: string;
	updated_at: string;
}

const ensureSessionPaymentsTable = (() => {
	let promise: Promise<void> | null = null;
	return () => {
		if (!promise) {
			promise = query(
				`CREATE TABLE IF NOT EXISTS session_payments (
					session_id UUID PRIMARY KEY,
					payment_intent_id TEXT,
					amount INTEGER NOT NULL DEFAULT 0,
					currency VARCHAR(4) NOT NULL DEFAULT 'usd',
					status VARCHAR(20) NOT NULL DEFAULT 'pending',
					platform_fee INTEGER NOT NULL DEFAULT 0,
					host_payout INTEGER NOT NULL DEFAULT 0,
					charity_id TEXT,
					donation_amount INTEGER,
					donation_intent_id TEXT,
					donation_checkout_id TEXT,
					metadata JSONB DEFAULT '{}'::jsonb,
					created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
					updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
				)`
			).then(() => undefined);
		}
		return promise;
	};
})();

const mapRow = (row: SessionPaymentRow): SessionPayment => ({
	sessionId: row.session_id,
	paymentIntentId: row.payment_intent_id,
	amount: row.amount,
	currency: row.currency,
	status: row.status,
	platformFee: row.platform_fee,
	hostPayout: row.host_payout,
	charityId: row.charity_id,
	donationAmount: row.donation_amount,
	donationIntentId: row.donation_intent_id,
	donationCheckoutId: row.donation_checkout_id,
	metadata: row.metadata,
	createdAt: row.created_at,
	updatedAt: row.updated_at
});

const calculatePlatformFee = (amount: number, waiveFee?: boolean): number => {
	if (waiveFee || amount <= 0) {
		return 0;
	}
	return Math.floor((amount * PLATFORM_FEE_BPS) / 10_000);
};

const upsertSessionPayment = async (row: Partial<SessionPaymentRow> & { session_id: string }) => {
	await ensureSessionPaymentsTable();
	await query(
		`INSERT INTO session_payments (session_id, payment_intent_id, amount, currency, status, platform_fee, host_payout, charity_id, donation_amount, donation_intent_id, donation_checkout_id, metadata, created_at, updated_at)
		 VALUES ($1,$2,COALESCE($3,0),COALESCE($4,'usd'),COALESCE($5,'pending'),COALESCE($6,0),COALESCE($7,0),$8,$9,$10,$11,$12::jsonb,NOW(),NOW())
		 ON CONFLICT (session_id) DO UPDATE SET
				payment_intent_id = COALESCE($2, session_payments.payment_intent_id),
				amount = COALESCE($3, session_payments.amount),
				currency = COALESCE($4, session_payments.currency),
				status = COALESCE($5, session_payments.status),
				platform_fee = COALESCE($6, session_payments.platform_fee),
				host_payout = COALESCE($7, session_payments.host_payout),
				charity_id = COALESCE($8, session_payments.charity_id),
				donation_amount = COALESCE($9, session_payments.donation_amount),
				donation_intent_id = COALESCE($10, session_payments.donation_intent_id),
				donation_checkout_id = COALESCE($11, session_payments.donation_checkout_id),
				metadata = COALESCE($12::jsonb, session_payments.metadata),
				updated_at = NOW()`,
		[
			row.session_id,
			row.payment_intent_id ?? null,
			row.amount ?? null,
			row.currency ?? null,
			row.status ?? null,
			row.platform_fee ?? null,
			row.host_payout ?? null,
			row.charity_id ?? null,
			row.donation_amount ?? null,
			row.donation_intent_id ?? null,
			row.donation_checkout_id ?? null,
			row.metadata ? JSON.stringify(row.metadata) : null
		]
	);
};

const getSessionPayment = async (sessionId: string): Promise<SessionPayment | null> => {
	await ensureSessionPaymentsTable();
	const result = await query<SessionPaymentRow>('SELECT * FROM session_payments WHERE session_id = $1', [sessionId]);
	const row = result.rows[0];
	return row ? mapRow(row) : null;
};

const getSessionPaymentByIntent = async (intentId: string): Promise<SessionPayment | null> => {
	await ensureSessionPaymentsTable();
	const result = await query<SessionPaymentRow>('SELECT * FROM session_payments WHERE payment_intent_id = $1', [intentId]);
	const row = result.rows[0];
	return row ? mapRow(row) : null;
};

const getSessionOwner = async (sessionId: string) => {
	const result = await query<{
		host_user_id: string;
		guest_user_id: string;
		payment_mode: string;
		stripe_account_id: string | null;
	}>(
		`SELECT s.host_user_id, s.guest_user_id, s.payment_mode, u.stripe_account_id
		 FROM sessions s
		 JOIN users u ON u.id = s.host_user_id
		 WHERE s.id = $1`,
		[sessionId]
	);
	const row = result.rows[0];
	if (!row) {
		throw new ApiError(404, 'NOT_FOUND', 'Session not found');
	}
	return row;
};

interface CreateIntentOptions {
	sessionId?: string;
	currency?: string;
	captureMethod?: CaptureMethod;
	metadata?: Record<string, string>;
	mode?: 'instant' | 'scheduled' | 'charity' | 'donation';
	waiver?: boolean;
	charityAccountId?: string;
	customerId?: string;
	description?: string;
}

export const createPaymentIntent = async (
	amount: number,
	metadata: Record<string, string> = {},
	options: CreateIntentOptions = {}
): Promise<Stripe.PaymentIntent> => {
	if (!Number.isFinite(amount) || amount <= 0) {
		throw new ApiError(400, 'INVALID_REQUEST', 'Amount must be greater than zero');
	}
	await ensureSessionPaymentsTable();
	const sessionId = options.sessionId ?? metadata.sessionId;
	const currency = (options.currency ?? metadata.currency ?? DEFAULT_CURRENCY).toLowerCase();
	const captureMethod: CaptureMethod = options.captureMethod ?? (options.mode === 'instant' ? 'manual' : 'automatic');
	const waiveFee = options.mode === 'charity' || options.waiver;
	const platformFee = calculatePlatformFee(amount, waiveFee);

	const intent = await stripe.paymentIntents.create({
		amount,
		currency,
		capture_method: captureMethod,
		automatic_payment_methods: { enabled: true },
		metadata: {
			...metadata,
			sessionId: sessionId ?? metadata.sessionId,
			paymentMode: options.mode ?? metadata.paymentMode
		},
		customer: options.customerId,
		description: options.description
	});

	if (sessionId) {
		await upsertSessionPayment({
			session_id: sessionId,
			payment_intent_id: intent.id,
			amount,
			currency,
			status: captureMethod === 'manual' ? 'authorized' : 'pending',
			platform_fee: platformFee,
			host_payout: Math.max(amount - platformFee, 0),
			charity_id: options.charityAccountId ?? null,
			metadata: metadata as Record<string, unknown>
		});
	}

	return intent;
};

export const capturePayment = async (
	paymentIntentId: string,
	finalAmount?: number
): Promise<Stripe.PaymentIntent> => {
	if (!paymentIntentId) {
		throw new ApiError(400, 'INVALID_REQUEST', 'Missing payment intent id');
	}
	const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
	let amountToCapture: number | undefined;
	if (finalAmount && finalAmount > 0) {
		if (intent.capture_method === 'manual' && finalAmount > intent.amount) {
			await stripe.paymentIntents.update(paymentIntentId, { amount: finalAmount });
		} else if (finalAmount < intent.amount) {
			amountToCapture = finalAmount;
		}
	}
	const captured = await stripe.paymentIntents.capture(paymentIntentId, amountToCapture ? { amount_to_capture: amountToCapture } : undefined);
	const total = captured.amount_received ?? captured.amount;
	const paymentRecord = await getSessionPaymentByIntent(paymentIntentId);
	if (paymentRecord) {
		const metadataMode = paymentRecord.metadata && typeof paymentRecord.metadata['paymentMode'] === 'string' ? (paymentRecord.metadata['paymentMode'] as string) : undefined;
		const platformFee = calculatePlatformFee(total, paymentRecord.charityId != null || metadataMode === 'charity');
		await upsertSessionPayment({
			session_id: paymentRecord.sessionId,
			payment_intent_id: paymentIntentId,
			amount: total,
			status: 'captured',
			platform_fee: platformFee,
			host_payout: Math.max(total - platformFee, 0)
		});
		try {
			await transferToHost(paymentRecord.sessionId, undefined, 'session_payout');
		} catch (error) {
			logger.warn('Stripe transfer failed', { sessionId: paymentRecord.sessionId, error });
		}
	}
	return captured;
};

export const refundPayment = async (
	paymentIntentId: string,
	amount?: number
): Promise<Stripe.Refund> => {
	if (!paymentIntentId) {
		throw new ApiError(400, 'INVALID_REQUEST', 'Missing payment intent id');
	}
	try {
		const refund = await stripe.refunds.create({ payment_intent: paymentIntentId, amount });
		const paymentRecord = await getSessionPaymentByIntent(paymentIntentId);
		if (paymentRecord) {
			await upsertSessionPayment({
				session_id: paymentRecord.sessionId,
				status: 'refunded',
				host_payout: 0
			});
		}
		return refund;
	} catch (error) {
		throw new ApiError(400, 'INVALID_REQUEST', 'Failed to refund payment', error);
	}
};

export const transferToHost = async (
	sessionId: string,
	amountOverride?: number,
	reason: 'session_payout' | 'donation' = 'session_payout'
): Promise<Stripe.Response<Stripe.Transfer>> => {
	if (!sessionId) {
		throw new ApiError(400, 'INVALID_REQUEST', 'Missing session id');
	}
	const paymentRecord = await getSessionPayment(sessionId);
	if (!paymentRecord || !paymentRecord.paymentIntentId) {
		throw new ApiError(404, 'NOT_FOUND', 'No payment on file for this session');
	}
	const sessionOwner = await getSessionOwner(sessionId);
	const destination = paymentRecord.charityId ?? sessionOwner.stripe_account_id ?? env.stripeCharityAccountId;
	if (!destination) {
		throw new ApiError(400, 'INVALID_REQUEST', 'Host is not connected to Stripe');
	}
	const amount = amountOverride ?? paymentRecord.hostPayout;
	if (amount <= 0) {
		throw new ApiError(400, 'INVALID_REQUEST', 'Nothing to transfer');
	}
	const transfer = await stripe.transfers.create({
		amount,
		currency: paymentRecord.currency ?? DEFAULT_CURRENCY,
		destination,
		metadata: {
			sessionId,
			reason
		},
		transfer_group: `session_${sessionId}`
	});
	return transfer;
};

export const processDonation = async (
	sessionId: string,
	tipAmount: number,
	currency: string = DEFAULT_CURRENCY
): Promise<{ checkoutUrl: string | null; amount: number }> => {
	if (!Number.isFinite(tipAmount) || tipAmount <= 0) {
		throw new ApiError(400, 'INVALID_REQUEST', 'Donation amount must be greater than zero');
	}
	const cents = Math.round(tipAmount);
	const normalizedCurrency = currency.toLowerCase();
	const paymentRecord = await getSessionPayment(sessionId);
	const sessionOwner = await getSessionOwner(sessionId);
	const destination = paymentRecord?.charityId ?? sessionOwner.stripe_account_id ?? env.stripeCharityAccountId;
	const waiveFee = Boolean(paymentRecord?.charityId);
	const platformFee = calculatePlatformFee(cents, waiveFee);

	const checkout = await stripe.checkout.sessions.create({
		mode: 'payment',
		success_url: `${env.appUrl}/sessions/${sessionId}?donation=success`,
		cancel_url: `${env.appUrl}/sessions/${sessionId}?donation=cancel`,
		line_items: [
			{
				price_data: {
					currency: normalizedCurrency,
					product_data: { name: 'HumanChat tip' },
					unit_amount: cents
				},
				quantity: 1
			}
		],
		payment_intent_data: {
			metadata: { sessionId, reason: 'donation' },
			transfer_group: `session_${sessionId}`,
			application_fee_amount: platformFee > 0 ? platformFee : undefined,
			transfer_data: destination ? { destination } : undefined
		}
	});

	await upsertSessionPayment({
		session_id: sessionId,
		donation_amount: cents,
		donation_checkout_id: checkout.id,
		status: paymentRecord?.status ?? 'pending'
	});

	return { checkoutUrl: checkout.url, amount: cents };
};

export const verifyStripeSignature = (payload: Buffer, signature: string, secret?: string) => {
	if (!secret) {
		throw new ApiError(400, 'INVALID_REQUEST', 'Stripe webhook secret not configured');
	}
	try {
		return stripe.webhooks.constructEvent(payload, signature, secret);
	} catch (error) {
		throw new ApiError(400, 'INVALID_REQUEST', 'Invalid webhook signature', error);
	}
};

export const handleStripeEvent = async (event: Stripe.Event) => {
	switch (event.type) {
		case 'payment_intent.succeeded': {
			const intent = event.data.object as Stripe.PaymentIntent;
			if (!intent.metadata?.sessionId) {
				return;
			}
			const isDonation = intent.metadata.reason === 'donation';
			const amount = intent.amount_received ?? intent.amount;
			if (isDonation) {
				await upsertSessionPayment({
					session_id: intent.metadata.sessionId,
					donation_intent_id: intent.id,
					donation_amount: amount,
					status: 'captured'
				});
			} else {
				const platformFee = calculatePlatformFee(amount, intent.metadata?.paymentMode === 'charity');
				await upsertSessionPayment({
					session_id: intent.metadata.sessionId,
					payment_intent_id: intent.id,
					amount,
					currency: intent.currency,
					status: intent.capture_method === 'manual' ? 'authorized' : 'captured',
					platform_fee: platformFee,
					host_payout: Math.max(amount - platformFee, 0)
				});
			}
			break;
		}
		case 'payment_intent.payment_failed': {
			const intent = event.data.object as Stripe.PaymentIntent;
			if (intent.metadata?.sessionId) {
				await upsertSessionPayment({ session_id: intent.metadata.sessionId, status: 'failed' });
			}
			break;
		}
		case 'charge.refunded': {
			const charge = event.data.object as Stripe.Charge;
			const sessionId = (charge.metadata?.sessionId as string | undefined) ?? null;
			if (sessionId) {
				await upsertSessionPayment({ session_id: sessionId, status: 'refunded', host_payout: 0 });
			}
			break;
		}
		case 'account.updated': {
			logger.info('Stripe account updated', { account: (event.data.object as Stripe.Account).id });
			break;
		}
		default: {
			logger.debug('Unhandled Stripe event', { type: event.type });
		}
	}
};

export const createStripeConnectLink = async (userId: string, returnPath?: string): Promise<{ url: string }> => {
	const userResult = await query<{ email: string; stripe_account_id: string | null }>(
		'SELECT email, stripe_account_id FROM users WHERE id = $1',
		[userId]
	);
	const user = userResult.rows[0];
	if (!user) {
		throw new ApiError(404, 'NOT_FOUND', 'User not found');
	}

	let accountId = user.stripe_account_id ?? null;
	if (!accountId) {
		// Create actual Express Connect account (even in development with test keys)
		const account = await stripe.accounts.create({
			type: 'express',
			email: user.email
		});
		accountId = account.id;
		await query('UPDATE users SET stripe_account_id = $2 WHERE id = $1', [userId, accountId]);
	}

	const refreshUrl = `${env.appUrl}${returnPath ?? '/account'}?status=refresh`;
	const returnUrl = `${env.appUrl}${returnPath ?? '/account'}?status=success`;
	const link = await stripe.accountLinks.create({
		account: accountId,
		refresh_url: refreshUrl,
		return_url: returnUrl,
		type: 'account_onboarding'
	});

	return { url: link.url };
};

export const disconnectStripeAccount = async (userId: string): Promise<void> => {
	const userResult = await query<{ stripe_account_id: string | null }>(
		'SELECT stripe_account_id FROM users WHERE id = $1',
		[userId]
	);
	const user = userResult.rows[0];
	if (!user) {
		throw new ApiError(404, 'NOT_FOUND', 'User not found');
	}

	// Clear the stripe_account_id and reset conversation type to free
	await query(
		`UPDATE users 
		 SET stripe_account_id = NULL, 
		     conversation_type = 'free',
		     instant_rate_per_minute = NULL,
		     charity_id = NULL
		 WHERE id = $1`,
		[userId]
	);

	logger.info('Stripe account disconnected', { userId });
};

export const generateReceipt = async (sessionId: string) => {
	const sessionResult = await query<{
		id: string;
		host_user_id: string;
		guest_user_id: string;
		type: string;
		payment_mode: string;
		start_time: string;
		end_time: string | null;
		charity_name: string | null;
		donation_allowed: boolean | null;
	}>('SELECT * FROM sessions WHERE id = $1', [sessionId]);
	const session = sessionResult.rows[0];
	if (!session) {
		throw new ApiError(404, 'NOT_FOUND', 'Session not found');
	}
	const payment = await getSessionPayment(sessionId);
	if (!payment) {
		throw new ApiError(404, 'NOT_FOUND', 'Payment not found for session');
	}
	return {
		sessionId: session.id,
		hostUserId: session.host_user_id,
		guestUserId: session.guest_user_id,
		status: payment.status,
		amount: payment.amount,
		currency: payment.currency,
		platformFee: payment.platformFee,
		hostPayout: payment.hostPayout,
		donationAmount: payment.donationAmount ?? 0,
		paymentMode: session.payment_mode,
		charityName: session.charity_name,
		donationAllowed: Boolean(session.donation_allowed),
		issuedAt: payment.updatedAt,
		startedAt: session.start_time,
		endedAt: session.end_time,
		paymentIntentId: payment.paymentIntentId,
		donationIntentId: payment.donationIntentId
	};
};

void ensureSessionPaymentsTable();
'use strict';
