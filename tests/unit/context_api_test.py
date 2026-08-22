import json
import unittest

from aicp_memory.api.application import MemoryApplication
from aicp_memory.auth import Principal, StaticAuthorizer
from aicp_memory.domain.ledger import MemoryLedger


class FakeContextService:
    def __init__(self):
        self.calls = []

    def index_state(self, repository):
        self.calls.append(("state", repository))
        return {"files": [{"path": "app.js", "oid": "1"}]}

    def sync(self, repository, payload, rebuild=False):
        self.calls.append(("sync", repository, rebuild, payload))
        return {"repository": repository, "parsed": 1, "reused": 0, "embedded": 1, "embedding_reused": 0}

    def compile(self, payload, authorized_scopes):
        self.calls.append(("compile", payload, authorized_scopes))
        return {"context_id": "ctx_1", "token_count": 4, "budget": payload["budget"], "artifacts": []}


class ContextApplicationTest(unittest.TestCase):
    def setUp(self):
        principal = Principal(
            "agent:a",
            frozenset({"REPOSITORY:repo-a", "PROJECT:A"}),
            frozenset({"create", "read", "index", "compile"}),
        )
        self.context = FakeContextService()
        self.app = MemoryApplication(MemoryLedger(), StaticAuthorizer({"token": principal}), self.context)

    def request(self, method, path, payload=None):
        return self.app.handle(
            method, path, {"authorization": "Bearer token"},
            json.dumps(payload).encode() if payload is not None else b"",
        )

    def test_index_state_sync_and_rebuild_require_repository_scope(self):
        self.assertEqual(self.request("GET", "/v1/index/repositories/repo-a").status, 200)
        sync = self.request("POST", "/v1/index/repositories/repo-a:sync", {"files": []})
        rebuild = self.request("POST", "/v1/index/repositories/repo-a:rebuild", {"files": []})
        denied = self.request("POST", "/v1/index/repositories/repo-b:sync", {"files": []})

        self.assertEqual(sync.status, 200)
        self.assertEqual(rebuild.status, 200)
        self.assertEqual(denied.status, 403)
        self.assertIn(("sync", "repo-a", True, {"files": []}), self.context.calls)

    def test_context_compile_passes_only_authorized_requested_scopes(self):
        response = self.request("POST", "/v1/context:compile", {
            "repository": "repo-a", "task_id": "task-1", "query": "Service.run",
            "scopes": ["PROJECT:A"], "budget": 100,
        })
        denied = self.request("POST", "/v1/context:compile", {
            "repository": "repo-a", "task_id": "task-2", "query": "secret",
            "scopes": ["PROJECT:B"], "budget": 100,
        })

        self.assertEqual(response.status, 200)
        self.assertEqual(response.body["context_id"], "ctx_1")
        self.assertEqual(denied.status, 403)
        self.assertIn(("compile", {
            "repository": "repo-a", "task_id": "task-1", "query": "Service.run",
            "scopes": ["PROJECT:A"], "budget": 100,
        }, ["PROJECT:A"]), self.context.calls)

    def test_dependency_failure_returns_structured_service_unavailable(self):
        self.context.sync = lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("secret upstream detail"))

        response = self.request("POST", "/v1/index/repositories/repo-a:sync", {"files": []})

        self.assertEqual(response.status, 503)
        self.assertEqual(response.body, {"error": "DEPENDENCY_UNAVAILABLE"})
