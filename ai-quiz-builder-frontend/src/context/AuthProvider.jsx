import { createContext, useContext, useMemo, useState } from "react";
import api from "../lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

  async function login(email, password) {
    try {
      const { data } = await api.post("/auth/login", { email, password });

      // tolerate different shapes: { token, user } or { accessToken, profile } etc.
      const token =
        data?.token ?? data?.accessToken ?? data?.jwt ?? data?.data?.token;

      if (!token) {
        throw new Error(data?.message || "No token in response");
      }

      const me = data?.user ?? data?.profile ?? data?.data?.user ?? null;

      localStorage.setItem("token", token);
      api.defaults.headers.common.Authorization = `Bearer ${token}`;

      if (me) localStorage.setItem("user", JSON.stringify(me));
      setUser(me);
      return { ok: true };
    } catch (e) {
      // Surface helpful error text
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Login failed";
      console.error("Login error:", e);
      throw new Error(msg);
    }
  }

  async function register(payload) {
    const { data } = await api.post("/auth/register", payload);
    const token = data?.token ?? data?.accessToken ?? data?.jwt;
    if (!token) throw new Error(data?.message || "No token in response");
    const me = data?.user ?? data?.profile ?? data?.data?.user ?? null;

    localStorage.setItem("token", token);
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    if (me) localStorage.setItem("user", JSON.stringify(me));
    setUser(me);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    delete api.defaults.headers.common.Authorization;
    setUser(null);
  }

  const value = useMemo(() => ({ user, login, register, logout }), [user]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
