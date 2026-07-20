import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { navigate } from "../utils/router";
import { Alert } from "../components/Status";
import { roleHome } from "../api/client";
import { clearRememberedCredentials, isRememberPasswordEnabled, loadRememberedCredentials, saveRememberedCredentials } from "../utils/rememberedCredentials";

const PUBLIC_REGISTRATION_ROLES = ["Mangaka", "Assistant", "Tantou Editor", "Editorial Board"];
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
let googleScriptPromise;

function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    const script = existing || document.createElement("script");
    let settled = false;

    const cleanup = () => {
      window.clearInterval(readinessTimer);
      window.clearTimeout(timeoutTimer);
      script.removeEventListener("error", handleError);
    };
    const handleReady = () => {
      if (settled || !window.google?.accounts?.id) return;
      settled = true;
      cleanup();
      resolve();
    };
    const handleError = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Could not load Google Sign-In script."));
    };
    const readinessTimer = window.setInterval(handleReady, 100);
    const timeoutTimer = window.setTimeout(handleError, 10000);

    script.addEventListener("load", handleReady, { once: true });
    script.addEventListener("error", handleError, { once: true });

    if (!existing) {
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    handleReady();
  }).catch((error) => {
    googleScriptPromise = undefined;
    throw error;
  });

  return googleScriptPromise;
}

function normalizeOtpCode(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits || String(value || "").trim();
}

export default function LoginPage() {
  const { login, register, requestOtp, verifyOtp, googleLogin } = useAuth();
  const googleButtonRef = useRef(null);
  const [mode, setMode] = useState("login");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [rememberPassword, setRememberPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [registration, setRegistration] = useState({ username: "", email: "", phoneNumber: "", password: "", role: "Mangaka" });
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  useEffect(() => {
    const authMessage = window.sessionStorage.getItem("authMessage");
    if (authMessage) {
      setMessage(authMessage);
      window.sessionStorage.removeItem("authMessage");
    }

    let cancelled = false;
    const remembered = isRememberPasswordEnabled();
    setRememberPassword(remembered);
    if (remembered) {
      loadRememberedCredentials().then((saved) => {
        if (!cancelled && saved?.username) setCredentials(saved);
      });
    }

    return () => { cancelled = true; };
  }, []);

  async function updateRememberedPassword() {
    const username = credentials.username.trim();
    if (!rememberPassword) {
      clearRememberedCredentials();
      try {
        await navigator.credentials?.preventSilentAccess?.();
      } catch {
        // Some browsers do not implement Credential Management.
      }
      return;
    }

    await saveRememberedCredentials({ username, password: credentials.password });

    if (window.PasswordCredential && navigator.credentials?.store) {
      try {
        await navigator.credentials.store(new window.PasswordCredential({
          id: username,
          name: username,
          password: credentials.password
        }));
      } catch {
        // Keep the remembered username and let the browser's native password
        // manager prompt normally when programmatic storage is unavailable.
      }
    }
  }

  async function finishLogin(session) {
    setMessage("Login successful. Redirecting...");
    navigate(roleHome(session.role));
  }

  async function submitLogin(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const session = await login(credentials);
      await updateRememberedPassword();
      await finishLogin(session);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function submitRegister(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!PUBLIC_REGISTRATION_ROLES.includes(registration.role)) {
        throw new Error("Admin accounts cannot be created through public registration.");
      }
      await register(registration);
      setMessage("Registration successful. You can now log in.");
      setMode("login");
      setCredentials({ username: registration.username, password: "" });
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  async function sendOtp(event) {
    event?.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (!otpEmail.includes("@")) {
        throw new Error("Enter the email address linked to your account.");
      }
      await requestOtp(otpEmail.trim());
      setOtpSent(true);
      setMessage("OTP sent. Check your email and enter the code.");
    } catch (err) {
      setError(err.message || "Could not send OTP");
    } finally {
      setBusy(false);
    }
  }

  async function submitOtp(event) {
    event.preventDefault();
    if (!otpSent) {
      await sendOtp(event);
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");
    try {
      const code = normalizeOtpCode(otpCode);
      if (!code) throw new Error("Enter the OTP code from your email.");
      const session = await verifyOtp(otpEmail.trim(), code);
      await finishLogin(session);
    } catch (err) {
      setError(err.message || "OTP verification failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleCredential(response) {
    const credential = response?.credential;
    if (!credential) {
      setError("Google sign-in could not be completed.");
      return;
    }

    setGoogleBusy(true);
    setError("");
    setMessage("");
    try {
      const session = await googleLogin(credential);
      await finishLogin(session);
    } catch (err) {
      setError(err.message || "Google login failed");
    } finally {
      setGoogleBusy(false);
    }
  }

  useEffect(() => {
    if (mode !== "login" || !GOOGLE_CLIENT_ID || !googleButtonRef.current) return;

    let cancelled = false;
    googleButtonRef.current.innerHTML = "";

    loadGoogleScript()
      .then(() => {
        if (cancelled || !googleButtonRef.current || !window.google?.accounts?.id) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredential,
          auto_select: false,
          cancel_on_tap_outside: true
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: "outline",
          size: "large",
          width: 360,
          text: "signin_with",
          shape: "rectangular"
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Google Sign-In could not be loaded.");
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return (
    <div className="split-layout">
      <div className="left-panel">
        <img src="/cover.png" alt="Manga Covers" className="manga-image" onError={(event) => { event.currentTarget.style.display = "none"; }} />
      </div>

      <div className="right-panel login-panel">
        <div className="form-container">
          <h1 className="logo login-system-title" aria-label="Manga Creation Workflow & Publishing Management System">
            <span>Manga Creation Workflow</span>
            <span className="login-title-ampersand">&amp;</span>
            <span>Publishing Management System</span>
          </h1>

          {mode !== "register" && (
            <div className="tabs" id="login-tabs">
              <button type="button" className={mode === "login" ? "tab active" : "tab"} onClick={() => { setMode("login"); setError(""); setMessage(""); }}>PASSWORD</button>
              <button type="button" className={mode === "otp" ? "tab active" : "tab"} onClick={() => { setMode("otp"); setError(""); setMessage(""); }}>via OTP</button>
            </div>
          )}

          <Alert type="success">{message}</Alert>
          <Alert type="danger">{error}</Alert>

          {mode === "login" && (
            <form id="form-password-section" data-testid="login-form" className="form-section plain-form" onSubmit={submitLogin}>
              <div className="input-group">
                <label>Email hoặc Tên đăng nhập</label>
                <input
                  id="login-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  placeholder="Ví dụ: mangaka@studio.com hoặc Mangaka"
                  value={credentials.username}
                  onChange={(event) => setCredentials({ ...credentials, username: event.target.value })}
                />
              </div>

              <div className="input-group">
                <label>Mật Khẩu</label>
                <div className="password-wrapper">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••"
                    value={credentials.password}
                    onChange={(event) => setCredentials({ ...credentials, password: event.target.value })}
                  />
                  <button
                    type="button"
                    className="eye-icon password-toggle"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              <div className="form-actions">
                <label className="remember-me remember-password-control">
                  <input
                    type="checkbox"
                    data-testid="remember-password"
                    checked={rememberPassword}
                    onChange={(event) => setRememberPassword(event.target.checked)}
                  />
                  <span>Remember password</span>
                </label>
                <button type="button" className="forgot-link">Forgot password?</button>
              </div>

              <button className="btn-primary" id="btn-login" data-testid="login-submit" disabled={busy || !credentials.username || !credentials.password}>{busy ? "Logging in..." : "Login"}</button>

              <div className="divider">Or login with</div>
              <div className="social-login google-login-box">
                {GOOGLE_CLIENT_ID ? (
                  <>
                    <div ref={googleButtonRef} className="google-render-target" />
                    {googleBusy && <p className="login-helper-text">Signing in with Google...</p>}
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn-social"
                    onClick={() => setError("Google sign-in is not available right now.")}
                  >
                    <strong>Google</strong>
                  </button>
                )}
              </div>
              <p className="new-account">New to this page ? <button type="button" onClick={() => setMode("register")}>create new account</button></p>
            </form>
          )}

          {mode === "otp" && (
            <form id="form-otp-section" className="form-section plain-form" onSubmit={submitOtp}>
              <div className="input-group">
                <label>Account email</label>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="Ví dụ: mangaka@studio.com"
                  value={otpEmail}
                  onChange={(event) => {
                    setOtpEmail(event.target.value);
                    setOtpSent(false);
                  }}
                />
              </div>

              <div className="center-btn">
                <button className="btn-secondary" type="button" disabled={busy || !otpEmail} onClick={sendOtp}>
                  {busy && !otpSent ? "Sending..." : otpSent ? "OTP Sent" : "Send OTP"}
                </button>
              </div>

              <div className="input-group otp-later">
                <label>OTP code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ví dụ: 111111"
                  className="otp-input-large"
                  value={otpCode}
                  disabled={!otpSent}
                  onChange={(event) => setOtpCode(event.target.value)}
                />
              </div>

              <p className="otp-timer-text">{otpSent ? "OTP has been sent and will expire in 5 minutes." : "Enter your account email, then request an OTP."}</p>
              <button className="btn-primary" disabled={busy || !otpSent || !otpCode}>{busy && otpSent ? "Verifying..." : "Login with OTP"}</button>
              <div className="otp-resend-action">
                <span className="not-received-text">Not received OTP?</span>
                <button type="button" className="btn-orange" disabled={busy || !otpEmail} onClick={sendOtp}>Send again</button>
              </div>
            </form>
          )}

          {mode === "register" && (
            <form id="form-register-section" className="form-section plain-form" onSubmit={submitRegister}>
              <div className="register-header-box"><span className="register-title">Registration</span></div>

              <div className="input-group"><label>Email or name</label><input type="text" placeholder="nguyenhuy@gmail.com or mangaka" value={registration.username} onChange={(event) => setRegistration({ ...registration, username: event.target.value })} /></div>
              <div className="input-group"><label>Email</label><input type="email" placeholder="mangaka@studio.com" value={registration.email} onChange={(event) => setRegistration({ ...registration, email: event.target.value })} /></div>
              <div className="input-group">
                <label>Password</label>
                <div className="password-wrapper">
                  <input
                    type={showRegisterPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••"
                    value={registration.password}
                    onChange={(event) => setRegistration({ ...registration, password: event.target.value })}
                  />
                  <button
                    type="button"
                    className="eye-icon password-toggle"
                    aria-label={showRegisterPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowRegisterPassword((value) => !value)}
                  >
                    {showRegisterPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
              <div className="input-group"><label>Phone number</label><input type="text" placeholder="0983894738" value={registration.phoneNumber} onChange={(event) => setRegistration({ ...registration, phoneNumber: event.target.value })} /></div>
              <div className="input-group"><label>Role</label><select className="role-select" value={registration.role} onChange={(event) => setRegistration({ ...registration, role: event.target.value })}>{PUBLIC_REGISTRATION_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}</select></div>

              <button className="btn-primary btn-registrate" disabled={busy || !registration.username || !registration.password || !registration.role}>{busy ? "Registering..." : "Registrate"}</button>
              <p className="new-account back-login"><button type="button" onClick={() => setMode("login")}>Back to Login</button></p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
