import { Link, useParams } from "react-router-dom";
import MangaPageViewer from "../../components/manga/MangaPageViewer";
import { mockAnnotations } from "../../data/mockAnnotations";

export default function MangaDraftReaderPage() {
  const { chapterId } = useParams();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Manga Draft Reader</h1>
          <p>Read submitted manga pages before adding feedback.</p>
        </div>

        <Link to={`/app/tantou/chapters/${chapterId}/annotations`} className="btn link-button">
          Go to Annotation
        </Link>
      </div>

      <div className="reader-layout">
        <aside className="card page-list">
          <h3>Pages</h3>
          {Array.from({ length: 8 }, (_, index) => (
            <button key={index} className={index === 4 ? "page-thumb active" : "page-thumb"}>
              Page {index + 1}
            </button>
          ))}
        </aside>

        <MangaPageViewer annotations={mockAnnotations} showHitboxes={false} />

        <aside className="card">
          <h3>Page Notes</h3>
          <p className="muted">Current page: Page 5</p>
          <p>
            This draft contains the first reveal scene. Tantou should focus on
            dialogue length, panel transition, and emotional pacing.
          </p>
          <span className="status">Waiting Review</span>
        </aside>
      </div>
    </div>
  );
}
