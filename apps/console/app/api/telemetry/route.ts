import { NextResponse } from "next/server";

const allowedNames = new Set(["TTFB", "FCP", "LCP", "CLS", "INP"]);

export async function POST(request: Request) {
  const value = await request.json().catch(() => null) as { type?: string; name?: string; value?: number; rating?: string; route?: string } | null;
  if (!value || value.type !== "web-vital" || !value.name || !allowedNames.has(value.name) || typeof value.value !== "number" || typeof value.route !== "string" || !value.route.startsWith("/")) return NextResponse.json({ error: "invalid telemetry event" }, { status: 400 });
  return new NextResponse(null, { status: 204 });
}
