import { useEffect, useMemo, useState } from "react";
import { api, unwrapList } from "../api/client";
import { Alert, EmptyState, LoadingBlock } from "../components/Status";

function normalizeParameters(data) {
  const list = unwrapList(data);
  if (list.length) return list;
  return Object.entries(data || {}).map(([key, value]) => ({ key, value }));
}

function parameterKey(item) {
  return item?.key || item?.paramKey || item?.parameterKey || "";
}

function parameterValue(item) {
  return item?.value ?? item?.paramValue ?? item?.parameterValue ?? "";
}

export default function SystemPage() {
  const [parameters, setParameters] = useState([]);
  const [form, setForm] = useState({ key: "", value: "" });
  const [editingKey, setEditingKey] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setParameters(normalizeParameters(await api.system.parameters()));
    } catch (err) {
      setError(err.message || "Could not load system parameters. Admin role may be required.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function save(event) {
    event.preventDefault();
    const key = form.key.trim();
    const value = form.value.trim();
    if (!key || !value) {
      setError("Parameter key and value are required.");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      if (editingKey) {
        await api.system.update(editingKey, value);
        setMessage(`Updated ${editingKey}.`);
      } else {
        await api.system.create(key, value);
        setMessage(`Created ${key}.`);
      }
      setForm({ key: "", value: "" });
      setEditingKey("");
      await load();
    } catch (err) {
      setError(err.message || "Could not save parameter");
    } finally {
      setSaving(false);
    }
  }

  function edit(item) {
    const key = parameterKey(item);
    setEditingKey(key);
    setForm({ key, value: String(parameterValue(item)) });
    setError("");
    setMessage("");
  }

  async function remove(item) {
    const key = parameterKey(item);
    if (!key || !window.confirm(`Delete system parameter ${key}?`)) return;
    setError("");
    setMessage("");
    try {
      await api.system.remove(key);
      setParameters((old) => old.filter((entry) => parameterKey(entry) !== key));
      if (editingKey === key) {
        setEditingKey("");
        setForm({ key: "", value: "" });
      }
      setMessage(`Deleted ${key}.`);
    } catch (err) {
      setError(err.message || "Could not delete parameter");
    }
  }

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return parameters.filter((item) => !needle || `${parameterKey(item)} ${parameterValue(item)}`.toLowerCase().includes(needle));
  }, [parameters, query]);

  if (loading) return <LoadingBlock label="Loading system parameters..." />;

  return (
    <section className="stack">
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>
      <form className="card system-parameter-form" onSubmit={save}>
        <div>
          <p className="eyebrow">Admin configuration</p>
          <h3>{editingKey ? `Edit ${editingKey}` : "Create a parameter or limit"}</h3>
          <small>Examples: MAX_UPLOAD_MB, MAX_PAGES_PER_CHAPTER, REVIEW_TIMEOUT_HOURS.</small>
        </div>
        <input required placeholder="Parameter key" value={form.key} disabled={Boolean(editingKey)} onChange={(event) => setForm({ ...form, key: event.target.value.toUpperCase().replace(/\s+/g, "_") })} />
        <input required placeholder="Value / limit" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} />
        <div className="button-row">
          <button className="btn btn-primary" disabled={saving || !form.key.trim() || !form.value.trim()}>{saving ? "Saving..." : editingKey ? "Update" : "Create"}</button>
          {editingKey && <button className="btn" type="button" onClick={() => { setEditingKey(""); setForm({ key: "", value: "" }); }}>Cancel</button>}
        </div>
      </form>
      <div className="card">
        <div className="card-header">
          <h3>Parameters</h3>
          <div className="button-row"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter parameters" /><span>{filtered.length}</span></div>
        </div>
        {filtered.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Key</th><th>Value</th><th>Actions</th></tr></thead>
              <tbody>{filtered.map((item, index) => (
                <tr key={parameterKey(item) || index}>
                  <td><strong>{parameterKey(item)}</strong></td>
                  <td>{String(parameterValue(item))}</td>
                  <td><div className="button-row"><button className="btn btn-small" onClick={() => edit(item)}>Edit</button><button className="btn btn-small btn-danger" onClick={() => remove(item)}>Delete</button></div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyState title="No parameters" body="No backend system parameters matched the current filter." />}
      </div>
    </section>
  );
}
