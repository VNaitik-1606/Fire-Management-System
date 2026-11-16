import { z } from "zod";
import { apiHandler, ok } from "@/lib/api";
import { assertDistrictScope, ApiError, requireUser } from "@/lib/auth";
import { assignIncident, loadIncident, transitionIncident } from "@/lib/incidents";
import { statusValues } from "@/lib/validation";

export const dynamic = "force-dynamic";

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("assign"),
    assigneeId: z.coerce.number().int().positive(),
    note: z.string().max(1000).optional(),
  }),
  z.object({
    action: z.literal("status"),
    toStatus: z.enum(statusValues),
    note: z.string().max(1000).optional(),
    resolutionSummary: z.string().max(2000).optional(),
  }),
]);

export async function GET(_request, context) {
  return apiHandler(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const incident = await loadIncident(Number(id));
    assertDistrictScope(user, incident.districtId);
    if (user.role === "field_officer" && incident.assignedToId !== user.id) {
      throw new ApiError(403, "This incident is not assigned to you");
    }
    return ok({ incident });
  });
}

export async function PATCH(request, context) {
  return apiHandler(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const incidentId = Number(id);
    if (!Number.isFinite(incidentId)) throw new ApiError(400, "Invalid incident id");
    const body = patchSchema.parse(await request.json());

    if (body.action === "assign") {
      if (user.role === "field_officer") throw new ApiError(403, "Field officers cannot assign incidents");
      const incident = await assignIncident({ user, incidentId, assigneeId: body.assigneeId, note: body.note });
      return ok({ incident });
    }

    const incident = await transitionIncident({
      user,
      incidentId,
      toStatus: body.toStatus,
      note: body.note,
      resolutionSummary: body.resolutionSummary,
    });
    return ok({ incident });
  });
}
