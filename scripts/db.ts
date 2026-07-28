// Database connection for CLI scripts (seed, import). Mirrors lib/db but
// without the "server-only" guard, which can't be imported outside Next.
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "../lib/db/schema";

export type ScriptDb = ReturnType<typeof drizzlePg<typeof schema>>;

export async function openScriptDb(): Promise<ScriptDb> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const pool = new Pool({ connectionString: url, max: 3 });
    const db = drizzlePg(pool, { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    return db;
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const path = await import("node:path");
  const { mkdir } = await import("node:fs/promises");
  const dir = path.join(process.cwd(), ".data", "pglite");
  await mkdir(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzlePglite(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db as unknown as ScriptDb;
}
