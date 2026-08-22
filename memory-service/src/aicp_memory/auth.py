from dataclasses import dataclass

from aicp_memory.domain.ledger import AuthorizationError


@dataclass(frozen=True)
class Principal:
    actor_id: str
    scopes: frozenset[str]
    actions: frozenset[str]

    def require(self, action, scope=None):
        if action not in self.actions:
            raise AuthorizationError(f"action not authorized: {action}")
        if scope is not None and scope not in self.scopes:
            raise AuthorizationError(f"scope not authorized: {scope}")


class StaticAuthorizer:
    def __init__(self, tokens):
        self.tokens = dict(tokens)

    def authenticate(self, headers):
        authorization = headers.get("authorization", "")
        prefix = "Bearer "
        if not authorization.startswith(prefix):
            raise LookupError("missing bearer token")
        principal = self.tokens.get(authorization[len(prefix):])
        if not principal:
            raise LookupError("invalid bearer token")
        return principal
