import unittest

from aicp_memory.context_service import ContextService


class FakeRepository:
    def __init__(self):
        self.synced = None
        self.queries = []

    def index_state(self, repository):
        return {"files": []}

    def cached_embedding(self, chunk_id, content_hash, model, dimensions):
        return [0.5, 0.5] if chunk_id == "cached" else None

    def sync_index(self, repository, payload, rebuild=False):
        self.synced = (repository, payload, rebuild)

    def retrieve_chunks(self, repository, query, exact_symbols=None, limit=50):
        self.queries.append((repository, query, exact_symbols))
        return [
            {"id": "exact", "path": "service.js", "symbol": "Service.run", "content": "run payment", "content_hash": "h1", "token_count": 4, "embedding": [0, 1]},
            {"id": "vector", "path": "other.js", "symbol": "Other.run", "content": "other", "content_hash": "h2", "token_count": 8, "embedding": [1, 0]},
        ]

    def search_active(self, scopes):
        return []


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

    def test_compile_ranks_exact_before_vector_and_respects_budget(self):
        service = ContextService(FakeRepository(), FakeEmbedder(), FakeGraph())

        result = service.compile({
            "repository": "repo", "task_id": "task-1", "query": "Service.run payment",
            "exact_symbols": ["Service.run"], "budget": 6,
        }, [])

        self.assertEqual(result["token_count"], 4)
        self.assertEqual([item["id"] for item in result["artifacts"]], ["exact"])
        self.assertEqual(result["artifacts"][0]["reason"], "exact-symbol+lexical")
        self.assertTrue(result["context_id"].startswith("ctx_"))
        self.assertEqual(service.repository.queries, [("repo", "Service.run payment", ["service.run"])])

    def test_sync_does_not_advance_index_when_graph_projection_fails(self):
        repository = FakeRepository()
        service = ContextService(repository, FakeEmbedder(), FailingGraph())

        with self.assertRaisesRegex(RuntimeError, "graph unavailable"):
            service.sync("repo", {"files": [], "deleted": []})

        self.assertIsNone(repository.synced)
