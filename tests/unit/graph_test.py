import base64
import io
import json
import unittest
import urllib.error

from aicp_memory.graph import Neo4jGraphProjection


class Response(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


class Neo4jGraphProjectionTest(unittest.TestCase):
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
        self.assertEqual(statements[import_index]["parameters"]["target"], "lib.js")
        self.assertEqual(graph.impact("repo", "lib.js"), ["app.js"])


if __name__ == "__main__":
    unittest.main()
