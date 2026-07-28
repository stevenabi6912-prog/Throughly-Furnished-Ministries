import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";

// Serves locally-stored submission files in development (production uses
// Vercel Blob URLs instead). Signed-in users only; students can only open
// their own files, admins can open any.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Not signed in", { status: 401 });

  const parts = (await params).path;
  const root = path.join(process.cwd(), ".data", "uploads");
  const abs = path.resolve(root, ...parts);
  if (!abs.startsWith(root + path.sep)) {
    return new Response("Not found", { status: 404 });
  }
  const ownerId = Number(parts[0]);
  if (user.role !== "admin" && ownerId !== user.id) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const info = await stat(abs);
    const stream = Readable.toWeb(
      createReadStream(abs)
    ) as ReadableStream<Uint8Array>;
    return new Response(stream, {
      headers: {
        "Content-Length": String(info.size),
        "Content-Disposition": `inline; filename="${path.basename(abs)}"`,
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
