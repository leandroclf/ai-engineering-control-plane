const endpoint = process.env.AICP_MOCK_GATEWAY_URL ?? "http://127.0.0.1:4012";
const response = await fetch(`${endpoint}/v1/chat/completions`, {
  method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer test-only" },
  body: JSON.stringify({ model: "coding-strong", messages: [{ role: "user", content: "return governed result" }], temperature: 0 }),
});
if (!response.ok) throw new Error(`mock gateway returned ${response.status}: ${await response.text()}`);
const payload = await response.json();
if (payload.model !== "coding-strong") throw new Error(`unexpected governed alias: ${payload.model}`);
if (payload.usage?.total_tokens !== 11) throw new Error("gateway did not preserve deterministic physical usage");
if (payload.choices?.[0]?.message?.content !== '{"outcome":"pass"}') throw new Error("gateway response contract drift");
process.stdout.write(`${JSON.stringify({ status: "pass", alias: payload.model, upstreamContract: "mock-model", physicalTokens: payload.usage.total_tokens })}\n`);
