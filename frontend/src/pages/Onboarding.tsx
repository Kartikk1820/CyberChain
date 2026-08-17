import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { OrgType } from "@sixsync/shared";
import { generateKeyPair, downloadKeyFile } from "../crypto/keypair";
import { registerOrganization, login } from "../api/client";
import { useAuth } from "../context/AuthContext";

const ORG_TYPES: OrgType[] = ["BANK", "HOSPITAL", "COMPANY", "GOVERNMENT", "UNIVERSITY", "CERT"];

export function Onboarding() {
  const { setSession, setPrivateKey } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"register" | "login">("register");
  const [name, setName] = useState("");
  const [type, setType] = useState<OrgType>("BANK");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [keyfileForLogin, setKeyfileForLogin] = useState<File | null>(null);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const keyPair = generateKeyPair();
      const { organization, token } = await registerOrganization({ name, type, publicKey: keyPair.publicKey, email, password });
      downloadKeyFile(organization.name, organization.id, organization.did, keyPair);
      setSession(organization, token);
      setPrivateKey(keyPair.privateKey);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "registration failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { organization, token } = await login(email, password);
      setSession(organization, token);
      if (keyfileForLogin) {
        const text = await keyfileForLogin.text();
        const parsed = JSON.parse(text) as { privateKey: string };
        setPrivateKey(parsed.privateKey);
      }
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold mb-1">SIXSYNC</h1>
        <p className="text-sm text-slate-400 mb-6">Decentralized Cyber Defense &amp; Trust Network</p>

        <div className="flex gap-1 mb-4 rounded-lg bg-slate-900 p-1">
          <button
            onClick={() => setMode("register")}
            className={`flex-1 rounded-md py-1.5 text-sm ${mode === "register" ? "bg-sky-500/20 text-sky-300" : "text-slate-400"}`}
          >
            Join Network
          </button>
          <button
            onClick={() => setMode("login")}
            className={`flex-1 rounded-md py-1.5 text-sm ${mode === "login" ? "bg-sky-500/20 text-sky-300" : "text-slate-400"}`}
          >
            Sign In
          </button>
        </div>

        {mode === "register" ? (
          <form onSubmit={handleRegister} className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Organization name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-sm"
                placeholder="Bank A"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Organization type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as OrgType)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-sm"
              >
                {ORG_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Email</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Password</label>
              <input
                required
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-sm"
              />
            </div>
            <p className="text-xs text-slate-500">
              A cryptographic keypair is generated in your browser. Your private key never leaves this device — a
              one-time keyfile download will follow registration. Save it; it cannot be recovered.
            </p>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              disabled={busy}
              type="submit"
              className="w-full rounded-md bg-sky-500 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-50"
            >
              {busy ? "Generating identity…" : "Generate identity & join"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Email</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Password</label>
              <input
                required
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md bg-slate-900 border border-slate-800 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Keyfile (optional, needed to sign reports)</label>
              <input
                type="file"
                accept="application/json"
                onChange={(e) => setKeyfileForLogin(e.target.files?.[0] ?? null)}
                className="w-full text-xs text-slate-400"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              disabled={busy}
              type="submit"
              className="w-full rounded-md bg-sky-500 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400 disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
