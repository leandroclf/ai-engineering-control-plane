import { createServer } from "node:http";

const port = Number(process.env.AICP_MOCK_PROVIDER_PORT ?? 4011);
const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end('{"status":"ok"}');
    return;
  }
  if (request.method !== "POST" || request.url !== "/v1/chat/completions") {
    response.writeHead(404).end();
    return;
  }
  let body = "";
  request.setEncoding("utf8");
  request.on("data", (chunk) => { body += chunk; });
  request.on("end", () => {
    const payload = JSON.parse(body);
    if (payload.model !== "mock-model" || !Array.isArray(payload.messages)) {
      response.writeHead(400, { "Content-Type": "application/json" });
      response.end('{"error":{"message":"invalid deterministic request"}}');
      return;
    }
    response.writeHead(200, { "Content-Type": "application/json", "x-request-id": "mock-provider-request-1" });
    response.end(JSON.stringify({
      id: "chatcmpl-aicp-deterministic", object: "chat.completion", created: 1, model: "mock-model",
      choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: '{"outcome":"pass"}' } }],
      usage: { prompt_tokens: 7, completion_tokens: 4, total_tokens: 11 },
    }));
  });
});

server.listen(port, "0.0.0.0", () => process.stdout.write(`mock-provider:${port}\n`));
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => server.close(() => process.exit(0)));
