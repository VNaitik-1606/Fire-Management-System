import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { getCountsForNav } from "@/lib/queries";
import { ensureSeeded } from "@/lib/seed";
import { firmsMapKey } from "@/lib/firms";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }) {
  await ensureSeeded();
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  let counts = { pendingAssignment: 0, myOpen: 0 };
  try {
    counts = await getCountsForNav(user);
  } catch {
    counts = { pendingAssignment: 0, myOpen: 0 };
  }

  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        role: user.role,
        districtName: user.districtName,
        state: user.state,
        designation: user.designation,
      }}
      counts={counts}
      liveFeed={Boolean(firmsMapKey())}
    >
      {children}
    </AppShell>
  );
}
