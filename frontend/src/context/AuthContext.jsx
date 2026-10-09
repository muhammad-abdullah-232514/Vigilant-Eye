import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  fetchCurrentUser,
  googleLoginRequest,
  loginRequest,
} from "../services/api";
import {
  clearAuthSession,
  getAuthToken,
  getAuthUser,
  removeLegacyAuthSession,
  setAuthToken,
  setAuthUser,
} from "../utils/authStorage";

const AuthContext = createContext(null);

/** Roles are DB uppercase strings; normalize so nav never misses ADMINISTRATOR. */
function normalizeUser(raw) {
  if (!raw || typeof raw !== "object") return null;
  const role = typeof raw.role === "string" ? raw.role.trim().toUpperCase() : raw.role;
  return { ...raw, role };
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => {
    removeLegacyAuthSession();
    return getAuthToken();
  });
  const [user, setUser] = useState(() => normalizeUser(getAuthUser()));
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState("");

  const refreshUser = useCallback(async () => {
    const me = normalizeUser(await fetchCurrentUser());
    setUser(me);
    setAuthUser(me);
    return me;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const me = normalizeUser(await fetchCurrentUser());
        if (!cancelled) {
          setUser(me);
          setAuthUser(me);
        }
      } catch {
        if (!cancelled) {
          clearAuthSession();
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const applySession = useCallback((data) => {
    const nextUser = normalizeUser(data.user);
    setAuthToken(data.access_token);
    setAuthUser(nextUser);
    setToken(data.access_token);
    setUser(nextUser);
    return nextUser;
  }, []);

  const login = useCallback(
    async (email, password) => {
      setError("");
      const data = await loginRequest(email, password);
      return applySession(data);
    },
    [applySession]
  );

  const loginWithGoogle = useCallback(
    async (idToken) => {
      setError("");
      const data = await googleLoginRequest(idToken);
      return applySession(data);
    },
    [applySession]
  );

  function logout() {
    clearAuthSession();
    setToken(null);
    setUser(null);
  }

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      error,
      setError,
      refreshUser,
      login,
      loginWithGoogle,
      logout,
      isAuthenticated: Boolean(token && user),
    }),
    [token, user, loading, error, refreshUser, login, loginWithGoogle]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
