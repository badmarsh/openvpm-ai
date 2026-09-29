# Database Backup — Prevádzkový runbook (Serverové PostgreSQL)

> **Doplnok k:** `docs/backup-restore-runbook.md` (JSON application-level backup)  
> Tento dokument pokrýva **pg_dump zálohy produkčného PostgreSQL** na `dev.significa.sk`.

---

## Čo sa zálohuje

| Čo | Detail |
|---|---|
| **Databáza** | `openpims` v kontajneri `openvpm-postgres-cfoqxx` |
| **Formát** | `pg_dump -Fc -Z9` (custom compressed, plne obnoviteľný cez `pg_restore`) |
| **Umiestnenie** | `/var/backups/openvpm/` na serveri `dev.significa.sk` |
| **Retenčná politika** | 14 denných + 4 týždenné (nedeľa) zálohy |

---

## Cron schedule

```
0 2 * * * /usr/local/bin/openvpm-backup.sh >> /var/log/openvpm-backup.log 2>&1
```

Spúšťa sa každý deň o **02:00 UTC** (04:00 CEST / 03:00 CET).  
Logy: `/var/log/openvpm-backup.log` na serveri.

---

## Ručný backup

```bash
ssh root@dev.significa.sk "bash /usr/local/bin/openvpm-backup.sh"
```

---

## Overenie zálohy

```bash
# Zoznam záloh
ssh root@dev.significa.sk "ls -lh /var/backups/openvpm/"

# Logy posledného behu
ssh root@dev.significa.sk "tail -20 /var/log/openvpm-backup.log"
```

---

## Obnova (pg_restore)

```bash
# 1. Skopíruj dump zo servera
scp root@dev.significa.sk:/var/backups/openvpm/openpims_YYYY-MM-DD_HHMMSS_daily.dump ./restore.dump

# 2. Obnov do cieľovej DB (POZOR: prepíše existujúce dáta)
PGCTR=$(docker ps -q -f name=openvpm-postgres-cfoqxx)
docker exec -i "$PGCTR" pg_restore -U openpims -d openpims --clean --if-exists < restore.dump

# 3. Overenie
docker exec "$PGCTR" psql -U openpims -d openpims -c "SELECT COUNT(*) FROM patients;"
```

> ⚠️ Pre produkčnú obnovu vždy najprv otestuj v testovacej DB. Príkaz `--clean` maže existujúce objekty pred obnovením.

---

## Skript na serveri

Súbor: `/usr/local/bin/openvpm-backup.sh`

Skript automaticky:
1. Nájde kontajner `openvpm-postgres-cfoqxx` dynamicky (odolný voči reštartom)
2. Vytvorí dump s kompresiou level 9
3. Označí zálohu ako `_daily` alebo `_weekly` (nedeľa)
4. Rotuje: ponechá max 14 denných a 4 týždenné

---

## História

| Dátum | Udalosť |
|---|---|
| 2026-09-21 | Prvý ručný backup (7.6 MB), inštalácia cronu, otestovaný pg_restore flow |

