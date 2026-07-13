import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, clearSession, getSession, roleHome, setSession as persistSession } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSessionState] = useState(() => getSession());
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const isAuthenticated = Boolean(session.token);

  async function refreshProfile() {
    if (!getSession().token) {
      setProfile(null);
      return null;
    }
    setProfileLoading(true);
    try {
      const data = await api.users.profile();
      setProfile(data);
      if (data?.id || data?.username || data?.email || data?.roleName) {
        const updated = persistSession({
          id: data.id,
          username: data.username,
          email: data.email,
          role: data.roleName || session.role,
          token: getSession().token
        });
        setSessionState(updated);
      }
      return data;
    } catch (err) {
      setProfile(null);
      // apiFetch clears persisted credentials after a 401. Mirror that change in
      // React state so an expired session cannot remain visually authenticated.
      if (!getSession().token) setSessionState(getSession());
      return null;
    } finally {
      setProfileLoading(false);
    }
  }

  async function login(credentials) {
    const saved = await api.auth.login(credentials);
    setSessionState(saved);
    await refreshProfile();
    return saved;
  }

  async function register(payload) {
    return api.auth.register(payload);
  }

  async function requestOtp(payload) {
    return api.auth.requestOtp(payload);
  }

  async function verifyOtp(email, otpCode) {
    const saved = await api.auth.verifyOtp(email, otpCode);
    setSessionState(saved);
    await refreshProfile();
    return saved;
  }

  async function googleLogin(credential) {
    const saved = await api.auth.google(credential);
    setSessionState(saved);
    await refreshProfile();
    return saved;
  }

  function logout() {
    clearSession();
    setSessionState(getSession());
    setProfile(null);
    window.location.hash = "/login";
  }

  useEffect(() => {
    if (isAuthenticated) refreshProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const value = useMemo(() => ({
    session,
    profile,
    profileLoading,
    isAuthenticated,
    login,
    register,
    requestOtp,
    verifyOtp,
    googleLogin,
    logout,
    refreshProfile,
    homePath: roleHome(profile?.roleName || session.role)
  }), [session, profile, profileLoading, isAuthenticated]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
