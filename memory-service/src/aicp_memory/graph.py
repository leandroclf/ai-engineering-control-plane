from base64 import b64encode
import json
import urllib.error
import urllib.request


class Neo4jGraphProjection:
    def __init__(self, endpoint, auth, opener=urllib.request.urlopen):
        self.endpoint = endpoint.rstrip("/") + "/db/neo4j/tx/commit"
        self.authorization = "Basic " + b64encode(auth.replace("/", ":", 1).encode()).decode()
        self.opener = opener

    def apply(self, repository, payload, rebuild=False):
        statements = []
        if rebuild:
            statements.append({"statement": "MATCH (n {repository_id: $repository}) DETACH DELETE n", "parameters": {"repository": repository}})
        delete_paths = sorted(set(payload.get("deleted", [])) | {item["path"] for item in payload.get("files", [])})
        if delete_paths:
            statements.append({
                "statement": "MATCH (f:File {repository_id: $repository}) WHERE f.path IN $paths DETACH DELETE f",
                "parameters": {"repository": repository, "paths": delete_paths},
            })
        statements.append({
            "statement": "MERGE (r:Repository {id: $repository}) SET r.repository_id=$repository",
            "parameters": {"repository": repository},
        })
        for source_file in payload.get("files", []):
            statements.append({
                "statement": """MATCH (r:Repository {id: $repository})
                MERGE (f:File {repository_id: $repository, path: $path})
                SET f.oid=$oid MERGE (r)-[:CONTAINS]->(f)""",
                "parameters": {"repository": repository, "path": source_file["path"], "oid": source_file["oid"]},
            })
            for symbol in source_file.get("symbols", []):
                symbol_id = f"{repository}:{source_file['path']}:{symbol['qualifiedName']}:{symbol['lineStart']}"
                statements.append({
                    "statement": """MATCH (f:File {repository_id: $repository, path: $path})
                    MERGE (s:Symbol {id: $id}) SET s.repository_id=$repository,
                    s.qualified_name=$name, s.kind=$kind, s.line_start=$line
                    MERGE (f)-[:DECLARES]->(s)""",
                    "parameters": {"repository": repository, "path": source_file["path"], "id": symbol_id,
                                   "name": symbol["qualifiedName"], "kind": symbol["kind"], "line": symbol["lineStart"]},
                })
            for chunk in source_file.get("chunks", []):
                statements.append({
                    "statement": """MATCH (f:File {repository_id: $repository, path: $path})
                    MERGE (c:Chunk {id: $id}) SET c.repository_id=$repository,
                    c.text=$content, c.symbol=$symbol, c.content_hash=$content_hash
                    MERGE (f)-[:HAS_CHUNK]->(c)""",
                    "parameters": {"repository": repository, "path": source_file["path"], "id": chunk["id"],
                                   "content": chunk["content"], "symbol": chunk.get("symbol"),
                                   "content_hash": chunk["content_hash"]},
                })
        request = urllib.request.Request(
            self.endpoint, method="POST",
            headers={"Authorization": self.authorization, "Content-Type": "application/json"},
            data=json.dumps({"statements": statements}).encode(),
        )
        try:
            with self.opener(request, timeout=60) as response:
                result = json.load(response)
        except urllib.error.HTTPError as error:
            detail = error.read().decode(errors="replace")
            raise RuntimeError(f"Neo4j projection HTTP {error.code}: {detail}") from error
        if result.get("errors"):
            raise RuntimeError(f"Neo4j projection failed: {result['errors']}")
