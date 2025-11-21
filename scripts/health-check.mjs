#!/usr/bin/env node

const checks = [
  {
    name: 'API (custom domain)',
    url: process.env.API_HEALTH_URL ?? 'https://api.humanchat.com/health'
  },
  {
    name: 'API (run.app direct)',
    url: process.env.API_DIRECT_HEALTH_URL ?? 'https://humanchat-api-2iwqjdjg3a-uc.a.run.app/health'
  },
  {
    name: 'WebSocket (custom domain)',
    url: process.env.WS_HEALTH_URL ?? 'https://ws.humanchat.com/health'
  },
  {
    name: 'WebSocket (run.app direct)',
    url: process.env.WS_DIRECT_HEALTH_URL ?? 'https://humanchat-ws-2iwqjdjg3a-uc.a.run.app/health'
  }
];

const TIMEOUT_MS = Number(process.env.HEALTH_CHECK_TIMEOUT_MS ?? 8000);

async function run() {
  const results = [];
  for (const check of checks) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(check.url, {
        method: 'GET',
        signal: controller.signal,
        headers: { 'user-agent': 'humanchat-health-check/1.0' }
      });
      const ok = response.ok;
      results.push({ ...check, status: response.status, ok, error: null });
    } catch (error) {
      results.push({ ...check, status: null, ok: false, error });
    } finally {
      clearTimeout(timeout);
    }
  }

  const failed = results.filter((res) => !res.ok);
  for (const res of results) {
    if (res.ok) {
      console.log(`PASS ${res.name}: ${res.status}`);
    } else {
      console.error(`FAIL ${res.name}: ${res.error?.message ?? res.status}`);
    }
  }

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

run();
