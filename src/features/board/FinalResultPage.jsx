import { Link } from "react-router-dom";
import VoteSummary from "../../components/board/VoteSummary";
import { mockVotes } from "../../data/mockVotes";

export default function FinalResultPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Final Decision</h1>
          <p>The final Editorial Board result is recorded in the system.</p>
        </div>
      </div>

      <section className="card final-result">
        <span className="result-badge">Revision Required</span>
        <h2>Black Moon Contract</h2>
        <p>
          The series is not rejected, but the chapter requires additional
          revision before official publication approval.
        </p>

        <div className="action-row">
          <Link to="/app/tantou/chapters/chapter-001/revisions" className="btn link-button">
            Back to Revision Tracking
          </Link>

          <Link to="/app/board" className="btn secondary link-button">
            Board Dashboard
          </Link>
        </div>
      </section>

      <VoteSummary votes={mockVotes} />
    </div>
  );
}
