
document.addEventListener("DOMContentLoaded", () => {
  const roleRaw = localStorage.getItem("role") || "";
  const params = new URLSearchParams(location.search);
  const explicitActor = params.get("actor");

  function normalizeRole(role = "") {
    return String(role || "")
      .replace(/^ROLE_/i, "")
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/[\s-]+/g, " ")
      .trim();
  }

  function actorFromRole(role) {
    const normalized = normalizeRole(role);
    if (normalized.includes("admin")) return "admin";
    if (normalized.includes("editorial") || normalized.includes("board")) return "board";
    if (normalized.includes("tantou")) return "tantou";
    if (normalized.includes("assistant")) return "assistant";
    if (normalized.includes("mangaka")) return "mangaka";
    return "mangaka";
  }

  const actor = explicitActor || actorFromRole(roleRaw);

  const configs = {
    mangaka: {
      logo: "MG",
      name: "Mangaka Workspace",
      back: "pages/mangaka/dashboard.html",
      visible: ["chapter-manager.html", "workspace.html", "kanban-board.html"],
      bodyClass: "actor-mangaka",
    },
    assistant: {
      logo: "AS",
      name: "Assistant Workspace",
      back: "pages/assistant/assistant-dashboard.html",
      visible: ["kanban-board.html"],
      bodyClass: "actor-assistant",
    },
    tantou: {
      logo: "TE",
      name: "Tantou Editorial",
      back: "tantou-dashboard.html",
      visible: [],
      bodyClass: "actor-tantou tantou-screen",
    },
    board: {
      logo: "MB",
      name: "Manga Board",
      back: "board-dashboard.html",
      visible: [],
      bodyClass: "actor-board board-screen",
    },
    admin: {
      logo: "AD",
      name: "Admin Console",
      back: "admin-dashboard.html",
      visible: [],
      bodyClass: "actor-admin admin-screen",
    },
  };


  const mangakaInlineTarget = {
    "chapter-manager.html": "pages/mangaka/dashboard.html#chapters",
    "workspace.html": "pages/mangaka/dashboard.html#canvas",
    "kanban-board.html": "pages/mangaka/dashboard.html#kanban"
  };

  const currentFile = location.pathname.split("/").pop();
  if (actor === "mangaka" && mangakaInlineTarget[currentFile]) {
    location.replace(mangakaInlineTarget[currentFile]);
    return;
  }


  const assistantInlineTarget = {
    "kanban-board.html": "pages/assistant/assistant-dashboard.html#kanban"
  };

  if (actor === "assistant" && assistantInlineTarget[currentFile]) {
    location.replace(assistantInlineTarget[currentFile]);
    return;
  }


  const tantouInlineTarget = {
    "kanban-board.html": "tantou-dashboard.html#kanban",
    "editor-review.html": "tantou-review.html"
  };

  if (actor === "tantou" && tantouInlineTarget[currentFile]) {
    location.replace(tantouInlineTarget[currentFile]);
    return;
  }

  const cfg = configs[actor] || configs.mangaka;
  cfg.bodyClass.split(/\s+/).forEach(cls => cls && document.body.classList.add(cls));

  const logo = document.querySelector(".ws-logo");
  if (logo) logo.textContent = cfg.logo;
  const name = document.querySelector(".ws-name");
  if (name) name.textContent = cfg.name;

  const backLink = document.getElementById("core-back-link") || document.querySelector(".btn-sidebar-action");
  if (backLink) {
    backLink.href = cfg.back;
    backLink.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Back Dashboard';
  }

  document.querySelectorAll(".nav-group a.nav-item").forEach(link => {
    const hrefOnly = (link.getAttribute("href") || "").split("?")[0];
    if (["chapter-manager.html", "workspace.html", "kanban-board.html", "editor-review.html"].includes(hrefOnly)) {
      if (!cfg.visible.includes(hrefOnly)) {
        link.style.display = "none";
        return;
      }

      const url = new URL(hrefOnly, location.href);
      url.searchParams.set("actor", actor);
      link.href = `${hrefOnly}?${url.searchParams.toString()}`;
    }
  });

  document.querySelectorAll("[data-actor-href]").forEach(link => {
    const href = link.getAttribute("data-actor-href");
    if (!href) return;
    const sep = href.includes("?") ? "&" : "?";
    link.setAttribute("href", `${href}${sep}actor=${encodeURIComponent(actor)}`);
  });
});
