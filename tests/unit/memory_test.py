import unittest

from aicp_memory.domain.ledger import MemoryLedger


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


if __name__ == "__main__":
    unittest.main()
