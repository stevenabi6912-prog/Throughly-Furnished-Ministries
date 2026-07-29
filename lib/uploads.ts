import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Assignment file uploads.
//   Production: Vercel Blob (BLOB_READ_WRITE_TOKEN provisioned via the
//               Vercel dashboard → Storage → Blob). URLs get a random
//               suffix, so they're unguessable.
//   Local dev:  files land in .data/uploads and are served (auth-checked)
//               by app/api/files/[...path]/route.ts.
// ---------------------------------------------------------------------------

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_EXTENSIONS = new Set([
  ".pdf", ".doc", ".docx", ".odt", ".rtf", ".txt", ".md",
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".heic",
  ".mp3", ".m4a", ".wav", ".mp4", ".mov",
  ".ppt", ".pptx", ".xls", ".xlsx", ".zip",
]);

/**
 * Course-content files uploaded by admins (worksheet PDFs, etc.). Readable
 * by any signed-in user, unlike submission files.
 */
export async function saveContentFile(
  file: File
): Promise<{ url: string; fileName: string }> {
  if (file.size > MAX_BYTES) {
    throw new Error("File is too large — the limit is 25 MB.");
  }
  const safeName = path
    .basename(file.name)
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(-80);

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`content/${safeName}`, file, {
      access: "public",
      addRandomSuffix: true,
    });
    return { url: blob.url, fileName: file.name };
  }
  const token = crypto.randomBytes(8).toString("hex");
  const rel = path.posix.join("content", `${token}-${safeName}`);
  const abs = path.join(process.cwd(), ".data", "uploads", rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, Buffer.from(await file.arrayBuffer()));
  return { url: `/api/files/${rel}`, fileName: file.name };
}

export async function saveSubmissionFile(
  file: File,
  userId: number
): Promise<{ url: string; fileName: string }> {
  if (file.size > MAX_BYTES) {
    throw new Error("File is too large — the limit is 25 MB.");
  }
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(`File type "${ext || "unknown"}" isn't accepted.`);
  }
  const safeName = path
    .basename(file.name)
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(-80);

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`submissions/${userId}/${safeName}`, file, {
      access: "public",
      addRandomSuffix: true,
    });
    return { url: blob.url, fileName: file.name };
  }

  // Local development fallback.
  const token = crypto.randomBytes(8).toString("hex");
  const rel = path.posix.join(String(userId), `${token}-${safeName}`);
  const abs = path.join(process.cwd(), ".data", "uploads", rel);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, Buffer.from(await file.arrayBuffer()));
  return { url: `/api/files/${rel}`, fileName: file.name };
}
