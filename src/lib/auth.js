import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, districts } from "@/db/schema";

export const SESSION_COOKIE = "firewatch_session";
const SESSION_DAYS = 7;

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password, stored) {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(derived, expected);
}

export async function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ token, userId, expiresAt });
  return { token, expiresAt };
}

export async function destroySession(token) {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      designation: users.designation,
      districtId: users.districtId,
      districtName: districts.name,
      districtCode: districts.code,
      state: districts.state,
      active: users.active,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .leftJoin(districts, eq(users.districtId, districts.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row || !row.active) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    designation: row.designation,
    districtId: row.districtId,
    districtName: row.districtName,
    districtCode: row.districtCode,
    state: row.state,
  };
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * API-level authorization guard. Every mutating route handler must call this.
 * District-scoped roles cannot read or write another district's records.
 */
export async function requireUser(roles) {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Authentication required");
  if (roles && !roles.includes(user.role)) {
    throw new ApiError(403, "You do not have permission for this action");
  }
  return user;
}

export function assertDistrictScope(user, districtId) {
  if (user.role === "admin") return;
  if (!user.districtId) throw new ApiError(403, "Your account is not mapped to a district");
  if (districtId && districtId !== user.districtId) {
    throw new ApiError(403, "This record belongs to another district");
  }
}
