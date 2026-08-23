import { readFile } from "node:fs/promises";
import { demoCertification, demoRunDetail, demoRuns } from "@aicp/test-fixtures";

export const isDemo = process.env.AICP_DEMO_MODE !== "false";

async function harnessFetch<T>(path: string): Promise<T> {
  const token = process.env.HARNESS_SERVICE_TOKEN ?? (process.env.HARNESS_SERVICE_TOKEN_FILE ? await readFile(process.env.HARNESS_SERVICE_TOKEN_FILE, "utf8") : "");
  if (!token) throw new Error("Harness BFF is not configured");
  const response = await fetch(`${process.env.HARNESS_URL ?? "http://harness:8081"}${path}`, { headers: { authorization: `Bearer ${token.trim()}`, "x-request-id": `console-${Date.now()}` }, cache: "no-store" });
  if (!response.ok) throw new Error(`Harness request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

async function localCertification() {
  try { return JSON.parse(await readFile("release/v1-contract.json", "utf8")); } catch { return demoCertification; }
}

export async function getCertification() { if (isDemo) return demoCertification; try { return await harnessFetch("/v1/certifications/v1"); } catch { return localCertification(); } }
export async function getRuns() { if (isDemo) return { items: demoRuns, pagination: { limit: 50, offset: 0, total: demoRuns.length } }; try { return await harnessFetch<{ items: unknown[]; pagination?: unknown }>("/v1/runs?limit=50&offset=0"); } catch { return { items: [], pagination: { limit: 50, offset: 0, total: 0 } }; } }
export async function getRun(runId: string) { if (isDemo) return runId === "demo-run" ? demoRunDetail : demoRuns.find((run) => run.id === runId) ?? demoRunDetail; try { const response = await harnessFetch<{ run: Record<string, unknown>; stages: unknown[] }>(`/v1/runs/${encodeURIComponent(runId)}`); return { ...response.run, stages: response.stages }; } catch { return demoRunDetail; } }
export async function getOverview() { const certification = await getCertification(); const runs = await getRuns(); const runItems = runs.items as Array<{ status: string }>; const controls = certification.controls ?? certification.blockers ?? []; const pass = certification.counts?.PASS ?? controls.filter((control: { status: string }) => control.status === "PASS").length; const blocked = certification.counts?.BLOCKED ?? controls.filter((control: { status: string }) => control.status === "BLOCKED").length; const failed = certification.counts?.FAILED ?? controls.filter((control: { status: string }) => control.status === "FAILED").length; return { release: { overall: certification.overall ?? (blocked ? "NOT_YET_V1_CERTIFIED" : "CERTIFIED"), pass, blocked, failed }, activeRuns: runItems.filter((run) => ["RUNNING", "HUMAN_REVIEW"].includes(run.status)).length, recentRuns: runs.items, attention: certification.blockers ?? controls.filter((control: { status: string }) => control.status !== "PASS"), budget: { observed: "No observed aggregate yet", note: "Demo data is deterministic and does not spend money." }, quality: { observed: "No observed data yet" }, context: { observed: "No observed aggregate yet" } }; }
