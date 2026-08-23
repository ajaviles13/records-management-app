import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { api, getStoredUser, setStoredUser } from "@/api/client";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  updateProfile: (patch: Partial<Pick<User, "first_name" | "last_name" | "abbreviation">>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser());

  const login = useCallback(async (email: string, password: string) => {
    const { user: next } = await api.login(email, password);
    setStoredUser(next);
    setUser(next);
    return next;
  }, []);

  const logout = useCallback(() => {
    setStoredUser(null);
    setUser(null);
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<Pick<User, "first_name" | "last_name" | "abbreviation">>) => {
      if (!user) return;
      const { user: next } = await api.updateUser(user.user_id, patch);
      setStoredUser(next);
      setUser(next);
    },
    [user],
  );

  const value = useMemo(() => ({ user, login, logout, updateProfile }), [user, login, logout, updateProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
