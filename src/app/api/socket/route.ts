import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = request.headers.get("host");

  const protocol = forwardedProto || (request.nextUrl.protocol.replace(":", "") || "http");
  const resolvedHost = forwardedHost || host || "localhost:3000";
  const origin = `${protocol}://${resolvedHost}`;
  return NextResponse.json({ ok: true, wsUrl: origin });
}
