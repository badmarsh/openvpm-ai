import { config } from "dotenv";
import path from "node:path";
import fs from "node:fs";

const envCandidates = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env"),
];
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    config({ path: envPath });
    break;
  }
}

import postgres from "postgres";
import { Resend } from "resend";

/**
 * Inbox Attachments Backfill
 *
 * For inbound emails received before the webhook handler gained
 * attachment-embedding code, fetches the full email from the Resend API
 * (GET /emails/receiving/{emailId}) and appends the
 * <!--INBOX_ATTACHMENTS:[...]-->  comment to the DB content column.
 *
 * Usage:
 *   npx tsx scripts/backfill-inbox-attachments.ts            # dry-run
 *   npx tsx scripts/backfill-inbox-attachments.ts --apply    # apply updates
 */

const DRY_RUN = !process.argv.includes("--apply");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!databaseUrl) {
    console.error("ERROR: DATABASE_URL is not set");
    process.exit(1);
  }
  if (!resendApiKey) {
    console.error("ERROR: RESEND_API_KEY is not set");
    process.exit(1);
  }

  console.log(DRY_RUN ? "DRY RUN - no changes will be written" : "APPLY mode - DB will be updated");

  const sql = postgres(databaseUrl);
  const resend = new Resend(resendApiKey);

  try {
    const rows = await sql<
      { id: string; subject: string; content: string; provider_message_id: string }[]
    >`
      SELECT id, subject, content, provider_message_id
      FROM   communications
      WHERE  direction            = 'inbound'
        AND  channel              = 'email'
        AND  provider_message_id  IS NOT NULL
        AND  content              NOT LIKE '%INBOX_ATTACHMENTS%'
      ORDER  BY created_at DESC
    `;

    console.log("Found " + rows.length + " email(s) to check.");

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const row of rows) {
      console.log("-> [" + row.id + "] " + row.subject + " (msg: " + row.provider_message_id + ")");

      let attachments: unknown[] = [];

      try {
        const result = await resend.emails.receiving.get(row.provider_message_id);

        if (result.error) {
          console.warn("  WARNING Resend API error: " + result.error.message);
          errors++;
          continue;
        }

        if (!result.data) {
          console.log("  INFO No data returned from Resend");
          skipped++;
          continue;
        }

        const data = result.data as Record<string, unknown>;
        const rawAttachments = data.attachments;

        if (!Array.isArray(rawAttachments) || rawAttachments.length === 0) {
          console.log("  INFO No attachments found in Resend response");
          skipped++;
          continue;
        }

        attachments = rawAttachments;
        console.log("  Found " + attachments.length + " attachment(s):");
        for (const att of attachments as Array<{ filename?: string; content_type?: string; size?: number }>) {
          console.log("    - " + att.filename + " (" + att.content_type + ", " + (att.size ?? "?") + "B)");
        }
      } catch (err) {
        console.warn("  ERROR Exception fetching from Resend: " + String(err));
        errors++;
        continue;
      }

      if (attachments.length === 0) {
        skipped++;
        continue;
      }

      const attachmentComment = "\n\n<!--INBOX_ATTACHMENTS:" + JSON.stringify(attachments) + "-->";
      const newContent = row.content.trimEnd() + attachmentComment;

      if (DRY_RUN) {
        console.log("  [DRY RUN] Would append attachment metadata to content");
      } else {
        await sql`
          UPDATE communications
          SET    content    = ${newContent},
                 updated_at = NOW()
          WHERE  id = ${row.id}
        `;
        console.log("  Updated DB row");
      }

      updated++;
    }

    console.log("Backfill complete: updated=" + updated + " skipped=" + skipped + " errors=" + errors);
    if (DRY_RUN) {
      console.log("Run with --apply to persist changes.");
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});

