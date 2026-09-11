import { NextResponse } from "next/server";

const STUB_SCRIPT = `(function(){window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments);};})();`;

export async function GET() {
  return new NextResponse(STUB_SCRIPT, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600, immutable",
    },
  });
}

export async function POST() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
