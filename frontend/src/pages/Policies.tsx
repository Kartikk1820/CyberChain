import { useEffect, useState } from "react";
import type { AccessDecision, SecurityPolicyRules } from "@sixsync/shared";
import { getPolicies, putPolicies } from "../api/client";
import { useAuth } from "../context/AuthContext";

const DECISIONS: AccessDecision[] = ["ALLOW", "MFA", "RESTRICT", "BLOCK"];

export function Policies() {
  const { token } = useAuth();
  const [rules, setRules] = useState<SecurityPolicyRules | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) getPolicies(token).then(setRules);
  }, [token]);

  if (!rules) return <p className="text-slate-500 text-sm">Loading…</p>;

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
        <p className="text-sm text-slate-500">
          Editable thresholds that drive the Zero-Trust decision engine for your organization.
        </p>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3">Risk score thresholds</h2>
        <div className="grid grid-cols-3 gap-3">
          {(["allow", "mfa", "restrict"] as const).map((key) => (
            <div key={key}>
              <label className="block text-xs text-slate-400 mb-1 uppercase">{key}</label>
              <input
                type="number"
                value={rules.thresholds[key]}
                onChange={(e) => updateThreshold(key, Number(e.target.value))}
                className="w-full rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-sm"
              />
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          score &lt; allow → ALLOW · allow–mfa → MFA · mfa–restrict → RESTRICT · &ge; restrict → BLOCK
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Override rules</h2>
          <button onClick={addOverride} className="text-xs text-sky-400 hover:text-sky-300">
            + add rule
          </button>
        </div>
        <div className="space-y-2">
          {rules.overrides.map((o, i) => (
            <div key={i} className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 space-y-2">
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  value={o.if}
                  onChange={(e) => updateOverride(i, "if", e.target.value)}
                  placeholder="ipThreatRisk >= 90"
                  className="rounded-md bg-slate-950 border border-slate-800 px-2 py-1.5 text-xs font-mono"
                />
                <button onClick={() => removeOverride(i)} className="text-xs text-red-400 hover:text-red-300">
                  remove
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={o.then}
                  onChange={(e) => updateOverride(i, "then", e.target.value)}
                  className="rounded-md bg-slate-950 border border-slate-800 px-2 py-1.5 text-xs"
                >
                  {DECISIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <input
                  value={o.reason}
                  onChange={(e) => updateOverride(i, "reason", e.target.value)}
                  placeholder="reason"
                  className="rounded-md bg-slate-950 border border-slate-800 px-2 py-1.5 text-xs"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {saved && <p className="text-sm text-emerald-400">Policy saved.</p>}
      <button onClick={save} className="rounded-md bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400">
        Save policy
      </button>
    </div>
  );
}
