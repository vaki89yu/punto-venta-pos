import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { ApiError } from "@/lib/server/http";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export const SESSION_COOKIE = "pos_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

type SessionPayload = { sub: string; exp: number; version: 1 };
type DbUser = typeof users.$inferSelect;

export type PublicUser = Pick<DbUser, "id" | "name" | "email" | "role" | "avatar" | "isActive" | "createdAt" | "updatedAt" | "lastLoginAt">;

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new ApiError(503, "SESSION_NOT_CONFIGURED", "Configura SESSION_SECRET con al menos 32 caracteres aleatorios.");
  }
  return secret;
}

function sign(encodedPayload: string) {
  return createHmac("sha256", getSessionSecret()).update(encodedPayload).digest("base64url");
}

export function createSessionToken(userId: string) {
  const payload: SessionPayload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
    version: 1,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function verifySessionToken(token: string): SessionPayload | null {
  const [encodedPayload, suppliedSignature, extra] = token.split(".");
  if (!encodedPayload || !suppliedSignature || extra) return null;
  let expectedSignature: string;
  try { expectedSignature = sign(encodedPayload); } catch { return null; }
  const supplied = Buffer.from(suppliedSignature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as SessionPayload;
    if (payload.version !== 1 || typeof payload.sub !== "string" || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

export async function getAuthenticatedUser(): Promise<PublicUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verifySessionToken(token);
  if (!payload) return null;
  const [user] = await getDb().select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    avatar: users.avatar,
    isActive: users.isActive,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
    lastLoginAt: users.lastLoginAt,
  }).from(users).where(eq(users.id, payload.sub)).limit(1);
  return user?.isActive ? user : null;
}

export async function requireUser() {
  const user = await getAuthenticatedUser();
  if (!user) throw new ApiError(401, "UNAUTHENTICATED", "Inicia sesión para continuar.");
  return user;
}

export async function requireRole(...roles: PublicUser["role"][]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new ApiError(403, "FORBIDDEN", "Tu usuario no tiene permiso para realizar esta operación.");
  return user;
}

export function publicUser(user: DbUser): PublicUser {
  const { password: _password, ...safeUser } = user;
  return safeUser;
}
