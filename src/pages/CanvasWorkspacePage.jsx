import { useEffect, useMemo, useRef, useState } from "react";
import { api, extractMediaUrl, getWorkspaceSelection, hasRole, mediaUrlFrom, resolveMediaUrl, setWorkspaceSelection, unwrapList } from "../api/client";
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

function seriesTantouId(series) {
  return series?.tantouId ?? series?.tantou_id ?? series?.tantou?.id ?? null;
}

function formatDateTime(value) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
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
  const isTantou = hasRole(role, ["tantou"]);
  const canDraw = canEdit || isTantou;
  const imageRef = useRef(null);
  const wrapRef = useRef(null);
  const rememberedSelection = getWorkspaceSelection();

  const [seriesList, setSeriesList] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [pages, setPages] = useState([]);
  const [assistants, setAssistants] = useState([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState(String(initialSeriesId || rememberedSelection.seriesId || ""));
  const [selectedChapterId, setSelectedChapterId] = useState(String(initialChapterId || rememberedSelection.chapterId || ""));
  const [selectedPageId, setSelectedPageId] = useState(String(initialPageId || rememberedSelection.pageId || ""));
  const [canvas, setCanvas] = useState(null);
  const [hitboxes, setHitboxes] = useState([]);
  const [versions, setVersions] = useState([]);
  const [versionBusy, setVersionBusy] = useState(false);
  const [compareVersionId, setCompareVersionId] = useState("");
  const [compareVersionHitboxes, setCompareVersionHitboxes] = useState([]);
  const [comparePosition, setComparePosition] = useState(50);
  const [selectedBox, setSelectedBox] = useState(null);
  const [draftBox, setDraftBox] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [isImageReady, setIsImageReady] = useState(false);
  const [taskDescription, setTaskDescription] = useState("");
  const [assistantId, setAssistantId] = useState("");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [deletingHitboxId, setDeletingHitboxId] = useState("");
  const [chapterScript, setChapterScript] = useState("");
  const [scriptSaving, setScriptSaving] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [contextComments, setContextComments] = useState([]);
  const [contextComment, setContextComment] = useState("");
  const [contextLoading, setContextLoading] = useState(false);
  const [feedbackContent, setFeedbackContent] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedSeries = useMemo(() => seriesList.find((item) => String(item.id) === String(selectedSeriesId)), [seriesList, selectedSeriesId]);
  const selectedChapter = useMemo(() => chapters.find((chapter) => String(chapter.id) === String(selectedChapterId)), [chapters, selectedChapterId]);
  const selectedPage = useMemo(() => pages.find((page) => String(page.id) === String(selectedPageId)), [pages, selectedPageId]);

  const imageUrl = mediaUrlFrom(canvas, canvas?.imageUrl, canvas?.image_url, pageImage(selectedPage));
  const compareVersion = versions.find((version) => String(version.id) === String(compareVersionId));
  const compareImageUrl = mediaUrlFrom(compareVersion, compareVersion?.imageUrl, compareVersion?.image_url);

  async function loadSeriesList() {
    setLoading(true);
    setError("");
    try {
      const [seriesData, assistantData] = await Promise.all([
        canEdit ? api.series.mine() : api.series.list({ size: 100 }),
        api.users.byRole("Assistant").catch(() => [])
      ]);
      const rawList = unwrapList(seriesData);
      const currentUserId = profile?.id || session.id;
      const list = isTantou
        ? rawList.filter((item) => String(seriesTantouId(item) || "") === String(currentUserId || ""))
        : rawList;
      setSeriesList(list);
      setAssistants(Array.isArray(assistantData) ? assistantData : assistantData?.content || assistantData?.data || []);
      const preferred = String(initialSeriesId || selectedSeriesId || getWorkspaceSelection().seriesId || "");
      const preferredExists = list.some((item) => String(item.id) === preferred);
      setSelectedSeriesId(String(preferredExists ? preferred : list[0]?.id || ""));
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

  async function loadVersions(pageId) {
    if (!pageId) {
      setVersions([]);
      return;
    }
    try {
      const data = await api.pageVersions.byPage(pageId).catch(() => []);
      setVersions(Array.isArray(data) ? data : data?.content || data?.data || []);
    } catch {
      setVersions([]);
    }
  }

  async function loadCanvas(pageId) {
    if (!pageId) {
      setCanvas(null);
      setHitboxes([]);
      setVersions([]);
      setSelectedBox(null);
      return;
    }
    setError("");
    setMessage("");
    try {
      const [canvasData, overlayData, versionData] = await Promise.all([
        api.workspace.canvasInit(pageId).catch(() => null),
        isTantou ? api.feedback.byPage(pageId).catch(() => []) : api.workspace.hitboxes(pageId).catch(() => []),
        api.pageVersions.byPage(pageId).catch(() => [])
      ]);
      const pageForCanvas = pages.find((page) => String(page.id) === String(pageId)) || selectedPage;
      const fallbackImageUrl = pageImage(pageForCanvas);
      const fallbackWidth = pageForCanvas?.width || pageForCanvas?.imageWidth || pageForCanvas?.originalWidth || null;
      const fallbackHeight = pageForCanvas?.height || pageForCanvas?.imageHeight || pageForCanvas?.originalHeight || null;
      setCanvas({
        ...(canvasData || {}),
        imageUrl: canvasData?.imageUrl || canvasData?.image_url || fallbackImageUrl,
        originalWidth: canvasData?.originalWidth || canvasData?.original_width || fallbackWidth,
        originalHeight: canvasData?.originalHeight || canvasData?.original_height || fallbackHeight
      });
      setHitboxes(isTantou
        ? mergeHitboxLists(overlayData)
        : mergeHitboxLists(overlayData, canvasData?.hitboxes));
      setVersions(Array.isArray(versionData) ? versionData : versionData?.content || versionData?.data || []);
      setCompareVersionId("");
      setCompareVersionHitboxes([]);
      setComparePosition(50);
      setSelectedBox(null);
      setDraftBox(null);
      setFeedbackContent("");
      setDragStart(null);
      setImageSize({ width: 0, height: 0 });
      setIsImageReady(false);
    } catch (err) {
      setError(err.message || "Could not load canvas.");
    }
  }

  useEffect(() => {
    loadSeriesList();
    // Re-run after the authenticated profile is loaded. Tantou series filtering
    // depends on the real backend user id, which may not be available on the
    // first render when only the tab session has been restored.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, isTantou, profile?.id, session.id]);

  useEffect(() => {
    loadChapters(selectedSeriesId);
    setWorkspaceSelection({ seriesId: selectedSeriesId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSeriesId]);

  useEffect(() => {
    loadPages(selectedChapterId);
    setWorkspaceSelection({ chapterId: selectedChapterId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChapterId]);

  useEffect(() => {
    let cancelled = false;
    async function loadScript() {
      if (!selectedChapterId) {
        setChapterScript("");
        return;
      }
      const data = await api.chapterScripts.get(selectedChapterId).catch(() => null);
      if (!cancelled) setChapterScript(data?.content || data?.script || data?.text || (typeof data === "string" ? data : ""));
    }
    loadScript();
    return () => { cancelled = true; };
  }, [selectedChapterId]);

  useEffect(() => {
    if (!contextMenu) return undefined;
    const close = (event) => {
      if (!event.target.closest?.(".hitbox-context-menu")) setContextMenu(null);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [contextMenu]);

  useEffect(() => {
    loadCanvas(selectedPageId);
    setWorkspaceSelection({ pageId: selectedPageId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPageId]);

  useEffect(() => {
    const nextSeriesId = String(initialSeriesId || "");
    const nextChapterId = String(initialChapterId || "");
    const nextPageId = String(initialPageId || "");

    if (nextSeriesId && nextSeriesId !== selectedSeriesId) setSelectedSeriesId(nextSeriesId);
    if (nextChapterId && nextChapterId !== selectedChapterId) setSelectedChapterId(nextChapterId);
    if (nextPageId && nextPageId !== selectedPageId) setSelectedPageId(nextPageId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSeriesId, initialChapterId, initialPageId]);

  useEffect(() => {
    if (!selectedPageId || !selectedPage) return;
    const fallbackImageUrl = pageImage(selectedPage);
    if (!fallbackImageUrl) return;

    setCanvas((old) => {
      if (old?.imageUrl || old?.image_url) return old;
      return {
        ...(old || {}),
        imageUrl: fallbackImageUrl,
        originalWidth: old?.originalWidth || old?.original_width || selectedPage.width || selectedPage.imageWidth || selectedPage.originalWidth || null,
        originalHeight: old?.originalHeight || old?.original_height || selectedPage.height || selectedPage.imageHeight || selectedPage.originalHeight || null
      };
    });
  }, [
    selectedPageId,
    selectedPage?.id,
    selectedPage?.imageUrl,
    selectedPage?.image_url,
    selectedPage?.width,
    selectedPage?.height
  ]);

  useEffect(() => {
    let cancelled = false;
    async function loadHistoricalHitboxes() {
      if (!compareVersionId) {
        setCompareVersionHitboxes([]);
        return;
      }
      const data = await api.pageVersions.hitboxes(compareVersionId).catch(() => []);
      if (!cancelled) setCompareVersionHitboxes(mergeHitboxLists(data));
    }
    loadHistoricalHitboxes();
    return () => { cancelled = true; };
  }, [compareVersionId]);

  useEffect(() => {
    if (!imageUrl) return;
    setIsImageReady(false);
    setImageSize({ width: 0, height: 0 });

    let frameId = 0;
    const markLoadedIfCached = () => {
      const image = imageRef.current;
      if (image?.complete && image.naturalWidth > 0) {
        handleImageLoad({ currentTarget: image });
      }
    };

    frameId = window.requestAnimationFrame(markLoadedIfCached);
    const timer = window.setTimeout(markLoadedIfCached, 80);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    imageUrl,
    selectedPageId,
    canvas?.imageUrl,
    canvas?.image_url,
    canvas?.originalWidth,
    canvas?.originalHeight
  ]);

  function getImageCoords(event) {
    const image = imageRef.current;
    if (!image || !canvas) return null;
    if (!isImageReady && image.complete && image.naturalWidth > 0) {
      handleImageLoad({ currentTarget: image });
    }
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
    if (!canDraw || event.target.closest?.("[data-box=\"true\"]")) return;
    const coords = getImageCoords(event);
    if (!coords) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
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

  async function handlePointerUp(event) {
    event?.currentTarget?.releasePointerCapture?.(event.pointerId);
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
    const fallbackBox = {
      id: `${isTantou ? "local-feedback" : "local"}-${Date.now()}`,
      xCoord: Number(draftBox.xCoord.toFixed(2)),
      yCoord: Number(draftBox.yCoord.toFixed(2)),
      width: Number(draftBox.width.toFixed(2)),
      height: Number(draftBox.height.toFixed(2)),
      content: "",
      isResolved: false
    };

    if (isTantou) {
      setSelectedBox(fallbackBox);
      setDraftBox(fallbackBox);
      setFeedbackContent("");
      setMessage("Feedback area drawn. Enter the Tantou note and save it.");
      return;
    }

    try {
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

  async function saveTantouFeedback(event) {
    event.preventDefault();
    if (!isTantou || !selectedPageId || !draftBox || !feedbackContent.trim()) return;
    setFeedbackBusy(true);
    setError("");
    setMessage("");
    try {
      const saved = await api.feedback.create(selectedPageId, {
        x: Number(draftBox.xCoord.toFixed(2)),
        y: Number(draftBox.yCoord.toFixed(2)),
        width: Number(draftBox.width.toFixed(2)),
        height: Number(draftBox.height.toFixed(2)),
        content: feedbackContent.trim()
      });
      const savedFeedback = normalizeHitbox(saved || { ...draftBox, content: feedbackContent.trim() });
      setHitboxes((old) => mergeHitboxLists(old, [savedFeedback]));
      setSelectedBox(savedFeedback);
      setDraftBox(null);
      setFeedbackContent("");
      setMessage("Tantou feedback saved in the independent review workspace.");
    } catch (err) {
      setError(err.message || "Could not save Tantou feedback.");
    } finally {
      setFeedbackBusy(false);
    }
  }

  function cancelTantouFeedback() {
    if (!isTantou) return;
    setDraftBox(null);
    setSelectedBox(null);
    setFeedbackContent("");
    setMessage("Unsaved Tantou feedback area removed.");
  }

  function handleImageLoad(event) {
    const image = event.currentTarget;
    const naturalWidth = image.naturalWidth || image.getBoundingClientRect().width || 1;
    const naturalHeight = image.naturalHeight || image.getBoundingClientRect().height || 1;
    setImageSize({ width: naturalWidth, height: naturalHeight });
    setIsImageReady(true);
    setCanvas((old) => old ? {
      ...old,
      originalWidth: toFiniteNumber(old.originalWidth, old.original_width, old.width, selectedPage?.width, selectedPage?.imageWidth, naturalWidth),
      originalHeight: toFiniteNumber(old.originalHeight, old.original_height, old.height, selectedPage?.height, selectedPage?.imageHeight, naturalHeight)
    } : old);
  }

  function handleImageError() {
    setIsImageReady(false);
    setError("Could not load this page image. Check the image URL stored for this page.");
  }

  async function deleteHitbox(box = selectedBox) {
    if (!canEdit || !box?.id) return;

    if (String(box.id).startsWith("local-")) {
      setHitboxes((old) => old.filter((item) => String(item.id) !== String(box.id)));
      if (String(selectedBox?.id) === String(box.id)) setSelectedBox(null);
      setDraftBox(null);
      setMessage("Unsaved hitbox removed.");
      return;
    }

    if (!window.confirm("Delete this hitbox? A hitbox that already has a task cannot be deleted until that task is removed or cancelled.")) return;
    setDeletingHitboxId(String(box.id));
    setError("");
    setMessage("");
    try {
      await api.workspace.deleteHitbox(box.id);
      setHitboxes((old) => old.filter((item) => String(item.id) !== String(box.id)));
      if (String(selectedBox?.id) === String(box.id)) setSelectedBox(null);
      if (String(contextMenu?.box?.id) === String(box.id)) setContextMenu(null);
      setMessage("Hitbox deleted.");
    } catch (err) {
      setError(err.message || "Could not delete hitbox.");
    } finally {
      setDeletingHitboxId("");
    }
  }

  async function deleteSelectedHitbox() {
    await deleteHitbox(selectedBox);
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
      setTaskModalOpen(false);
      setMessage(assistantId ? "Task created and assigned." : "Task created. Assign an assistant from Assignments if needed.");
    } catch (err) {
      setError(err.message || "Could not create task from hitbox.");
    }
  }

  async function saveChapterScript() {
    if (!selectedChapterId || !chapterScript.trim() || !canEdit) return;
    setScriptSaving(true);
    setError("");
    try {
      const saved = await api.chapterScripts.save(selectedChapterId, chapterScript.trim());
      setChapterScript(saved?.content || chapterScript.trim());
      setMessage("Chapter script saved.");
    } catch (err) {
      setError(err.message || "Could not save chapter script.");
    } finally {
      setScriptSaving(false);
    }
  }

  async function openHitboxContext(event, box) {
    event.preventDefault();
    event.stopPropagation();
    setSelectedBox(box);
    const menuWidth = Math.min(340, window.innerWidth - 24);
    const menuHeight = Math.min(520, window.innerHeight - 24);
    setContextMenu({
      box,
      x: Math.max(12, Math.min(event.clientX, window.innerWidth - menuWidth - 12)),
      y: Math.max(12, Math.min(event.clientY, window.innerHeight - menuHeight - 12))
    });
    setContextComments([]);
    setContextComment("");
    if (!box?.id || String(box.id).startsWith("local-")) return;
    setContextLoading(true);
    try {
      const comments = await api.hitboxComments.list(box.id).catch(() => []);
      setContextComments(unwrapList(comments));
    } finally {
      setContextLoading(false);
    }
  }

  async function addContextComment(event) {
    event.preventDefault();
    const box = contextMenu?.box;
    if (!box?.id || !contextComment.trim()) return;
    try {
      const saved = await api.hitboxComments.create(box.id, contextComment.trim());
      setContextComments((old) => [saved, ...old]);
      setContextComment("");
      setMessage("Hitbox comment added.");
    } catch (err) {
      setError(err.message || "Could not add hitbox comment.");
    }
  }

  async function replacePageImage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedPageId || !canEdit) return;
    setVersionBusy(true);
    setError("");
    setMessage("");
    try {
      const updated = await api.pages.replaceImage(selectedPageId, file);
      setPages((old) => old.map((page) => String(page.id) === String(selectedPageId) ? { ...page, ...updated } : page));
      setCanvas((old) => ({ ...(old || {}), imageUrl: updated?.imageUrl || updated?.image_url || pageImage(updated) }));
      await loadVersions(selectedPageId);
      setMessage("Page image replaced and archived as a new version.");
    } catch (err) {
      setError(err.message || "Could not replace page image.");
    } finally {
      setVersionBusy(false);
    }
  }

  async function restoreVersion(version) {
    if (!version?.id || !selectedPageId || !canEdit) return;
    setVersionBusy(true);
    setError("");
    setMessage("");
    try {
      const restored = await api.pageVersions.restore(version.id);
      setPages((old) => old.map((page) => String(page.id) === String(selectedPageId) ? { ...page, ...restored } : page));
      setCanvas((old) => ({ ...(old || {}), imageUrl: restored?.imageUrl || restored?.image_url || version.imageUrl || version.image_url }));
      await loadVersions(selectedPageId);
      setMessage(`Restored page to version ${version.versionNumber || version.version_number || version.id}.`);
    } catch (err) {
      setError(err.message || "Could not restore this version.");
    } finally {
      setVersionBusy(false);
    }
  }

  if (loading) return <LoadingBlock label="Loading canvas workspace..." />;

  const originalSize = canvasOriginalSize(canvas, selectedPage, imageSize);

  return (
    <section className="core-feature-page canvas-workspace-tab static-tab-screen stack">
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>

      <div className="feature-header static-feature-header">
        <div>
          <h1>{isTantou ? "Tantou Review Canvas" : "Canvas Workspace"}</h1>
          <p>{isTantou
            ? "Draw independent feedback areas for the assigned chapter. These annotations do not create Mangaka task hitboxes."
            : "Open a manga page, draw hitboxes, and create tasks for Assistants."}</p>
        </div>
        <button className="btn-outline" onClick={() => navigate(isTantou ? "/tantou-review" : "/chapters-pages")}>{isTantou ? "Back to Chapter Review" : "Manage Chapters"}</button>
      </div>

      <div className="toolbar-row canvas-toolbar-row">
        <select className="form-control" data-testid="canvas-series-select" value={selectedSeriesId} onChange={(event) => setSelectedSeriesId(event.target.value)}>
          <option value="">Choose series</option>
          {seriesList.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
        <select className="form-control" data-testid="canvas-chapter-select" value={selectedChapterId} onChange={(event) => setSelectedChapterId(event.target.value)} disabled={!selectedSeriesId}>
          <option value="">Choose chapter</option>
          {chapters.map((chapter) => <option key={chapter.id} value={chapter.id}>Chapter {chapterNumber(chapter)}: {chapterTitle(chapter)}</option>)}
        </select>
        <select className="form-control" data-testid="canvas-page-select" value={selectedPageId} onChange={(event) => setSelectedPageId(event.target.value)} disabled={!selectedChapterId}>
          <option value="">Choose page</option>
          {pages.map((page) => <option key={page.id} value={page.id}>Page {pageNumber(page)}</option>)}
        </select>
        <button className="btn-publish" onClick={() => loadCanvas(selectedPageId)} disabled={!selectedPageId}>Load Page</button>
      </div>

      <div className="workspace-split canvas-static-split">
        <ChapterWorkspaceSidebar
          chapters={chapters}
          pages={pages}
          selectedChapterId={selectedChapterId}
          selectedPageId={selectedPageId}
          onChapterChange={setSelectedChapterId}
          onPageChange={setSelectedPageId}
        />
        <div className="card-box">
          <div className="section-title-row"><h3>{isTantou ? "Feedback Canvas" : "Canvas"}</h3><span className="muted-note">{selectedPageId ? (isTantou ? "Drag on the image to draw an independent feedback area" : "Drag on image to draw a hitbox") : "Select a page to start"}</span></div>
          <div className="hitbox-stage canvas-hitbox-stage">
            {selectedPageId && imageUrl ? (
              <div
                ref={wrapRef}
                key={`canvas-wrap-${selectedPageId}-${imageUrl}`}
                data-testid="canvas-draw-surface"
                className={`hitbox-image-wrap ${isImageReady ? "ready" : "loading"}`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerLeave={dragStart ? undefined : handlePointerUp}
              >
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt={`Page ${pageNumber(selectedPage) || selectedPageId}`}
                  draggable="false"
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                />
                {isImageReady && (
                  <div className="hitbox-layer-react">
                    {hitboxes.map((box, index) => <CanvasBox key={hitboxId(box)} box={box} originalSize={originalSize} active={selectedBox && String(selectedBox.id) === String(box.id)} label={index + 1} kind={isTantou ? "feedback" : "hitbox"} onClick={(event) => { event.stopPropagation(); setSelectedBox(box); }} onContextMenu={canEdit ? (event) => openHitboxContext(event, box) : undefined} />)}
                    {draftBox && <CanvasBox box={draftBox} originalSize={originalSize} draft label="New" kind={isTantou ? "feedback" : "hitbox"} />}
                  </div>
                )}
              </div>
            ) : <EmptyState icon="□" title="Select a page to start" body="Choose a series, chapter, and page from the controls above." />}
          </div>
        </div>

        <div className="card-box hitbox-task-card">
          <div className="script-sync-panel">
            <div className="section-title-row compact-title-row"><h3>Chapter Script</h3><span className="muted-note">Selected chapter script</span></div>
            <ScriptEditor value={chapterScript} onChange={setChapterScript} rows={7} disabled={!canEdit} />
            {canEdit && <button className="btn btn-small" type="button" onClick={saveChapterScript} disabled={scriptSaving || !selectedChapterId || !chapterScript.trim()}>{scriptSaving ? "Saving..." : "Save script"}</button>}
          </div>

          <h3>{isTantou ? "Create Tantou Feedback" : "Create Task From Hitbox"}</h3>
          {isTantou ? (
            <form className="feature-form tantou-feedback-form" data-testid="tantou-feedback-form" onSubmit={saveTantouFeedback}>
              <div className="form-row">
                <div className="form-group"><label>X</label><input className="form-control" value={selectedBox ? boxValue(selectedBox, "xCoord", "x_coord").toFixed(2) : ""} readOnly /></div>
                <div className="form-group"><label>Y</label><input className="form-control" value={selectedBox ? boxValue(selectedBox, "yCoord", "y_coord").toFixed(2) : ""} readOnly /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>W</label><input className="form-control" value={selectedBox ? boxValue(selectedBox, "width", "width").toFixed(2) : ""} readOnly /></div>
                <div className="form-group"><label>H</label><input className="form-control" value={selectedBox ? boxValue(selectedBox, "height", "height").toFixed(2) : ""} readOnly /></div>
              </div>
              <label className="form-group">Feedback note<textarea className="form-control" rows="5" value={feedbackContent} onChange={(event) => setFeedbackContent(event.target.value)} placeholder="Describe the revision needed in this area..." disabled={!draftBox || feedbackBusy} /></label>
              <div className="button-row">
                <button className="btn btn-primary" data-testid="save-tantou-feedback" disabled={!draftBox || !feedbackContent.trim() || feedbackBusy}>{feedbackBusy ? "Saving..." : "Save feedback area"}</button>
                <button className="btn" type="button" onClick={cancelTantouFeedback} disabled={!draftBox || feedbackBusy}>Cancel area</button>
              </div>
              {!draftBox && <p className="review-helper">Drag on the page to draw a feedback area. Saved Tantou feedback is stored separately from Mangaka hitboxes.</p>}
            </form>
          ) : (
            <div className="feature-form">
              <div className="form-row">
                <div className="form-group"><label>X</label><input className="form-control" value={selectedBox ? boxValue(selectedBox, "xCoord", "x_coord").toFixed(2) : ""} readOnly /></div>
                <div className="form-group"><label>Y</label><input className="form-control" value={selectedBox ? boxValue(selectedBox, "yCoord", "y_coord").toFixed(2) : ""} readOnly /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>W</label><input className="form-control" value={selectedBox ? boxValue(selectedBox, "width", "width").toFixed(2) : ""} readOnly /></div>
                <div className="form-group"><label>H</label><input className="form-control" value={selectedBox ? boxValue(selectedBox, "height", "height").toFixed(2) : ""} readOnly /></div>
              </div>
              <button className="btn-publish full" data-testid="open-task-modal" type="button" disabled={!selectedBox?.id || !canEdit || String(selectedBox?.id || "").startsWith("local-")} onClick={() => setTaskModalOpen(true)}>Open Task Assignment Modal</button>
              <button
                className="btn btn-danger full"
                data-testid="delete-selected-hitbox"
                type="button"
                onClick={deleteSelectedHitbox}
                disabled={!selectedBox?.id || Boolean(deletingHitboxId)}
              >
                {deletingHitboxId && String(deletingHitboxId) === String(selectedBox?.id) ? "Deleting hitbox..." : "Delete selected hitbox"}
              </button>
            </div>
          )}
          <div className="upload-log">
            {selectedSeries && <div><strong>Series:</strong> {selectedSeries.title}</div>}
            {selectedChapter && <div><strong>Chapter:</strong> {chapterTitle(selectedChapter)}</div>}
            {selectedPage && <div><strong>Page:</strong> {pageNumber(selectedPage)}</div>}
            <div><strong>{isTantou ? "Tantou feedback areas" : "Hitboxes"}:</strong> {hitboxes.length}</div>
          </div>
          {hitboxes.length > 0 && (
            <div className="saved-hitbox-list">
              <div className="mini-section-label">{isTantou ? "Saved Tantou feedback on this page" : "Saved hitboxes on this page"}</div>
              {hitboxes.map((box, index) => (
                <div
                  key={hitboxId(box)}
                  className={`saved-hitbox-row ${selectedBox && String(selectedBox.id) === String(box.id) ? "active" : ""}`}
                >
                  <button type="button" className="saved-hitbox-select" onClick={() => setSelectedBox(box)}>
                    <span>#{index + 1}{isTantou && box.isResolved ? " · Resolved" : ""}</span>
                    <small>{isTantou && box.content ? box.content : `X ${boxValue(box, "xCoord", "x_coord").toFixed(0)} · Y ${boxValue(box, "yCoord", "y_coord").toFixed(0)}`}</small>
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      className="btn btn-small btn-danger hitbox-inline-delete"
                      data-testid={`delete-hitbox-${box.id}`}
                      onClick={() => deleteHitbox(box)}
                      disabled={Boolean(deletingHitboxId)}
                      aria-label={`Delete hitbox ${index + 1}`}
                    >
                      {String(deletingHitboxId) === String(box.id) ? "Deleting..." : "Delete"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="page-version-panel">
            <div className="section-title-row compact-title-row">
              <h3>Page Versions</h3>
              <span className="pill-count">{versions.length}</span>
            </div>
            {canEdit && (
              <label className="btn-outline full version-upload-label">
                Replace Page Image
                <input type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" onChange={replacePageImage} disabled={!selectedPageId || versionBusy} hidden />
              </label>
            )}
            {versions.length ? (
              <div className="page-version-list">
                {versions.map((version) => {
                  const versionNumber = version.versionNumber || version.version_number || version.id;
                  const versionUrl = mediaUrlFrom(version, version.imageUrl, version.image_url);
                  return (
                    <div className="page-version-row" key={version.id}>
                      <button type="button" className={String(compareVersionId) === String(version.id) ? "active" : ""} onClick={() => versionUrl && setCompareVersionId(String(version.id))}>
                        <strong>Version {versionNumber}</strong>
                        <small>{formatDateTime(version.createdAt || version.created_at)}</small>
                      </button>
                      {canEdit && <button className="btn btn-tiny" type="button" disabled={versionBusy} onClick={() => restoreVersion(version)}>Restore</button>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="muted-note version-empty-note">No page versions found yet.</p>
            )}
            {compareImageUrl && imageUrl && (
              <VersionComparison currentUrl={imageUrl} versionUrl={compareImageUrl} hitboxes={compareVersionHitboxes} position={comparePosition} onPositionChange={setComparePosition} />
            )}
          </div>
        </div>
      </div>

      {taskModalOpen && (
        <div className="feature-modal-backdrop" role="presentation" onMouseDown={() => setTaskModalOpen(false)}>
          <form className="feature-modal-card" data-testid="task-assignment-modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title" onSubmit={createTask} onMouseDown={(event) => event.stopPropagation()}>
            <div className="card-header"><div><p className="eyebrow">FE-38 task assignment</p><h3 id="task-modal-title">Create task from selected hitbox</h3></div><button className="btn-icon-only" type="button" onClick={() => setTaskModalOpen(false)}>×</button></div>
            <div className="metric-grid compact">
              <span>X <strong>{selectedBox ? boxValue(selectedBox, "xCoord", "x_coord").toFixed(1) : "-"}</strong></span>
              <span>Y <strong>{selectedBox ? boxValue(selectedBox, "yCoord", "y_coord").toFixed(1) : "-"}</strong></span>
              <span>W <strong>{selectedBox ? boxValue(selectedBox, "width", "width").toFixed(1) : "-"}</strong></span>
              <span>H <strong>{selectedBox ? boxValue(selectedBox, "height", "height").toFixed(1) : "-"}</strong></span>
            </div>
            <label>Assistant<select className="form-control" data-testid="task-assistant-select" value={assistantId} onChange={(event) => setAssistantId(event.target.value)}><option value="">Leave unassigned</option>{assistants.map((assistant) => <option key={assistant.id} value={assistant.id}>{assistant.fullName || assistant.username || assistant.email || `Assistant #${assistant.id}`}</option>)}</select></label>
            <label>Task details<textarea className="form-control" data-testid="task-description-input" rows="5" required value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} placeholder="Describe what the Assistant must fix or draw..." /></label>
            <div className="button-row modal-actions"><button className="btn" type="button" onClick={() => setTaskModalOpen(false)}>Cancel</button><button className="btn-publish" data-testid="task-create-submit" disabled={!taskDescription.trim()}>Create and assign</button></div>
          </form>
        </div>
      )}

      {contextMenu && (
        <form className="hitbox-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onSubmit={addContextComment} onContextMenu={(event) => event.preventDefault()}>
          <div className="card-header"><strong>Hitbox comments</strong><button type="button" className="btn-icon-only" onClick={() => setContextMenu(null)}>×</button></div>
          {contextLoading ? <small>Loading comments...</small> : contextComments.length ? <div className="context-comment-list">{contextComments.map((item) => <p key={item.id || item.content}><strong>{item.userName || item.username || "User"}</strong>{item.content || item.message}</p>)}</div> : <small>No comments yet.</small>}
          <textarea rows="3" value={contextComment} onChange={(event) => setContextComment(event.target.value)} placeholder="Add a comment..." />
          <button className="btn btn-small btn-primary" disabled={!contextComment.trim()}>Add comment</button>
        </form>
      )}
    </section>
  );
}

function valueToPercent(value, total) {
  const number = toFiniteNumber(value);
  const safeTotal = Math.max(toFiniteNumber(total, 1), 1);
  return (number / safeTotal) * 100;
}

function CanvasBox({ box, originalSize, active, draft, label, kind = "hitbox", onClick, onContextMenu }) {
  const originalWidth = Math.max(toFiniteNumber(originalSize?.width, 1), 1);
  const originalHeight = Math.max(toFiniteNumber(originalSize?.height, 1), 1);
  const x = boxValue(box, "xCoord", "x_coord", "x");
  const y = boxValue(box, "yCoord", "y_coord", "y");
  const width = boxValue(box, "width", "width", "w");
  const height = boxValue(box, "height", "height", "h");
  const unitBox = x >= 0 && y >= 0 && width > 0 && height > 0 && x <= 1 && y <= 1 && width <= 1 && height <= 1;
  const left = Math.max(0, Math.min(100, unitBox ? x * 100 : valueToPercent(x, originalWidth)));
  const top = Math.max(0, Math.min(100, unitBox ? y * 100 : valueToPercent(y, originalHeight)));
  const boxWidth = Math.max(0.5, Math.min(100 - left, unitBox ? width * 100 : valueToPercent(width, originalWidth)));
  const boxHeight = Math.max(0.5, Math.min(100 - top, unitBox ? height * 100 : valueToPercent(height, originalHeight)));

  return (
    <button
      type="button"
      data-box="true"
      data-testid={draft ? "draft-hitbox" : `saved-hitbox-${box.id || label}`}
      className={`${draft ? "drawn-hitbox" : "saved-hitbox"} ${kind === "feedback" ? "tantou-feedback-box" : "mangaka-hitbox-box"} ${active ? "active" : ""}`}
      style={{ left: `${left}%`, top: `${top}%`, width: `${boxWidth}%`, height: `${boxHeight}%` }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={`Hitbox ${label}: X ${x.toFixed(0)}, Y ${y.toFixed(0)}, W ${width.toFixed(0)}, H ${height.toFixed(0)}`}
    >
      {!draft && <span>{label}</span>}
    </button>
  );
}

function ChapterWorkspaceSidebar({ chapters, pages, selectedChapterId, selectedPageId, onChapterChange, onPageChange }) {
  return (
    <aside className="card-box chapter-workspace-sidebar" aria-label="Chapter workspace navigation">
      <div className="section-title-row compact-title-row"><h3>Workspace</h3><span className="pill-count">{chapters.length}</span></div>
      <div className="chapter-sidebar-list">
        {chapters.map((chapter) => {
          const active = String(chapter.id) === String(selectedChapterId);
          return (
            <div className="chapter-sidebar-group" key={chapter.id}>
              <button type="button" className={active ? "chapter-sidebar-button active" : "chapter-sidebar-button"} onClick={() => onChapterChange(String(chapter.id))}>
                <span>Chapter {chapterNumber(chapter)}</span><small>{chapterTitle(chapter)}</small>
              </button>
              {active && <div className="chapter-sidebar-pages">{pages.map((page) => <button type="button" key={page.id} className={String(page.id) === String(selectedPageId) ? "active" : ""} onClick={() => onPageChange(String(page.id))}>Page {pageNumber(page)}</button>)}</div>}
            </div>
          );
        })}
        {!chapters.length && <small>No chapters in the selected series.</small>}
      </div>
    </aside>
  );
}

function VersionComparison({ currentUrl, versionUrl, hitboxes = [], position, onPositionChange }) {
  const historicalImageRef = useRef(null);
  const [historicalSize, setHistoricalSize] = useState({ width: 1, height: 1 });

  useEffect(() => {
    const image = historicalImageRef.current;
    if (image?.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
      setHistoricalSize({ width: image.naturalWidth, height: image.naturalHeight });
    }
  }, [versionUrl]);

  return (
    <div className="version-comparison">
      <div className="version-comparison-stage">
        <img src={currentUrl} alt="Current page version" />
        <div className="version-comparison-overlay" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
          <img
            ref={historicalImageRef}
            src={versionUrl}
            alt="Historical page version"
            onLoad={(event) => setHistoricalSize({ width: event.currentTarget.naturalWidth || 1, height: event.currentTarget.naturalHeight || 1 })}
          />
          <div className="historical-hitbox-layer" aria-label="Historical version hitboxes">
            {hitboxes.map((box, index) => (
              <CanvasBox key={`history-${box.id || index}`} box={box} originalSize={historicalSize} label={index + 1} />
            ))}
          </div>
        </div>
        <span className="version-divider" style={{ left: `${position}%` }} />
        <span className="version-label current">Current</span><span className="version-label historical">Historical</span>
      </div>
      <label>Compare current and historical version<input type="range" min="0" max="100" value={position} onChange={(event) => onPositionChange(Number(event.target.value))} /></label>
    </div>
  );
}
