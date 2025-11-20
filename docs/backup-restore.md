# Backup & Restore Procedures

## Database (Primary Postgres)
- **Backups**: Automatic daily snapshots kept 7 days. Weekly logical dumps pushed to Cloudflare R2 using `pg_dump` GitHub Action.
- **Verification**: Monthly restore test into staging DB using an ephemeral Postgres container.
- **Restore Steps**:
  1. Pause API + WS deploys.
  2. Provision a fresh managed Postgres instance or wipe staging DB.
  3. Import latest dump: `pg_restore --clean --no-owner -d $DATABASE_URL latest.dump`.
  4. Update `DATABASE_URL` secret in Railway, redeploy API/WS.

## Redis (Upstash)
- **Backups**: Built-in daily snapshot. Enable point-in-time (PITR) with 24h window.
- **Restore**: Use Upstash dashboard to clone snapshot into new database, update `REDIS_URL` env, invalidate old tokens.

## User Uploads (Cloudflare R2)
- **Replication**: Enable automatic replication to secondary region (`account.eu`).
- **Lifecycle**: Versioning on, 30-day deletions.
- **Restore**: Use `rclone sync r2-primary:humanchat r2-dr:humanchat --dry-run` to verify, then run without `--dry-run`.

## Backup Monitoring
- Better Uptime heartbeat triggered after each backup job.
- Alerts if heartbeat missing for >2 intervals.

## Access Control
- Store backup credentials in 1Password; restrict to SRE group.
- All restores require IC approval and change management ticket.
