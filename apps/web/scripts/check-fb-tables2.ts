/**
 * check-fb-tables2.ts – verifies TAB045/TAB047 column names
 */
import { fbQuery, withFirebird } from '../lib/import/vetsoftware-v2-extractor';

async function main() {
  await withFirebird(async (db) => {
    console.log('\n── TAB045 columns ──');
    const tab045 = await fbQuery<any>(db,
      "SELECT r.RDB$FIELD_NAME FROM RDB$RELATION_FIELDS r WHERE r.RDB$RELATION_NAME = 'TAB045' ORDER BY r.RDB$FIELD_POSITION"
    );
    console.log(tab045.map((r: any) => Object.values(r)[0]).join(', '));

    console.log('\n── TAB045 FIRST 1 row ──');
    const s45 = await fbQuery<any>(db, 'SELECT FIRST 1 * FROM TAB045');
    console.log(JSON.stringify(s45, null, 2));

    console.log('\n── TAB047 columns ──');
    const tab047 = await fbQuery<any>(db,
      "SELECT r.RDB$FIELD_NAME FROM RDB$RELATION_FIELDS r WHERE r.RDB$RELATION_NAME = 'TAB047' ORDER BY r.RDB$FIELD_POSITION"
    );
    console.log(tab047.map((r: any) => Object.values(r)[0]).join(', '));

    console.log('\n── TAB047 FIRST 1 row ──');
    const s47 = await fbQuery<any>(db, 'SELECT FIRST 1 * FROM TAB047');
    console.log(JSON.stringify(s47, null, 2));

    // TAB058 columns
    console.log('\n── TAB058 columns ──');
    const tab058 = await fbQuery<any>(db,
      "SELECT r.RDB$FIELD_NAME FROM RDB$RELATION_FIELDS r WHERE r.RDB$RELATION_NAME = 'TAB058' ORDER BY r.RDB$FIELD_POSITION"
    );
    console.log(tab058.map((r: any) => Object.values(r)[0]).join(', '));

    console.log('\n── TAB058 FIRST 1 row (no blobs) ──');
    const s58 = await fbQuery<any>(db, 'SELECT FIRST 1 ID_OBR, ID_PAC, NAZEV, DNE, POPIS FROM TAB058');
    console.log(JSON.stringify(s58, null, 2));

    // TAB059 columns
    console.log('\n── TAB059 columns ──');
    const tab059 = await fbQuery<any>(db,
      "SELECT r.RDB$FIELD_NAME FROM RDB$RELATION_FIELDS r WHERE r.RDB$RELATION_NAME = 'TAB059' ORDER BY r.RDB$FIELD_POSITION"
    );
    console.log(tab059.map((r: any) => Object.values(r)[0]).join(', '));
  });
}

main().catch(console.error);
