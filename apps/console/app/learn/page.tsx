import Link from "next/link";
import { Card } from "@aicp/ui";
import { academyModules } from "@aicp/tutorial-engine";
export default function LearnPage() { return <div className="content"><div className="page-heading"><div><div className="eyebrow">AICP Academy</div><h1>Learn the control plane</h1><p className="muted">A progressive path from the first governed run to extending a worker, gate or retriever.</p></div><Link className="button button-primary" href="/learn/getting-started">Start quick tour</Link></div><div className="grid two-col">{academyModules.map(([id, title, description], index) => <Card key={id} title={`${index + 1}. ${title}`}><p className="muted">{description}</p><Link className="evidence-link" href={`/learn/${id}`}>Open module →</Link></Card>)}</div></div>; }
