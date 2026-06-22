import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import MangaPageViewer from "../../components/manga/MangaPageViewer";
import AnnotationPanel from "../../components/manga/AnnotationPanel";
import { mockAnnotations } from "../../data/mockAnnotations";

export default function AnnotationFeedbackPage() {
  const { chapterId } = useParams();
  const [annotations, setAnnotations] = useState(mockAnnotations);
  const [selectedAnnotation, setSelectedAnnotation] = useState(mockAnnotations[0]);

  function handleAddAnnotation(newAnnotation) {
    setAnnotations((current) => [...current, newAnnotation]);
    setSelectedAnnotation(newAnnotation);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Annotation & Feedback</h1>
          <p>Click hitboxes and create Tantou comments directly on the manga page.</p>
        </div>

        <Link to={`/app/tantou/chapters/${chapterId}/revisions`} className="btn link-button">
          Send Revision Request
        </Link>
      </div>

      <div className="grid-2">
        <MangaPageViewer
          annotations={annotations}
          selectedAnnotationId={selectedAnnotation?.id}
          onSelectAnnotation={setSelectedAnnotation}
        />

        <AnnotationPanel
          selectedAnnotation={selectedAnnotation}
          annotations={annotations}
          onAddAnnotation={handleAddAnnotation}
        />
      </div>
    </div>
  );
}
