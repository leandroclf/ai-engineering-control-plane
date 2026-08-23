import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { CommandPalette, CommandTrigger, LocaleSwitcher, ThemeToggle } from "./components/command-palette";

export const metadata: Metadata = { title: "AICP Console", description: "Governed execution, evidence, context, memory and release readiness." };

const primary = [["Overview", "/"], ["Runs", "/runs"], ["Projects", "/projects"], ["New run", "/runs/new"]];
const governance = [["Budgets", "/governance/budgets"], ["Workflows", "/governance/workflows"], ["Policies", "/governance/policies"], ["Models", "/governance/models"]];
const knowledge = [["Context", "/knowledge/context"], ["Memory", "/knowledge/memory"], ["Graph", "/knowledge/graph"]];
const security = [["Findings", "/security"], ["Certification", "/release"], ["Architecture", "/architecture"], ["Learn", "/learn"], ["Docs", "/docs"]];

function NavGroup({ label, items }: { label: string; items: string[][] }) { return <><div className="nav-group">{label}</div>{items.map(([name, href]) => <Link key={href} href={href}><span aria-hidden="true">{name === "Overview" ? "◈" : name === "Runs" ? "≡" : name === "Architecture" ? "⌘" : "·"}</span> {name}</Link>)}</>; }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><div className="app-shell"><aside className="sidebar"><Link className="brand" href="/">AICP <small>Human Control Plane</small></Link><nav aria-label="Primary navigation"><NavGroup label="Operate" items={primary} /><NavGroup label="Governance" items={governance} /><NavGroup label="Knowledge" items={knowledge} /><NavGroup label="Verify & learn" items={security} /></nav><div className="muted" style={{ marginTop: "auto", color: "#8fa2b8" }}>Demo mode · deterministic<br />No provider keys required</div></aside><div className="main"><header className="topbar"><div className="muted">Governed engineering workspace</div><div className="topbar-actions"><CommandTrigger /><LocaleSwitcher /><ThemeToggle /><span className="status status-success"><span className="status-dot" />Console ready</span></div></header><main>{children}</main></div></div><CommandPalette /></body></html>;
}
