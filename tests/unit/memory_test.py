import unittest
from datetime import datetime, timedelta, timezone

from aicp_memory.domain.ledger import AuthorizationError, MemoryLedger, SensitiveDataError


class MemoryLedgerTest(unittest.TestCase):
    def test_candidate_requires_explicit_promotion(self):
        ledger = MemoryLedger()
        memory = ledger.create_candidate(
            scope="EXECUTION:TASK-1",
            canonical_key="architecture.database",
            summary="PostgreSQL is canonical",
            authority="HUMAN",
            source_hash="abc",
        )

        self.assertEqual(memory.status, "CANDIDATE")
        self.assertEqual(ledger.search_active(["EXECUTION:TASK-1"]), [])

        promoted = ledger.promote(memory.id, target_scope="REPOSITORY:aicp", actor="human:1")
        self.assertEqual(promoted.status, "ACTIVE")
        self.assertEqual(len(ledger.search_active(["REPOSITORY:aicp"])), 1)

    def test_source_change_invalidates_active_memory(self):
        ledger = MemoryLedger()
        candidate = ledger.create_candidate(
            scope="EXECUTION:TASK-1",
            canonical_key="policy.version",
            summary="Policy v1",
            authority="POLICY",
            source_hash="v1",
        )
        active = ledger.promote(candidate.id, "REPOSITORY:aicp", "human:1")

        ledger.invalidate_stale_source(active.id, current_source_hash="v2", actor="indexer")

        self.assertEqual(ledger.get(active.id).status, "INVALIDATED")
        self.assertEqual(ledger.events[-1].event_type, "INVALIDATED")

    def test_idempotency_does_not_duplicate_candidate_or_event(self):
        ledger = MemoryLedger()
        first = ledger.create_candidate(
            scope="EXECUTION:TASK-1", canonical_key="decision.db", summary="PostgreSQL",
            authority="HUMAN", idempotency_key="request-1",
        )
        replay = ledger.create_candidate(
            scope="EXECUTION:TASK-1", canonical_key="decision.db", summary="PostgreSQL",
            authority="HUMAN", idempotency_key="request-1",
        )

        self.assertEqual(first.id, replay.id)
        self.assertEqual(len(ledger.events), 1)

    def test_search_enforces_scope_and_excludes_expired_memory(self):
        now = datetime(2026, 8, 21, tzinfo=timezone.utc)
        ledger = MemoryLedger(clock=lambda: now)
        project_a = ledger.create_candidate(
            scope="PROJECT:A", canonical_key="policy.a", summary="A only", authority="POLICY",
            expires_at=now + timedelta(minutes=1),
        )
        project_b = ledger.create_candidate(
            scope="PROJECT:B", canonical_key="policy.b", summary="B only", authority="POLICY",
        )
        ledger.promote(project_a.id, "PROJECT:A", "human:1")
        ledger.promote(project_b.id, "PROJECT:B", "human:1")

        self.assertEqual([item.id for item in ledger.search_active(["PROJECT:A"])], [project_a.id])
        now += timedelta(minutes=2)
        self.assertEqual(ledger.search_active(["PROJECT:A"]), [])
        self.assertEqual(ledger.get(project_a.id).status, "EXPIRED")
        self.assertEqual(ledger.events[-1].event_type, "EXPIRED")

    def test_supersede_keeps_only_new_version_active(self):
        ledger = MemoryLedger()
        old = ledger.create_candidate(scope="EXECUTION:T1", canonical_key="decision.db", summary="MySQL", authority="HUMAN")
        ledger.promote(old.id, "PROJECT:A", "human:1")
        new = ledger.supersede(old.id, summary="PostgreSQL", actor="human:1")

        self.assertEqual(ledger.get(old.id).status, "SUPERSEDED")
        self.assertEqual(new.status, "ACTIVE")
        self.assertEqual(new.version, 2)
        self.assertEqual([item.id for item in ledger.search_active(["PROJECT:A"])], [new.id])

    def test_rejects_secret_material_before_persistence(self):
        ledger = MemoryLedger()
        with self.assertRaises(SensitiveDataError):
            ledger.create_candidate(
                scope="EXECUTION:T1", canonical_key="credential", summary="token sk-example-secret-value",
                authority="LLM_INFERENCE",
            )
        self.assertEqual(ledger.events, [])

    def test_authorization_prevents_cross_scope_promotion(self):
        ledger = MemoryLedger()
        memory = ledger.create_candidate(scope="EXECUTION:T1", canonical_key="fact", summary="value", authority="HUMAN")
        with self.assertRaises(AuthorizationError):
            ledger.promote(memory.id, "PROJECT:B", "agent:1", authorized_scopes={"PROJECT:A"})

    def test_llm_inference_cannot_be_promoted_as_policy(self):
        ledger = MemoryLedger()
        memory = ledger.create_candidate(scope="RUN:T1", canonical_key="policy.inferred", summary="inferred rule",
                                         authority="LLM_INFERENCE", kind="POLICY")
        with self.assertRaisesRegex(ValueError, "cannot be promoted"):
            ledger.promote(memory.id, "REPOSITORY:aicp", "agent:1")

    def test_llm_candidate_has_retention_and_requires_confidence_to_promote(self):
        now = datetime(2026, 8, 21, tzinfo=timezone.utc)
        ledger = MemoryLedger(clock=lambda: now)
        memory = ledger.create_candidate(
            scope="RUN:T1", canonical_key="derived.fact", summary="derived evidence",
            authority="LLM_INFERENCE", confidence=.70,
        )
        self.assertEqual(memory.expires_at, now + timedelta(days=7))
        with self.assertRaisesRegex(ValueError, "lacks promotion confidence"):
            ledger.promote(memory.id, "REPOSITORY:aicp", "human:1")

    def test_expired_candidate_is_reconciled_before_promotion(self):
        now = datetime(2026, 8, 21, tzinfo=timezone.utc)
        ledger = MemoryLedger(clock=lambda: now)
        memory = ledger.create_candidate(
            scope="RUN:T1", canonical_key="derived.fact", summary="derived evidence",
            authority="LLM_INFERENCE", confidence=.90,
        )
        now += timedelta(days=8)
        ledger.expire_due()
        self.assertEqual(ledger.get(memory.id).status, "EXPIRED")
        with self.assertRaisesRegex(ValueError, "only candidate"):
            ledger.promote(memory.id, "REPOSITORY:aicp", "human:1")


if __name__ == "__main__":
    unittest.main()
