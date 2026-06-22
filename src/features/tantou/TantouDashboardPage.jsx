import { Link } from "react-router-dom";
import { mockChapters } from "../../data/mockChapters";

export default function TantouDashboardPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tantou Dashboard</h1>
          <p>Chapters waiting for editorial review and revision checking.</p>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card">
          <strong>2</strong>
          <span>Assigned Chapters</span>
        </div>
        <div className="stat-card">
          <strong>1</strong>
          <span>Waiting Review</span>
        </div>
        <div className="stat-card">
          <strong>1</strong>
          <span>Revision Returned</span>
        </div>
      </div>

      {mockChapters.map((chapter) => (
        <div key={chapter.id} className="card chapter-card">
          <div>
            <span className="status">{chapter.status}</span>
            <h3>{chapter.seriesTitle}</h3>
            <p>{chapter.chapterTitle}</p>
            <p className="muted">
              Submitted by {chapter.submittedBy} • {chapter.pages} pages • Deadline{" "}
              {chapter.deadline}
            </p>
          </div>

          <Link to={`/app/tantou/chapters/${chapter.id}`} className="btn link-button">
            Open Review
          </Link>
        </div>
      ))}
    </div>
  );
}
