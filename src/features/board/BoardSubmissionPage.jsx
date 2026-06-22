import { Link } from "react-router-dom";
import MangaPageViewer from "../../components/manga/MangaPageViewer";
import VoteSummary from "../../components/board/VoteSummary";
import { mockAnnotations } from "../../data/mockAnnotations";
import { mockVotes } from "../../data/mockVotes";

export default function BoardSubmissionPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Board Submission</h1>
          <p>Read manga draft, Tantou report, feedback summary, and vote history.</p>
        </div>

        <Link to="/app/board/submissions/series-001/vote" className="btn link-button">
          Start Voting
        </Link>
      </div>

      <div className="grid-2">
        <section>
          <div className="card">
            <span className="status">Submitted to Board</span>
            <h2>Black Moon Contract</h2>
            <h3>Chapter 01 - First Encounter</h3>
            <p>
              A young artist signs a mysterious contract with a moon spirit and
              receives the power to alter fate.
            </p>
          </div>

          <MangaPageViewer annotations={mockAnnotations} />
        </section>

        <aside>
          <div className="card">
            <h3>Tantou Report</h3>
            <p><strong>Story:</strong> 8/10</p>
            <p><strong>Art:</strong> 7/10</p>
            <p><strong>Pacing:</strong> 6/10</p>
            <p><strong>Commercial Potential:</strong> 8/10</p>
            <p>
              Recommendation: <strong>Recommend Revision</strong>
            </p>
          </div>

          <VoteSummary votes={mockVotes} />
        </aside>
      </div>
    </div>
  );
}
