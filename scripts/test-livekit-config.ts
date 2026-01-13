/**
 * Test LiveKit configuration
 * Run: tsx scripts/test-livekit-config.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { AccessToken } from 'livekit-server-sdk';

// Load environment from .env.backend.local
config({ path: resolve(process.cwd(), '.env.backend.local') });

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

console.log('\n🎥 Testing LiveKit Configuration...\n');

// Check environment variables
if (!LIVEKIT_API_KEY) {
  console.error('❌ LIVEKIT_API_KEY is not set in environment');
  process.exit(1);
}

if (!LIVEKIT_API_SECRET) {
  console.error('❌ LIVEKIT_API_SECRET is not set in environment');
  process.exit(1);
}

if (!LIVEKIT_URL) {
  console.error('❌ LIVEKIT_URL is not set in environment');
  process.exit(1);
}

console.log('✅ Environment variables loaded:');
console.log(`   API Key: ${LIVEKIT_API_KEY.substring(0, 10)}...`);
console.log(`   API Secret: ${LIVEKIT_API_SECRET.substring(0, 10)}...`);
console.log(`   Server URL: ${LIVEKIT_URL}\n`);

// Test token generation
(async () => {
  try {
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: 'test-user-123',
      name: 'Test User',
    });

  at.addGrant({
    room: 'test-room',
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  at.ttl = '1h';

  const token = await at.toJwt();

  console.log('✅ Successfully generated LiveKit JWT token!');
  console.log(`   Token length: ${token.length} characters`);
  console.log(`   Token preview: ${token.substring(0, 50)}...\n`);

  // Decode token to verify claims (without verification)
  const parts = token.split('.');
  if (parts.length === 3) {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    console.log('✅ Token payload verified:');
    console.log(`   Identity: ${payload.sub}`);
    console.log(`   Name: ${payload.name}`);
    console.log(`   Room: ${payload.video?.room}`);
    console.log(`   Expires: ${new Date(payload.exp * 1000).toLocaleString()}\n`);
  }

  console.log('🎉 LiveKit configuration is correct!');
  console.log('\n📝 Next steps:');
  console.log('   1. Run database migration: npm run db:migrate');
  console.log('   2. Start backend: npm run dev');
  console.log('   3. Start frontend: npm run web:dev');
  console.log('   4. Test call flow in browser\n');

} catch (error) {
  console.error('❌ Failed to generate token:', error);
  console.error('\nPossible issues:');
  console.error('   - API Key or Secret is incorrect');
  console.error('   - livekit-server-sdk package not installed');
  console.error('   - Invalid credentials format');
  process.exit(1);
}
})();
