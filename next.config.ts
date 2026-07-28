import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let the dev server be reached as 127.0.0.1 as well as localhost.
  allowedDevOrigins: ["127.0.0.1"],
  // Drizzle migrations are applied at runtime from ./drizzle — make sure
  // the SQL files ship with the serverless bundle.
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**/*"],
  },
  // Native/wasm database drivers stay plain Node dependencies.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
};

export default nextConfig;
