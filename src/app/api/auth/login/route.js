import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, SESSION_COOKIE, verifyPassword } from "@/lib/auth";
import { apiHandler, ok } from "@/lib/api";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request) {
  return apiHandler(async () => {
    await ensureSeeded();
    const body = bodySchema.parse(await request.json());
    const [user] = await db.select().from(users).where(eq(users.email, body.email.toLowerCase().trim())).limit(1);
    if (!user || !user.active || !verifyPassword(body.password, user.passwordHash)) {
      return Response.json({ error: "Invalid email or password" }, { status: 401 });
    }
    const { token, expiresAt } = await createSession(user.id);
    const store = await cookies();
    store.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
    });
    return ok({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  });
}
