import { useCallback, useEffect, useState } from "react";
import type { AccessAttempt } from "@sixsync/shared";
import { getAccessAttempts, postAccessAttempt } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useWsEvents } from "../api/useWsEvents";
import { RiskBreakdown } from "../components/RiskBreakdown";

export function ZeroTrustSim() {
  const { token, organization } = useAuth();
  const [user, setUser] = useState("alice@example.com");
  const [ip, setIp] = useState("");
  const [deviceFingerprint, setDeviceFingerprint] = useState("laptop-1");
  const [passwordValid, setPasswordValid] = useState(true);
  const [result, setResult] = useState<AccessAttempt | null>(null);
  const [history, setHistory] = useState<AccessAttempt[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshHistory = useCallback(async () => {
    if (!token) return;
    setHistory(await getAccessAttempts(token));
  }, [token]);

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  useWsEvents((event) => {
    if (event.type === "access_attempt:new" && event.payload.organizationId === organization?.id) {
      refreshHistory();
    }
  });

  async function runSimulation(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setBusy(true);
    try {
      const attempt = await postAccessAttempt({ user, ip, deviceFingerprint, passwordValid }, token);
      setResult(attempt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "simulation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <h1 className="text-lg font-semibold mb-1">Zero-Trust Access Simulator</h1>
        <p className="text-sm text-slate-500 mb-6">
          Simulate a login attempt and watch the risk engine score it against the network's live threat feed.
        </p>

        <form onSubmit={runSimulation} className="space-y-3 mb-6">
          <div>
            <label className="block text-xs text-slate-400 mb-1">User</label>
            <input
              required
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="w-full rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Source IP</label>
            <input
              required
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="try a confirmed-malicious IP from the threat feed"
              className="w-full rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Device fingerprint</label>
            <input
              required
              value={deviceFingerprint}
              onChange={(e) => setDeviceFingerprint(e.target.value)}
              className="w-full rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-sm font-mono"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={passwordValid} onChange={(e) => setPasswordValid(e.target.checked)} />
            Password valid
          </label>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            disabled={busy}
            type="submit"
            className="w-full rounded-md bg-sky-500 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-50"
          >
            {busy ? "Scoring…" : "Run Access Attempt"}
          </button>
        </form>

        {result && (
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <h2 className="text-sm font-semibold mb-3">Risk Breakdown</h2>
            <RiskBreakdown breakdown={result} decision={result.decision} policyApplied={result.policyApplied} />
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Access Attempts</h2>
        <div className="space-y-2">
          {history.length === 0 && <p className="text-sm text-slate-500">No access attempts simulated yet.</p>}
          {history.map((a) => (
            <div key={a.id} className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm">
              <div className="flex items-center justify-between">
                <span>{a.user}</span>
                <span
                  className={`text-xs font-medium ${
                    a.decision === "ALLOW"
                      ? "text-emerald-400"
                      : a.decision === "BLOCK"
                        ? "text-red-400"
                        : "text-amber-400"
                  }`}
                >
                  {a.decision}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono">
                {a.ip} · score {a.totalRiskScore.toFixed(1)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
