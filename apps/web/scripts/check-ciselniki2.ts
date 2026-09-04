/**
 * check-ciselniki2.ts
 * Detailne skúma číselníky s reálnymi dátami (TAB024 lab parametre, TAB033 vakcíny, TAB026 cenník, TAB029 termíny)
 */
import { fbQuery, decodeWin1250, withFirebird } from '../lib/import/vetsoftware-v2-extractor';

async function main() {
  await withFirebird(async (db) => {

    // TAB033 – toto je ČÍSELNÍK VAKCÍN (nie DPH!) – KOD_VAKCIN, NAZEV_VAKCIN, POZN_VAKCIN=intervalDni
    console.log('\n══ TAB033 – Číselník vakcín (zobraziť všetky) ══');
    const vakciny = await fbQuery<any>(db, 'SELECT KOD_VAKCIN, NAZEV_VAKCIN, POZN_VAKCIN FROM TAB033 WHERE VYMAZ = 0 ORDER BY KOD_VAKCIN');
    for (const v of vakciny) {
      console.log(`  ${String(v.KOD_VAKCIN).padStart(3)}: ${decodeWin1250(v.NAZEV_VAKCIN).padEnd(35)} interval=${v.POZN_VAKCIN} dní`);
    }

    // TAB024 – mená lab parametrov (NAZEV=názov, MJ=jednotka, ID_UKAZ=ID)
    console.log('\n══ TAB024 – Laboratórne parametre (názvy + jednotky) ══');
    const labParams = await fbQuery<any>(db, 'SELECT ID_UKAZ, NAZEV, MJ FROM TAB024 WHERE VYMAZ = 0 ORDER BY ID_UKAZ');
    for (const p of labParams) {
      console.log(`  ID_UKAZ=${String(p.ID_UKAZ).padStart(3)}: ${decodeWin1250(p.NAZEV).padEnd(25)} [${decodeWin1250(p.MJ)}]`);
    }

    // TAB023 – referenčné rozsahy (ID_UKAZ, ID_ZVIRE, MINH, MAXH)
    // ID_ZVIRE: 1=pes, 2=mačka? – overíme z TAB007
    console.log('\n══ TAB023 – Referenčné rozsahy lab. parametrov ══');
    const ranges = await fbQuery<any>(db, 'SELECT ID_UKAZ, ID_ZVIRE, MINH, MAXH FROM TAB023 WHERE VYMAZ = 0 ORDER BY ID_UKAZ, ID_ZVIRE ROWS 20');
    for (const r of ranges) {
      const param = labParams.find((p: any) => p.ID_UKAZ === r.ID_UKAZ);
      const paramName = param ? decodeWin1250(param.NAZEV) : `ID=${r.ID_UKAZ}`;
      const species = r.ID_ZVIRE === 1 ? 'pes' : r.ID_ZVIRE === 2 ? 'macka' : `druh=${r.ID_ZVIRE}`;
      console.log(`  ${paramName.padEnd(25)} [${species}]: ${r.MINH} – ${r.MAXH}`);
    }

    // TAB029 – OBJEDNÁVKY / termíny (nie skupiny zvierat!) – ID_PACIENTA, DATUMO, CASD, CASO, ID_KLIENT
    console.log('\n══ TAB029 – Objednávky / termíny ══');
    const orders = await fbQuery<any>(db, 'SELECT COUNT(*) CNT FROM TAB029 WHERE VYMAZ = 0 OR VYMAZ IS NULL');
    const orderSample = await fbQuery<any>(db, 'SELECT FIRST 3 * FROM TAB029 WHERE VYMAZ = 0 OR VYMAZ IS NULL');
    console.log(`  Celkom aktívnych: ${orders[0].CNT}`);
    for (const o of orderSample) {
      console.log(`  ID=${o.ID_OBJ}, pacient=${o.ID_PACIENTA}, dátum=${o.DATUMO?.toISOString?.()?.slice(0,10)}, od=${o.CASO} do=${o.CASD}, lek=${decodeWin1250(o.ORDINOVAL)}`);
    }

    // TAB026 – problémy/diagnózy (nie cenník!) – KOD_PROBLEMU, NAZEV_PROBLEMU
    console.log('\n══ TAB026 – Problémy / Diagnózy (číselník) ══');
    const diagCnt = await fbQuery<any>(db, 'SELECT COUNT(*) CNT FROM TAB026 WHERE VYMAZ = 0 AND TRIM(NAZEV_PROBLEMU) <> \'\'');
    const diagSample = await fbQuery<any>(db, 'SELECT FIRST 10 KOD_PROBLEMU, NAZEV_PROBLEMU FROM TAB026 WHERE VYMAZ = 0 AND TRIM(NAZEV_PROBLEMU) <> \'\' ORDER BY KOD_PROBLEMU');
    console.log(`  Celkom diagnóz/problémov: ${diagCnt[0].CNT}`);
    for (const d of diagSample) {
      console.log(`  ${String(d.KOD_PROBLEMU).padStart(3)}: ${decodeWin1250(d.NAZEV_PROBLEMU)}`);
    }

    // TAB007 – pohlavia (NAZEV=pohlavie)
    console.log('\n══ TAB007 – Pohlavia ══');
    const sex = await fbQuery<any>(db, 'SELECT NAZEV, NAZEVL FROM TAB007 WHERE VYMAZ = 0');
    for (const s of sex) {
      if (s.NAZEV) console.log(`  ${decodeWin1250(s.NAZEV)} / ${decodeWin1250(s.NAZEVL)}`);
    }

    // TAB003 – toto nie je species ale AUDIT LOG (KOD_ZAPISU = session log)
    console.log('\n══ TAB003 – Audit log / sessions (prvé 3) ══');
    const sessions = await fbQuery<any>(db, 'SELECT FIRST 3 KOD_ZAPISU, JMENO, STATUS FROM TAB003 ORDER BY KOD_ZAPISU');
    for (const s of sessions) {
      console.log(`  ${s.KOD_ZAPISU}: ${decodeWin1250(s.JMENO)}, status=${s.STATUS}`);
    }

    // TAB063 – mapa číselníkov (aké sú reálne číselníky)
    console.log('\n══ TAB063 – Slovník tabuliek (číselníky) ══');
    const dict = await fbQuery<any>(db, 'SELECT KOD_TAB, NAZEV_COMBO, NAZEV_DATAB FROM TAB063 WHERE VYMAZ = 0 ORDER BY KOD_TAB');
    for (const d of dict) {
      console.log(`  ${String(d.KOD_TAB).padStart(3)}: ${decodeWin1250(d.NAZEV_COMBO).padEnd(30)} → ${d.NAZEV_DATAB}`);
    }
  });
}

main().catch(console.error);
