from hashlib import sha256
import json
import math
import re


def _cosine(left, right):
    if not left or not right or len(left) != len(right):
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    return dot / (left_norm * right_norm) if left_norm and right_norm else 0.0


class ContextService:
    def __init__(self, repository, embedder, graph, token_counter=None):
        self.repository = repository
        self.embedder = embedder
        self.graph = graph
        self.token_counter = token_counter

    def index_state(self, repository):
        return self.repository.index_state(repository)

    def impact(self, repository, path):
        return {"repository": repository, "path": path, "dependents": self.graph.impact(repository, path)}

    def sync(self, repository, payload, rebuild=False):
        embedded = 0
        reused = 0
        files = []
        pending = []
        for source_file in payload.get("files", []):
            current = {**source_file, "chunks": []}
            for source_chunk in source_file.get("chunks", []):
                chunk = dict(source_chunk)
                content_hash = chunk.get("contentHash") or chunk.get("content_hash")
                vector = self.repository.cached_embedding(
                    chunk["id"], content_hash, self.embedder.model, self.embedder.dimensions,
                )
                if vector is None:
                    embedded += 1
                    pending.append(chunk)
                else:
                    reused += 1
                chunk.update({
                    "content_hash": content_hash,
                    "token_count": chunk.get("tokenCount") or chunk.get("token_count") or max(1, math.ceil(len(chunk["content"]) / 4)),
                    "embedding": vector,
                    "embedding_model": self.embedder.model,
                    "embedding_dimensions": self.embedder.dimensions,
                })
                current["chunks"].append(chunk)
            files.append(current)
        if pending:
            vectors = self.embedder.embed_many([chunk["content"] for chunk in pending])
            if len(vectors) != len(pending):
                raise ValueError("embedding batch result count mismatch")
            for chunk, vector in zip(pending, vectors):
                chunk["embedding"] = vector
        indexed = {**payload, "files": files}
        self.graph.apply(repository, indexed, rebuild=rebuild)
        invalidated = self.repository.sync_index(repository, indexed, rebuild=rebuild) or 0
        return {
            "repository": repository,
            "parsed": len(files),
            "reused": len(payload.get("reused", [])),
            "embedded": embedded,
            "embedding_reused": reused,
            "embedding_model": self.embedder.model,
            "embedding_dimensions": self.embedder.dimensions,
            "memories_invalidated": invalidated,
        }

    def compile(self, payload, authorized_scopes):
        requested_budget = int(payload["budget"])
        model_window = int(payload.get("model_window", requested_budget))
        envelope_reserves = {
            "output": int(payload.get("output_reserve", 0)),
            "system": int(payload.get("system_reserve", 0)),
            "tool_schema": int(payload.get("tool_schema_reserve", 0)),
            "safety": int(payload.get("safety_reserve", 0)),
        }
        available = max(0, model_window - sum(envelope_reserves.values()))
        effective_budget = min(requested_budget, available)
        if effective_budget <= 0:
            raise ValueError("context envelope has no available tokens")
        query = payload["query"]
        query_vector = self.embedder.embed(query)
        terms = set(re.findall(r"[A-Za-z0-9_$]+", query.lower()))
        exact = {value.lower() for value in payload.get("exact_symbols", [])}
        candidates = []
        chunks = self.repository.retrieve_chunks(payload["repository"], query, sorted(exact))
        lexical_order = sorted(chunks, key=lambda chunk: (-sum(1 for term in terms if term in f"{chunk.get('symbol') or ''} {chunk['content']}".lower()), chunk["id"]))
        vector_order = sorted(chunks, key=lambda chunk: (-_cosine(query_vector, chunk.get("embedding")), chunk["id"]))
        lexical_rank = {item["id"]: rank for rank, item in enumerate(lexical_order, 1)}
        vector_rank = {item["id"]: rank for rank, item in enumerate(vector_order, 1)}
        graph_rows = self.graph.retrieve(payload["repository"], sorted(exact), max_hops=2) if hasattr(self.graph, "retrieve") else []
        graph_distance = {item["path"]: item["distance"] for item in graph_rows}
        changed_paths = set(payload.get("changed_paths", []))
        for chunk in chunks:
            haystack = f"{chunk.get('symbol') or ''} {chunk['content']}".lower()
            exact_score = 1 if (chunk.get("symbol") or "").lower() in exact else 0
            lexical_score = sum(1 for term in terms if term in haystack)
            vector_score = _cosine(query_vector, chunk.get("embedding"))
            reason = "exact-symbol+lexical" if exact_score and lexical_score else "exact-symbol" if exact_score else "lexical" if lexical_score else "vector"
            rrf_lexical = 61 / (60 + lexical_rank[chunk["id"]])
            rrf_vector = 61 / (60 + vector_rank[chunk["id"]])
            symbol_boost = 1.0 if exact_score else 0.0
            distance = graph_distance.get(chunk["path"])
            graph_boost = {0: 1.0, 1: 0.7, 2: 0.4, 3: 0.2}.get(distance, 0.0)
            git_boost = 1.0 if chunk["path"] in changed_paths else 0.0
            fused_score = .30 * rrf_lexical + .25 * rrf_vector + .25 * symbol_boost + .10 * graph_boost + .10 * git_boost
            category = "exact_symbols" if exact_score else "tests" if re.search(r"(^|/)(test|tests|spec)", chunk["path"], re.I) else "relevant_code"
            candidates.append({
                **chunk,
                "reason": reason,
                "priority": 1 if exact_score else 2 if lexical_score else 5,
                "score": fused_score, "category": category,
                "scores": {"lexical_rank": lexical_rank[chunk["id"]], "vector_rank": vector_rank[chunk["id"]], "vector_raw": vector_score, "graph_distance": distance, "git_affinity": git_boost},
                "provenance": {"path": chunk["path"], "symbol": chunk.get("symbol"), "content_hash": chunk["content_hash"]},
            })
        authority_rank = {"HUMAN": 1, "POLICY": 2, "CI": 3, "SOURCE_CODE": 4, "TOOL": 5, "LLM_INFERENCE": 99}
        memories = sorted(self.repository.search_active(authorized_scopes), key=lambda item: (authority_rank.get(item.authority, 50), item.scope, item.canonical_key, -item.version))
        for rank, memory in enumerate(memories, 1):
            candidates.append({
                "id": f"memory:{memory.id}", "content": memory.summary,
                "content_hash": sha256(memory.summary.encode()).hexdigest(),
                "token_count": max(1, math.ceil(len(memory.summary) / 4)),
                "reason": "scoped-authoritative-memory", "priority": 4, "score": 61 / (60 + rank), "category": "memory",
                "scores": {"memory_authority_rank": authority_rank.get(memory.authority, 50), "memory_rank": rank},
                "provenance": {"memory_id": memory.id, "scope": memory.scope, "authority": memory.authority},
            })
        candidates.sort(key=lambda item: (item["priority"], -item["score"], item["id"]))
        selected, token_count = [], 0
        seen = set()
        reserves = {"exact_symbols": .25, "relevant_code": .30, "tests": .12, "architecture": .10, "memory": .08, "security": .07, "constraints": .08}
        measured = []
        for candidate in candidates:
            content_hash = candidate["content_hash"]
            if content_hash in seen:
                continue
            seen.add(content_hash)
            tokens = self.token_counter.count(candidate["content"]) if self.token_counter else candidate["token_count"]
            measured.append({**candidate, "token_count": tokens})
        chosen = set()
        for category, ratio in reserves.items():
            used = 0
            for candidate in (item for item in measured if item.get("category") == category):
                if used + candidate["token_count"] <= effective_budget * ratio and token_count + candidate["token_count"] <= effective_budget:
                    selected.append(candidate); chosen.add(candidate["id"]); used += candidate["token_count"]; token_count += candidate["token_count"]
        remaining = sorted((item for item in measured if item["id"] not in chosen), key=lambda item: (-item["score"] / max(item["token_count"], 1), item["id"]))
        for candidate in remaining:
            if token_count + candidate["token_count"] <= effective_budget:
                selected.append(candidate); token_count += candidate["token_count"]
        selected.sort(key=lambda item: (-item["score"], item["id"]))
        policy = payload.get("retrieval_policy_version", "retrieval-v2")
        packing = payload.get("packing_policy_version", "packing-v2")
        identity = json.dumps({
            "schema_version": 2, "task_id": payload["task_id"], "repository_id": payload["repository"],
            "commit": payload.get("commit"), "query_hash": sha256(query.encode()).hexdigest(), "budget": effective_budget,
            "model_window": model_window, "envelope_reserves": envelope_reserves,
            "retrieval_policy_version": policy, "packing_policy_version": packing,
            "embedding_model": self.embedder.model, "embedding_dimensions": self.embedder.dimensions,
            "tokenizer": self.token_counter.model if self.token_counter else "approx-chars-v1",
            "tokenizer_version": payload.get("tokenizer_version", "1"), "index_schema_version": payload.get("index_schema_version"),
            "index_snapshot": payload.get("index_snapshot") or payload.get("commit"), "graph_snapshot": payload.get("graph_snapshot"),
            "artifacts": [(item["id"], item["content_hash"], item["reason"]) for item in selected],
        }, sort_keys=True, separators=(",", ":"))
        return {
            "schema_version": 2,
            "context_id": "ctx_" + sha256(identity.encode()).hexdigest(),
            "task_id": payload["task_id"],
            "token_count": token_count,
            "budget": effective_budget,
            "requested_budget": requested_budget,
            "envelope": {"model_window": model_window, "available": available, **envelope_reserves},
            "artifacts": selected,
            "embedding_model": self.embedder.model,
            "token_count_model": self.token_counter.model if self.token_counter else None,
            "retrieval_policy_version": policy,
            "packing_policy_version": packing,
            "tokenizer_version": payload.get("tokenizer_version", "1"),
            "index_snapshot": payload.get("index_snapshot") or payload.get("commit"),
            "graph_snapshot": payload.get("graph_snapshot"),
            "metrics": {"retrieved_candidates": len(candidates), "selected_candidates": len(selected), "candidate_tokens": sum(item["token_count"] for item in measured), "selected_tokens": token_count, "dedup_saved_tokens": sum(item.get("token_count", 0) for item in candidates) - sum(item["token_count"] for item in measured), "graph_hits": len(graph_rows), "memory_hits": len(memories)},
        }
