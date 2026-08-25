import base64
import io
import json
import unittest
import urllib.error

from aicp_memory.graph import Neo4jGraphProjection, NullGraphProjection


class Response(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


class Neo4jGraphProjectionTest(unittest.TestCase):
    def test_optional_graph_projection_is_deterministic_noop(self):
        graph = NullGraphProjection()
        self.assertIsNone(graph.apply("repo", {"files": []}))
        self.assertEqual(graph.impact("repo", "app.js"), [])
        self.assertEqual(graph.retrieve("repo", ["Service.run"], ["app.js"]), [])

    def test_http_error_exposes_neo4j_response_without_credentials(self):
        def failing_open(request, timeout):
            self.assertNotIn("password", request.full_url)
            self.assertEqual(base64.b64decode(request.headers["Authorization"].removeprefix("Basic ")).decode(), "neo4j:password")
            raise urllib.error.HTTPError(
                request.full_url, 400, "Bad Request", {}, io.BytesIO(b'{"errors":[{"message":"invalid cypher"}]}'),
            )

        graph = Neo4jGraphProjection("http://neo4j:7474", "neo4j/password", opener=failing_open)

        with self.assertRaisesRegex(RuntimeError, "invalid cypher"):
            graph.apply("repo", {"files": [], "deleted": []})

    def test_projects_local_import_after_file_nodes_and_traverses_dependents(self):
        requests = []

        def open_request(request, timeout):
            payload = json.loads(request.data)
            requests.append(payload)
            if "RETURN DISTINCT dependent.path" in payload["statements"][0]["statement"]:
                return Response(b'{"results":[{"data":[{"row":["app.js"]}]}],"errors":[]}')
            return Response(b'{"results":[],"errors":[]}')

        graph = Neo4jGraphProjection("http://neo4j:7474", "neo4j/password", opener=open_request)
        graph.apply("repo", {"files": [
            {"path": "app.js", "oid": "1", "symbols": [], "chunks": [], "references": [{"target": "./lib.js", "line": 1}]},
            {"path": "lib.js", "oid": "2", "symbols": [], "chunks": [], "references": []},
        ], "deleted": []})

        statements = requests[0]["statements"]
        import_index = next(index for index, item in enumerate(statements) if "IMPORTS" in item["statement"])
        file_indexes = [index for index, item in enumerate(statements) if "MERGE (f:File" in item["statement"]]
        self.assertGreater(import_index, max(file_indexes))
        self.assertIn("lib.js", statements[import_index]["parameters"]["targets"])
        self.assertEqual(graph.impact("repo", "lib.js"), ["app.js"])

    def test_retrieval_uses_multiple_seed_sources_and_true_minimum_path_length(self):
        requests = []

        def open_request(request, timeout):
            payload = json.loads(request.data)
            requests.append(payload)
            return Response(b'{"results":[{"data":[{"row":["a.js",0]},{"row":["b.js",2]}]}],"errors":[]}')

        graph = Neo4jGraphProjection("http://neo4j:7474", "neo4j/password", opener=open_request)
        result = graph.retrieve("repo", ["Service.run"], ["changed.js"], max_hops=2)

        statement = requests[0]["statements"][0]
        self.assertIn("length(p)", statement["statement"])
        self.assertIn("min(distance)", statement["statement"])
        self.assertIn(":IMPORTS*1..2", statement["statement"])
        self.assertEqual(statement["parameters"]["paths"], ["changed.js"])
        self.assertEqual(result, [{"path": "a.js", "distance": 0}, {"path": "b.js", "distance": 2}])

    def test_projection_rejects_untrusted_relation_types(self):
        graph = Neo4jGraphProjection("http://neo4j:7474", "neo4j/password", opener=lambda *_args, **_kwargs: Response(b'{"results":[],"errors":[]}'))
        with self.assertRaisesRegex(ValueError, "unsupported graph relation"):
            graph.apply("repo", {"files": [{"path": "a.js", "oid": "1", "symbols": [], "chunks": [], "references": [{"target": "b", "type": "DELETES_ALL"}]}]})


if __name__ == "__main__":
    unittest.main()
