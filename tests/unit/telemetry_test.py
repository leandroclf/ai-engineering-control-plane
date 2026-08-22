import json
import unittest

from aicp_memory.telemetry import OtlpHttpTelemetry


class Response:
    status = 200

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return None


class OtlpHttpTelemetryTest(unittest.TestCase):
    def test_request_span_uses_allowlist_and_omits_payload(self):
        payloads = []

        def open_request(request, timeout):
            payloads.append(json.loads(request.data))
            return Response()

        telemetry = OtlpHttpTelemetry("http://collector:4318", opener=open_request)

        self.assertTrue(telemetry.request(
            request_id="req-1", task_id="task-1", route="/v1/context:compile", status=200,
            prompt="private prompt", source="private source", secret="sk-secret",
        ))
        encoded = json.dumps(payloads)
        self.assertIn("req-1", encoded)
        self.assertIn("task-1", encoded)
        self.assertNotIn("private prompt", encoded)
        self.assertNotIn("private source", encoded)
        self.assertNotIn("sk-secret", encoded)


if __name__ == "__main__":
    unittest.main()
