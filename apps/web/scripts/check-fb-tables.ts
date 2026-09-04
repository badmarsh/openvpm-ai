/**
 * check-fb-tables.ts – overí stĺpce TAB066, TAB019, TAB045
 */
import { fbQuery, withFirebird } from '../lib/import/vetsoftware-v2-extractor';

async function main() {
  await withFirebird(async (db) => {
    // TAB066 – položky faktúr
    console.log('\n── TAB066 columns ──');
    const tab066 = await fbQuery<any>(db,
      "SELECT r.RDB$FIELD_NAME FROM RDB$RELATION_FIELDS r WHERE r.RDB$RELATION_NAME = 'TAB066' ORDER BY r.RDB$FIELD_POSITION"
    );
    console.log(tab066.map((r: any) => Object.values(r)[0]).join(', '));

    // TAB066 sample
    console.log('\n── TAB066 FIRST 2 rows ──');
    const s66 = await fbQuery<any>(db, 'SELECT FIRST 2 * FROM TAB066');
    console.log(JSON.stringify(s66, null, 2));

    // TAB019 – odčervenia
    console.log('\n── TAB019 columns ──');
    const tab019 = await fbQuery<any>(db,
      "SELECT r.RDB$FIELD_NAME FROM RDB$RELATION_FIELDS r WHERE r.RDB$RELATION_NAME = 'TAB019' ORDER BY r.RDB$FIELD_POSITION"
    );
    console.log(tab019.map((r: any) => Object.values(r)[0]).join(', '));

    // TAB019 count
    const cnt019 = await fbQuery<any>(db, 'SELECT COUNT(*) CNT FROM TAB019 WHERE KP42 > 0');
    console.log('TAB019 count:', cnt019[0]?.CNT);

    // TAB045 – lab
    console.log('\n── TAB045 columns ──');
    const tab045 = await fbQuery<any>(db,
      "SELECT r.RDB$FIELD_NAME FROM RDB$RELATION_FIELDS r WHERE r.RDB$RELATION_NAME = 'TAB045' ORDER BY r.RDB$FIELD_POSITION"
    );
    console.log(tab045.map((r: any) => Object.values(r)[0]).join(', '));

    const cnt045 = await fbQuery<any>(db, 'SELECT COUNT(*) CNT FROM TAB045');
    console.log('TAB045 count:', cnt045[0]?.CNT);

    // TAB058 + TAB059 join
    console.log('\n── TAB058 count ──');
    const cnt058 = await fbQuery<any>(db, 'SELECT COUNT(*) CNT FROM TAB058 WHERE VYMAZ = 0 OR VYMAZ IS NULL');
    console.log('TAB058 count:', cnt058[0]?.CNT);
  });
}

main().catch(console.error);
