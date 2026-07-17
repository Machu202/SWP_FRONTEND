import { useCallback, useEffect, useRef, useState } from "react";
import { resolveMediaUrl } from "../api/client";

function finiteNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
}

function positiveNumber(...values) {
  for (const value of values) {
    const number = finiteNumber(value);
    if (number > 0) return number;
  }
  return 0;
}

function boxNumber(box, ...keys) {
  return finiteNumber(...keys.map((key) => box?.[key]));
}

function percentageBox(box, coordinateWidth, coordinateHeight) {
  if (!box || coordinateWidth <= 0 || coordinateHeight <= 0) return null;
  const x = boxNumber(box, "xCoord", "x_coord", "x", "left");
  const y = boxNumber(box, "yCoord", "y_coord", "y", "top");
  const width = boxNumber(box, "width", "w");
  const height = boxNumber(box, "height", "h");
  if (width <= 0 || height <= 0) return null;

  const normalized = x >= 0 && y >= 0 && x <= 1 && y <= 1 && width <= 1 && height <= 1;
  const rawLeft = normalized ? x * 100 : (x / coordinateWidth) * 100;
  const rawTop = normalized ? y * 100 : (y / coordinateHeight) * 100;
  const rawWidth = normalized ? width * 100 : (width / coordinateWidth) * 100;
  const rawHeight = normalized ? height * 100 : (height / coordinateHeight) * 100;
  const left = Math.max(0, Math.min(100, rawLeft));
  const top = Math.max(0, Math.min(100, rawTop));
  return {
    left,
    top,
    width: Math.max(0.25, Math.min(100 - left, rawWidth)),
    height: Math.max(0.25, Math.min(100 - top, rawHeight))
  };
}

/**
 * Draw an annotation against the pixels actually occupied by the rendered image.
 * This avoids stretching the rectangle when a portrait page is scaled into a
 * smaller card with empty horizontal space or a maximum-height constraint.
 */
export default function CoordinateImageOverlay({
  url,
  alt,
  box,
  originalWidth,
  originalHeight,
  overlayClassName = "task-hitbox-overlay",
  labelClassName = "task-hitbox-label",
  label = "Task Area",
  testId,
  stageClassName = "preview-image-stage coordinate-image-stage",
  imageClassName = "coordinate-overlay-image",
  maxHeight = 320,
  onImageSize
}) {
  const resolved = resolveMediaUrl(url);
  const stageRef = useRef(null);
  const imageRef = useRef(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [renderedImage, setRenderedImage] = useState({ left: 0, top: 0, width: 0, height: 0 });

  const measure = useCallback(() => {
    const stage = stageRef.current;
    const image = imageRef.current;
    if (!stage || !image || !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) return;
    const stageRect = stage.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    const nextNatural = { width: image.naturalWidth, height: image.naturalHeight };
    setNaturalSize(nextNatural);
    setRenderedImage({
      left: imageRect.left - stageRect.left,
      top: imageRect.top - stageRect.top,
      width: imageRect.width,
      height: imageRect.height
    });
    onImageSize?.(nextNatural);
  }, [onImageSize]);

  useEffect(() => {
    setNaturalSize({ width: 0, height: 0 });
    setRenderedImage({ left: 0, top: 0, width: 0, height: 0 });
    const frame = window.requestAnimationFrame(measure);
    const timer = window.setTimeout(measure, 60);
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    let observer;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      if (stageRef.current) observer.observe(stageRef.current);
      if (imageRef.current) observer.observe(imageRef.current);
    }
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener("resize", onResize);
      observer?.disconnect();
    };
  }, [resolved, measure]);

  if (!resolved) return null;

  // The hitbox was drawn on the reference image. Prefer that image's natural
  // pixel dimensions; page metadata can describe a newer approved image and
  // would otherwise stretch the old task rectangle.
  const coordinateWidth = positiveNumber(naturalSize.width, originalWidth);
  const coordinateHeight = positiveNumber(naturalSize.height, originalHeight);
  const percentage = percentageBox(box, coordinateWidth, coordinateHeight);
  const overlayStyle = percentage && renderedImage.width > 0 && renderedImage.height > 0 ? {
    left: `${renderedImage.left + renderedImage.width * percentage.left / 100}px`,
    top: `${renderedImage.top + renderedImage.height * percentage.top / 100}px`,
    width: `${renderedImage.width * percentage.width / 100}px`,
    height: `${renderedImage.height * percentage.height / 100}px`
  } : null;

  return (
    <div ref={stageRef} className={stageClassName}>
      <img
        ref={imageRef}
        className={imageClassName}
        src={resolved}
        alt={alt}
        style={{ maxHeight: `${maxHeight}px` }}
        onLoad={measure}
      />
      {overlayStyle && (
        <div className={overlayClassName} data-testid={testId} style={overlayStyle}>
          <span className={labelClassName}>{label}</span>
        </div>
      )}
    </div>
  );
}
