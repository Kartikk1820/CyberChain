import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { lookupTechnique } from "@sixsync/shared";
import type { IndicatorType } from "@sixsync/shared";
import { useAuth } from "../context/AuthContext";
import { signReportPayload } from "../crypto/keypair";
import { submitReport } from "../api/client";

const INDICATOR_TYPES: IndicatorType[] = ["IP", "DOMAIN", "HASH", "URL"];
const SEVERITIES = ["low", "medium", "high", "critical"];

export function ReportThreat() {
  const { organization, token, privateKey } = useAuth();
  const navigate = useNavigate();

  const [indicator, setIndicator] = useState("");
  const [indicatorType, setIndicatorType] = useState<IndicatorType>("IP");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("high");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const suggested = lookupTechnique(`${indicator} ${description}`);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!organization || !token) {
      setError("You must be signed in to report a threat.");
      return;
    }
    if (!privateKey) {
      setError("Private key not loaded in this session — load your keyfile on the sign-in page to sign reports.");
      return;
    }

    setBusy(true);
    try {
      const evidenceFileHash = evidenceFile ? await sha256Hex(evidenceFile) : null;
      const timestamp = new Date().toISOString();

      const signable = {
        reporterOrgId: organization.id,
        indicator,
        indicatorType,
        attackType: suggested.defaultAttackType,
        mitreTechnique: suggested.id,
        severity,
        description,
        evidenceFileHash,
        timestamp,
      };
      const digitalSignature = signReportPayload(signable, privateKey);

      const form = new FormData();
      for (const [key, value] of Object.entries(signable)) {
        if (value !== null) form.append(key, String(value));
      }
      form.append("digitalSignature", digitalSignature);
      if (evidenceFile) form.append("evidence", evidenceFile, evidenceFile.name);

      const report = await submitReport(form, token);
      setSuccess("Report submitted, signed, and anchored to the ledger.");
      setTimeout(() => navigate(`/reports/${report.id}`), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "report submission failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-lg font-semibold mb-1">Report a Threat</h1>
      <p className="text-sm text-slate-500 mb-6">
        Signed client-side with your organization's private key, hashed, and anchored to the ledger on submission.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-slate-400 mb-1">Indicator</label>
            <input
              required
              value={indicator}
              onChange={(e) => setIndicator(e.target.value)}
              placeholder="203.0.113.42 / evil.example / …"
              className="w-full rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Type</label>
            <select
              value={indicatorType}
              onChange={(e) => setIndicatorType(e.target.value as IndicatorType)}
              className="w-full rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-sm"
            >
              {INDICATOR_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Description</label>
          <textarea
            required
            minLength={20}
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the attack, evidence observed, and impact…"
            className="w-full rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-sm"
          />
          <p className="text-xs text-slate-500 mt-1">
            Suggested classification: <span className="text-slate-300">{suggested.defaultAttackType}</span> (
            {suggested.id} — {suggested.name})
          </p>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Severity</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="w-full rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-sm"
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">Evidence file (optional)</label>
          <input
            type="file"
            onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
            className="w-full text-xs text-slate-400"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-emerald-400">{success}</p>}

        <button
          disabled={busy}
          type="submit"
          className="w-full rounded-md bg-sky-500 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-50"
        >
          {busy ? "Signing & anchoring…" : "Sign & Submit Report"}
        </button>
      </form>
    </div>
  );
}

async function sha256Hex(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
