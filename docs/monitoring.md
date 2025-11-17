# Monitoring & Dashboards

## Sentry
- **Projects**: `humanchat-web`, `humanchat-api`, `humanchat-ws`.
- **Integrations**: GitHub, Slack #incidents channel.
- **Dashboards**: Error rate, top issues, release health.
- **Setup**: Add DSNs to environment vars (`NEXT_PUBLIC_SENTRY_DSN` for web, `SENTRY_DSN` for backend/ws). Initialize in `apps/web/app/layout.tsx` and `src/server/app.ts`.

## PostHog Analytics
- **Key metrics**: retention, funnel from landing → booking, session duration, drop-off reasons.
- **Implementation**: server-side proxy to avoid exposing keys; define `POSTHOG_API_KEY`, `POSTHOG_HOST`.
- **Dashboard**: "Activation" board with widgets for MAU, bookings, conversation starts.

## Better Uptime / UptimeRobot
- Checks:
  - `https://humanchat.com` (Vercel, 30s interval).
  - `https://api.humanchat.com/health` (Railway API, 30s).
  - `https://ws.humanchat.com/health` (Railway WS, 60s, expect `ok`).
- Heartbeats triggered from cron job after nightly backup; failure indicates backup issue.

## Vercel Analytics & Lighthouse
- Enable Vercel Analytics + Speed Insights.
- Weekly scheduled Lighthouse CI run; push results to `docs/perf-results.md`.

## Log Aggregation
- Railway Observability piping logs to Datadog (optional) or storing in Railway console.
- Configure log-based alerts for 5xx burst > 20/min.

## Alert Routing
1. Pager rotation receives P1 alerts (Better Uptime incident, Sentry rate spike).
2. Slack `#alerts` channel for P2 notifications.
3. Email summary daily for leadership.

## Dashboard Access
- Document links in Notion/Runbook.
- Maintain read-only seats for support.
