import json
import urllib.error
import urllib.request


class LiteLLMTokenCounter:
    def __init__(self, base_url, api_key, model="coding-fast", opener=urllib.request.urlopen):
        self.base_url = base_url.rstrip("/").removesuffix("/v1")
        self.api_key = api_key
        self.model = model
        self.opener = opener

    def count(self, content):
        request = urllib.request.Request(
            self.base_url + "/utils/token_counter",
            method="POST",
            headers={"Authorization": "Bearer " + self.api_key, "Content-Type": "application/json"},
            data=json.dumps({"model": self.model, "prompt": content}).encode(),
        )
        try:
            with self.opener(request, timeout=30) as response:
                result = json.load(response)
        except (urllib.error.URLError, json.JSONDecodeError) as error:
            raise RuntimeError("token counter unavailable") from error
        tokens = result.get("total_tokens")
        if not isinstance(tokens, int) or tokens < 0 or result.get("error"):
            raise RuntimeError("token counter returned an invalid response")
        return tokens
