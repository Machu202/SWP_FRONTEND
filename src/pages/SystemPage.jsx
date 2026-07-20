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

function parameterType(item) {
  return String(item?.paramType || item?.parameterType || item?.type || "STRING").toUpperCase();
}

function parameterUpdatedBy(item) {
  return item?.updatedByName || item?.updated_by_name || (item?.updatedBy || item?.updated_by ? `Admin #${item.updatedBy || item.updated_by}` : "Legacy value");
}

function parameterUpdatedAt(item) {
  const raw = item?.updatedAt || item?.updated_at;
  if (!raw) return "Before audit tracking";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? String(raw) : date.toLocaleString();
}

const PARAMETER_TYPES = ["STRING", "INTEGER", "DECIMAL", "BOOLEAN", "JSON"];

export default function SystemPage() {
  const [parameters, setParameters] = useState([]);
  const [form, setForm] = useState({ key: "", value: "", type: "STRING" });
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
        await api.system.update(editingKey, value, form.type);
        setMessage(`Updated ${editingKey}.`);
      } else {
        await api.system.create(key, value, form.type);
        setMessage(`Created ${key}.`);
      }
      setForm({ key: "", value: "", type: "STRING" });
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
    setForm({ key, value: String(parameterValue(item)), type: parameterType(item) });
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
        setForm({ key: "", value: "", type: "STRING" });
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
        <select aria-label="Parameter type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
          {PARAMETER_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
        <input required placeholder="Value / limit" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} />
        <div className="button-row">
          <button className="btn btn-primary" disabled={saving || !form.key.trim() || !form.value.trim()}>{saving ? "Saving..." : editingKey ? "Update" : "Create"}</button>
          {editingKey && <button className="btn" type="button" onClick={() => { setEditingKey(""); setForm({ key: "", value: "", type: "STRING" }); }}>Cancel</button>}
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
              <thead><tr><th>Key</th><th>Type</th><th>Value</th><th>Last updated</th><th>Actions</th></tr></thead>
              <tbody>{filtered.map((item, index) => (
                <tr key={parameterKey(item) || index}>
                  <td><strong>{parameterKey(item)}</strong></td>
                  <td><span className="system-parameter-type">{parameterType(item)}</span></td>
                  <td>{String(parameterValue(item))}</td>
                  <td><span className="system-parameter-audit"><strong>{parameterUpdatedBy(item)}</strong><small>{parameterUpdatedAt(item)}</small></span></td>
                  <td><div className="button-row"><button className="btn btn-small" onClick={() => edit(item)}>Edit</button><button className="btn btn-small btn-danger" onClick={() => remove(item)}>Delete</button></div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <EmptyState title="No parameters" body="No settings match the current filter." />}
      </div>
    </section>
  );
}
