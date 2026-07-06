import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Alert, EmptyState, LoadingBlock } from "../components/Status";

export default function SystemPage() {
  const [parameters, setParameters] = useState([]);
  const [form, setForm] = useState({ key: "", value: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api.system.parameters();
      setParameters(Array.isArray(data) ? data : Object.entries(data || {}).map(([key, value]) => ({ key, value })));
    } catch (err) {
      setError(err.message || "Could not load system parameters. Admin role may be required.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.system.create(form.key, form.value);
      setMessage("Parameter saved.");
      setForm({ key: "", value: "" });
      await load();
    } catch (err) {
      setError(err.message || "Could not save parameter");
    }
  }

  if (loading) return <LoadingBlock label="Loading system parameters..." />;

  return (
    <section className="stack">
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>
      <form className="card inline-form" onSubmit={save}>
        <input placeholder="Parameter key" value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} />
        <input placeholder="Value" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} />
        <button className="btn btn-primary" disabled={!form.key}>Save</button>
      </form>
      <div className="card">
        <div className="card-header"><h3>Parameters</h3><span>{parameters.length}</span></div>
        {parameters.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Key</th><th>Value</th></tr></thead>
              <tbody>{parameters.map((item, index) => <tr key={item.key || index}><td>{item.key || item.paramKey}</td><td>{String(item.value || item.paramValue || "")}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <EmptyState title="No parameters" body="No backend system parameters were returned." />}
      </div>
    </section>
  );
}
