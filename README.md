# Throughly Furnished Ministries — tfmchelsea.org

The new TFM training site, built with Next.js (App Router), TypeScript, and
Tailwind CSS in the same style as the Faith Baptist Church website. It
replaces the WordPress + LearnDash site: courses, lessons, assignment
submission, grading with mentor feedback, and student progress all live here.

This README is the manual. If something here is out of date or confusing,
that's a bug — fix it or ask Claude Code to.

## Running it locally

You need Node.js 20+ (you have it via nvm). Then:

```bash
npm install    # once, or after pulling changes
npm run dev    # starts the site at http://localhost:3000
```

No database setup needed for local work: without a `DATABASE_URL` the site
uses PGlite — a real Postgres that stores its data in `.data/pglite`. Demo
logins (created by `npm run db:seed`):

| Who | Email | Password |
|---|---|---|
| Admin | admin@example.com | admin-dev-1234 |
| Student | student@example.com | student-dev-1234 |

**One process at a time:** the local database allows a single writer. Stop
`npm run dev` before running `db:seed` or `import:learndash`, and vice versa.
(Production Postgres has no such limit.)

To start over locally: delete the `.data/` folder and re-run `npm run db:seed`.

## How the site works

Three kinds of people:

- **Visitors** see the public pages: home, the three program tracks
  (Biblical Studies, Practical Skills, Ministry Participation), privacy,
  terms, and can register.
- **Students** enroll in published courses, read lessons and mark them
  complete, submit assignments (written answers and/or file uploads), and
  see their grades and mentor feedback at `/grades`.
- **Admins** get `/admin`: create/edit courses, lessons, and assignments;
  grade the submission queue (approve with a score + feedback, or return
  for revision); manage students (enrollments, roles, deactivation) and
  view any student's full gradebook.

The **first account ever registered becomes the admin** (after that,
everyone registers as a student — admins promote people at
`/admin/students`). If you import the old site's data first, the old
WordPress administrators arrive with their admin role already set.

### Submission lifecycle

student submits → **Waiting for grade** → admin either
**Approves** (score + optional feedback; assignment is done) or
**Returns** (feedback; student may resubmit).

## Where things live

| What | Where |
|---|---|
| Site facts (names, links, verse) | `content/site.json` |
| Pages | `app/(site)/…` |
| Design tokens (brand blues, fonts) | `app/globals.css` — same "Deep and Confident" system as the church site |
| Database schema | `lib/db/schema.ts` (Drizzle ORM) |
| Server actions (all writes) | `lib/actions/` |
| Auth & sessions | `lib/auth/` |
| LearnDash importer | `scripts/import-learndash.ts` |
| Images (from the old site) | `public/images/` |

After editing `lib/db/schema.ts`, run `npm run db:generate` to emit a new
migration into `drizzle/` — migrations apply automatically the next time
the app (or a script) starts.

## Deployment (set up 2026-07-28 — all done)

- GitHub: `stevenabi6912-prog/Throughly-Furnished-Ministries` — every push
  to `main` deploys automatically.
- Vercel project: **tfm-website** (team: faith-baptist-church). Live at
  https://tfm-website-seven.vercel.app until the domain cut-over.
- Provisioned and connected: **Neon Postgres** (`DATABASE_URL`, schema
  auto-migrates), **Blob store `tfm-uploads`** (`BLOB_READ_WRITE_TOKEN`),
  and `AUTH_SECRET` (production + preview).
- Still to do at cut-over: point tfmchelsea.org at Vercel (project →
  Settings → Domains) and set `NEXT_PUBLIC_SITE_URL=https://tfmchelsea.org`.

**`.env.vercel.local`** (gitignored) holds the pulled production
credentials. It is deliberately NOT named `.env.local`, so local `npm run
dev` keeps using the safe local PGlite database. Scripts only touch
production when you explicitly load it (see step 4 below). Refresh it
anytime with `vercel env pull .env.vercel.local`.

## Migrating the LearnDash data (the big one)

Everything the old site tracked comes across in one command: users (with
their passwords — see below), courses, lessons and topics, assignment
submissions with their scores, mentor feedback comments, quiz grades,
enrollments, and lesson-completion progress.

### Step 1 — get the database export from WP Engine

The old site runs on WP Engine (tfmchelsea.wpenginepowered.com). In the
WP Engine portal: **Sites → tfmchelsea → Backup points → download a full
backup**, which contains `wp-content/mysql.sql` (or use phpMyAdmin →
Export → SQL). You want a single `.sql` file.

### Step 2 — dry run

```bash
npm run import:learndash -- ~/Downloads/mysql.sql --dry-run
```

This parses the dump and prints what it found (courses, lessons, users,
submissions…) without touching the database. If everything shows 0, the
table prefix isn't `wp_` — check the dump and pass `--prefix=yourprefix_`.

### Step 3 — import locally and review

```bash
npm run import:learndash -- ~/Downloads/mysql.sql   # stop `npm run dev` first
npm run dev
```

Log in as one of the old admins and click around `/admin`:

- **Course tracks were guessed from titles** — assign any that guessed
  wrong in `/admin/courses` (it's one dropdown per course).
- Spot-check two or three students against the old LearnDash gradebook.
- LearnDash "topics" arrive as lessons, ordered under their parent lesson.
- Quiz scores arrive as approved submissions on a "Quiz — …" assignment
  (best attempt, as a percentage).

### Step 4 — import into production

```bash
set -a; source .env.vercel.local; set +a
npm run import:learndash -- ~/Downloads/mysql.sql
```

(Any script run with `DATABASE_URL` set targets that database instead of
the local one — the `source` line loads the production credentials into
just that terminal session.) The import is **idempotent** — running it twice never
duplicates anything, so it's safe to re-run right before cut-over to pick
up last-minute activity on the old site.

### Passwords carry over

Imported users keep their WordPress passwords: the importer copies each
user's password hash, and the login page verifies old-style WordPress
hashes directly (then silently upgrades them to bcrypt on first
successful login). Nobody needs a password reset. This handles both
classic phpass hashes and the newer WordPress 6.8+ bcrypt format.

### Assignment files

Old uploaded files (essays, photos) still point at the old WP Engine
hosting, so they keep working as long as that hosting is up. Before
cancelling WP Engine, either download the files you care about from
`wp-content/uploads/assignments/` and keep them somewhere safe, or accept
that old file links go dead (the scores and feedback are preserved
regardless — they live in the new database).

### Cut-over checklist

1. Re-run the import (step 4) to catch final activity.
2. Point tfmchelsea.org's DNS at Vercel (project → Settings → Domains).
3. Set `NEXT_PUBLIC_SITE_URL=https://tfmchelsea.org`.
4. Announce to students that the new site is live — same email + password.
5. Keep the WP Engine backup `.sql` file somewhere safe forever.

## Environment variables

| Variable | What it does | Where |
|---|---|---|
| `DATABASE_URL` | Neon Postgres connection string. Absent locally → PGlite in `.data/`. | Set by Vercel when you connect Neon |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob for assignment file uploads. Absent locally → files in `.data/uploads`. | Set by Vercel when you connect Blob |
| `AUTH_SECRET` | Signs login session cookies. **Required in production.** | You, in Vercel env vars |
| `NEXT_PUBLIC_SITE_URL` | Public URL for social previews. | Optional |

## Known notes

- Quizzes are imported as **grade records**, not as retakeable quizzes —
  the new site's assignment model (submit → mentor grades) covers TFM's
  workflow; if interactive quizzes are wanted later, that's a new feature.
- Registration is open (anyone can create a student account), matching the
  old site. Admins can deactivate accounts at `/admin/students`.
- Uploaded submission files are capped at 25 MB each, common document /
  image / audio / video types only.

## Future ideas

- Email notifications (submission received → mentor; graded → student) —
  Resend, same as the church site's contact form.
- Certificates on course completion.
- A "mentor" role that can grade but not manage courses/students.
