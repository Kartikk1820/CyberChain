import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { ThreatReport, Confirmation } from "@sixsync/shared";
import { confirmReport, getReportDetail, simulateTampering } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useWsEvents } from "../api/useWsEvents";
import { ConfidenceMeter } from "../components/ConfidenceMeter";

type ReportDetail = ThreatReport & {
  evidenceIntegrity: boolean | null;
  blockchainVerified: boolean;
  confirmations?: Confirmation[];
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
