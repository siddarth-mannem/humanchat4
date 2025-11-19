import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

const envFiles = ['.env', '.env.local', 'apps/web/.env', 'apps/web/.env.local'].map((file) =>
  resolve(process.cwd(), file)
);

for (const file of envFiles) {
  if (existsSync(file)) {
    loadEnv({ path: file, override: false });
  }
}

const requiredPublicEnv = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const missingEnv = requiredPublicEnv.filter((key) => !process.env[key]);
const skipFlag = process.env.SKIP_WEB_BUILD === 'true';
const forceBuild = process.env.FORCE_WEB_BUILD === 'true';

if (skipFlag) {
  console.log('[web:build] Skipping Next.js build because SKIP_WEB_BUILD=true.');
  process.exit(0);
}

if (!forceBuild && missingEnv.length > 0) {
  console.log('[web:build] Skipping Next.js build because required public env vars are missing.');
  console.log(`[web:build] Missing: ${missingEnv.join(', ')}`);
  console.log('[web:build] Provide the values or set FORCE_WEB_BUILD=true to override.');
  process.exit(0);
}

const child = spawn('next', ['build', 'apps/web'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production'
  }
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(1);
    return;
  }
  process.exit(code ?? 1);
});
