import { useEffect } from "react";
import { resolveMediaUrl } from "../api/client";

export default function ImageComparisonModal({ open, referenceUrl, submittedUrl, onClose, title = "Compare 2 Images" }) {
  const reference = resolveMediaUrl(referenceUrl);
  const submitted = resolveMediaUrl(submittedUrl);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="media-modal-backdrop" role="presentation" onMouseDown={() => onClose?.()}>
      <section
        className="media-modal-card image-comparison-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="media-modal-close" type="button" aria-label="Close image comparison" onClick={() => onClose?.()}>×</button>
        <header className="media-modal-header">
          <p className="eyebrow">Visual review</p>
          <h2>{title}</h2>
        </header>
        <div className="image-comparison-grid">
          <ComparisonImage label="Reference" url={reference} />
          <ComparisonImage label="Submitted work" url={submitted} />
        </div>
      </section>
    </div>
  );
}

function ComparisonImage({ label, url }) {
  return (
    <figure className="comparison-image-panel">
      <figcaption>{label}</figcaption>
      <div className="comparison-image-stage">
        {url ? <img src={url} alt={`${label} for comparison`} /> : <span>No image available</span>}
      </div>
    </figure>
  );
}
