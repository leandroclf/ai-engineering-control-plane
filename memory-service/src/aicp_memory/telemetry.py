from hashlib import sha256
import json
import time
import urllib.error
import urllib.request
from uuid import uuid4


class OtlpHttpTelemetry:
    def __init__(self, endpoint, opener=urllib.request.urlopen, service_name="aicp-memory"):
        self.endpoint = endpoint.rstrip("/") if endpoint else ""
        self.opener = opener
        self.service_name = service_name

    def request(self, *, request_id, task_id=None, route, status, **_ignored):
        if not self.endpoint:
            return False
        now = time.time_ns()
        values = {"request_id": request_id, "route": route, "status": status}
        if task_id:
            values["task_id"] = task_id
        attributes = [{"key": f"aicp.{key}", "value": {"stringValue": str(value)}} for key, value in values.items()]
        payload = {"resourceSpans": [{
            "resource": {"attributes": [{"key": "service.name", "value": {"stringValue": self.service_name}}]},
            "scopeSpans": [{"scope": {"name": "aicp.telemetry"}, "spans": [{
                "traceId": sha256(str(task_id or request_id).encode()).hexdigest()[:32],
                "spanId": uuid4().hex[:16], "name": f"http {route}",
                "startTimeUnixNano": str(now), "endTimeUnixNano": str(now + 1),
                "attributes": attributes, "status": {"code": 1 if status < 500 else 2},
            }]}],
        }]}
        request = urllib.request.Request(
            self.endpoint + "/v1/traces", method="POST",
            headers={"Content-Type": "application/json"}, data=json.dumps(payload).encode(),
        )
        try:
            with self.opener(request, timeout=5) as response:
                return 200 <= getattr(response, "status", 200) < 300
        except urllib.error.URLError:
            return False
