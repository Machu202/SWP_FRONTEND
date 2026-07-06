import { useEffect, useState } from "react";
import { api, extractMediaUrl, resolveMediaUrl } from "../api/client";
import { Alert, EmptyState, LoadingBlock, StatusBadge } from "../components/Status";

export default function ResourcesPage() {
  const [resources, setResources] = useState([]);
  const [resourceType, setResourceType] = useState("PAGE_IMAGE");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setResources(await api.resources.list());
    } catch (err) {
      setError(err.message || "Could not load resources");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function upload(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setError("");
    setMessage("");
    try {
      for (const file of files) {
        await api.resources.upload(file, resourceType);
      }
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
    <section className="stack">
      <Alert type="success">{message}</Alert>
      <Alert type="danger">{error}</Alert>

      <div className="card toolbar">
        <div>
          <p className="eyebrow">Cloud/resource storage</p>
          <h3>{resources.length} uploaded resources</h3>
        </div>
        <div className="button-row">
          <select value={resourceType} onChange={(event) => setResourceType(event.target.value)}>
            <option>PAGE_IMAGE</option>
            <option>REFERENCE</option>
            <option>TASK_SUBMISSION</option>
            <option>BRUSH</option>
            <option>MODEL_3D</option>
          </select>
          <label className="btn btn-primary file-button">
            {uploading ? "Uploading..." : "Upload files"}
            <input type="file" multiple onChange={upload} disabled={uploading} />
          </label>
        </div>
      </div>

      {resources.length ? (
        <div className="resource-grid">
          {resources.map((resource) => {
            const url = resolveMediaUrl(extractMediaUrl(resource));
            const isImage = /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url);
            return (
              <div className="resource-card" key={resource.id}>
                <div className="resource-preview">
                  {isImage ? <img src={url} alt={`Resource ${resource.id}`} /> : <span>{resource.resourceType || "FILE"}</span>}
                </div>
                <div className="stack small-gap">
                  <div className="row-between"><strong>Resource #{resource.id}</strong><StatusBadge value={resource.resourceType} /></div>
                  <code className="url-code">{url || "No URL"}</code>
                  <div className="button-row">
                    {url && <a className="btn btn-small" href={url} target="_blank" rel="noreferrer">Open</a>}
                    <button className="btn btn-small btn-danger" onClick={() => remove(resource.id)}>Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : <EmptyState title="No resources yet" body="Upload images, references, brush files, or task submissions." />}
    </section>
  );
}
