# Incident Response Playbook

## Roles
- **Incident Commander (IC)**: Coordinates response, keeps timeline.
- **Communications Lead**: External + internal updates.
- **Subject Matter Experts**: API, Web, Infrastructure.

## Triggering an Incident
- Automatic: Better Uptime/Sentry alert severity `critical`.
- Manual: On-call engineer declares via `/incident start` Slack command.

## Phases
1. **Triage (0-5 min)**
   - Acknowledge alert in PagerDuty.
   - Confirm impact (users affected, component failing).
   - Assign IC and roles.
2. **Mitigation (5-30 min)**
   - Roll back to last healthy deployment or scale up replicas.
   - Capture logs (`railway logs --service api`).
   - Update status page (Better Uptime) within 15 minutes.
3. **Communication**
   - Internal: Post updates every 15 minutes in `#incidents`.
   - External: Status page + Twitter if outage >30 min.
4. **Resolution**
   - Verify recovery via synthetic checks.
   - Close incident in pager tool.
5. **Post-Incident Review (within 24h)**
   - Fill template (summary, timeline, root cause, corrective actions).
   - File follow-up tickets with owners + due dates.

## Tooling
- Slack workflow `/incident`.
- Better Uptime status page.
- Sentry issue linking.
- Notion template for PIR.

## Runbooks
- API restart: `scripts/deploy-api.sh` + verifying health.
- Database failover: promote Supabase replica; update `DATABASE_URL` secret.
- WebSocket overload: increase Railway max scale, flush backlog.

## Communication Templates
- Status page initial update.
- Customer email for P1 incidents >60 minutes.
