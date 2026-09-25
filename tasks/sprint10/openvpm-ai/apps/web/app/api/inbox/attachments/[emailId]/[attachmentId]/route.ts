import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { emailEnv } from "@/lib/email-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ emailId: string; attachmentId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { emailId, attachmentId } = await context.params;
  const apiKey = emailEnv("RESEND_API_KEY");
  if (!apiKey) {
    return NextResponse.json({ error: "Resend API key not configured" }, { status: 500 });
  }

  try {
    const emailRes = await fetch("https://api.resend.com/emails/receiving/" + emailId, {
      headers: { Authorization: "Bearer " + apiKey },
    });

    if (!emailRes.ok) {
      return NextResponse.json({ error: "Failed to fetch email" }, { status: emailRes.status });
    }

    const emailData = await emailRes.json();
    const attachment = (emailData.attachments || []).find(
      (a: { id: string }) => a.id === attachmentId
    );

    if (!attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const attRes = await fetch(
      "https://api.resend.com/emails/receiving/" + emailId + "/attachments/" + attachmentId,
      { headers: { Authorization: "Bearer " + apiKey } }
    );

    if (!attRes.ok) {
      return NextResponse.json(
        { error: "Failed to download attachment from provider" },
        { status: attRes.status }
      );
    }

    const attData = (await attRes.json());
    const downloadUrl = attData.download_url;
    if (!downloadUrl) {
      return NextResponse.json({ error: "Attachment download URL not found" }, { status: 404 });
    }

    const fileRes = await fetch(downloadUrl);
    if (!fileRes.ok) {
      return NextResponse.json(
        { error: "Failed to download attachment binary from storage" },
        { status: fileRes.status }
      );
    }

    const blob = await fileRes.blob();
    const filename = attachment.filename || attData.filename || "attachment";
    const contentType = attachment.content_type || attData.content_type || "application/octet-stream";

    return new NextResponse(blob, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": 'inline; filename="' + encodeURIComponent(filename) + '"',
      },
    });
  } catch (error) {
    console.error("[inbox-attachment] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
