import { useRef } from "react";

const FORMAT_ACTIONS = [
  { label: "B", title: "Bold", before: "**", after: "**" },
  { label: "I", title: "Italic", before: "_", after: "_" },
  { label: "H", title: "Heading", before: "## ", after: "" },
  { label: "•", title: "Bullet list", before: "- ", after: "" },
  { label: "“”", title: "Quote", before: "> ", after: "" }
];

export default function ScriptEditor({ value, onChange, placeholder = "Write chapter script...", rows = 12, disabled = false, ariaLabel = "Chapter script editor" }) {
  const ref = useRef(null);

  function applyFormat(action) {
    const input = ref.current;
    if (!input || disabled) return;
    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? start;
    const selected = value.slice(start, end);
    const next = `${value.slice(0, start)}${action.before}${selected}${action.after}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      input.focus();
      const cursorStart = start + action.before.length;
      input.setSelectionRange(cursorStart, cursorStart + selected.length);
    });
  }

  return (
    <div className="script-editor">
      <div className="script-toolbar" role="toolbar" aria-label="Script formatting toolbar">
        {FORMAT_ACTIONS.map((action) => (
          <button key={action.title} type="button" title={action.title} onClick={() => applyFormat(action)} disabled={disabled}>
            {action.label}
          </button>
        ))}
        <span>Markdown formatting</span>
      </div>
      <textarea
        ref={ref}
        className="form-control manuscript-script-area"
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
      />
    </div>
  );
}
