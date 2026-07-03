
(function () {
  document.addEventListener("DOMContentLoaded", () => {
    const Api = window.MangaApi;
    const content = document.querySelector(".content-padding");
    if (!content || !Api) return;

    const dashboardPanel = document.createElement("div");
    dashboardPanel.id = "studio-dashboard-panel";
    while (content.firstChild) dashboardPanel.appendChild(content.firstChild);
    content.appendChild(dashboardPanel);

    const inlinePanel = document.createElement("div");
    inlinePanel.id = "studio-inline-panel";
    inlinePanel.className = "studio-inline-panel";
    inlinePanel.hidden = true;
    content.appendChild(inlinePanel);

    const $ = (selector, root = inlinePanel) => root.querySelector(selector);
    const $$ = (selector, root = inlinePanel) => Array.from(root.querySelectorAll(selector));

    const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));

    const getArray = (value) => Array.isArray(value) ? value : (value?.content || []);
    const pct = (value) => Math.max(0, Math.min(100, Number(value) || 0));


    let assistantDirectory = {};

    function userIdOf(user = {}) {
      return user.id ?? user.userId ?? user.accountId ?? "";
    }

    function userNameOf(user = {}) {
      return user.fullName || user.name || user.username || user.email || "";
    }

    async function loadAssistantDirectory() {
      const users = [];
      try { users.push(...getArray(await Api.assistants?.())); } catch (_) {}
      if (!users.length) {
        try { users.push(...getArray(await Api.users?.())); } catch (_) {}
      }

      assistantDirectory = {};
      users.forEach((user) => {
        const id = userIdOf(user);
        const name = userNameOf(user);
        if (id && name) assistantDirectory[String(id)] = name;
      });
    }

    function localAssistantMap() {
      try { return JSON.parse(localStorage.getItem("taskAssistantMap") || "{}"); }
      catch (_) { return {}; }
    }

    function rememberTaskAssistant(taskId, assistantId, assistantName = "") {
      if (!taskId || !assistantId) return;
      const map = localAssistantMap();
      map[String(taskId)] = {
        assistantId: String(assistantId),
        assistantName: assistantName || assistantDirectory[String(assistantId)] || `Assistant #${assistantId}`
      };
      localStorage.setItem("taskAssistantMap", JSON.stringify(map));
    }

    function nestedUserName(value) {
      if (!value) return "";
      if (typeof value === "string") return value;
      return value.fullName || value.name || value.username || value.email || "";
    }

    function assistantIdOf(task = {}) {
      return (
        task.assistantId ??
        task.assigneeId ??
        task.assignedToId ??
        task.assignedUserId ??
        task.assistant?.id ??
        task.assignee?.id ??
        task.assignedTo?.id ??
        task.assignedUser?.id ??
        ""
      );
    }

    function assistantNameOf(task = {}) {
      const direct =
        task.assigneeName ||
        task.assistantName ||
        task.assignedToName ||
        task.assignedUserName ||
        nestedUserName(task.assistant) ||
        nestedUserName(task.assignee) ||
        nestedUserName(task.assignedTo) ||
        nestedUserName(task.assignedUser);

      if (direct && !/^unassigned$/i.test(String(direct).trim())) return direct;

      const taskId = task.id ?? task.taskId;
      const id = assistantIdOf(task);
      const local = localAssistantMap();

      if (taskId && local[String(taskId)]?.assistantName) return local[String(taskId)].assistantName;
      if (id && assistantDirectory[String(id)]) return assistantDirectory[String(id)];
      if (id) return `Assistant #${id}`;
      return "Unassigned";
    }


    function setActive(panelName) {
      document.querySelectorAll("[data-dashboard-panel]").forEach((link) => {
        const isActive = link.dataset.dashboardPanel === panelName;
        if (link.classList.contains("nav-item")) link.classList.toggle("active", isActive);
      });
    }

    function showDashboard() {
      inlinePanel.hidden = true;
      inlinePanel.innerHTML = "";
      dashboardPanel.hidden = false;
      setActive("dashboard");
      renderDashboardSeries();
    }

    async function showPanel(panelName) {
      dashboardPanel.hidden = panelName !== "dashboard";
      inlinePanel.hidden = panelName === "dashboard";
      setActive(panelName);

      if (panelName === "chapters") {
        if (location.hash !== "#chapters") history.replaceState(null, "", "#chapters");
        return renderChapters();
      }
      if (panelName === "canvas") {
        if (location.hash !== "#canvas") history.replaceState(null, "", "#canvas");
        return renderCanvas();
      }
      if (panelName === "kanban") {
        if (location.hash !== "#kanban") history.replaceState(null, "", "#kanban");
        return renderKanban();
      }
      if (panelName === "schedule") {
        if (location.hash !== "#schedule") history.replaceState(null, "", "#schedule");
        return renderSchedule();
      }

      if (location.hash) history.replaceState(null, "", location.pathname);
      return showDashboard();
    }

    document.querySelectorAll("[data-dashboard-panel]").forEach((link) => {
      link.addEventListener("click", (event) => {
        event.preventDefault();
        const panelName = link.dataset.dashboardPanel || "dashboard";
        showPanel(panelName);
      });
    });

    if (location.hash === "#chapters") showPanel("chapters");
    else if (location.hash === "#canvas") showPanel("canvas");
    else if (location.hash === "#kanban") showPanel("kanban");
    else if (location.hash === "#schedule") showPanel("schedule");
    else renderDashboardSeries();

    function loading(message = "Loading...") {
      return `<div class="api-loading">${message}</div>`;
    }

    function errorBox(error) {
      return `<div class="api-error">${esc(error?.message || error || "Something went wrong")}</div>`;
    }

    function panelHeader(title, subtitle, actions = "") {
      return `<div class="inline-panel-header">
        <div>
          <h1>${esc(title)}</h1>
          <p>${esc(subtitle)}</p>
        </div>
        <div class="inline-panel-actions">${actions}</div>
      </div>`;
    }

    function seriesMergeKey(series) {
      return String(series?.id ?? series?.seriesId ?? series?.title ?? series?.name ?? "").trim().toLowerCase();
    }

    function mergeSeriesLists(...lists) {
      const merged = new Map();

      lists.flat().filter(Boolean).forEach((series) => {
        const key = seriesMergeKey(series);
        if (!key) return;
        merged.set(key, {
          ...(merged.get(key) || {}),
          ...series
        });
      });

      return Array.from(merged.values());
    }

    function normalizeIdentity(value = "") {
      return String(value || "").trim().toLowerCase();
    }

    function readLocalJson(key) {
      try {
        return JSON.parse(localStorage.getItem(key) || "{}");
      } catch (_) {
        return {};
      }
    }

    function currentMangakaIdentity() {
      const cached = readLocalJson("profileCache");
      const user = readLocalJson("user");
      const authUser = readLocalJson("authUser");
      const currentUser = readLocalJson("currentUser");

      return {
        id: normalizeIdentity(
          localStorage.getItem("userId") ||
          localStorage.getItem("id") ||
          localStorage.getItem("currentUserId") ||
          localStorage.getItem("authUserId") ||
          localStorage.getItem("loggedInUserId") ||
          localStorage.getItem("user_id") ||
          cached.id || cached.userId || cached.user_id ||
          user.id || user.userId || user.user_id ||
          authUser.id || authUser.userId || authUser.user_id ||
          currentUser.id || currentUser.userId || currentUser.user_id
        ),
        username: normalizeIdentity(
          localStorage.getItem("username") ||
          localStorage.getItem("userName") ||
          cached.username || cached.userName ||
          user.username || user.userName ||
          authUser.username || authUser.userName ||
          currentUser.username || currentUser.userName
        ),
        email: normalizeIdentity(
          localStorage.getItem("email") ||
          localStorage.getItem("userEmail") ||
          cached.email ||
          user.email ||
          authUser.email ||
          currentUser.email
        ),
        fullName: normalizeIdentity(
          localStorage.getItem("fullName") ||
          localStorage.getItem("name") ||
          cached.fullName || cached.name ||
          user.fullName || user.name ||
          authUser.fullName || authUser.name ||
          currentUser.fullName || currentUser.name
        )
      };
    }

    async function ensureMangakaIdentityLoaded() {
      const identity = currentMangakaIdentity();
      if (identity.id) return identity;

      try {
        const profile = await Api.profile?.();
        if (profile && typeof profile === "object") {
          localStorage.setItem("profileCache", JSON.stringify({
            ...JSON.parse(localStorage.getItem("profileCache") || "{}"),
            ...profile
          }));

          const profileId = profile.id ?? profile.userId ?? profile.user_id ?? profile.accountId;
          if (profileId) localStorage.setItem("userId", String(profileId));
          if (profile.username || profile.userName) localStorage.setItem("username", profile.username || profile.userName);
          if (profile.email) localStorage.setItem("email", profile.email);
          if (profile.fullName || profile.name) localStorage.setItem("fullName", profile.fullName || profile.name);
        }
      } catch (error) {
        console.warn("Could not refresh Mangaka profile identity for ownership filtering.", error.message);
      }

      return currentMangakaIdentity();
    }

    function seriesOwnerTokens(series = {}) {
      const mangaka = series.mangaka || series.author || series.creator || series.owner || series.user || series.createdBy || {};

      return {
        id: normalizeIdentity(
          // Supabase column shown in your table: manga_id = User.id of the Mangaka.
          series.manga_id ||
          series.mangaId ||
          series.mangaka_id ||
          series.mangakaId ||
          series.authorId ||
          series.creatorId ||
          series.ownerId ||
          series.userId ||
          series.createdById ||
          mangaka.id ||
          mangaka.userId ||
          mangaka.user_id ||
          mangaka.accountId
        ),
        username: normalizeIdentity(
          series.mangakaUsername || series.mangaUsername || series.authorUsername || series.creatorUsername || series.ownerUsername || series.username ||
          mangaka.username || mangaka.userName || mangaka.login
        ),
        email: normalizeIdentity(
          series.mangakaEmail || series.mangaEmail || series.authorEmail || series.creatorEmail || series.ownerEmail || series.email ||
          mangaka.email || mangaka.mail
        ),
        fullName: normalizeIdentity(
          series.mangakaName || series.mangaName || series.authorName || series.creatorName || series.ownerName || series.fullName ||
          mangaka.fullName || mangaka.name || mangaka.displayName
        )
      };
    }

    function ownerFieldsExist(owner = {}) {
      return Boolean(owner.id || owner.username || owner.email || owner.fullName);
    }

    function isSeriesOwnedByCurrentMangaka(series = {}) {
      const identity = currentMangakaIdentity();
      const owner = seriesOwnerTokens(series);

      if (identity.id && owner.id && identity.id === owner.id) return true;
      if (identity.username && owner.username && identity.username === owner.username) return true;
      if (identity.email && owner.email && identity.email === owner.email) return true;
      if (identity.fullName && owner.fullName && identity.fullName === owner.fullName) return true;

      // Only trust /my-series when the backend does not expose ownership fields.
      // If owner fields exist and they do not match, do not show it.
      if (series.__fromMySeries === true && !ownerFieldsExist(owner)) return true;

      // DB rule from your Supabase screenshot:
      // manga_series.manga_id must equal the logged-in User.id.
      // Anything else stays out of Mangaka Dashboard / Chapters / Canvas / Schedule.
      return false;
    }

    async function deleteMangakaOwnedSeries(series, refreshCallback) {
      const id = series?.id ?? series?.seriesId;
      const title = series?.title || series?.name || `Series #${id}`;
      if (!id) return alert("Missing series id.");
      if (!isSeriesOwnedByCurrentMangaka(series)) {
        alert("You can only delete series created by the logged-in Mangaka.");
        return;
      }
      if (!confirm(`Delete series "${title}"? This will also remove it from Mangaka work areas if the backend accepts the deletion.`)) return;

      try {
        await Api.deleteSeries(id);
        if (String(Api.getActiveSeriesId?.() || "") === String(id)) {
          ["activeSeriesId", "currentSeriesId", "activeSeriesTitle", "currentSeriesTitle"].forEach(key => localStorage.removeItem(key));
        }
        await refreshCallback?.();
      } catch (error) {
        alert("Delete series failed: " + (error.message || error));
      }
    }

    async function deleteChapterAndRefresh(chapter, refreshCallback) {
      const id = chapter?.id ?? chapter?.chapterId;
      const label = `Chapter ${chapter?.chapterNumber ?? chapter?.number ?? id}`;
      if (!id) return alert("Missing chapter id.");
      if (!confirm(`Delete ${label}? Related pages/tasks may be removed or blocked by the backend.`)) return;

      try {
        await Api.deleteChapter(id);
        if (String(Api.getActiveChapterId?.() || "") === String(id)) {
          ["activeChapterId", "currentChapterId"].forEach(key => localStorage.removeItem(key));
        }
        await refreshCallback?.();
      } catch (error) {
        alert("Delete chapter failed: " + (error.message || error));
      }
    }

    async function deletePageAndRefresh(page, refreshCallback) {
      const id = page?.id ?? page?.pageId;
      const label = `Page ${page?.pageNumber ?? page?.page_number ?? id}`;
      if (!id) return alert("Missing page id.");
      if (!confirm(`Delete ${label}? Related hitboxes/tasks may be removed or blocked by the backend.`)) return;

      try {
        await Api.deletePage(id);
        if (String(Api.getActivePageId?.() || "") === String(id)) {
          ["activePageId", "currentPageId"].forEach(key => localStorage.removeItem(key));
        }
        await refreshCallback?.();
      } catch (error) {
        alert("Delete page failed: " + (error.message || error));
      }
    }

    async function loadMangakaSeriesList() {
      await ensureMangakaIdentityLoaded();

      let mySeries = [];
      let allSeries = [];

      try {
        mySeries = getArray(await Api.mySeries()).map((series) => ({ ...series, __fromMySeries: true }));
      } catch (error) {
        console.warn("Could not load /manga-series/my-series", error);
        mySeries = [];
      }

      try {
        allSeries = getArray(await Api.allSeries());
      } catch (error) {
        console.warn("Could not load /manga-series", error);
        allSeries = [];
      }

      // DB rule from your Supabase table:
      // manga_series.manga_id must equal the logged-in User.id.
      // When /manga-series exposes owner fields, it is the trusted source.
      const ownedFromAll = allSeries.filter(isSeriesOwnedByCurrentMangaka);
      const mySeriesWithMatchingOwner = mySeries.filter(isSeriesOwnedByCurrentMangaka);
      const allSeriesExposeOwner = allSeries.some((series) => ownerFieldsExist(seriesOwnerTokens(series)));

      let owned;
      if (ownedFromAll.length || allSeriesExposeOwner) {
        owned = mergeSeriesLists(ownedFromAll, mySeriesWithMatchingOwner);
      } else {
        // Fallback only when the backend does not expose owner fields anywhere.
        // This keeps old /my-series compatible, but avoids taking every all-series row.
        owned = mySeries.filter((series) => {
          const owner = seriesOwnerTokens(series);
          return isSeriesOwnedByCurrentMangaka(series) || (series.__fromMySeries === true && !ownerFieldsExist(owner));
        });
      }

      return owned.map(({ __fromMySeries, ...series }) => series);
    }

    function cleanSeriesDescription(raw = "") {
      const text = String(raw || "").trim();
      if (!text) return "";

      return text
        .split("\n")
        .filter(line => !line.startsWith("--- Series Script"))
        .filter(line => !line.startsWith("Target:"))
        .filter(line => !line.startsWith("Status:"))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function getPendingSeriesMeta(title) {
      try {
        const store = JSON.parse(localStorage.getItem("mangakaPendingSeriesMetaByTitle") || "{}");
        return store[String(title || "").trim().toLowerCase()] || {};
      } catch (_) {
        return {};
      }
    }

    function seriesMetaOf(series) {
      const id = series?.id ?? series?.seriesId;
      const byId = Api.getSeriesMeta?.(id) || {};
      const byTitle = getPendingSeriesMeta(series?.title || series?.name || "");
      return { ...byTitle, ...byId };
    }

    function seriesDescriptionOf(series) {
      const meta = seriesMetaOf(series);
      return cleanSeriesDescription(
        series?.description ||
        series?.summary ||
        series?.synopsis ||
        meta.description ||
        meta.summary ||
        ""
      ) || "Chưa có mô tả chi tiết...";
    }


    function pageImageOf(value = {}) {
      if (!value) return "";
      if (typeof value === "string") return value;
      return (
        value.imageUrl ||
        value.pageImageUrl ||
        value.mangaPageImageUrl ||
        value.originalImageUrl ||
        value.fileUrl ||
        value.url ||
        value.secureUrl ||
        value.downloadUrl ||
        value.path ||
        ""
      );
    }

    function localTaskReferenceMap() {
      try { return JSON.parse(localStorage.getItem("taskReferenceMap") || "{}"); }
      catch (_) { return {}; }
    }

    function rememberTaskReference(taskId, payload = {}) {
      if (!taskId) return;
      const map = localTaskReferenceMap();
      map[String(taskId)] = {
        ...map[String(taskId)],
        ...payload,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem("taskReferenceMap", JSON.stringify(map));
    }


    function firstUsableUrl(value) {
      if (!value) return "";

      if (typeof value === "string") {
        const text = value.trim();
        if (!text) return "";

        // Try JSON strings such as {"url":"..."} or {"coverImageUrl":"..."}.
        if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
          try {
            return firstUsableUrl(JSON.parse(text));
          } catch (_) {
            return text;
          }
        }

        return text;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          const url = firstUsableUrl(item);
          if (url) return url;
        }
        return "";
      }

      if (typeof value === "object") {
        return firstUsableUrl(
          value.coverImageUrl || value.coverUrl || value.imageUrl || value.thumbnailUrl ||
          value.url || value.fileUrl || value.resourceUrl || value.secureUrl || value.downloadUrl ||
          value.path || value.data || value.file || value.image || ""
        );
      }

      return "";
    }

    function resolveSeriesCoverUrl(raw) {
      const value = firstUsableUrl(raw);
      if (!value) return "";
      if (/^(data:|blob:|https?:\/\/)/i.test(value)) return value;

      // Frontend bundled/static assets should resolve relative to the current page.
      if (/^(\.\.?\/|assets\/|public\/|images\/|img\/|cover\.png)/i.test(value)) {
        try { return new URL(value, window.location.href).href; } catch (_) { return value; }
      }

      return Api.resolveMediaUrl?.(value) || value;
    }

    function seriesCoverOf(series) {
      const meta = seriesMetaOf(series);
      const candidates = [
        series?.coverImageUrl,
        series?.coverUrl,
        series?.imageUrl,
        series?.thumbnailUrl,
        series?.cover,
        series?.coverImage,
        series?.image,
        series?.thumbnail,
        series?.primaryArt,
        series?.poster,
        series?.resource,
        series?.resources,
        meta.coverImageUrl,
        meta.coverUrl,
        meta.imageUrl,
        meta.thumbnailUrl,
        meta.cover,
        meta.coverImage,
        meta.image,
        meta.thumbnail
      ];

      for (const candidate of candidates) {
        const resolved = resolveSeriesCoverUrl(candidate);
        if (resolved) return resolved;
      }

      return "";
    }

    function seriesPlaceholder(title = "") {
      const initials = String(title || "SF")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(word => word[0]?.toUpperCase())
        .join("") || "SF";
      return `<div class="series-cover-placeholder"><span>${initials}</span><small>No cover image</small></div>`;
    }

    function dashboardSeriesCard(series) {
      const id = series?.id ?? series?.seriesId;
      const title = series?.title || series?.name || `Series #${id || "—"}`;
      const meta = seriesMetaOf(series);
      const genre = series?.genre || meta.genre || "";
      const status = series?.status || "Ongoing";
      const cover = seriesCoverOf(series);
      const description = seriesDescriptionOf(series);
      const coverHtml = cover
        ? `<img src="${esc(cover)}" alt="${esc(title)}" class="series-cover-img" onerror="this.closest('.series-cover-box').innerHTML=this.dataset.fallback;" data-fallback="${esc(seriesPlaceholder(title))}">`
        : seriesPlaceholder(title);

      return `
        <div role="button" tabindex="0" class="dashboard-series-card series-card-real" data-series-id="${esc(id)}">
          <div class="series-cover-box">
            ${coverHtml}
            <div class="series-status-pill"><i class="fa-solid fa-circle"></i> ${esc(status)}</div>
          </div>
          <div class="series-card-body">
            <div class="series-card-title-row">
              <h3>${esc(title)} ${genre ? `<span class="series-genre-badge">${esc(genre)}</span>` : ""}</h3>
              <button type="button" class="danger-mini-btn delete-series-btn" data-delete-series="${esc(id)}" title="Delete this series"><i class="fa-solid fa-trash"></i></button>
            </div>
            <p>${esc(description)}</p>
          </div>
        </div>
      `;
    }

    async function renderDashboardSeries() {
      const container = document.getElementById("active-series-container");
      if (!container) return;

      container.innerHTML = `<div class="api-loading" style="grid-column: 1 / -1;">Loading active series...</div>`;

      try {
        const series = await loadMangakaSeriesList();

        if (!series.length) {
          container.innerHTML = `
            <div class="empty-state-box" style="grid-column: 1 / -1;">
              <i class="fa-solid fa-book-open"></i>
              <p>No series created by this Mangaka yet. Create a new series or open the Series tab to view all series.</p>
            </div>`;
          return;
        }

        container.innerHTML = series.map(dashboardSeriesCard).join("");

        container.querySelectorAll("[data-series-id]").forEach(card => {
          card.addEventListener("click", (event) => {
            if (event.target.closest("[data-delete-series]")) return;
            const selected = series.find(item => String(item.id ?? item.seriesId) === String(card.dataset.seriesId));
            if (!selected) return;

            const id = selected.id ?? selected.seriesId;
            const title = selected.title || selected.name || `Series #${id}`;

            Api.setActiveSeriesId?.(id);
            localStorage.setItem("currentSeriesId", String(id));
            localStorage.setItem("activeSeriesId", String(id));
            localStorage.setItem("currentSeriesTitle", title);
            localStorage.setItem("activeSeriesTitle", title);

            Api.saveSeriesMeta?.(id, {
              title,
              description: seriesDescriptionOf(selected),
              coverImageUrl: seriesCoverOf(selected),
              genre: selected.genre || seriesMetaOf(selected).genre || ""
            });

            window.location.href = "manuscripts.html";
          });

          card.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              card.click();
            }
          });
        });

        container.querySelectorAll("[data-delete-series]").forEach(btn => {
          btn.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            const selected = series.find(item => String(item.id ?? item.seriesId) === String(btn.dataset.deleteSeries));
            await deleteMangakaOwnedSeries(selected, renderDashboardSeries);
          });
        });
      } catch (error) {
        container.innerHTML = errorBox(error);
      }
    }

    async function enrichChaptersWithPages(chapters = []) {
      return Promise.all(getArray(chapters).map(async (chapter) => {
        const chapterId = chapter.id ?? chapter.chapterId;
        let pages = chapter.pages || chapter.pageList || chapter.mangaPages || [];
        if (!Array.isArray(pages) || pages.length === 0) {
          try {
            pages = getArray(await Api.pages(chapterId));
          } catch (error) {
            console.warn("Could not load pages for chapter", chapterId, error);
            pages = [];
          }
        }
        return { ...chapter, pages };
      }));
    }


    function openScriptModal(chapter, scriptText = "") {
      const existing = document.getElementById("chapter-script-modal");
      if (existing) existing.remove();

      const chapterLabel = `Ch. ${chapter?.chapterNumber ?? chapter?.number ?? "?"} — ${chapter?.title || "Untitled"}`;
      document.body.insertAdjacentHTML("beforeend", `
        <div class="chapter-script-modal" id="chapter-script-modal">
          <div class="chapter-script-dialog">
            <div class="chapter-script-header">
              <div>
                <span class="eyebrow">Chapter Script</span>
                <h2>${esc(chapterLabel)}</h2>
              </div>
              <button type="button" class="modal-x" id="close-chapter-script"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <pre class="chapter-script-content">${esc(scriptText || "No script saved for this chapter.")}</pre>
          </div>
        </div>
      `);

      const modal = document.getElementById("chapter-script-modal");
      const close = () => modal?.remove();
      document.getElementById("close-chapter-script")?.addEventListener("click", close);
      modal?.addEventListener("click", (event) => {
        if (event.target === modal) close();
      });
    }

    async function renderChapters() {
      inlinePanel.innerHTML = `
        ${panelHeader("Chapters & Pages", "Create chapters and upload manga page images without leaving the Mangaka dashboard.", `<button class="btn-publish" id="inline-refresh-chapters"><i class="fa-solid fa-rotate"></i> Refresh</button>`)}
        <div class="inline-feature-grid two-cols">
          <div class="card-box">
            <h3>Select Series</h3>
            <div class="form-group"><label>Manga Series</label><select id="inline-series-select" class="form-control"></select></div>
            <form id="inline-chapter-form" class="feature-form">
              <h3>Create New Chapter</h3>
              <div class="form-row">
                <div class="form-group"><label>Chapter Number</label><input id="inline-chapter-number" class="form-control" type="number" min="1" required></div>
                <div class="form-group"><label>Chapter Title</label><input id="inline-chapter-title" class="form-control" placeholder="Chapter title"></div>
              </div>
              <div class="form-group">
                <label>Chapter Script / Notes</label>
                <textarea id="inline-chapter-script" class="form-control chapter-script-input" placeholder="Add chapter script, dialogue, panel notes, or direction for this chapter..."></textarea>
                <small class="muted-note">This script is attached to the chapter and can be used when creating Assistant tasks.</small>
              </div>
              <button class="btn-publish" type="submit"><i class="fa-solid fa-plus"></i> Create Chapter</button>
            </form>
          </div>
          <div class="card-box">
            <h3>Upload Pages</h3>
            <form id="inline-page-upload-form" class="feature-form">
              <div class="form-group"><label>Chapter</label><select id="inline-chapter-select" class="form-control"></select></div>
              <div class="form-row">
                <div class="form-group"><label>Start Page Number</label><input id="inline-start-page-number" class="form-control" type="number" min="1" value="1"></div>
                <div class="form-group"><label>Image Files</label><input id="inline-page-files" class="form-control" type="file" accept="image/*" multiple></div>
              </div>
              <button class="btn-publish" type="submit"><i class="fa-solid fa-upload"></i> Upload Pages</button>
            </form>
            <div id="inline-upload-log" class="upload-log"></div>
          </div>
        </div>
        <div class="card-box">
          <div class="section-title-row"><h3>Chapters</h3><span id="inline-chapter-count" class="status-tag progress">0</span></div>
          <div id="inline-chapters-table">${loading("Loading chapters...")}</div>
        </div>`;

      const seriesSelect = $("#inline-series-select");
      const chapterSelect = $("#inline-chapter-select");
      const chaptersTable = $("#inline-chapters-table");
      const chapterCount = $("#inline-chapter-count");
      const uploadLog = $("#inline-upload-log");

      async function loadSeries() {
        seriesSelect.innerHTML = `<option>Loading...</option>`;
        try {
          const items = await loadMangakaSeriesList();
          if (!items.length) {
            seriesSelect.innerHTML = `<option value="">No series found</option>`;
            chapterSelect.innerHTML = `<option value="">Create a series first</option>`;
            chaptersTable.innerHTML = `<div class="empty-state-box">No series found. Create a series first.</div>`;
            return;
          }
          seriesSelect.innerHTML = items.map((s) => `<option value="${s.id}">${esc(s.title || s.name || `Series #${s.id}`)}</option>`).join("");
          const activeSeriesId = Api.getActiveSeriesId();
          if (activeSeriesId && items.some((s) => String(s.id) === String(activeSeriesId))) {
            seriesSelect.value = activeSeriesId;
          } else {
            seriesSelect.value = String(items[0].id);
          }
          Api.setActiveSeriesId(seriesSelect.value);
          const selectedSeries = items.find((s) => String(s.id) === String(seriesSelect.value));
          if (selectedSeries?.title) localStorage.setItem("currentSeriesTitle", selectedSeries.title);
          await loadChapters();
        } catch (error) {
          chaptersTable.innerHTML = errorBox(error);
        }
      }

      async function loadChapters() {
        const seriesId = seriesSelect.value || Api.getActiveSeriesId();
        if (!seriesId) return;
        Api.setActiveSeriesId(seriesId);
        chaptersTable.innerHTML = loading("Loading chapters...");
        chapterSelect.innerHTML = `<option>Loading...</option>`;
        try {
          const items = await enrichChaptersWithPages(await Api.chapters(seriesId));
          chapterCount.textContent = items.length;
          chapterSelect.innerHTML = items.length
            ? items.map((c) => `<option value="${c.id ?? c.chapterId}">Ch. ${c.chapterNumber ?? c.number ?? "?"} — ${esc(c.title || "Untitled")}</option>`).join("")
            : `<option value="">No chapters yet</option>`;
          chaptersTable.innerHTML = items.length
            ? `<table class="data-table"><thead><tr><th>Chapter</th><th>Title</th><th>Pages</th><th>Script</th><th>Status</th><th>Action</th></tr></thead><tbody>${items.map((c) => {
                const id = c.id ?? c.chapterId;
                const pages = getArray(c.pages);
                const pageCount = pages.length;
                const chapterScript = c.script || c.scriptText || c.content || Api.getChapterScript?.(id) || "";
                const pageChips = pages.length
                  ? `<div class="mangaka-page-chip-list">${pages.map((p) => {
                      const pageId = p.id ?? p.pageId;
                      return `<span class="mangaka-page-chip">Page ${esc(p.pageNumber ?? p.page_number ?? pageId ?? "?")} <button type="button" class="danger-icon-btn" data-delete-page="${esc(pageId)}" data-page-label="Page ${esc(p.pageNumber ?? p.page_number ?? pageId ?? "?")}"><i class="fa-solid fa-xmark"></i></button></span>`;
                    }).join("")}</div>`
                  : `<span class="muted-note">No pages</span>`;
                return `<tr>
                  <td><strong>Ch. ${c.chapterNumber ?? c.number ?? "?"}</strong></td>
                  <td>${esc(c.title || "Untitled")}</td>
                  <td><span class="status-tag progress">${pageCount} page${pageCount === 1 ? "" : "s"}</span>${pageChips}</td>
                  <td>${chapterScript ? `<button class="btn-outline mini-btn" data-view-script="${id}"><i class="fa-solid fa-scroll"></i> View Script</button>` : `<span class="muted-note">No script</span>`}</td>
                  <td><span class="status-tag progress">${esc(c.status || "DRAFT")}</span></td>
                  <td class="mangaka-table-actions">
                    <button class="btn-outline mini-btn" data-open-canvas="${id}">Open Canvas</button>
                    <button class="danger-mini-btn" data-delete-chapter="${id}"><i class="fa-solid fa-trash"></i> Delete</button>
                  </td>
                </tr>`;
              }).join("")}</tbody></table>`
            : `<div class="empty-state-box">No chapters yet. Create the first chapter above.</div>`;
          if (chapterSelect.value) Api.setActiveChapterId(chapterSelect.value);

          $$("[data-view-script]").forEach((btn) => btn.addEventListener("click", () => {
            const chapterId = btn.dataset.viewScript;
            const chapter = items.find((c) => String(c.id ?? c.chapterId) === String(chapterId));
            const scriptText = chapter?.script || chapter?.scriptText || chapter?.content || Api.getChapterScript?.(chapterId) || "";
            openScriptModal(chapter, scriptText);
          }));

          $$("[data-open-canvas]").forEach((btn) => btn.addEventListener("click", () => {
            const chapterId = btn.dataset.openCanvas;
            const chapter = items.find((c) => String(c.id ?? c.chapterId) === String(chapterId));
            Api.setActiveChapterId(chapterId);
            const firstPage = getArray(chapter?.pages)[0];
            if (firstPage?.id) Api.setActivePageId(firstPage.id);
            showPanel("canvas");
          }));

          $$("[data-delete-chapter]").forEach((btn) => btn.addEventListener("click", async () => {
            const chapter = items.find((c) => String(c.id ?? c.chapterId) === String(btn.dataset.deleteChapter));
            await deleteChapterAndRefresh(chapter, loadChapters);
          }));

          $$("[data-delete-page]").forEach((btn) => btn.addEventListener("click", async () => {
            const pageId = btn.dataset.deletePage;
            const page = items.flatMap((c) => getArray(c.pages)).find((p) => String(p.id ?? p.pageId) === String(pageId)) || { id: pageId, pageNumber: btn.dataset.pageLabel || pageId };
            await deletePageAndRefresh(page, loadChapters);
          }));
        } catch (error) {
          chaptersTable.innerHTML = errorBox(error);
        }
      }

      seriesSelect.addEventListener("change", loadChapters);
      chapterSelect.addEventListener("change", () => Api.setActiveChapterId(chapterSelect.value));
      $("#inline-refresh-chapters").addEventListener("click", loadChapters);

      $("#inline-chapter-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const seriesId = seriesSelect.value;
        if (!seriesId) return alert("Select a series first.");
        try {
          const scriptText = $("#inline-chapter-script")?.value.trim() || "";
          const createdChapter = await Api.createChapter({
            seriesId: Number(seriesId),
            chapterNumber: Number($("#inline-chapter-number").value),
            title: $("#inline-chapter-title").value.trim()
          });

          const createdChapterId = createdChapter?.id || createdChapter?.chapterId;
          if (createdChapterId && scriptText) {
            Api.saveChapterScript?.(createdChapterId, scriptText);
          }

          event.target.reset();
          await loadChapters();
        } catch (error) {
          alert("Create chapter failed: " + error.message);
        }
      });

      $("#inline-page-upload-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const chapterId = chapterSelect.value;
        const files = Array.from($("#inline-page-files").files || []);
        let pageNumber = Number($("#inline-start-page-number").value || 1);
        if (!chapterId) return alert("Select a chapter first.");
        if (!files.length) return alert("Choose image files first.");

        uploadLog.innerHTML = "";
        for (const file of files) {
          try {
            uploadLog.innerHTML += `<div>Uploading page ${pageNumber}: ${esc(file.name)}...</div>`;
            await Api.createPage(chapterId, pageNumber, file);
            uploadLog.innerHTML += `<div class="log-ok">✓ Uploaded page ${pageNumber}</div>`;
          } catch (error) {
            uploadLog.innerHTML += `<div class="log-error">✕ Page ${pageNumber}: ${esc(error.message)}</div>`;
          }
          pageNumber += 1;
        }
        await loadChapters();
      });

      loadSeries();
    }

    async function renderCanvas() {
      inlinePanel.innerHTML = `
        ${panelHeader("Canvas Workspace", "Draw hitboxes and assign Assistant tasks directly inside the dashboard.", `<button class="btn-outline" data-dashboard-panel="chapters"><i class="fa-solid fa-layer-group"></i> Manage Chapters</button>`)}
        <div class="toolbar-row">
          <select id="inline-canvas-series" class="form-control"></select>
          <select id="inline-canvas-chapter" class="form-control"></select>
          <select id="inline-canvas-page" class="form-control"></select>
          <button id="inline-load-page" class="btn-publish">Load Page</button>
        </div>
        <div class="inline-workspace-split">
          <div class="card-box">
            <div class="section-title-row">
              <h3>Canvas</h3>
              <div class="section-actions">
                <span class="muted-note">Drag on the image to draw a hitbox</span>
                <button id="btn-cancel-draw" class="btn-outline" type="button" style="display:none; padding:4px 8px; font-size:12px; border-color:#ef4444; color:#ef4444;">✖ Cancel Draw</button>
              </div>
            </div>
            <div id="inline-canvas-stage" class="hitbox-stage"><div class="empty-state-box">Select a page to start.</div></div>
          </div>
          <div class="card-box">
            <h3>Create Task From Hitbox</h3>
            <form id="inline-hitbox-task-form" class="feature-form">
              <div class="form-row">
                <div class="form-group"><label>X %</label><input id="inline-box-x" class="form-control" type="number" step="0.01" readonly></div>
                <div class="form-group"><label>Y %</label><input id="inline-box-y" class="form-control" type="number" step="0.01" readonly></div>
              </div>
              <div class="form-row">
                <div class="form-group"><label>W %</label><input id="inline-box-w" class="form-control" type="number" step="0.01" readonly></div>
                <div class="form-group"><label>H %</label><input id="inline-box-h" class="form-control" type="number" step="0.01" readonly></div>
              </div>
              <div class="form-group"><label>Assistant</label><select id="inline-assistant-select" class="form-control"></select></div>
              <div class="form-group">
                <label>Scheduled Deadline Date</label>
                <input id="inline-task-deadline" class="form-control" type="date">
                <small class="muted-note">Optional: this will be added to the Assistant task and shown on the Schedule page.</small>
              </div>
              <div class="form-group">
                <label>Task Description</label>
                <textarea id="inline-task-desc" class="form-control" required placeholder="Describe the work..."></textarea>
                <small id="inline-chapter-script-hint" class="muted-note"></small>
              </div>
              <button class="btn-publish" type="submit">Create Hitbox Task</button>
            </form>
            <div id="inline-workspace-log" class="upload-log"></div>
          </div>
        </div>`;

      $("[data-dashboard-panel='chapters']")?.addEventListener("click", (event) => {
        event.preventDefault();
        showPanel("chapters");
      });

      const state = { series: [], chapters: [], pages: [], lastBox: null };

      function updateChapterScriptHint() {
        const chapterId = $("#inline-canvas-chapter")?.value;
        const chapter = state.chapters.find((c) => String(c.id ?? c.chapterId) === String(chapterId));
        const scriptText = chapter?.script || chapter?.scriptText || chapter?.content || Api.getChapterScript?.(chapterId) || "";
        const hint = $("#inline-chapter-script-hint");
        if (hint) {
          hint.innerHTML = scriptText
            ? `<i class="fa-solid fa-scroll"></i> Chapter script available. It will be appended to the task note.`
            : "";
        }
      }

      async function loadSeries() {
        state.series = await loadMangakaSeriesList();
        $("#inline-canvas-series").innerHTML = state.series.map((s) => `<option value="${s.id ?? s.seriesId}">${esc(s.title || s.name || `Series #${s.id ?? s.seriesId}`)}</option>`).join("") || `<option value="">No series</option>`;
        const activeSeriesId = Api.getActiveSeriesId();
        if (activeSeriesId && state.series.some((s) => String(s.id ?? s.seriesId) === String(activeSeriesId))) {
          $("#inline-canvas-series").value = activeSeriesId;
        } else if (state.series[0]) {
          $("#inline-canvas-series").value = String(state.series[0].id ?? state.series[0].seriesId);
          Api.setActiveSeriesId(state.series[0].id ?? state.series[0].seriesId);
        }
        await loadChapters();
      }

      async function loadChapters() {
        const seriesId = $("#inline-canvas-series").value;
        Api.setActiveSeriesId(seriesId);
        state.chapters = seriesId ? await enrichChaptersWithPages(await Api.chapters(seriesId).catch(() => [])) : [];
        $("#inline-canvas-chapter").innerHTML = state.chapters.map((c) => `<option value="${c.id ?? c.chapterId}">Ch. ${c.chapterNumber ?? c.chapter_number ?? "?"} — ${esc(c.title || "Untitled")}</option>`).join("") || `<option value="">No chapters</option>`;
        const activeChapterId = Api.getActiveChapterId();
        if (activeChapterId && state.chapters.some((c) => String(c.id ?? c.chapterId) === String(activeChapterId))) {
          $("#inline-canvas-chapter").value = activeChapterId;
        } else if (state.chapters[0]) {
          const firstChapterId = state.chapters[0].id ?? state.chapters[0].chapterId;
          $("#inline-canvas-chapter").value = String(firstChapterId);
          Api.setActiveChapterId(firstChapterId);
        }
        updateChapterScriptHint();
        await loadPages();
      }

      async function loadPages() {
        const chapterId = $("#inline-canvas-chapter").value;
        Api.setActiveChapterId(chapterId);
        state.pages = chapterId ? getArray(await Api.pages(chapterId).catch(() => [])) : [];
        $("#inline-canvas-page").innerHTML = state.pages.map((p) => `<option value="${p.id ?? p.pageId}">Page ${p.pageNumber ?? p.page_number ?? p.id ?? p.pageId}</option>`).join("") || `<option value="">No pages</option>`;
        const activePageId = Api.getActivePageId();
        if (activePageId && state.pages.some((p) => String(p.id ?? p.pageId) === String(activePageId))) {
          $("#inline-canvas-page").value = activePageId;
        } else if (state.pages[0]) {
          const firstPageId = state.pages[0].id ?? state.pages[0].pageId;
          $("#inline-canvas-page").value = String(firstPageId);
          Api.setActivePageId(firstPageId);
        }
        await renderPage();
      }

      async function loadAssistants() {
        const assistants = getArray(await Api.assistants().catch(() => []));
        $("#inline-assistant-select").innerHTML = assistants.map((u) => `<option value="${u.id}">${esc(u.fullName || u.username || u.email || `Assistant #${u.id}`)}</option>`).join("") || `<option value="">No assistants found</option>`;
      }

      function drawBox(box, className = "drawn-hitbox") {
        const el = document.createElement("div");
        el.className = className;
        el.style.left = `${box.x}%`;
        el.style.top = `${box.y}%`;
        el.style.width = `${box.width}%`;
        el.style.height = `${box.height}%`;
        return el;
      }

      function resetDrawnBox(layer = $("#inline-hitbox-layer")) {
        layer?.querySelector(".drawn-hitbox")?.remove();
        state.lastBox = null;
        ["#inline-box-x", "#inline-box-y", "#inline-box-w", "#inline-box-h"].forEach((selector) => {
          const input = $(selector);
          if (input) input.value = "";
        });
        const cancelButton = $("#btn-cancel-draw");
        if (cancelButton) cancelButton.style.display = "none";
      }

      function hitboxIdOf(hitbox = {}) {
        return hitbox.id ?? hitbox.hitboxId ?? hitbox.hitbox_id ?? "";
      }

      function taskIdFromHitbox(hitbox = {}) {
        return hitbox.taskId ?? hitbox.task_id ?? hitbox.task?.id ?? hitbox.task?.taskId ?? "";
      }

      async function deleteSavedHitbox(hitbox = {}) {
        const hitboxId = hitboxIdOf(hitbox);
        const taskId = taskIdFromHitbox(hitbox);

        const attempts = [];
        if (hitboxId) {
          attempts.push(`/workspace/hitboxes/${hitboxId}`);
          attempts.push(`/hitboxes/${hitboxId}`);
        }
        if (taskId) {
          attempts.push(`/tasks/${taskId}`);
        }

        let lastError = null;
        for (const path of attempts) {
          try {
            await Api.apiFetch(path, { method: "DELETE" });
            return true;
          } catch (error) {
            lastError = error;
          }
        }

        throw lastError || new Error("No delete endpoint was available for this hitbox.");
      }

      function attachSavedHitboxDeleteButton(el, hitbox) {
        const hitboxId = hitboxIdOf(hitbox);
        const taskId = taskIdFromHitbox(hitbox);
        if (!hitboxId && !taskId) return el;

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.innerHTML = "✖";
        delBtn.className = "delete-hitbox-btn";
        delBtn.title = "Delete this hitbox";
        delBtn.style.cssText = "position:absolute; top:-12px; right:-12px; background:#ef4444; color:white; width:24px; height:24px; border:0; border-radius:50%; text-align:center; line-height:24px; cursor:pointer; pointer-events:auto; font-size:12px; z-index:20; box-shadow:0 2px 4px rgba(0,0,0,0.3);";

        delBtn.addEventListener("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();

          if (!confirm("Delete this hitbox/task? This action depends on backend delete support.")) return;

          const log = $("#inline-workspace-log");
          try {
            await deleteSavedHitbox(hitbox);
            el.remove();
            if (log) log.innerHTML = `<div class="log-ok">✓ Hitbox deleted.</div>`;
          } catch (error) {
            if (log) log.innerHTML = `<div class="log-error">✕ Delete failed: ${esc(error.message)}</div>`;
            else alert("Delete failed: " + error.message);
          }
        });

        el.appendChild(delBtn);
        return el;
      }

      function setBox(box) {
        state.lastBox = box;
        $("#inline-box-x").value = box.x.toFixed(2);
        $("#inline-box-y").value = box.y.toFixed(2);
        $("#inline-box-w").value = box.width.toFixed(2);
        $("#inline-box-h").value = box.height.toFixed(2);
      }

      async function renderPage() {
        const pageId = $("#inline-canvas-page").value;
        const stage = $("#inline-canvas-stage");
        const cancelButton = $("#btn-cancel-draw");
        Api.setActivePageId(pageId);
        state.lastBox = null;
        if (cancelButton) {
          cancelButton.style.display = "none";
          cancelButton.onclick = () => resetDrawnBox();
        }

        if (!pageId) {
          stage.innerHTML = `<div class="empty-state-box">No pages uploaded for this chapter.</div>`;
          return;
        }

        const canvas = await Api.canvasInit(pageId).catch(() => {
          const p = state.pages.find((item) => String(item.id) === String(pageId));
          return p ? { imageUrl: p.imageUrl || p.fileUrl || p.url, hitboxes: [] } : null;
        });

        const canvasImageUrl = pageImageOf(canvas);
        state.currentCanvas = canvas;
        state.currentPageImageUrl = canvasImageUrl;

        if (!canvasImageUrl) {
          stage.innerHTML = `<div class="empty-state-box">This page has no image URL.</div>`;
          return;
        }

        stage.innerHTML = `<div class="hitbox-image-wrap" id="inline-hitbox-wrap"><img src="${esc(canvasImageUrl)}" alt="Manga page"><div id="inline-hitbox-layer"></div></div>`;
        const layer = $("#inline-hitbox-layer");

        getArray(canvas.hitboxes).forEach((h) => {
          const saved = drawBox({
            x: pct(h.x ?? h.xCoord ?? h.x_coord),
            y: pct(h.y ?? h.yCoord ?? h.y_coord),
            width: pct(h.width ?? 10),
            height: pct(h.height ?? 10),
          }, "saved-hitbox");
          layer.appendChild(attachSavedHitboxDeleteButton(saved, h));
        });

        let start = null;
        const wrap = $("#inline-hitbox-wrap");
        wrap.addEventListener("pointerdown", (event) => {
          if (event.target?.classList?.contains("delete-hitbox-btn")) return;
          const rect = wrap.getBoundingClientRect();
          start = { x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 };
          layer.querySelector(".drawn-hitbox")?.remove();
          if (cancelButton) cancelButton.style.display = "inline-flex";
          wrap.setPointerCapture?.(event.pointerId);
        });
        wrap.addEventListener("pointermove", (event) => {
          if (!start) return;
          const rect = wrap.getBoundingClientRect();
          const current = { x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 };
          const box = {
            x: pct(Math.min(start.x, current.x)),
            y: pct(Math.min(start.y, current.y)),
            width: pct(Math.abs(current.x - start.x)),
            height: pct(Math.abs(current.y - start.y)),
          };
          layer.querySelector(".drawn-hitbox")?.remove();
          layer.appendChild(drawBox(box));
          setBox(box);
        });
        wrap.addEventListener("pointerup", () => { start = null; });
      }

      $("#inline-canvas-series").addEventListener("change", loadChapters);
      $("#inline-canvas-chapter").addEventListener("change", () => { updateChapterScriptHint(); loadPages(); });
      $("#inline-canvas-page").addEventListener("change", renderPage);
      $("#inline-load-page").addEventListener("click", renderPage);

      $("#inline-hitbox-task-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const pageId = $("#inline-canvas-page").value;
        const assistantId = $("#inline-assistant-select").value;
        const description = $("#inline-task-desc").value.trim();
        const log = $("#inline-workspace-log");

        if (!pageId || !state.lastBox) return alert("Draw a hitbox first.");
        if (!description) return alert("Enter task description.");

        const chapterId = $("#inline-canvas-chapter")?.value;
        const chapter = state.chapters.find((c) => String(c.id ?? c.chapterId) === String(chapterId));
        const chapterScript = chapter?.script || chapter?.scriptText || chapter?.content || Api.getChapterScript?.(chapterId) || "";
        const deadlineDate = $("#inline-task-deadline")?.value || "";
        const taskDescription = [
          description,
          deadlineDate ? `Deadline: ${deadlineDate}` : "",
          chapterScript ? `\n--- Chapter Script / Notes ---\n${chapterScript}` : ""
        ].filter(Boolean).join("\n");

        try {
          const hitbox = await Api.createHitbox(pageId, state.lastBox);
          const hitboxId = hitbox?.id || hitbox?.hitboxId || hitbox;
          const task = await Api.assignTaskToHitbox(hitboxId, taskDescription);
          const taskId = task?.id || task?.taskId;
          if (taskId && assistantId) {
            await Api.assignTask(taskId, assistantId);
            const selectedAssistant = $("#inline-assistant-select")?.selectedOptions?.[0]?.textContent?.trim() || "";
            rememberTaskAssistant(taskId, assistantId, selectedAssistant);
          }

          if (taskId) {
            const selectedPage = state.pages.find((page) => String(page.id ?? page.pageId) === String(pageId));
            const selectedSeries = state.series.find((series) => String(series.id ?? series.seriesId) === String($("#inline-canvas-series")?.value || ""));
            rememberTaskReference(taskId, {
              pageId,
              chapterId,
              seriesId: $("#inline-canvas-series")?.value || "",
              imageUrl: state.currentPageImageUrl || pageImageOf(selectedPage) || pageImageOf(state.currentCanvas),
              pageNumber: selectedPage?.pageNumber ?? selectedPage?.number ?? "",
              seriesTitle: selectedSeries?.title || selectedSeries?.name || "",
              chapterTitle: chapter?.title || "",
              hitbox: state.lastBox
            });
          }

          if (deadlineDate) {
            const seriesId = $("#inline-canvas-series")?.value || Api.getActiveSeriesId?.();
            const selectedSeries = state.series.find((s) => String(s.id ?? s.seriesId) === String(seriesId));
            const selectedAssistant = $("#inline-assistant-select")?.selectedOptions?.[0]?.textContent?.trim() || "";
            const title = `Task ${taskId ? `#${taskId}` : ""}: ${description.slice(0, 70)}`;

            Api.addScheduleItem?.({
              type: "TASK_DEADLINE",
              source: "MANGAKA_CANVAS",
              title,
              description: taskDescription,
              deadlineDate,
              date: deadlineDate,
              seriesId,
              seriesTitle: selectedSeries?.title || selectedSeries?.name || "",
              chapterId,
              chapterTitle: chapter?.title || "",
              pageId,
              taskId,
              assistantId,
              assistantName: selectedAssistant,
              status: "OPEN"
            });

            if (seriesId && Api.createDeadline) {
              Api.createDeadline(seriesId, title, deadlineDate).catch((deadlineError) => {
                console.warn("Backend deadline creation failed; local schedule item was saved.", deadlineError);
              });
            }
          }

          log.innerHTML = `<div class="log-ok">✓ Hitbox task created successfully${deadlineDate ? " with scheduled deadline." : "."}</div>`;
          resetDrawnBox();
          await renderPage();
        } catch (error) {
          log.innerHTML = `<div class="log-error">✕ ${esc(error.message)}</div>`;
        }
      });

      Promise.all([loadSeries(), loadAssistants()]);
    }


    function scheduleToast(message, type = "info") {
      if (window.showToast) window.showToast(message, type);
      else console.log(`[${type}] ${message}`);
    }

    function scheduleSeriesId(series = {}) {
      return series.id ?? series.seriesId ?? series.mangaSeriesId ?? "";
    }

    function scheduleSeriesTitle(series = {}) {
      return series.title || series.name || series.seriesTitle || `Series #${scheduleSeriesId(series)}`;
    }

    function asScheduleArray(payload) {
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.content)) return payload.content;
      if (Array.isArray(payload?.data)) return payload.data;
      if (Array.isArray(payload?.data?.content)) return payload.data.content;
      if (Array.isArray(payload?.items)) return payload.items;
      return [];
    }

    function activeScheduleSeriesId(scheduleState) {
      return $("#dash-schedule-series")?.value ||
        Api.getActiveSeriesId?.() ||
        localStorage.getItem("activeSeriesId") ||
        scheduleSeriesId(scheduleState.series[0]) ||
        "";
    }

    function localScheduleKey(seriesId) {
      return `mangakaScheduleLocal:${seriesId}`;
    }

    function getLocalSchedules(seriesId) {
      try { return JSON.parse(localStorage.getItem(localScheduleKey(seriesId)) || "[]"); }
      catch (_) { return []; }
    }

    function saveLocalSchedules(seriesId, list) {
      localStorage.setItem(localScheduleKey(seriesId), JSON.stringify(list || []));
    }

    function addLocalSchedule(seriesId, item) {
      const saved = { id: `local-schedule-${Date.now()}`, source: "LOCAL_SCHEDULE", seriesId, ...item };
      saveLocalSchedules(seriesId, [saved, ...getLocalSchedules(seriesId)]);
      return saved;
    }

    function removeLocalSchedule(seriesId, id) {
      saveLocalSchedules(seriesId, getLocalSchedules(seriesId).filter(item => String(item.id) !== String(id)));
    }

    function localDeadlineKey(seriesId) {
      return `mangakaDeadlineLocal:${seriesId}`;
    }

    function getLocalDeadlines(seriesId) {
      try { return JSON.parse(localStorage.getItem(localDeadlineKey(seriesId)) || "[]"); }
      catch (_) { return []; }
    }

    function saveLocalDeadlines(seriesId, list) {
      localStorage.setItem(localDeadlineKey(seriesId), JSON.stringify(list || []));
    }

    function addLocalDeadline(seriesId, item) {
      const saved = { id: `local-deadline-${Date.now()}`, source: "LOCAL_DEADLINE", seriesId, ...item };
      saveLocalDeadlines(seriesId, [saved, ...getLocalDeadlines(seriesId)]);
      return saved;
    }

    function removeLocalDeadline(seriesId, id) {
      saveLocalDeadlines(seriesId, getLocalDeadlines(seriesId).filter(item => String(item.id) !== String(id)));
    }

    function getSharedScheduleItems() {
      try { return Api.getScheduleItems?.() || []; }
      catch (_) { return []; }
    }

    function sharedItemsForSeries(seriesId, types = []) {
      const allowed = new Set(types);
      return getSharedScheduleItems().filter((item) => {
        if (String(item.seriesId || item.mangaSeriesId || "") !== String(seriesId)) return false;
        return !allowed.size || allowed.has(String(item.type || item.source || "").toUpperCase());
      });
    }

    function dedupeScheduleRows(rows = []) {
      const seen = new Set();
      return rows.filter((row) => {
        const key = [
          row.id || row.scheduleId || row.eventId || "",
          row.type || row.source || "",
          row.publishDate || row.deadlineDate || row.deadlineDateStr || row.date || "",
          row.frequency || row.eventName || row.title || ""
        ].join("|");
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    function fmtScheduleDate(value) {
      if (!value) return "—";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return String(value).replace("T", " ");
      return date.toLocaleString();
    }

    function scheduleDaysUntil(value) {
      if (!value) return null;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const target = new Date(value);
      if (Number.isNaN(target.getTime())) return null;
      target.setHours(0, 0, 0, 0);
      return Math.round((target - today) / 86400000);
    }

    function deadlineRisk(deadline) {
      const explicit = deadline.warningLevel || deadline.risk || deadline.status;
      if (explicit) return explicit;
      const days = scheduleDaysUntil(deadline.deadlineDate || deadline.deadlineDateStr || deadline.date);
      if (days === null) return "Normal";
      if (days < 0) return "Overdue";
      if (days <= 2) return "High";
      if (days <= 7) return "Medium";
      return "Normal";
    }

    function scheduleBadge(value = "") {
      const text = String(value || "—");
      const normalized = text.toUpperCase();
      let klass = "neutral";
      if (/OVERDUE|HIGH|DANGER|LATE/.test(normalized)) klass = "danger";
      else if (/MEDIUM|WARNING|SOON/.test(normalized)) klass = "warning";
      else if (/LOW|NORMAL|OPEN|WEEKLY|ACTIVE/.test(normalized)) klass = "success";
      return `<span class="schedule-badge ${klass}">${esc(text)}</span>`;
    }

    async function loadScheduleSeries(scheduleState) {
      scheduleState.series = await loadMangakaSeriesList();
      const selected = Api.getActiveSeriesId?.() || localStorage.getItem("activeSeriesId") || "";
      if (scheduleState.series.length && !scheduleState.series.some((series) => String(scheduleSeriesId(series)) === String(selected))) {
        Api.setActiveSeriesId?.(scheduleSeriesId(scheduleState.series[0]));
      }
    }

    async function loadDashboardSchedules(scheduleState) {
      const seriesId = activeScheduleSeriesId(scheduleState);
      let schedules = [];
      if (!seriesId) {
        scheduleState.schedules = [];
        return;
      }

      try {
        schedules = asScheduleArray(await Api.schedules?.(seriesId));
      } catch (error) {
        console.warn("Could not load backend schedules.", error.message);
      }

      const sharedSchedules = sharedItemsForSeries(seriesId, ["PUBLISHING_SCHEDULE", "MANGAKA_SCHEDULE", "LOCAL_SCHEDULE"]).map((item) => ({
        ...item,
        publishDate: item.publishDate || item.date || item.scheduledDate,
        frequency: item.frequency || item.repeatType || "Weekly"
      }));

      scheduleState.schedules = dedupeScheduleRows([...schedules, ...getLocalSchedules(seriesId), ...sharedSchedules]);
    }

    async function loadDashboardDeadlines(scheduleState) {
      const seriesId = activeScheduleSeriesId(scheduleState);
      let deadlines = [];
      if (!seriesId) {
        scheduleState.deadlines = [];
        return;
      }

      try {
        deadlines = asScheduleArray(await Api.deadlines?.(seriesId));
      } catch (error) {
        console.warn("Could not load backend deadlines.", error.message);
      }

      const sharedDeadlines = sharedItemsForSeries(seriesId, ["DEADLINE", "TASK_DEADLINE", "MANGAKA_DEADLINE", "LOCAL_DEADLINE"]).map((item) => ({
        ...item,
        eventName: item.eventName || item.title || item.description || "Task deadline",
        deadlineDateStr: item.deadlineDateStr || item.deadlineDate || item.date || item.dueDate,
        status: item.status || "OPEN"
      }));

      scheduleState.deadlines = dedupeScheduleRows([...deadlines, ...getLocalDeadlines(seriesId), ...sharedDeadlines]);
    }

    function filterScheduleRows(rows, scheduleState) {
      const needle = String(scheduleState.search || "").trim().toLowerCase();
      if (!needle) return rows;
      return rows.filter(row => JSON.stringify(row).toLowerCase().includes(needle));
    }

    function renderScheduleSeriesPicker(scheduleState) {
      const select = $("#dash-schedule-series");
      if (!select) return;

      if (!scheduleState.series.length) {
        select.innerHTML = `<option value="">No owned series found</option>`;
        select.disabled = true;
        return;
      }

      const selected = activeScheduleSeriesId(scheduleState);
      select.disabled = false;
      select.innerHTML = scheduleState.series.map((series) => {
        const id = scheduleSeriesId(series);
        return `<option value="${esc(id)}" ${String(id) === String(selected) ? "selected" : ""}>#${esc(id)} — ${esc(scheduleSeriesTitle(series))}</option>`;
      }).join("");
    }

    function renderScheduleCalendarTable(scheduleState) {
      const body = $("#dash-calendar-table-body");
      const count = $("#dash-calendar-count");
      if (!body) return;

      const seriesId = activeScheduleSeriesId(scheduleState);
      const series = scheduleState.series.find(s => String(scheduleSeriesId(s)) === String(seriesId)) || scheduleState.series[0] || {};
      const rows = filterScheduleRows(scheduleState.schedules, scheduleState);
      if (count) count.textContent = String(rows.length);

      if (!seriesId) {
        body.innerHTML = `<tr><td colspan="4">Create a series first.</td></tr>`;
        return;
      }

      if (!rows.length) {
        body.innerHTML = `<tr><td colspan="4">No schedule for selected series.</td></tr>`;
        return;
      }

      body.innerHTML = rows.map((item) => {
        const id = item.id ?? item.scheduleId;
        const isLocal = String(id).startsWith("local-schedule") || item.source === "LOCAL_SCHEDULE";
        return `<tr>
          <td>${esc(fmtScheduleDate(item.publishDate || item.date || item.scheduledDate))}</td>
          <td>${esc(item.frequency || item.repeatType || "—")}</td>
          <td>${esc(scheduleSeriesTitle(series))}</td>
          <td><button class="btn-outline dash-delete-schedule" data-id="${esc(id)}" data-local="${isLocal}">Delete</button></td>
        </tr>`;
      }).join("");

      $$(".dash-delete-schedule").forEach((button) => {
        button.addEventListener("click", async () => {
          if (!confirm("Delete this schedule?")) return;
          const activeId = activeScheduleSeriesId(scheduleState);
          try {
            if (button.dataset.local === "true") removeLocalSchedule(activeId, button.dataset.id);
            else await Api.deleteSchedule?.(button.dataset.id);
            scheduleToast("Schedule deleted.", "success");
          } catch (error) {
            scheduleToast(error.message, "error");
          }
          await refreshDashboardSchedule(scheduleState);
        });
      });
    }

    function renderScheduleDeadlineTable(scheduleState) {
      const body = $("#dash-deadline-table-body");
      const count = $("#dash-deadline-count");
      if (!body) return;

      const rows = filterScheduleRows(scheduleState.deadlines, scheduleState);
      if (count) count.textContent = String(rows.length);

      if (!activeScheduleSeriesId(scheduleState)) {
        body.innerHTML = `<tr><td colspan="4">Create a series first.</td></tr>`;
        return;
      }

      if (!rows.length) {
        body.innerHTML = `<tr><td colspan="4">No deadlines for selected series.</td></tr>`;
        return;
      }

      body.innerHTML = rows.map((item) => {
        const id = item.id ?? item.eventId;
        const isLocal = String(id).startsWith("local-deadline") || item.source === "LOCAL_DEADLINE";
        return `<tr>
          <td>${esc(item.eventName || item.title || "Untitled deadline")}</td>
          <td>${esc(fmtScheduleDate(item.deadlineDate || item.deadlineDateStr || item.date))}</td>
          <td>${scheduleBadge(deadlineRisk(item))}</td>
          <td><button class="btn-outline dash-delete-deadline" data-id="${esc(id)}" data-local="${isLocal}">Delete</button></td>
        </tr>`;
      }).join("");

      $$(".dash-delete-deadline").forEach((button) => {
        button.addEventListener("click", async () => {
          if (!confirm("Delete this deadline?")) return;
          const activeId = activeScheduleSeriesId(scheduleState);
          try {
            if (button.dataset.local === "true") removeLocalDeadline(activeId, button.dataset.id);
            else await Api.deleteDeadline?.(button.dataset.id);
            scheduleToast("Deadline deleted.", "success");
          } catch (error) {
            scheduleToast(error.message, "error");
          }
          await refreshDashboardSchedule(scheduleState);
        });
      });
    }

    function renderDashboardScheduleTables(scheduleState) {
      renderScheduleSeriesPicker(scheduleState);
      renderScheduleCalendarTable(scheduleState);
      renderScheduleDeadlineTable(scheduleState);
    }

    async function refreshDashboardSchedule(scheduleState) {
      const calendarBody = $("#dash-calendar-table-body");
      const deadlineBody = $("#dash-deadline-table-body");
      if (calendarBody) calendarBody.innerHTML = `<tr><td colspan="4">Loading schedules...</td></tr>`;
      if (deadlineBody) deadlineBody.innerHTML = `<tr><td colspan="4">Loading deadlines...</td></tr>`;
      await Promise.all([loadDashboardSchedules(scheduleState), loadDashboardDeadlines(scheduleState)]);
      renderDashboardScheduleTables(scheduleState);
    }

    function setDashboardScheduleTab(tab) {
      $$(".dashboard-schedule-tab").forEach(button => button.classList.toggle("active", button.dataset.tab === tab));
      $$(".dashboard-schedule-panel").forEach(panel => panel.classList.toggle("active", panel.id === `dash-${tab}-panel`));
    }

    async function createDashboardSchedule(scheduleState) {
      const seriesId = activeScheduleSeriesId(scheduleState);
      const publishDate = $("#dash-schedule-date")?.value || "";
      const frequency = $("#dash-schedule-frequency")?.value.trim() || "Weekly";
      if (!seriesId) return scheduleToast("Select a series first.", "error");
      if (!publishDate) return scheduleToast("Choose a publish date.", "error");

      try {
        await Api.createSchedule?.({ seriesId: Number(seriesId), publishDate, frequency });
        scheduleToast("Schedule saved.", "success");
      } catch (error) {
        console.warn("Backend schedule create failed; saving local schedule.", error.message);
        const activeSeries = scheduleState.series.find(s => String(scheduleSeriesId(s)) === String(seriesId));
        addLocalSchedule(seriesId, { publishDate, frequency, status: "OPEN" });
        Api.addScheduleItem?.({
          type: "PUBLISHING_SCHEDULE",
          source: "MANGAKA_SCHEDULE",
          title: `Publishing schedule: ${activeSeries ? scheduleSeriesTitle(activeSeries) : `Series #${seriesId}`}`,
          publishDate,
          date: publishDate,
          frequency,
          seriesId,
          seriesTitle: activeSeries ? scheduleSeriesTitle(activeSeries) : `Series #${seriesId}`,
          status: "OPEN"
        });
        scheduleToast("Backend rejected schedule, so it was saved locally for this browser.", "info");
      }

      $("#dash-schedule-date").value = "";
      $("#dash-schedule-frequency").value = "Weekly";
      await refreshDashboardSchedule(scheduleState);
    }

    async function createDashboardDeadline(scheduleState) {
      const seriesId = activeScheduleSeriesId(scheduleState);
      const eventName = $("#dash-deadline-name")?.value.trim() || "";
      const deadlineDate = $("#dash-deadline-date")?.value || "";
      if (!seriesId) return scheduleToast("Select a series first.", "error");
      if (!eventName) return scheduleToast("Enter an event name.", "error");
      if (!deadlineDate) return scheduleToast("Choose a deadline date.", "error");

      try {
        await Api.createDeadline?.(seriesId, eventName, deadlineDate);
        scheduleToast("Deadline saved.", "success");
      } catch (error) {
        console.warn("Backend deadline create failed; saving local deadline.", error.message);
        const activeSeries = scheduleState.series.find(s => String(scheduleSeriesId(s)) === String(seriesId));
        addLocalDeadline(seriesId, { eventName, deadlineDateStr: deadlineDate, status: "OPEN" });
        Api.addScheduleItem?.({
          type: "DEADLINE",
          source: "MANGAKA_DEADLINE",
          title: eventName,
          eventName,
          deadlineDate,
          deadlineDateStr: deadlineDate,
          date: deadlineDate,
          seriesId,
          seriesTitle: activeSeries ? scheduleSeriesTitle(activeSeries) : `Series #${seriesId}`,
          status: "OPEN"
        });
        scheduleToast("Backend rejected deadline, so it was saved locally for this browser.", "info");
      }

      $("#dash-deadline-name").value = "";
      $("#dash-deadline-date").value = "";
      await refreshDashboardSchedule(scheduleState);
    }

    async function renderSchedule() {
      const scheduleState = {
        series: [],
        schedules: [],
        deadlines: [],
        search: ""
      };

      inlinePanel.innerHTML = `
        ${panelHeader("Mangaka Schedule", "Manage publishing schedules and deadline warnings inside the Mangaka dashboard.", `<button id="dash-schedule-refresh" class="btn-publish"><i class="fa-solid fa-rotate"></i> Refresh</button>`)}
        <div class="dashboard-schedule-shell">
          <div class="dashboard-schedule-tabs">
            <button type="button" class="dashboard-schedule-tab active" data-tab="calendar"><i class="fa-solid fa-calendar-days"></i> Publishing Calendar</button>
            <button type="button" class="dashboard-schedule-tab" data-tab="deadlines"><i class="fa-solid fa-triangle-exclamation"></i> Deadline Monitor</button>
          </div>

          <div class="toolbar-row dashboard-schedule-toolbar">
            <select id="dash-schedule-series" class="form-control"></select>
            <input id="dash-schedule-search" class="form-control" type="search" placeholder="Search schedules or deadlines...">
          </div>

          <div id="dash-calendar-panel" class="dashboard-schedule-panel active">
            <div class="inline-feature-grid two-cols dashboard-schedule-grid">
              <div class="card-box">
                <div class="section-title-row">
                  <h3>Publishing Calendar</h3>
                  <span id="dash-calendar-count" class="schedule-count">0 schedules</span>
                </div>
                <p class="muted-note">Track and create publishing schedules by selected owned series.</p>
                <table class="data-table dashboard-schedule-table">
                  <thead><tr><th>Publish Date</th><th>Frequency</th><th>Series</th><th>Action</th></tr></thead>
                  <tbody id="dash-calendar-table-body"><tr><td colspan="4">Loading schedules...</td></tr></tbody>
                </table>
              </div>

              <div class="card-box">
                <h3>Add Schedule</h3>
                <div class="feature-form">
                  <div class="form-group"><label>Publish Date</label><input id="dash-schedule-date" class="form-control" type="datetime-local"></div>
                  <div class="form-group"><label>Frequency</label><input id="dash-schedule-frequency" class="form-control" value="Weekly" placeholder="Weekly"></div>
                  <button id="dash-create-schedule" class="btn-publish" type="button">Save Schedule</button>
                </div>
              </div>
            </div>
          </div>

          <div id="dash-deadlines-panel" class="dashboard-schedule-panel">
            <div class="inline-feature-grid two-cols dashboard-schedule-grid">
              <div class="card-box">
                <div class="section-title-row">
                  <h3>Deadline Monitor</h3>
                  <span id="dash-deadline-count" class="schedule-count">0 deadlines</span>
                </div>
                <p class="muted-note">Create and monitor color-coded deadline warnings for the selected owned series.</p>
                <table class="data-table dashboard-schedule-table">
                  <thead><tr><th>Task/Event</th><th>Deadline</th><th>Risk</th><th>Action</th></tr></thead>
                  <tbody id="dash-deadline-table-body"><tr><td colspan="4">Loading deadlines...</td></tr></tbody>
                </table>
              </div>

              <div class="card-box">
                <h3>Add Deadline</h3>
                <div class="feature-form">
                  <div class="form-group"><label>Event Name</label><input id="dash-deadline-name" class="form-control" placeholder="Chapter review due"></div>
                  <div class="form-group"><label>Deadline Date</label><input id="dash-deadline-date" class="form-control" type="datetime-local"></div>
                  <button id="dash-create-deadline" class="btn-publish" type="button">Create Deadline</button>
                </div>
              </div>
            </div>
          </div>
        </div>`;

      $$(".dashboard-schedule-tab").forEach(button => button.addEventListener("click", () => setDashboardScheduleTab(button.dataset.tab)));
      $("#dash-schedule-series")?.addEventListener("change", async (event) => {
        Api.setActiveSeriesId?.(event.target.value);
        await refreshDashboardSchedule(scheduleState);
      });
      $("#dash-schedule-search")?.addEventListener("input", (event) => {
        scheduleState.search = event.target.value || "";
        renderDashboardScheduleTables(scheduleState);
      });
      $("#dash-schedule-refresh")?.addEventListener("click", async () => {
        await loadScheduleSeries(scheduleState);
        await refreshDashboardSchedule(scheduleState);
        scheduleToast("Schedule refreshed.", "success");
      });
      $("#dash-create-schedule")?.addEventListener("click", () => createDashboardSchedule(scheduleState));
      $("#dash-create-deadline")?.addEventListener("click", () => createDashboardDeadline(scheduleState));

      await loadScheduleSeries(scheduleState);
      await refreshDashboardSchedule(scheduleState);
    }


    async function renderKanban() {
      inlinePanel.innerHTML = `
        ${panelHeader("Kanban Board", "Track task workflow directly inside the Mangaka dashboard.", `<button id="inline-refresh-kanban" class="btn-publish"><i class="fa-solid fa-rotate"></i> Refresh</button>`)}
        <div class="kanban-grid backend-kanban">
          <div class="kanban-column" data-status="TODO"><h3>Todo <span id="inline-count-TODO">0</span></h3><div class="kanban-drop" id="inline-col-TODO"></div></div>
          <div class="kanban-column" data-status="DOING"><h3>Doing <span id="inline-count-DOING">0</span></h3><div class="kanban-drop" id="inline-col-DOING"></div></div>
          <div class="kanban-column" data-status="REVIEWING"><h3>Reviewing <span id="inline-count-REVIEWING">0</span></h3><div class="kanban-drop" id="inline-col-REVIEWING"></div></div>
          <div class="kanban-column" data-status="APPROVED"><h3>Approved <span id="inline-count-APPROVED">0</span></h3><div class="kanban-drop" id="inline-col-APPROVED"></div></div>
        </div>`;

      const statuses = ["TODO", "DOING", "REVIEWING", "APPROVED"];
      const normalize = (status) => Api.normalizeTaskStatus ? Api.normalizeTaskStatus(status) : String(status || "TODO").toUpperCase();

      function taskCard(task) {
        const id = task.id ?? task.taskId;
        const status = normalize(task.status);
        const submittedUrl = task.submittedImageUrl || task.submissionUrl || task.imageUrl || "";
        const canReview = status === "REVIEWING" && !!submittedUrl;
        return `<div class="kanban-card backend-task-card ${canReview ? "mangaka-review-card" : ""}" draggable="${canReview ? "false" : "true"}" data-id="${id}" data-review="${canReview}">
          <strong>${esc(task.title || task.description || `Task #${id}`)}</strong>
          <p>${esc(task.description || "")}</p>
          <small>${esc(assistantNameOf(task))} · ${esc(status)}</small>
          ${canReview
            ? `<button type="button" class="mangaka-review-submission-btn" data-task-id="${id}">
                <i class="fa-solid fa-eye"></i> Review Submitted Image
              </button>`
            : ""}
        </div>`;
      }

      async function loadTasks() {
        statuses.forEach((status) => {
          $(`#inline-col-${status}`).innerHTML = loading("Loading...");
          $(`#inline-count-${status}`).textContent = "0";
        });

        try {
          await loadAssistantDirectory();
          const tasks = getArray(await Api.tasks());
          statuses.forEach((status) => {
            const items = tasks.filter((task) => normalize(task.status) === status);
            $(`#inline-count-${status}`).textContent = items.length;
            $(`#inline-col-${status}`).innerHTML = items.length ? items.map(taskCard).join("") : `<div class="empty-column">Drop tasks here</div>`;
          });

          $$(".backend-task-card").forEach((card) => {
            const reviewBtn = card.querySelector(".mangaka-review-submission-btn");
            if (reviewBtn) {
              reviewBtn.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                const taskId = card.dataset.id;
                localStorage.setItem("currentReviewTaskId", taskId);
                localStorage.setItem("currentTaskId", taskId);
                window.location.href = `review.html?taskId=${encodeURIComponent(taskId)}`;
              });
            }

            card.addEventListener("dragstart", (event) => {
              if (card.dataset.review === "true") {
                event.preventDefault();
                return;
              }
              event.dataTransfer.setData("text/plain", card.dataset.id);
            });
          });
        } catch (error) {
          statuses.forEach((status) => {
            $(`#inline-col-${status}`).innerHTML = errorBox(error);
          });
        }
      }

      $$(".kanban-column").forEach((column) => {
        const drop = column.querySelector(".kanban-drop");
        const status = column.dataset.status;
        drop.addEventListener("dragover", (event) => {
          event.preventDefault();
          drop.classList.add("drag-over");
        });
        drop.addEventListener("dragleave", () => drop.classList.remove("drag-over"));
        drop.addEventListener("drop", async (event) => {
          event.preventDefault();
          drop.classList.remove("drag-over");
          const taskId = event.dataTransfer.getData("text/plain");
          if (!taskId) return;
          try {
            await Api.updateTaskStatus(taskId, status);
            await loadTasks();
          } catch (error) {
            alert("Update status failed: " + error.message);
          }
        });
      });


      function imageFromTask(task, type = "submitted") {
        if (type === "submitted") {
          return task.submittedImageUrl || task.submissionUrl || task.imageUrl || "";
        }
        return task.referenceImageUrl || task.pageImageUrl || task.hitbox?.page?.imageUrl || "";
      }

      function openSubmissionReview(task, reloadTasks) {
        const taskId = task.id ?? task.taskId;
        const submittedUrl = imageFromTask(task, "submitted");
        const referenceUrl = imageFromTask(task, "reference");
        const title = task.title || task.description || `Task #${taskId}`;

        const existing = document.getElementById("mangaka-submission-modal");
        if (existing) existing.remove();

        document.body.insertAdjacentHTML("beforeend", `
          <div class="mangaka-submission-modal" id="mangaka-submission-modal">
            <div class="mangaka-submission-dialog">
              <div class="mangaka-submission-header">
                <div>
                  <h2>Review Assistant Submission</h2>
                  <p>${esc(title)}</p>
                </div>
                <button type="button" class="modal-x" id="close-submission-modal"><i class="fa-solid fa-xmark"></i></button>
              </div>

              <div class="mangaka-submission-body">
                <div class="submission-panel">
                  <strong>Submitted Image</strong>
                  ${submittedUrl ? `<img src="${esc(submittedUrl)}" alt="Assistant submitted work">` : `<div class="empty-state-box">No submitted image URL found.</div>`}
                </div>
                <div class="submission-panel">
                  <strong>Original Reference</strong>
                  ${referenceUrl ? `<img src="${esc(referenceUrl)}" alt="Original reference image">` : `<div class="empty-state-box">No original reference image found.</div>`}
                </div>
              </div>

              <div class="mangaka-submission-note">
                <strong>Task Request</strong>
                <p>${esc(task.description || "No task description.")}</p>
              </div>

              <div class="mangaka-submission-actions">
                <button type="button" class="btn-outline" id="request-submission-revision">
                  <i class="fa-solid fa-rotate-left"></i> Request Revision
                </button>
                <button type="button" class="btn-publish" id="approve-submission">
                  <i class="fa-solid fa-check"></i> Approve Submission
                </button>
              </div>
            </div>
          </div>
        `);

        const modal = document.getElementById("mangaka-submission-modal");
        const close = () => modal?.remove();

        document.getElementById("close-submission-modal")?.addEventListener("click", close);
        modal?.addEventListener("click", (event) => {
          if (event.target === modal) close();
        });

        document.getElementById("approve-submission")?.addEventListener("click", async () => {
          try {
            await Api.updateTaskStatus(taskId, "APPROVED");
            close();
            await reloadTasks();
          } catch (error) {
            alert("Approve failed: " + error.message);
          }
        });

        document.getElementById("request-submission-revision")?.addEventListener("click", async () => {
          try {
            await Api.updateTaskStatus(taskId, "DOING");
            close();
            await reloadTasks();
          } catch (error) {
            alert("Request revision failed: " + error.message);
          }
        });
      }

      $("#inline-refresh-kanban").addEventListener("click", loadTasks);
      loadTasks();
    }
  });
})();
