/**
 * LearnDash → TFM importer.
 *
 * Input: a full MySQL dump (.sql) of the old tfmchelsea.org WordPress site
 * (WP Engine backup → wp-content/mysql.sql).
 *
 * How the old site's hierarchy maps to the new one — the old site used
 * LearnDash's levels one step "up" from their names:
 *
 *   LearnDash course  ("Biblical Studies", …)      → program TRACK
 *   LearnDash lesson  ("Baptist Distinctives 121") → COURSE (+ an Overview
 *                                                    lesson from its body)
 *   LearnDash topic   ("Biblical Authority", …)    → LESSON
 *   quiz attempts (learndash_user_activity)        → graded submissions
 *   sfwd-essays answers                            → submission text
 *   sfwd-assignment file uploads                   → submissions
 *   comments on assignment posts                   → mentor feedback
 *   topic/lesson progress (usermeta + activity)    → lesson progress and
 *                                                    course completion
 *
 * Users carry their WordPress password hashes, so everyone keeps their
 * old password.
 *
 * Usage:
 *   npm run import:learndash -- path/to/mysql.sql [--prefix=wp_] [--dry-run]
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
export const DEFAULT_COLUMNS: Record<string, string[]> = {
  learndash_user_activity: [
    "activity_id", "user_id", "post_id", "course_id", "activity_type",
    "activity_status", "activity_started", "activity_completed",
    "activity_updated",
  ],
  learndash_user_activity_meta: [
    "activity_meta_id", "activity_id", "activity_meta_key",
    "activity_meta_value",
  ],
  learndash_pro_quiz_statistic_ref: [
    "statistic_ref_id", "quiz_id", "user_id", "create_time", "is_old",
  ],
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

export function parseDump(sql: string, prefix: string): Record<string, Row[]> {
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
        return readUntil(";") === "1";
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

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function slugify(s: string): string {
  return (
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) ||
    "item"
  );
}

/** The three old LearnDash courses are the three program tracks. */
function guessTrack(
  title: string
): "biblical-studies" | "practical-skills" | "ministry-participation" {
  const t = title.toLowerCase();
  if (/first.?aid|construction|skill|carpentry|electrical|plumbing|mechanic|sew/.test(t))
    return "practical-skills";
  if (/participation|serving|outreach|evangelism practicum/.test(t))
    return "ministry-participation";
  return "biblical-studies";
}

function wpDate(v: Cell): Date | null {
  if (typeof v !== "string" || v.startsWith("0000")) return null;
  const d = new Date(v.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? null : d;
}

function unixDate(v: unknown): Date | null {
  const n = Number(v);
  return n > 0 ? new Date(n * 1000) : null;
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
      "Usage: npm run import:learndash -- path/to/mysql.sql [--prefix=wp_] [--dry-run]"
    );
    process.exit(1);
  }

  console.log(`Reading ${file}…`);
  const sql = readFileSync(file, "utf8");
  const t = parseDump(sql, prefix);
  console.log(
    `Parsed: ${t.users.length} users, ${t.posts.length} posts, ` +
      `${t.postmeta.length} postmeta, ${t.usermeta.length} usermeta, ` +
      `${t.comments.length} comments, ` +
      `${(t.learndash_user_activity ?? []).length} activity rows`
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
  // Drafts are imported too (as unpublished) — the old site kept most of
  // its curriculum and all quizzes in draft status while still using them.
  const byType = (type: string) => t.posts.filter((p) => p.post_type === type);

  const activityMetaByActivity = new Map<number, Map<string, string>>();
  for (const m of t.learndash_user_activity_meta ?? []) {
    const aid = Number(m.activity_id);
    if (!activityMetaByActivity.has(aid))
      activityMetaByActivity.set(aid, new Map());
    activityMetaByActivity
      .get(aid)!
      .set(String(m.activity_meta_key), String(m.activity_meta_value ?? ""));
  }
  const activities = t.learndash_user_activity ?? [];

  if (dryRun) {
    console.log(`\nDry run — would import:`);
    console.log(`  tracks:       ${byType("sfwd-courses").length} (the old LearnDash courses)`);
    console.log(`  courses:      ${byType("sfwd-lessons").length} (the old LearnDash lessons)`);
    console.log(`  lessons:      ${byType("sfwd-topic").length} (the old LearnDash topics)`);
    console.log(`  quizzes:      ${byType("sfwd-quiz").length}`);
    console.log(`  quiz grades:  ${activities.filter((a) => a.activity_type === "quiz").length} attempts`);
    console.log(`  essays:       ${byType("sfwd-essays").length}`);
    console.log(`  file submissions: ${byType("sfwd-assignment").length}`);
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

  // ---- Tracks (the old LearnDash courses) ------------------------------
  type Track = "biblical-studies" | "practical-skills" | "ministry-participation";
  const trackByOldCourse = new Map<number, Track>();
  for (const p of byType("sfwd-courses")) {
    trackByOldCourse.set(Number(p.ID), guessTrack(String(p.post_title ?? "")));
  }

  // ---- Courses (the old LearnDash lessons) -----------------------------
  // Each old lesson ("Baptist Distinctives 121") becomes a course in its
  // track. Its body text becomes an "Overview" lesson so nothing is lost.
  const courseIdByOldLesson = new Map<number, number>();
  let newCourses = 0;
  const oldLessons = byType("sfwd-lessons").sort(
    (a, b) =>
      (Number(a.menu_order) || 0) - (Number(b.menu_order) || 0) ||
      Number(a.ID) - Number(b.ID)
  );
  for (const p of oldLessons) {
    const wpId = Number(p.ID);
    const existing = await db.query.courses.findFirst({
      where: eq(courses.wpPostId, wpId),
    });
    if (existing) {
      courseIdByOldLesson.set(wpId, existing.id);
      continue;
    }
    const title = String(p.post_title ?? "Untitled course");
    const track =
      trackByOldCourse.get(Number(meta(wpId, "course_id") ?? 0)) ??
      guessTrack(title);
    const bodyHtml = cleanHtml(String(p.post_content ?? ""));
    const description =
      String(p.post_excerpt ?? "").trim() || stripHtml(bodyHtml).slice(0, 300);
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
        description,
        track,
        sortOrder: Number(p.menu_order) || 0,
        published: p.post_status === "publish",
        createdAt: wpDate(p.post_date) ?? new Date(),
      })
      .returning();
    courseIdByOldLesson.set(wpId, created.id);
    newCourses++;
    if (stripHtml(bodyHtml).length > 0) {
      await db.insert(lessons).values({
        wpPostId: -wpId, // marker: the Overview lesson generated from old lesson wpId
        courseId: created.id,
        slug: "overview",
        title: "Overview",
        contentHtml: bodyHtml,
        sortOrder: 0,
        published: p.post_status === "publish",
      });
    }
  }
  report.push(
    `courses: ${newCourses} imported (tracks assigned from the old structure — review in /admin/courses)`
  );

  // ---- Lessons (the old LearnDash topics) ------------------------------
  const lessonIdByOldTopic = new Map<number, number>();
  const courseOfNewLesson = new Map<number, number>();
  let newLessons = 0;
  let orphanTopics = 0;
  const perCourseOrder = new Map<number, number>();
  const oldTopics = byType("sfwd-topic").sort(
    (a, b) =>
      (Number(a.menu_order) || 0) - (Number(b.menu_order) || 0) ||
      Number(a.ID) - Number(b.ID)
  );
  for (const p of oldTopics) {
    const wpId = Number(p.ID);
    const parentOldLesson = Number(meta(wpId, "lesson_id") ?? 0);
    const courseId = courseIdByOldLesson.get(parentOldLesson);
    if (!courseId) {
      orphanTopics++;
      continue;
    }
    const existing = await db.query.lessons.findFirst({
      where: eq(lessons.wpPostId, wpId),
    });
    if (existing) {
      lessonIdByOldTopic.set(wpId, existing.id);
      courseOfNewLesson.set(existing.id, existing.courseId);
      continue;
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
    const order = (perCourseOrder.get(courseId) ?? 0) + 10;
    perCourseOrder.set(courseId, order);
    const [created] = await db
      .insert(lessons)
      .values({
        wpPostId: wpId,
        courseId,
        slug,
        title,
        contentHtml: cleanHtml(String(p.post_content ?? "")),
        sortOrder: order,
        published: p.post_status === "publish",
      })
      .returning();
    lessonIdByOldTopic.set(wpId, created.id);
    courseOfNewLesson.set(created.id, courseId);
    newLessons++;
  }
  report.push(
    `lessons: ${newLessons} imported` +
      (orphanTopics ? ` (${orphanTopics} skipped — no parent course)` : "")
  );

  /**
   * Resolve an old step ID (which may be an old lesson = new course, or an
   * old topic = new lesson) to where things attach in the new structure.
   */
  function resolveStep(
    oldId: number
  ): { courseId: number; lessonId: number | null } | null {
    const asCourse = courseIdByOldLesson.get(oldId);
    if (asCourse) return { courseId: asCourse, lessonId: null };
    const asLesson = lessonIdByOldTopic.get(oldId);
    if (asLesson) {
      const courseId = courseOfNewLesson.get(asLesson);
      if (courseId) return { courseId, lessonId: asLesson };
    }
    return null;
  }

  // ---- Enrollment + progress collectors --------------------------------
  // Filled in by every import path below, inserted at the end.
  const enrollMap = new Map<
    string,
    { userId: number; courseId: number; enrolledAt: Date; completedAt: Date | null }
  >();
  function noteEnrollment(
    userId: number,
    courseId: number,
    when: Date | null,
    completedAt: Date | null = null
  ) {
    const key = `${userId}:${courseId}`;
    const cur = enrollMap.get(key);
    if (!cur) {
      enrollMap.set(key, {
        userId,
        courseId,
        enrolledAt: when ?? new Date(),
        completedAt,
      });
      return;
    }
    if (when && when < cur.enrolledAt) cur.enrolledAt = when;
    if (completedAt && (!cur.completedAt || completedAt > cur.completedAt))
      cur.completedAt = completedAt;
  }
  const progressMap = new Map<string, { userId: number; lessonId: number; at: Date }>();
  function noteProgress(userId: number, lessonId: number, at: Date | null) {
    const key = `${userId}:${lessonId}`;
    if (!progressMap.has(key))
      progressMap.set(key, { userId, lessonId, at: at ?? new Date() });
    const courseId = courseOfNewLesson.get(lessonId);
    if (courseId) noteEnrollment(userId, courseId, at);
  }

  // ---- File submissions (sfwd-assignment posts) ------------------------
  const stepAssignmentByOldParent = new Map<number, number>();

  async function assignmentForStep(oldParentId: number): Promise<
    { id: number; courseId: number } | null
  > {
    const step = resolveStep(oldParentId);
    if (!step) return null;
    const cached = stepAssignmentByOldParent.get(oldParentId);
    if (cached) return { id: cached, courseId: step.courseId };
    const marker = -oldParentId;
    const existing = await db.query.assignments.findFirst({
      where: eq(assignments.wpPostId, marker),
    });
    if (existing) {
      stepAssignmentByOldParent.set(oldParentId, existing.id);
      return { id: existing.id, courseId: step.courseId };
    }
    let title = "Assignment";
    if (step.lessonId) {
      const l = await db.query.lessons.findFirst({
        where: eq(lessons.id, step.lessonId),
      });
      if (l) title = `Assignment — ${l.title}`;
    } else {
      const c = await db.query.courses.findFirst({
        where: eq(courses.id, step.courseId),
      });
      if (c) title = `Assignment — ${c.title}`;
    }
    const [created] = await db
      .insert(assignments)
      .values({
        wpPostId: marker,
        courseId: step.courseId,
        lessonId: step.lessonId,
        title,
        instructionsHtml:
          "<p>Complete the assignment for this lesson and upload your work.</p>",
        points: 100,
      })
      .returning();
    stepAssignmentByOldParent.set(oldParentId, created.id);
    return { id: created.id, courseId: step.courseId };
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
  for (const p of byType("sfwd-assignment")) {
    const wpId = Number(p.ID);
    const userId = userIdByWp.get(Number(p.post_author));
    const parent = Number(meta(wpId, "lesson_id") ?? 0);
    const assignment = userId ? await assignmentForStep(parent) : null;
    if (!userId || !assignment) {
      skippedSubs++;
      continue;
    }
    const submittedAt = wpDate(p.post_date) ?? new Date();
    noteEnrollment(userId, assignment.courseId, submittedAt);

    const existing = await db.query.submissions.findFirst({
      where: eq(submissions.wpPostId, wpId),
    });
    if (existing) continue;

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
      assignmentId: assignment.id,
      userId,
      text: null,
      fileUrl,
      fileName: meta(wpId, "file_name") ?? (String(p.post_title ?? "") || null),
      status: approved ? "approved" : "submitted",
      submittedAt,
      score: approved ? score ?? 100 : score,
      feedback,
      gradedAt: approved || feedback ? wpDate(p.post_modified) ?? new Date() : null,
    });
    newSubs++;
  }
  report.push(
    `file submissions: ${newSubs} imported` +
      (skippedSubs ? ` (${skippedSubs} skipped — missing user or lesson)` : "")
  );

  // ---- Quiz grades (learndash_user_activity) ---------------------------
  // Every attempt is an activity row with meta (points, total_points,
  // percentage…). Best attempt per student per quiz becomes an approved
  // submission on a "Quiz — …" assignment attached where the quiz lived.
  const quizPosts = new Map<number, Row>();
  const quizPostByProId = new Map<number, number>();
  for (const p of byType("sfwd-quiz")) {
    quizPosts.set(Number(p.ID), p);
    const pro = Number(meta(Number(p.ID), "quiz_pro_id") ?? 0);
    if (pro) quizPostByProId.set(pro, Number(p.ID));
  }
  const quizAssignmentByWp = new Map<number, { id: number; courseId: number }>();
  let newQuizGrades = 0;
  let skippedQuizzes = 0;

  async function assignmentForQuiz(
    wpQuizId: number,
    totalPoints?: number
  ): Promise<{ id: number; courseId: number } | null> {
    const cached = quizAssignmentByWp.get(wpQuizId);
    if (cached) return cached;
    const p = quizPosts.get(wpQuizId);
    if (!p) return null;
    const step = resolveStep(Number(meta(wpQuizId, "lesson_id") ?? 0));
    if (!step) {
      skippedQuizzes++;
      return null;
    }
    const existing = await db.query.assignments.findFirst({
      where: eq(assignments.wpPostId, wpQuizId),
    });
    if (existing) {
      const value = { id: existing.id, courseId: existing.courseId };
      quizAssignmentByWp.set(wpQuizId, value);
      return value;
    }
    const [created] = await db
      .insert(assignments)
      .values({
        wpPostId: wpQuizId,
        courseId: step.courseId,
        lessonId: step.lessonId,
        title: `Quiz — ${String(p.post_title ?? "Quiz")}`,
        instructionsHtml:
          "<p>This quiz was taken on the old TFM site; the score below was imported with it.</p>",
        points: totalPoints && totalPoints > 0 ? totalPoints : 100,
      })
      .returning();
    const value = { id: created.id, courseId: created.courseId };
    quizAssignmentByWp.set(wpQuizId, value);
    return value;
  }

  type Attempt = { points: number; total: number; pct: number; when: number };
  const bestAttempt = new Map<string, { userId: number; quizPostId: number } & Attempt>();
  for (const a of activities) {
    if (a.activity_type !== "quiz") continue;
    const userId = userIdByWp.get(Number(a.user_id));
    if (!userId) continue;
    const am = activityMetaByActivity.get(Number(a.activity_id));
    if (!am) continue;
    const quizPostId =
      Number(am.get("quiz") ?? 0) ||
      quizPostByProId.get(Number(am.get("pro_quizid") ?? 0)) ||
      Number(a.post_id);
    if (!quizPostId || !quizPosts.has(quizPostId)) continue;
    const attempt: Attempt = {
      points: Number(am.get("points") ?? 0),
      total: Number(am.get("total_points") ?? 0),
      pct: Number(am.get("percentage") ?? 0),
      when:
        Number(am.get("completed") ?? 0) ||
        Number(a.activity_completed ?? 0) ||
        Number(a.activity_updated ?? 0),
    };
    const key = `${userId}:${quizPostId}`;
    const cur = bestAttempt.get(key);
    if (!cur || attempt.pct > cur.pct) {
      bestAttempt.set(key, { userId, quizPostId, ...attempt });
    }
  }
  for (const r of bestAttempt.values()) {
    const assignment = await assignmentForQuiz(r.quizPostId, r.total);
    if (!assignment) continue;
    const when = unixDate(r.when) ?? new Date();
    noteEnrollment(r.userId, assignment.courseId, when);
    const already = await db.query.submissions.findFirst({
      where: and(
        eq(submissions.assignmentId, assignment.id),
        eq(submissions.userId, r.userId)
      ),
    });
    if (already) continue;
    await db.insert(submissions).values({
      assignmentId: assignment.id,
      userId: r.userId,
      text: `Imported quiz result from the old site: ${r.points}/${r.total} (${Math.round(r.pct)}%)`,
      status: "approved",
      submittedAt: when,
      score: r.points,
      gradedAt: when,
    });
    newQuizGrades++;
  }
  report.push(
    `quiz grades: ${newQuizGrades} imported (best attempt per student per quiz)` +
      (skippedQuizzes ? ` — ${skippedQuizzes} quiz(es) unplaceable, skipped` : "")
  );

  // ---- Essay answers (sfwd-essays) -------------------------------------
  let newEssays = 0;
  let skippedEssays = 0;
  for (const p of byType("sfwd-essays")) {
    const wpId = Number(p.ID);
    const userId = userIdByWp.get(Number(p.post_author));
    const quizPostId =
      Number(meta(wpId, "quiz_post_id") ?? 0) ||
      quizPostByProId.get(Number(meta(wpId, "quiz_pro_id") ?? 0)) ||
      0;
    const assignment =
      userId && quizPostId ? await assignmentForQuiz(quizPostId) : null;
    if (!userId || !assignment) {
      skippedEssays++;
      continue;
    }
    const when = wpDate(p.post_date) ?? new Date();
    noteEnrollment(userId, assignment.courseId, when);

    const marker = `[Essay #${wpId}]`;
    const essayText = `${marker} ${String(p.post_title ?? "Essay")}\n${String(p.post_content ?? "").trim()}`;
    const existing = await db.query.submissions.findFirst({
      where: and(
        eq(submissions.assignmentId, assignment.id),
        eq(submissions.userId, userId)
      ),
    });
    if (existing) {
      if (existing.text?.includes(marker)) continue; // already imported
      await db
        .update(submissions)
        .set({ text: [existing.text, essayText].filter(Boolean).join("\n\n") })
        .where(eq(submissions.id, existing.id));
    } else {
      const graded = p.post_status === "graded";
      await db.insert(submissions).values({
        wpPostId: wpId,
        assignmentId: assignment.id,
        userId,
        text: essayText,
        status: graded ? "approved" : "submitted",
        submittedAt: when,
        gradedAt: graded ? when : null,
      });
    }
    newEssays++;
  }
  report.push(
    `essay answers: ${newEssays} imported` +
      (skippedEssays ? ` (${skippedEssays} skipped — missing user or quiz)` : "")
  );

  // ---- Progress --------------------------------------------------------
  // Old topic completed → lesson completed here. Old lesson completed →
  // course completed here. Both arrive from two sources: the serialized
  // usermeta and the activity log.
  for (const u of t.users) {
    const wpUserId = Number(u.ID);
    const userId = userIdByWp.get(wpUserId);
    if (!userId) continue;
    const progress = tryUnserialize(
      usermetaByUser.get(wpUserId)?.get("_sfwd-course_progress") ?? ""
    );
    if (!progress || typeof progress !== "object") continue;
    for (const courseProgress of Object.values(progress)) {
      if (!courseProgress || typeof courseProgress !== "object") continue;
      const cp = courseProgress as Record<string, Php>;
      const lessonsMap = cp["lessons"];
      if (lessonsMap && typeof lessonsMap === "object") {
        for (const [oldLessonId, done] of Object.entries(lessonsMap)) {
          if (Number(done) !== 1) continue;
          const courseId = courseIdByOldLesson.get(Number(oldLessonId));
          if (courseId) noteEnrollment(userId, courseId, null, new Date());
        }
      }
      const topicsMap = cp["topics"];
      if (topicsMap && typeof topicsMap === "object") {
        for (const perLesson of Object.values(topicsMap)) {
          if (!perLesson || typeof perLesson !== "object") continue;
          for (const [oldTopicId, done] of Object.entries(perLesson)) {
            if (Number(done) !== 1) continue;
            const lessonId = lessonIdByOldTopic.get(Number(oldTopicId));
            if (lessonId) noteProgress(userId, lessonId, null);
          }
        }
      }
    }
  }
  for (const a of activities) {
    const userId = userIdByWp.get(Number(a.user_id));
    if (!userId) continue;
    const started = unixDate(a.activity_started);
    const completed = unixDate(a.activity_completed);
    const isDone = Number(a.activity_status) === 1;
    if (a.activity_type === "topic" && isDone) {
      const lessonId = lessonIdByOldTopic.get(Number(a.post_id));
      if (lessonId) noteProgress(userId, lessonId, completed ?? started);
    } else if (a.activity_type === "lesson") {
      const courseId = courseIdByOldLesson.get(Number(a.post_id));
      if (courseId)
        noteEnrollment(userId, courseId, started, isDone ? completed ?? new Date() : null);
    }
  }

  let newProgress = 0;
  for (const p of progressMap.values()) {
    const res = await db
      .insert(lessonProgress)
      .values({ userId: p.userId, lessonId: p.lessonId, completedAt: p.at })
      .onConflictDoNothing()
      .returning();
    if (res.length > 0) newProgress++;
  }
  let newEnrollments = 0;
  for (const e of enrollMap.values()) {
    const res = await db
      .insert(enrollments)
      .values(e)
      .onConflictDoNothing()
      .returning();
    if (res.length > 0) newEnrollments++;
  }
  report.push(`enrollments: ${newEnrollments} imported (from actual activity)`);
  report.push(`lesson completions: ${newProgress} imported`);

  console.log("\n===== Import complete =====");
  for (const line of report) console.log("  • " + line);
  console.log(`
Next steps:
  1. Review courses in /admin/courses — draft content from the old site
     arrived unpublished, so publish what students should see.
  2. Spot-check a student in /admin/students against the old gradebook.
  3. Assignment files still point at ${OLD_SITE} — keep that
     hosting live until you're ready, or re-upload the files you care about.
`);
  process.exit(0);
}

// Only run when executed directly (analyze-dump.ts imports the parser).
if (process.argv[1]?.includes("import-learndash")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
