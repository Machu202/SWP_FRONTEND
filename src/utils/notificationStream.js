import { Client } from "@stomp/stompjs";
import SockJS from "sockjs-client";
import { api, getToken } from "../api/client";

function parseMessage(message) {
  const raw = message?.body ?? message?.data ?? message;
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return { message: String(raw), createdAt: new Date().toISOString() };
  }
}

export function connectNotificationStream({ userId, onNotification, onState } = {}) {
  const endpoint = import.meta.env.VITE_WS_BASE_URL || api.WS_BASE_URL;
  const configuredUserTopic = import.meta.env.VITE_NOTIFICATION_TOPIC || "";
  const userTopic = configuredUserTopic || (userId ? `/topic/notifications/${userId}` : "/user/queue/notifications");
  const broadcastTopic = import.meta.env.VITE_NOTIFICATION_BROADCAST_TOPIC || "";
  const token = getToken();
  let stopped = false;

  const client = new Client({
    reconnectDelay: 5000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    connectHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    webSocketFactory: () => new SockJS(endpoint),
    debug: () => {}
  });

  client.onConnect = () => {
    if (stopped) return;
    onState?.("connected");
    const receive = (frame) => {
      const parsed = parseMessage(frame);
      if (parsed) onNotification?.(parsed);
    };
    client.subscribe(userTopic, receive);
    if (broadcastTopic && broadcastTopic !== userTopic) client.subscribe(broadcastTopic, receive);
  };

  client.onStompError = () => onState?.("error");
  client.onWebSocketError = () => onState?.("offline");
  client.onWebSocketClose = () => {
    if (!stopped) onState?.("reconnecting");
  };

  try {
    client.activate();
  } catch {
    onState?.("offline");
  }

  return () => {
    stopped = true;
    onState?.("closed");
    client.deactivate().catch(() => {});
  };
}
