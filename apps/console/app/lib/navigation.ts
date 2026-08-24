export type NavigationItem = { label: string; href: string; group: "Operate" | "Governance" | "Knowledge" | "Verify & learn"; keywords: string[] };

export const navigation: NavigationItem[] = [
  { label: "Overview", href: "/", group: "Operate", keywords: ["home", "release readiness"] },
  { label: "Admin surfaces", href: "/admin", group: "Operate", keywords: ["litellm", "neo4j", "admin ui", "control"] },
  { label: "Runs", href: "/runs", group: "Operate", keywords: ["execution", "evidence"] },
  { label: "Projects", href: "/projects", group: "Operate", keywords: ["repositories"] },
  { label: "New run", href: "/runs/new", group: "Operate", keywords: ["start", "governed work"] },
  { label: "Budgets", href: "/governance/budgets", group: "Governance", keywords: ["cost", "tokens"] },
  { label: "Workflows", href: "/governance/workflows", group: "Governance", keywords: ["stages"] },
  { label: "Policies", href: "/governance/policies", group: "Governance", keywords: ["authority"] },
  { label: "Models", href: "/governance/models", group: "Governance", keywords: ["routing", "litellm"] },
  { label: "Agent Providers", href: "/governance/providers", group: "Governance", keywords: ["codex", "claude", "opencode", "runtime"] },
  { label: "Context", href: "/knowledge/context", group: "Knowledge", keywords: ["retrieval", "provenance"] },
  { label: "Memory", href: "/knowledge/memory", group: "Knowledge", keywords: ["scope", "postgres"] },
  { label: "Graph", href: "/knowledge/graph", group: "Knowledge", keywords: ["neo4j", "derived"] },
  { label: "Findings", href: "/security", group: "Verify & learn", keywords: ["security", "gates"] },
  { label: "Certification", href: "/release", group: "Verify & learn", keywords: ["release", "readiness"] },
  { label: "Architecture", href: "/architecture", group: "Verify & learn", keywords: ["components", "catalog"] },
  { label: "Academy", href: "/learn", group: "Verify & learn", keywords: ["tutorial", "learn"] },
  { label: "Documentation", href: "/docs", group: "Verify & learn", keywords: ["docs", "reference"] },
];
