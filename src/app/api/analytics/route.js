import { apiHandler, ok, parseNumber } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getAnalytics } from "@/lib/queries";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET(request) {
  return apiHandler(async () => {
    await ensureSeeded();
    const user = await requireUser();
    const url = new URL(request.url);
    const days = Math.min(Math.max(parseNumber(url.searchParams.get("days"), 30) ?? 30, 7), 90);
    return ok(await getAnalytics(user, days));
  });
}
