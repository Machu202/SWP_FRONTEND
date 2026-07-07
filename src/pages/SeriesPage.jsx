import { useEffect, useMemo, useState } from "react";
import { api, extractMediaUrl, hasRole, resolveMediaUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { navigate } from "../utils/router";
import { Alert, EmptyState, LoadingBlock, StatusBadge } from "../components/Status";

const DEFAULT_SERIES = {
  title: "",
  genre: "Action",
  summary: "",
  description: "",
  script: "",
  status: "Pre-production",
  targetAudience: "Shonen (Boys)",
  pageCount: 20,
  coverImageUrl: ""
};

const GENRES = ["Action", "Adventure", "Comedy", "Romance", "Fantasy", "Sci-Fi", "Horror", "Slice of Life", "Mystery", "Sports"];

export default function SeriesPage() {
  const { profile, session } = useAuth();
  const role = profile?.roleName || session.role;
  const [series, setSeries] = useState([]);
  const [status, setStatus] = useState("");
  const [form, setForm] = useState(DEFAULT_SERIES);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [conceptPreview, setConceptPreview] = useState("");
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
    if (conceptPreview) URL.revokeObjectURL(conceptPreview);
  }, [coverPreview, conceptPreview]);

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

  function handleConceptChange(event) {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    if (conceptPreview) URL.revokeObjectURL(conceptPreview);
    setConceptPreview(URL.createObjectURL(file));
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
      let payload = {
        title: form.title,
        genre: form.genre,
        summary: form.summary || form.description,
        description: form.description || form.summary,
        status: form.status
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
      setForm(DEFAULT_SERIES);
      clearCover();
      setConceptPreview("");
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
    <section className="stack series-static-screen">
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>

      {canCreate && (
        <form onSubmit={createSeries} style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 30, marginTop: 20 }}>
          <div>
            <div className="form-section">
              <div className="form-section-title">Core Information</div>
              <div className="form-group">
                <label>Series Title <span style={{ color: "red" }}>*</span></label>
                <input type="text" className="form-control" placeholder="Enter series title..." value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
              </div>
              <div className="form-group">
                <label>Synopsis / Logline <span style={{ color: "red" }}>*</span></label>
                <textarea className="form-control" placeholder="Brief summary of the story..." style={{ height: 120 }} value={form.summary} onChange={(event) => setForm({ ...form, summary: event.target.value })} required />
              </div>
              <div className="form-group">
                <label>Series Script / Story Bible</label>
                <textarea className="form-control" placeholder="Optional: add story bible, key scenes, dialogue notes, or long-form script..." style={{ height: 150 }} value={form.script} onChange={(event) => setForm({ ...form, script: event.target.value })} />
              </div>
              <div className="form-group">
                <label>Genre (Thể loại) <span style={{ color: "red" }}>*</span></label>
                <select className="form-control" value={form.genre} onChange={(event) => setForm({ ...form, genre: event.target.value })}>
                  {GENRES.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div className="form-group">
                  <label>Target Audience</label>
                  <select className="form-control" value={form.targetAudience} onChange={(event) => setForm({ ...form, targetAudience: event.target.value })}>
                    <option>Shonen (Boys)</option><option>Seinen (Adult Men)</option><option>Shojo (Girls)</option><option>Josei (Adult Women)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select className="form-control" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                    <option>Pre-production</option><option>Serialization</option><option>Hiatus</option><option>DRAFT</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="form-section">
              <div className="form-section-title">Visual Identity</div>
              <div className="form-group">
                <label>Series Cover <span style={{ color: "red" }}>*</span></label>
                <label className="upload-zone cover-upload-box" style={{ height: 250 }}>
                  {coverPreview ? <img src={coverPreview} alt="Cover preview" /> : (
                    <div id="cover-placeholder" style={{ zIndex: 1, textAlign: "center" }}>
                      <i style={{ fontSize: 40, marginBottom: 15, color: "#d1d5db", display: "block" }}>▧</i>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Upload Primary Art</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={handleCoverChange} />
                </label>
                {coverFile && <button type="button" className="btn btn-small" style={{ marginTop: 8 }} onClick={clearCover}>Remove cover</button>}
              </div>

              <div className="form-group">
                <label>Concept Art / Background</label>
                <label className="upload-zone cover-upload-box" style={{ height: 120 }}>
                  {conceptPreview ? <img src={conceptPreview} alt="Concept preview" /> : (
                    <div style={{ zIndex: 1, textAlign: "center" }}>
                      <i style={{ fontSize: 24, marginBottom: 10, color: "#d1d5db", display: "block" }}>▧</i>
                      <span style={{ fontSize: 12, fontWeight: 600 }}>Upload Concept</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={handleConceptChange} />
                </label>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-title">Technical Settings</div>
              <div className="form-group">
                <label>Target Page Count</label>
                <input type="number" className="form-control" value={form.pageCount} onChange={(event) => setForm({ ...form, pageCount: event.target.value })} />
              </div>
            </div>

            <button className="btn-publish" style={{ width: "100%", marginTop: 20, padding: 15, fontSize: 16 }} disabled={saving || !form.title || !form.summary}>
              {saving ? "Creating..." : "Create New Series"}
            </button>
          </div>
        </form>
      )}

      <div className="toolbar" style={{ marginTop: 10 }}>
        <div>
          <p className="eyebrow">{canCreate ? "Your owned titles" : "All visible titles"}</p>
          <h2>{series.length} manga series</h2>
        </div>
        {!canCreate && (
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option><option value="DRAFT">DRAFT</option><option value="REVIEWING">REVIEWING</option><option value="APPROVED">APPROVED</option><option value="REJECTED">REJECTED</option>
          </select>
        )}
      </div>

      {!series.length ? (
        <EmptyState icon="◇" title="No series loaded" body="Check that the backend is running, you are logged in, and seed data exists for your role." />
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
    <button className="list-card series-card" onClick={() => navigate(`/series/${series.id}`)}>
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
