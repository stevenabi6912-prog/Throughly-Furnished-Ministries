/**
 * Checks every lesson's YouTube link against YouTube's oEmbed endpoint
 * and clears the ones that are dead (private, deleted, or embedding
 * disabled), so students never see a "Video unavailable" box.
 *
 *   npx tsx scripts/audit-videos.ts            # report + clear dead links
 *   npx tsx scripts/audit-videos.ts --dry-run  # report only
 *
 * Run it against production by setting DATABASE_URL first.
 */
import { eq, isNotNull } from "drizzle-orm";
import { lessons } from "../lib/db/schema";
import { openScriptDb } from "./db";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const db = await openScriptDb();
  const withVideo = await db.query.lessons.findMany({
    where: isNotNull(lessons.videoUrl),
  });
  console.log(`Checking ${withVideo.length} lesson videos…`);

  let ok = 0;
  let cleared = 0;
  for (const lesson of withVideo) {
    const url = lesson.videoUrl!;
    let alive = false;
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
        { signal: AbortSignal.timeout(10000) }
      );
      alive = res.ok;
    } catch {
      // Network hiccup — don't clear on uncertainty.
      console.log(`  ? could not check: ${lesson.title} (${url}) — leaving as is`);
      ok++;
      continue;
    }
    if (alive) {
      ok++;
    } else {
      console.log(`  ✗ dead: ${lesson.title} (${url})`);
      if (!dryRun) {
        await db
          .update(lessons)
          .set({ videoUrl: null })
          .where(eq(lessons.id, lesson.id));
      }
      cleared++;
    }
  }
  console.log(
    `\nDone: ${ok} working, ${cleared} dead${dryRun ? " (dry run — nothing cleared)" : " (cleared)"}.`
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
