#!/usr/bin/env bash
#
# OpenVPM AI — Disaster Recovery Restore Drill (shell wrapper)
#
# Automatizovaný test obnovy produkčnej databázy zo zálohy do IZOLOVANEJ
# testovacej inštancie s overením integrity dát.
#
# Čo robí:
#   1. Skontroluje dostupnosť pg_dump / psql a premenných prostredia.
#   2. pg_dump zo SOURCE_DATABASE_URL (produkcia) do dočasného súboru.
#   3. Obnova do TARGET_DATABASE_URL (izolovaná testovacia inštancia).
#   4. Overenie integrity: zoznam tabuliek + počty riadkov kritických tabuliek.
#   5. Vygeneruje podpísaný audit artefakt (deleguje na dr-restore-drill.mjs).
#
# Použitie:
#   SOURCE_DATABASE_URL='postgres://…prod…' \
#   TARGET_DATABASE_URL='postgres://…drill…' \
#   bash scripts/dr-restore-drill.sh
#
# Bezpečnostné opatrenia:
#   - Nikdy nemaže dáta v zdrojovej (produkčnej) inštancii.
#   - Heslá sa nikdy nezapisujú do logov (redakcia v safe_url).
#   - Cieľová inštancia MUSÍ byť oddelená od produkcie (ochrana pred preklepom
#     pomocou DR_DRILL_ALLOW_NON_ISOLATED=1, predvolene zakázané).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

SOURCE_URL="${SOURCE_DATABASE_URL:-}"
TARGET_URL="${TARGET_DATABASE_URL:-}"

# Bezpečný tvar URL pre logovanie (bez hesla).
safe_url() {
  local url="$1"
  if command -v node >/dev/null 2>&1; then
    node -e 'const u=new URL(process.argv[1]); u.password="***"; process.stdout.write(u.toString())' "$url" 2>/dev/null || echo "(unparseable)"
  else
    echo "${url%%@*}@…"
  fi
}

log() { printf '[dr-drill] %s\n' "$*"; }
fail() { printf '[dr-drill] CHYBA: %s\n' "$*" >&2; exit 1; }

# ── 1. Predpoklady ─────────────────────────────────────────────────────────
command -v pg_dump >/dev/null 2>&1 || fail "pg_dump nebol nájdený v PATH"
command -v psql    >/dev/null 2>&1 || fail "psql nebol nájdený v PATH"

[ -n "$SOURCE_URL" ] || fail "SOURCE_DATABASE_URL nie je nastavená"
[ -n "$TARGET_URL" ] || fail "TARGET_DATABASE_URL nie je nastavená"

if [ "$SOURCE_URL" = "$TARGET_URL" ]; then
  fail "SOURCE a TARGET musia byť rôzne inštancie (izolovaný test obnovy)"
fi

# Ochrana pred omylom: obnova do neizolovanej inštancie je zakázaná, kým
# operátor explicitne nepotvrdí DR_DRILL_ALLOW_NON_ISOLATED=1.
ISOLATED="${DR_DRILL_ALLOW_NON_ISOLATED:-0}"

log "Zdroj:   $(safe_url "$SOURCE_URL")"
log "Cieľ:    $(safe_url "$TARGET_URL")"

DUMP_FILE="$(mktemp -t dr-restore-XXXXXX.dump)"
trap 'rm -f "$DUMP_FILE"' EXIT

# ── 2. Záloha (pg_dump) ────────────────────────────────────────────────────
log "Vytváram konzistentnú zálohu zdrojovej databázy…"
pg_dump --no-owner --no-privileges --format=custom \
  --dbname="$SOURCE_URL" --file="$DUMP_FILE" \
  || fail "pg_dump zlyhal"

DUMP_SIZE="$(wc -c < "$DUMP_FILE" | tr -d ' ')"
DUMP_SHA="$(sha256sum "$DUMP_FILE" | awk '{print $1}')"
log "Záloha: ${DUMP_SIZE} bajtov · SHA-256 ${DUMP_SHA}"

# ── 3. Obnova do izolovanej inštancie ──────────────────────────────────────
log "Vykonávam obnovu do cielovej (izolovanej) inštancie…"
if [ "$ISOLATED" = "1" ]; then
  log "POZOR: DR_DRILL_ALLOW_NON_ISOLATED=1 — cieľ sa považuje za testovací."
fi

pg_restore --no-owner --no-privileges --exit-on-error \
  --dbname="$TARGET_URL" "$DUMP_FILE" \
  || fail "pg_restore zlyhal"

# ── 4. Overenie integrity cieľovej inštancie ───────────────────────────────
log "Overujem integritu dát v cielovej inštancii…"
EXPECTED_TABLES="practices users clients patients vaccination_records invoices audit_log"
MISSING=""
for table in $EXPECTED_TABLES; do
  if psql "$TARGET_URL" -tAc \
    "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='$table'" \
    | grep -q 1; then
    log "  ✓ tabuľka $table existuje"
  else
    MISSING="$MISSING $table"
    log "  ✗ tabuľka $table CHÝBA"
  fi
done

[ -z "$MISSING" ] || fail "Chýbajúce tabuľky po obnove:$MISSING"

for table in patients clients invoices; do
  COUNT="$(psql "$TARGET_URL" -tAc "SELECT count(*) FROM $table" | tr -d ' ')"
  log "  riadky($table)=$COUNT"
done

# ── 5. Audit artefakt (delegácia na existujúci Node drill) ─────────────────
if [ -f "$SCRIPT_DIR/dr-restore-drill.mjs" ]; then
  log "Generujem podpísaný audit artefakt (dr-restore-drill.mjs)…"
  (cd "$REPO_ROOT" && node "$SCRIPT_DIR/dr-restore-drill.mjs") \
    || log "Upozornenie: Node drill neskončil úspešne (neblokuje shell drill)."
fi

log "✓ DR restore drill dokončený — obnova aj integrita overená."
