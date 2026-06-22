import { Link } from "react-router-dom";

export default function BoardDashboardPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Editorial Board Dashboard</h1>
          <p>Review submissions sent by Tantou Editor and cast publication votes.</p>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card">
          <strong>1</strong>
          <span>Pending Submission</span>
        </div>
        <div className="stat-card">
          <strong>2</strong>
          <span>Votes Collected</span>
        </div>
        <div className="stat-card">
          <strong>1</strong>
          <span>Awaiting Final Decision</span>
        </div>
      </div>

      <section className="card chapter-card">
        <div>
          <span className="status">Board Review Required</span>
          <h3>Black Moon Contract</h3>
          <p>Chapter 01 - First Encounter</p>
          <p className="muted">Tantou recommendation: Recommend Revision</p>
        </div>

        <Link to="/app/board/submissions/series-001" className="btn link-button">
          Open Submission
        </Link>
      </section>
    </div>
  );
}
