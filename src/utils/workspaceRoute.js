const SERIES_WORKSPACE_PATHS = new Set([
  "/manuscripts",
  "/chapters-pages",
  "/canvas-workspace",
  "/schedule"
]);

export function withWorkspaceSelection(path, selection = {}) {
  const target = String(path || "");
  const [pathname, queryString = ""] = target.split("?");
  if (!SERIES_WORKSPACE_PATHS.has(pathname)) return target;

  const seriesId = String(selection?.seriesId || "");
  if (!seriesId) return target;

  const params = new URLSearchParams(queryString);
  params.set("seriesId", seriesId);

  if (pathname === "/canvas-workspace") {
    const chapterId = String(selection?.chapterId || "");
    const pageId = String(selection?.pageId || "");
    if (chapterId) params.set("chapterId", chapterId);
    if (pageId) params.set("pageId", pageId);
  }

  return `${pathname}?${params.toString()}`;
}
