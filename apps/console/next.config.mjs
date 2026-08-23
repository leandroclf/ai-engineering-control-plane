/** @type {import('next').NextConfig} */
import { createMDX } from "fumadocs-mdx/next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig = { output: "standalone", allowedDevOrigins: ["127.0.0.1"], transpilePackages: ["@aicp/ui", "@aicp/api-client", "@aicp/architecture-catalog", "@aicp/test-fixtures", "@aicp/tutorial-engine"] };
const withMDX = createMDX({ configPath: "./source.config.ts" });
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");
export default withNextIntl(withMDX(nextConfig));
