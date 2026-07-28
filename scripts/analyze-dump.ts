/**
 * One-off analysis of a LearnDash dump — prints the shape of the data so
 * the importer can be verified against reality.
 *   npx tsx scripts/analyze-dump.ts migration-data/archive/wp-content/mysql.sql
 */
import { readFileSync } from "node:fs";
import { parseDump } from "./import-learndash";

const file = process.argv[2];
const sql = readFileSync(file, "utf8");
const t = parseDump(sql, "wp_");

// Post type × status matrix.
const matrix = new Map<string, number>();
for (const p of t.posts) {
  if (!String(p.post_type).startsWith("sfwd")) continue;
  const key = `${p.post_type} / ${p.post_status}`;
  matrix.set(key, (matrix.get(key) ?? 0) + 1);
}
console.log("== sfwd post types × status ==");
for (const [k, v] of [...matrix].sort()) console.log(`  ${k}: ${v}`);

// Activity types.
const act = new Map<string, number>();
for (const a of t.learndash_user_activity ?? []) {
  const key = String(a.activity_type);
  act.set(key, (act.get(key) ?? 0) + 1);
}
console.log("== learndash_user_activity types ==");
for (const [k, v] of [...act].sort()) console.log(`  ${k}: ${v}`);

// Quiz activity meta keys (sample).
const activityById = new Map(
  (t.learndash_user_activity ?? []).map((a) => [Number(a.activity_id), a])
);
const quizMetaKeys = new Map<string, number>();
let sampleShown = 0;
for (const m of t.learndash_user_activity_meta ?? []) {
  const a = activityById.get(Number(m.activity_id));
  if (!a || a.activity_type !== "quiz") continue;
  const key = String(m.activity_meta_key);
  quizMetaKeys.set(key, (quizMetaKeys.get(key) ?? 0) + 1);
  if (key === "percentage" && sampleShown < 3) {
    console.log(`  sample: activity=${m.activity_id} user=${a.user_id} post=${a.post_id} pct=${m.activity_meta_value}`);
    sampleShown++;
  }
}
console.log("== quiz activity meta keys ==");
for (const [k, v] of [...quizMetaKeys].sort()) console.log(`  ${k}: ${v}`);

// Essays: status + meta keys.
const essayIds = new Set(
  t.posts.filter((p) => p.post_type === "sfwd-essays").map((p) => Number(p.ID))
);
const essayMeta = new Map<string, number>();
for (const m of t.postmeta) {
  if (!essayIds.has(Number(m.post_id))) continue;
  const key = String(m.meta_key);
  essayMeta.set(key, (essayMeta.get(key) ?? 0) + 1);
}
console.log("== essay postmeta keys ==");
for (const [k, v] of [...essayMeta].sort()) console.log(`  ${k}: ${v}`);
const essaySample = t.posts.find((p) => p.post_type === "sfwd-essays");
if (essaySample) {
  console.log("== sample essay ==");
  console.log(`  id=${essaySample.ID} status=${essaySample.post_status} author=${essaySample.post_author} title=${JSON.stringify(essaySample.post_title)}`);
  console.log(`  content: ${JSON.stringify(String(essaySample.post_content).slice(0, 200))}`);
  for (const m of t.postmeta.filter((m) => Number(m.post_id) === Number(essaySample.ID))) {
    console.log(`  meta ${m.meta_key} = ${String(m.meta_value).slice(0, 120)}`);
  }
}

// Statistic refs (quiz attempts).
console.log(`== pro_quiz_statistic_ref rows: ${(t.learndash_pro_quiz_statistic_ref ?? []).length} ==`);

// Which quizzes have a course and a pro-quiz id.
const quizzes = t.posts.filter((p) => p.post_type === "sfwd-quiz");
const metaByPost = new Map<number, Map<string, string>>();
for (const m of t.postmeta) {
  const pid = Number(m.post_id);
  if (!metaByPost.has(pid)) metaByPost.set(pid, new Map());
  metaByPost.get(pid)!.set(String(m.meta_key), String(m.meta_value ?? ""));
}
let withCourse = 0, withPro = 0;
for (const q of quizzes) {
  const m = metaByPost.get(Number(q.ID));
  if (m?.get("course_id")) withCourse++;
  if (m?.get("quiz_pro_id")) withPro++;
}
console.log(`== quizzes: ${quizzes.length} total, ${withCourse} with course_id, ${withPro} with quiz_pro_id ==`);

// Assignment submission posts, any status.
const assignmentPosts = t.posts.filter((p) => p.post_type === "sfwd-assignment");
console.log(`== sfwd-assignment posts: ${assignmentPosts.length} ==`);

// Courses list with status.
console.log("== courses ==");
for (const c of t.posts.filter((p) => p.post_type === "sfwd-courses")) {
  console.log(`  ${c.ID} [${c.post_status}] ${c.post_title}`);
}
console.log("== lessons ==");
for (const l of t.posts.filter((p) => p.post_type === "sfwd-lessons")) {
  const m = metaByPost.get(Number(l.ID));
  console.log(`  ${l.ID} [${l.post_status}] course=${m?.get("course_id")} ${l.post_title}`);
}
