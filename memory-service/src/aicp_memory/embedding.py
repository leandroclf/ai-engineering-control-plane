import json
import urllib.request


class LiteLLMEmbedder:
    def __init__(self, base_url, api_key, model="embeddings", dimensions=1536):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model = model
        self.dimensions = dimensions

    def embed(self, content):
        return self.embed_many([content])[0]

    def embed_many(self, contents):
        request = urllib.request.Request(
            self.base_url + "/embeddings",
            method="POST",
            headers={"Authorization": "Bearer " + self.api_key, "Content-Type": "application/json"},
            data=json.dumps({"model": self.model, "input": contents}).encode(),
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            data = sorted(json.load(response)["data"], key=lambda item: item["index"])
        vectors = [item["embedding"] for item in data]
        if any(len(vector) != self.dimensions for vector in vectors):
            raise ValueError(f"embedding dimensions mismatch: expected {self.dimensions}")
        return vectors
