import { useEffect, useMemo, useState } from "react";
import { mediaUrlFrom } from "../api/client";

function numericPageNumber(page, fallback) {
  const value = Number(page?.pageNumber ?? page?.page_number);
  return Number.isFinite(value) ? value : fallback;
}

export default function ChapterReaderModal({ open, chapter, onClose }) {
  const [pageIndex, setPageIndex] = useState(0);
  const pages = useMemo(() => {
    return (chapter?.pages || [])
      .map((page, originalIndex) => ({ page, originalIndex }))
      .sort((left, right) => {
        const pageDifference = numericPageNumber(left.page, left.originalIndex + 1) - numericPageNumber(right.page, right.originalIndex + 1);
        return pageDifference || left.originalIndex - right.originalIndex;
      })
      .map(({ page }) => page);
  }, [chapter]);

  useEffect(() => { setPageIndex(0); }, [chapter?.id, open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKey = (event) => {
      if (event.key === "Escape") onClose?.();
      if (event.key === "ArrowLeft") setPageIndex((current) => Math.max(0, current - 1));
      if (event.key === "ArrowRight") setPageIndex((current) => Math.max(0, Math.min(pages.length - 1, current + 1)));
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose, pages.length]);

  if (!open || !chapter) return null;

  const page = pages[pageIndex];
  const imageUrl = page ? mediaUrlFrom(page, page.imageUrl, page.image_url, page.url) : "";
  const visiblePageNumber = page ? numericPageNumber(page, pageIndex + 1) : "-";
  const chapterNumber = chapter.chapterNumber ?? chapter.chapter_number ?? "-";

  return (
    <div className="media-modal-backdrop chapter-reader-backdrop" role="presentation" onMouseDown={() => onClose?.()}>
      <section
        className="media-modal-card chapter-reader-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Read Chapter ${chapterNumber}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="media-modal-close" type="button" aria-label="Close chapter reader" onClick={() => onClose?.()}>×</button>
        <header className="media-modal-header chapter-reader-header">
          <div>
            <p className="eyebrow">Chapter reader</p>
            <h2>Chapter {chapterNumber}: {chapter.title || "Untitled chapter"}</h2>
          </div>
          <strong>Page {visiblePageNumber} · {pages.length ? `${pageIndex + 1} of ${pages.length}` : "0 of 0"}</strong>
        </header>

        <div className="chapter-reader-stage">
          {imageUrl ? <img src={imageUrl} alt={`Chapter ${chapterNumber}, Page ${visiblePageNumber}`} /> : <span>No page image is available.</span>}
        </div>

        <nav className="chapter-reader-controls" aria-label="Chapter page navigation">
          <button type="button" aria-label="Previous page" onClick={() => setPageIndex((current) => Math.max(0, current - 1))} disabled={pageIndex <= 0}>&lt;</button>
          <span>Page {pages.length ? pageIndex + 1 : 0} / {pages.length}</span>
          <button type="button" aria-label="Next page" onClick={() => setPageIndex((current) => Math.max(0, Math.min(pages.length - 1, current + 1)))} disabled={!pages.length || pageIndex >= pages.length - 1}>&gt;</button>
        </nav>
      </section>
    </div>
  );
}
