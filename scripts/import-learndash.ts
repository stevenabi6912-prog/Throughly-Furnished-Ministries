/**
 * LearnDash → TFM importer.
 *
 * Input: a full MySQL dump (.sql) of the old tfmchelsea.org WordPress site
 * (WP Engine → Backups → download, or phpMyAdmin → Export). Everything the
 * old site tracked comes across:
 *
 *   wp_users / wp_usermeta      → users (password hashes carried over, so
 *                                 everyone keeps their old password)
 *   sfwd-courses                → courses
 *   sfwd-lessons + sfwd-topic   → lessons (topics flatten under their lesson)
 *   sfwd-assignment posts       → submissions (+ an assignment row per lesson)
 *   assignment approval/points  → grades
 *   comments on assignments     → mentor feedback
 *   usermeta _sfwd-quizzes      → quiz grades (as approved submissions)
 *   usermeta course progress    → enrollments + lesson completion
 *
 * Usage:
 *   npm run import:learndash -- path/to/dump.sql [--prefix wp_] [--dry-run]
 *
 * Idempotent: imported rows remember their WordPress IDs (wp_user_id /
 * wp_post_id), so re-running updates nothing and duplicates nothing.
 */
import { readFileSync } from "node:fs";
import sanitizeHtml from "sanitize-html";
import { and, eq } from "drizzle-orm";
import {
  assignments,
  courses,
  enrollments,
  lessonProgress,
  lessons,
  submissions,
  users,
} from "../lib/db/schema";
import { openScriptDb, type ScriptDb } from "./db";

const OLD_SITE = "https://tfmchelsea.wpenginepowered.com";

// ---------------------------------------------------------------------------
// 1. mysqldump parsing
// ---------------------------------------------------------------------------

type Cell = string | number | null;
type Row = Record<string, Cell>;

/** Canonical WordPress column orders, for dumps without column lists. */
const DEFAULT_COLUMNS: Record<string, string[]> = {
  users: [
    "ID", "user_login", "user_pass", "user_nicename", "user_email",
    "user_url", "user_registered", "user_activation_key", "user_status",
    "display_name",
  ],
  usermeta: ["umeta_id", "user_id", "meta_key", "meta_value"],
  posts: [
    "ID", "post_author", "post_date", "post_date_gmt", "post_content",
    "post_title", "post_excerpt", "post_status", "comment_status",
    "ping_status", "post_password", "post_name", "to_ping", "pinged",
    "post_modified", "post_modified_gmt", "post_content_filtered",
    "post_parent", "guid", "menu_order", "post_type", "post_mime_type",
    "comment_count",
  ],
  postmeta: ["meta_id", "post_id", "meta_key", "meta_value"],
  comments: [
    "comment_ID", "comment_post_ID", "comment_author",
    "comment_author_email", "comment_author_url", "comment_author_IP",
    "comment_date", "comment_date_gmt", "comment_content", "comment_karma",
    "comment_approved", "comment_agent", "comment_type", "comment_parent",
    "user_id",
  ],
};

/** Parse one "(v1,v2,...)" tuple starting at sql[i] === "(". */
function parseTuple(sql: string, i: number): { values: Cell[]; next: number } {
  const values: Cell[] = [];
  i++; // consume "("
  for (;;) {
    while (i < sql.length && /\s/.test(sql[i])) i++;
    if (sql[i] === "'") {
      // Quoted string with backslash escapes (and '' doubling).
      i++;
      let str = "";
      for (;;) {
        const c = sql[i];
        if (c === undefined) throw new Error("Unterminated string in dump");
        if (c === "\\") {
          const n = sql[i + 1];
          str +=
            n === "n" ? "\n" : n === "r" ? "\r" : n === "t" ? "\t" :
            n === "0" ? "\0" : n === "Z" ? "\x1a" : n;
          i += 2;
        } else if (c === "'") {
          if (sql[i + 1] === "'") {
            str += "'";
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          str += c;
          i++;
        }
      }
      values.push(str);
    } else {
      // Bare token: number, NULL, or hex literal.
      let tok = "";
      while (i < sql.length && sql[i] !== "," && sql[i] !== ")") {
        tok += sql[i++];
      }
      const t = tok.trim();
      values.push(
        t.toUpperCase() === "NULL" ? null : t === "" || isNaN(Number(t)) ? t : Number(t)
      );
    }
    while (i < sql.length && /\s/.test(sql[i])) i++;
    if (sql[i] === ",") {
      i++;
      continue;
    }
    if (sql[i] === ")") {
      i++;
      break;
    }
    throw new Error(`Unexpected character "${sql[i]}" at offset ${i}`);
  }
  return { values, next: i };
}

function parseDump(sql: string, prefix: string): Record<string, Row[]> {
  const wanted = new Set(Object.keys(DEFAULT_COLUMNS));
  const tables: Record<string, Row[]> = {};
  for (const t of wanted) tables[t] = [];

  const insertRe = new RegExp(
    "INSERT INTO `?" + prefix + "(\\w+)`?\\s*(\\([^)]*\\))?\\s*VALUES\\s*",
    "gi"
  );
  let match: RegExpExecArray | null;
  while ((match = insertRe.exec(sql)) !== null) {
    const table = match[1].toLowerCase();
    if (!wanted.has(table)) continue;
    const columns = match[2]
      ? match[2].slice(1, -1).split(",").map((c) => c.trim().replace(/`/g, ""))
      : DEFAULT_COLUMNS[table];

    let i = insertRe.lastIndex;
    for (;;) {
      while (i < sql.length && /[\s,]/.test(sql[i])) i++;
      if (sql[i] !== "(") break; // ";" — end of this INSERT statement
      const { values, next } = parseTuple(sql, i);
      i = next;
      const row: Row = {};
      columns.forEach((c, idx) => (row[c] = values[idx] ?? null));
      tables[table].push(row);
    }
    insertRe.lastIndex = i;
  }
  return tables;
}

// ---------------------------------------------------------------------------
// 2. PHP unserialize (the subset WordPress/LearnDash actually uses)
// ---------------------------------------------------------------------------

type Php = string | number | boolean | null | { [k: string]: Php };

function phpUnserialize(input: string): Php {
  const buf = Buffer.from(input, "utf8");
  let pos = 0;

  function fail(msg: string): never {
    throw new Error(`unserialize: ${msg} at byte ${pos}`);
  }
  function expect(s: string) {
    if (buf.toString("utf8", pos, pos + s.length) !== s) fail(`expected "${s}"`);
    pos += s.length;
  }
  function readUntil(ch: string): string {
    const idx = buf.indexOf(ch, pos);
    if (idx === -1) fail(`missing "${ch}"`);
    const s = buf.toString("utf8", pos, idx);
    pos = idx + 1;
    return s;
  }

  function value(): Php {
    const type = String.fromCharCode(buf[pos]);
    switch (type) {
      case "N":
        expect("N;");
        return null;
      case "b": {
        expect("b:");
        const v = readUntil(";");
        return v === "1";
      }
      case "i": {
        expect("i:");
        return Number(readUntil(";"));
      }
      case "d": {
        expect("d:");
        return Number(readUntil(";"));
      }
      case "s": {
        expect("s:");
        const len = Number(readUntil(":"));
        expect('"');
        const s = buf.toString("utf8", pos, pos + len);
        pos += len;
        expect('";');
        return s;
      }
      case "a": {
        expect("a:");
        const count = Number(readUntil(":"));
        expect("{");
        const obj: { [k: string]: Php } = {};
        for (let i = 0; i < count; i++) {
          const key = value();
          obj[String(key)] = value();
        }
        expect("}");
        return obj;
      }
      case "O": {
        // Objects: skip class name, treat like an array.
        expect("O:");
        const nameLen = Number(readUntil(":"));
        pos += nameLen + 2; // "ClassName"
        expect(":");
        const count = Number(readUntil(":"));
        expect("{");
        const obj: { [k: string]: Php } = {};
        for (let i = 0; i < count; i++) {
          const key = value();
          obj[String(key)] = value();
        }
        expect("}");
        return obj;
      }
      default:
        fail(`unknown type "${type}"`);
    }
  }

  return value();
}

function tryUnserialize(input: string): Php {
  try {
    return phpUnserialize(input);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 3. Helpers
// ---------------------------------------------------------------------------

function cleanHtml(dirty: string): string {
  // Same policy as lib/html.ts (duplicated because that file is server-only),
  // plus: rewrite relative upload URLs to the old site so images keep working.
  const rewritten = dirty.replace(
    /(src|href)=(["'])\/wp-content\//g,
    `$1=$2${OLD_SITE}/wp-content/`
  );
  return sanitizeHtml(rewritten, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "img", "iframe", "figure", "figcaption", "audio", "video", "source",
    ],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ["src", "alt", "width", "height"],
      iframe: ["src", "width", "height", "allow", "allowfullscreen", "title"],
      audio: ["src", "controls"],
      video: ["src", "controls", "width", "height", "poster"],
      source: ["src", "type"],
      "*": ["class"],
    },
    allowedIframeHostnames: [
      "www.youtube.com", "www.youtube-nocookie.com", "player.vimeo.com",
    ],
  });
}

function slugify(s: string): string {
  return (
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) ||
    "item"
  );
}

/** Guess a program track from a course title. Review after importing! */
function guessTrack(
  title: string
): "biblical-studies" | "practical-skills" | "ministry-participation" {
  const t = title.toLowerCase();
  if (/first.?aid|construction|skill|carpentry|electrical|plumbing|mechanic|sew/.test(t))
    return "practical-skills";
  if (/participation|serving|ministry (involvement|participation)|outreach|evangelism practicum/.test(t))
    return "ministry-participation";
  return "biblical-studies";
}

function wpDate(v: Cell): Date | null {
  if (typeof v !== "string" || v.startsWith("0000")) return null;
  const d = new Date(v.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? null : d;
}

// ---------------------------------------------------------------------------
// 4. Import
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const flags = new Set(process.argv.slice(2).filter((a) => a.startsWith("--")));
  const prefixArg = process.argv.find((a) => a.startsWith("--prefix="));
  const prefix = prefixArg ? prefixArg.split("=")[1] : "wp_";
  const dryRun = flags.has("--dry-run");
  const file = args[0];
  if (!file) {
    console.error(
      "Usage: npm run import:learndash -- path/to/dump.sql [--prefix=wp_] [--dry-run]"
    );
    process.exit(1);
  }

  console.log(`Reading ${file}…`);
  const sql = readFileSync(file, "utf8");
  const t = parseDump(sql, prefix);
  console.log(
    `Parsed: ${t.users.length} users, ${t.posts.length} posts, ` +
      `${t.postmeta.length} postmeta, ${t.usermeta.length} usermeta, ` +
      `${t.comments.length} comments`
  );
  if (t.users.length === 0 && t.posts.length === 0) {
    console.error(
      `No data found — is the table prefix right? (current: "${prefix}", ` +
        `override with --prefix=yourprefix_)`
    );
    process.exit(1);
  }

  // Index metadata.
  const postmetaByPost = new Map<number, Map<string, string>>();
  for (const m of t.postmeta) {
    const pid = Number(m.post_id);
    if (!postmetaByPost.has(pid)) postmetaByPost.set(pid, new Map());
    postmetaByPost.get(pid)!.set(String(m.meta_key), String(m.meta_value ?? ""));
  }
  const usermetaByUser = new Map<number, Map<string, string>>();
  for (const m of t.usermeta) {
    const uid = Number(m.user_id);
    if (!usermetaByUser.has(uid)) usermetaByUser.set(uid, new Map());
    usermetaByUser.get(uid)!.set(String(m.meta_key), String(m.meta_value ?? ""));
  }
  const meta = (pid: number, key: string) => postmetaByPost.get(pid)?.get(key);
  const posts = t.posts.filter((p) => p.post_status === "publish" || p.post_type === "sfwd-assignment");
  const byType = (type: string) => posts.filter((p) => p.post_type === type);

  if (dryRun) {
    console.log(`\nDry run — would import:`);
    console.log(`  courses:      ${byType("sfwd-courses").length}`);
    console.log(`  lessons:      ${byType("sfwd-lessons").length}`);
    console.log(`  topics:       ${byType("sfwd-topic").length}`);
    console.log(`  quizzes:      ${byType("sfwd-quiz").length}`);
    console.log(`  submissions:  ${t.posts.filter((p) => p.post_type === "sfwd-assignment").length}`);
    console.log(`  users:        ${t.users.length}`);
    process.exit(0);
  }

  const db: ScriptDb = await openScriptDb();
  const report: string[] = [];

  // ---- Users ----------------------------------------------------------
  const userIdByWp = new Map<number, number>();
  let newUsers = 0;
  for (const u of t.users) {
    const wpId = Number(u.ID);
    const email = String(u.user_email ?? "").trim().toLowerCase();
    if (!email) continue;
    const caps = usermetaByUser.get(wpId)?.get(`${prefix}capabilities`) ?? "";
    const role = caps.includes("administrator") ? "admin" : "student";
    const name =
      String(u.display_name ?? "").trim() || String(u.user_login ?? "user");

    const existing =
      (await db.query.users.findFirst({ where: eq(users.wpUserId, wpId) })) ??
      (await db.query.users.findFirst({ where: eq(users.email, email) }));
    if (existing) {
      userIdByWp.set(wpId, existing.id);
      if (!existing.wpUserId) {
        await db.update(users).set({ wpUserId: wpId }).where(eq(users.id, existing.id));
      }
      continue;
    }
    const [created] = await db
      .insert(users)
      .values({
        wpUserId: wpId,
        name,
        email,
        legacyHash: String(u.user_pass ?? "") || null,
        role,
        createdAt: wpDate(u.user_registered) ?? new Date(),
      })
      .returning();
    userIdByWp.set(wpId, created.id);
    newUsers++;
  }
  report.push(`users: ${newUsers} imported, ${t.users.length - newUsers} already present`);

  // ---- Courses --------------------------------------------------------
  const courseIdByWp = new Map<number, number>();
  let newCourses = 0;
  for (const p of byType("sfwd-courses")) {
    const wpId = Number(p.ID);
    const existing = await db.query.courses.findFirst({
      where: eq(courses.wpPostId, wpId),
    });
    if (existing) {
      courseIdByWp.set(wpId, existing.id);
      continue;
    }
    const title = String(p.post_title ?? "Untitled course");
    const rawDesc =
      String(p.post_excerpt ?? "").trim() ||
      String(p.post_content ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400);
    let slug = String(p.post_name ?? "") || slugify(title);
    if (await db.query.courses.findFirst({ where: eq(courses.slug, slug) })) {
      slug = `${slug}-${wpId}`;
    }
    const [created] = await db
      .insert(courses)
      .values({
        wpPostId: wpId,
        slug,
        title,
        description: rawDesc,
        track: guessTrack(title),
        sortOrder: Number(p.menu_order) || 0,
        published: true,
        createdAt: wpDate(p.post_date) ?? new Date(),
      })
      .returning();
    courseIdByWp.set(wpId, created.id);
    newCourses++;
  }
  report.push(`courses: ${newCourses} imported (tracks were guessed from titles — review in /admin/courses)`);

  function courseForPost(pid: number): number | undefined {
    const cid = Number(meta(pid, "course_id") ?? 0);
    return courseIdByWp.get(cid);
  }

  // ---- Lessons (sfwd-lessons) and topics (sfwd-topic) ------------------
  const lessonIdByWp = new Map<number, number>();
  let newLessons = 0;
  const wpLessons = byType("sfwd-lessons").sort(
    (a, b) => (Number(a.menu_order) || 0) - (Number(b.menu_order) || 0)
  );
  const wpTopics = byType("sfwd-topic").sort(
    (a, b) => (Number(a.menu_order) || 0) - (Number(b.menu_order) || 0)
  );

  async function importLesson(
    p: Row,
    courseId: number,
    sortOrder: number
  ): Promise<void> {
    const wpId = Number(p.ID);
    const existing = await db.query.lessons.findFirst({
      where: eq(lessons.wpPostId, wpId),
    });
    if (existing) {
      lessonIdByWp.set(wpId, existing.id);
      return;
    }
    const title = String(p.post_title ?? "Untitled lesson");
    let slug = String(p.post_name ?? "") || slugify(title);
    if (
      await db.query.lessons.findFirst({
        where: and(eq(lessons.courseId, courseId), eq(lessons.slug, slug)),
      })
    ) {
      slug = `${slug}-${wpId}`;
    }
    const [created] = await db
      .insert(lessons)
      .values({
        wpPostId: wpId,
        courseId,
        slug,
        title,
        contentHtml: cleanHtml(String(p.post_content ?? "")),
        sortOrder,
        published: true,
      })
      .returning();
    lessonIdByWp.set(wpId, created.id);
    newLessons++;
  }

  let order = 0;
  for (const p of wpLessons) {
    const courseId = courseForPost(Number(p.ID));
    if (!courseId) continue;
    order += 10;
    await importLesson(p, courseId, order);
    // Topics belonging to this lesson slot in right after it.
    const children = wpTopics.filter(
      (tp) => Number(meta(Number(tp.ID), "lesson_id") ?? 0) === Number(p.ID)
    );
    for (const tp of children) {
      order += 1;
      const topicCourse = courseForPost(Number(tp.ID)) ?? courseId;
      await importLesson(tp, topicCourse, order);
    }
  }
  // Orphan topics (no imported parent lesson) still come across.
  for (const tp of wpTopics) {
    if (lessonIdByWp.has(Number(tp.ID))) continue;
    const courseId = courseForPost(Number(tp.ID));
    if (!courseId) continue;
    order += 10;
    await importLesson(tp, courseId, order);
  }
  report.push(`lessons: ${newLessons} imported (incl. topics)`);

  // ---- Assignment definitions + student submissions --------------------
  // LearnDash has no "assignment" content type — uploads hang off lessons.
  // We create one assignment per lesson that has submissions.
  const wpSubmissions = t.posts.filter((p) => p.post_type === "sfwd-assignment");
  const assignmentIdByLesson = new Map<number, number>();

  async function assignmentForLesson(
    newLessonId: number,
    courseId: number,
    lessonTitle: string
  ): Promise<number> {
    const cached = assignmentIdByLesson.get(newLessonId);
    if (cached) return cached;
    const existing = await db.query.assignments.findFirst({
      where: and(
        eq(assignments.lessonId, newLessonId),
        eq(assignments.wpPostId, -newLessonId) // marker for imported defs
      ),
    });
    if (existing) {
      assignmentIdByLesson.set(newLessonId, existing.id);
      return existing.id;
    }
    const [created] = await db
      .insert(assignments)
      .values({
        wpPostId: -newLessonId,
        courseId,
        lessonId: newLessonId,
        title: `Assignment — ${lessonTitle}`,
        instructionsHtml:
          "<p>Complete the assignment for this lesson and upload your work.</p>",
        points: 100,
      })
      .returning();
    assignmentIdByLesson.set(newLessonId, created.id);
    return created.id;
  }

  // Mentor feedback: comments on assignment posts.
  const commentsByPost = new Map<number, string[]>();
  for (const c of t.comments) {
    if (String(c.comment_approved) !== "1") continue;
    const pid = Number(c.comment_post_ID);
    const line = `${String(c.comment_author ?? "Mentor")}: ${String(c.comment_content ?? "")}`.trim();
    if (!commentsByPost.has(pid)) commentsByPost.set(pid, []);
    commentsByPost.get(pid)!.push(line);
  }

  let newSubs = 0;
  let skippedSubs = 0;
  for (const p of wpSubmissions) {
    const wpId = Number(p.ID);
    const existing = await db.query.submissions.findFirst({
      where: eq(submissions.wpPostId, wpId),
    });
    if (existing) continue;

    const userId = userIdByWp.get(Number(p.post_author));
    const wpLessonId = Number(meta(wpId, "lesson_id") ?? 0);
    const newLessonId = lessonIdByWp.get(wpLessonId);
    if (!userId || !newLessonId) {
      skippedSubs++;
      continue;
    }
    const lessonRow = await db.query.lessons.findFirst({
      where: eq(lessons.id, newLessonId),
    });
    if (!lessonRow) {
      skippedSubs++;
      continue;
    }
    const assignmentId = await assignmentForLesson(
      newLessonId,
      lessonRow.courseId,
      lessonRow.title
    );

    const approved = String(meta(wpId, "approval_status") ?? "") === "1";
    const pointsMeta = meta(wpId, "points");
    const score =
      pointsMeta !== undefined && pointsMeta !== "" && !isNaN(Number(pointsMeta))
        ? Number(pointsMeta)
        : null;
    let fileUrl = meta(wpId, "file_link") ?? null;
    if (fileUrl) {
      fileUrl = fileUrl.replace(/^https?:\/\/[^/]*tfmchelsea[^/]*/i, OLD_SITE);
    }
    const feedback = commentsByPost.get(wpId)?.join("\n\n") ?? null;

    await db.insert(submissions).values({
      wpPostId: wpId,
      assignmentId,
      userId,
      text: null,
      fileUrl,
      fileName: meta(wpId, "file_name") ?? (String(p.post_title ?? "") || null),
      status: approved ? "approved" : "submitted",
      submittedAt: wpDate(p.post_date) ?? new Date(),
      score: approved ? score ?? 100 : score,
      feedback,
      gradedAt: approved || feedback ? wpDate(p.post_modified) ?? new Date() : null,
    });
    newSubs++;
  }
  report.push(
    `assignment submissions: ${newSubs} imported` +
      (skippedSubs ? ` (${skippedSubs} skipped — missing user or lesson)` : "")
  );

  // ---- Quiz results (usermeta _sfwd-quizzes) ---------------------------
  const quizPosts = new Map<number, Row>();
  for (const p of byType("sfwd-quiz")) quizPosts.set(Number(p.ID), p);
  const quizAssignmentByWp = new Map<number, number>();
  let newQuizGrades = 0;

  async function assignmentForQuiz(wpQuizId: number): Promise<number | null> {
    const cached = quizAssignmentByWp.get(wpQuizId);
    if (cached) return cached;
    const existing = await db.query.assignments.findFirst({
      where: eq(assignments.wpPostId, wpQuizId),
    });
    if (existing) {
      quizAssignmentByWp.set(wpQuizId, existing.id);
      return existing.id;
    }
    const p = quizPosts.get(wpQuizId);
    if (!p) return null;
    const courseId = courseForPost(wpQuizId);
    if (!courseId) return null;
    const wpLessonId = Number(meta(wpQuizId, "lesson_id") ?? 0);
    const [created] = await db
      .insert(assignments)
      .values({
        wpPostId: wpQuizId,
        courseId,
        lessonId: lessonIdByWp.get(wpLessonId) ?? null,
        title: `Quiz — ${String(p.post_title ?? "Quiz")}`,
        instructionsHtml:
          "<p>This quiz was taken on the old TFM site; the score below was imported with it.</p>",
        points: 100,
      })
      .returning();
    quizAssignmentByWp.set(wpQuizId, created.id);
    return created.id;
  }

  for (const u of t.users) {
    const wpUserId = Number(u.ID);
    const userId = userIdByWp.get(wpUserId);
    if (!userId) continue;
    const raw = usermetaByUser.get(wpUserId)?.get("_sfwd-quizzes");
    if (!raw) continue;
    const attempts = tryUnserialize(raw);
    if (!attempts || typeof attempts !== "object") continue;

    // Keep the best attempt per quiz.
    const best = new Map<number, { pct: number; when: number }>();
    for (const a of Object.values(attempts)) {
      if (!a || typeof a !== "object") continue;
      const quizId = Number((a as Record<string, Php>)["quiz"]);
      const pct = Number((a as Record<string, Php>)["percentage"] ?? 0);
      const when = Number((a as Record<string, Php>)["time"] ?? 0);
      if (!quizId) continue;
      const cur = best.get(quizId);
      if (!cur || pct > cur.pct) best.set(quizId, { pct, when });
    }
    for (const [quizId, r] of best) {
      const assignmentId = await assignmentForQuiz(quizId);
      if (!assignmentId) continue;
      const already = await db.query.submissions.findFirst({
        where: and(
          eq(submissions.assignmentId, assignmentId),
          eq(submissions.userId, userId)
        ),
      });
      if (already) continue;
      const when = r.when ? new Date(r.when * 1000) : new Date();
      await db.insert(submissions).values({
        assignmentId,
        userId,
        text: `Imported quiz result from the old site: ${Math.round(r.pct)}%`,
        status: "approved",
        submittedAt: when,
        score: Math.round(r.pct),
        gradedAt: when,
      });
      newQuizGrades++;
    }
  }
  report.push(`quiz grades: ${newQuizGrades} imported`);

  // ---- Enrollments + lesson progress ----------------------------------
  let newEnrollments = 0;
  let newProgress = 0;
  for (const u of t.users) {
    const wpUserId = Number(u.ID);
    const userId = userIdByWp.get(wpUserId);
    if (!userId) continue;
    const um = usermetaByUser.get(wpUserId);
    if (!um) continue;

    const enrolledWpCourses = new Set<number>();
    for (const key of um.keys()) {
      const m = key.match(/^course_(\d+)_access_from$/);
      if (m) enrolledWpCourses.add(Number(m[1]));
    }
    const progress = tryUnserialize(um.get("_sfwd-course_progress") ?? "");
    if (progress && typeof progress === "object") {
      for (const wpCourseId of Object.keys(progress)) {
        enrolledWpCourses.add(Number(wpCourseId));
      }
    }

    for (const wpCourseId of enrolledWpCourses) {
      const courseId = courseIdByWp.get(wpCourseId);
      if (!courseId) continue;
      const accessFrom = Number(um.get(`course_${wpCourseId}_access_from`) ?? 0);
      const completedTs = Number(um.get(`course_completed_${wpCourseId}`) ?? 0);
      const res = await db
        .insert(enrollments)
        .values({
          userId,
          courseId,
          enrolledAt: accessFrom ? new Date(accessFrom * 1000) : new Date(),
          completedAt: completedTs ? new Date(completedTs * 1000) : null,
        })
        .onConflictDoNothing()
        .returning();
      if (res.length > 0) newEnrollments++;
    }

    if (progress && typeof progress === "object") {
      for (const courseProgress of Object.values(progress)) {
        if (!courseProgress || typeof courseProgress !== "object") continue;
        const cp = courseProgress as Record<string, Php>;
        const doneWpLessonIds: number[] = [];
        const lessonsMap = cp["lessons"];
        if (lessonsMap && typeof lessonsMap === "object") {
          for (const [lid, done] of Object.entries(lessonsMap)) {
            if (Number(done) === 1) doneWpLessonIds.push(Number(lid));
          }
        }
        const topicsMap = cp["topics"];
        if (topicsMap && typeof topicsMap === "object") {
          for (const perLesson of Object.values(topicsMap)) {
            if (!perLesson || typeof perLesson !== "object") continue;
            for (const [tid, done] of Object.entries(perLesson)) {
              if (Number(done) === 1) doneWpLessonIds.push(Number(tid));
            }
          }
        }
        for (const wpLessonId of doneWpLessonIds) {
          const lessonId = lessonIdByWp.get(wpLessonId);
          if (!lessonId) continue;
          const res = await db
            .insert(lessonProgress)
            .values({ userId, lessonId })
            .onConflictDoNothing()
            .returning();
          if (res.length > 0) newProgress++;
        }
      }
    }
  }
  report.push(`enrollments: ${newEnrollments} imported`);
  report.push(`lesson completions: ${newProgress} imported`);

  console.log("\n===== Import complete =====");
  for (const line of report) console.log("  • " + line);
  console.log(`
Next steps:
  1. Review course tracks in /admin/courses (they were guessed from titles).
  2. Spot-check a student in /admin/students against the old gradebook.
  3. Assignment files still point at ${OLD_SITE} — keep that
     hosting live until you're ready, or re-upload the files you care about.
`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
