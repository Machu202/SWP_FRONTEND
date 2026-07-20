import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, unwrapList } from "../api/client";

const CONTACT_ROLES = {
  mangaka: ["Assistant", "Tantou Editor"],
  assistant: ["Mangaka"],
  tantou: ["Mangaka"]
};

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
  const allowedRoles = CONTACT_ROLES[roleGroup] || [];
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messageListRef = useRef(null);

  const selectedContact = useMemo(
    () => contacts.find((contact) => String(contact.id) === String(selectedContactId)) || null,
    [contacts, selectedContactId]
  );

  useEffect(() => {
    let cancelled = false;
    async function loadContacts() {
      if (!currentUserId || !allowedRoles.length) return;
      setLoadingContacts(true);
      try {
        const roleLists = await Promise.all(allowedRoles.map((role) => api.users.byRole(role)));
        const unique = new Map();
        roleLists.flatMap((result) => unwrapList(result)).forEach((user) => {
          if (!user?.id || String(user.id) === String(currentUserId) || user.isActive === false) return;
          unique.set(String(user.id), user);
        });
        const nextContacts = Array.from(unique.values()).sort((left, right) => displayName(left).localeCompare(displayName(right)));
        if (cancelled) return;
        setContacts(nextContacts);
        setSelectedContactId((current) => nextContacts.some((contact) => String(contact.id) === String(current))
          ? current
          : nextContacts[0]?.id ? String(nextContacts[0].id) : "");
        setError("");
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load chat contacts.");
      } finally {
        if (!cancelled) setLoadingContacts(false);
      }
    }
    loadContacts();
    return () => { cancelled = true; };
  }, [currentUserId, roleGroup]);

  const loadMessages = useCallback(async (silent = false) => {
    if (!selectedContactId) return;
    if (!silent) setLoadingMessages(true);
    try {
      const result = await api.directChat.list(selectedContactId);
      setMessages((current) => mergeMessages(current, unwrapList(result)));
      setError("");
    } catch (err) {
      if (!silent) setError(err.message || "Could not load this conversation.");
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, [selectedContactId]);

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

  if (!allowedRoles.length) return null;

  return (
    <aside className={`direct-messenger direct-messenger-${roleGroup}`} aria-label="Studio direct messenger">
      {open ? (
        <section className="direct-messenger-panel" data-testid="direct-messenger-panel">
          <header className="direct-messenger-header">
            <div>
              <strong>{selectedContact ? displayName(selectedContact) : "Studio Messenger"}</strong>
              <small>{selectedContact ? selectedContact.roleName || "Studio member" : "Choose a contact"} · updates every 5 seconds</small>
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
                  <small>{contact.roleName}</small>
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
                  maxLength="2000"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={selectedContact ? `Message ${displayName(selectedContact)}…` : "Choose a contact first"}
                  disabled={!selectedContact || sending}
                />
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
      </button>
    </aside>
  );
}
