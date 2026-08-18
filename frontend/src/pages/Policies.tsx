import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { AccessDecision, SecurityPolicyRules } from "@sixsync/shared";
import { getPolicies, putPolicies } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent } from "../components/ui/card";
import { Label } from "../components/ui/label";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

const DECISIONS: AccessDecision[] = ["ALLOW", "MFA", "RESTRICT", "BLOCK"];

export function Policies() {
  const { token } = useAuth();
  const [rules, setRules] = useState<SecurityPolicyRules | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) getPolicies(token).then(setRules);
  }, [token]);

  if (!rules) return <p className="text-muted-foreground text-sm">Loading…</p>;

  async function save() {
    if (!token || !rules) return;
    setError(null);
    setSaved(false);
    try {
      const updated = await putPolicies(rules, token);
      setRules(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "save failed");
    }
  }

  function updateThreshold(key: keyof SecurityPolicyRules["thresholds"], value: number) {
    setRules((prev) => (prev ? { ...prev, thresholds: { ...prev.thresholds, [key]: value } } : prev));
  }

  function updateOverride(index: number, field: "if" | "then" | "reason", value: string) {
    setRules((prev) =>
      prev ? { ...prev, overrides: prev.overrides.map((o, i) => (i === index ? { ...o, [field]: value } : o)) } : prev
    );
  }

  function addOverride() {
    setRules((prev) =>
      prev
        ? { ...prev, overrides: [...prev.overrides, { if: "ipThreatRisk >= 90", then: "BLOCK" as const, reason: "new rule" }] }
        : prev
    );
  }

  function removeOverride(index: number) {
    setRules((prev) => (prev ? { ...prev, overrides: prev.overrides.filter((_, i) => i !== index) } : prev));
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-lg font-semibold mb-1">Security Policy</h1>
        <p className="text-sm text-muted-foreground">
          Editable thresholds that drive the Zero-Trust decision engine for your organization.
        </p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <h2 className="text-sm font-semibold mb-3">Risk score thresholds</h2>
          <div className="grid grid-cols-3 gap-3">
            {(["allow", "mfa", "restrict"] as const).map((key) => (
              <div key={key} className="space-y-1.5">
                <Label className="uppercase">{key}</Label>
                <Input
                  type="number"
                  value={rules.thresholds[key]}
                  onChange={(e) => updateThreshold(key, Number(e.target.value))}
                />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            score &lt; allow → ALLOW · allow–mfa → MFA · mfa–restrict → RESTRICT · &ge; restrict → BLOCK
          </p>
        </CardContent>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Override rules</h2>
          <Button variant="link" size="sm" onClick={addOverride} className="h-auto p-0">
            + add rule
          </Button>
        </div>
        <div className="space-y-2">
          {rules.overrides.map((o, i) => (
            <Card key={i}>
              <CardContent className="pt-3 space-y-2">
                <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                  <Input
                    value={o.if}
                    onChange={(e) => updateOverride(i, "if", e.target.value)}
                    placeholder="ipThreatRisk >= 90"
                    className="font-mono text-xs h-8"
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeOverride(i)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={o.then} onValueChange={(v) => updateOverride(i, "then", v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DECISIONS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={o.reason}
                    onChange={(e) => updateOverride(i, "reason", e.target.value)}
                    placeholder="reason"
                    className="text-xs h-8"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-emerald-400">Policy saved.</p>}
      <Button onClick={save}>Save policy</Button>
    </div>
  );
}
