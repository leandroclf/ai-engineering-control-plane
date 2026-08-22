import base64
import io
import unittest
import urllib.error

from aicp_memory.graph import Neo4jGraphProjection


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


if __name__ == "__main__":
    unittest.main()
