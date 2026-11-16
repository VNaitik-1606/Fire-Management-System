import { getCurrentUser } from "@/lib/auth";
import { apiHandler, ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return apiHandler(async () => {
    const user = await getCurrentUser();
    if (!user) return Response.json({ user: null }, { status: 401 });
    return ok({ user });
  });
}
