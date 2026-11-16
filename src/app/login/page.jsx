import Image from "next/image";
import { redirect } from "next/navigation";
import LoginForm from "@/components/LoginForm";
import { FlameIcon } from "@/components/icons";
import { getCurrentUser } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";

export const dynamic = "force-dynamic";

const DEMO_ACCOUNTS = [
  { email: "admin@firewatch.gov.in", password: "Firewatch@2026", label: "State administrator — statewide access", role: "Admin" },
  { email: "ludhiana.do@firewatch.gov.in", password: "Firewatch@2026", label: "District officer — Ludhiana, Punjab", role: "District" },
  { email: "amanpreet.fo@firewatch.gov.in", password: "Firewatch@2026", label: "Field officer — Ludhiana, Punjab", role: "Field" },
];

export default async function LoginPage() {
  await ensureSeeded();
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.15fr_1fr]">
      <div className="relative hidden overflow-hidden border-r border-white/[0.07] lg:block">
        <Image
          src="/images/satellite-fires.jpg"
          alt="Satellite view of agricultural fire hotspots over northern India"
          fill
          priority
          className="object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-tr from-[#05080e] via-[#05080e]/80 to-[#05080e]/30" />
        <div className="absolute inset-0 grid-bg opacity-40" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-orange-500/40 bg-orange-500/15 text-orange-300">
              <FlameIcon width={21} height={21} />
            </span>
            <div>
              <p className="text-[15px] font-semibold tracking-tight text-slate-50">FireWatch India</p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Satellite fire & crop burning monitoring cell</p>
            </div>
          </div>

          <div className="max-w-xl">
            <p className="badge border-orange-500/30 bg-orange-500/10 text-orange-300">NASA FIRMS · VIIRS · MODIS</p>
            <h2 className="mt-4 text-[34px] font-semibold leading-[1.1] tracking-tight text-slate-50">
              From thermal anomaly to verified enforcement action.
            </h2>
            <p className="mt-3 max-w-md text-[13px] leading-relaxed text-slate-400">
              A district-level command platform that ingests satellite fire detections, geofences them to administrative boundaries, and routes every
              suspected burning incident through a documented investigation workflow.
            </p>
            <div className="mt-7 grid grid-cols-3 gap-3">
              {[
                { k: "Detections ingested", v: "700+" },
                { k: "Districts geofenced", v: "14" },
                { k: "Human verification", v: "Required" },
              ].map((item) => (
                <div key={item.k} className="rounded-lg border border-white/10 bg-black/30 p-3 backdrop-blur">
                  <p className="font-mono text-[17px] font-semibold text-slate-50">{item.v}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">{item.k}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="max-w-lg text-[10px] leading-relaxed text-slate-500">
            Demo environment: satellite rows are simulated fixtures and clearly marked. No detection is ever classified as crop burning by the system —
            classification is an administrative determination recorded against a named official.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center px-5 py-10 sm:px-10">
        <LoginForm demoAccounts={DEMO_ACCOUNTS} />
      </div>
    </div>
  );
}
