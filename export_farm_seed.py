import subprocess, json
tables = [
    ("products", "sku LIKE 'VET-LA-%'"),
    ("services", "code LIKE 'HD-%'"),
    ("clients", "external_source = 'cehz_farm'"),
    ("patients", "species = 'bovine'"),
    ("appointments", "origin = 'field'"),
    ("soap_notes", "author_name = 'MVDr. Martin Sýkora' AND subjective LIKE '%Dojnica%'"),
    ("prescriptions", "medication_name IN ('Ubrolexin intramammárna suspenzia', 'Calciject 40 CM infúzia 500ml')"),
    ("invoices", "client_id IN (SELECT id FROM clients WHERE external_source = 'cehz_farm')"),
    ("invoice_items", "invoice_id IN (SELECT id FROM invoices WHERE client_id IN (SELECT id FROM clients WHERE external_source = 'cehz_farm'))"),
    ("ext_kvepis_submissions", "cehz_code IS NOT NULL AND submission_type = 'treatment_diary_batch'")
]
sql_commands = ["BEGIN;"]
for tbl, cond in tables:
    cmd = f'docker exec -i openvpm-postgres-1 psql -U openpims -d openvpm_ai -t -A -c "SELECT json_agg(t) FROM (SELECT * FROM {tbl} WHERE {cond}) t;"'
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    out = res.stdout.strip()
    if not out or out == "null": continue
    rows = json.loads(out)
    if not rows: continue
    cols = list(rows[0].keys())
    col_names = ", ".join(f'"{c}"' for c in cols)
    for r in rows:
        vals = []
        for c in cols:
            v = r[c]
            if v is None: vals.append("NULL")
            elif isinstance(v, (dict, list)): vals.append("'" + json.dumps(v).replace("'", "''") + "'::jsonb")
            elif isinstance(v, (int, float)): vals.append(str(v))
            elif isinstance(v, bool): vals.append("TRUE" if v else "FALSE")
            else: vals.append("'" + str(v).replace("'", "''") + "'")
        val_str = ", ".join(vals)
        sql_commands.append(f'INSERT INTO "{tbl}" ({col_names}) VALUES ({val_str}) ON CONFLICT DO NOTHING;')
sql_commands.append("COMMIT;")
with open("farm_seed.sql", "w", encoding="utf-8") as f:
    f.write("\n".join(sql_commands))
print(f"Generated farm_seed.sql with {len(sql_commands)} statements.")
