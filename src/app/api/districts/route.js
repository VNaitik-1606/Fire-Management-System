import { apiHandler, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getDistrictStats } from "@/lib/queries";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  return apiHandler(async () => {
    await ensureSeeded();
    const user = await requireUser();
    const rows = await getDistrictStats(user, 30);
    return ok({ data: rows });
  });
}
