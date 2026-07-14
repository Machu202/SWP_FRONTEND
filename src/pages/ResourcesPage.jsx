import { useEffect, useMemo, useState } from "react";
import { api, extractMediaUrl, hasRole, resolveMediaUrl, unwrapList } from "../api/client";
import { Alert, EmptyState, LoadingBlock } from "../components/Status";
import { useAuth } from "../context/AuthContext";

const TABS = [
  { key: "ALL", label: "All Assets" },
  { key: "BRUSH", label: "Brushes & Tools" },
  { key: "SCREENTONE", label: "Screentones" }
];

const HIDDEN_RESOURCE_TYPES = new Set([
  "MODEL_3D",
  "3D_MODEL",
  "TASK_SUBMISSION",
  "SUBMISSION",
  "ASSISTANT_SUBMISSION",
  "FINISHED_WORK"
]);

function normalizeResourceType(item) {
  return String(item?.resourceType || item?.type || "").toUpperCase();
}

export default function ResourcesPage() {
  const { profile, session } = useAuth();
  const role = profile?.roleName || session.role;
  const canManage = hasRole(role, ["mangaka", "admin"]);
  const [resources, setResources] = useState([]);
  const [activeTab, setActiveTab] = useState("ALL");
  const [resourceType, setResourceType] = useState("PAGE_IMAGE");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setResources(unwrapList(await api.resources.list()));
    } catch (err) {
      setError(err.message || "Could not load resources");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const visibleResources = useMemo(() => {
    return resources.filter((item) => !HIDDEN_RESOURCE_TYPES.has(normalizeResourceType(item)));
  }, [resources]);

  const filtered = useMemo(() => {
    if (activeTab === "ALL") return visibleResources;
    return visibleResources.filter((item) => normalizeResourceType(item).includes(activeTab));
  }, [visibleResources, activeTab]);

  async function upload(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setError("");
    setMessage("");
    try {
      for (const file of files) await api.resources.upload(file, resourceType);
      setMessage(`Uploaded ${files.length} resource(s).`);
      await load();
    } catch (err) {
      setError(err.message || "Upload failed");
    } finally {
      event.target.value = "";
      setUploading(false);
    }
  }

  async function remove(id) {
    setError("");
    try {
      await api.resources.remove(id);
      setResources((old) => old.filter((item) => String(item.id) !== String(id)));
      setMessage("Resource deleted.");
    } catch (err) {
      setError(err.message || "Delete failed");
    }
  }

  if (loading) return <LoadingBlock label="Loading resources..." />;

  return (
    <section className="stack resource-library-screen">
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 5 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 5 }}>Resource Library</h1>
          <p style={{ color: "#6b7280", fontSize: 14 }}>Tải về cọ vẽ, screentone và các tài liệu tham khảo chung của Studio.</p>
        </div>
        {canManage && (
          <div className="button-row">
            <select value={resourceType} onChange={(event) => setResourceType(event.target.value)}>
              <option>PAGE_IMAGE</option><option>REFERENCE</option><option>BRUSH</option><option>SCREENTONE</option>
            </select>
            <label className="btn-publish file-button">
              {uploading ? "Uploading..." : "Upload files"}
              <input type="file" multiple onChange={upload} disabled={uploading} />
            </label>
          </div>
        )}
      </div>

      <div className="resource-filter-tabs" style={{ display: "flex", gap: 10, marginBottom: 20, borderBottom: "2px solid #e5e7eb", paddingBottom: 10 }}>
        {TABS.map((tab) => <button key={tab.key} className={activeTab === tab.key ? "r-tab active" : "r-tab"} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>)}
      </div>

      {filtered.length ? (
        <div className="resource-grid" id="resource-grid-container" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))" }}>
          {filtered.map((resource) => <ResourceCard key={resource.id} resource={resource} canManage={canManage} onRemove={() => remove(resource.id)} />)}
        </div>
      ) : <EmptyState icon="□" title="No resources yet" body="Upload images, references, brush files, or screentones." />}
    </section>
  );
}

function ResourceCard({ resource, canManage, onRemove }) {
  const url = resolveMediaUrl(extractMediaUrl(resource));
  const type = resource.resourceType || resource.type || "FILE";
  const isImage = /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url) || String(type).includes("IMAGE") || String(type).includes("COVER");
  return (
    <div className="resource-card">
      <div className="rs-thumb">
        {isImage && url ? <img src={url} alt={`Resource ${resource.id}`} /> : <span>{type}</span>}
        <div className="rs-type-badge">{type}</div>
        <div className="rs-status">Available</div>
      </div>
      <div className="rs-info">
        <div className="rs-title"><span>{resource.fileName || resource.filename || resource.name || `Resource #${resource.id}`}</span>{canManage && <button className="btn-icon-only" onClick={onRemove} title="Delete resource">×</button>}</div>
        <div className="rs-desc">{url || "No download link is available."}</div>
        <div className="rs-meta">
          <span className="rs-author"><span className="topbar-avatar" style={{ width: 16, height: 16, fontSize: 9 }}>SF</span> Studio</span>
          {url && <div className="button-row"><a className="btn btn-small" href={url} target="_blank" rel="noreferrer">Open</a><a className="btn btn-small btn-primary" href={url} download={resource.fileName || resource.filename || `resource-${resource.id}`}>Download</a></div>}
        </div>
      </div>
    </div>
  );
}
