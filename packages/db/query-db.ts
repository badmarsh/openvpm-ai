import { config } from "dotenv";
config({ path: "../../.env" });
import { db } from "./client";
import { practices, users, locations } from "./schema/index";

async function main() {
  const p = await db.select({ id: practices.id, name: practices.name, address: practices.address, phone: practices.phone }).from(practices);
  console.log("PRACTICES:", JSON.stringify(p, null, 2));
  const u = await db.select({ id: users.id, name: users.name, role: users.role, email: users.email, practiceId: users.practiceId }).from(users);
  console.log("USERS:", JSON.stringify(u, null, 2));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
