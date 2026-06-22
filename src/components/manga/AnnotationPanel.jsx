import { useState } from "react";

const feedbackTypes = [
  "Dialogue",
  "Pacing",
  "Layout",
  "Content",
  "Art correction",
  "Other",
];

export default function AnnotationPanel({
  selectedAnnotation,
  annotations,
  onAddAnnotation,
}) {
  const [type, setType] = useState("Dialogue");
  const [comment, setComment] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    if (!comment.trim()) {
      return;
    }

    onAddAnnotation({
      id: `ann-${Date.now()}`,
      chapterId: "chapter-001",
      pageNumber: 5,
      type,
      status: "Open",
      x: 28,
      y: 28,
      width: 32,
      height: 14,
      comment,
      author: "Tantou Editor",
    });

    setComment("");
    setType("Dialogue");
  }

  return (
    <aside className="card annotation-panel">
      <h3>Annotation & Feedback</h3>

      {selectedAnnotation ? (
        <div className="selected-feedback">
          <p className="small-label">Selected Hitbox</p>
          <h4>{selectedAnnotation.type}</h4>
          <span className="status">{selectedAnnotation.status}</span>
          <p>{selectedAnnotation.comment}</p>
        </div>
      ) : (
        <p className="muted">Click a red hitbox on the manga page to view feedback.</p>
      )}

      <hr />

      <form onSubmit={handleSubmit}>
        <label className="form-label">Feedback type</label>
        <select
          className="form-control"
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          {feedbackTypes.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>

        <label className="form-label">Comment</label>
        <textarea
          className="form-control textarea"
          placeholder="Write Tantou feedback..."
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />

        <button className="btn" type="submit">
          Add Feedback
        </button>
      </form>

      <div className="feedback-list">
        <p className="small-label">All feedback</p>

        {annotations.map((item) => (
          <div key={item.id} className="feedback-item">
            <strong>{item.type}</strong>
            <span>{item.status}</span>
            <p>{item.comment}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}
