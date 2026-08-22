import io
import json
import unittest

from aicp_memory.token_counter import LiteLLMTokenCounter


class Response(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


class LiteLLMTokenCounterTest(unittest.TestCase):
    def test_counts_with_gateway_model_and_validates_response(self):
        requests = []

        def open_request(request, timeout):
            requests.append(json.loads(request.data))
            return Response(b'{"total_tokens":7,"model_used":"gpt","tokenizer_type":"openai_tokenizer"}')

        counter = LiteLLMTokenCounter("http://litellm:4000/v1", "key", model="coding-fast", opener=open_request)

        self.assertEqual(counter.count("hello world"), 7)
        self.assertEqual(requests, [{"model": "coding-fast", "prompt": "hello world"}])


if __name__ == "__main__":
    unittest.main()
