import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, clearSession, getSession, roleHome, setSession as persistSession } from "../api/client";

const AuthContext = createContext(null);
const TAB_GUARD_CHANNEL = "swp-auth-tab-guard-v1";

function runtimeId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function tokenFingerprint(token) {
  const value = String(token || "");
  return value ? value.slice(-32) : "";
}

export function AuthProvider({ children }) {
  const [session, setSessionState] = useState(() => getSession());
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const isAuthenticated = Boolean(session.token);

  function invalidateCurrentTab(message = "") {
    clearSession();
    setSessionState(getSession());
    setProfile(null);
    if (message) window.sessionStorage.setItem("authMessage", message);
    window.location.hash = "/login";
  }

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
    } catch {
      setProfile(null);
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

  async function logout() {
    try {
      if (getSession().token) await api.auth.logout();
    } catch {
      // Local logout must still complete if the token was already superseded.
    } finally {
      invalidateCurrentTab();
    }
  }

  // Any API 401 (including a newer login replacing this session) immediately
  // updates React state and returns this tab to Login.
  useEffect(() => {
    const handler = (event) => invalidateCurrentTab(event?.detail?.message || "Your session has ended.");
    window.addEventListener("swp-auth-invalidated", handler);
    return () => window.removeEventListener("swp-auth-invalidated", handler);
  }, []);

  // Poll the protected session endpoint so an idle older tab is logged out soon
  // after the same account signs in elsewhere.
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let stopped = false;
    const check = async () => {
      try {
        await api.auth.session();
      } catch {
        if (!stopped && !getSession().token) {
          setSessionState(getSession());
          setProfile(null);
          window.location.hash = "/login";
        }
      }
    };
    const first = window.setTimeout(check, 800);
    const interval = window.setInterval(check, 4000);
    return () => {
      stopped = true;
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [isAuthenticated, session.token]);

  // Browsers clone sessionStorage when "Duplicate tab" is used. A short
  // BroadcastChannel handshake lets the existing owner reject the clone while
  // normal refreshes remain logged in because no other live tab responds.
  useEffect(() => {
    if (!session.token || typeof BroadcastChannel === "undefined") return undefined;
    const fingerprint = tokenFingerprint(session.token);
    const instanceId = runtimeId();
    const channel = new BroadcastChannel(TAB_GUARD_CHANNEL);
    let acceptingOwnerResponse = true;
    let closed = false;

    channel.onmessage = (event) => {
      const data = event?.data || {};
      if (data.fingerprint !== fingerprint || data.instanceId === instanceId) return;

      if (data.type === "probe") {
        channel.postMessage({
          type: "owner",
          fingerprint,
          instanceId,
          target: data.instanceId
        });
      } else if (data.type === "owner" && data.target === instanceId && acceptingOwnerResponse && !closed) {
        acceptingOwnerResponse = false;
        invalidateCurrentTab("Duplicated tabs must sign in separately.");
      }
    };

    channel.postMessage({ type: "probe", fingerprint, instanceId });
    const settle = window.setTimeout(() => { acceptingOwnerResponse = false; }, 1500);

    return () => {
      closed = true;
      window.clearTimeout(settle);
      channel.close();
    };
  }, [session.token]);

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
