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

  const canCreate = hasRole(role, ["mangaka"]);

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

  async function createSeries(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!form.genre.trim()) {
      setError("Genre is required.");
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
    <section className="stack series-static-screen my-series-screen">
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>

      <div className="toolbar series-count-toolbar">
        <div>
          <p className="eyebrow">{canCreate ? "Your owned titles" : "All visible titles"}</p>
          <h2>{series.length} manga series</h2>
        </div>
        {!canCreate && (
          <select className="form-control compact-select" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            <option value="DRAFT">DRAFT</option>
            <option value="REVIEWING">REVIEWING</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        )}
      </div>

      {canCreate && (
        <form className="form-section create-series-simple-form" onSubmit={createSeries}>
          <div className="form-section-title">Create new series</div>

          <div className="form-row">
            <div className="form-group">
              <label>Title</label>
              <input
                type="text"
                className="form-control"
                value={form.title}
                onChange={(event) => updateForm("title", event.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Genre</label>
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
            <label>Summary</label>
            <textarea
              className="form-control"
              value={form.summary}
              onChange={(event) => updateForm("summary", event.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              className="form-control"
              value={form.description}
              onChange={(event) => updateForm("description", event.target.value)}
            />
          </div>

          <button className="btn-publish create-series-submit" disabled={saving}>
            {saving ? "Creating..." : "Create series"}
          </button>
        </form>
      )}

      {!series.length ? (
        <EmptyState icon="◇" title="No series loaded" body="Check that the backend is running, you are logged in, and series data exists for your role." />
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
    <button className="list-card series-card" onClick={() => navigate(`/chapters-pages?seriesId=${series.id}`)}>
      <div className="list-card-img series-cover">
        {cover ? <img src={cover} alt={series.title} /> : <span>{(series.title || "M").slice(0, 1).toUpperCase()}</span>}
      </div>
      <div className="list-card-content series-body">
        <div className="row-between"><div className="list-card-title">{series.title}</div><StatusBadge value={series.status} /></div>
        <p>{series.summary || series.description || "No summary provided."}</p>
        <small>{series.genre || "Unknown genre"} {series.mangakaName ? `• ${series.mangakaName}` : ""}</small>
      </div>
    </button>
  );
}
