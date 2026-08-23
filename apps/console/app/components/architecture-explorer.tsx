"use client";

import { useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MiniMap, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";
import { architectureCatalog, architectureEdges } from "@aicp/architecture-catalog";

type Preset = "executive" | "engineering" | "security";

const presetNodes: Record<Preset, string[]> = {
  executive: ["console", "harness", "worker", "postgres", "litellm"],
  engineering: architectureCatalog.map((component) => component.id),
  security: ["console", "harness", "postgres", "litellm"],
};

const nodePositions: Record<string, { x: number; y: number }> = {
  console: { x: 0, y: 80 },
  harness: { x: 260, y: 80 },
  worker: { x: 520, y: 0 },
  memory: { x: 520, y: 160 },
  postgres: { x: 260, y: 260 },
  litellm: { x: 800, y: 0 },
};

export function ArchitectureExplorer() {
  const [preset, setPreset] = useState<Preset>("executive");
  const visible = useMemo(() => new Set(presetNodes[preset]), [preset]);
  const nodes = useMemo<Node[]>(() => architectureCatalog.filter((component) => visible.has(component.id)).map((component) => ({
    id: component.id,
    position: nodePositions[component.id] ?? { x: 0, y: 0 },
    data: { label: <span><strong>{component.name}</strong><small>{component.plane}</small></span> },
    className: "architecture-node",
  })), [visible]);
  const edges = useMemo<Edge[]>(() => architectureEdges.filter(([from, to]) => visible.has(from) && visible.has(to)).map(([source, target]) => ({
    id: `${source}-${target}`,
    source,
    target,
    animated: source === "harness" && target === "worker",
    label: source === "harness" && target === "postgres" ? "canonical state" : undefined,
  })), [visible]);

  return <div className="architecture-explorer" aria-label="Interactive AICP architecture explorer">
    <div className="architecture-toolbar" role="group" aria-label="Architecture presets">
      {(["executive", "engineering", "security"] as const).map((option) => <button className={`button ${preset === option ? "button-primary" : "button-secondary"}`} key={option} onClick={() => setPreset(option)} aria-pressed={preset === option}>{option}</button>)}
    </div>
    <div className="react-flow-shell">
      <ReactFlow nodes={nodes} edges={edges} fitView fitViewOptions={{ padding: 0.2 }} nodesConnectable={false} nodesDraggable={false} proOptions={{ hideAttribution: true }}>
        <MiniMap pannable zoomable />
        <Controls showInteractive={false} />
        <Background gap={20} size={1} />
      </ReactFlow>
    </div>
    <section className="sr-only" aria-label="Architecture text alternative"><h2>Architecture components</h2><ul>{architectureCatalog.filter((component) => visible.has(component.id)).map((component) => <li key={component.id}>{component.name}: owns {component.owns.join(", ")}; does not own {component.doesNotOwn.join(", ")}.</li>)}</ul></section><p className="muted">Canonical state remains in PostgreSQL. Neo4j is reconstructible, Redis is ephemeral, and provider credentials stay behind LiteLLM.</p>
  </div>;
}
