import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { env } from '../config/env.js';

const requiredFirebaseSecrets = [
  ['FIREBASE_PROJECT_ID', env.firebaseProjectId],
  ['FIREBASE_CLIENT_EMAIL', env.firebaseClientEmail],
  ['FIREBASE_PRIVATE_KEY', env.firebasePrivateKey]
];

const missing = requiredFirebaseSecrets.filter(([, value]) => !value);
if (missing.length) {
  const names = missing.map(([name]) => name).join(', ');
  throw new Error(`Missing Firebase credentials: ${names}`);
}

const firebaseApp = getApps()[0] ??
  initializeApp({
    credential: cert({
      projectId: env.firebaseProjectId!,
      clientEmail: env.firebaseClientEmail!,
      privateKey: env.firebasePrivateKey!
    })
  });

export const firebaseAuth = getAuth(firebaseApp);
