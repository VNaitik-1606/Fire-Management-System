import { z } from "zod";
import { apiHandler, ok, parseNumber } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createIncidentFromObservation } from "@/lib/incidents";
import { listIncidents } from "@/lib/queries";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  observationId: z.coerce.number().int().positive(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  cropType: z.string().max(80).optional().nullable(),
  landUse: z.string().max(120).optional().nullable(),
  suspectedCause: z.string().max(160).optional().nullable(),
  summary: z.string().max(2000).optional().nullable(),
});

export async function GET(request) {
  return apiHandler(async () => {
    await ensureSeeded();
    const user = await requireUser();
    const url = new URL(request.url);
    const result = await listIncidents(user, {
      status: url.searchParams.get("status") ?? undefined,
      districtId: parseNumber(url.searchParams.get("districtId")),
      assigneeId: parseNumber(url.searchParams.get("assigneeId")),
      q: url.searchParams.get("q") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
      page: parseNumber(url.searchParams.get("page"), 1),
      pageSize: parseNumber(url.searchParams.get("pageSize"), 20),
    });
    return ok(result);
  });
}

export async function POST(request) {
  return apiHandler(async () => {
    await ensureSeeded();
    const user = await requireUser(["admin", "district_officer"]);
    const body = createSchema.parse(await request.json());
    const incident = await createIncidentFromObservation({ user, ...body });
    return ok({ incident }, { status: 201 });
  });
}
