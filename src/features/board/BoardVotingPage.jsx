import { useState } from "react";
import VoteCard from "../../components/board/VoteCard";
import VoteSummary from "../../components/board/VoteSummary";
import FinalDecisionModal from "../../components/board/FinalDecisionModal";
import { mockVotes } from "../../data/mockVotes";

const voteOptions = [
  {
    decision: "Approve",
    description: "Approve this series/chapter for publication.",
  },
  {
    decision: "Reject",
    description: "Reject this submission from publication.",
  },
  {
    decision: "Request Revision",
    description: "Send it back for more revision before approval.",
  },
];

export default function BoardVotingPage() {
  const [selectedDecision, setSelectedDecision] = useState("Request Revision");
  const [comment, setComment] = useState("");
  const [votes, setVotes] = useState(mockVotes);
  const [showDecision, setShowDecision] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();

    const newVote = {
      id: `vote-${Date.now()}`,
      member: "Current Board Member",
      decision: selectedDecision,
      comment: comment || "No additional comment.",
    };

    setVotes((current) => [...current, newVote]);
    setShowDecision(true);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Board Voting</h1>
          <p>Cast a vote and submit a board comment for the final decision.</p>
        </div>
      </div>

      <div className="grid-2">
        <form className="card" onSubmit={handleSubmit}>
          <h2>Vote for Black Moon Contract</h2>
          <p className="muted">Chapter 01 - First Encounter</p>

          <div className="vote-options">
            {voteOptions.map((option) => (
              <VoteCard
                key={option.decision}
                decision={option.decision}
                description={option.description}
                selected={selectedDecision === option.decision}
                onClick={() => setSelectedDecision(option.decision)}
              />
            ))}
          </div>

          <label className="form-label">Board Comment</label>
          <textarea
            className="form-control textarea"
            placeholder="Write your vote comment..."
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />

          <button className="btn" type="submit">
            Submit Vote
          </button>
        </form>

        <VoteSummary votes={votes} />
      </div>

      {showDecision && <FinalDecisionModal decision="Revision Required" />}
    </div>
  );
}
