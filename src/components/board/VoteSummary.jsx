export default function VoteSummary({ votes }) {
  const approve = votes.filter((vote) => vote.decision === "Approve").length;
  const reject = votes.filter((vote) => vote.decision === "Reject").length;
  const revision = votes.filter((vote) => vote.decision === "Request Revision").length;

  return (
    <div className="card">
      <h3>Vote Summary</h3>

      <div className="summary-grid">
        <div>
          <strong>{approve}</strong>
          <span>Approve</span>
        </div>
        <div>
          <strong>{reject}</strong>
          <span>Reject</span>
        </div>
        <div>
          <strong>{revision}</strong>
          <span>Revision</span>
        </div>
      </div>

      <div className="feedback-list">
        {votes.map((vote) => (
          <div key={vote.id} className="feedback-item">
            <strong>{vote.member}</strong>
            <span>{vote.decision}</span>
            <p>{vote.comment}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
