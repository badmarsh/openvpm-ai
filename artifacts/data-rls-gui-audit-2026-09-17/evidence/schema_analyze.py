#!/usr/bin/env python3
"""Static analyzer for the OpenVPM AI schema dump (schema.sql).

Reports: tables, columns, FK constraints, RLS enable/policy coverage,
tenant-column presence + nullability, index coverage on FK / tenant columns.
"""
import re
import sys
import json
from collections import defaultdict

PATH = sys.argv[1] if len(sys.argv) > 1 else "/home/user/audit/schema.sql"
sql = open(PATH, encoding="utf-8").read()

# strip psql meta-commands
# (pg_dump 16 wraps dumps in \\restrict / \\unrestrict)
clean = re.sub(r'(?m)^\\\\(un)?restrict .*$', '', sql)

# --------------------------------------------------------------- CREATE TABLE
tables = {}  # name -> {"cols": {col: definition}, "constraints": [...]}
tbl_re = re.compile(
    r"CREATE TABLE (?P<qname>(?:[\w\".]+))\s*\((?P<body>.*?)\n\);",
    re.S | re.M,
)

def split_top(s):
    parts, depth, cur, inq = [], 0, "", False
    for ch in s:
        if ch == '"':
            inq = not inq
        if not inq:
            if ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
            elif ch == ",":
                parts.append(cur.strip())
                cur = ""
                continue
        cur += ch
    if cur.strip():
        parts.append(cur.strip())
    return parts

for m in tbl_re.finditer(clean):
    name = m.group("qname").replace("public.", "").strip('"')
    body = m.group("body")
    cols, cons = {}, []
    for part in split_top(body):
        p = part.strip()
        low = p.lower()
        if low.startswith(("constraint ", "primary key", "foreign key", "unique (",
                           "check (", "exclude ")):
            cons.append(p)
        else:
            cm = re.match(r"^\"?(?P<col>\w+)\"?\s+(?P<rest>.*)$", p, re.S)
            if cm:
                cols[cm.group("col")] = " ".join(cm.group("rest").split())
    tables[name] = {"cols": cols, "cons": cons}

print(f"TABLES: {len(tables)}")

# ------------------------------------------------------------------ FK parsing
fks = defaultdict(list)   # table -> [{col, ref_table, ref_col, on_delete}]
fk_re = re.compile(
    r"FOREIGN KEY\s*\(\s*\"?(?P<lcol>\w+)\"?\s*\)\s*REFERENCES\s+"
    r"(?:(?P<rsch>\w+)\.)?\"?(?P<rtable>[\w]+)\"?\s*(?:\((?P<rcols>[^)]*)\))?"
    r"(?P<rest>[^,]*)",
    re.S,
)
for t, d in tables.items():
    for c in d["cons"]:
        for m in fk_re.finditer(c):
            fks[t].append({
                "col": m.group("lcol"),
                "rtable": m.group("rtable").replace("public.", ""),
                "rcols": (m.group("rcols") or "").strip(),
                "cascade": "ON DELETE CASCADE" in m.group("rest").upper(),
                "restrict": "ON DELETE RESTRICT" in m.group("rest").upper(),
                "setnull": "ON DELETE SET NULL" in m.group("rest").upper(),
                "noaction": "ON DELETE NO ACTION" in m.group("rest").upper(),
                "deferrable": "DEFERRABLE" in m.group("rest").upper(),
            })

# ------------------------------------------------- inline column REFERENCES (id references "x"(y))
inline_ref_re = re.compile(r"^\w+\s+uuid\b.*\breferences\s+\"?(?P<r>\w+)\"?", re.I | re.S)

# ------------------------------------------------------------------- ALTER FK
alt_fk_re = re.compile(
    r"ALTER TABLE ONLY (?:(?P<sch>\w+)\.)?\"?(?P<t>\w+)\"?\s+ADD CONSTRAINT \"?(?P<name>\w+)\"? "
    r"FOREIGN KEY \(\"?(?P<lcol>\w+)\"?\)\s+REFERENCES (?:(?P<rsch>\w+)\.)?\"?(?P<rtable>\w+)\"?"
    r"(?:\s*\((?P<rcols>[^)]*)\))?(?P<rest>[^;]*)",
    re.S,
)
alter_fks = defaultdict(list)
for m in alt_fk_re.finditer(clean):
    t = m.group("t")
    alter_fks[t].append({
        "col": m.group("lcol"),
        "rtable": m.group("rtable"),
        "rcols": (m.group("rcols") or "").strip(),
        "cascade": "ON DELETE CASCADE" in m.group("rest").upper(),
        "restrict": "ON DELETE RESTRICT" in m.group("rest").upper(),
        "setnull": "ON DELETE SET NULL" in m.group("rest").upper(),
        "noaction": "ON DELETE NO ACTION" in m.group("rest").upper(),
    })
for t, v in alter_fks.items():
    fks[t].extend(v)

# ------------------------------------------------------------------ RLS stuff
rls_on = set(m.group(1) for m in re.finditer(
    r"ALTER TABLE (?:ONLY )?public\.(\w+) ENABLE ROW LEVEL SECURITY", clean))
rls_forced = set(m.group(1) for m in re.finditer(
    r"ALTER TABLE (?:ONLY )?public\.(\w+) FORCE ROW LEVEL SECURITY", clean))
rls_off = set(m.group(1) for m in re.finditer(
    r"ALTER TABLE (?:ONLY )?public\.(\w+) DISABLE ROW LEVEL SECURITY", clean))

pol_re = re.compile(
    r"CREATE POLICY \"?(?P<name>[\w]+)\"? ON (?:public\.)?\"?(?P<t>\w+)\"?(?:\s+AS (?P<as>\w+))?"
    r"(?:\s+FOR (?P<for>\w+))?(?:\s+TO (?P<to>[\w,\s]+?))?\s*USING \((?P<using>.*?)\)"
    r"(?:\s*WITH CHECK \((?P<check>.*?)\))?\s*;",
    re.S,
)
policies = defaultdict(list)
for m in pol_re.finditer(clean):
    policies[m.group("t")].append({
        "name": m.group("name"),
        "for": (m.group("for") or "ALL").upper(),
        "as": (m.group("as") or "PERMISSIVE").upper(),
        "to": (m.group("to") or "public").strip(),
        "using": " ".join((m.group("using") or "").split()),
        "check": " ".join((m.group("check") or "").split()),
    })

# --------------------------------------------------------------------- indexes
idx_re = re.compile(
    r"CREATE (?:UNIQUE )?INDEX \w+ ON (?:public\.)?\"?(?P<t>\w+)\"? USING \w+ \((?P<cols>.*?)\)(?:\s*WHERE (?P<pred>.*?))?(?:\n;|;)",
    re.S,
)
indexes = defaultdict(list)
for m in idx_re.finditer(clean):
    cols = [c.strip().strip('"').split("(")[0].split()[0].strip()
            for c in re.split(r",(?![^(]*\))", m.group("cols"))]
    indexes[m.group("t")].append({"cols": cols, "pred": (m.group("pred") or "").strip()})

uniq = defaultdict(list)
for m in re.finditer(r"CREATE UNIQUE INDEX (\w+) ON (?:public\.)?\"?(\w+)\"? USING \w+ \((.*?)\)", clean, re.S):
    uniq[m.group(2)].append({"name": m.group(1), "cols": m.group(3)})

# ------------------------------------------------------------ tenant analysis
TENANT_COL = "practice_id"
tenant_tables, no_tenant = [], []
for t, d in tables.items():
    if TENANT_COL in d["cols"]:
        defn = d["cols"][TENANT_COL]
        nn = "NOT NULL" in defn.upper()
        fk = any(f["col"] == TENANT_COL for f in fks.get(t, []))
        tenant_tables.append((t, nn, fk, t in rls_on, defn))
    else:
        no_tenant.append(t)

print(f"RLS ENABLE: {len(rls_on)}   RLS FORCED: {len(rls_forced)}   POLICIES: {sum(len(v) for v in policies.values())}")
print(f"TABLES with {TENANT_COL}: {len(tenant_tables)}  (NOT NULL: {sum(1 for x in tenant_tables if x[1])}, FK: {sum(1 for x in tenant_tables if x[2])})")

print("\n### A) Tables WITHOUT practice_id column (must be intentionally un-tenanted):")
for t in sorted(no_tenant):
    print(f"   - {t}  (RLS={'on' if t in rls_on else 'off'}, rows-safe={'?'})")

print("\n### B) tenant tables WITHOUT RLS enabled  [P0 SECURITY]:")
bad = [x for x in tenant_tables if not x[3]]
for t, nn, fk, _, defn in sorted(bad):
    print(f"   - {t}  practice_id {'NOT NULL' if nn else 'NULLABLE'}{' FK' if fk else ' NO-FK'}")
if not bad:
    print("   (none)")

print("\n### C) tenant tables WITH RLS but NO policy defined  [deny-all / broken app]:")
bad2 = [t for t, *_ in tenant_tables if t in rls_on and not policies.get(t)]
for t in sorted(bad2):
    print(f"   - {t}")
if not bad2:
    print("   (none)")

print("\n### D) tenant tables with practice_id NULLABLE  [tenant-leak risk]:")
for t, nn, fk, r, defn in sorted(tenant_tables):
    if not nn:
        print(f"   - {t}  (RLS={'on' if r else 'off'}, FK={'yes' if fk else 'NO'})  :: {defn[:80]}")

print("\n### E) tenant tables where practice_id has NO FOREIGN KEY to practices:")
for t, nn, fk, r, defn in sorted(tenant_tables):
    if not fk:
        print(f"   - {t}  (NOT NULL={nn}, RLS={'on' if r else 'off'})")

print("\n### F) RLS policies that are NOT the tenant_isolation pattern (review):")
for t, plist in sorted(policies.items()):
    for p in plist:
        if "practice_id" not in p["using"]:
            print(f"   - {t}.{p['name']} FOR {p['for']} TO {p['to']}\n       USING: {p['using'][:150]}")

print("\n### G) policy command coverage (tables missing INSERT/UPDATE/DELETE policy):")
for t, plist in sorted(policies.items()):
    cmds = set(p["for"] for p in plist)
    if "ALL" in cmds:
        continue
    missing = {"SELECT", "INSERT", "UPDATE", "DELETE"} - cmds
    if missing:
        print(f"   - {t}: has {sorted(cmds)}, MISSING {sorted(missing)}")

print("\n### H) tables with ROW SECURITY enabled but not FORCED (owner bypasses RLS):")
print(f"   forced={len(rls_forced)} of {len(rls_on)} enabled")
notforced = sorted(t for t in rls_on if t not in rls_forced)
print(f"   first 10 not-forced: {notforced[:10]}")

# -------------------------------------------------- FK integrity: orphans by design
print("\n### I) FK columns that are NULLABLE (potential orphans by design):")
for t, d in sorted(tables.items()):
    null_fk = []
    for f in fks.get(t, []):
        c = d["cols"].get(f["col"], "")
        if "NOT NULL" not in c.upper():
            null_fk.append(f["col"] + ("[SET NULL]" if f["setnull"] else ""))
    if null_fk:
        print(f"   - {t}: {', '.join(sorted(set(null_fk)))}")

print("\n### J) critical clinical tables - key columns present?")
CRIT = {
    "patients": ["client_id", "practice_id", "species", "status", "deleted_at"],
    "clients": ["practice_id", "first_name", "last_name", "email", "phone"],
    "appointments": ["patient_id", "practice_id", "status", "scheduled_at", "started_at", "ended_at"],
    "soap_notes": ["patient_id", "practice_id", "appointment_id", "encounter_id"],
    "records": [],
    "invoices": ["practice_id", "client_id", "appointment_id", "status", "total"],
    "products": ["practice_id", "name", "sku", "stock"],
}
for t, cols in CRIT.items():
    if t not in tables:
        print(f"   !! TABLE MISSING IN SCHEMA: {t}")
        continue
    have = tables[t]["cols"]
    miss = [c for c in cols if c not in have]
    print(f"   - {t}: missing {miss if miss else 'nothing'} | total cols {len(have)}")

# dump json for reuse
json.dump({
    "tables": sorted(tables),
    "rls_on": sorted(rls_on),
    "rls_forced": sorted(rls_forced),
    "policies": {k: v for k, v in policies.items()},
    "fks": {k: v for k, v in fks.items()},
    "indexes": {k: v for k, v in indexes.items()},
    "tenant_tables": [{"t": t, "notnull": nn, "fk": fk, "rls": r} for t, nn, fk, r, _ in tenant_tables],
    "no_tenant": sorted(no_tenant),
}, open("/home/user/audit/schema-index.json", "w"), indent=1)
print("\n[written /home/user/audit/schema-index.json]")
