import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const [role, setRole] = useState("tantou");
  const navigate = useNavigate();

  function handleLogin(event) {
    event.preventDefault();

    if (role === "board") {
      navigate("/app/board");
      return;
    }

    navigate("/app/tantou");
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <h1>Manga Studio Management</h1>
        <p>Login to continue the Tantou Editor and Editorial Board flow.</p>

        <form onSubmit={handleLogin}>
          <label className="form-label">Email</label>
          <input className="form-control" value="tantou.editor@studio.com" readOnly />

          <label className="form-label">Password</label>
          <input className="form-control" type="password" value="12345678" readOnly />

          <label className="form-label">Role</label>
          <select
            className="form-control"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="tantou">Tantou Editor</option>
            <option value="board">Editorial Board</option>
          </select>

          <button className="btn full-width" type="submit">
            Login
          </button>
        </form>
      </section>
    </main>
  );
}
