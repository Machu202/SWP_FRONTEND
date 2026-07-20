import { useCallback, useEffect, useRef, useState } from "react";
import { api, unwrapList } from "../api/client";
import { Alert } from "./Status";

function messageTime(value) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function mergeMessages(current, incoming) {
  const map = new Map();
  [...current, ...incoming].forEach((message) => {
    const key = message?.id ?? `${message?.senderId || message?.sender_id}-${message?.createdAt || message?.created_at}-${message?.content}`;
    map.set(String(key), message);
  });
  return Array.from(map.values()).sort((left, right) => {
    const leftTime = new Date(left?.createdAt || left?.created_at || 0).getTime();
    const rightTime = new Date(right?.createdAt || right?.created_at || 0).getTime();
    if (leftTime !== rightTime) return leftTime - rightTime;
    return Number(left?.id || 0) - Number(right?.id || 0);
  });
}

export default function BoardVotingChat({ seriesId, readOnly = false }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);

  const loadMessages = useCallback(async (silent = false) => {
    if (!seriesId) return;
    if (!silent) setLoading(true);
    try {
      const result = await api.boardChat.list(seriesId);
      setMessages((old) => mergeMessages(old, unwrapList(result)));
      setError("");
    } catch (err) {
      if (!silent) setError(err.message || "Could not load the Editorial Board voting chat.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [seriesId]);

  useEffect(() => {
    setMessages([]);
    setDraft("");
    loadMessages();
    const timer = window.setInterval(() => loadMessages(true), 5000);
    return () => window.clearInterval(timer);
  }, [loadMessages]);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length]);

  async function sendMessage(event) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || readOnly || sending) return;
    setSending(true);
    setError("");
    try {
      const saved = await api.boardChat.send(seriesId, content);
      setMessages((old) => mergeMessages(old, saved ? [saved] : []));
      setDraft("");
      await loadMessages(true);
    } catch (err) {
      setError(err.message || "Could not send the voting chat message.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section
      className={`board-voting-chat ${readOnly ? "admin-read-only" : ""}`}
      data-testid={readOnly ? `admin-board-chat-readonly-${seriesId}` : `board-voting-chat-${seriesId}`}
      aria-label="Editorial Board voting chat"
    >
      <div className="board-chat-header">
        <div>
          <p className="eyebrow">Saved voting-room discussion</p>
          <h4>Editorial Board Chat</h4>
        </div>
        <span>{readOnly ? "Admin · read only" : "Shared · saved"}</span>
      </div>

      <Alert type="danger">{error}</Alert>
      <div className="board-chat-messages" ref={listRef} aria-live="polite">
        {loading ? <p className="board-chat-state">Loading discussion...</p> : null}
        {!loading && !messages.length ? <p className="board-chat-state">No messages yet. Start the voting discussion.</p> : null}
        {messages.map((message) => (
          <article className="board-chat-message" key={message.id || `${message.senderId}-${message.createdAt}`} data-testid={`board-chat-message-${message.id}`}>
            <div>
              <strong>{message.senderName || message.sender_name || "Editorial Board Member"}</strong>
              <time>{messageTime(message.createdAt || message.created_at)}</time>
            </div>
            <p>{message.content}</p>
          </article>
        ))}
      </div>

      {readOnly ? (
        <p className="board-chat-read-only-note">Admin can view this discussion before confirming the final decision. Admin cannot send or edit messages.</p>
      ) : (
        <form className="board-chat-compose" onSubmit={sendMessage}>
          <label htmlFor={`board-chat-input-${seriesId}`}>Message the Editorial Board</label>
          <textarea
            id={`board-chat-input-${seriesId}`}
            data-testid={`board-chat-input-${seriesId}`}
            rows="3"
            maxLength="2000"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Discuss this series before casting or updating your vote..."
            disabled={sending}
          />
          <div className="board-chat-compose-footer">
            <small>{draft.length}/2000 · updates every 5 seconds</small>
            <button className="btn btn-primary" data-testid={`board-chat-send-${seriesId}`} disabled={!draft.trim() || sending}>
              {sending ? "Sending..." : "Send message"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
