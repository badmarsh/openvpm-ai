import { writeFileSync } from "fs";
import { argv } from "process";
const p = argv[2];
import { readFileSync } from "fs";
const content = readFileSync(p, "utf8");
writeFileSync("C:/Users/marek/Documents/Vet/openvpm-ai/apps/web/server/routers/extensions/marketing.ts", content, "utf8");
process.stdout.write("DONE length:" + content.length + "\n");