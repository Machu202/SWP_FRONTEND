export default function VoteCard({ decision, description, selected, onClick }) {
  return (
    <button
      type="button"
      className={`vote-card ${selected ? "vote-card-selected" : ""}`}
      onClick={onClick}
    >
      <h3>{decision}</h3>
      <p>{description}</p>
    </button>
  );
}
