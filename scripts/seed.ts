/**
 * Seeds demo data for local development: an admin, a student, and one
 * course per track with lessons and an assignment. Safe to re-run (skips
 * anything that already exists). NOT for production.
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import {
  assignments,
  courses,
  enrollments,
  lessons,
  users,
} from "../lib/db/schema";
import { openScriptDb } from "./db";

async function main() {
  const db = await openScriptDb();

  async function ensureUser(
    name: string,
    email: string,
    password: string,
    role: "admin" | "student"
  ) {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (existing) return existing;
    const [u] = await db
      .insert(users)
      .values({ name, email, passwordHash: bcrypt.hashSync(password, 12), role })
      .returning();
    console.log(`Created ${role}: ${email} / ${password}`);
    return u;
  }

  const admin = await ensureUser("TFM Admin", "admin@example.com", "admin-dev-1234", "admin");
  const student = await ensureUser("Sample Student", "student@example.com", "student-dev-1234", "student");
  void admin;

  const demoCourses = [
    {
      slug: "bible-doctrines-1",
      title: "Bible Doctrines I",
      track: "biblical-studies" as const,
      description:
        "A survey of the foundational doctrines of the faith: Scripture, God, Christ, and salvation.",
      lessons: [
        { title: "The Doctrine of Scripture", content: "<p>Study 2 Timothy 3:16–17 and Psalm 119. What does the Bible claim about itself?</p>" },
        { title: "The Doctrine of God", content: "<p>The attributes of God: holiness, love, justice, omniscience, omnipresence.</p>" },
        { title: "The Person of Christ", content: "<p>Fully God and fully man — the hypostatic union and why it matters for the gospel.</p>" },
      ],
      assignment: {
        title: "Essay: Why Inspiration Matters",
        instructions:
          "<p>In 500–800 words, explain the doctrine of inspiration and why it is foundational to missionary work. Cite at least five passages.</p>",
        points: 100,
      },
    },
    {
      slug: "first-aid-basics",
      title: "First Aid Basics",
      track: "practical-skills" as const,
      description:
        "Practical first aid for the field: wounds, burns, fractures, and when to evacuate.",
      lessons: [
        { title: "Assessing an Emergency", content: "<p>Scene safety, ABCs, and calling for help.</p>" },
        { title: "Wound Care", content: "<p>Cleaning, closing, and dressing wounds with limited supplies.</p>" },
      ],
      assignment: {
        title: "Practice Log: Bandaging",
        instructions:
          "<p>Practice the three bandaging techniques from lesson 2 and upload photos of each.</p>",
        points: 50,
      },
    },
    {
      slug: "serving-in-the-local-church",
      title: "Serving in the Local Church",
      track: "ministry-participation" as const,
      description:
        "Active participation in the ministries of Faith Baptist Church, with mentor reflection.",
      lessons: [
        { title: "Finding Your Place to Serve", content: "<p>Survey of the church's ministries and how to plug in.</p>" },
      ],
      assignment: {
        title: "Ministry Reflection — Month 1",
        instructions:
          "<p>Where did you serve this month? Write a one-page reflection on what you learned.</p>",
        points: 100,
      },
    },
  ];

  for (const c of demoCourses) {
    let course = await db.query.courses.findFirst({
      where: eq(courses.slug, c.slug),
    });
    if (!course) {
      [course] = await db
        .insert(courses)
        .values({
          slug: c.slug,
          title: c.title,
          track: c.track,
          description: c.description,
          published: true,
        })
        .returning();
      let order = 0;
      let firstLessonId: number | null = null;
      for (const l of c.lessons) {
        order += 10;
        const [lesson] = await db
          .insert(lessons)
          .values({
            courseId: course.id,
            slug: l.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
            title: l.title,
            contentHtml: l.content,
            sortOrder: order,
          })
          .returning();
        firstLessonId ??= lesson.id;
      }
      await db.insert(assignments).values({
        courseId: course.id,
        lessonId: firstLessonId,
        title: c.assignment.title,
        instructionsHtml: c.assignment.instructions,
        points: c.assignment.points,
      });
      console.log(`Created course: ${c.title}`);
    }
    await db
      .insert(enrollments)
      .values({ userId: student.id, courseId: course.id })
      .onConflictDoNothing();
  }

  console.log("Seed complete.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
