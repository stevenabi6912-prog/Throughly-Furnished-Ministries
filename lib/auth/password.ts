import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";

// ---------------------------------------------------------------------------
// Password hashing. New passwords get bcrypt. Imported users arrive with
// whatever hash WordPress stored, and we verify those directly so nobody
// has to reset a password after the migration:
//
//   $P$ / $H$   phpass "portable" hashes (WordPress < 6.8 — most of them)
//   $wp$2y$...  WordPress 6.8+ (bcrypt over an HMAC-SHA384 pre-hash)
//   $2a/b/y$    plain bcrypt (some security plugins)
//
// On the first successful login the account is silently rehashed to
// bcrypt (see lib/actions/auth.ts).
// ---------------------------------------------------------------------------

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 12);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function verifyLegacyWordPressHash(
  password: string,
  storedHash: string
): boolean {
  if (storedHash.startsWith("$P$") || storedHash.startsWith("$H$")) {
    return verifyPhpass(password, storedHash);
  }
  if (storedHash.startsWith("$wp$")) {
    // WordPress 6.8+: bcrypt(base64(HMAC-SHA384(password, "wp-sha384")))
    const preHashed = createHmac("sha384", "wp-sha384")
      .update(password)
      .digest("base64");
    return bcrypt.compareSync(preHashed, storedHash.slice(3));
  }
  if (/^\$2[abxy]\$/.test(storedHash)) {
    return bcrypt.compareSync(password, storedHash);
  }
  return false;
}

// --- phpass portable hash (the $P$B... format) -----------------------------

const ITOA64 =
  "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function verifyPhpass(password: string, storedHash: string): boolean {
  if (storedHash.length !== 34) return false;
  const countLog2 = ITOA64.indexOf(storedHash[3]);
  if (countLog2 < 7 || countLog2 > 30) return false;
  const salt = storedHash.slice(4, 12);
  if (salt.length !== 8) return false;

  const pw = Buffer.from(password, "utf8");
  let hash = md5(Buffer.concat([Buffer.from(salt, "utf8"), pw]));
  for (let i = 0, rounds = 1 << countLog2; i < rounds; i++) {
    hash = md5(Buffer.concat([hash, pw]));
  }

  const computed = storedHash.slice(0, 12) + encode64(hash, 16);
  const a = Buffer.from(computed);
  const b = Buffer.from(storedHash);
  return a.length === b.length && timingSafeEqual(a, b);
}

function md5(data: Buffer): Buffer {
  return createHash("md5").update(data).digest();
}

function encode64(input: Buffer, count: number): string {
  let output = "";
  let i = 0;
  do {
    let value = input[i++];
    output += ITOA64[value & 0x3f];
    if (i < count) value |= input[i] << 8;
    output += ITOA64[(value >> 6) & 0x3f];
    if (i++ >= count) break;
    if (i < count) value |= input[i] << 16;
    output += ITOA64[(value >> 12) & 0x3f];
    if (i++ >= count) break;
    output += ITOA64[(value >> 18) & 0x3f];
  } while (i < count);
  return output;
}
