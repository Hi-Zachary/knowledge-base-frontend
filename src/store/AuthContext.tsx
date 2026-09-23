import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api";
import type { AuthUser } from "../types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, displayName: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.me().then((result) => setUser(result.user)).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    setError(null);
    try { setUser((await api.login(email, password)).user); }
    catch (reason) { const message = reason instanceof Error ? reason.message : "登录失败"; setError(message); throw reason; }
  }

  async function register(email: string, displayName: string, password: string) {
    setError(null);
    try { setUser((await api.register(email, displayName, password)).user); }
    catch (reason) { const message = reason instanceof Error ? reason.message : "注册失败"; setError(message); throw reason; }
  }

  async function logout() {
    await api.logout();
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, error, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
