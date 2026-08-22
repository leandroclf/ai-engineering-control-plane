import unittest

from aicp_memory.repository import PostgresMemoryRepository


class RecordingCursor:
    def __init__(self):
        self.queries = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return None

    def execute(self, sql, params=None):
        self.queries.append((" ".join(sql.split()), params))
        return self


class RecordingConnection:
    def __init__(self, cursor):
        self.recording_cursor = cursor

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return None

    def cursor(self):
        return self.recording_cursor


class PostgresIndexRepositoryTest(unittest.TestCase):
    def test_sync_replaces_reference_delta_in_canonical_index(self):
        cursor = RecordingCursor()
        repository = PostgresMemoryRepository("unused", connect=lambda: RecordingConnection(cursor))

        repository.sync_index("repo", {
            "parser_version": "js-1", "schema_version": "1", "files": [{
                "path": "app.js", "oid": "1", "symbols": [], "chunks": [],
                "references": [{"target": "./lib.js", "line": 2, "kind": "import"}],
            }], "deleted": [],
        })

        self.assertTrue(any("DELETE FROM memory.index_references" in sql for sql, _ in cursor.queries))
        insert = next(item for item in cursor.queries if "INSERT INTO memory.index_references" in item[0])
        self.assertEqual(insert[1], ("repo", "app.js", "./lib.js", 2, "import"))


if __name__ == "__main__":
    unittest.main()
