import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, TOKEN_KEY } from "../lib/api";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // null = checking, false = logged out

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return setUser(false);
    api.get("/auth/me").then(({ data }) => setUser(data)).catch(() => {
      localStorage.removeItem(TOKEN_KEY);
      setUser(false);
    });
  }, []);

  const finish = useCallback(({ token, user: u }) => {
    localStorage.setItem(TOKEN_KEY, token);
    setUser(u);
  }, []);

  const login = useCallback(async (payload) => finish((await api.post("/auth/login", payload)).data), [finish]);
  const register = useCallback(async (payload) => finish((await api.post("/auth/register", payload)).data), [finish]);
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(false);
  }, []);

  const value = useMemo(() => ({ user, login, register, logout }), [user, login, register, logout]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
};
