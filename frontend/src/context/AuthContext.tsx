import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Organization } from "@sixsync/shared";

interface AuthState {
  organization: Organization | null;
  token: string | null;
  privateKey: string | null;
  setSession: (organization: Organization, token: string) => void;
  setPrivateKey: (privateKey: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const LS_ORG_KEY = "sixsync.organization";
const LS_TOKEN_KEY = "sixsync.token";
const SS_PRIVATE_KEY = "sixsync.privateKey";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [organization, setOrganization] = useState<Organization | null>(() => {
    const raw = localStorage.getItem(LS_ORG_KEY);
    return raw ? (JSON.parse(raw) as Organization) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(LS_TOKEN_KEY));
  const [privateKey, setPrivateKeyState] = useState<string | null>(() => sessionStorage.getItem(SS_PRIVATE_KEY));

  useEffect(() => {
    if (organization) localStorage.setItem(LS_ORG_KEY, JSON.stringify(organization));
    else localStorage.removeItem(LS_ORG_KEY);
  }, [organization]);

  useEffect(() => {
    if (token) localStorage.setItem(LS_TOKEN_KEY, token);
    else localStorage.removeItem(LS_TOKEN_KEY);
  }, [token]);

  useEffect(() => {
    if (privateKey) sessionStorage.setItem(SS_PRIVATE_KEY, privateKey);
    else sessionStorage.removeItem(SS_PRIVATE_KEY);
  }, [privateKey]);

  function setSession(org: Organization, tok: string) {
    setOrganization(org);
    setToken(tok);
  }

  function setPrivateKey(key: string) {
    setPrivateKeyState(key);
  }

  function logout() {
    setOrganization(null);
    setToken(null);
    setPrivateKeyState(null);
  }

  return (
    <AuthContext.Provider value={{ organization, token, privateKey, setSession, setPrivateKey, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
