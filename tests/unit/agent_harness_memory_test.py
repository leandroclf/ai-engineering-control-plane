import json
import unittest

from aicp_memory.api.application import MemoryApplication
from aicp_memory.auth import Principal, StaticAuthorizer
from aicp_memory.domain.ledger import MemoryLedger


class AgentHarnessMemoryTest(unittest.TestCase):
    def setUp(self):
        principal = Principal("human:ops", frozenset({"PROJECT:local", "PROJECT:site"}), frozenset({"create", "read", "promote"}))
        self.app = MemoryApplication(MemoryLedger(), StaticAuthorizer({"token": principal}))

    def request(self, method, path, payload=None):
        return self.app.handle(method, path, {"authorization": "Bearer token"}, json.dumps(payload or {}).encode())

    def test_skill_evidence_transition_and_episode(self):
        created = self.request("POST", "/v1/agent-harness/skills", {"scope": "PROJECT:local", "name": "browser-login", "version": "1.0.0", "created_by": "agent:a", "capabilities": ["browser.fill"]})
        self.assertEqual(created.status, 201)
        transitioned = self.request("POST", "/v1/agent-harness/skills/browser-login@1.0.0:transition", {"scope": "PROJECT:local", "status": "VALIDATED", "evidence": ["test-1"]})
        self.assertEqual(transitioned.status, 200)
        episode = self.request("POST", "/v1/agent-harness/episodes", {"trace_id": "trace-1", "agent_id": "agent:a", "project_id": "local", "status": "SUCCESS"})
        self.assertEqual(episode.status, 201)
        self.assertEqual(len(self.request("GET", "/v1/agent-harness/episodes?project_id=local").body["items"]), 1)

    def test_browser_session_drops_secret_like_fields(self):
        result = self.request("POST", "/v1/agent-harness/browser-sessions", {"session_id": "s1", "agent_id": "agent:a", "project_id": "local", "password": "never-store", "metadata": {"profile": "p1"}})
        self.assertEqual(result.status, 201)
        self.assertNotIn("password", result.body)


if __name__ == "__main__":
    unittest.main()
