export default function HitboxLayer({
  annotations = [],
  selectedAnnotationId,
  onSelectAnnotation,
}) {
  return (
    <div className="hitbox-layer">
      {annotations.map((annotation) => (
        <button
          type="button"
          key={annotation.id}
          className={`hitbox ${
            selectedAnnotationId === annotation.id ? "hitbox-selected" : ""
          }`}
          style={{
            left: `${annotation.x}%`,
            top: `${annotation.y}%`,
            width: `${annotation.width}%`,
            height: `${annotation.height}%`,
          }}
          onClick={() => onSelectAnnotation?.(annotation)}
        >
          {annotation.type}
        </button>
      ))}
    </div>
  );
}
