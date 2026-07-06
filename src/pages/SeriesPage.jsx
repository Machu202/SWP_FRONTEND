import { useEffect, useMemo, useState } from "react";
import { api, extractMediaUrl, hasRole, resolveMediaUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { navigate } from "../utils/router";
import { Alert, EmptyState, LoadingBlock, StatusBadge } from "../components/Status";

const DEFAULT_SERIES = { title: "", genre: "", summary: "", description: "", coverImageUrl: "" };

export default function SeriesPage() {
  const { profile, session } = useAuth();
  const role = profile?.roleName || session.role;
  const [series, setSeries] = useState([]);
  const [status, setStatus] = useState("");
  const [form, setForm] = useState(DEFAULT_SERIES);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const canCreate = hasRole(role, ["mangaka"]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = canCreate ? await api.series.mine() : await api.series.list({ status });
      setSeries(data);
    } catch (err) {
      setError(err.message || "Could not load series");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, canCreate]);

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  function handleCoverChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Cover must be an image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Cover image must be 10MB or smaller.");
      event.target.value = "";
      return;
    }

    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setForm((current) => ({ ...current, coverImageUrl: "" }));
    setError("");
  }

  function clearCover() {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview("");
    setForm((current) => ({ ...current, coverImageUrl: "" }));
  }

  async function createSeries(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      let payload = { ...form };

      if (coverFile) {
        setMessage("Uploading cover image...");
        const uploaded = await api.resources.upload(coverFile, "SERIES_COVER");
        const uploadedUrl = extractMediaUrl(uploaded);

        if (!uploadedUrl) {
          throw new Error("Cover uploaded, but the backend did not return an image URL.");
        }

        payload = {
          ...payload,
          coverImageUrl: uploadedUrl,
          coverUrl: uploadedUrl,
          imageUrl: uploadedUrl,
          thumbnailUrl: uploadedUrl
        };
      }

      const created = await api.series.create(payload);
      setMessage(`Created ${created.title || form.title}`);
      setForm(DEFAULT_SERIES);
      clearCover();
      await load();
    } catch (err) {
      setError(err.message || "Could not create series");
    } finally {
      setSaving(false);
    }
  }

  const grouped = useMemo(() => {
    const groups = {};
    series.forEach((item) => {
      const key = item.status || "DRAFT";
      groups[key] = groups[key] || [];
      groups[key].push(item);
    });
    return groups;
  }, [series]);

  if (loading) return <LoadingBlock label="Loading series..." />;

  return (
    <section className="stack">
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>

      <div className="toolbar">
        <div>
          <p className="eyebrow">{canCreate ? "Your owned titles" : "All visible titles"}</p>
          <h2>{series.length} manga series</h2>
        </div>
        {!canCreate && (
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            <option value="DRAFT">DRAFT</option>
            <option value="REVIEWING">REVIEWING</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        )}
      </div>

      {canCreate && (
        <form className="card form-grid" onSubmit={createSeries}>
          <h3>Create new series</h3>
          <label>
            Title
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          </label>
          <label>
            Genre
            <input value={form.genre} onChange={(event) => setForm({ ...form, genre: event.target.value })} />
          </label>
          <div className="wide cover-upload-field">
            <span className="field-label">Cover image</span>
            <div className="cover-upload-row">
              <label className="cover-upload-box">
                {coverPreview ? (
                  <img src={coverPreview} alt="Selected cover preview" />
                ) : (
                  <span className="cover-upload-placeholder">
                    <strong>Click to upload cover</strong>
                    <small>JPG, PNG, WEBP, or GIF up to 10MB</small>
                  </span>
                )}
                <input type="file" accept="image/*" onChange={handleCoverChange} />
              </label>
              <div className="cover-upload-help">
                <strong>{coverFile ? coverFile.name : "No cover selected"}</strong>
                <span>The file is uploaded to the backend resource endpoint first, then its URL is saved as the series cover.</span>
                {coverFile && (
                  <button type="button" className="btn btn-secondary btn-small" onClick={clearCover} disabled={saving}>
                    Remove cover
                  </button>
                )}
              </div>
            </div>
          </div>
          <label className="wide">
            Summary
            <textarea value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} rows="2" />
          </label>
          <label className="wide">
            Description
            <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows="3" />
          </label>
          <button className="btn btn-primary" disabled={saving || !form.title}>{saving ? "Creating..." : "Create series"}</button>
        </form>
      )}

      {!series.length ? (
        <EmptyState title="No series loaded" body="Check that the backend is running, you are logged in, and seed data exists for your role." />
      ) : (
        <div className="series-groups">
          {Object.entries(grouped).map(([group, items]) => (
            <div className="stack" key={group}>
              <h3 className="group-title">{group}</h3>
              <div className="series-grid">
                {items.map((item) => <SeriesCard key={item.id} series={item} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SeriesCard({ series }) {
  const cover = resolveMediaUrl(series.coverImageUrl || series.coverUrl || series.imageUrl || series.thumbnailUrl);
  return (
    <button className="series-card" onClick={() => navigate(`/series/${series.id}`)}>
      <div className="series-cover">
        {cover ? <img src={cover} alt={series.title} /> : <span>{(series.title || "M").slice(0, 1).toUpperCase()}</span>}
      </div>
      <div className="series-body">
        <div className="row-between">
          <strong>{series.title}</strong>
          <StatusBadge value={series.status} />
        </div>
        <p>{series.summary || series.description || "No summary provided."}</p>
        <small>{series.genre || "Unknown genre"} {series.mangakaName ? `• ${series.mangakaName}` : ""}</small>
      </div>
    </button>
  );
}
