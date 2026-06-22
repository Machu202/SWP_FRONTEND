import { useState } from "react";
import { Link, useParams } from "react-router-dom";

export default function EditorialReportPage() {
  const { chapterId } = useParams();

  const [recommendation, setRecommendation] = useState("Recommend Revision");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Editorial Report</h1>
          <p>Create Tantou evaluation report before sending to Editorial Board.</p>
        </div>
      </div>

      <form className="card report-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div>
            <label className="form-label">Series Title</label>
            <input className="form-control" defaultValue="Black Moon Contract" />
          </div>

          <div>
            <label className="form-label">Chapter</label>
            <input className="form-control" defaultValue="Chapter 01 - First Encounter" />
          </div>

          <div>
            <label className="form-label">Story Quality</label>
            <input className="form-control" type="number" min="1" max="10" defaultValue="8" />
          </div>

          <div>
            <label className="form-label">Art Quality</label>
            <input className="form-control" type="number" min="1" max="10" defaultValue="7" />
          </div>

          <div>
            <label className="form-label">Pacing Quality</label>
            <input className="form-control" type="number" min="1" max="10" defaultValue="6" />
          </div>

          <div>
            <label className="form-label">Commercial Potential</label>
            <input className="form-control" type="number" min="1" max="10" defaultValue="8" />
          </div>
        </div>

        <label className="form-label">Risk Notes</label>
        <textarea
          className="form-control textarea"
          defaultValue="The story hook is strong, but pacing issues should be fixed before publication approval."
        />

        <label className="form-label">Tantou Recommendation</label>
        <select
          className="form-control"
          value={recommendation}
          onChange={(event) => setRecommendation(event.target.value)}
        >
          <option>Recommend Approval</option>
          <option>Recommend Revision</option>
          <option>Recommend Rejection</option>
        </select>

        <button className="btn" type="submit">
          Submit Report to Editorial Board
        </button>
      </form>

      {submitted && (
        <section className="card success-card">
          <h3>Report submitted successfully.</h3>
          <p>The chapter report has been sent to the Editorial Board queue.</p>

          <div className="action-row">
            <Link to="/app/board/submissions/series-001" className="btn link-button">
              Open Board Submission
            </Link>

            <Link to={`/app/tantou/chapters/${chapterId}`} className="btn secondary link-button">
              Back to Chapter
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
