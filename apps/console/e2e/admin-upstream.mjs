import { createServer } from "node:http";

const port = Number(process.env.AICP_E2E_ADMIN_PORT || 19081);
const server = createServer((request, response) => {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(`<html><body data-upstream-path="${request.url}">Administrative surface</body></html>`);
});

server.listen(port, "127.0.0.1");

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
