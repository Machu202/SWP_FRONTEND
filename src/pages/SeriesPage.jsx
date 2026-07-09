import { useEffect, useMemo, useState } from "react";
import { api, extractMediaUrl, hasRole, resolveMediaUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { navigate } from "../utils/router";
import { Alert, EmptyState, LoadingBlock, StatusBadge } from "../components/Status";

const DEFAULT_SERIES = {
  title: "",
  genre: "",
  summary: "",
  description: "",
  status: "DRAFT",
  coverImageUrl: ""
};

const GENRES = ["Action", "Adventure", "Comedy", "Romance", "Fantasy", "Sci-Fi", "Horror", "Slice of Life", "Mystery", "Sports"];

function isReviewableSeries(series) {
  const status = String(series?.status || "").toUpperCase();
  return status && !["DRAFT", "ARCHIVED", "CANCELLED"].includes(status);
}

function seriesOpenPath(role, series) {
  if (hasRole(role, ["tantou"])) return `/tantou-review?seriesId=${series.id}`;
  if (hasRole(role, ["editorial", "board"])) return `/board-review?seriesId=${series.id}`;
  if (hasRole(role, ["admin"])) return `/admin-review?seriesId=${series.id}`;
  return `/chapters-pages?seriesId=${series.id}`;
}

export default function SeriesPage() {
  const { profile, session } = useAuth();
  const role = profile?.roleName || session.role;
  const [series, setSeries] = useState([]);
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({ ...DEFAULT_SERIES });
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const canCreate = hasRole(role, ["mangaka"]);
  const canDelete = hasRole(role, ["mangaka", "admin"]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = canCreate ? await api.series.mine() : await api.series.list({ status });
      setSeries(data || []);
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

  useEffect(() => () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

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
    updateForm("coverImageUrl", "");
    setError("");
  }

  function clearCover() {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview("");
    updateForm("coverImageUrl", "");
  }

  function resetForm() {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setForm({ ...DEFAULT_SERIES });
    setCoverFile(null);
    setCoverPreview("");
  }

  function validateCreateSeriesForm() {
    const missing = [];
    if (!form.title.trim()) missing.push("title");
    if (!form.genre.trim()) missing.push("genre");
    if (!form.summary.trim()) missing.push("summary");
    if (!form.description.trim()) missing.push("description");

    if (missing.length) {
      const labels = missing.map((field) => field.charAt(0).toUpperCase() + field.slice(1));
      return `${labels.join(", ")} ${missing.length === 1 ? "is" : "are"} required before creating a series.`;
    }

    return "";
  }

  async function createSeries(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const validationError = validateCreateSeriesForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      let payload = {
        title: form.title.trim(),
        genre: form.genre.trim(),
        summary: form.summary.trim(),
        description: form.description.trim(),
        status: form.status || "DRAFT"
      };

      if (coverFile) {
        setMessage("Uploading cover image...");
        const uploaded = await api.resources.upload(coverFile, "SERIES_COVER");
        const uploadedUrl = extractMediaUrl(uploaded);
        if (!uploadedUrl) throw new Error("Cover uploaded, but the backend did not return an image URL.");
        payload = { ...payload, coverImageUrl: uploadedUrl, coverUrl: uploadedUrl, imageUrl: uploadedUrl, thumbnailUrl: uploadedUrl };
      }

      const created = await api.series.create(payload);
      setMessage(`Created ${created.title || form.title}`);
      resetForm();
      await load();
    } catch (err) {
      setError(err.message || "Could not create series");
    } finally {
      setSaving(false);
    }
  }

  function requestDeleteSeries(item) {
    if (!item?.id || !canDelete) return;
    setPendingDelete({ item, name: item.title || `Series #${item.id}` });
  }

  async function confirmDeleteSeries() {
    if (!pendingDelete?.item?.id || deleting) return;

    const { item, name } = pendingDelete;
    setDeleting(true);
    setError("");
    setMessage("");
    try {
      await api.series.remove(item.id);
      setMessage(`Deleted ${name}.`);
      setPendingDelete(null);
      await load();
    } catch (err) {
      setError(err.message || "Could not delete series. Remove dependent chapters/pages first, or check backend cascade rules.");
    } finally {
      setDeleting(false);
    }
  }

  const displaySeries = useMemo(() => {
    if (hasRole(role, ["tantou"]) && !status) return series.filter(isReviewableSeries);
    return series;
  }, [series, role, status]);

  const grouped = useMemo(() => {
    const groups = {};
    displaySeries.forEach((item) => {
      const key = item.status || "DRAFT";
      groups[key] = groups[key] || [];
      groups[key].push(item);
    });
    return groups;
  }, [displaySeries]);

  if (loading) return <LoadingBlock label="Loading series..." />;

  return (
    <section className="stack series-static-screen my-series-screen">
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>

      <div className="toolbar series-count-toolbar">
        <div>
          <p className="eyebrow">{canCreate ? "Your owned titles" : hasRole(role, ["tantou"]) ? "Reviewable titles" : "All visible titles"}</p>
          <h2>{displaySeries.length} manga series</h2>
        </div>
        {!canCreate && (
          <select className="form-control compact-select" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {!hasRole(role, ["tantou"]) && <option value="DRAFT">DRAFT</option>}
            <option value="REVIEWING">REVIEWING</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        )}
      </div>

      {canCreate && (
        <form className="form-section create-series-simple-form" onSubmit={createSeries} noValidate>
          <div className="form-section-title">Create new series</div>

          <div className="form-row">
            <div className="form-group">
              <label>Title <span className="required-mark">*</span></label>
              <input
                type="text"
                className="form-control"
                value={form.title}
                onChange={(event) => updateForm("title", event.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Genre <span className="required-mark">*</span></label>
              <select
                className="form-control"
                value={form.genre}
                onChange={(event) => updateForm("genre", event.target.value)}
                required
              >
                <option value="">Select genre</option>
                {GENRES.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Cover image</label>
            <label className="upload-box series-cover-upload-inline">
              {coverPreview ? (
                <img src={coverPreview} alt="Cover preview" />
              ) : (
                <span>Choose cover image</span>
              )}
              <input type="file" accept="image/*" onChange={handleCoverChange} />
            </label>
            {coverFile && (
              <div className="upload-selected-row">
                <span>{coverFile.name}</span>
                <button type="button" className="btn btn-small" onClick={clearCover}>Remove</button>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Summary <span className="required-mark">*</span></label>
            <textarea
              className="form-control"
              value={form.summary}
              onChange={(event) => updateForm("summary", event.target.value)}
              placeholder="Required: short synopsis or logline for this series..."
              required
            />
          </div>

          <div className="form-group">
            <label>Description <span className="required-mark">*</span></label>
            <textarea
              className="form-control"
              value={form.description}
              onChange={(event) => updateForm("description", event.target.value)}
              placeholder="Required: longer description, premise, or production notes..."
              required
            />
          </div>

          <p className="form-required-note">* Title, genre, summary, and description are required before creating a series.</p>
          <button className="btn-publish create-series-submit" disabled={saving}>
            {saving ? "Creating..." : "Create series"}
          </button>
        </form>
      )}

      {!displaySeries.length ? (
        <EmptyState icon="◇" title="No series loaded" body="Check that the backend is running, you are logged in, and series data exists for your role." />
      ) : (
        <div className="series-groups">
          {Object.entries(grouped).map(([group, items]) => (
            <div className="stack" key={group}>
              <h3 className="group-title">{group}</h3>
              <div className="series-grid">
                {items.map((item) => <SeriesCard key={item.id} series={item} role={role} canDelete={canDelete} onDelete={requestDeleteSeries} />)}
              </div>
            </div>
          ))}
        </div>
      )}

      <DeleteConfirmModal
        open={Boolean(pendingDelete)}
        name={pendingDelete?.name || "this item"}
        busy={deleting}
        onCancel={() => !deleting && setPendingDelete(null)}
        onConfirm={confirmDeleteSeries}
      />
    </section>
  );
}

function SeriesCard({ series, role, canDelete, onDelete }) {
  const cover = resolveMediaUrl(series.coverImageUrl || series.coverUrl || series.imageUrl || series.thumbnailUrl);
  return (
    <div className="list-card series-card series-card-with-actions">
      <button className="series-card-main" onClick={() => navigate(seriesOpenPath(role, series))}>
        <div className="list-card-img series-cover">
          {cover ? <img src={cover} alt={series.title} /> : <span>{(series.title || "M").slice(0, 1).toUpperCase()}</span>}
        </div>
        <div className="list-card-content series-body">
          <div className="row-between"><div className="list-card-title">{series.title}</div><StatusBadge value={series.status} /></div>
          <p>{series.summary || series.description || "No summary provided."}</p>
          <small>{series.genre || "Unknown genre"} {series.mangakaName ? `• ${series.mangakaName}` : ""}</small>
        </div>
      </button>
      {canDelete && (
        <div className="list-card-actions series-card-actions">
          <button className="btn btn-small" onClick={() => navigate(seriesOpenPath(role, series))}>Open</button>
          <button className="btn btn-small btn-danger" onClick={() => onDelete(series)}>Delete</button>
        </div>
      )}
    </div>
  );
}

function DeleteConfirmModal({ open, name, busy, onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <div className="delete-modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <div className="delete-modal-card" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="delete-modal-icon">!</div>
        <h3 id="delete-modal-title">Are you sure you want to delete {name}?</h3>
        <div className="delete-modal-actions">
          <button className="btn" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-danger solid-danger" type="button" onClick={onConfirm} disabled={busy}>{busy ? "Deleting..." : "Delete"}</button>
        </div>
      </div>
    </div>
  );
}
