import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, unwrapList } from "../api/client";

function displayName(user) {
  return user?.fullName || user?.full_name || user?.username || user?.email || `User #${user?.id}`;
}

function roleTone(role = "") {
  const value = String(role).toLowerCase();
  if (value.includes("assistant")) return "assistant";
  if (value.includes("tantou")) return "tantou";
  return "mangaka";
}

function initials(user) {
  const name = String(displayName(user) || "U").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}` : name.slice(0, 2)).toUpperCase();
}

function contactSeriesTitles(contact) {
  const values = contact?.seriesTitles || contact?.series_titles || [];
  return Array.isArray(values) ? values.filter(Boolean) : [];
}

function contactSeriesLabel(contact) {
  const titles = contactSeriesTitles(contact);
  return `(${titles.length ? titles.join(", ") : "Manga Series"})`;
}

function messageTime(value) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function mergeMessages(current, incoming) {
  const merged = new Map();
  [...current, ...incoming].forEach((message) => {
    const key = message?.id ?? `${message?.senderId || message?.sender_id}-${message?.createdAt || message?.created_at}-${message?.content}`;
    merged.set(String(key), message);
  });
  return Array.from(merged.values()).sort((left, right) => {
    const leftTime = new Date(left?.createdAt || left?.created_at || 0).getTime();
    const rightTime = new Date(right?.createdAt || right?.created_at || 0).getTime();
    if (leftTime !== rightTime) return leftTime - rightTime;
    return Number(left?.id || 0) - Number(right?.id || 0);
  });
}

export default function DirectMessenger({ currentUserId, roleGroup }) {
  const enabled = ["mangaka", "assistant", "tantou"].includes(roleGroup);
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [maxMessageLength, setMaxMessageLength] = useState(2000);
  const messageListRef = useRef(null);
  const totalUnread = contacts.reduce((sum, contact) => sum + Number(contact.unreadCount || contact.unread_count || 0), 0);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    api.system.runtime()
      .then((settings) => {
        const value = Number(settings?.maxChatMessageLength);
        if (!cancelled && Number.isInteger(value) && value > 0) setMaxMessageLength(value);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [enabled]);

  const selectedContact = useMemo(
    () => contacts.find((contact) => String(contact.id) === String(selectedContactId)) || null,
    [contacts, selectedContactId]
  );

  const loadContacts = useCallback(async (silent = false) => {
    if (!currentUserId || !enabled) return;
    if (!silent) setLoadingContacts(true);
    try {
      const nextContacts = unwrapList(await api.directChat.contacts());
      setContacts(nextContacts);
      setSelectedContactId((current) => nextContacts.some((contact) => String(contact.id) === String(current))
        ? current
        : nextContacts[0]?.id ? String(nextContacts[0].id) : "");
      setError("");
    } catch (err) {
      if (!silent) setError(err.message || "Could not load chat contacts.");
    } finally {
      if (!silent) setLoadingContacts(false);
    }
  }, [currentUserId, enabled]);

  useEffect(() => {
    if (!enabled || !currentUserId) return undefined;
    loadContacts();
    const timer = window.setInterval(() => loadContacts(true), 5000);
    return () => window.clearInterval(timer);
  }, [currentUserId, enabled, loadContacts]);

  const loadMessages = useCallback(async (silent = false) => {
    if (!selectedContactId) return;
    if (!silent) setLoadingMessages(true);
    try {
      const result = await api.directChat.list(selectedContactId);
      setMessages((current) => mergeMessages(current, unwrapList(result)));
      await loadContacts(true);
      setError("");
    } catch (err) {
      if (!silent) setError(err.message || "Could not load this conversation.");
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, [selectedContactId, loadContacts]);

  useEffect(() => {
    setMessages([]);
    setDraft("");
    if (!open || !selectedContactId) return undefined;
    loadMessages();
    const timer = window.setInterval(() => loadMessages(true), 5000);
    return () => window.clearInterval(timer);
  }, [open, selectedContactId, loadMessages]);

  useEffect(() => {
    const list = messageListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length, open]);

  async function sendMessage(event) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !selectedContactId || sending) return;
    setSending(true);
    setError("");
    try {
      const saved = await api.directChat.send(selectedContactId, content);
      setMessages((current) => mergeMessages(current, saved ? [saved] : []));
      setDraft("");
      await loadMessages(true);
    } catch (err) {
      setError(err.message || "Could not send this message.");
    } finally {
      setSending(false);
    }
  }

  if (!enabled) return null;

  return (
    <aside className={`direct-messenger direct-messenger-${roleGroup}`} aria-label="Studio direct messenger">
      {open ? (
        <section className="direct-messenger-panel" data-testid="direct-messenger-panel">
          <header className="direct-messenger-header">
            <div>
              <strong>{selectedContact ? displayName(selectedContact) : "Studio Messenger"}</strong>
              <small>{selectedContact ? `${contactSeriesLabel(selectedContact)} · ${selectedContact.roleName || "Studio member"}` : "Choose a contact"} · updates every 5 seconds</small>
            </div>
            <button type="button" aria-label="Minimize direct messenger" onClick={() => setOpen(false)}>−</button>
          </header>

          <div className="direct-messenger-body">
            <nav className="direct-contact-list" aria-label="Chat contacts">
              {loadingContacts ? <span className="direct-chat-state">Loading…</span> : null}
              {!loadingContacts && !contacts.length ? <span className="direct-chat-state">No contacts</span> : null}
              {contacts.map((contact) => (
                <button
                  type="button"
                  key={contact.id}
                  className={String(contact.id) === String(selectedContactId) ? "direct-contact active" : "direct-contact"}
                  onClick={() => setSelectedContactId(String(contact.id))}
                  title={`${displayName(contact)} · ${contact.roleName || "Studio member"}`}
                >
                  <span className={`direct-contact-avatar contact-${roleTone(contact.roleName)}`}>{initials(contact)}</span>
                  <span>{displayName(contact)}</span>
                  <small className="direct-contact-series" title={contactSeriesLabel(contact)}>{contactSeriesLabel(contact)}</small>
                  <small>{contact.roleName}</small>
                  {Number(contact.unreadCount || contact.unread_count || 0) > 0 ? (
                    <span className="direct-contact-unread">{Number(contact.unreadCount || contact.unread_count) > 99 ? "99+" : Number(contact.unreadCount || contact.unread_count)}</span>
                  ) : null}
                </button>
              ))}
            </nav>

            <div className="direct-conversation">
              {error ? <p className="direct-chat-error" role="alert">{error}</p> : null}
              <div className="direct-message-list" ref={messageListRef} aria-live="polite">
                {loadingMessages ? <p className="direct-chat-state">Loading messages…</p> : null}
                {!loadingMessages && selectedContact && !messages.length ? <p className="direct-chat-state">No messages yet. Say hello!</p> : null}
                {!selectedContact ? <p className="direct-chat-state">Choose a studio member to start chatting.</p> : null}
                {messages.map((message) => {
                  const own = String(message.senderId || message.sender_id) === String(currentUserId);
                  return (
                    <article className={own ? "direct-message own" : "direct-message received"} key={message.id || `${message.senderId}-${message.createdAt}`}>
                      <p>{message.content}</p>
                      <time>{messageTime(message.createdAt || message.created_at)}</time>
                    </article>
                  );
                })}
              </div>

              <form className="direct-message-compose" onSubmit={sendMessage}>
                <textarea
                  rows="2"
                  maxLength={maxMessageLength}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={selectedContact ? `Message ${displayName(selectedContact)}…` : "Choose a contact first"}
                  disabled={!selectedContact || sending}
                />
                <small>{draft.length}/{maxMessageLength}</small>
                <button type="submit" aria-label="Send direct message" disabled={!selectedContact || !draft.trim() || sending}>➤</button>
              </form>
            </div>
          </div>
        </section>
      ) : null}

      <button
        className="direct-messenger-launcher"
        type="button"
        aria-label={open ? "Minimize direct messenger" : "Open direct messenger"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        title={open ? "Minimize Messenger" : "Open Messenger"}
      >
        <span aria-hidden="true">⚡</span>
        {totalUnread > 0 ? <span className="direct-messenger-unread-badge" data-testid="direct-messenger-unread-count">{totalUnread > 99 ? "99+" : totalUnread}</span> : null}
      </button>
    </aside>
  );
}
