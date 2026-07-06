export function StatusBadge({ value }) {
  const text = String(value || "Draft");
  const normalized = text.toLowerCase();
  let tone = "neutral";
  if (normalized.includes("approved") || normalized.includes("active") || normalized.includes("success")) tone = "success";
  if (normalized.includes("review") || normalized.includes("pending") || normalized.includes("doing")) tone = "warning";
  if (normalized.includes("reject") || normalized.includes("lock") || normalized.includes("inactive")) tone = "danger";
  if (normalized.includes("todo") || normalized.includes("draft")) tone = "info";
  return <span className={`status status-${tone}`}>{text}</span>;
}

export function Alert({ type = "info", children }) {
  if (!children) return null;
  return <div className={`alert alert-${type}`}>{children}</div>;
}

export function EmptyState({ title = "No data yet", body = "Create or load data to continue." }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

export function LoadingBlock({ label = "Loading..." }) {
  return <div className="loading-block"><span className="spinner" /> {label}</div>;
}
