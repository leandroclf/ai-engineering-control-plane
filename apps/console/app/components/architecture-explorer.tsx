"use client";

import { useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MiniMap, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";
import { demoArchitecture } from "@aicp/test-fixtures";

type Preset = "executive" | "engineering" | "security";

const presetNodes: Record<Preset, string[]> = {
  executive: ["console", "harness", "worker", "postgres", "litellm"],
  engineering: demoArchitecture.nodes.map((node) => node.id),
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
  const nodes = useMemo<Node[]>(() => demoArchitecture.nodes.filter((node) => visible.has(node.id)).map((node) => ({
    id: node.id,
    position: nodePositions[node.id] ?? { x: 0, y: 0 },
    data: { label: <span><strong>{node.label}</strong><small>{node.plane}</small></span> },
    className: "architecture-node",
  })), [visible]);
  const edges = useMemo<Edge[]>(() => demoArchitecture.edges.filter(([from, to]) => visible.has(from) && visible.has(to)).map(([source, target]) => ({
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
    <p className="muted">Canonical state remains in PostgreSQL. Neo4j is reconstructible, Redis is ephemeral, and provider credentials stay behind LiteLLM.</p>
  </div>;
}
