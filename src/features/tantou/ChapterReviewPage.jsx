import { Link, useParams } from "react-router-dom";
import { mockChapters } from "../../data/mockChapters";

export default function ChapterReviewPage() {
  const { chapterId } = useParams();
  const chapter = mockChapters.find((item) => item.id === chapterId) ?? mockChapters[0];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Chapter Review</h1>
          <p>Check submitted manga draft information before detailed review.</p>
        </div>
      </div>

      <section className="card">
        <span className="status">{chapter.status}</span>
        <h2>{chapter.seriesTitle}</h2>
        <h3>{chapter.chapterTitle}</h3>

        <div className="info-grid">
          <div>
            <p className="small-label">Submitted By</p>
            <strong>{chapter.submittedBy}</strong>
          </div>
          <div>
            <p className="small-label">Pages</p>
            <strong>{chapter.pages}</strong>
          </div>
          <div>
            <p className="small-label">Deadline</p>
            <strong>{chapter.deadline}</strong>
          </div>
          <div>
            <p className="small-label">Series ID</p>
            <strong>{chapter.seriesId}</strong>
          </div>
        </div>

        <p>{chapter.synopsis}</p>

        <div className="action-row">
          <Link to={`/app/tantou/chapters/${chapter.id}/read`} className="btn link-button">
            Read Draft
          </Link>

          <Link
            to={`/app/tantou/chapters/${chapter.id}/annotations`}
            className="btn link-button"
          >
            Add Feedback
          </Link>

          <Link
            to={`/app/tantou/chapters/${chapter.id}/revisions`}
            className="btn secondary link-button"
          >
            Revision Tracking
          </Link>

          <Link
            to={`/app/tantou/chapters/${chapter.id}/report`}
            className="btn secondary link-button"
          >
            Create Editorial Report
          </Link>
        </div>
      </section>

      <section className="card">
        <h3>Review Checklist</h3>
        <ul className="checklist">
          <li>Read chapter pages and story flow</li>
          <li>Check dialogue clarity</li>
          <li>Check pacing between important panels</li>
          <li>Check layout and page composition</li>
          <li>Create final Tantou recommendation</li>
        </ul>
      </section>
    </div>
  );
}
