# Nodepad Hub: Debian operations guide

The Hub keeps the existing canonical Workspace/Entity/Edge semantics. The API intentionally remains a coarse whole-state transaction: current payload sizes and edit frequency do not justify a larger CRUD surface yet, while SQLite still normalizes and indexes graph rows. PUT retries are idempotent with respect to IDs; if a response is lost, a retry uses its old revision and receives `REVISION_CONFLICT` rather than duplicating workspaces.

## Install and build

```bash
sudo useradd --system --home /opt/nodepad --shell /usr/sbin/nologin nodepad
sudo install -d -o nodepad -g nodepad /opt/nodepad /var/lib/nodepad /var/backups/nodepad
# clone/copy this repository to /opt/nodepad, then:
sudo -u nodepad npm ci
sudo -u nodepad npm run lint
sudo -u nodepad npm run build
sudo install -d -m 0750 -o root -g nodepad /etc/nodepad
sudo cp .env.example /etc/nodepad/nodepad.env
sudo chmod 0640 /etc/nodepad/nodepad.env
```

Set `NODE_ENV=production`, `NEXT_PUBLIC_NODEPAD_STORAGE_MODE=server`, a long random `NODEPAD_API_TOKEN`, `NODEPAD_DB_PATH=/var/lib/nodepad/nodepad.sqlite`, `NODEPAD_BACKUP_DIR=/var/backups/nodepad`, retention count, and request limit. `NODEPAD_DB_PATH` overrides `NODEPAD_DATA_DIR`. Server mode fails its systemd preflight when the token is missing or the database is unhealthy.

## systemd and logs

Review `deploy/nodepad.service.example`, adapt only installation paths, then copy it to `/etc/systemd/system/nodepad.service`. It runs as the non-root `nodepad` user, reads secrets from `/etc/nodepad/nodepad.env`, binds Next.js to localhost, permits writes only to database/backup directories, starts after networking, runs an integrity preflight, and restarts on failure.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now nodepad
sudo systemctl status nodepad
journalctl -u nodepad -f
```

SQLite has no network listener. Controlled shutdown uses SIGTERM/Next.js shutdown; database libraries expose `closeDatabase()` for explicit lifecycle users and contain no `process.exit()` calls.

## HTTPS reverse proxy

`deploy/Caddyfile.example` terminates HTTPS and proxies to `127.0.0.1:3000`, forwards host/protocol/client headers, applies a 25 MB body cap, and disables response buffering for future streaming. Do not expose port 3000 publicly. Production session cookies are `Secure`, HttpOnly, SameSite=Strict, and Path=/, so HTTPS and same-origin frontend/API hosting are required.

Global Next.js headers already set `X-Content-Type-Options`, `Referrer-Policy`, frame restrictions, Permissions Policy, and a reviewed CSP. CSP retains required inline/eval allowances for the current Next.js/dev and custom-provider behavior; tightening it requires a separate compatibility audit.

## Authentication, CSRF, and migration

On first connection Nodepad shows its own token dialog. The token is exchanged for an HttpOnly cookie and discarded, never saved in localStorage. Cookie SameSite=Strict is the primary CSRF boundary; all mutation routes additionally reject an `Origin` that does not match forwarded protocol/host. Origin-less operator requests remain supported because possession of the session cookie is required.

If the Hub is empty and browser-v2 data exists, Nodepad displays workspace/entity/edge counts and requires an explicit upload choice. It never displays note bodies or deletes browser data. Stable IDs plus revision checks make retry after a lost response safe: committed data is not duplicated, and a stale retry conflicts.

## Health and integrity

```bash
curl -fsS https://nodepad.example.com/api/hub/health
sudo -u nodepad env $(cat /etc/nodepad/nodepad.env | xargs) npm run db:check
```

Health exposes only status, database readiness, schema version, and writability. `db:check` runs `quick_check`, `foreign_key_check`, verifies required tables and migration state, and exits non-zero on failure.

## Crash recovery versus retention backups

The adjacent `<database>.backup` file is a single automatic crash-recovery snapshot made before API writes. It is not backup retention.

Operator backups use SQLite's online backup API, so active WAL state is copied safely:

```bash
sudo -u nodepad npm run db:backup
```

Files are timestamped `nodepad-YYYYMMDDTHHMMSS.sssZ.sqlite` in `NODEPAD_BACKUP_DIR`, then reopened and verified. JSON output includes path, time, byte size, quick-check result, foreign-key result, and schema version—never graph contents. `NODEPAD_BACKUP_KEEP_COUNT` retains the newest N recognized files; pruning is deterministic, never removes the just-created backup, ignores unrelated files, and never recurses.

Schedule this command with a systemd timer or cron appropriate to the host; no scheduler is installed by this repository.

## Conservative restore

Hot restore is unsupported. Stop Nodepad first:

```bash
sudo systemctl stop nodepad
sudo -u nodepad npm run db:check
sudo -u nodepad npm run db:restore -- /var/backups/nodepad/nodepad-20260101T120000.000Z.sqlite --confirm-stopped
sudo -u nodepad npm run db:check
sudo systemctl start nodepad
curl -fsS https://nodepad.example.com/api/hub/health
```

Restore validates SQLite integrity, foreign keys, and required Nodepad schema before touching production; creates a timestamped `-pre-restore` safety backup; uses SQLite's backup API into a temporary database; removes stopped-process WAL/SHM files; atomically renames the verified replacement; and verifies the result. Invalid SQLite or wrong-schema files fail with a non-zero status.

## Upgrade procedure

1. Run `npm run db:backup`.
2. Stop Nodepad.
3. Pull/deploy code and run `npm ci`.
4. Run `npm run lint`, `npm test`, and `npm run build`.
5. Run `npm run db:check`.
6. Start Nodepad. Schema migrations run automatically and transactionally on first database open.
7. Check `/api/hub/health` and `journalctl -u nodepad`.

## Client failure behavior

The status strip distinguishes browser storage, connecting, online, authentication required, offline cache, conflict, and unavailable states. When the Hub is unreachable but cache exists, the graph is visible read-only; writes are blocked and never queued. “Reload server version” reconnects, rechecks the cookie, reloads server authority, and refreshes cache. A revision conflict blocks edits and requires the same explicit reload—there is no blind overwrite or graph merge.

## Failure recovery

- **Won't start:** inspect `journalctl -u nodepad`, validate the environment/token, permissions on data directories, and run `npm run db:check`.
- **Primary database corrupt:** stop service, run integrity check, choose a verified retention backup, restore with `--confirm-stopped`, recheck, start, then call health.
- **Hub unreachable:** cached graph is shown read-only; repair networking/service and use Reload server version.
- **Revision conflict:** discard the unpersisted local change by reloading authoritative server state. Merge UI remains out of scope.
- **Request rejected:** structured responses identify auth, origin, size, payload, conflict, database, and internal error classes; private details stay in structured server logs.
