import { useEffect, useMemo, useRef, useState } from "react";
import { api, extractMediaUrl, hasRole, resolveMediaUrl, unwrapList } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { navigate } from "../utils/router";
import { Alert, EmptyState, LoadingBlock, StatusBadge } from "../components/Status";

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
  return resolveMediaUrl(page?.imageUrl || page?.image_url || extractMediaUrl(page));
}

function hitboxId(box) {
  return box?.id || `${box?.xCoord}-${box?.yCoord}-${box?.width}-${box?.height}`;
}

function toFiniteNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function boxValue(box, first, second, third) {
  return toFiniteNumber(box?.[first], box?.[second], third ? box?.[third] : undefined);
}

function normalizeHitbox(box = {}) {
  const id = box.id ?? box.hitboxId ?? box.hitbox_id;
  return {
    ...box,
    id,
    xCoord: toFiniteNumber(box.xCoord, box.x_coord, box.x, box.left),
    yCoord: toFiniteNumber(box.yCoord, box.y_coord, box.y, box.top),
    width: toFiniteNumber(box.width, box.w),
    height: toFiniteNumber(box.height, box.h)
  };
}

function mergeHitboxLists(...sources) {
  const map = new Map();
  sources.flatMap((source) => unwrapList(source)).forEach((box) => {
    if (!box) return;
    const normalized = normalizeHitbox(box);
    const key = normalized.id ? `id-${normalized.id}` : `${normalized.xCoord}-${normalized.yCoord}-${normalized.width}-${normalized.height}`;
    if (!map.has(key)) map.set(key, normalized);
  });
  return Array.from(map.values());
}

function canvasOriginalSize(canvas, selectedPage, imageSize) {
  return {
    width: toFiniteNumber(
      canvas?.originalWidth,
      canvas?.original_width,
      canvas?.width,
      selectedPage?.width,
      selectedPage?.imageWidth,
      selectedPage?.originalWidth,
      imageSize.width,
      1
    ),
    height: toFiniteNumber(
      canvas?.originalHeight,
      canvas?.original_height,
      canvas?.height,
      selectedPage?.height,
      selectedPage?.imageHeight,
      selectedPage?.originalHeight,
      imageSize.height,
      1
    )
  };
}

export default function CanvasWorkspacePage({ initialSeriesId = "", initialChapterId = "", initialPageId = "" }) {
  const { profile, session } = useAuth();
  const role = profile?.roleName || session.role;
  const canEdit = hasRole(role, ["mangaka"]);
  const imageRef = useRef(null);

  const [seriesList, setSeriesList] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [pages, setPages] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState(String(initialSeriesId || ""));
  const [selectedChapterId, setSelectedChapterId] = useState(String(initialChapterId || ""));
  const [selectedPageId, setSelectedPageId] = useState(String(initialPageId || ""));
  const [canvas, setCanvas] = useState(null);
  const [hitboxes, setHitboxes] = useState([]);
  const [selectedBox, setSelectedBox] = useState(null);
  const [draftBox, setDraftBox] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [taskDescription, setTaskDescription] = useState("");
  const [assistantId, setAssistantId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedSeries = useMemo(() => seriesList.find((item) => String(item.id) === String(selectedSeriesId)), [seriesList, selectedSeriesId]);
  const selectedChapter = useMemo(() => chapters.find((chapter) => String(chapter.id) === String(selectedChapterId)), [chapters, selectedChapterId]);
  const selectedPage = useMemo(() => pages.find((page) => String(page.id) === String(selectedPageId)), [pages, selectedPageId]);

  async function loadSeriesList() {
    setLoading(true);
    setError("");
    try {
      const [seriesData, assistantData] = await Promise.all([
        canEdit ? api.series.mine() : api.series.list(),
        api.users.byRole("Assistant").catch(() => [])
      ]);
      const list = seriesData || [];
      setSeriesList(list);
      setAssistants(Array.isArray(assistantData) ? assistantData : assistantData?.content || assistantData?.data || []);
      setSelectedSeriesId(String(selectedSeriesId || initialSeriesId || list[0]?.id || ""));
    } catch (err) {
      setError(err.message || "Could not load workspace data.");
    } finally {
      setLoading(false);
    }
  }

  async function loadChapters(seriesId) {
    if (!seriesId) {
      setChapters([]);
      setPages([]);
      setSelectedChapterId("");
      setSelectedPageId("");
      return;
    }
    setError("");
    try {
      const chapterData = await api.chapters.bySeries(seriesId).catch(() => []);
      const chapterList = chapterData || [];
      setChapters(chapterList);
      const currentChapter = chapterList.find((chapter) => String(chapter.id) === String(selectedChapterId));
      const queryChapter = chapterList.find((chapter) => String(chapter.id) === String(initialChapterId));
      const nextChapter = String(currentChapter?.id || queryChapter?.id || chapterList[0]?.id || "");
      setSelectedChapterId(nextChapter);
      if (!nextChapter) setPages([]);
    } catch (err) {
      setError(err.message || "Could not load chapters.");
    }
  }

  async function loadPages(chapterId) {
    if (!chapterId) {
      setPages([]);
      setSelectedPageId("");
      return;
    }
    setError("");
    try {
      const pageData = await api.pages.byChapter(chapterId).catch(() => []);
      const pageList = pageData || [];
      setPages(pageList);
      const currentPage = pageList.find((page) => String(page.id) === String(selectedPageId));
      const queryPage = pageList.find((page) => String(page.id) === String(initialPageId));
      const nextPage = String(currentPage?.id || queryPage?.id || pageList[0]?.id || "");
      setSelectedPageId(nextPage);
    } catch (err) {
      setError(err.message || "Could not load pages.");
    }
  }

  async function loadCanvas(pageId) {
    if (!pageId) {
      setCanvas(null);
      setHitboxes([]);
      setSelectedBox(null);
      return;
    }
    setError("");
    setMessage("");
    try {
      const [canvasData, hitboxData] = await Promise.all([
        api.workspace.canvasInit(pageId).catch(() => null),
        api.workspace.hitboxes(pageId).catch(() => [])
      ]);
      const fallbackImageUrl = pageImage(selectedPage);
      const fallbackWidth = selectedPage?.width || selectedPage?.imageWidth || selectedPage?.originalWidth || null;
      const fallbackHeight = selectedPage?.height || selectedPage?.imageHeight || selectedPage?.originalHeight || null;
      setCanvas({
        ...(canvasData || {}),
        imageUrl: canvasData?.imageUrl || canvasData?.image_url || fallbackImageUrl,
        originalWidth: canvasData?.originalWidth || canvasData?.original_width || fallbackWidth,
        originalHeight: canvasData?.originalHeight || canvasData?.original_height || fallbackHeight
      });
      setHitboxes(mergeHitboxLists(hitboxData, canvasData?.hitboxes));
      setSelectedBox(null);
      setImageSize({ width: 0, height: 0 });
    } catch (err) {
      setError(err.message || "Could not load canvas.");
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
    loadPages(selectedChapterId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChapterId]);

  useEffect(() => {
    loadCanvas(selectedPageId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPageId]);

  function getImageCoords(event) {
    const image = imageRef.current;
    if (!image || !canvas) return null;
    const rect = image.getBoundingClientRect();
    const displayWidth = rect.width || 1;
    const displayHeight = rect.height || 1;
    const originalWidth = toFiniteNumber(canvas.originalWidth, canvas.original_width, canvas.width, selectedPage?.width, image.naturalWidth, displayWidth);
    const originalHeight = toFiniteNumber(canvas.originalHeight, canvas.original_height, canvas.height, selectedPage?.height, image.naturalHeight, displayHeight);
    const x = Math.max(0, Math.min(originalWidth, ((event.clientX - rect.left) / displayWidth) * originalWidth));
    const y = Math.max(0, Math.min(originalHeight, ((event.clientY - rect.top) / displayHeight) * originalHeight));
    return { x, y, originalWidth, originalHeight };
  }

  function handlePointerDown(event) {
    if (!canEdit || event.target.dataset.box) return;
    const coords = getImageCoords(event);
    if (!coords) return;
    setDragStart(coords);
    setDraftBox(null);
    setSelectedBox(null);
  }

  function handlePointerMove(event) {
    if (!dragStart) return;
    const coords = getImageCoords(event);
    if (!coords) return;
    const x = Math.min(dragStart.x, coords.x);
    const y = Math.min(dragStart.y, coords.y);
    const width = Math.abs(coords.x - dragStart.x);
    const height = Math.abs(coords.y - dragStart.y);
    setDraftBox({ xCoord: x, yCoord: y, width, height });
  }

  async function handlePointerUp() {
    if (!dragStart || !draftBox) {
      setDragStart(null);
      return;
    }
    setDragStart(null);
    if (draftBox.width < 5 || draftBox.height < 5) {
      setDraftBox(null);
      return;
    }
    setError("");
    setMessage("");
    try {
      const fallbackBox = {
        id: `local-${Date.now()}`,
        xCoord: Number(draftBox.xCoord.toFixed(2)),
        yCoord: Number(draftBox.yCoord.toFixed(2)),
        width: Number(draftBox.width.toFixed(2)),
        height: Number(draftBox.height.toFixed(2))
      };
      const saved = await api.workspace.createHitbox(selectedPageId, {
        x: fallbackBox.xCoord,
        y: fallbackBox.yCoord,
        width: fallbackBox.width,
        height: fallbackBox.height
      });
      const savedBox = normalizeHitbox(saved || fallbackBox);
      setHitboxes((old) => mergeHitboxLists(old, [savedBox]));
      setSelectedBox(savedBox);
      setMessage("Hitbox created. Fill the task form to create Assistant work.");
    } catch (err) {
      setError(err.message || "Could not create hitbox.");
    } finally {
      setDraftBox(null);
    }
  }

  async function createTask(event) {
    event.preventDefault();
    if (!selectedBox?.id || !taskDescription.trim()) return;
    setError("");
    setMessage("");
    try {
      const createdTask = await api.workspace.createTask(selectedBox.id, taskDescription.trim());
      if (assistantId && createdTask?.id) await api.tasks.assign(createdTask.id, assistantId);
      setTaskDescription("");
      setMessage(assistantId ? "Task created and assigned." : "Task created. Assign an assistant from Assignments if needed.");
    } catch (err) {
      setError(err.message || "Could not create task from hitbox.");
    }
  }

  if (loading) return <LoadingBlock label="Loading canvas workspace..." />;

  const imageUrl = resolveMediaUrl(canvas?.imageUrl || canvas?.image_url || pageImage(selectedPage));
  const originalSize = canvasOriginalSize(canvas, selectedPage, imageSize);

  return (
    <section className="core-feature-page canvas-workspace-tab static-tab-screen stack">
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>

      <div className="feature-header static-feature-header">
        <div>
          <h1>Canvas Workspace</h1>
          <p>Open a manga page, draw hitboxes, and create tasks for Assistants.</p>
        </div>
        <button className="btn-outline" onClick={() => navigate("/chapters-pages")}>Manage Chapters</button>
      </div>

      <div className="toolbar-row canvas-toolbar-row">
        <select className="form-control" value={selectedSeriesId} onChange={(event) => setSelectedSeriesId(event.target.value)}>
          <option value="">Choose series</option>
          {seriesList.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
        <select className="form-control" value={selectedChapterId} onChange={(event) => setSelectedChapterId(event.target.value)} disabled={!selectedSeriesId}>
          <option value="">Choose chapter</option>
          {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>Chapter {chapterNumber(chapter)}: {chapterTitle(chapter)}</option>)}
        </select>
        <select className="form-control" value={selectedPageId} onChange={(event) => setSelectedPageId(event.target.value)} disabled={!selectedChapterId}>
          <option value="">Choose page</option>
          {pages.map((page) => <option key={page.id} value={page.id}>Page {pageNumber(page)}</option>)}
        </select>
        <button className="btn-publish" onClick={() => loadCanvas(selectedPageId)} disabled={!selectedPageId}>Load Page</button>
      </div>

      <div className="workspace-split canvas-static-split">
        <div className="card-box">
          <div className="section-title-row"><h3>Canvas</h3><span className="muted-note">{selectedPageId ? "Drag on image to draw a hitbox" : "Select a page to start"}</span></div>
          <div className="hitbox-stage canvas-hitbox-stage">
            {selectedPageId && imageUrl ? (
              <div
                className="hitbox-image-wrap"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              >
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt={`Page ${pageNumber(selectedPage) || selectedPageId}`}
                  draggable="false"
                  onLoad={(event) => {
                    setImageSize({
                      width: event.currentTarget.naturalWidth || event.currentTarget.getBoundingClientRect().width || 1,
                      height: event.currentTarget.naturalHeight || event.currentTarget.getBoundingClientRect().height || 1
                    });
                  }}
                />
                <div className="hitbox-layer-react">
                  {hitboxes.map((box, index) => <CanvasBox key={hitboxId(box)} box={box} originalSize={originalSize} active={selectedBox && String(selectedBox.id) === String(box.id)} label={index + 1} onClick={(event) => { event.stopPropagation(); setSelectedBox(box); }} />)}
                  {draftBox && <CanvasBox box={draftBox} originalSize={originalSize} draft label="New" />}
                </div>
              </div>
            ) : <EmptyState icon="□" title="Select a page to start" body="Choose a series, chapter, and page from the controls above." />}
          </div>
        </div>

        <div className="card-box hitbox-task-card">
          <h3>Create Task From Hitbox</h3>
          <form className="feature-form" onSubmit={createTask}>
            <div className="form-row">
              <div className="form-group"><label>X</label><input className="form-control" value={selectedBox ? boxValue(selectedBox, "xCoord", "x_coord").toFixed(2) : ""} readOnly /></div>
              <div className="form-group"><label>Y</label><input className="form-control" value={selectedBox ? boxValue(selectedBox, "yCoord", "y_coord").toFixed(2) : ""} readOnly /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>W</label><input className="form-control" value={selectedBox ? boxValue(selectedBox, "width", "width").toFixed(2) : ""} readOnly /></div>
              <div className="form-group"><label>H</label><input className="form-control" value={selectedBox ? boxValue(selectedBox, "height", "height").toFixed(2) : ""} readOnly /></div>
            </div>
            <div className="form-group">
              <label>Assistant</label>
              <select className="form-control" value={assistantId} onChange={(event) => setAssistantId(event.target.value)}>
                <option value="">Leave unassigned</option>
                {assistants.map((assistant) => <option key={assistant.id} value={assistant.id}>{assistant.fullName || assistant.username || assistant.email || `Assistant #${assistant.id}`}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Task Description</label><textarea className="form-control" required value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} placeholder="Describe what the Assistant must fix or draw..." /></div>
            <button className="btn-publish full" type="submit" disabled={!selectedBox?.id || !taskDescription.trim() || !canEdit}>Create Hitbox Task</button>
          </form>
          <div className="upload-log">
            {selectedSeries && <div><strong>Series:</strong> {selectedSeries.title}</div>}
            {selectedChapter && <div><strong>Chapter:</strong> {chapterTitle(selectedChapter)}</div>}
            {selectedPage && <div><strong>Page:</strong> {pageNumber(selectedPage)}</div>}
            <div><strong>Hitboxes:</strong> {hitboxes.length}</div>
          </div>
          {hitboxes.length > 0 && (
            <div className="saved-hitbox-list">
              <div className="mini-section-label">Saved hitboxes on this page</div>
              {hitboxes.map((box, index) => (
                <button
                  key={hitboxId(box)}
                  type="button"
                  className={`saved-hitbox-row ${selectedBox && String(selectedBox.id) === String(box.id) ? "active" : ""}`}
                  onClick={() => setSelectedBox(box)}
                >
                  <span>#{index + 1}</span>
                  <small>X {boxValue(box, "xCoord", "x_coord").toFixed(0)} · Y {boxValue(box, "yCoord", "y_coord").toFixed(0)}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function CanvasBox({ box, originalSize, active, draft, label, onClick }) {
  const originalWidth = Math.max(toFiniteNumber(originalSize?.width, 1), 1);
  const originalHeight = Math.max(toFiniteNumber(originalSize?.height, 1), 1);
  const x = boxValue(box, "xCoord", "x_coord", "x");
  const y = boxValue(box, "yCoord", "y_coord", "y");
  const width = boxValue(box, "width", "width", "w");
  const height = boxValue(box, "height", "height", "h");
  return (
    <button
      type="button"
      data-box="true"
      className={`${draft ? "drawn-hitbox" : "saved-hitbox"} ${active ? "active" : ""}`}
      style={{ left: `${(x / originalWidth) * 100}%`, top: `${(y / originalHeight) * 100}%`, width: `${(width / originalWidth) * 100}%`, height: `${(height / originalHeight) * 100}%` }}
      onClick={onClick}
    >
      {!draft && <span>{label}</span>}
    </button>
  );
}
