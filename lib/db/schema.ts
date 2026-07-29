import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// TFM's data model. Everything the old LearnDash site tracked lives here:
// people, the three program tracks' courses, lessons, assignments, student
// submissions, and grades. wp* columns remember where a row came from during
// the LearnDash import so re-running the importer never duplicates data.
// ---------------------------------------------------------------------------

export const roleEnum = pgEnum("role", ["student", "admin"]);
export const trackEnum = pgEnum("track", [
  "biblical-studies",
  "practical-skills",
  "ministry-participation",
]);
export const submissionStatusEnum = pgEnum("submission_status", [
  "submitted", // waiting to be graded
  "approved", // graded and accepted
  "returned", // sent back — student may resubmit
]);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    wpUserId: integer("wp_user_id"), // ID on the old WordPress site, if imported
    name: text("name").notNull(),
    email: text("email").notNull(),
    // bcrypt hash. Null for imported users who haven't logged in yet —
    // they still carry their WordPress hash below and get rehashed on
    // first successful login.
    passwordHash: text("password_hash"),
    // WordPress phpass/bcrypt hash carried over by the importer.
    legacyHash: text("legacy_hash"),
    role: roleEnum("role").notNull().default("student"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)]
);

export const courses = pgTable(
  "courses",
  {
    id: serial("id").primaryKey(),
    wpPostId: integer("wp_post_id"),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    track: trackEnum("track").notNull(),
    coverImage: text("cover_image"),
    sortOrder: integer("sort_order").notNull().default(0),
    published: boolean("published").notNull().default(false),
    // TFM runs one course at a time — the "current" course is the one all
    // students see on their dashboard. At most one course has this set
    // (enforced in the setCurrentCourse action).
    current: boolean("current").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("courses_slug_idx").on(t.slug)]
);

export const lessons = pgTable(
  "lessons",
  {
    id: serial("id").primaryKey(),
    wpPostId: integer("wp_post_id"),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    // Sanitized HTML — imported lessons arrive as WordPress HTML.
    contentHtml: text("content_html").notNull().default(""),
    // The standard TFM lesson shape: a teaching video and a fillable PDF
    // worksheet, shown above the content and the homework turn-in.
    videoUrl: text("video_url"),
    worksheetUrl: text("worksheet_url"),
    // When the lesson unlocks for students (null = available right away).
    // TFM's rhythm: lessons open Sunday 3 PM Eastern.
    availableAt: timestamp("available_at"),
    sortOrder: integer("sort_order").notNull().default(0),
    published: boolean("published").notNull().default(true),
  },
  (t) => [uniqueIndex("lessons_course_slug_idx").on(t.courseId, t.slug)]
);

export const assignments = pgTable("assignments", {
  id: serial("id").primaryKey(),
  wpPostId: integer("wp_post_id"),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  // Optional link to the lesson the assignment belongs to.
  lessonId: integer("lesson_id").references(() => lessons.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  instructionsHtml: text("instructions_html").notNull().default(""),
  points: integer("points").notNull().default(100),
  dueAt: timestamp("due_at"),
  sortOrder: integer("sort_order").notNull().default(0),
  published: boolean("published").notNull().default(true),
});

export const enrollments = pgTable(
  "enrollments",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    courseId: integer("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    enrolledAt: timestamp("enrolled_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
    // Official final grade (percent) set by an admin — overrides the
    // computed average on the report card. Covers courses graded on
    // paper before the site existed.
    overridePct: integer("override_pct"),
  },
  (t) => [uniqueIndex("enrollments_user_course_idx").on(t.userId, t.courseId)]
);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    completedAt: timestamp("completed_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("progress_user_lesson_idx").on(t.userId, t.lessonId)]
);

export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  wpPostId: integer("wp_post_id"),
  assignmentId: integer("assignment_id")
    .notNull()
    .references(() => assignments.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  text: text("text"),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  status: submissionStatusEnum("status").notNull().default("submitted"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  // Claude's suggested grade, generated right after submission. Never
  // shown to the student — it pre-fills the mentor's grading form, and
  // the mentor approves (or edits) before anything is released.
  aiScore: integer("ai_score"),
  aiFeedback: text("ai_feedback"),
  // Grading — filled in by an admin.
  score: integer("score"),
  feedback: text("feedback"),
  gradedById: integer("graded_by_id").references(() => users.id, {
    onDelete: "set null",
  }),
  gradedAt: timestamp("graded_at"),
});

export type User = typeof users.$inferSelect;
export type Course = typeof courses.$inferSelect;
export type Lesson = typeof lessons.$inferSelect;
export type Assignment = typeof assignments.$inferSelect;
export type Enrollment = typeof enrollments.$inferSelect;
export type Submission = typeof submissions.$inferSelect;
