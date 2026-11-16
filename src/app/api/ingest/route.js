import { z } from "zod";
import { apiHandler, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { getIngestRuns } from "@/lib/queries";
import { runIngestion } from "@/lib/ingest";
import { FIRMS_SOURCES, firmsMapKey } from "@/lib/firms";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  source: z.enum(FIRMS_SOURCES.map((s) => s.id)).default("VIIRS_NOAA20_NRT"),
  dayRange: z.coerce.number().int().min(1).max(10).default(3),
  mode: z.enum(["live", "simulate"]).default("live"),
});

export async function GET() {
  return apiHandler(async () => {
    await ensureSeeded();
    const user = await requireUser();
    const runs = await getIngestRuns(12, user);
    return ok({ data: runs, meta: { firmsConfigured: Boolean(firmsMapKey()) } });
  });
}

export async function POST(request) {
  return apiHandler(async () => {
    await ensureSeeded();
    const user = await requireUser(["admin", "district_officer"]);
    const body = bodySchema.parse(await request.json().catch(() => ({})));
    const result = await runIngestion({ user, source: body.source, dayRange: body.dayRange, mode: body.mode });
    return ok({ result }, { status: result.status === "success" ? 200 : 502 });
  });
}
