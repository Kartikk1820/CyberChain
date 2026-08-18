import { useCallback, useEffect, useState } from "react";
import type { AccessAttempt } from "@sixsync/shared";
import { getAccessAttempts, postAccessAttempt } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useWsEvents } from "../api/useWsEvents";
import { RiskBreakdown } from "../components/RiskBreakdown";
import { Card, CardContent } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

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
        <p className="text-sm text-muted-foreground mb-6">
          Simulate a login attempt and watch the risk engine score it against the network's live threat feed.
        </p>

        <Card className="mb-6">
          <CardContent className="pt-4">
            <form onSubmit={runSimulation} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="zt-user">User</Label>
                <Input id="zt-user" required value={user} onChange={(e) => setUser(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="zt-ip">Source IP</Label>
                <Input
                  id="zt-ip"
                  required
                  value={ip}
                  onChange={(e) => setIp(e.target.value)}
                  placeholder="try a confirmed-malicious IP from the threat feed"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="zt-device">Device fingerprint</Label>
                <Input
                  id="zt-device"
                  required
                  value={deviceFingerprint}
                  onChange={(e) => setDeviceFingerprint(e.target.value)}
                  className="font-mono"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground/90">
                <input type="checkbox" checked={passwordValid} onChange={(e) => setPasswordValid(e.target.checked)} />
                Password valid
              </label>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button disabled={busy} type="submit" className="w-full">
                {busy ? "Scoring…" : "Run Access Attempt"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {result && (
          <Card>
            <CardContent className="pt-4">
              <h2 className="text-sm font-semibold mb-3">Risk Breakdown</h2>
              <RiskBreakdown breakdown={result} decision={result.decision} policyApplied={result.policyApplied} />
            </CardContent>
          </Card>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Recent Access Attempts</h2>
        <div className="space-y-2">
          {history.length === 0 && <p className="text-sm text-muted-foreground">No access attempts simulated yet.</p>}
          {history.map((a) => (
            <Card key={a.id}>
              <CardContent className="py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm">{a.user}</span>
                  <Badge
                    variant={a.decision === "ALLOW" ? "success" : a.decision === "BLOCK" ? "destructive" : "warning"}
                  >
                    {a.decision}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  {a.ip} · score {a.totalRiskScore.toFixed(1)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
