import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and } from "drizzle-orm";
import * as schema from "./schema";
import {
  practices,
  patients,
  clients,
  users,
  locations,
  rooms,
  appointmentTypes,
  appointments,
} from "./schema";

const DB_URL =
  process.env.DATABASE_URL ??
  "postgresql://openpims:openpims@127.0.0.1:5434/openvpm_ai";

async function main() {
  console.log("📅 Spúšťam generovanie komplexných demo termínov pre /schedule...");

  const client = postgres(DB_URL);
  const db = drizzle(client, { schema });

  try {
    const allPractices = await db.select().from(practices);
    console.log(`Nájdené praxe (${allPractices.length}):`, allPractices.map((p) => `${p.name} [${p.id}]`));

    for (const practice of allPractices) {
      const practiceId = practice.id;
      console.log(`\n========================================`);
      console.log(`🏥 Spracovávam prax: ${practice.name} (${practiceId})`);

      // 1. Získaj lokáciu a miestnosti
      const practiceLocations = await db
        .select()
        .from(locations)
        .where(eq(locations.practiceId, practiceId));

      const location = practiceLocations[0];
      if (!location) {
        console.warn(`⚠️ Žiadna pobočka/lokácia pre ${practice.name}, preskakujem.`);
        continue;
      }

      const practiceRooms = await db
        .select()
        .from(rooms)
        .where(and(eq(rooms.practiceId, practiceId), eq(rooms.locationId, location.id)));

      const room1 = practiceRooms[0];
      const room2 = practiceRooms[1] ?? room1;
      const room3 = practiceRooms[2] ?? room2;

      // 2. Získaj lekárov
      const staffList = await db
        .select()
        .from(users)
        .where(eq(users.practiceId, practiceId));

      const vets = staffList.filter((u) => u.role === "veterinarian" || u.role === "admin");
      const doc1 = vets[0];
      const doc2 = vets[1] ?? doc1;
      const doc3 = vets[2] ?? doc1;

      if (!doc1) {
        console.warn(`⚠️ Žiaden lekár pre ${practice.name}, preskakujem.`);
        continue;
      }

      // 3. Získaj typy termínov
      const types = await db
        .select()
        .from(appointmentTypes)
        .where(eq(appointmentTypes.practiceId, practiceId));

      const surgeryType = types.find((t) => t.name.toLowerCase().includes("chirurg") || t.name.toLowerCase().includes("surg")) ?? types[0];
      const checkupType = types.find((t) => t.name.toLowerCase().includes("kontrol") || t.name.toLowerCase().includes("recheck")) ?? types[0];
      const wellnessType = types.find((t) => t.name.toLowerCase().includes("prevent") || t.name.toLowerCase().includes("well")) ?? types[0];
      const vaccineType = types.find((t) => t.name.toLowerCase().includes("vakcin") || t.name.toLowerCase().includes("vacc")) ?? types[0];
      const sickType = types.find((t) => t.name.toLowerCase().includes("chor") || t.name.toLowerCase().includes("sick") || t.name.toLowerCase().includes("exam")) ?? types[0];
      const dentalType = types.find((t) => t.name.toLowerCase().includes("zub") || t.name.toLowerCase().includes("dent")) ?? types[0];

      // 4. Získaj pacientov
      const patientList = await db
        .select()
        .from(patients)
        .where(eq(patients.practiceId, practiceId))
        .limit(20);

      if (patientList.length === 0) {
        console.warn(`⚠️ Žiadni pacienti pre ${practice.name}, preskakujem.`);
        continue;
      }

      console.log(`  ✓ Lokácia: ${location.name}`);
      console.log(`  ✓ Miestnosti (${practiceRooms.length}): ${practiceRooms.map((r) => r.name).join(", ")}`);
      console.log(`  ✓ Lekári: ${vets.map((v) => v.name).join(", ")}`);
      console.log(`  ✓ Pacienti: ${patientList.length} dostupných`);

      // Pomocná funkcia na vytvorenie dátumu v stredoeurópskom čase (UTC+2 v lete)
      // Reference date: Saturday September 5, 2026
      const refYear = 2026;
      const refMonth = 8; // September (0-indexed)
      const refDay = 5;

      const makeInstant = (dayOffset: number, hour: number, minute: number): Date => {
        // dayOffset 0 = 2026-09-05 (Today)
        // dayOffset -1 = 2026-09-04 (Yesterday)
        // dayOffset +2 = 2026-09-07 (Next Monday)
        const d = new Date(Date.UTC(refYear, refMonth, refDay + dayOffset, hour - 2, minute, 0)); // UTC+2 local time conversion
        return d;
      };

      const newAppointments: Array<{
        practiceId: string;
        locationId: string;
        startTime: Date;
        endTime: Date;
        typeId: string;
        patientId: string;
        clientId: string;
        doctorId: string | null;
        roomId: string | null;
        status: "scheduled" | "confirmed" | "checked_in" | "in_exam" | "checked_out" | "no_show" | "cancelled";
        origin: "scheduled" | "field";
        notes: string;
      }> = [];

      let patIdx = 0;
      const nextPatient = () => {
        const p = patientList[patIdx % patientList.length]!;
        patIdx++;
        return p;
      };

      // ───────────────────────────────────────────────────────────────────────
      // A. DNES: Sobota 5. september 2026 (Day View busy schedule)
      // ───────────────────────────────────────────────────────────────────────
      const todaySlots = [
        {
          startH: 8, startM: 15, durM: 30,
          type: wellnessType,
          doc: doc1, room: room1,
          status: "checked_out" as const,
          origin: "scheduled" as const,
          notes: "Ranná preventívna prehliadka pred víkendom. Odčervenie Caniquantel a kontrola uší.",
        },
        {
          startH: 8, startM: 45, durM: 45,
          type: sickType,
          doc: doc2, room: room2,
          status: "checked_out" as const,
          origin: "scheduled" as const,
          notes: "Akútny príchod ráno: Pes v noci opakovane zvracal žlč, slabosť. Aplikovaný Cerenia + infúzia.",
        },
        {
          startH: 9, startM: 0, durM: 60,
          type: surgeryType,
          doc: doc1, room: room1,
          status: "checked_out" as const,
          origin: "scheduled" as const,
          notes: "Plánovaná sterilizácia mačky (ovariohysterektómia). Inhalačná anestézia Isofluran, hladký priebeh.",
        },
        {
          startH: 9, startM: 30, durM: 30,
          type: vaccineType,
          doc: doc2, room: room2,
          status: "checked_in" as const,
          origin: "scheduled" as const,
          notes: "Rezervácia cez online portál: Pravidelné očkovanie Biocan DHPPi+L. Majiteľ sedí v čakárni.",
        },
        {
          startH: 10, startM: 0, durM: 45,
          type: dentalType,
          doc: doc3, room: room3,
          status: "in_exam" as const,
          origin: "scheduled" as const,
          notes: "Stomatologické ošetrenie: Odstránenie masívneho zubného kameňa ultrazvukom a leštenie zubov.",
        },
        {
          startH: 10, startM: 15, durM: 30,
          type: checkupType,
          doc: doc1, room: room1,
          status: "confirmed" as const,
          origin: "scheduled" as const,
          notes: "Pooperačná kontrola rany po laparotómii, vybratie kožných svoriek.",
        },
        {
          startH: 11, startM: 0, durM: 30,
          type: sickType,
          doc: doc2, room: room2,
          status: "confirmed" as const,
          origin: "scheduled" as const,
          notes: "Dermatologické vyšetrenie: Výrazný pruritus na labkách a bruchu, podozrenie na atopickú dermatitídu.",
        },
        {
          startH: 11, startM: 30, durM: 30,
          type: vaccineType,
          doc: null, room: room2, // Team lane (sestričky)
          status: "confirmed" as const,
          origin: "scheduled" as const,
          notes: "Aplikácia booster vakcíny technikom + ostrihanie pazúrikov.",
        },
        {
          startH: 12, startM: 30, durM: 30,
          type: checkupType,
          doc: doc1, room: room1,
          status: "scheduled" as const,
          origin: "scheduled" as const,
          notes: "Kontrolné meranie krvného tlaku Dopplerom pri chronickom ochorení obličiek.",
        },
        {
          startH: 13, startM: 0, durM: 30,
          type: wellnessType,
          doc: doc3, room: room3,
          status: "scheduled" as const,
          origin: "scheduled" as const,
          notes: "Vstupné vyšetrenie nového šteniatka, čipovanie (ISO mikročip) a vystavenie PET pasu.",
        },
        {
          startH: 13, startM: 30, durM: 45,
          type: sickType,
          doc: doc1, room: room1,
          status: "scheduled" as const,
          origin: "scheduled" as const,
          notes: "Nahlásený úraz: Kulhanie po páde zo schodov. Pripraviť RTG digitálny stôl.",
        },
        {
          startH: 14, startM: 15, durM: 30,
          type: vaccineType,
          doc: doc2, room: room2,
          status: "scheduled" as const,
          origin: "scheduled" as const,
          notes: "Revakcinácia králikov proti moru a myxomatóze (Pestorin Mormyx).",
        },
      ];

      for (const slot of todaySlots) {
        const start = makeInstant(0, slot.startH, slot.startM);
        const end = new Date(start.getTime() + slot.durM * 60 * 1000);
        const pat = nextPatient();

        newAppointments.push({
          practiceId,
          locationId: location.id,
          startTime: start,
          endTime: end,
          typeId: slot.type.id,
          patientId: pat.id,
          clientId: pat.clientId!,
          doctorId: slot.doc?.id ?? null,
          roomId: slot.room?.id ?? null,
          status: slot.status,
          origin: slot.origin,
          notes: slot.notes,
        });
      }

      // ───────────────────────────────────────────────────────────────────────
      // B. MINULÝ TÝŽDEŇ (Pondelok 31.8. až Piatok 4.9.) - História v kalendári
      // ───────────────────────────────────────────────────────────────────────
      const pastDaysOffsets = [-5, -4, -3, -2, -1]; // Po, Ut, St, Št, Pi
      for (const dayOffset of pastDaysOffsets) {
        // Každý deň 4 termíny
        const times = [
          { h: 8, m: 30, dur: 30, type: vaccineType, doc: doc1, st: "checked_out" as const, notes: "Pravidelné očkovanie a klinické vyšetrenie." },
          { h: 10, m: 0, dur: 60, type: surgeryType, doc: doc1, st: "checked_out" as const, notes: "Chirurgia mäkkých tkanív, úspešný zákrok." },
          { h: 11, m: 30, dur: 30, type: sickType, doc: doc2, st: "checked_out" as const, notes: "Klinické vyšetrenie a odber krvi na hematológiu." },
          { h: 14, m: 0, dur: 15, type: checkupType, doc: doc2, st: dayOffset === -2 ? ("no_show" as const) : ("checked_out" as const), notes: "Kontrola stavu pacienta po liečbe." },
          { h: 15, m: 0, dur: 45, type: dentalType, doc: doc3, st: dayOffset === -4 ? ("cancelled" as const) : ("checked_out" as const), notes: "Dentálna hygiena." },
        ];

        for (const slot of times) {
          const start = makeInstant(dayOffset, slot.h, slot.m);
          const end = new Date(start.getTime() + slot.dur * 60 * 1000);
          const pat = nextPatient();

          newAppointments.push({
            practiceId,
            locationId: location.id,
            startTime: start,
            endTime: end,
            typeId: slot.type.id,
            patientId: pat.id,
            clientId: pat.clientId!,
            doctorId: slot.doc.id,
            roomId: room1?.id ?? null,
            status: slot.st,
            origin: "scheduled",
            notes: slot.notes,
          });
        }
      }

      // ───────────────────────────────────────────────────────────────────────
      // C. BUDÚCI TÝŽDEŇ (Pondelok 7.9. až Piatok 11.9.) - Nadchádzajúci rozvrh
      // ───────────────────────────────────────────────────────────────────────
      const nextDaysOffsets = [2, 3, 4, 5, 6]; // Po, Ut, St, Št, Pi
      for (const dayOffset of nextDaysOffsets) {
        const nextTimes = [
          { h: 8, m: 30, dur: 30, type: wellnessType, doc: doc1, st: "confirmed" as const, notes: "Preventívna prehliadka pred cestou do zahraničia." },
          { h: 9, m: 30, dur: 60, type: surgeryType, doc: doc1, st: "confirmed" as const, notes: "Plánovaná kastrácia kocúra, predoperačné hladovanie dodržané." },
          { h: 11, m: 0, dur: 30, type: sickType, doc: doc2, st: "scheduled" as const, notes: "Kontrola chronického kašľa, kontrolný RTG hrudníka." },
          { h: 13, m: 15, dur: 30, type: vaccineType, doc: doc3, st: "scheduled" as const, notes: "Vakcinácia Versican Plus DHPPi/L4." },
          { h: 14, m: 30, dur: 45, type: dentalType, doc: doc2, st: "scheduled" as const, notes: "Extrakcia perzistentných mliečnych očných zubov." },
          { h: 16, m: 0, dur: 30, type: checkupType, doc: doc1, st: "scheduled" as const, notes: "Kontrola hojenia rohovkového vredu (Fluoresceínový test)." },
        ];

        for (const slot of nextTimes) {
          const start = makeInstant(dayOffset, slot.h, slot.m);
          const end = new Date(start.getTime() + slot.dur * 60 * 1000);
          const pat = nextPatient();

          newAppointments.push({
            practiceId,
            locationId: location.id,
            startTime: start,
            endTime: end,
            typeId: slot.type.id,
            patientId: pat.id,
            clientId: pat.clientId!,
            doctorId: slot.doc.id,
            roomId: room1?.id ?? null,
            status: slot.st,
            origin: "scheduled",
            notes: slot.notes,
          });
        }
      }

      // ───────────────────────────────────────────────────────────────────────
      // D. ZVYŠOK MESACA (September 2026) - Bohatý mesačný pohľad
      // ───────────────────────────────────────────────────────────────────────
      const laterDaysOffsets = [9, 11, 14, 16, 18, 21, 23, 25];
      for (const dayOffset of laterDaysOffsets) {
        for (let i = 0; i < 3; i++) {
          const h = 9 + i * 2;
          const start = makeInstant(dayOffset, h, 0);
          const end = new Date(start.getTime() + 30 * 60 * 1000);
          const pat = nextPatient();

          newAppointments.push({
            practiceId,
            locationId: location.id,
            startTime: start,
            endTime: end,
            typeId: i === 0 ? surgeryType.id : i === 1 ? wellnessType.id : vaccineType.id,
            patientId: pat.id,
            clientId: pat.clientId!,
            doctorId: i === 0 ? doc1.id : doc2.id,
            roomId: room2?.id ?? null,
            status: "scheduled",
            origin: "scheduled",
            notes: "Vopred zarezervovaný termín cez online klientsky systém.",
          });
        }
      }

      console.log(`  📥 Vkladám ${newAppointments.length} termínov do databázy...`);
      const inserted = await db.insert(appointments).values(newAppointments).returning();
      console.log(`  ✓ Úspešne vložených ${inserted.length} termínov pre ${practice.name}!`);
    }

    console.log("\n🎉 Všetky demo termíny boli úspešne vygenerované!");
  } catch (error) {
    console.error("❌ Chyba pri generovaní demo termínov:", error);
  } finally {
    await client.end();
  }
}

main();
