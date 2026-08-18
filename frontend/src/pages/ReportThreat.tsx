import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { lookupTechnique } from "@sixsync/shared";
import type { IndicatorType } from "@sixsync/shared";
import { useAuth } from "../context/AuthContext";
import { signReportPayload } from "../crypto/keypair";
import { submitReport } from "../api/client";
import { Card, CardContent } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

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
      toast.success("Report signed & anchored", { description: `${indicator} — block anchored to the ledger.` });
      setTimeout(() => navigate(`/reports/${report.id}`), 800);
    } catch (err) {
      const message = err instanceof Error ? err.message : "report submission failed";
      setError(message);
      toast.error("Submission failed", { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl space-y-1">
      <h1 className="text-lg font-semibold">Report a Threat</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Signed client-side with your organization's private key, hashed, and anchored to the ledger on submission.
      </p>

      <Card>
        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="indicator">Indicator</Label>
                <Input
                  id="indicator"
                  required
                  value={indicator}
                  onChange={(e) => setIndicator(e.target.value)}
                  placeholder="203.0.113.42 / evil.example / …"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={indicatorType} onValueChange={(v) => setIndicatorType(v as IndicatorType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INDICATOR_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                required
                minLength={20}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the attack, evidence observed, and impact…"
              />
              <p className="text-xs text-muted-foreground">
                Suggested classification: <span className="text-foreground/90">{suggested.defaultAttackType}</span> (
                {suggested.id} — {suggested.name})
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Evidence file (optional)</Label>
              <input
                type="file"
                onChange={(e) => setEvidenceFile(e.target.files?.[0] ?? null)}
                className="w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-2.5 file:py-1.5 file:text-xs file:text-foreground"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            {success && <p className="text-sm text-emerald-400">{success}</p>}

            <Button disabled={busy} type="submit" className="w-full">
              {busy ? "Signing & anchoring…" : "Sign & Submit Report"}
            </Button>
          </form>
        </CardContent>
      </Card>
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
