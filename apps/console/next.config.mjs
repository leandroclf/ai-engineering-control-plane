/** @type {import('next').NextConfig} */
import { createMDX } from "fumadocs-mdx/next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig = { output: "standalone", allowedDevOrigins: ["127.0.0.1"], transpilePackages: ["@aicp/ui", "@aicp/api-client", "@aicp/architecture-catalog", "@aicp/test-fixtures", "@aicp/tutorial-engine"] };
const withMDX = createMDX({ configPath: "./source.config.ts" });
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
const adminUpstream = process.env.AICP_ADMIN_UPSTREAM_URL?.replace(/\/$/, "");
const upstream = adminUpstream ? {
  litellm: `${adminUpstream}/litellm`,
  neo4j: `${adminUpstream}/browser`,
  pgadmin: `${adminUpstream}/pgadmin`,
  redisinsight: `${adminUpstream}/redisinsight`,
} : process.env.NODE_ENV === "production" ? {
  litellm: "http://control-gateway:8081/litellm",
  neo4j: "http://control-gateway:8081/browser",
  pgadmin: "http://control-gateway:8081/pgadmin",
  redisinsight: "http://control-gateway:8081/redisinsight",
} : {
  litellm: "http://localhost:18081/litellm",
  neo4j: "http://localhost:18081/browser",
  pgadmin: "http://localhost:18081/pgadmin",
  redisinsight: "http://localhost:18081/redisinsight",
};
const adminTargets = [
  { source: "/litellm", destination: upstream.litellm },
  { source: "/litellm/:path*", destination: `${upstream.litellm}/:path*` },
  { source: "/browser", destination: upstream.neo4j },
  { source: "/browser/:path*", destination: `${upstream.neo4j}/:path*` },
  { source: "/pgadmin", destination: upstream.pgadmin },
  { source: "/pgadmin/:path*", destination: `${upstream.pgadmin}/:path*` },
  { source: "/redisinsight", destination: upstream.redisinsight },
  { source: "/redisinsight/:path*", destination: `${upstream.redisinsight}/:path*` },
];
export default withNextIntl(withMDX({ ...nextConfig, async rewrites() { return { beforeFiles: adminTargets }; } }));
