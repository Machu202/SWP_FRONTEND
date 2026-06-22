import HitboxLayer from "./HitboxLayer";

export default function MangaPageViewer({
  annotations = [],
  selectedAnnotationId,
  onSelectAnnotation,
  showHitboxes = true,
}) {
  return (
    <div className="manga-viewer">
      <div className="manga-page">
        <div className="page-panel panel-top-left">Panel 1</div>
        <div className="page-panel panel-top-right">Panel 2</div>
        <div className="page-panel panel-middle">Main Action Panel</div>
        <div className="page-panel panel-bottom-left">Panel 4</div>
        <div className="page-panel panel-bottom-right">Panel 5</div>

        {showHitboxes && (
          <HitboxLayer
            annotations={annotations}
            selectedAnnotationId={selectedAnnotationId}
            onSelectAnnotation={onSelectAnnotation}
          />
        )}
      </div>
    </div>
  );
}
