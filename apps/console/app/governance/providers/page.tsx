import { Card, StatusBadge, Table } from "@aicp/ui";
import { getProviders } from "../../lib/data";

type Provider = { id: string; runtime?: string; providerFamily?: string; billingMode?: string; authMode?: string; executionZone?: string; enabled?: boolean; health?: string; scope?: string };

export default async function ProvidersPage() {
  const response = await getProviders();
  const providers = response.items as Provider[];
  return <div className="content"><div className="page-heading"><div><div className="eyebrow">Governance / Agent Providers</div><h1>Agent Provider Layer</h1><p className="muted">Runtimes agentic governados pelo Harness. LiteLLM continua separado como Model Gateway.</p></div><StatusBadge status="neutral">Read-only</StatusBadge></div><Card><Table caption="Sanitized agent providers"><thead><tr><th>Provider</th><th>Runtime / family</th><th>Billing</th><th>Trust zone</th><th>Auth</th><th>Scope</th><th>Status</th></tr></thead><tbody>{providers.map((provider) => <tr key={provider.id}><td><strong>{provider.id}</strong></td><td>{provider.runtime ?? "unknown"}<br /><span className="muted">{provider.providerFamily ?? "unknown"}</span></td><td>{provider.billingMode ?? "unknown"}</td><td>{provider.executionZone ?? "unknown"}</td><td>{provider.authMode ?? "unknown"}</td><td>{provider.scope ?? (provider.executionZone === "provider-host" ? "local-personal" : "all")}</td><td><StatusBadge status={provider.enabled ? "success" : "blocked"}>{provider.health ?? (provider.enabled ? "enabled" : "disabled")}</StatusBadge></td></tr>)}</tbody></Table></Card><Card title="Security boundary"><p className="muted">The Console receives only sanitized descriptors, health and shadow-quota evidence. It never performs vendor login, receives OAuth material, or changes routing, workflow, budget or gate authority.</p></Card></div>;
}
