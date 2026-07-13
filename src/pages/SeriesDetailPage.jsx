import { useEffect, useMemo, useState } from "react";
import { api, extractMediaUrl, hasRole, mediaUrlFrom } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { navigate } from "../utils/router";
import { Alert, EmptyState, LoadingBlock, StatusBadge } from "../components/Status";

export default function SeriesDetailPage({ seriesId }) {
  const { profile, session } = useAuth();
  const role = profile?.roleName || session.role;
  const [series, setSeries] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [pages, setPages] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [chapterForm, setChapterForm] = useState({ chapterNumber: "", title: "" });
  const [script, setScript] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const canEdit = hasRole(role, ["mangaka"]);
  const selectedChapter = useMemo(() => chapters.find((chapter) => String(chapter.id) === String(selectedChapterId)), [chapters, selectedChapterId]);
  const currentSeriesStatus = String(series?.status || "DRAFT").trim().toUpperCase();
  const allChaptersApprovedForBoard = chapters.length > 0 && chapters.every((chapter) =>
    String(chapter.publishStatus || chapter.publish_status || "DRAFT").trim().toUpperCase() === "APPROVED"
  );
  const hasAssignedTantou = Boolean(series?.tantouId || series?.tantou_id);
  const readyForEditorialBoard = allChaptersApprovedForBoard && hasAssignedTantou;

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [seriesData, chapterData, taskData] = await Promise.all([
        api.series.get(seriesId),
        api.chapters.bySeries(seriesId).catch(() => []),
        api.tasks.bySeries(seriesId).catch(() => [])
      ]);
      setSeries(seriesData);
      setChapters(chapterData || []);
      setTasks(taskData || []);
      if (!selectedChapterId && chapterData?.length) setSelectedChapterId(String(chapterData[0].id));
    } catch (err) {
      setError(err.message || "Could not load series detail");
    } finally {
      setLoading(false);
    }
  }

  async function loadPagesAndScript(chapterId) {
    if (!chapterId) {
      setPages([]);
      setScript("");
      return;
    }
    try {
      const [pageData, scriptData] = await Promise.all([
        api.pages.byChapter(chapterId).catch(() => []),
        api.chapterScripts.get(chapterId).catch(() => null)
      ]);
      setPages(pageData || []);
      setScript(scriptData?.content || scriptData?.script || scriptData?.text || (typeof scriptData === "string" ? scriptData : ""));
    } catch (err) {
      setError(err.message || "Could not load pages");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId]);

  useEffect(() => {
    loadPagesAndScript(selectedChapterId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChapterId]);

  async function createChapter(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    try {
      const created = await api.chapters.create({ seriesId: Number(seriesId), chapterNumber: Number(chapterForm.chapterNumber), title: chapterForm.title });
      setMessage(`Created chapter ${created.chapterNumber}`);
      setChapterForm({ chapterNumber: "", title: "" });
      await load();
      setSelectedChapterId(String(created.id));
    } catch (err) {
      setError(err.message || "Could not create chapter");
    }
  }

  async function uploadPages(event) {
    const files = Array.from(event.target.files || []);
    if (!selectedChapterId || !files.length) return;
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const currentMax = pages.reduce((max, page) => Math.max(max, Number(page.pageNumber || 0)), 0);
      for (let index = 0; index < files.length; index += 1) {
        await api.pages.upload(selectedChapterId, currentMax + index + 1, files[index]);
      }
      setMessage(`Uploaded ${files.length} page(s).`);
      await loadPagesAndScript(selectedChapterId);
    } catch (err) {
      setError(err.message || "Page upload failed");
    } finally {
      event.target.value = "";
      setUploading(false);
    }
  }

  async function saveScript() {
    if (!selectedChapterId) return;
    setError("");
    setMessage("");

    const cleanedScript = String(script || "").trim();
    if (!cleanedScript) {
      setError("Write chapter script / notes before saving. The backend rejects empty request bodies.");
      return;
    }

    try {
      const saved = await api.chapterScripts.save(selectedChapterId, cleanedScript);
      setScript(saved?.content || cleanedScript);
      setMessage("Chapter script saved.");
    } catch (err) {
      setError(err.message || "Could not save script. Check backend ChapterScript endpoint.");
    }
  }

  async function setSeriesStatus(newStatus) {
    setError("");
    try {
      const updated = await api.series.status(seriesId, newStatus);
      setSeries(updated);
      setMessage(`Series status updated to ${newStatus}.`);
    } catch (err) {
      setError(err.message || "Could not update series status");
    }
  }

  if (loading) return <LoadingBlock label="Loading series detail..." />;
  if (!series) return <EmptyState icon="◇" title="Series not found" body="The backend did not return this series." />;

  const cover = mediaUrlFrom(series, series.coverImageUrl, series.cover_image_url, series.coverUrl, series.cover_url, series.imageUrl, series.image_url, series.thumbnailUrl, series.thumbnail_url);

  return (
    <section className="core-feature-page chapter-manager-screen stack">
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>

      <div className="feature-header">
        <div className="detail-hero" style={{ padding: 0, border: 0 }}>
          <div className="detail-cover">{cover ? <img src={cover} alt={series.title} /> : <span>{series.title?.slice(0, 1)}</span>}</div>
          <div>
            <p className="eyebrow">Series #{series.id}</p>
            <h1>{series.title}</h1>
            <p>{series.description || series.summary || "No description."}</p>
            <div className="meta-row">
              <StatusBadge value={series.status} />
              <span>{series.genre || "Unknown genre"}</span>
              <span>Mangaka: {series.mangakaName || series.mangakaUsername || series.mangakaEmail || "Unknown"}</span>
              <span>Tantou: {series.tantouName || "Unassigned"}</span>
            </div>
          </div>
        </div>
        <div className="button-row series-board-submit-actions">
          <button className="btn" onClick={() => navigate("/series")}>← Back</button>
          {canEdit && currentSeriesStatus === "DRAFT" ? (
            <button
              className="btn-publish"
              data-testid="series-send-review"
              disabled={!readyForEditorialBoard}
              title={readyForEditorialBoard ? "Send the Tantou-approved series to Editorial Board" : "Assign a Tantou and obtain approval for every chapter first"}
              onClick={() => setSeriesStatus("REVIEWING")}
            >
              Send approved series to Editorial Board
            </button>
          ) : null}
          {canEdit && currentSeriesStatus === "REVIEWING" ? <span className="status-pill success">Waiting for Editorial Board</span> : null}
        </div>
      </div>

      {canEdit && currentSeriesStatus === "DRAFT" && !readyForEditorialBoard ? (
        <div className="alert alert-info series-board-readiness-note">
          Editorial Board submission is locked until a Tantou Editor is assigned and every chapter is Tantou-approved.
        </div>
      ) : null}

      <div className="feature-grid two-cols">
        <div className="card-box">
          <h3>Select Series</h3>
          <div className="form-group">
            <label>Manga Series</label>
            <input className="form-control" value={series.title || ""} readOnly />
          </div>

          {canEdit && (
            <form className="feature-form" onSubmit={createChapter}>
              <h3>Create New Chapter</h3>
              <div className="form-row">
                <div className="form-group"><label>Chapter Number</label><input className="form-control" type="number" min="1" required value={chapterForm.chapterNumber} onChange={(event) => setChapterForm({ ...chapterForm, chapterNumber: event.target.value })} /></div>
                <div className="form-group"><label>Chapter Title</label><input className="form-control" placeholder="Chapter title" value={chapterForm.title} onChange={(event) => setChapterForm({ ...chapterForm, title: event.target.value })} /></div>
              </div>
              <button className="btn-publish" type="submit"><span>＋</span> Create Chapter</button>
            </form>
          )}
        </div>

        <div className="card-box">
          <h3>Upload Pages</h3>
          <div className="feature-form">
            <div className="form-group">
              <label>Chapter</label>
              <select className="form-control" value={selectedChapterId} onChange={(event) => setSelectedChapterId(event.target.value)}>
                <option value="">Choose chapter</option>
                {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>Chapter {chapter.chapterNumber}: {chapter.title}</option>)}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Start Page Number</label><input className="form-control" type="number" min="1" value={(pages.reduce((max, page) => Math.max(max, Number(page.pageNumber || 0)), 0) || 0) + 1} readOnly /></div>
              <div className="form-group"><label>Image Files</label><label className="form-control file-button">{uploading ? "Uploading..." : "Choose images"}<input type="file" accept="image/*" multiple onChange={uploadPages} disabled={!selectedChapterId || uploading || !canEdit} /></label></div>
            </div>
          </div>
          <div className="upload-log">{selectedChapterId ? `${pages.length} page(s) currently uploaded for this chapter.` : "Choose a chapter before uploading pages."}</div>
        </div>
      </div>

      <div className="feature-grid two-cols">
        <div className="card-box stack">
          <div className="section-title-row"><h3>Chapters</h3><span className="schedule-count">{chapters.length}</span></div>
          {chapters.length ? (
            <div className="list">
              {chapters.map((chapter) => (
                <button key={chapter.id} className={String(selectedChapterId) === String(chapter.id) ? "list-row interactive active" : "list-row interactive"} onClick={() => setSelectedChapterId(String(chapter.id))}>
                  <div><strong>Chapter {chapter.chapterNumber}: {chapter.title}</strong><small>{chapter.seriesTitle || series.title}</small></div>
                  <StatusBadge value={chapter.publishStatus} />
                </button>
              ))}
            </div>
          ) : <EmptyState icon="▧" title="No chapters yet" body="Create a chapter before uploading pages or drawing task boxes." />}
        </div>

        <div className="card-box stack">
          <div className="section-title-row"><h3>{selectedChapter ? `Chapter ${selectedChapter.chapterNumber} Workspace` : "Chapter Workspace"}</h3><span className="schedule-count">{pages.length} pages</span></div>
          {selectedChapterId ? (
            <>
              <div className="script-box">
                <label>Chapter Script / Notes</label>
                <textarea className="form-control" value={script} onChange={(event) => setScript(event.target.value)} rows="5" placeholder="Write chapter script or instructions here." />
                <button className="btn" onClick={saveScript}>Save Script</button>
              </div>

              {pages.length ? (
                <div className="page-grid">
                  {pages.map((page) => {
                    const url = mediaUrlFrom(page, page.imageUrl, page.image_url);
                    return (
                      <div key={page.id} className="page-card">
                        <button onClick={() => navigate(`/workspace/${page.id}?seriesId=${seriesId}&chapterId=${selectedChapterId}`)}>
                          {url ? <img src={url} alt={`Page ${page.pageNumber}`} /> : <span>No image</span>}
                        </button>
                        <div className="page-card-footer">
                          <strong>Page {page.pageNumber}</strong>
                          <button className="btn btn-small" onClick={() => navigate(`/workspace/${page.id}?seriesId=${seriesId}&chapterId=${selectedChapterId}`)}>Open canvas</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : <EmptyState icon="▧" title="No pages uploaded" body="Upload manga page images to use canvas, hitboxes, and task assignment." />}
            </>
          ) : <EmptyState icon="▧" title="Choose a chapter" body="Select a chapter from the left to view pages and scripts." />}
        </div>
      </div>

      <div className="card-box">
        <div className="section-title-row"><h3>Series Tasks</h3><button className="btn btn-small" onClick={() => navigate("/tasks")}>Open Kanban</button></div>
        {tasks.length ? (
          <div className="task-mini-list">
            {tasks.slice(0, 6).map((task) => (
              <div className="list-row" key={task.id}><div><strong>{task.description || `Task #${task.id}`}</strong><small>{task.assistantName || "Unassigned"} • Page {task.pageNumber || "?"}</small></div><StatusBadge value={task.status} /></div>
            ))}
          </div>
        ) : <EmptyState icon="☑" title="No tasks for this series" body="Create task hitboxes from an uploaded page canvas." />}
      </div>
    </section>
  );
}
