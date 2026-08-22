import json
import unittest

from aicp_memory.api.application import MemoryApplication
from aicp_memory.auth import Principal, StaticAuthorizer
from aicp_memory.domain.ledger import MemoryLedger


class MemoryApplicationTest(unittest.TestCase):
    def setUp(self):
        authorizer = StaticAuthorizer({
            "token-a": Principal("agent:a", frozenset({"EXECUTION:T1", "PROJECT:A"}), frozenset({"create", "read", "promote", "invalidate", "supersede"})),
            "token-b": Principal("agent:b", frozenset({"PROJECT:B"}), frozenset({"read"})),
        })
        self.app = MemoryApplication(MemoryLedger(), authorizer)

    def request(self, method, path, token, payload=None):
        body = json.dumps(payload).encode() if payload is not None else b""
        return self.app.handle(method, path, {"authorization": f"Bearer {token}"}, body)

    def test_create_promote_search_and_get(self):
        created = self.request("POST", "/v1/memories", "token-a", {
            "scope": "EXECUTION:T1", "canonical_key": "architecture.db", "summary": "PostgreSQL",
            "authority": "HUMAN", "kind": "DECISION", "idempotency_key": "create-1",
        })
        self.assertEqual(created.status, 201)
        memory_id = created.body["id"]
        promoted = self.request("POST", f"/v1/memories/{memory_id}:promote", "token-a", {"target_scope": "PROJECT:A"})
        self.assertEqual(promoted.status, 200)
        search = self.request("GET", "/v1/memories/search?scope=PROJECT:A", "token-a")
        self.assertEqual([item["id"] for item in search.body["items"]], [memory_id])
        self.assertEqual(self.request("GET", f"/v1/memories/{memory_id}", "token-a").status, 200)

    def test_cross_project_search_and_missing_auth_are_denied(self):
        denied = self.request("GET", "/v1/memories/search?scope=PROJECT:A", "token-b")
        missing = self.app.handle("GET", "/v1/memories/search?scope=PROJECT:A", {}, b"")

        self.assertEqual(denied.status, 403)
        self.assertEqual(missing.status, 401)
