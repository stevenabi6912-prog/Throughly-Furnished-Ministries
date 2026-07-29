/**
 * Moves course files off the old WP Engine hosting into the site's own
 * Vercel Blob storage, so nothing breaks when WP Engine is cancelled:
 *
 *   - lesson worksheet PDFs (worksheet_url)
 *   - student submission files (file_url)
 *
 * Files are read from the downloaded site archive
 * (migration-data/archive/wp-content/…) and uploaded to Blob; the
 * database URLs are updated to the new Blob URLs.
 *
 *   npx tsx scripts/migrate-files.ts [--dry-run]
 *
 * Needs BLOB_READ_WRITE_TOKEN — read automatically from .env.vercel.local
 * if not already in the environment. Set DATABASE_URL to run against
 * production. Idempotent: rows already pointing at Blob are skipped.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { eq, isNotNull } from "drizzle-orm";
import { lessons, submissions } from "../lib/db/schema";
import { openScriptDb } from "./db";

const ARCHIVE = path.join(process.cwd(), "migration-data", "archive");

function loadBlobToken(): string | null {
  if (process.env.BLOB_READ_WRITE_TOKEN) return process.env.BLOB_READ_WRITE_TOKEN;
  const envFile = path.join(process.cwd(), ".env.vercel.local");
  if (!existsSync(envFile)) return null;
  const m = readFileSync(envFile, "utf8").match(
    /^BLOB_READ_WRITE_TOKEN="?([^"\n]+)"?$/m
  );
  return m?.[1] ?? null;
}

/** An old-site URL → the corresponding file inside the archive, if present. */
function archivePathFor(url: string): string | null {
  const m = url.match(/\/wp-content\/(uploads\/[^?#]+)/);
  if (!m) return null;
  const rel = decodeURIComponent(m[1]);
  const abs = path.join(ARCHIVE, "wp-content", rel);
  return existsSync(abs) ? abs : null;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const token = loadBlobToken();
  if (!token) {
    console.error(
      "No BLOB_READ_WRITE_TOKEN found (env or .env.vercel.local) — cannot upload."
    );
    process.exit(1);
  }
  process.env.BLOB_READ_WRITE_TOKEN = token;
  const { put } = await import("@vercel/blob");
  const db = await openScriptDb();

  // Upload cache so the same file (shared across lessons) uploads once.
  const uploaded = new Map<string, string>();
  async function toBlob(localPath: string, folder: string): Promise<string> {
    const cached = uploaded.get(localPath);
    if (cached) return cached;
    const name = path.basename(localPath).replace(/[^a-zA-Z0-9._-]+/g, "_");
    const blob = await put(`${folder}/${name}`, readFileSync(localPath), {
      access: "public",
      addRandomSuffix: true,
    });
    uploaded.set(localPath, blob.url);
    return blob.url;
  }

  let moved = 0;
  let missing = 0;
  let skipped = 0;

  const withWorksheet = await db.query.lessons.findMany({
    where: isNotNull(lessons.worksheetUrl),
  });
  console.log(`Worksheets: ${withWorksheet.length} lessons`);
  for (const lesson of withWorksheet) {
    const url = lesson.worksheetUrl!;
    if (url.includes("blob.vercel-storage.com")) {
      skipped++;
      continue;
    }
    const local = archivePathFor(url);
    if (!local) {
      console.log(`  ✗ not in archive: ${lesson.title} (${url})`);
      missing++;
      continue;
    }
    if (!dryRun) {
      const blobUrl = await toBlob(local, "content/worksheets");
      await db
        .update(lessons)
        .set({ worksheetUrl: blobUrl })
        .where(eq(lessons.id, lesson.id));
    }
    moved++;
  }

  const withFile = await db.query.submissions.findMany({
    where: isNotNull(submissions.fileUrl),
  });
  console.log(`Submission files: ${withFile.length}`);
  for (const sub of withFile) {
    const url = sub.fileUrl!;
    if (url.includes("blob.vercel-storage.com") || url.startsWith("/api/files/")) {
      skipped++;
      continue;
    }
    const local = archivePathFor(url);
    if (!local) {
      console.log(`  ✗ not in archive: submission #${sub.id} (${url})`);
      missing++;
      continue;
    }
    if (!dryRun) {
      const blobUrl = await toBlob(local, `submissions/imported/${sub.userId}`);
      await db
        .update(submissions)
        .set({ fileUrl: blobUrl })
        .where(eq(submissions.id, sub.id));
    }
    moved++;
  }

  console.log(
    `\nDone: ${moved} file references moved to Blob (${uploaded.size} uploads), ` +
      `${skipped} already migrated, ${missing} not found in the archive.` +
      (dryRun ? " (dry run — nothing written)" : "")
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
