import { cookies } from "next/headers";
import { destroySession, SESSION_COOKIE } from "@/lib/auth";
import { apiHandler, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST() {
  return apiHandler(async () => {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE)?.value;
    if (token) await destroySession(token);
    store.delete(SESSION_COOKIE);
    return ok({ ok: true });
  });
}
