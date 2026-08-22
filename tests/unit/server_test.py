from io import BytesIO
import unittest

from aicp_memory.server import MAX_REQUEST_BODY_BYTES, PayloadTooLargeError, read_request_body


class RequestBodyLimitTest(unittest.TestCase):
    def test_read_request_body_enforces_content_length_limit(self):
        self.assertEqual(read_request_body({"Content-Length": "3"}, BytesIO(b"abc"), limit=4), b"abc")
        with self.assertRaises(PayloadTooLargeError):
            read_request_body({"Content-Length": str(MAX_REQUEST_BODY_BYTES + 1)}, BytesIO(b""), limit=MAX_REQUEST_BODY_BYTES)

    def test_read_request_body_rejects_invalid_content_length(self):
        with self.assertRaises(ValueError):
            read_request_body({"Content-Length": "nope"}, BytesIO(b""))
