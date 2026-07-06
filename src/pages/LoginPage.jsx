import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { navigate } from "../utils/router";
import { Alert } from "../components/Status";
import { roleHome } from "../api/client";

const ROLES = ["Mangaka", "Assistant", "Tantou Editor", "Editorial Board", "Admin"];

export default function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [registration, setRegistration] = useState({ username: "", email: "", phoneNumber: "", password: "", role: "Mangaka" });
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");

  async function submitLogin(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const session = await login(credentials);
      setMessage("Login successful. Redirecting...");
      navigate(roleHome(session.role));
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

  function fakeOtp(event) {
    event.preventDefault();
    setMessage(otpCode ? "OTP form is ready. Connect it to /api/v1/auth/verify-otp if your backend enables it." : "OTP has been sent and will expire in 60s.");
    setError("");
  }

  return (
    <div className="split-layout">
      <div className="left-panel">
        <img src="/cover.png" alt="Manga Covers" className="manga-image" onError={(event) => { event.currentTarget.style.display = "none"; }} />
      </div>

      <div className="right-panel login-panel">
        <div className="form-container">
          <h1 className="logo">MangaSystem</h1>

          {mode !== "register" && (
            <div className="tabs" id="login-tabs">
              <button type="button" className={mode === "login" ? "tab active" : "tab"} onClick={() => setMode("login")}>PASSWORD</button>
              <button type="button" className={mode === "otp" ? "tab active" : "tab"} onClick={() => setMode("otp")}>via OTP</button>
            </div>
          )}

          <Alert type="success">{message}</Alert>
          <Alert type="danger">{error}</Alert>

          {mode === "login" && (
            <form id="form-password-section" className="form-section plain-form" onSubmit={submitLogin}>
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
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••"
                    value={credentials.password}
                    onChange={(event) => setCredentials({ ...credentials, password: event.target.value })}
                  />
                  <span className="eye-icon">👁️</span>
                </div>
              </div>

              <div className="form-actions">
                <label className="remember-me"><input type="checkbox" /> Remember password</label>
                <button type="button" className="forgot-link">Forgot password?</button>
              </div>

              <button className="btn-primary" id="btn-login" disabled={busy || !credentials.username || !credentials.password}>{busy ? "Logging in..." : "Login"}</button>

              <div className="divider">Or login with</div>
              <div className="social-login"><button type="button" className="btn-social"><strong>Google</strong></button></div>
              <p className="new-account">New to this page ? <button type="button" onClick={() => setMode("register")}>create new account</button></p>
            </form>
          )}

          {mode === "otp" && (
            <form id="form-otp-section" className="form-section plain-form" onSubmit={fakeOtp}>
              <div className="input-group">
                <label>Enter gmail</label>
                <input type="text" placeholder="Ví dụ: leduchuylt@gmail.com" value={otpEmail} onChange={(event) => setOtpEmail(event.target.value)} />
              </div>
              <div className="center-btn"><button className="btn-secondary" disabled={!otpEmail}>Enter</button></div>
              <div className="input-group otp-later">
                <input type="text" placeholder="Ví dụ: 111-111" className="otp-input-large" value={otpCode} onChange={(event) => setOtpCode(event.target.value)} />
              </div>
              <p className="otp-timer-text">OTP has been sent and will expired in <span>60</span>s</p>
              <div className="otp-resend-action"><span className="not-received-text">Not received OTP?</span><button type="button" className="btn-orange">Send again</button></div>
            </form>
          )}

          {mode === "register" && (
            <form id="form-register-section" className="form-section plain-form" onSubmit={submitRegister}>
              <div className="register-header-box"><span className="register-title">Registration</span></div>

              <div className="input-group"><label>Email or name</label><input type="text" placeholder="nguyenhuy@gmail.com or mangaka" value={registration.username} onChange={(event) => setRegistration({ ...registration, username: event.target.value })} /></div>
              <div className="input-group"><label>Email</label><input type="email" placeholder="mangaka@studio.com" value={registration.email} onChange={(event) => setRegistration({ ...registration, email: event.target.value })} /></div>
              <div className="input-group"><label>Password</label><div className="password-wrapper"><input type="password" placeholder="••••••" value={registration.password} onChange={(event) => setRegistration({ ...registration, password: event.target.value })} /><span className="eye-icon">👁️</span></div></div>
              <div className="input-group"><label>Phone number</label><input type="text" placeholder="0983894738" value={registration.phoneNumber} onChange={(event) => setRegistration({ ...registration, phoneNumber: event.target.value })} /></div>
              <div className="input-group"><label>Role</label><select className="role-select" value={registration.role} onChange={(event) => setRegistration({ ...registration, role: event.target.value })}>{ROLES.map((role) => <option key={role} value={role}>{role}</option>)}</select></div>

              <button className="btn-primary btn-registrate" disabled={busy || !registration.username || !registration.password || !registration.role}>{busy ? "Registering..." : "Registrate"}</button>
              <p className="new-account back-login"><button type="button" onClick={() => setMode("login")}>Back to Login</button></p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
