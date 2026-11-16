"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertIcon, CheckIcon } from "@/components/icons";
import { CAUSES, CROPS, STATUS_TRANSITIONS, statusMeta } from "@/lib/constants";

export default function IncidentActions({ incidentId, status, assignedToId, officers, role, canReport }) {
  const router = useRouter();
  const [tab, setTab] = useState(role === "field_officer" ? (canReport ? "report" : "status") : "assign");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(null);

  const [assigneeId, setAssigneeId] = useState(assignedToId ? String(assignedToId) : officers[0] ? String(officers[0].id) : "");
  const [assignNote, setAssignNote] = useState("");

  const transitions = STATUS_TRANSITIONS[status] ?? [];
  const [toStatus, setToStatus] = useState(transitions[0] ?? "");
  const [statusNote, setStatusNote] = useState("");
  const [resolution, setResolution] = useState("");

  const [findings, setFindings] = useState("");
  const [cause, setCause] = useState(CAUSES[0]);
  const [area, setArea] = useState("");
  const [crop, setCrop] = useState(CROPS[0]);
  const [evidence, setEvidence] = useState("");
  const [recommendation, setRecommendation] = useState("");

  async function send(url, body) {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage({ ok: false, text: payload.error ?? "Request rejected" });
      } else {
        setMessage({ ok: true, text: "Action recorded in the audit trail." });
        router.refresh();
      }
    } catch {
      setMessage({ ok: false, text: "Network error. Please retry." });
    } finally {
      setPending(false);
    }
  }

  async function submitReport(event) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/incidents/${incidentId}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          findings,
          causeClassification: cause,
          areaBurnedHa: area ? Number(area) : null,
          cropAffected: crop,
          evidenceUrls: evidence
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          recommendation: recommendation || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        const detail = payload.issues?.[0]?.message;
        setMessage({ ok: false, text: detail ? `${payload.error}: ${detail}` : payload.error ?? "Report rejected" });
      } else {
        setMessage({ ok: true, text: "Field verification report filed." });
        setFindings("");
        setEvidence("");
        setArea("");
        setRecommendation("");
        router.refresh();
      }
    } catch {
      setMessage({ ok: false, text: "Network error. Please retry." });
    } finally {
      setPending(false);
    }
  }

  const tabs = [
    { id: "assign", label: "Assign", show: role !== "field_officer" },
    { id: "status", label: "Status", show: true },
    { id: "report", label: "Field report", show: canReport },
  ];

  return (
    <div className="panel">
      <div className="flex items-center gap-1 border-b border-white/[0.06] p-2">
        {tabs
          .filter((t) => t.show)
          .map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex-1 rounded px-2 py-1.5 text-[11px] font-semibold transition ${
                tab === item.id ? "bg-orange-500/15 text-orange-200" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
      </div>

      <div className="space-y-2.5 p-3">
        {message ? (
          <div
            className={`flex items-start gap-2 rounded-md border px-2.5 py-2 text-[11px] ${
              message.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-rose-500/30 bg-rose-500/10 text-rose-200"
            }`}
          >
            {message.ok ? <CheckIcon width={13} height={13} className="mt-0.5" /> : <AlertIcon width={13} height={13} className="mt-0.5" />}
            {message.text}
          </div>
        ) : null}

        {tab === "assign" ? (
          officers.length === 0 ? (
            <p className="text-[11.5px] text-slate-500">No field officers are mapped to this district. Ask the administrator to create one.</p>
          ) : (
            <div className="space-y-2.5">
              <div>
                <label className="label">Field officer</label>
                <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="input py-1.5 text-[12px]">
                  {officers.map((officer) => (
                    <option key={officer.id} value={officer.id}>
                      {officer.name}
                      {officer.designation ? ` — ${officer.designation}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Instruction note</label>
                <textarea
                  value={assignNote}
                  onChange={(e) => setAssignNote(e.target.value)}
                  rows={2}
                  placeholder="Inspect within 24 hours and submit geo-tagged evidence."
                  className="input resize-none text-[12px]"
                />
              </div>
              <button
                type="button"
                disabled={pending || !assigneeId || ["confirmed", "closed"].includes(status)}
                onClick={() => void send(`/api/incidents/${incidentId}`, { action: "assign", assigneeId: Number(assigneeId), note: assignNote })}
                className="btn btn-primary w-full"
              >
                {pending ? "Saving…" : "Assign investigation"}
              </button>
            </div>
          )
        ) : null}

        {tab === "status" ? (
          transitions.length === 0 ? (
            <p className="text-[11.5px] text-slate-500">This incident is closed. No further status changes are permitted.</p>
          ) : (
            <div className="space-y-2.5">
              <div>
                <label className="label">Next status</label>
                <select value={toStatus} onChange={(e) => setToStatus(e.target.value)} className="input py-1.5 text-[12px]">
                  {transitions.map((next) => (
                    <option key={next} value={next}>
                      {statusMeta(next).label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{statusMeta(toStatus || transitions[0]).description}</p>
              </div>
              <div>
                <label className="label">Decision note</label>
                <textarea
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  rows={2}
                  className="input resize-none text-[12px]"
                  placeholder="Reason for this administrative decision…"
                />
              </div>
              {["confirmed", "unsubstantiated", "closed"].includes(toStatus) ? (
                <div>
                  <label className="label">Resolution summary</label>
                  <textarea
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                    rows={2}
                    className="input resize-none text-[12px]"
                    placeholder="Penalty imposed, evidence reference, compliance status…"
                  />
                </div>
              ) : null}
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  void send(`/api/incidents/${incidentId}`, {
                    action: "status",
                    toStatus,
                    note: statusNote,
                    resolutionSummary: resolution || undefined,
                  })
                }
                className="btn btn-primary w-full"
              >
                {pending ? "Saving…" : "Record status change"}
              </button>
              {["confirmed", "unsubstantiated"].includes(toStatus) ? (
                <p className="text-[10px] leading-relaxed text-amber-300/80">A field verification report is mandatory before this transition is accepted.</p>
              ) : null}
            </div>
          )
        ) : null}

        {tab === "report" && canReport ? (
          <form onSubmit={submitReport} className="space-y-2.5">
            <div>
              <label className="label">Field findings *</label>
              <textarea
                required
                minLength={20}
                value={findings}
                onChange={(e) => setFindings(e.target.value)}
                rows={3}
                placeholder="What did the field party observe at the reported coordinate?"
                className="input resize-none text-[12px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label">Cause classification</label>
                <select value={cause} onChange={(e) => setCause(e.target.value)} className="input py-1.5 text-[11.5px]">
                  {CAUSES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Crop affected</label>
                <select value={crop} onChange={(e) => setCrop(e.target.value)} className="input py-1.5 text-[11.5px]">
                  {CROPS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Area affected (hectares)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="input py-1.5 text-[12px]"
                placeholder="e.g. 1.25"
              />
            </div>
            <div>
              <label className="label">Evidence URLs (one per line)</label>
              <textarea
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                rows={2}
                placeholder="https://evidence.firewatch.gov.in/…"
                className="input resize-none font-mono text-[10.5px]"
              />
            </div>
            <div>
              <label className="label">Recommendation</label>
              <textarea value={recommendation} onChange={(e) => setRecommendation(e.target.value)} rows={2} className="input resize-none text-[12px]" />
            </div>
            <button type="submit" disabled={pending} className="btn btn-emerald w-full">
              {pending ? "Filing report…" : "Submit field verification report"}
            </button>
            <p className="text-[10px] leading-relaxed text-slate-500">
              Submitting a report moves the case to under investigation. Confirmation of burning remains a separate, explicit administrative decision.
            </p>
          </form>
        ) : null}
      </div>
    </div>
  );
}
