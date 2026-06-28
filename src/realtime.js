/*
 * Optional WebSocket compatibility helper for Spring /ws + SockJS + STOMP.
 * This is safe to include on every page. It only connects after login.
 */
(function () {
  let stompClient = null;
  let connecting = null;

  function loadScriptOnce(src, globalName) {
    if (globalName && window[globalName]) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-runtime-src="${src}"]`);
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.dataset.runtimeSrc = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function showNotificationToast(message) {
    let toast = document.getElementById("notification-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "notification-toast";
      toast.style.position = "fixed";
      toast.style.right = "24px";
      toast.style.bottom = "24px";
      toast.style.background = "#111827";
      toast.style.color = "#fff";
      toast.style.padding = "12px 16px";
      toast.style.borderRadius = "10px";
      toast.style.boxShadow = "0 12px 30px rgba(0,0,0,.18)";
      toast.style.zIndex = "9999";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.display = "block";
    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => (toast.style.display = "none"), 3200);
  }

  async function connectNotifications(options = {}) {
    if (!window.MangaApi || !window.MangaApi.getAccessToken()) return null;
    if (stompClient && stompClient.connected) return stompClient;
    if (connecting) return connecting;

    const currentUser = window.MangaApi.getCurrentUser() || {};
    const userId = options.userId || currentUser.id;
    if (!userId) return null;

    connecting = Promise.all([
      loadScriptOnce("https://cdn.jsdelivr.net/npm/sockjs-client@1/dist/sockjs.min.js", "SockJS"),
      loadScriptOnce("https://cdn.jsdelivr.net/npm/stompjs@2.3.3/lib/stomp.min.js", "Stomp"),
    ])
      .then(() => {
        const socket = new SockJS(window.MangaApi.getWsUrl());
        stompClient = Stomp.over(socket);
        if (options.debug === false || !options.debug) stompClient.debug = null;

        return new Promise((resolve, reject) => {
          const headers = window.MangaApi.getAccessToken()
            ? { Authorization: `Bearer ${window.MangaApi.getAccessToken()}` }
            : {};

          stompClient.connect(
            headers,
            () => {
              stompClient.subscribe(`/topic/notifications/${userId}`, (message) => {
                let payload = message.body;
                try {
                  payload = JSON.parse(message.body);
                } catch (_) {}

                if (typeof options.onMessage === "function") {
                  options.onMessage(payload);
                } else {
                  showNotificationToast(payload.message || payload.title || String(payload));
                }
              });
              resolve(stompClient);
            },
            reject
          );
        });
      })
      .catch((error) => {
        console.warn("WebSocket notification connection skipped:", error.message || error);
        return null;
      })
      .finally(() => {
        connecting = null;
      });

    return connecting;
  }

  function disconnectNotifications() {
    if (stompClient && stompClient.connected) {
      stompClient.disconnect();
    }
    stompClient = null;
  }

  window.MangaRealtime = {
    connectNotifications,
    disconnectNotifications,
  };

  document.addEventListener("DOMContentLoaded", () => {
    // Auto-connect only when already authenticated. Pages remain usable offline/mock.
    connectNotifications({ debug: false });
  });
})();
