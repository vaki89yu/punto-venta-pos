import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { assertSameOrigin, jsonError, readJson } from "@/lib/server/http";
import { createSessionToken, publicUser, SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/session";

const loginSchema = z.object({
  email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { email, password } = await readJson(request, loginSchema);
    const db = getDb();
    const [user] = await db.select().from(users).where(sql`lower(${users.email}) = ${email}`).limit(1);
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.password))) {
      return Response.json({ error: { code: "INVALID_CREDENTIALS", message: "Correo o contraseña incorrectos." } }, { status: 401 });
    }
    const [updatedUser] = await db.update(users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id)).returning();
    const response = NextResponse.json({ user: publicUser(updatedUser || user) });
    response.cookies.set(SESSION_COOKIE, createSessionToken(user.id), sessionCookieOptions());
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
