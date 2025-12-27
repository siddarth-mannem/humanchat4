# Backup & Restore Procedures

## Database (Neon Postgres)
- **Backups**: Neon’s point-in-time recovery (PITR) keeps 7 days of history. We still run weekly logical dumps via `pg_dump` to Cloudflare R2 as a secondary safety net.
- **Verification**: Monthly smoke test by creating a disposable Neon branch from the latest PITR snapshot, running migrations, and pointing staging at that branch.
- **Restore Steps**:
  1. Pause API + WS deploys.
  2. In the Neon console, create a branch from the desired PITR timestamp (or promote the most recent logical dump into a new branch).
  3. Update the `neon-database-url` secret (and any Terraform/CI vars) to point at the new branch connection string.
  4. Redeploy Cloud Run services so they pick up the refreshed secret.

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
