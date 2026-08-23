import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

export type Status = "neutral" | "running" | "success" | "warning" | "blocked" | "failed" | "cancelled" | "human-required";
const statusLabels: Record<Status, string> = { neutral: "Neutral", running: "Running", success: "PASS", warning: "Warning", blocked: "BLOCKED", failed: "FAILED", cancelled: "Cancelled", "human-required": "Human required" };

export function StatusBadge({ status, children }: { status: Status; children?: ReactNode }) {
  return <span className={`status status-${status}`} data-status={status}><span aria-hidden="true" className="status-dot" />{children ?? statusLabels[status]}</span>;
}

export function Card({ title, eyebrow, children, className = "" }: { title?: string; eyebrow?: string; children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{eyebrow && <div className="eyebrow">{eyebrow}</div>}{title && <h2>{title}</h2>}{children}</section>;
}

export function MetricCard({ label, value, detail, status = "neutral" }: { label: string; value: ReactNode; detail?: ReactNode; status?: Status }) {
  return <Card className="metric-card"><div className="eyebrow">{label}</div><div className="metric-value"><span>{value}</span>{status !== "neutral" && <StatusBadge status={status} />}</div>{detail && <div className="muted">{detail}</div>}</Card>;
}

export function ProgressMeter({ label, value, max, unit = "", status = "success" }: { label: string; value: number; max: number; unit?: string; status?: Status }) {
  const percent = Math.min(100, Math.round((value / max) * 100));
  return <div className="meter"><div className="meter-label"><span>{label}</span><strong>{value.toLocaleString()} / {max.toLocaleString()} {unit}</strong></div><div className="meter-track" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}><span className={`meter-fill fill-${status}`} style={{ width: `${percent}%` }} /></div></div>;
}

export function Button({ children, variant = "primary", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  return <button className={`button button-${variant}`} {...props}>{children}</button>;
}

export function EmptyState({ title, body }: { title: string; body: string }) { return <div className="empty-state"><h3>{title}</h3><p>{body}</p></div>; }
export function Skeleton({ className = "" }: { className?: string }) { return <div className={`skeleton ${className}`} aria-hidden="true" />; }
export function Definition({ label, children }: { label: string; children: ReactNode }) { return <div className="definition"><dt>{label}</dt><dd>{children}</dd></div>; }
export function CodeBlock({ children }: { children: ReactNode }) { return <pre className="code-block"><code>{children}</code></pre>; }
export function EvidenceLink({ children, href = "#evidence" }: { children: ReactNode; href?: string }) { return <a className="evidence-link" href={href}>{children} <span aria-hidden="true">↗</span></a>; }
export function Timeline({ items, completed = [] }: { items: string[]; completed?: string[] }) { return <ol className="timeline" aria-label="Workflow timeline">{items.map((item) => { const done = completed.includes(item); const active = !done && (item === items.find((candidate) => !completed.includes(candidate))); return <li key={item} className={done ? "timeline-done" : active ? "timeline-active" : "timeline-pending"}><span className="timeline-marker" aria-hidden="true">{done ? "✓" : active ? "!" : "·"}</span><span>{item.replaceAll("-", " ")}</span><small>{done ? "completed" : active ? "requires attention" : "pending"}</small></li>; })}</ol>; }
export function Table({ children, caption }: { children: ReactNode; caption: string }) { return <div className="table-wrap"><table><caption className="sr-only">{caption}</caption>{children}</table></div>; }
export function Split({ children, className = "" }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) { return <div className={`split ${className}`}>{children}</div>; }
