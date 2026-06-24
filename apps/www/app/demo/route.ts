import { NextResponse } from "next/server";
import { demoLoginUrl } from "@/lib/urls";

// Some links (and the old README) point at openvpm.com/demo. Send them to the
// real demo login instead of 404ing. Kept as a redirect so the canonical demo
// URL can change without breaking inbound links.
export function GET() {
  return NextResponse.redirect(demoLoginUrl, 307);
}
