#!/usr/bin/env bash
# Idempotent local-dev bootstrap for sandboxes without Docker/apt:
#   deps → embedded PostgreSQL 16 → .env → db:bootstrap + db:rls + db:seed:sk
# Afterwards start the servers yourself (foreground, so they can be supervised):
#   /home/user/pgtools/pg.sh start                       # PostgreSQL on 127.0.0.1:5432
#   cd apps/web && next dev -p 3001 -H 0.0.0.0           # app on :3001
# Not used by CI or production — safe to delete.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PGTOOLS=/home/user/pgtools
PG="$PGTOOLS/node_modules/@embedded-postgres/linux-x64/native"
DATA=/home/user/.local/share/pgdata
DB_URL="postgresql://openpims:openpims@127.0.0.1:5432/openvpm_ai"
PORT=3001
SANDBOX="${E2B_SANDBOX_ID:-}"

log() { printf '\033[36m[sandbox-dev-up]\033[0m %s\n' "$*"; }

# 1. Node deps -----------------------------------------------------------------
cd "$ROOT"
if ! command -v pnpm >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || true
  corepack prepare pnpm@9.15.0 --activate >/dev/null 2>&1 || true
fi
if [ ! -x node_modules/.bin/next ]; then
  log "installing workspace dependencies"
  pnpm install --frozen-lockfile --prefer-offline
fi

# 2. PostgreSQL binaries + cluster ----------------------------------------------
if [ ! -x "$PG/bin/postgres" ]; then
  log "installing embedded PostgreSQL 16.14"
  mkdir -p "$PGTOOLS" && cd "$PGTOOLS"
  [ -f package.json ] || npm init -y >/dev/null
  npm install --no-audit --no-fund embedded-postgres@16.14.0-beta.17 >/dev/null
  cd "$ROOT"
fi
cat > "$PGTOOLS/pg.sh" <<EOF
#!/usr/bin/env bash
export LD_LIBRARY_PATH="$PG/lib\${LD_LIBRARY_PATH:+:\$LD_LIBRARY_PATH}"
case "\${1:-start}" in
  start)  exec "$PG/bin/postgres" -D "$DATA" ;;
  stop)   exec "$PG/bin/pg_ctl" -D "$DATA" -m fast stop ;;
  status) exec "$PG/bin/pg_ctl" -D "$DATA" status ;;
  *) echo "usage: \$0 start|stop|status" >&2; exit 2 ;;
esac
EOF
chmod +x "$PGTOOLS/pg.sh"
if [ ! -f "$DATA/PG_VERSION" ]; then
  log "initialising cluster in $DATA"
  mkdir -p "$(dirname "$DATA")"
  printf 'openpims' > "$PGTOOLS/pwfile"; chmod 600 "$PGTOOLS/pwfile"
  LD_LIBRARY_PATH="$PG/lib" "$PG/bin/initdb" -D "$DATA" -U openpims \
    --pwfile="$PGTOOLS/pwfile" --auth=scram-sha-256 --encoding=UTF8 --locale=C.UTF-8 >/dev/null
  cat >> "$DATA/postgresql.conf" <<'EOF'
listen_addresses = '127.0.0.1'
port = 5432
max_connections = 60
shared_buffers = 128MB
logging_collector = off
EOF
fi

# 3. Make sure a server is running for the rest of this script -----------------
STARTED_HERE=0
if ! (LD_LIBRARY_PATH="$PG/lib" "$PG/bin/pg_ctl" -D "$DATA" status >/dev/null 2>&1); then
  LD_LIBRARY_PATH="$PG/lib" "$PG/bin/pg_ctl" -D "$DATA" -l /tmp/pg-setup.log -w start >/dev/null
  STARTED_HERE=1
fi

# 4. .env (gitignored) ----------------------------------------------------------
if [ ! -f .env ]; then
  log "writing .env from .env.example"
  SECRET="$(openssl rand -base64 32)"
  sed -e "s|^DATABASE_URL=.*|DATABASE_URL=\"$DB_URL\"|" \
      -e "s|^OPENPIMS_APP_DB_PASSWORD=.*|OPENPIMS_APP_DB_PASSWORD=local-openpims-app|" \
      -e "s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=\"$SECRET\"|" \
      .env.example > .env
fi
if [ -n "$SANDBOX" ]; then
  # Preview host changes with every sandbox → always refresh these lines.
  grep -v '^NEXTAUTH_URL=\|^PREVIEW_DEV_ORIGINS=\|^PREVIEW_FRAME_ANCESTORS=\|^PREVIEW_COOKIE_BRIDGE=\|^# --- sandbox live-preview' .env > .env.tmp
  {
    cat .env.tmp
    echo "# --- sandbox live-preview only (not for production) ---"
    echo "NEXTAUTH_URL=\"https://$PORT-$SANDBOX.e2b.app\""
    echo "PREVIEW_DEV_ORIGINS=\"$PORT-$SANDBOX.e2b.app,*.e2b.app\""
    echo "PREVIEW_FRAME_ANCESTORS=\"*\""
    # The preview proxy strips the request Cookie header → bridge it (see
    # apps/web/lib/preview-cookie-bridge.ts).
    echo "PREVIEW_COOKIE_BRIDGE=true"
  } > .env
  rm -f .env.tmp
fi
ln -sfn ../../.env apps/web/.env

# 5. Database + schema + seed (only when missing) --------------------------------
node - <<'EOF'
const postgres = require("./packages/db/node_modules/postgres");
(async () => {
  const admin = postgres("postgresql://openpims:openpims@127.0.0.1:5432/postgres", { max: 1 });
  const rows = await admin`select 1 from pg_database where datname = 'openvpm_ai'`;
  if (!rows.length) { await admin.unsafe("create database openvpm_ai owner openpims"); console.log("[sandbox-dev-up] created database openvpm_ai"); }
  await admin.end();
})().catch((e) => { console.error(e); process.exit(1); });
EOF
SEEDED=$(node -e '
const postgres = require("./packages/db/node_modules/postgres");
const sql = postgres(process.argv[1], { max: 1 });
sql`select to_regclass(${"public.practices"}) as t`.then(async (r) => { const t = r[0].t; let n = 0; if (t) n = Number((await sql`select count(*)::int as n from practices`)[0].n); await sql.end(); console.log(n > 0 ? "yes" : "no"); }).catch(() => console.log("no"));
' "$DB_URL")
if [ "$SEEDED" != "yes" ]; then
  log "db:bootstrap + db:rls + db:seed:sk"
  NODE_OPTIONS=--max-old-space-size=3072 pnpm db:bootstrap >/tmp/db-bootstrap.log 2>&1 || { tail -20 /tmp/db-bootstrap.log; exit 1; }
  OPENPIMS_APP_DB_PASSWORD='local-openpims-app' pnpm db:rls >/tmp/db-rls.log 2>&1 || { tail -20 /tmp/db-rls.log; exit 1; }
  pnpm db:seed:sk >/tmp/db-seed-sk.log 2>&1 || { tail -20 /tmp/db-seed-sk.log; exit 1; }
  grep -a '^✓' /tmp/db-seed-sk.log | head -8
else
  log "database already seeded — skipping bootstrap/seed"
fi

if [ "$STARTED_HERE" = 1 ]; then
  LD_LIBRARY_PATH="$PG/lib" "$PG/bin/pg_ctl" -D "$DATA" -m fast -w stop >/dev/null
fi
log "ready. Start:  $PGTOOLS/pg.sh start   |   (cd apps/web && ./node_modules/.bin/next dev -p $PORT -H 0.0.0.0)"
log "login: martin.sykora@vetsykora.sk / password123"
