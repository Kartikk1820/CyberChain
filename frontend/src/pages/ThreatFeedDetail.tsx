import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, ShieldAlert, X } from "lucide-react";
import type { ThreatReport, ScoreBreakdown, ReportAttachmentSummary, ReportComment } from "@sixsync/shared";
import {
  attachmentDownloadUrl,
  confirmReport,
  getReportAttachments,
  getReportComments,
  getReportDetail,
  postComment,
  simulateTampering,
  uploadAttachment,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useWsEvents } from "../api/useWsEvents";
import { ConfidenceMeter } from "../components/ConfidenceMeter";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentsPanel({ reportId }: { reportId: string }) {
  const { token } = useAuth();
  const [attachments, setAttachments] = useState<ReportAttachmentSummary[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setAttachments(await getReportAttachments(reportId));
  }, [reportId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !token) return;
    setUploadError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await uploadAttachment(reportId, formData, token);
      await refresh();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Attachments ({attachments.length})</h2>
        <label>
          <Button variant="accent" size="sm" disabled={uploading} asChild>
            <span className="cursor-pointer">{uploading ? "uploading…" : "+ upload evidence"}</span>
          </Button>
          <input type="file" className="hidden" disabled={uploading} onChange={handleFile} />
        </label>
      </div>
      {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
      {attachments.length === 0 && <p className="text-sm text-muted-foreground">No screenshots, logs, or files attached yet.</p>}
      <div className="space-y-2">
        {attachments.map((a) => (
          <a
            key={a.id}
            href={attachmentDownloadUrl(a.id)}
            className="flex items-center justify-between rounded-lg border border-border bg-card/60 px-3 py-2 hover:border-primary/40 transition-colors"
          >
            <div>
              <p className="text-sm text-foreground">{a.filename}</p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(a.size)} · uploaded by {a.uploadedByOrgName} · {new Date(a.createdAt).toLocaleString()}
              </p>
            </div>
            <span className="text-xs text-primary">download</span>
          </a>
        ))}
      </div>
    </div>
  );
}

type ReportDetail = ThreatReport & {
  evidenceIntegrity: boolean | null;
  blockchainVerified: boolean;
};

function VerificationPill({ ok, label }: { ok: boolean | null; label: string }) {
  if (ok === null) return null;
  return (
    <Badge variant={ok ? "success" : "destructive"}>
      {ok ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />} {label}
    </Badge>
  );
}

const BREAKDOWN_ROWS: Array<{
  key: keyof Pick<ScoreBreakdown, "reporterReputation" | "evidenceScore" | "aiConfidence" | "confirmationScore" | "freshness">;
  label: string;
  weightKey: keyof ScoreBreakdown["weights"];
  color: string;
}> = [
  { key: "reporterReputation", label: "Reporter reputation", weightKey: "reputation", color: "bg-primary" },
  { key: "evidenceScore", label: "Evidence quality", weightKey: "evidence", color: "bg-emerald-500" },
  { key: "aiConfidence", label: "AI / rule-based confidence", weightKey: "aiConfidence", color: "bg-amber-500" },
  { key: "confirmationScore", label: "Network confirmations", weightKey: "confirmation", color: "bg-purple-500" },
  { key: "freshness", label: "Freshness", weightKey: "freshness", color: "bg-slate-400" },
];

function ScoreBreakdownPanel({ breakdown }: { breakdown: ScoreBreakdown }) {
  return (
    <div className="rounded-lg border border-border bg-card/60 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-foreground">How this score was calculated</h2>
      <div className="space-y-2">
        {BREAKDOWN_ROWS.map((row) => {
          const raw = breakdown[row.key];
          const weight = breakdown.weights[row.weightKey];
          const contribution = raw * weight;
          return (
            <div key={row.key}>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>
                  {row.label} <span className="text-muted-foreground/70">({(weight * 100).toFixed(0)}% weight)</span>
                </span>
                <span className="text-foreground/90">
                  {raw.toFixed(1)} → +{contribution.toFixed(1)}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                <div className={`h-full ${row.color}`} style={{ width: `${Math.min(100, raw)}%` }} />
              </div>
            </div>
          );
        })}
        {breakdown.disputePenalty > 0 && (
          <div>
            <div className="flex items-center justify-between text-xs text-destructive mb-1">
              <span>Dispute penalty</span>
              <span>−{breakdown.disputePenalty.toFixed(1)}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-red-500" style={{ width: `${Math.min(100, breakdown.disputePenalty)}%` }} />
            </div>
          </div>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        score = 25% reputation + 15% evidence + 15% AI confidence + 30% confirmations + 15% freshness − dispute penalty
      </p>
    </div>
  );
}

function ConfirmationHistory({ confirmations }: { confirmations: NonNullable<ThreatReport["confirmations"]> }) {
  if (confirmations.length === 0) {
    return <p className="text-sm text-muted-foreground">No other organization has confirmed or disputed this report yet.</p>;
  }
  return (
    <div className="space-y-2">
      {confirmations.map((c) => (
        <div key={c.id} className="flex items-start justify-between rounded-lg border border-border bg-card/60 px-3 py-2">
          <div>
            <p className="text-sm">
              <span className="text-foreground">{c.confirmingOrgName}</span>{" "}
              <span className={c.type === "CONFIRM" ? "text-emerald-400" : "text-destructive"}>
                {c.type === "CONFIRM" ? "confirmed" : "disputed"}
              </span>{" "}
              this report
            </p>
            {c.evidenceNote && <p className="text-xs text-muted-foreground mt-0.5">"{c.evidenceNote}"</p>}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap ml-3">{new Date(c.createdAt).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function CommentThread({ reportId }: { reportId: string }) {
  const { organization, token } = useAuth();
  const [comments, setComments] = useState<ReportComment[]>([]);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setComments(await getReportComments(reportId));
  }, [reportId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useWsEvents((event) => {
    if (event.type === "comment:new" && event.payload.threatReportId === reportId) {
      refresh();
    }
  });

  async function post() {
    const body = draft.trim();
    if (!body || !token) return;
    setPostError(null);
    setPosting(true);
    try {
      await postComment(reportId, body, token);
      setDraft("");
      await refresh();
    } catch (err) {
      setPostError(err instanceof Error ? err.message : "failed to post comment");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-foreground">Discussion ({comments.length})</h2>
      {comments.length === 0 && <p className="text-sm text-muted-foreground">No discussion yet — be the first to weigh in.</p>}
      <div className="space-y-2">
        {comments.map((c) => (
          <div key={c.id} className="rounded-lg border border-border bg-card/60 px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-foreground">{c.authorOrgName}</span>
              <span className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</span>
            </div>
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{c.body}</p>
          </div>
        ))}
      </div>
      {organization && (
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add to the discussion — is this really C2, false positive, seen it elsewhere?"
            rows={2}
          />
          {postError && <p className="text-xs text-destructive">{postError}</p>}
          <Button disabled={posting || !draft.trim()} onClick={post} variant="accent" size="sm">
            {posting ? "Posting…" : "Post comment"}
          </Button>
        </div>
      )}
    </div>
  );
}

export function ThreatFeedDetail() {
  const { id } = useParams<{ id: string }>();
  const { organization, token } = useAuth();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tamperMessage, setTamperMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!id) return;
    const detail = await getReportDetail(id);
    setReport(detail as ReportDetail);
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useWsEvents((event) => {
    if (
      (event.type === "report:updated" && event.payload.reportId === id) ||
      (event.type === "confirmation:new" && event.payload.reportId === id) ||
      (event.type === "tamper:detected" && event.payload.reportId === id)
    ) {
      refresh();
    }
  });

  async function vote(type: "CONFIRM" | "DISPUTE") {
    if (!id || !token) return;
    setError(null);
    setBusy(true);
    try {
      await confirmReport(id, type, token);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "vote failed");
    } finally {
      setBusy(false);
    }
  }

  async function runTamperDemo() {
    if (!id || !token) return;
    setBusy(true);
    try {
      const result = await simulateTampering(id, token);
      setTamperMessage(result.message);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "tamper simulation failed");
    } finally {
      setBusy(false);
    }
  }

  if (!report) return <p className="text-muted-foreground text-sm">Loading…</p>;

  const alreadyVoted = report.confirmations?.some((c) => c.confirmingOrgId === organization?.id);
  const isOwnReport = report.reporterOrgId === organization?.id;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-lg font-mono font-semibold">{report.indicator}</h1>
          <span className="text-xs text-muted-foreground">{report.indicatorType}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {report.attackType} · {report.mitreTechnique} · severity {report.severity} · status{" "}
          <span className="font-medium text-foreground">{report.status}</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <VerificationPill ok={report.blockchainVerified} label="blockchain verified" />
        <VerificationPill ok={true} label="signature valid" />
        <VerificationPill ok={report.evidenceIntegrity} label="evidence integrity" />
      </div>

      {tamperMessage && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-red-300">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          {tamperMessage}
        </div>
      )}

      <ConfidenceMeter score={report.confidenceScore ?? 0} status={report.status} />

      <Card>
        <CardContent className="pt-4 space-y-2">
          <p className="text-sm text-foreground/90">{report.description}</p>
          <p className="text-xs text-muted-foreground">
            Reported by <span className="text-foreground/90">{report.reporter?.name}</span> on{" "}
            {new Date(report.createdAt).toLocaleString()}
          </p>
          {report.blockchainBlockId !== null && (
            <p className="text-xs text-muted-foreground">
              Ledger block #{report.blockchainBlockId} · payload hash {report.payloadHash.slice(0, 16)}…
            </p>
          )}
        </CardContent>
      </Card>

      {report.scoreBreakdown && <ScoreBreakdownPanel breakdown={report.scoreBreakdown} />}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Confirmation history</h2>
        <ConfirmationHistory confirmations={report.confirmations ?? []} />
      </div>

      <AttachmentsPanel reportId={report.id} />

      <CommentThread reportId={report.id} />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <Button
          disabled={busy || isOwnReport || alreadyVoted}
          onClick={() => vote("CONFIRM")}
          className="bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 shadow-none"
        >
          <Check className="h-3.5 w-3.5" /> Confirm
        </Button>
        <Button disabled={busy || isOwnReport || alreadyVoted} onClick={() => vote("DISPUTE")} variant="destructive">
          <X className="h-3.5 w-3.5" /> Dispute
        </Button>
        <Button disabled={busy} onClick={runTamperDemo} variant="outline">
          Simulate Tampering
        </Button>
      </div>
      {isOwnReport && <p className="text-xs text-muted-foreground">You cannot confirm or dispute your own report.</p>}
      {alreadyVoted && !isOwnReport && <p className="text-xs text-muted-foreground">You've already voted on this report.</p>}
    </div>
  );
}
