#!/usr/bin/env python3
from hashlib import sha256
import json
import math
from pathlib import Path
import re
import statistics
import sys

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "memory-service" / "src"))
from aicp_memory.context_service import ContextService

SOURCE_SUFFIXES = {".js", ".mjs", ".ts", ".py", ".java", ".go", ".sql", ".yaml", ".yml", ".json", ".sh"}
EXCLUDED = {".git", ".aicp", "node_modules", "projects", "state", "secrets", "backups"}

def terms(value): return re.findall(r"[A-Za-z0-9_$]+", value.lower())
def vector(value, dimensions=64):
    result = [0.0] * dimensions
    for term in terms(value): result[int(sha256(term.encode()).hexdigest()[:8], 16) % dimensions] += 1.0
    norm = math.sqrt(sum(item * item for item in result)) or 1.0
    return [item / norm for item in result]
def relevant(path, scopes): return any(path == scope or path.startswith(scope.rstrip("/") + "/") for scope in scopes)

class Repository:
    def __init__(self, chunks): self.chunks = chunks
    def retrieve_chunks(self, repository, query, exact_symbols=None, limit=50):
        query_terms = set(terms(query))
        return sorted(self.chunks, key=lambda item: (-len(query_terms & set(terms(f"{item['symbol']} {item['content']}"))), item["id"]))[:limit]
    def search_active(self, scopes): return []
class Embedder:
    model = "deterministic-hash-embedding-v1"; dimensions = 64
    def __init__(self): self.calls = 0
    def embed(self, content): self.calls += 1; return vector(content)
class Counter:
    model = "unicode-char-envelope-v1"
    def count(self, content): return max(1, math.ceil(len(content) / 4))
class Graph:
    def retrieve(self, repository, symbols, paths, max_hops=2): return []

def corpus():
    chunks = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file() or path.suffix not in SOURCE_SUFFIXES or any(part in EXCLUDED for part in path.parts): continue
        relative = path.relative_to(ROOT).as_posix(); content = path.read_text("utf8", errors="replace")[:6000]
        if not content.strip(): continue
        chunks.append({"id": sha256(relative.encode()).hexdigest(), "path": relative, "symbol": path.stem, "content": content,
                       "content_hash": sha256(content.encode()).hexdigest(), "token_count": max(1, math.ceil(len(content) / 4)), "embedding": vector(content)})
    return chunks

def pack_baseline(chunks, budget):
    selected, used = [], 0
    for chunk in chunks:
        tokens_count = max(1, math.ceil(len(chunk["content"]) / 4))
        if used + tokens_count <= budget: selected.append(chunk); used += tokens_count
    return selected, used

dataset = json.loads((ROOT / "tests/evaluations/v1-paired.tasks.json").read_text())
chunks = corpus(); observations = []
for repetition in range(1, 4):
    for task in dataset["tasks"]:
        repository = Repository(chunks); retrieved = repository.retrieve_chunks("aicp", task["description"])
        baseline, baseline_tokens = pack_baseline(retrieved, 4096)
        embedder = Embedder(); service = ContextService(repository, embedder, Graph(), Counter())
        candidate = service.compile({"repository": "aicp", "task_id": task["taskId"], "query": task["description"], "budget": 4096,
                                     "index_snapshot": dataset["baseCommit"], "graph_snapshot": "deterministic-none"}, [])
        for arm, selected, selected_tokens, embedded in [
            ("baseline", baseline, baseline_tokens, True),
            ("candidate", candidate["artifacts"], candidate["token_count"], not candidate["metrics"]["vector_skipped"]),
        ]:
            relevant_count = sum(1 for item in selected if relevant(item["path"], task["expectedScope"]))
            observations.append({"taskId": task["taskId"], "repetition": repetition, "arm": arm, "selectedTokens": selected_tokens,
                                 "selectedArtifacts": len(selected), "relevantArtifacts": relevant_count,
                                 "contextPrecision": relevant_count / len(selected) if selected else 0, "vectorUsed": embedded})

def aggregate(arm):
    rows = [item for item in observations if item["arm"] == arm]
    return {"runs": len(rows), "meanSelectedTokens": statistics.mean(item["selectedTokens"] for item in rows),
            "meanContextPrecision": statistics.mean(item["contextPrecision"] for item in rows),
            "vectorUseRate": statistics.mean(item["vectorUsed"] for item in rows)}
baseline = aggregate("baseline"); candidate = aggregate("candidate")
report = {"schemaVersion": 1, "benchmark": "aicp-v1-context-v3", "measurementClass": "real-deterministic-repository-corpus",
          "datasetId": dataset["id"], "baseCommit": dataset["baseCommit"], "tasks": len(dataset["tasks"]), "repetitions": 3,
          "corpusChunks": len(chunks), "baseline": baseline, "candidate": candidate,
          "delta": {"selectedTokenRatio": candidate["meanSelectedTokens"] / baseline["meanSelectedTokens"] if baseline["meanSelectedTokens"] else 0,
                    "contextPrecision": candidate["meanContextPrecision"] - baseline["meanContextPrecision"],
                    "vectorUseRate": candidate["vectorUseRate"] - baseline["vectorUseRate"]},
          "limitations": ["No LLM generation, cost, defect or human-acceptance claim is made by this structural benchmark."],
          "observationsHash": sha256(json.dumps(observations, sort_keys=True, separators=(",", ":")).encode()).hexdigest()}
output = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / ".aicp/evaluations/context-v3.report.json"
output.parent.mkdir(parents=True, exist_ok=True); output.write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report))
