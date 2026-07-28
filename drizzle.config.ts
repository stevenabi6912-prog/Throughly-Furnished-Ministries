import { defineConfig } from "drizzle-kit";

// Only used by `npm run db:generate` to emit SQL migration files into
// ./drizzle. Migrations are applied automatically at runtime (lib/db).
export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
});
