// TFM runs on Michigan time. Store UTC in the database, but interpret
// what admins type — and display every schedule/due date — as Eastern,
// so "Saturday at midnight" means Saturday at midnight in Chelsea
// whether the server runs in UTC (Vercel) or locally.

const TZ = "America/Detroit";

/** The UTC timestamp whose Eastern wall-clock reads like `date`'s UTC fields. */
function wallTimeInTz(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return Date.UTC(
    get("year"), get("month") - 1, get("day"),
    get("hour") % 24, get("minute"), get("second")
  );
}

/** "2026-08-02T15:00" (Eastern wall time) → the actual UTC Date. */
export function easternToUtc(wall: string): Date {
  const [d, t = "00:00"] = wall.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [hh, mm] = t.split(":").map(Number);
  const target = Date.UTC(y, m - 1, day, hh, mm);
  let guess = target;
  for (let i = 0; i < 3; i++) guess = target - (wallTimeInTz(new Date(guess)) - guess);
  return new Date(guess);
}

/** A Date → "2026-08-02T15:00" in Eastern time (for datetime-local inputs). */
export function utcToEasternInput(date: Date): string {
  const wall = new Date(wallTimeInTz(date));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}T${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}`;
}

/** Human-readable Eastern rendering ("Sat, Aug 8, 11:59 PM"). */
export function formatEastern(
  date: Date,
  opts: Intl.DateTimeFormatOptions = {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  }
): string {
  return date.toLocaleString("en-US", { timeZone: TZ, ...opts });
}

/**
 * Homework deadline for a lesson that opens at `availableAt`: the
 * following Saturday at 11:59 PM Eastern.
 */
export function saturdayDeadlineAfter(availableAt: Date): Date {
  const wall = new Date(wallTimeInTz(availableAt));
  const daysToSaturday = (6 - wall.getUTCDay() + 7) % 7;
  const pad = (n: number) => String(n).padStart(2, "0");
  const candidate = new Date(
    Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate() + daysToSaturday)
  );
  const sat = easternToUtc(
    `${candidate.getUTCFullYear()}-${pad(candidate.getUTCMonth() + 1)}-${pad(candidate.getUTCDate())}T23:59`
  );
  // If the lesson opens Saturday night after the deadline, roll a week.
  return sat > availableAt ? sat : new Date(sat.getTime() + 7 * 24 * 3600 * 1000);
}

/** Whole weeks past the deadline (0 = on time) — drives the late penalty. */
export function weeksLate(submittedAt: Date, dueAt: Date | null): number {
  if (!dueAt || submittedAt <= dueAt) return 0;
  return Math.ceil((submittedAt.getTime() - dueAt.getTime()) / (7 * 24 * 3600 * 1000));
}
