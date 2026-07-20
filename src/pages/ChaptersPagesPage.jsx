import { useEffect, useMemo, useState } from "react";
import { api, seriesDisplayNumber, extractMediaUrl, hasRole, mediaUrlFrom, preferredWorkspaceSeriesId, resolveMediaUrl } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useWorkspaceSelection } from "../context/WorkspaceSelectionContext";
import { navigate, replaceRoute } from "../utils/router";
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

function normalizedStatus(value, fallback = "") {
  return String(value || fallback).trim().toUpperCase().replace(/[ -]+/g, "_");
}

function localDateTimeInputValue(date = new Date(Date.now() + 5 * 60 * 1000)) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function launchCountdown(value, now = Date.now()) {
  const target = new Date(value);
  if (!value || Number.isNaN(target.getTime())) return "";
  const remaining = target.getTime() - now;
  if (remaining <= 0) return "Publishing…";
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [days ? `${days}d` : "", `${String(hours).padStart(2, "0")}h`, `${String(minutes).padStart(2, "0")}m`, `${String(seconds).padStart(2, "0")}s`].filter(Boolean).join(" ");
}

function scheduleChapterId(schedule) {
  return schedule?.chapterId ?? schedule?.chapter_id ?? schedule?.chapter?.id ?? null;
}

export default function ChaptersPagesPage({ initialSeriesId = "" }) {
  const { profile, session } = useAuth();
  const { selection: rememberedSelection, selectSeries, updateSelection } = useWorkspaceSelection();
  const role = profile?.roleName || session.role;
  const canEdit = hasRole(role, ["mangaka"]);
  const isTantou = hasRole(role, ["tantou"]);

  const [seriesList, setSeriesList] = useState([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState(String(initialSeriesId || rememberedSelection.seriesId || ""));
  const [selectedChapterId, setSelectedChapterId] = useState(String(rememberedSelection.chapterId || ""));
  const [series, setSeries] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [pages, setPages] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [startPageNumber, setStartPageNumber] = useState(1);
  const [chapterForm, setChapterForm] = useState({ chapterNumber: "", title: "" });
  const [uploading, setUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [publishTarget, setPublishTarget] = useState(null);
  const [publishMode, setPublishMode] = useState("NOW");
  const [publishAt, setPublishAt] = useState(localDateTimeInputValue());
  const [publishingChapter, setPublishingChapter] = useState(false);
  const [countdownNow, setCountdownNow] = useState(Date.now());

  const selectedChapter = useMemo(
    () => chapters.find((chapter) => String(chapter.id) === String(selectedChapterId)),
    [chapters, selectedChapterId]
  );

  function handleSeriesChange(value) {
    const nextSeriesId = String(value || "");
    selectSeries(nextSeriesId);
    setSelectedSeriesId(nextSeriesId);
    replaceRoute(nextSeriesId ? `/chapters-pages?seriesId=${nextSeriesId}` : "/chapters-pages");
  }

  async function loadSeriesList() {
    setLoading(true);
    setError("");
    try {
      const data = canEdit ? await api.series.mine() : await api.series.list();
      const rawList = data || [];
      const list = isTantou ? rawList.filter(isReviewableSeries) : rawList;
      setSeriesList(list);
      const nextSeriesId = preferredWorkspaceSeriesId(list, {
        explicitSeriesId: initialSeriesId,
        currentSeriesId: selectedSeriesId
      });
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
      setSchedules([]);
      setStartPageNumber(1);
      setSelectedChapterId("");
      return;
    }
    setError("");
    try {
      const [seriesData, chapterData, scheduleData] = await Promise.all([
        api.series.get(seriesId).catch(() => seriesList.find((item) => String(item.id) === String(seriesId)) || null),
        api.chapters.bySeries(seriesId).catch(() => []),
        api.schedules.bySeries(seriesId).catch(() => [])
      ]);
      setSeries(seriesData);
      setSchedules(Array.isArray(scheduleData) ? scheduleData : scheduleData?.content || scheduleData?.data || []);
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
      setStartPageNumber(1);
      return;
    }
    setError("");
    try {
      const pageData = await api.pages.byChapter(chapterId).catch(() => []);
      const pageList = pageData || [];
      setPages(pageList);
      setStartPageNumber(pageList.reduce((max, page) => Math.max(max, Number(pageNumber(page) || 0)), 0) + 1);
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
    if (selectedSeriesId) updateSelection({ seriesId: selectedSeriesId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeriesId]);

  useEffect(() => {
    loadPages(selectedChapterId);
    if (selectedChapterId) updateSelection({ chapterId: selectedChapterId, pageId: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChapterId]);

  useEffect(() => {
    if (!schedules.some((schedule) => normalizedStatus(schedule.frequency) === "CHAPTER_LAUNCH")) return undefined;
    const timer = window.setInterval(() => setCountdownNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [schedules]);

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

    setError("");
    setMessage("");
    const firstPageNumber = Number(startPageNumber);
    if (!Number.isInteger(firstPageNumber) || firstPageNumber < 1) {
      setError("Start Page Number must be a positive whole number.");
      event.target.value = "";
      return;
    }
    const existingPageNumbers = new Set(pages.map((page) => Number(pageNumber(page))));
    const requestedPageNumbers = files.map((_, index) => firstPageNumber + index);
    if (requestedPageNumbers.some((number) => existingPageNumbers.has(number))) {
      setError("Page number is unique");
      event.target.value = "";
      return;
    }

    setUploading(true);
    const initialQueue = files.map((file, index) => ({
      id: `${file.name}-${file.lastModified}-${index}`,
      name: file.name,
      pageNumber: firstPageNumber + index,
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
        await api.pages.upload(selectedChapterId, firstPageNumber + index, files[index]);
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
    if (failures.length) {
      setError(failures.some((failure) => failure.includes("Page number is unique"))
        ? "Page number is unique"
        : `${failures.length} upload(s) failed. ${failures.join(" | ")}`);
    }
    event.target.value = "";
    setUploading(false);
  }

  function openChapterPublishModal(chapter) {
    if (normalizedStatus(series?.status) !== "ONGOING" || normalizedStatus(chapter?.publishStatus || chapter?.publish_status) !== "APPROVED") return;
    setPublishTarget(chapter);
    setPublishMode("NOW");
    setPublishAt(localDateTimeInputValue());
    setError("");
    setMessage("");
  }

  async function publishChapter() {
    if (!publishTarget?.id || publishingChapter) return;
    if (publishMode === "SCHEDULE" && (!publishAt || new Date(publishAt).getTime() <= Date.now())) {
      setError("Choose a future date and time for the chapter countdown.");
      return;
    }
    setPublishingChapter(true);
    setError("");
    setMessage("");
    try {
      if (publishMode === "NOW") {
        const updated = await api.chapters.status(publishTarget.id, "PUBLISHED");
        setChapters((current) => current.map((chapter) => String(chapter.id) === String(publishTarget.id)
          ? { ...chapter, ...updated, publishStatus: updated?.publishStatus || updated?.publish_status || "PUBLISHED" }
          : chapter));
        setSchedules((current) => current.filter((schedule) => String(scheduleChapterId(schedule)) !== String(publishTarget.id)));
        setMessage(`Chapter ${chapterNumber(publishTarget)} is now published.`);
      } else {
        const schedule = await api.chapters.schedulePublication(publishTarget.id, publishAt);
        const scheduledAt = schedule?.publishDate || schedule?.publish_date || publishAt;
        setChapters((current) => current.map((chapter) => String(chapter.id) === String(publishTarget.id)
          ? { ...chapter, publishStatus: "SCHEDULED" }
          : chapter));
        setSchedules((current) => [
          ...current.filter((item) => String(scheduleChapterId(item)) !== String(publishTarget.id)),
          { ...schedule, chapterId: publishTarget.id, publishDate: scheduledAt, frequency: "CHAPTER_LAUNCH" }
        ]);
        setMessage(`Chapter ${chapterNumber(publishTarget)} is scheduled for ${new Date(scheduledAt).toLocaleString()}.`);
      }
      setPublishTarget(null);
    } catch (err) {
      setError(err.message || "Could not publish this chapter.");
    } finally {
      setPublishingChapter(false);
    }
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
          <p>{canEdit ? "Create chapters and upload manga pages." : "View assigned chapters and open pages for review."}</p>
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
            <select className="form-control" data-testid="chapter-series-select" value={selectedSeriesId} onChange={(event) => handleSeriesChange(event.target.value)}>
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
                    <input className="form-control" data-testid="start-page-number-input" type="number" min="1" step="1" value={startPageNumber} onChange={(event) => setStartPageNumber(event.target.value)} />
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
              {chapters.map((chapter) => {
                const chapterStatus = normalizedStatus(chapter.publishStatus || chapter.publish_status || "DRAFT");
                const canPublish = canEdit && normalizedStatus(series?.status) === "ONGOING" && chapterStatus === "APPROVED";
                const launchSchedule = schedules.find((schedule) => normalizedStatus(schedule.frequency) === "CHAPTER_LAUNCH"
                  && String(scheduleChapterId(schedule)) === String(chapter.id));
                const launchAt = launchSchedule?.publishDate || launchSchedule?.publish_date || "";
                return (
                <div key={chapter.id} className={String(selectedChapterId) === String(chapter.id) ? "list-row interactive active chapter-delete-row" : "list-row interactive chapter-delete-row"}>
                  <button className="chapter-row-main" onClick={() => setSelectedChapterId(String(chapter.id))}>
                    <div><strong>Chapter {chapterNumber(chapter)}: {chapterTitle(chapter)}</strong><small>{series?.title || chapter.seriesTitle || ""}</small></div>
                  </button>
                  <div className="chapter-row-actions">
                    <StatusBadge value={chapter.publishStatus || chapter.publish_status || "DRAFT"} />
                    {canPublish && <button className="btn btn-small btn-primary chapter-publish-btn" data-testid={`publish-chapter-${chapter.id}`} type="button" onClick={() => openChapterPublishModal(chapter)}>Publish</button>}
                    {chapterStatus === "SCHEDULED" && launchAt ? <small className="chapter-launch-countdown" data-testid={`chapter-launch-countdown-${chapter.id}`}>Publish in {launchCountdown(launchAt, countdownNow)}</small> : null}
                    {canEdit && <button className="danger-icon-btn" title="Delete chapter" onClick={() => requestDeleteChapter(chapter)}>Delete</button>}
                  </div>
                </div>
                );
              })}
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
      {publishTarget ? (
        <div className="delete-modal-backdrop publish-modal-backdrop" role="presentation" onMouseDown={() => !publishingChapter && setPublishTarget(null)}>
          <div className="delete-modal-card publish-series-modal chapter-publish-modal" role="dialog" aria-modal="true" aria-labelledby="chapter-publish-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="publish-modal-icon">↗</div>
            <p className="eyebrow">Approved chapter</p>
            <h3 id="chapter-publish-title">Publish Chapter {chapterNumber(publishTarget)}</h3>
            <p className="publish-modal-copy">Choose whether this approved chapter should be public now or after a durable server countdown.</p>
            <div className="publish-mode-grid" role="radiogroup" aria-label="Chapter publication method">
              <button type="button" className={publishMode === "NOW" ? "publish-mode-option active" : "publish-mode-option"} role="radio" aria-checked={publishMode === "NOW"} onClick={() => setPublishMode("NOW")}>
                <strong>Publish now</strong><small>Change this chapter status to PUBLISHED immediately.</small>
              </button>
              <button type="button" className={publishMode === "SCHEDULE" ? "publish-mode-option active" : "publish-mode-option"} role="radio" aria-checked={publishMode === "SCHEDULE"} onClick={() => setPublishMode("SCHEDULE")}>
                <strong>Set a publish countdown timer</strong><small>Keep the chapter scheduled until the backend countdown reaches this time.</small>
              </button>
            </div>
            {publishMode === "SCHEDULE" ? (
              <label className="publish-date-field">Publish date and time
                <input data-testid="publish-chapter-date" type="datetime-local" min={localDateTimeInputValue()} value={publishAt} onChange={(event) => setPublishAt(event.target.value)} />
                <small>Countdown: {launchCountdown(publishAt)}</small>
              </label>
            ) : null}
            <div className="delete-modal-actions">
              <button className="btn" type="button" disabled={publishingChapter} onClick={() => setPublishTarget(null)}>Cancel</button>
              <button className="btn btn-primary" data-testid={`confirm-publish-chapter-${publishTarget.id}`} type="button" disabled={publishingChapter || (publishMode === "SCHEDULE" && !publishAt)} onClick={publishChapter}>{publishingChapter ? "Publishing..." : publishMode === "NOW" ? "Publish now" : "Set countdown"}</button>
            </div>
          </div>
        </div>
      ) : null}
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
