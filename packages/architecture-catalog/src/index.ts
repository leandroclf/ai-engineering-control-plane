export type ArchitectureComponent = {
  id: string;
  name: string;
  plane: "human" | "control" | "execution" | "knowledge" | "data" | "external";
  purpose: string;
  why: string;
  benefits: string[];
  authority: string;
  owns: string[];
  doesNotOwn: string[];
  state: { canonical?: string; derived?: string[]; ephemeral?: string[] };
  dataSensitivity: string;
  dependencies: string[];
  interfaces: string[];
  failureMode: "fail-closed" | "degraded-read-only" | "retryable";
  securityBoundary: string;
  observability: string[];
  docs: string;
};
