import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const payload = await request.json() as { project?: string; query?: string };
  if (!payload.project?.trim() || !payload.query?.trim()) return NextResponse.json({ error: { code: "INVALID_REQUEST", message: "project and query are required" } }, { status: 400 });
  if (process.env.AICP_DEMO_MODE !== "false") return NextResponse.json({ id: "demo-run", status: "HUMAN_REVIEW", demo: true }, { status: 201 });
  const baseUrl = process.env.HARNESS_URL ?? "http://harness:8081";
  let token = process.env.HARNESS_SERVICE_TOKEN ?? "";
  if (!token && process.env.HARNESS_SERVICE_TOKEN_FILE) { try { token = await readFile(process.env.HARNESS_SERVICE_TOKEN_FILE, "utf8"); } catch { token = ""; } }
  if (!token) return NextResponse.json({ error: { code: "BFF_NOT_CONFIGURED", message: "Harness service token is configured only on the server." } }, { status: 503 });
  const response = await fetch(`${baseUrl}/v1/runs`, { method: "POST", headers: { authorization: `Bearer ${token.trim()}`, "content-type": "application/json", "idempotency-key": `console-${Date.now()}` }, body: JSON.stringify(payload), cache: "no-store" });
  return new NextResponse(await response.text(), { status: response.status, headers: { "content-type": "application/json" } });
}
