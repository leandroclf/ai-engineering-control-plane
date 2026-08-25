from base64 import b64encode
from hashlib import sha256
import json
import posixpath
import urllib.error
import urllib.request

RELATION_TYPES = {"IMPORTS", "CALLS", "IMPLEMENTS", "EXTENDS", "DEPENDS_ON", "TESTS", "GOVERNS", "AFFECTS"}


class NullGraphProjection:
    """Deterministic no-op projection used when graph retrieval is optional."""

    def apply(self, repository, payload, rebuild=False):
        return None

    def impact(self, repository, path):
        return []

    def retrieve(self, repository, symbols=None, paths=None, limit=25, max_hops=2):
        return []


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
        occurrences = {}
        for source_file in payload.get("files", []):
            statements.append({
                "statement": """MATCH (r:Repository {id: $repository})
                MERGE (f:File {repository_id: $repository, path: $path})
                SET f.oid=$oid MERGE (r)-[:CONTAINS]->(f)""",
                "parameters": {"repository": repository, "path": source_file["path"], "oid": source_file["oid"]},
            })
            for symbol in source_file.get("symbols", []):
                semantic_key = (symbol.get("language", "javascript"), symbol.get("semanticContainer", source_file["path"]),
                                symbol["qualifiedName"], symbol["kind"], symbol.get("signatureHash", ""))
                occurrences[semantic_key] = occurrences.get(semantic_key, 0) + 1
                identity = "\0".join((repository, *semantic_key, str(occurrences[semantic_key])))
                symbol_id = sha256(identity.encode()).hexdigest()
                statements.append({
                    "statement": """MATCH (f:File {repository_id: $repository, path: $path})
                    MERGE (s:Symbol {id: $id}) SET s.repository_id=$repository,
                    s.qualified_name=$name, s.kind=$kind, s.language=$language,
                    s.semantic_container=$container, s.signature_hash=$signature_hash, s.line_start=$line
                    MERGE (f)-[:DECLARES]->(s)""",
                    "parameters": {"repository": repository, "path": source_file["path"], "id": symbol_id,
                                   "name": symbol["qualifiedName"], "kind": symbol["kind"], "language": symbol.get("language", "javascript"),
                                   "container": symbol.get("semanticContainer", source_file["path"]), "signature_hash": symbol.get("signatureHash", ""), "line": symbol["lineStart"]},
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
        for source_file in payload.get("files", []):
            for reference in source_file.get("references", []):
                target = reference.get("target", "")
                relation = reference.get("type", "IMPORTS").upper()
                if relation not in RELATION_TYPES:
                    raise ValueError(f"unsupported graph relation: {relation}")
                if relation == "IMPORTS" and target.startswith("."):
                    normalized = posixpath.normpath(posixpath.join(posixpath.dirname(source_file["path"]), target))
                    candidates = [normalized] if posixpath.splitext(normalized)[1] else [normalized + extension for extension in (".js", ".mjs", ".cjs", ".ts", ".tsx", ".py", ".go")]
                    statements.append({
                        "statement": """MATCH (source:File {repository_id: $repository, path: $source})
                        MATCH (target:File {repository_id: $repository}) WHERE target.path IN $targets
                        MERGE (source)-[r:IMPORTS]->(target) SET r.line=$line, r.deterministic=true""",
                        "parameters": {"repository": repository, "source": source_file["path"], "targets": candidates, "line": reference.get("line")},
                    })
                elif relation == "IMPORTS":
                    external_id = sha256(f"{repository}\0{target}".encode()).hexdigest()
                    statements.append({
                        "statement": """MATCH (source:File {repository_id: $repository, path: $source})
                        MERGE (target:ExternalReference {id: $id}) SET target.repository_id=$repository, target.name=$target
                        MERGE (source)-[r:IMPORTS]->(target) SET r.line=$line, r.deterministic=true""",
                        "parameters": {"repository": repository, "source": source_file["path"], "id": external_id, "target": target, "line": reference.get("line")},
                    })
        self._execute(statements)

    def impact(self, repository, path):
        result = self._execute([{
            "statement": """MATCH (changed:File {repository_id: $repository, path: $path})
            MATCH (changed)<-[:IMPORTS*1..5]-(dependent:File)
            RETURN DISTINCT dependent.path ORDER BY dependent.path""",
            "parameters": {"repository": repository, "path": path},
        }])
        data = result.get("results", [{}])[0].get("data", [])
        return [item["row"][0] for item in data]

    def retrieve(self, repository, symbols=None, paths=None, limit=25, max_hops=2):
        symbols = symbols or []
        paths = paths or []
        if not symbols and not paths:
            return []
        if max_hops not in (1, 2):
            raise ValueError("graph traversal max_hops must be 1 or 2")
        relationship = ":IMPORTS*1..1" if max_hops == 1 else ":IMPORTS*1..2"
        result = self._execute([{
            "statement": f"""MATCH (origin:File {{repository_id:$repository}})
            WHERE origin.path IN $paths OR EXISTS {{
              MATCH (origin)-[:DECLARES]->(s:Symbol)
              WHERE toLower(s.qualified_name) IN $symbols
            }}
            OPTIONAL MATCH p=(origin)-[{relationship}]-(related:File)
            WITH coalesce(related, origin) AS candidate,
              CASE WHEN p IS NULL THEN 0 ELSE length(p) END AS distance
            RETURN candidate.path AS path, min(distance) AS distance
            ORDER BY distance, path LIMIT $limit""",
            "parameters": {"repository": repository, "symbols": [value.lower() for value in symbols], "paths": sorted(set(paths)), "limit": limit},
        }])
        return [{"path": item["row"][0], "distance": item["row"][1]} for item in result.get("results", [{}])[0].get("data", [])]

    def _execute(self, statements):
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
        return result
