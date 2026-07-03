(() => {
  function clearBoardSession() {
    try {
      window.MangaApi?.clearSession?.();
    } catch (_) {}

    [
      "accessToken",
      "token",
      "jwt",
      "userRole",
      "role",
      "username",
      "userName",
      "userId",
      "id",
      "email",
      "userEmail",
      "fullName",
      "name",
      "profileCache",
      "activeSeriesId",
      "activeChapterId",
      "activePageId"
    ].forEach((key) => {
      try { localStorage.removeItem(key); } catch (_) {}
    });

    try { sessionStorage.clear(); } catch (_) {}
  }

  function bindBoardLogout() {
    document.querySelectorAll("[data-board-logout], .board-logout-link").forEach((link) => {
      if (link.dataset.logoutBound === "true") return;
      link.dataset.logoutBound = "true";

      link.addEventListener("click", (event) => {
        event.preventDefault();
        clearBoardSession();
        window.location.href = "index.html";
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindBoardLogout);
  } else {
    bindBoardLogout();
  }
})();
