import { useEffect, useMemo, useState } from "react";
import { api, extractMediaUrl, hasRole, mediaUrlFrom } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useWorkspaceSelection } from "../context/WorkspaceSelectionContext";
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

function isVisibleForTantou(series) {
  const status = String(series?.status || "").toUpperCase();
  // A series can still be DRAFT while its chapters/pages are approved by Mangaka
  // and ready for Tantou review. Do not hide DRAFT here.
  return !["ARCHIVED", "CANCELLED"].includes(status);
}

function seriesOpenPath(role, series) {
  if (hasRole(role, ["tantou"])) return `/tantou-review?seriesId=${series.id}`;
  if (hasRole(role, ["editorial", "board"])) return `/board-review?seriesId=${series.id}`;
  if (hasRole(role, ["admin"])) return `/admin-review?seriesId=${series.id}`;
  return `/chapters-pages?seriesId=${series.id}`;
}

export default function SeriesPage() {
  const { profile, session } = useAuth();
  const { selectSeries } = useWorkspaceSelection();
  const role = profile?.roleName || session.role;
  const [series, setSeries] = useState([]);
  const [status, setStatus] = useState("");
  const [form, setForm] = useState({ ...DEFAULT_SERIES });
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [editingSeries, setEditingSeries] = useState(null);
  const [editForm, setEditForm] = useState({ ...DEFAULT_SERIES });
  const [editCoverFile, setEditCoverFile] = useState(null);
  const [editCoverPreview, setEditCoverPreview] = useState("");
  const [editCoverObjectUrl, setEditCoverObjectUrl] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const canCreate = hasRole(role, ["mangaka"]);
  const canDelete = hasRole(role, ["mangaka", "admin"]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const isTantou = hasRole(role, ["tantou"]);
      let data;
      if (canCreate) {
        data = await api.series.mine();
      } else if (isTantou) {
        data = await api.series.assigned().catch(async () => {
          const all = await api.series.list({ size: 100 });
          const currentUserId = profile?.id || session?.id || session?.userId || session?.user_id;
          return (all || []).filter((item) => String(item.tantouId ?? item.tantou_id ?? item.tantou?.id ?? "") === String(currentUserId ?? ""));
        });
      } else {
        data = await api.series.list({ status });
      }
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

  useEffect(() => () => {
    if (editCoverObjectUrl) URL.revokeObjectURL(editCoverObjectUrl);
  }, [editCoverObjectUrl]);

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
    setWizardStep(1);
  }

  function goToWizardStep(nextStep) {
    setError("");
    if (nextStep > wizardStep) {
      if (wizardStep === 1 && (!form.title.trim() || !form.genre.trim())) {
        setError("Title and genre are required before continuing.");
        return;
      }
      if (wizardStep === 2 && (!form.summary.trim() || !form.description.trim())) {
        setError("Summary and description are required before continuing.");
        return;
      }
    }
    setWizardStep(Math.max(1, Math.min(3, nextStep)));
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
        if (!uploadedUrl) throw new Error("The cover could not be prepared. Please choose the image again.");
        payload = {
          ...payload,
          coverImageUrl: uploadedUrl,
          cover_image_url: uploadedUrl,
          coverUrl: uploadedUrl,
          cover_url: uploadedUrl,
          imageUrl: uploadedUrl,
          image_url: uploadedUrl,
          thumbnailUrl: uploadedUrl,
          thumbnail_url: uploadedUrl
        };
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

  function openSeries(item) {
    selectSeries(item?.id);
    navigate(seriesOpenPath(role, item));
  }

  function openEditSeries(item) {
    if (!canCreate || !item?.id) return;
    if (editCoverObjectUrl) URL.revokeObjectURL(editCoverObjectUrl);
    setEditingSeries(item);
    setEditForm({
      title: item.title || "",
      genre: item.genre || "",
      summary: item.summary || "",
      description: item.description || "",
      status: item.status || "DRAFT",
      coverImageUrl: extractMediaUrl(item)
    });
    setEditCoverFile(null);
    setEditCoverObjectUrl("");
    setEditCoverPreview(mediaUrlFrom(item));
    setError("");
    setMessage("");
  }

  function closeEditSeries() {
    if (editSaving) return;
    if (editCoverObjectUrl) URL.revokeObjectURL(editCoverObjectUrl);
    setEditingSeries(null);
    setEditCoverFile(null);
    setEditCoverObjectUrl("");
    setEditCoverPreview("");
  }

  function handleEditCoverChange(event) {
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
    if (editCoverObjectUrl) URL.revokeObjectURL(editCoverObjectUrl);
    const objectUrl = URL.createObjectURL(file);
    setEditCoverFile(file);
    setEditCoverObjectUrl(objectUrl);
    setEditCoverPreview(objectUrl);
    setError("");
  }

  async function saveSeriesProfile(event) {
    event.preventDefault();
    if (!editingSeries?.id || editSaving) return;
    setError("");
    setMessage("");
    if (!editForm.title.trim() || !editForm.genre.trim()) {
      setError("Title and genre are required.");
      return;
    }

    setEditSaving(true);
    try {
      let coverImageUrl = editForm.coverImageUrl;
      if (editCoverFile) {
        const uploaded = await api.resources.upload(editCoverFile, "SERIES_COVER");
        coverImageUrl = extractMediaUrl(uploaded);
        if (!coverImageUrl) throw new Error("The cover could not be prepared. Please choose the image again.");
      }

      const updated = await api.series.update(editingSeries.id, {
        title: editForm.title.trim(),
        genre: editForm.genre.trim(),
        summary: editForm.summary.trim(),
        description: editForm.description.trim(),
        coverImageUrl
      });
      setSeries((old) => old.map((item) => String(item.id) === String(editingSeries.id) ? { ...item, ...updated } : item));
      setMessage(`Updated ${updated?.title || editForm.title.trim()}.`);
      if (editCoverObjectUrl) URL.revokeObjectURL(editCoverObjectUrl);
      setEditingSeries(null);
      setEditCoverFile(null);
      setEditCoverObjectUrl("");
      setEditCoverPreview("");
    } catch (err) {
      setError(err.message || "Could not update the manga profile.");
    } finally {
      setEditSaving(false);
    }
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
      setError(err.message || "Could not delete the series. Remove its chapters and pages first, then try again.");
    } finally {
      setDeleting(false);
    }
  }

  const displaySeries = useMemo(() => {
    let items = [...series];
    if (hasRole(role, ["tantou"])) items = items.filter(isVisibleForTantou);
    if (status) items = items.filter((item) => String(item.status || "").toUpperCase() === String(status).toUpperCase());
    return items;
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
            <option value="DRAFT">DRAFT</option>
            <option value="REVIEWING">REVIEWING</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
          </select>
        )}
      </div>

      {canCreate && (
        <form className="form-section create-series-simple-form series-wizard" data-testid="series-create-form" onSubmit={createSeries} noValidate>
          <div className="form-section-title">Create new series</div>
          <div className="wizard-steps" aria-label="Series creation progress">
            {["Basics", "Story", "Cover & Review"].map((label, index) => {
              const step = index + 1;
              return <button key={label} type="button" className={wizardStep === step ? "active" : wizardStep > step ? "complete" : ""} onClick={() => step < wizardStep && goToWizardStep(step)}><span>{step}</span>{label}</button>;
            })}
          </div>

          {wizardStep === 1 && (
            <div className="wizard-panel">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="series-title">Title <span className="required-mark">*</span></label>
                  <input id="series-title" type="text" className="form-control" value={form.title} onChange={(event) => updateForm("title", event.target.value)} required autoFocus />
                </div>
                <div className="form-group">
                  <label htmlFor="series-genre">Genre <span className="required-mark">*</span></label>
                  <select id="series-genre" className="form-control" value={form.genre} onChange={(event) => updateForm("genre", event.target.value)} required>
                    <option value="">Select genre</option>
                    {GENRES.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
                  </select>
                </div>
              </div>
              <p className="form-required-note">Choose the project identity first.</p>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="wizard-panel">
              <div className="form-group">
                <label htmlFor="series-summary">Summary <span className="required-mark">*</span></label>
                <textarea id="series-summary" className="form-control" value={form.summary} onChange={(event) => updateForm("summary", event.target.value)} placeholder="Short synopsis or logline..." required autoFocus />
              </div>
              <div className="form-group">
                <label htmlFor="series-description">Description <span className="required-mark">*</span></label>
                <textarea id="series-description" className="form-control" value={form.description} onChange={(event) => updateForm("description", event.target.value)} placeholder="Longer premise and production notes..." required />
              </div>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="wizard-panel wizard-review-grid">
              <div className="form-group">
                <label>Cover image</label>
                <label className="upload-box series-cover-upload-inline">
                  {coverPreview ? <img src={coverPreview} alt="Cover preview" /> : <span>Choose cover image</span>}
                  <input type="file" accept="image/*" data-testid="series-cover-input" onChange={handleCoverChange} />
                </label>
                {coverFile && <div className="upload-selected-row"><span>{coverFile.name}</span><button type="button" className="btn btn-small" onClick={clearCover}>Remove</button></div>}
              </div>
              <div className="wizard-summary-card">
                <p className="eyebrow">Review before creation</p>
                <h3>{form.title || "Untitled series"}</h3>
                <p><strong>Genre:</strong> {form.genre || "-"}</p>
                <p>{form.summary || "No summary"}</p>
                <small>{form.description || "No description"}</small>
              </div>
            </div>
          )}

          <div className="wizard-actions">
            <button type="button" className="btn" disabled={wizardStep === 1 || saving} onClick={() => goToWizardStep(wizardStep - 1)}>Back</button>
            {wizardStep < 3 ? (
              <button key="wizard-continue" type="button" className="btn-publish" data-testid="series-wizard-continue" onClick={(event) => { event.preventDefault(); goToWizardStep(wizardStep + 1); }}>Continue</button>
            ) : (
              <button key="wizard-create" type="submit" className="btn-publish create-series-submit" data-testid="series-create-submit" disabled={saving}>{saving ? "Creating..." : "Create series"}</button>
            )}
          </div>
        </form>
      )}

      {!displaySeries.length ? (
        <EmptyState icon="◇" title="No series loaded" body="No series are available for this account." />
      ) : (
        <div className="series-groups">
          {Object.entries(grouped).map(([group, items]) => (
            <div className="stack" key={group}>
              <h3 className="group-title">{group}</h3>
              <div className="series-grid">
                {items.map((item) => <SeriesCard key={item.id} series={item} canDelete={canDelete} canEdit={canCreate} onDelete={requestDeleteSeries} onOpen={openSeries} onEdit={openEditSeries} />)}
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
      <EditSeriesModal
        series={editingSeries}
        form={editForm}
        coverPreview={editCoverPreview}
        busy={editSaving}
        onChange={(field, value) => setEditForm((old) => ({ ...old, [field]: value }))}
        onCoverChange={handleEditCoverChange}
        onCancel={closeEditSeries}
        onSubmit={saveSeriesProfile}
      />
    </section>
  );
}

function SeriesCard({ series, canDelete, canEdit, onDelete, onOpen, onEdit }) {
  const cover = mediaUrlFrom(series, series.coverImageUrl, series.cover_image_url, series.coverUrl, series.cover_url, series.imageUrl, series.image_url, series.thumbnailUrl, series.thumbnail_url);
  return (
    <div className="list-card series-card series-card-with-actions" data-testid={`series-card-${series.id}`}>
      <button className="series-card-main" onClick={() => onOpen(series)}>
        <div className="list-card-img series-cover">
          {cover ? <img src={cover} alt={series.title} /> : <span>{(series.title || "M").slice(0, 1).toUpperCase()}</span>}
        </div>
        <div className="list-card-content series-body">
          <div className="row-between"><div className="list-card-title">{series.title}</div><StatusBadge value={series.status} /></div>
          <p>{series.summary || series.description || "No summary provided."}</p>
          <small>{series.genre || "Unknown genre"} {series.mangakaName ? `• ${series.mangakaName}` : ""}</small>
        </div>
      </button>
      {(canDelete || canEdit) && (
        <div className="list-card-actions series-card-actions">
          <button className="btn btn-small" onClick={() => onOpen(series)}>Open</button>
          {canDelete && <button className="btn btn-small btn-danger" onClick={() => onDelete(series)}>Delete</button>}
          {canEdit && <button className="btn btn-small edit-manga-profile-button" data-testid={`edit-manga-profile-${series.id}`} onClick={() => onEdit(series)}>Edit Manga Profile</button>}
        </div>
      )}
    </div>
  );
}

function EditSeriesModal({ series, form, coverPreview, busy, onChange, onCoverChange, onCancel, onSubmit }) {
  if (!series) return null;
  const customGenre = form.genre && !GENRES.includes(form.genre) ? form.genre : "";

  return (
    <div className="feature-modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <form className="feature-modal-card edit-series-modal" role="dialog" aria-modal="true" aria-labelledby="edit-series-title" onMouseDown={(event) => event.stopPropagation()} onSubmit={onSubmit}>
        <div>
          <p className="eyebrow">Manga series profile</p>
          <h3 id="edit-series-title">Edit Manga Profile</h3>
        </div>
        <div className="edit-series-form-grid">
          <label className="form-group">Title
            <input className="form-control" data-testid="edit-series-title-input" value={form.title} onChange={(event) => onChange("title", event.target.value)} required />
          </label>
          <label className="form-group">Genre
            <select className="form-control" data-testid="edit-series-genre-input" value={form.genre} onChange={(event) => onChange("genre", event.target.value)} required>
              <option value="">Select genre</option>
              {customGenre && <option value={customGenre}>{customGenre}</option>}
              {GENRES.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
            </select>
          </label>
        </div>
        <label className="form-group">Summary
          <textarea className="form-control" data-testid="edit-series-summary-input" rows="3" value={form.summary} onChange={(event) => onChange("summary", event.target.value)} />
        </label>
        <label className="form-group">Description
          <textarea className="form-control" data-testid="edit-series-description-input" rows="5" value={form.description} onChange={(event) => onChange("description", event.target.value)} />
        </label>
        <div className="form-group">
          <label>Cover image</label>
          <label className="edit-series-cover-picker">
            {coverPreview ? <img src={coverPreview} alt={`${form.title || "Series"} cover preview`} /> : <span>Choose a new cover image</span>}
            <input type="file" accept="image/*" data-testid="edit-series-cover-input" onChange={onCoverChange} />
          </label>
          <small>Choose a file only when you want to replace the current cover.</small>
        </div>
        <div className="button-row modal-actions">
          <button className="btn" type="button" disabled={busy} onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" data-testid="save-manga-profile" type="submit" disabled={busy}>{busy ? "Saving..." : "Save Manga Profile"}</button>
        </div>
      </form>
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
