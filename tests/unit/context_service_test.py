import unittest
from types import SimpleNamespace

from aicp_memory.context_service import ContextService


class FakeRepository:
    def __init__(self):
        self.synced = None
        self.queries = []
        self.invalidated = None

    def index_state(self, repository):
        return {"files": []}

    def cached_embedding(self, chunk_id, content_hash, model, dimensions):
        return [0.5, 0.5] if chunk_id == "cached" else None

    def sync_index(self, repository, payload, rebuild=False):
        self.synced = (repository, payload, rebuild)
        return 1

    def retrieve_chunks(self, repository, query, exact_symbols=None, limit=50):
        self.queries.append((repository, query, exact_symbols))
        return [
            {"id": "exact", "path": "service.js", "symbol": "Service.run", "content": "run payment", "content_hash": "h1", "token_count": 4, "embedding": [0, 1]},
            {"id": "vector", "path": "other.js", "symbol": "Other.run", "content": "other", "content_hash": "h2", "token_count": 8, "embedding": [1, 0]},
        ]

    def search_active(self, scopes):
        return getattr(self, "memories", [])


class FakeEmbedder:
    model = "embed-v1"
    dimensions = 2

    def __init__(self):
        self.calls = []

    def embed(self, content):
        self.calls.append(content)
        return [1, 0]

    def embed_many(self, contents):
        self.calls.append(list(contents))
        return [[1, 0] for _ in contents]


class FakeTokenCounter:
    model = "coding-fast"

    def __init__(self):
        self.calls = []

    def count(self, content):
        self.calls.append(content)
        return {"run payment": 4, "other": 8}.get(content, 1)


class FakeGraph:
    def __init__(self):
        self.deltas = []

    def apply(self, repository, payload, rebuild=False):
        self.deltas.append((repository, payload, rebuild))


class FailingGraph(FakeGraph):
    def apply(self, repository, payload, rebuild=False):
        raise RuntimeError("graph unavailable")


class ContextServiceTest(unittest.TestCase):
    def test_sync_reuses_persisted_embedding_and_projects_graph(self):
        repository, embedder, graph = FakeRepository(), FakeEmbedder(), FakeGraph()
        service = ContextService(repository, embedder, graph)
        payload = {"files": [{"path": "app.js", "oid": "1", "symbols": [], "chunks": [
            {"id": "cached", "content": "same", "contentHash": "same-hash", "tokenCount": 1},
            {"id": "new", "content": "new", "contentHash": "new-hash", "tokenCount": 1},
        ]}], "deleted": [], "parser_version": "js-1", "schema_version": "1", "commit": "abc"}

        result = service.sync("repo", payload)

        self.assertEqual(result["embedded"], 1)
        self.assertEqual(result["embedding_reused"], 1)
        self.assertEqual(embedder.calls, [["new"]])
        self.assertEqual(repository.synced[0], "repo")
        self.assertEqual(len(graph.deltas), 1)
        self.assertEqual(result["memories_invalidated"], 1)

    def test_compile_ranks_exact_before_vector_and_respects_budget(self):
        counter = FakeTokenCounter()
        service = ContextService(FakeRepository(), FakeEmbedder(), FakeGraph(), counter)

        result = service.compile({
            "repository": "repo", "task_id": "task-1", "query": "Service.run payment",
            "exact_symbols": ["Service.run"], "budget": 6,
        }, [])

        self.assertEqual(result["token_count"], 4)
        self.assertEqual([item["id"] for item in result["artifacts"]], ["exact"])
        self.assertEqual(result["artifacts"][0]["reason"], "exact-symbol+lexical")
        self.assertTrue(result["context_id"].startswith("ctx_"))
        self.assertEqual(service.repository.queries, [("repo", "Service.run payment", ["service.run"])])
        self.assertEqual(counter.calls, ["run payment", "other"])
        self.assertEqual(result["token_count_model"], "coding-fast")
        self.assertEqual(result["schema_version"], 3)
        self.assertEqual(result["retrieval_policy_version"], "retrieval-v3")
        self.assertTrue(result["metrics"]["vector_skipped"])
        self.assertEqual(service.embedder.calls, [])

    def test_context_identity_changes_with_semantic_policy_or_index_version(self):
        service = ContextService(FakeRepository(), FakeEmbedder(), FakeGraph(), FakeTokenCounter())
        base = {"repository": "repo", "task_id": "task-1", "query": "Service.run payment",
                "exact_symbols": ["Service.run"], "budget": 6, "index_schema_version": "5"}
        first = service.compile(base, [])
        same = service.compile(dict(base), [])
        changed_policy = service.compile({**base, "retrieval_policy_version": "retrieval-v4"}, [])
        changed_index = service.compile({**base, "index_schema_version": "6"}, [])
        self.assertEqual(first["context_id"], same["context_id"])
        self.assertNotEqual(first["context_id"], changed_policy["context_id"])
        self.assertNotEqual(first["context_id"], changed_index["context_id"])

    def test_sync_does_not_advance_index_when_graph_projection_fails(self):
        repository = FakeRepository()
        service = ContextService(repository, FakeEmbedder(), FailingGraph())

        with self.assertRaisesRegex(RuntimeError, "graph unavailable"):
            service.sync("repo", {"files": [], "deleted": []})

        self.assertIsNone(repository.synced)

    def test_context_envelope_is_effective_budget_and_part_of_identity(self):
        service = ContextService(FakeRepository(), FakeEmbedder(), FakeGraph(), FakeTokenCounter())
        base = {"repository": "repo", "task_id": "task", "query": "payment", "budget": 100,
                "model_window": 20, "output_reserve": 4, "system_reserve": 3,
                "tool_schema_reserve": 2, "safety_reserve": 1}
        result = service.compile(base, [])
        self.assertEqual(result["budget"], 10)
        self.assertLessEqual(result["token_count"], result["budget"])
        self.assertNotEqual(result["context_id"], service.compile({**base, "safety_reserve": 2}, [])["context_id"])

    def test_vector_is_used_when_cheap_retrieval_confidence_is_low(self):
        embedder = FakeEmbedder()
        result = ContextService(FakeRepository(), embedder, FakeGraph(), FakeTokenCounter()).compile({
            "repository": "repo", "task_id": "task", "query": "unrelated semantic intent", "budget": 20,
        }, [])
        self.assertFalse(result["metrics"]["vector_skipped"])
        self.assertEqual(embedder.calls, ["unrelated semantic intent"])

    def test_memory_requires_query_relevance(self):
        repository = FakeRepository()
        repository.memories = [
            SimpleNamespace(id="relevant", summary="payment retry policy", canonical_key="payments", authority="POLICY", scope="PROJECT:A", version=1),
            SimpleNamespace(id="noise", summary="office lunch menu", canonical_key="lunch", authority="HUMAN", scope="PROJECT:A", version=1),
        ]
        result = ContextService(repository, FakeEmbedder(), FakeGraph(), FakeTokenCounter()).compile({
            "repository": "repo", "task_id": "task", "query": "payment policy", "budget": 20,
        }, ["PROJECT:A"])
        memory_ids = [item["id"] for item in result["artifacts"] if item["id"].startswith("memory:")]
        self.assertIn("memory:relevant", memory_ids)
        self.assertNotIn("memory:noise", memory_ids)
        self.assertEqual(result["metrics"]["memory_hits"], 1)

    def test_memory_ranking_accounts_for_scope_distance_and_authority(self):
        repository = FakeRepository()
        repository.memories = [
            SimpleNamespace(id="global", summary="payment settlement policy", canonical_key="payments", authority="HUMAN", scope="GLOBAL:all", version=1),
            SimpleNamespace(id="repo", summary="payment retry policy", canonical_key="payments", authority="POLICY", scope="REPOSITORY:aicp", version=1),
        ]
        result = ContextService(repository, FakeEmbedder(), FakeGraph(), FakeTokenCounter()).compile({
            "repository": "repo", "task_id": "task", "query": "payment policy", "budget": 40,
        }, ["REPOSITORY:aicp", "GLOBAL:all"])
        memories = [item for item in result["artifacts"] if item["id"].startswith("memory:")]
        self.assertEqual([item["id"] for item in memories], ["memory:repo", "memory:global"])
        self.assertEqual(memories[0]["scores"]["memory_scope_distance"], 0)

    def test_same_snapshot_produces_deterministic_context(self):
        service = ContextService(FakeRepository(), FakeEmbedder(), FakeGraph(), FakeTokenCounter())
        payload = {"repository": "repo", "task_id": "task", "query": "Service.run payment",
                   "exact_symbols": ["Service.run"], "budget": 20, "index_snapshot": "commit-1", "graph_snapshot": "graph-1"}
        self.assertEqual(service.compile(payload, [])["context_id"], service.compile(payload, [])["context_id"])
