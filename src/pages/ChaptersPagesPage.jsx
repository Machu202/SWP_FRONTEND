import { useEffect, useMemo, useState } from "react";
import { api, extractMediaUrl, hasRole, resolveMediaUrl } from "../api/client";
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
  return resolveMediaUrl(page?.imageUrl || page?.image_url || extractMediaUrl(page));
}

function seriesCover(series) {
  return resolveMediaUrl(series?.coverImageUrl || series?.cover_image_url || series?.coverUrl || series?.imageUrl || series?.thumbnailUrl);
}

export default function ChaptersPagesPage({ initialSeriesId = "" }) {
  const { profile, session } = useAuth();
  const role = profile?.roleName || session.role;
  const canEdit = hasRole(role, ["mangaka"]);

  const [seriesList, setSeriesList] = useState([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState(String(initialSeriesId || ""));
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [series, setSeries] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [pages, setPages] = useState([]);
  const [chapterForm, setChapterForm] = useState({ chapterNumber: "", title: "" });
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedChapter = useMemo(
    () => chapters.find((chapter) => String(chapter.id) === String(selectedChapterId)),
    [chapters, selectedChapterId]
  );

  async function loadSeriesList() {
    setLoading(true);
    setError("");
    try {
      const data = canEdit ? await api.series.mine() : await api.series.list();
      const list = data || [];
      setSeriesList(list);
      const nextSeriesId = String(selectedSeriesId || initialSeriesId || list[0]?.id || "");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeriesId]);

  useEffect(() => {
    loadPages(selectedChapterId);
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
    setUploading(true);
    setError("");
    setMessage("");
    try {
      const currentMax = pages.reduce((max, page) => Math.max(max, Number(pageNumber(page) || 0)), 0);
      for (let index = 0; index < files.length; index += 1) {
        await api.pages.upload(selectedChapterId, currentMax + index + 1, files[index]);
      }
      setMessage(`Uploaded ${files.length} page(s).`);
      await loadPages(selectedChapterId);
    } catch (err) {
      setError(err.message || "Page upload failed.");
    } finally {
      event.target.value = "";
      setUploading(false);
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
          <h1>Chapter Manager &amp; Page Upload</h1>
          <p>Create chapters and upload manga pages through the backend page API.</p>
        </div>
        <button className="btn-publish" onClick={refreshAll}>↻ Refresh</button>
      </div>

      {selectedSeriesId && series && (
        <div className="detail-hero chapter-series-hero">
          <div className="detail-cover">{cover ? <img src={cover} alt={series.title} /> : <span>{String(series.title || "M").slice(0, 1)}</span>}</div>
          <div>
            <p className="eyebrow">Series #{series.id}</p>
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
            <select className="form-control" value={selectedSeriesId} onChange={(event) => setSelectedSeriesId(event.target.value)}>
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
                  <input className="form-control" type="number" min="1" required value={chapterForm.chapterNumber} onChange={(event) => setChapterForm({ ...chapterForm, chapterNumber: event.target.value })} />
                </div>
                <div className="form-group">
                  <label>Chapter Title</label>
                  <input className="form-control" placeholder="Chapter title" value={chapterForm.title} onChange={(event) => setChapterForm({ ...chapterForm, title: event.target.value })} />
                </div>
              </div>
              <button className="btn-publish" type="submit" disabled={!selectedSeriesId}>＋ Create Chapter</button>
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
                  <input type="file" accept="image/*" multiple onChange={uploadPages} disabled={!selectedChapterId || uploading || !canEdit} />
                </label>
              </div>
            </div>
          </div>
          <div className="upload-log">{selectedChapterId ? `${pages.length} page(s) currently uploaded for this chapter.` : "Choose a chapter before uploading pages."}</div>
        </div>
      </div>

      <div className="feature-grid two-cols chapter-manager-grid">
        <div className="card-box stack">
          <div className="section-title-row"><h3>Chapters</h3><span className="schedule-count">{chapters.length}</span></div>
          {chapters.length ? (
            <div className="list chapter-list-static">
              {chapters.map((chapter) => (
                <button key={chapter.id} className={String(selectedChapterId) === String(chapter.id) ? "list-row interactive active" : "list-row interactive"} onClick={() => setSelectedChapterId(String(chapter.id))}>
                  <div><strong>Chapter {chapterNumber(chapter)}: {chapterTitle(chapter)}</strong><small>{series?.title || chapter.seriesTitle || ""}</small></div>
                  <StatusBadge value={chapter.publishStatus || chapter.publish_status || "DRAFT"} />
                </button>
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
                    <div key={page.id} className="page-card">
                      <button onClick={() => navigate(`/canvas-workspace?seriesId=${selectedSeriesId}&chapterId=${selectedChapterId}&pageId=${page.id}`)}>
                        {url ? <img src={url} alt={`Page ${pageNumber(page)}`} /> : <span>No image</span>}
                      </button>
                      <div className="page-card-footer">
                        <strong>Page {pageNumber(page)}</strong>
                        <button className="btn btn-small" onClick={() => navigate(`/canvas-workspace?seriesId=${selectedSeriesId}&chapterId=${selectedChapterId}&pageId=${page.id}`)}>Open canvas</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <EmptyState icon="▧" title="No pages uploaded" body="Upload manga page images, then open Canvas Workspace." />
          ) : <EmptyState icon="▧" title="Choose a chapter" body="Select a chapter from the list to view uploaded pages." />}
        </div>
      </div>
    </section>
  );
}
