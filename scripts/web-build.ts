import { spawn } from 'node:child_process';
import { existsSync, cpSync, rmSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';

const envFiles = ['.env', '.env.local', '.env.cloudrun', 'apps/web/.env', 'apps/web/.env.local'].map((file) =>
  resolve(process.cwd(), file)
);

for (const file of envFiles) {
  if (existsSync(file)) {
    loadEnv({ path: file, override: false });
  }
}

const requiredPublicEnv = ['NEXT_PUBLIC_FIREBASE_API_KEY', 'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', 'NEXT_PUBLIC_FIREBASE_PROJECT_ID'];
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

const syncPublicAssets = () => {
  const appDir = resolve(process.cwd(), 'apps/web');
  const sourceDir = resolve(appDir, 'public');
  const targetDir = resolve(appDir, '.next/public');
  if (!existsSync(sourceDir)) {
    console.warn('[web:build] No public directory found at apps/web/public');
    return;
  }
  mkdirSync(targetDir, { recursive: true });
  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(targetDir, { recursive: true });
  cpSync(sourceDir, targetDir, { recursive: true });
  console.log('[web:build] Synced public assets into apps/web/.next/public');
};

const mirrorPublicDirToRoot = () => {
  const sourceDir = resolve(process.cwd(), 'apps/web/public');
  const targetDir = resolve(process.cwd(), 'public');
  if (!existsSync(sourceDir)) {
    console.warn('[web:build] No public directory found to mirror at apps/web/public');
    return;
  }
  rmSync(targetDir, { recursive: true, force: true });
  cpSync(sourceDir, targetDir, { recursive: true });
  console.log('[web:build] Mirrored apps/web/public into repo-root public directory.');
};

const mirrorBuildOutputToRoot = () => {
  const appDir = resolve(process.cwd(), 'apps/web/.next');
  const rootOutput = resolve(process.cwd(), '.next');
  if (!existsSync(appDir)) {
    console.warn('[web:build] No build output found at apps/web/.next to mirror.');
    return;
  }
  rmSync(rootOutput, { recursive: true, force: true });
  cpSync(appDir, rootOutput, { recursive: true });
  console.log('[web:build] Mirrored apps/web/.next into repo-root .next for Vercel.');
};

const patchNftNodeModulePaths = () => {
  const rootOutput = resolve(process.cwd(), '.next');
  if (!existsSync(rootOutput)) {
    return;
  }

  const nftFiles: string[] = [];
  const walk = (dir: string) => {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = resolve(dir, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.nft.json')) {
        nftFiles.push(entryPath);
      }
    }
  };

  walk(rootOutput);

  let patchedCount = 0;
  for (const file of nftFiles) {
    const original = readFileSync(file, 'utf8');
    const updated = original.replaceAll('../../../node_modules/', '../node_modules/');
    if (updated !== original) {
      writeFileSync(file, updated, 'utf8');
      patchedCount += 1;
    }
  }

  if (patchedCount > 0) {
    console.log(`[web:build] Patched node_modules paths in ${patchedCount} NFT manifest(s).`);
  }
};

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(1);
    return;
  }

  if (code === 0) {
    try {
      syncPublicAssets();
      mirrorPublicDirToRoot();
      mirrorBuildOutputToRoot();
      patchNftNodeModulePaths();
    } catch (error) {
      console.error('[web:build] Failed to copy public assets', error);
      process.exit(1);
      return;
    }
  }

  process.exit(code ?? 1);
});
