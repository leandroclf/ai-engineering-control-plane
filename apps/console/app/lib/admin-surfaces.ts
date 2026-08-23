export type AdminSurface = {
  id: string;
  name: string;
  summary: string;
  href: string;
  label: string;
  access: "ui" | "api-only";
  notes: string;
};

export const adminSurfaces: AdminSurface[] = [
  {
    id: "console",
    name: "AICP Console",
    summary: "Primary operator workspace for runs, governance, knowledge and release evidence.",
    href: "/",
    label: "Open Console",
    access: "ui",
    notes: "This is the main control surface already in use.",
  },
  {
    id: "litellm",
    name: "LiteLLM Admin UI",
    summary: "Model routing, keys, spend tracking and model management for the LLM gateway.",
    href: "/litellm",
    label: "Open LiteLLM UI",
    access: "ui",
    notes: "Proxied through the Console at /litellm.",
  },
  {
    id: "neo4j",
    name: "Neo4j Browser",
    summary: "Interactive Cypher browser for inspecting the knowledge graph and projections.",
    href: "/browser",
    label: "Open Neo4j Browser",
    access: "ui",
    notes: "Proxied through the Console at /browser.",
  },
  {
    id: "pgadmin",
    name: "pgAdmin",
    summary: "Graphical control surface for PostgreSQL objects, queries and server inspection.",
    href: "/pgadmin",
    label: "Open pgAdmin",
    access: "ui",
    notes: "Proxied through the Console at /pgadmin.",
  },
  {
    id: "redisinsight",
    name: "RedisInsight",
    summary: "Graphical explorer for Redis keys, memory structures and live inspection.",
    href: "/redisinsight",
    label: "Open RedisInsight",
    access: "ui",
    notes: "Proxied through the Console at /redisinsight.",
  },
];

export const adminOnlyServices = [
  {
    id: "harness",
    name: "Harness API",
    summary: "Workflow authority, budgets and release gating. No browser UI is exposed.",
    endpoint: "http://localhost:18081",
  },
  {
    id: "memory-service",
    name: "Memory Service",
    summary: "Context and memory API behind the governed execution boundary.",
    endpoint: "http://localhost:18080",
  },
  {
    id: "postgres",
    name: "PostgreSQL",
    summary: "Canonical state store. Access is via the application and database tooling, not a built-in GUI.",
    endpoint: "postgresql://localhost:5432",
  },
  {
    id: "redis",
    name: "Redis",
    summary: "Ephemeral cache and coordination state. No graphical admin console is shipped in this stack.",
    endpoint: "redis://localhost:6379",
  },
  {
    id: "worker-manager",
    name: "Worker Manager",
    summary: "Operational API for ephemeral worker lifecycle. No browser UI is exposed.",
    endpoint: "http://localhost:8090",
  },
];
