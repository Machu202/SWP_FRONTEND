import { useEffect, useMemo, useState } from "react";
import { api, seriesDisplayNumber, extractMediaUrl, getWorkspaceSelection, hasRole, mediaUrlFrom, resolveMediaUrl, setWorkspaceSelection } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { navigate } from "../utils/router";
import { Alert, EmptyState, LoadingBlock, StatusBadge } from "../components/Status";

function pageNumber(page) {
  return page?.pageNumber ?? page?.page_number ?? page?.number ?? page?.id;
}

function chapterNumber(chapter) {
  return chapter?.chapterNumber ?? chapter?.chapter_number ?? chapter?.number ?? chapter?.id;
}

function chapterTitle(chapter) {
  return chapter?.title || `Chapter ${chapterNumber(chapter) || ""}`.trim();
}

function pageImage(page) {
  return mediaUrlFrom(page, page?.imageUrl, page?.image_url);
}

function seriesCover(series) {
  return mediaUrlFrom(series, series?.coverImageUrl, series?.cover_image_url, series?.coverUrl, series?.cover_url, series?.imageUrl, series?.image_url, series?.thumbnailUrl, series?.thumbnail_url);
}

function isReviewableSeries(series) {
  const status = String(series?.status || "").toUpperCase();
  return status && !["DRAFT", "ARCHIVED", "CANCELLED"].includes(status);
}

export default function ChaptersPagesPage({ initialSeriesId = "" }) {
  const { profile, session } = useAuth();
  const role = profile?.roleName || session.role;
  const canEdit = hasRole(role, ["mangaka"]);
  const isTantou = hasRole(role, ["tantou"]);

  const rememberedSelection = getWorkspaceSelection();
  const [seriesList, setSeriesList] = useState([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState(String(initialSeriesId || rememberedSelection.seriesId || ""));
  const [selectedChapterId, setSelectedChapterId] = useState(String(rememberedSelection.chapterId || ""));
  const [series, setSeries] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [pages, setPages] = useState([]);
  const [chapterForm, setChapterForm] = useState({ chapterNumber: "", title: "" });
  const [uploading, setUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const selectedChapter = useMemo(
    () => chapters.find((chapter) => String(chapter.id) === String(selectedChapterId)),
    [chapters, selectedChapterId]
  );

  async function loadSeriesList() {
    setLoading(true);
    setError("");
    try {
      const data = canEdit ? await api.series.mine() : await api.series.list();
      const rawList = data || [];
      const list = isTantou ? rawList.filter(isReviewableSeries) : rawList;
      setSeriesList(list);
      const preferredSeriesId = String(initialSeriesId || selectedSeriesId || getWorkspaceSelection().seriesId || "");
      const preferredExists = list.some((item) => String(item.id) === preferredSeriesId);
      const nextSeriesId = String(preferredExists ? preferredSeriesId : list[0]?.id || "");
      setSelectedSeriesId(nextSeriesId);
    } catch (err) {
      setError(err.message || "Could not load series.");
    } finally {
      setLoading(false);
    }
  }

  async function loadSelectedSeries(seriesId) {
    if (!seriesId) {
      setSeries(null);
      setChapters([]);
      setPages([]);
      setSelectedChapterId("");
      return;
    }
    setError("");
    try {
      const [seriesData, chapterData] = await Promise.all([
        api.series.get(seriesId).catch(() => seriesList.find((item) => String(item.id) === String(seriesId)) || null),
        api.chapters.bySeries(seriesId).catch(() => [])
      ]);
      setSeries(seriesData);
      const chapterList = chapterData || [];
      setChapters(chapterList);
      const existing = chapterList.find((chapter) => String(chapter.id) === String(selectedChapterId));
      const nextChapterId = existing ? selectedChapterId : String(chapterList[0]?.id || "");
      setSelectedChapterId(nextChapterId);
      if (!nextChapterId) setPages([]);
    } catch (err) {
      setError(err.message || "Could not load chapters.");
    }
  }

  async function loadPages(chapterId) {
    if (!chapterId) {
      setPages([]);
      return;
    }
    setError("");
    try {
      const pageData = await api.pages.byChapter(chapterId).catch(() => []);
      setPages(pageData || []);
    } catch (err) {
      setError(err.message || "Could not load pages.");
    }
  }

  useEffect(() => {
    loadSeriesList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit]);

  useEffect(() => {
    loadSelectedSeries(selectedSeriesId);
    setWorkspaceSelection({ seriesId: selectedSeriesId, chapterId: "", pageId: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeriesId]);

  useEffect(() => {
    loadPages(selectedChapterId);
    setWorkspaceSelection({ chapterId: selectedChapterId, pageId: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChapterId]);

  async function createChapter(event) {
    event.preventDefault();
    if (!selectedSeriesId) return;
    setError("");
    setMessage("");
    try {
      const created = await api.chapters.create({
        seriesId: Number(selectedSeriesId),
        chapterNumber: Number(chapterForm.chapterNumber),
        title: chapterForm.title.trim()
      });
      setMessage(`Created chapter ${chapterNumber(created) || chapterForm.chapterNumber}.`);
      setChapterForm({ chapterNumber: "", title: "" });
      await loadSelectedSeries(selectedSeriesId);
      setSelectedChapterId(String(created.id));
    } catch (err) {
      setError(err.message || "Could not create chapter.");
    }
  }

  async function uploadPages(event) {
    const files = Array.from(event.target.files || []);
    if (!selectedChapterId || !files.length) return;

    const invalid = files.filter((file) => !String(file.type || "").startsWith("image/"));
    if (invalid.length) {
      setError(`Only image files are allowed. Remove: ${invalid.map((file) => file.name).join(", ")}`);
      event.target.value = "";
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");
    const currentMax = pages.reduce((max, page) => Math.max(max, Number(pageNumber(page) || 0)), 0);
    const initialQueue = files.map((file, index) => ({
      id: `${file.name}-${file.lastModified}-${index}`,
      name: file.name,
      pageNumber: currentMax + index + 1,
      status: "queued",
      error: ""
    }));
    setUploadQueue(initialQueue);

    let successCount = 0;
    const failures = [];
    for (let index = 0; index < files.length; index += 1) {
      const queueId = initialQueue[index].id;
      setUploadQueue((items) => items.map((item) => item.id === queueId ? { ...item, status: "uploading" } : item));
      try {
        await api.pages.upload(selectedChapterId, currentMax + index + 1, files[index]);
        successCount += 1;
        setUploadQueue((items) => items.map((item) => item.id === queueId ? { ...item, status: "complete" } : item));
      } catch (err) {
        const reason = err.message || "Upload failed";
        failures.push(`${files[index].name}: ${reason}`);
        setUploadQueue((items) => items.map((item) => item.id === queueId ? { ...item, status: "failed", error: reason } : item));
      }
    }

    if (successCount) {
      setMessage(`Uploaded ${successCount} of ${files.length} page(s).`);
      await loadPages(selectedChapterId);
    }
    if (failures.length) setError(`${failures.length} upload(s) failed. ${failures.join(" | ")}`);
    event.target.value = "";
    setUploading(false);
  }

  function requestDeleteChapter(chapter) {
    if (!chapter?.id || !canEdit) return;
    setPendingDelete({ kind: "chapter", item: chapter, name: `Chapter ${chapterNumber(chapter)}: ${chapterTitle(chapter)}` });
  }

  function requestDeletePage(page) {
    if (!page?.id || !canEdit) return;
    setPendingDelete({ kind: "page", item: page, name: `Page ${pageNumber(page)}` });
  }

  async function confirmDelete() {
    if (!pendingDelete?.item?.id || deleting) return;

    const { kind, item, name } = pendingDelete;
    setDeleting(true);
    setError("");
    setMessage("");
    try {
      if (kind === "chapter") {
        await api.chapters.remove(item.id);
        setMessage(`Deleted ${name}.`);
        if (String(selectedChapterId) === String(item.id)) {
          setSelectedChapterId("");
          setPages([]);
        }
        await loadSelectedSeries(selectedSeriesId);
      } else if (kind === "page") {
        await api.pages.remove(item.id);
        setMessage(`Deleted ${name}.`);
        await loadPages(selectedChapterId);
      }
      setPendingDelete(null);
    } catch (err) {
      setError(err.message || `Could not delete ${kind || "item"}.`);
    } finally {
      setDeleting(false);
    }
  }

  async function refreshAll() {
    await loadSeriesList();
    if (selectedSeriesId) await loadSelectedSeries(selectedSeriesId);
    if (selectedChapterId) await loadPages(selectedChapterId);
  }

  if (loading) return <LoadingBlock label="Loading chapter manager..." />;

  const cover = seriesCover(series);

  return (
    <section className="core-feature-page chapter-manager-screen static-tab-screen stack">
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>

      <div className="feature-header static-feature-header">
        <div>
          <h1>{canEdit ? "Chapter Manager & Page Upload" : "Chapter & Page Review Browser"}</h1>
          <p>{canEdit ? "Create chapters and upload manga pages through the backend page API." : "View assigned/reviewable chapters and open the Tantou review workflow without Mangaka upload controls."}</p>
        </div>
        <button className="btn-publish" onClick={refreshAll}>↻ Refresh</button>
      </div>

      {selectedSeriesId && series && (
        <div className="detail-hero chapter-series-hero">
          <div className="detail-cover">{cover ? <img src={cover} alt={series.title} /> : <span>{String(series.title || "M").slice(0, 1)}</span>}</div>
          <div>
            <p className="eyebrow">Series #{seriesDisplayNumber(series)}</p>
            <h2>{series.title}</h2>
            <p>{series.summary || series.description || "No summary provided."}</p>
            <div className="meta-row">
              <StatusBadge value={series.status} />
              <span>{series.genre || "No genre"}</span>
              <span>Tantou: {series.tantouName || series.tantouUsername || "Unassigned"}</span>
            </div>
          </div>
        </div>
      )}

      <div className="feature-grid two-cols chapter-manager-grid">
        <div className="card-box">
          <h3>Select Series</h3>
          <div className="form-group">
            <label>Manga Series</label>
            <select className="form-control" data-testid="chapter-series-select" value={selectedSeriesId} onChange={(event) => setSelectedSeriesId(event.target.value)}>
              <option value="">Choose series</option>
              {seriesList.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </div>

          {canEdit && (
            <form className="feature-form" onSubmit={createChapter}>
              <h3>Create New Chapter</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Chapter Number</label>
                  <input className="form-control" data-testid="chapter-number-input" type="number" min="1" required value={chapterForm.chapterNumber} onChange={(event) => setChapterForm({ ...chapterForm, chapterNumber: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Chapter Title</label>
                  <input className="form-control" data-testid="chapter-title-input" placeholder="Chapter title" value={chapterForm.title} onChange={(event) => setChapterForm({ ...chapterForm, title: event.target.value })} />
                </div>
              </div>
              <button className="btn-publish" data-testid="chapter-create-submit" type="submit" disabled={!selectedSeriesId}>＋ Create Chapter</button>
            </form>
          )}
        </div>

        <div className="card-box">
          {canEdit ? (
            <>
              <h3>Upload Pages</h3>
              <div className="feature-form">
                <div className="form-group">
                  <label>Chapter</label>
                  <select className="form-control" data-testid="page-chapter-select" value={selectedChapterId} onChange={(event) => setSelectedChapterId(event.target.value)}>
                    <option value="">Choose chapter</option>
                    {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>Chapter {chapterNumber(chapter)}: {chapterTitle(chapter)}</option>)}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Start Page Number</label>
                    <input className="form-control" type="number" min="1" value={(pages.reduce((max, page) => Math.max(max, Number(pageNumber(page) || 0)), 0) || 0) + 1} readOnly />
                  </div>
                  <div className="form-group">
                    <label>Image Files</label>
                    <label className="form-control file-button">
                      {uploading ? "Uploading..." : "Choose images"}
                      <input type="file" accept="image/*" multiple data-testid="page-upload-input" onChange={uploadPages} disabled={!selectedChapterId || uploading} />
                    </label>
                  </div>
                </div>
              </div>
              <div className="upload-log">{selectedChapterId ? `${pages.length} page(s) currently uploaded for this chapter.` : "Choose a chapter before uploading pages."}</div>
              {uploadQueue.length > 0 && (
                <div className="batch-upload-queue" aria-live="polite">
                  <div className="section-title-row"><strong>Batch upload queue</strong><span>{uploadQueue.filter((item) => item.status === "complete").length}/{uploadQueue.length}</span></div>
                  {uploadQueue.map((item) => (
                    <div className={`batch-upload-item upload-${item.status}`} key={item.id}>
                      <span className="batch-upload-name">Page {item.pageNumber} · {item.name}</span>
                      <strong>{item.status === "uploading" ? "Uploading…" : item.status}</strong>
                      {item.error && <small>{item.error}</small>}
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <h3>Review Mode</h3>
              <p className="review-helper">This role can view uploaded pages, but chapter creation and page upload are reserved for Mangaka.</p>
              <div className="feature-form">
                <div className="form-group">
                  <label>Chapter</label>
                  <select className="form-control" value={selectedChapterId} onChange={(event) => setSelectedChapterId(event.target.value)}>
                    <option value="">Choose chapter</option>
                    {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>Chapter {chapterNumber(chapter)}: {chapterTitle(chapter)}</option>)}
                  </select>
                </div>
                {isTantou && <button className="btn-publish" type="button" onClick={() => navigate(`/tantou-review?seriesId=${selectedSeriesId}`)} disabled={!selectedSeriesId}>Open Tantou Review</button>}
              </div>
              <div className="upload-log">{selectedChapterId ? `${pages.length} page(s) uploaded for this chapter.` : "Choose a chapter to view pages."}</div>
            </>
          )}
        </div>
      </div>

      <div className="feature-grid two-cols chapter-manager-grid">
        <div className="card-box stack">
          <div className="section-title-row"><h3>Chapters</h3><span className="schedule-count">{chapters.length}</span></div>
          {chapters.length ? (
            <div className="list chapter-list-static">
              {chapters.map((chapter) => (
                <div key={chapter.id} className={String(selectedChapterId) === String(chapter.id) ? "list-row interactive active chapter-delete-row" : "list-row interactive chapter-delete-row"}>
                  <button className="chapter-row-main" onClick={() => setSelectedChapterId(String(chapter.id))}>
                    <div><strong>Chapter {chapterNumber(chapter)}: {chapterTitle(chapter)}</strong><small>{series?.title || chapter.seriesTitle || ""}</small></div>
                  </button>
                  <div className="chapter-row-actions">
                    <StatusBadge value={chapter.publishStatus || chapter.publish_status || "DRAFT"} />
                    {canEdit && <button className="danger-icon-btn" title="Delete chapter" onClick={() => requestDeleteChapter(chapter)}>Delete</button>}
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState icon="▧" title="No chapters yet" body="Create a chapter before uploading pages." />}
        </div>

        <div className="card-box stack">
          <div className="section-title-row"><h3>{selectedChapter ? `Chapter ${chapterNumber(selectedChapter)} Pages` : "Chapter Pages"}</h3><span className="schedule-count">{pages.length} pages</span></div>
          {selectedChapterId ? (
            pages.length ? (
              <div className="page-grid static-page-grid">
                {pages.map((page) => {
                  const url = pageImage(page);
                  return (
                    <div key={page.id} className="page-card" data-testid={`page-card-${page.id}`}>
                      <button onClick={() => navigate(`/canvas-workspace?seriesId=${selectedSeriesId}&chapterId=${selectedChapterId}&pageId=${page.id}`)}>
                        {url ? <img src={url} alt={`Page ${pageNumber(page)}`} /> : <span>No image</span>}
                      </button>
                      <div className="page-card-footer page-card-footer-actions">
                        <strong>Page {pageNumber(page)}</strong>
                        <div className="page-action-row">
                          <button className="btn btn-small" onClick={() => navigate(canEdit ? `/canvas-workspace?seriesId=${selectedSeriesId}&chapterId=${selectedChapterId}&pageId=${page.id}` : `/tantou-review?seriesId=${selectedSeriesId}&pageId=${page.id}`)}>{canEdit ? "Open canvas" : "Open review"}</button>
                          {canEdit && <button className="btn btn-small btn-danger" onClick={() => requestDeletePage(page)}>Delete</button>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <EmptyState icon="▧" title="No pages uploaded" body="Upload manga page images, then open Canvas Workspace." />
          ) : <EmptyState icon="▧" title="Choose a chapter" body="Select a chapter from the list to view uploaded pages." />}
        </div>
      </div>

      <DeleteConfirmModal
        open={Boolean(pendingDelete)}
        name={pendingDelete?.name || "this item"}
        busy={deleting}
        onCancel={() => !deleting && setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </section>
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
