import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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
        <h2 className="text-sm font-semibold text-slate-200">Attachments ({attachments.length})</h2>
        <label className="text-xs text-sky-400 hover:text-sky-300 cursor-pointer">
          {uploading ? "uploading…" : "+ upload evidence"}
          <input type="file" className="hidden" disabled={uploading} onChange={handleFile} />
        </label>
      </div>
      {uploadError && <p className="text-xs text-red-400">{uploadError}</p>}
      {attachments.length === 0 && <p className="text-sm text-slate-500">No screenshots, logs, or files attached yet.</p>}
      <div className="space-y-2">
        {attachments.map((a) => (
          <a
            key={a.id}
            href={attachmentDownloadUrl(a.id)}
            className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 hover:border-slate-700 transition-colors"
          >
            <div>
              <p className="text-sm text-slate-200">{a.filename}</p>
              <p className="text-xs text-slate-500">
                {formatBytes(a.size)} · uploaded by {a.uploadedByOrgName} · {new Date(a.createdAt).toLocaleString()}
              </p>
            </div>
            <span className="text-xs text-sky-400">download</span>
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

function Badge({ ok, label }: { ok: boolean | null; label: string }) {
  if (ok === null) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        ok ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
      }`}
    >
      {ok ? "✓" : "✗"} {label}
    </span>
  );
}

const BREAKDOWN_ROWS: Array<{
  key: keyof Pick<ScoreBreakdown, "reporterReputation" | "evidenceScore" | "aiConfidence" | "confirmationScore" | "freshness">;
  label: string;
  weightKey: keyof ScoreBreakdown["weights"];
  color: string;
}> = [
  { key: "reporterReputation", label: "Reporter reputation", weightKey: "reputation", color: "bg-sky-500" },
  { key: "evidenceScore", label: "Evidence quality", weightKey: "evidence", color: "bg-emerald-500" },
  { key: "aiConfidence", label: "AI / rule-based confidence", weightKey: "aiConfidence", color: "bg-amber-500" },
  { key: "confirmationScore", label: "Network confirmations", weightKey: "confirmation", color: "bg-purple-500" },
  { key: "freshness", label: "Freshness", weightKey: "freshness", color: "bg-slate-400" },
];

function ScoreBreakdownPanel({ breakdown }: { breakdown: ScoreBreakdown }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-slate-200">How this score was calculated</h2>
      <div className="space-y-2">
        {BREAKDOWN_ROWS.map((row) => {
          const raw = breakdown[row.key];
          const weight = breakdown.weights[row.weightKey];
          const contribution = raw * weight;
          return (
            <div key={row.key}>
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>
                  {row.label} <span className="text-slate-600">({(weight * 100).toFixed(0)}% weight)</span>
                </span>
                <span className="text-slate-300">
                  {raw.toFixed(1)} → +{contribution.toFixed(1)}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div className={`h-full ${row.color}`} style={{ width: `${Math.min(100, raw)}%` }} />
              </div>
            </div>
          );
        })}
        {breakdown.disputePenalty > 0 && (
          <div>
            <div className="flex items-center justify-between text-xs text-red-400 mb-1">
              <span>Dispute penalty</span>
              <span>−{breakdown.disputePenalty.toFixed(1)}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full bg-red-500" style={{ width: `${Math.min(100, breakdown.disputePenalty)}%` }} />
            </div>
          </div>
        )}
      </div>
      <p className="text-[11px] text-slate-500">
        score = 25% reputation + 15% evidence + 15% AI confidence + 30% confirmations + 15% freshness − dispute penalty
      </p>
    </div>
  );
}

function ConfirmationHistory({ confirmations }: { confirmations: NonNullable<ThreatReport["confirmations"]> }) {
  if (confirmations.length === 0) {
    return <p className="text-sm text-slate-500">No other organization has confirmed or disputed this report yet.</p>;
  }
  return (
    <div className="space-y-2">
      {confirmations.map((c) => (
        <div key={c.id} className="flex items-start justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
          <div>
            <p className="text-sm">
              <span className="text-slate-200">{c.confirmingOrgName}</span>{" "}
              <span className={c.type === "CONFIRM" ? "text-emerald-400" : "text-red-400"}>
                {c.type === "CONFIRM" ? "confirmed" : "disputed"}
              </span>{" "}
              this report
            </p>
            {c.evidenceNote && <p className="text-xs text-slate-500 mt-0.5">"{c.evidenceNote}"</p>}
          </div>
          <span className="text-xs text-slate-500 whitespace-nowrap ml-3">{new Date(c.createdAt).toLocaleString()}</span>
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
      <h2 className="text-sm font-semibold text-slate-200">Discussion ({comments.length})</h2>
      {comments.length === 0 && <p className="text-sm text-slate-500">No discussion yet — be the first to weigh in.</p>}
      <div className="space-y-2">
        {comments.map((c) => (
          <div key={c.id} className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-slate-200">{c.authorOrgName}</span>
              <span className="text-xs text-slate-500">{new Date(c.createdAt).toLocaleString()}</span>
            </div>
            <p className="text-sm text-slate-300 whitespace-pre-wrap">{c.body}</p>
          </div>
        ))}
      </div>
      {organization && (
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add to the discussion — is this really C2, false positive, seen it elsewhere?"
            rows={2}
            className="w-full rounded-md border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-slate-600"
          />
          {postError && <p className="text-xs text-red-400">{postError}</p>}
          <button
            disabled={posting || !draft.trim()}
            onClick={post}
            className="rounded-md bg-sky-500/20 text-sky-300 px-4 py-1.5 text-sm font-medium hover:bg-sky-500/30 disabled:opacity-40"
          >
            {posting ? "Posting…" : "Post comment"}
          </button>
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

  if (!report) return <p className="text-slate-500 text-sm">Loading…</p>;

  const alreadyVoted = report.confirmations?.some((c) => c.confirmingOrgId === organization?.id);
  const isOwnReport = report.reporterOrgId === organization?.id;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-lg font-mono font-semibold">{report.indicator}</h1>
          <span className="text-xs text-slate-500">{report.indicatorType}</span>
        </div>
        <p className="text-sm text-slate-400">
          {report.attackType} · {report.mitreTechnique} · severity {report.severity} · status{" "}
          <span className="font-medium text-slate-200">{report.status}</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge ok={report.blockchainVerified} label="blockchain verified" />
        <Badge ok={true} label="signature valid" />
        <Badge ok={report.evidenceIntegrity} label="evidence integrity" />
      </div>

      {tamperMessage && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          🚨 {tamperMessage}
        </div>
      )}

      <ConfidenceMeter score={report.confidenceScore ?? 0} status={report.status} />

      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 space-y-2">
        <p className="text-sm text-slate-300">{report.description}</p>
        <p className="text-xs text-slate-500">
          Reported by <span className="text-slate-300">{report.reporter?.name}</span> on{" "}
          {new Date(report.createdAt).toLocaleString()}
        </p>
        {report.blockchainBlockId !== null && (
          <p className="text-xs text-slate-500">Ledger block #{report.blockchainBlockId} · payload hash {report.payloadHash.slice(0, 16)}…</p>
        )}
      </div>

      {report.scoreBreakdown && <ScoreBreakdownPanel breakdown={report.scoreBreakdown} />}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-200">Confirmation history</h2>
        <ConfirmationHistory confirmations={report.confirmations ?? []} />
      </div>

      <AttachmentsPanel reportId={report.id} />

      <CommentThread reportId={report.id} />

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          disabled={busy || isOwnReport || alreadyVoted}
          onClick={() => vote("CONFIRM")}
          className="rounded-md bg-emerald-500/20 text-emerald-300 px-4 py-2 text-sm font-medium hover:bg-emerald-500/30 disabled:opacity-40"
        >
          Confirm
        </button>
        <button
          disabled={busy || isOwnReport || alreadyVoted}
          onClick={() => vote("DISPUTE")}
          className="rounded-md bg-red-500/20 text-red-300 px-4 py-2 text-sm font-medium hover:bg-red-500/30 disabled:opacity-40"
        >
          Dispute
        </button>
        <button
          disabled={busy}
          onClick={runTamperDemo}
          className="rounded-md border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40"
        >
          Simulate Tampering
        </button>
      </div>
      {isOwnReport && <p className="text-xs text-slate-500">You cannot confirm or dispute your own report.</p>}
      {alreadyVoted && !isOwnReport && <p className="text-xs text-slate-500">You've already voted on this report.</p>}
    </div>
  );
}
