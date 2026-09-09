import { config } from "dotenv";
config({ path: "../../.env" });
import { db } from "./client";
import { eq, inArray, sql } from "drizzle-orm";
import { practices, locations, users } from "./schema/index";

const PRACTICE_ID = "5c4ebbbc-90e1-457a-87a7-7895f560317d";
const MARTIN_ID   = "b1963bb2-ef34-470e-ab2d-a22a250984bb";

const SOFT_DELETE_IDS = [
  "72082441-5a9e-4470-a9a2-d9f2202708c0",
  "c2e5dd1f-5e3f-4635-8f72-1c998e211f69",
  "34cc7646-d926-44a2-a8a0-c3ee75fec260",
  "d82ba02a-fc3b-4b49-88d5-fb02303fc801",
  "2bf69f44-0011-4853-98e5-b26eba8d808d",
];

async function main() {
  // 1. Practice address & phone
  await db.update(practices).set({
    address: "Kvetna 3, 979 01 Rimavska Sobota",
    phone: "+421 903 949 401",
    email: "info@vetsykora.sk",
  }).where(eq(practices.id, PRACTICE_ID));
  console.log("Updated practice address/phone");

  // 2. Location
  const loc = await db.query.locations.findFirst({ where: eq(locations.practiceId, PRACTICE_ID) });
  if (loc) {
    await db.update(locations).set({
      name: "Veterinarna ambulancia MVDr. Martin Sykora",
      address: "Kvetna 3, 979 01 Rimavska Sobota",
      phone: "+421 903 949 401",
    }).where(eq(locations.id, loc.id));
    console.log("Updated location");
  }

  // 3. Soft-delete extra vets/admins (preserves FK integrity)
  await db.update(users)
    .set({ deletedAt: new Date() })
    .where(inArray(users.id, SOFT_DELETE_IDS));
  console.log("Soft-deleted", SOFT_DELETE_IDS.length, "demo users");

  // 4. Ensure Martin Sykora is marked as vet with correct data
  await db.update(users).set({
    isVeterinarian: true,
    licenseNumber: "KVL-SK-12345",
    phone: "+421 903 949 401",
  }).where(eq(users.id, MARTIN_ID));
  console.log("Updated MVDr. Martin Sykora");

  // 5. Show result
  const rem = await db.execute(sql`
    SELECT name, role, email FROM users
    WHERE practice_id = ${PRACTICE_ID} AND deleted_at IS NULL
    ORDER BY role
  `);
  console.log("\nActive users remaining:");
  ((rem as any).rows ?? (rem as any[])).forEach((u: any) => console.log(" -", u.name, `(${u.role})`));

  const prac = await db.query.practices.findFirst({ where: eq(practices.id, PRACTICE_ID) });
  console.log("\nPractice:", prac?.name, "|", prac?.address, "|", prac?.phone);

  process.exit(0);
}
main().catch(e => { console.error(e?.cause ?? e); process.exit(1); });
