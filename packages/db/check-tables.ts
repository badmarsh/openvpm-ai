import { client } from "./client";

async function main() {
  const res = await client`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'ext_marketing_website%'`;
  console.log("Found tables:", res);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
