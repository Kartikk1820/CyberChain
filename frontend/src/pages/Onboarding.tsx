import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { KeyRound, Network, ShieldCheck, ShieldHalf } from "lucide-react";
import type { OrgType } from "@sixsync/shared";
import { generateKeyPair, downloadKeyFile } from "../crypto/keypair";
import { registerOrganization, login } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent } from "../components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

const ORG_TYPES: OrgType[] = ["BANK", "HOSPITAL", "COMPANY", "GOVERNMENT", "UNIVERSITY", "CERT"];

const PILLARS = [
  {
    icon: KeyRound,
    title: "Trust",
    body: "Every org signs with a client-generated Ed25519 key. Reports anchor to a tamper-evident hash-chained ledger.",
  },
  {
    icon: Network,
    title: "Intelligence",
    body: "Reports get classified, cross-confirmed by other orgs, and clustered into live coordinated-attack campaigns.",
  },
  {
    icon: ShieldCheck,
    title: "Defense",
    body: "The verified threat feed drives a Zero-Trust engine that scores every login and resolves ALLOW / MFA / RESTRICT / BLOCK.",
  },
];

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
      toast.success(`Welcome, ${organization.name}`, { description: "Identity generated — keyfile downloaded." });
      navigate("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "registration failed";
      setError(message);
      toast.error("Registration failed", { description: message });
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
      toast.success(`Welcome back, ${organization.name}`);
      navigate("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "login failed";
      setError(message);
      toast.error("Sign in failed", { description: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-background text-foreground">
      <div className="relative hidden lg:flex flex-col justify-center px-16 overflow-hidden border-r border-border/60">
        <div className="absolute inset-0 bg-grid-glow pointer-events-none" />
        <div className="relative space-y-10 max-w-md">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 to-accent/25 ring-1 ring-primary/30">
              <ShieldHalf className="h-5 w-5 text-primary" />
            </div>
            <span className="text-xl font-semibold tracking-tight">CyberChain</span>
          </div>
          <div>
            <h1 className="text-3xl font-semibold leading-tight mb-3">
              A shared, tamper-evident nervous system for blue teams.
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Organizations jointly build a trustworthy threat intelligence network — signed, cross-confirmed,
              hash-chained — and feed it straight into a Zero-Trust access engine.
            </p>
          </div>
          <div className="space-y-5">
            {PILLARS.map((p) => (
              <div key={p.title} className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/80 ring-1 ring-border">
                  <p.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{p.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-6">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/25 to-accent/25 ring-1 ring-primary/30">
              <ShieldHalf className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold tracking-tight">CyberChain</span>
          </div>

          <Card className="animate-fade-in">
            <CardContent className="pt-5">
              <Tabs value={mode} onValueChange={(v) => setMode(v as "register" | "login")}>
                <TabsList className="w-full mb-4">
                  <TabsTrigger value="register" className="flex-1">
                    Join Network
                  </TabsTrigger>
                  <TabsTrigger value="login" className="flex-1">
                    Sign In
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="register">
                  <form onSubmit={handleRegister} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="org-name">Organization name</Label>
                      <Input id="org-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Bank A" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Organization type</Label>
                      <Select value={type} onValueChange={(v) => setType(v as OrgType)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ORG_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-email">Email</Label>
                      <Input id="reg-email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reg-password">Password</Label>
                      <Input
                        id="reg-password"
                        required
                        type="password"
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      A cryptographic keypair is generated in your browser. Your private key never leaves this device
                      — a one-time keyfile download will follow registration. Save it; it cannot be recovered.
                    </p>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button disabled={busy} type="submit" className="w-full">
                      {busy ? "Generating identity…" : "Generate identity & join"}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="login">
                  <form onSubmit={handleLogin} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="login-email">Email</Label>
                      <Input id="login-email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="login-password">Password</Label>
                      <Input
                        id="login-password"
                        required
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Keyfile (optional, needed to sign reports)</Label>
                      <input
                        type="file"
                        accept="application/json"
                        onChange={(e) => setKeyfileForLogin(e.target.files?.[0] ?? null)}
                        className="w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-2.5 file:py-1.5 file:text-xs file:text-foreground"
                      />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <Button disabled={busy} type="submit" className="w-full">
                      {busy ? "Signing in…" : "Sign in"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
