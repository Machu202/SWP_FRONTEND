import { Link } from "react-router-dom";

export default function FinalDecisionModal({ decision }) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h2>{decision}</h2>
        <p>
          The editorial decision has been recorded. The series status will now
          be updated in the system.
        </p>

        <Link to="/app/board/submissions/series-001/result" className="btn link-button">
          View Final Result
        </Link>
      </div>
    </div>
  );
}
