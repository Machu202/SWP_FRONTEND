import { useEffect, useMemo, useState } from "react";
import { api, extractMediaUrl, hasRole, resolveMediaUrl } from "../api/client";
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
      const created = await api.chapters.create({
        seriesId: Number(seriesId),
        chapterNumber: Number(chapterForm.chapterNumber),
        title: chapterForm.title
      });
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
    try {
      await api.chapterScripts.save(selectedChapterId, script);
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
  if (!series) return <EmptyState title="Series not found" body="The backend did not return this series." />;

  const cover = resolveMediaUrl(series.coverImageUrl || series.coverUrl || series.imageUrl || series.thumbnailUrl);

  return (
    <section className="stack">
      <button className="btn btn-ghost fit" onClick={() => navigate("/series")}>← Back to series</button>
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>

      <div className="detail-hero">
        <div className="detail-cover">{cover ? <img src={cover} alt={series.title} /> : <span>{series.title?.slice(0, 1)}</span>}</div>
        <div>
          <p className="eyebrow">Series #{series.id}</p>
          <h2>{series.title}</h2>
          <p>{series.description || series.summary || "No description."}</p>
          <div className="meta-row">
            <StatusBadge value={series.status} />
            <span>{series.genre || "Unknown genre"}</span>
            <span>Mangaka: {series.mangakaName || series.mangakaUsername || series.mangakaEmail || "Unknown"}</span>
            <span>Tantou: {series.tantouName || "Unassigned"}</span>
          </div>
          {canEdit && (
            <div className="button-row">
              <button className="btn" onClick={() => setSeriesStatus("REVIEWING")}>Send to review</button>
              <button className="btn" onClick={() => setSeriesStatus("DRAFT")}>Back to draft</button>
            </div>
          )}
        </div>
      </div>

      <div className="grid two uneven">
        <div className="card stack">
          <div className="card-header">
            <h3>Chapters</h3>
            <StatusBadge value={`${chapters.length} total`} />
          </div>

          {canEdit && (
            <form className="inline-form" onSubmit={createChapter}>
              <input type="number" min="1" placeholder="No." value={chapterForm.chapterNumber} onChange={(event) => setChapterForm({ ...chapterForm, chapterNumber: event.target.value })} />
              <input placeholder="Chapter title" value={chapterForm.title} onChange={(event) => setChapterForm({ ...chapterForm, title: event.target.value })} />
              <button className="btn btn-primary" disabled={!chapterForm.chapterNumber || !chapterForm.title}>Create</button>
            </form>
          )}

          {chapters.length ? (
            <div className="list">
              {chapters.map((chapter) => (
                <button key={chapter.id} className={String(selectedChapterId) === String(chapter.id) ? "list-row interactive active" : "list-row interactive"} onClick={() => setSelectedChapterId(String(chapter.id))}>
                  <div>
                    <strong>Chapter {chapter.chapterNumber}: {chapter.title}</strong>
                    <small>{chapter.seriesTitle}</small>
                  </div>
                  <StatusBadge value={chapter.publishStatus} />
                </button>
              ))}
            </div>
          ) : <EmptyState title="No chapters yet" body="Create a chapter before uploading pages or drawing task boxes." />}
        </div>

        <div className="card stack">
          <div className="card-header">
            <h3>{selectedChapter ? `Chapter ${selectedChapter.chapterNumber} workspace` : "Chapter workspace"}</h3>
            {selectedChapterId && canEdit && <label className="btn btn-primary file-button">{uploading ? "Uploading..." : "Upload pages"}<input type="file" accept="image/*" multiple onChange={uploadPages} disabled={uploading} /></label>}
          </div>

          {selectedChapterId ? (
            <>
              <div className="script-box">
                <label>
                  Chapter script / notes
                  <textarea value={script} onChange={(event) => setScript(event.target.value)} rows="5" placeholder="Write chapter script or instructions here." />
                </label>
                <button className="btn" onClick={saveScript}>Save script</button>
              </div>

              {pages.length ? (
                <div className="page-grid">
                  {pages.map((page) => {
                    const url = resolveMediaUrl(page.imageUrl || extractMediaUrl(page));
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
              ) : <EmptyState title="No pages uploaded" body="Upload manga page images to use the canvas, hitboxes, and task assignment flow." />}
            </>
          ) : <EmptyState title="Select a chapter" body="Choose or create a chapter first." />}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Series tasks</h3>
          <button className="btn btn-small" onClick={() => navigate("/tasks")}>Open Kanban</button>
        </div>
        {tasks.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Description</th><th>Page</th><th>Assistant</th><th>Status</th></tr></thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id}>
                    <td>{task.id}</td>
                    <td>{task.description}</td>
                    <td>{task.pageNumber || "-"}</td>
                    <td>{task.assistantName || "Unassigned"}</td>
                    <td><StatusBadge value={task.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState title="No tasks for this series" body="Open a page canvas and draw hitboxes to create tasks." />}
      </div>
    </section>
  );
}
