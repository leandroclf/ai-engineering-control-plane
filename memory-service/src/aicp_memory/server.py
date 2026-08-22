import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit
from uuid import uuid4

from aicp_memory.api.application import MemoryApplication
from aicp_memory.auth import Principal, StaticAuthorizer
from aicp_memory.context_service import ContextService
from aicp_memory.embedding import LiteLLMEmbedder
from aicp_memory.graph import Neo4jGraphProjection
from aicp_memory.repository import PostgresMemoryRepository
from aicp_memory.token_counter import LiteLLMTokenCounter
from aicp_memory.telemetry import OtlpHttpTelemetry


def build_application():
    token = os.environ["MEMORY_SERVICE_TOKEN"]
    scopes = frozenset(filter(None, os.environ.get("MEMORY_AUTHORIZED_SCOPES", "").split(",")))
    actions = frozenset({"create", "read", "promote", "invalidate", "supersede", "index", "compile"})
    repository = PostgresMemoryRepository(os.environ["DATABASE_URL"])
    authorizer = StaticAuthorizer({token: Principal("service:workspace", scopes, actions)})
    embedder = LiteLLMEmbedder(
        os.environ["LITELLM_BASE_URL"], os.environ["LITELLM_API_KEY"],
        model=os.environ.get("EMBEDDING_ALIAS", "embeddings"),
        dimensions=int(os.environ.get("EMBEDDING_DIMENSIONS", "1536")),
    )
    graph = Neo4jGraphProjection(os.environ["NEO4J_HTTP_URL"], os.environ["NEO4J_AUTH"])
    token_counter = LiteLLMTokenCounter(
        os.environ["LITELLM_BASE_URL"], os.environ["LITELLM_API_KEY"],
        model=os.environ.get("CONTEXT_TOKEN_MODEL", "coding-fast"),
    )
    context = ContextService(repository, embedder, graph, token_counter)
    telemetry = OtlpHttpTelemetry(os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT", ""))
    return repository, MemoryApplication(repository, authorizer, context), telemetry


class Handler(BaseHTTPRequestHandler):
    repository = None
    application = None
    telemetry = None

    def do_GET(self):
        if self.path == "/health":
            self._send(200, {"status": "ok", "service": "aicp-memory"})
            return
        if self.path == "/ready":
            try:
                ready = self.repository.ready()
                self._send(200 if ready else 503, {"status": "ready" if ready else "unavailable"})
            except Exception:
                self._send(503, {"status": "unavailable"})
            return
        self._dispatch()

    def do_POST(self):
        self._dispatch()

    def _dispatch(self):
        length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(length)
        response = self.application.handle(self.command, self.path, dict(self.headers.items()), body)
        try:
            payload = json.loads(body or b"{}")
        except json.JSONDecodeError:
            payload = {}
        self.telemetry.request(
            request_id=self.headers.get("X-Request-ID", uuid4().hex),
            task_id=payload.get("task_id"), route=urlsplit(self.path).path, status=response.status,
        )
        self._send(response.status, response.body)

    def _send(self, status, value):
        body = json.dumps(value, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        return


def main():
    Handler.repository, Handler.application, Handler.telemetry = build_application()
    port = int(os.environ.get("PORT", "8080"))
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()


if __name__ == "__main__":
    main()
