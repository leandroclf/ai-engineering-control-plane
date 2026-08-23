import type { Status } from "./index.tsx";

export type RunStatus =
  | "PENDING"
  | "RUNNING"
  | "BLOCKED"
  | "FAILED"
  | "COMPLETED"
  | "CANCELLED"
  | "HUMAN_REVIEW";

const runPresentation: Record<RunStatus, Status> = {
  PENDING: "neutral",
  RUNNING: "running",
  BLOCKED: "blocked",
  FAILED: "failed",
  COMPLETED: "success",
  CANCELLED: "cancelled",
  HUMAN_REVIEW: "human-required",
};

const gatePresentation: Record<string, Status> = {
  PASS: "success",
  RUNNING: "running",
  BLOCKED: "blocked",
  FAILED: "failed",
  CANCELLED: "cancelled",
  HUMAN_REVIEW: "human-required",
  PENDING: "neutral",
};

export function presentationForRunStatus(status: string | undefined | null): Status {
  return status && status in runPresentation
    ? runPresentation[status as RunStatus]
    : "neutral";
}

export function presentationForGateStatus(status: string | undefined | null): Status {
  return status ? gatePresentation[status] ?? "neutral" : "neutral";
}

export function labelForUnknownStatus(status: string | undefined | null) {
  return status ? `UNKNOWN (${status})` : "UNKNOWN";
}
