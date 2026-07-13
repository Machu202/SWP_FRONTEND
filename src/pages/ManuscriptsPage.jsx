import { useEffect, useMemo, useState } from "react";
import { api, extractMediaUrl, hasRole, mediaUrlFrom } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { navigate } from "../utils/router";
import { Alert, EmptyState, LoadingBlock, StatusBadge } from "../components/Status";
import ScriptEditor from "../components/ScriptEditor";

function chapterNumber(chapter) {
  return chapter?.chapterNumber ?? chapter?.chapter_number ?? chapter?.number ?? chapter?.id;
}

function chapterTitle(chapter) {
  return chapter?.title || `Chapter ${chapterNumber(chapter) || ""}`.trim();
}

function pageNumber(page) {
  return page?.pageNumber ?? page?.page_number ?? page?.number ?? page?.id;
}

function pageImage(page) {
  return mediaUrlFrom(page, page?.imageUrl, page?.image_url);
}

export default function ManuscriptsPage({ initialSeriesId = "" }) {
  const { profile, session } = useAuth();
  const role = profile?.roleName || session.role;
  const canEdit = hasRole(role, ["mangaka"]);

  const [seriesList, setSeriesList] = useState([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState(String(initialSeriesId || ""));
  const [chapters, setChapters] = useState([]);
  const [pagesByChapter, setPagesByChapter] = useState({});
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [selectedPageId, setSelectedPageId] = useState("");
  const [script, setScript] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingChapters, setLoadingChapters] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedSeries = useMemo(
    () => seriesList.find((item) => String(item.id) === String(selectedSeriesId)),
    [seriesList, selectedSeriesId]
  );
  const selectedChapter = useMemo(
    () => chapters.find((chapter) => String(chapter.id) === String(selectedChapterId)),
    [chapters, selectedChapterId]
  );
  const selectedPages = selectedChapterId ? (pagesByChapter[selectedChapterId] || []) : [];
  const selectedPage = selectedPages.find((page) => String(page.id) === String(selectedPageId)) || selectedPages[0] || null;

  async function loadSeriesList() {
    setLoading(true);
    setError("");
    try {
      const data = canEdit ? await api.series.mine() : await api.series.list();
      const list = data || [];
      setSeriesList(list);
      setSelectedSeriesId(String(selectedSeriesId || initialSeriesId || list[0]?.id || ""));
    } catch (err) {
      setError(err.message || "Could not load series.");
    } finally {
      setLoading(false);
    }
  }

  async function loadChapters(seriesId) {
    if (!seriesId) {
      setChapters([]);
      setPagesByChapter({});
      setSelectedChapterId("");
      setScript("");
      return;
    }
    setLoadingChapters(true);
    setError("");
    try {
      const chapterData = await api.chapters.bySeries(seriesId).catch(() => []);
      const chapterList = chapterData || [];
      setChapters(chapterList);
      const pageEntries = await Promise.all(
        chapterList.map(async (chapter) => [String(chapter.id), await api.pages.byChapter(chapter.id).catch(() => [])])
      );
      setPagesByChapter(Object.fromEntries(pageEntries));
      const nextChapterId = String(chapterList.find((chapter) => String(chapter.id) === String(selectedChapterId))?.id || chapterList[0]?.id || "");
      setSelectedChapterId(nextChapterId);
    } catch (err) {
      setError(err.message || "Could not load manuscripts.");
    } finally {
      setLoadingChapters(false);
    }
  }

  async function loadScript(chapterId) {
    if (!chapterId) {
      setScript("");
      return;
    }
    setError("");
    try {
      const scriptData = await api.chapterScripts.get(chapterId).catch(() => null);
      setScript(scriptData?.content || scriptData?.script || scriptData?.text || (typeof scriptData === "string" ? scriptData : ""));
    } catch (err) {
      setError(err.message || "Could not load chapter script.");
    }
  }

  useEffect(() => {
    loadSeriesList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit]);

  useEffect(() => {
    loadChapters(selectedSeriesId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeriesId]);

  useEffect(() => {
    loadScript(selectedChapterId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChapterId]);

  useEffect(() => {
    setSelectedPageId((current) => String(selectedPages.find((page) => String(page.id) === String(current))?.id || selectedPages[0]?.id || ""));
  }, [selectedChapterId, pagesByChapter]);

  async function saveScript() {
    if (!selectedChapterId) return;
    setSaving(true);
    setError("");
    setMessage("");
    const cleanedScript = String(script || "").trim();
    if (!cleanedScript) {
      setSaving(false);
      setError("Write chapter script / notes before saving. The backend rejects empty request bodies.");
      return;
    }
    try {
      const saved = await api.chapterScripts.save(selectedChapterId, cleanedScript);
      setScript(saved?.content || cleanedScript);
      setMessage("Chapter script saved.");
    } catch (err) {
      setError(err.message || "Could not save chapter script.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingBlock label="Loading manuscripts..." />;

  return (
    <section className="core-feature-page manuscripts-screen static-tab-screen stack">
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>

      <div className="feature-header static-feature-header">
        <div>
          <h1>Manuscripts</h1>
          <p>Browse chapters, page files, and chapter scripts from backend data.</p>
        </div>
        <button className="btn-outline" onClick={() => navigate("/chapters-pages")}>Manage Chapters</button>
      </div>

      <div className="toolbar-row manuscript-toolbar">
        <select className="form-control" value={selectedSeriesId} onChange={(event) => setSelectedSeriesId(event.target.value)}>
          <option value="">Choose series</option>
          {seriesList.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
        <button className="btn" onClick={() => selectedSeriesId && loadChapters(selectedSeriesId)} disabled={!selectedSeriesId || loadingChapters}>↻ Refresh</button>
      </div>

      {selectedSeries && (
        <div className="card-box manuscript-series-bar">
          <div>
            <p className="eyebrow">Selected Series</p>
            <h3>{selectedSeries.title}</h3>
            <p>{selectedSeries.summary || selectedSeries.description || "No summary provided."}</p>
          </div>
          <StatusBadge value={selectedSeries.status || "DRAFT"} />
        </div>
      )}

      <div className="manuscript-grid">
        <div className="card-box manuscript-tree-card">
          <div className="section-title-row"><h3>Chapter Tree</h3><span className="schedule-count">{chapters.length}</span></div>
          {chapters.length ? (
            <div className="manuscript-tree">
              {chapters.map((chapter) => {
                const chapterPages = pagesByChapter[String(chapter.id)] || [];
                const active = String(selectedChapterId) === String(chapter.id);
                return (
                  <div key={chapter.id} className="tree-chapter-block">
                    <button className={active ? "tree-chapter-header active" : "tree-chapter-header"} onClick={() => setSelectedChapterId(String(chapter.id))}>
                      <span>▾ Chapter {chapterNumber(chapter)}: {chapterTitle(chapter)}</span>
                      <span className="chapter-page-count">{chapterPages.length} pages</span>
                    </button>
                    {active && (
                      <div className="tree-page-list">
                        {chapterPages.length ? chapterPages.map((page) => (
                          <button key={page.id} className={String(selectedPageId) === String(page.id) ? "tree-page-item active" : "tree-page-item"} onClick={() => { setSelectedChapterId(String(chapter.id)); setSelectedPageId(String(page.id)); }}>
                            <span>Page {pageNumber(page)}</span>
                            <span>Preview</span>
                          </button>
                        )) : <div className="tree-page-empty">No pages uploaded for this chapter.</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : <EmptyState icon="✎" title="No manuscripts loaded" body="Select a series with chapters to browse manuscript content." />}
        </div>

        <div className="card-box manuscript-reader-card stack">
          <div className="section-title-row"><h3>{selectedChapter ? `Chapter ${chapterNumber(selectedChapter)} Script` : "Chapter Script"}</h3>{selectedChapter && <StatusBadge value={selectedChapter.publishStatus || selectedChapter.publish_status || "DRAFT"} />}</div>
          {selectedChapter ? (
            <>
              <div className="manuscript-split-review">
                <div className="manuscript-script-pane">
                  <ScriptEditor value={script} onChange={setScript} placeholder="Write chapter script or instructions here." disabled={!canEdit} />
                </div>
                <div className="manuscript-image-pane">
                  {selectedPage && pageImage(selectedPage) ? <img src={pageImage(selectedPage)} alt={`Page ${pageNumber(selectedPage)}`} /> : <EmptyState icon="▧" title="No selected page image" body="Choose a page from the chapter tree." />}
                  {selectedPage && <div className="button-row"><strong>Page {pageNumber(selectedPage)}</strong><button className="btn btn-small" onClick={() => navigate(`/canvas-workspace?seriesId=${selectedSeriesId}&chapterId=${selectedChapterId}&pageId=${selectedPage.id}`)}>Open Canvas</button></div>}
                </div>
              </div>
              <div className="button-row">
                <button className="btn-publish" onClick={saveScript} disabled={saving || !canEdit}>{saving ? "Saving..." : "Save Script"}</button>
                <button className="btn" onClick={() => navigate(`/chapters-pages?seriesId=${selectedSeriesId}`)}>Open Chapter Manager</button>
              </div>
              <div className="page-grid manuscript-page-preview-grid">
                {selectedPages.map((page) => {
                  const url = pageImage(page);
                  return (
                    <div className="page-card" key={page.id}>
                      <button className={String(selectedPageId) === String(page.id) ? "active" : ""} onClick={() => setSelectedPageId(String(page.id))}>{url ? <img src={url} alt={`Page ${pageNumber(page)}`} /> : <span>No image</span>}</button>
                      <div className="page-card-footer"><strong>Page {pageNumber(page)}</strong></div>
                    </div>
                  );
                })}
              </div>
              {!selectedPages.length && <EmptyState icon="▧" title="No page previews" body="Upload page images from Chapters & Pages." />}
            </>
          ) : <EmptyState icon="✎" title="Select a chapter" body="Choose a chapter from the tree to view or edit its script." />}
        </div>
      </div>
    </section>
  );
}
