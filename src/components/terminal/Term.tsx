import { useState } from "react";
import { GLOSSARY, type GlossaryTerm } from "../../lib/glossary";

/**
 * A glossary term: underlined, tap (or click) to toggle a terminal-styled
 * inline explanation. Tap-first (works on mobile), no tooltip library, no
 * overlay — the explanation renders in flow, dim green, and collapses on a
 * second tap.
 */
export function Term({ term, children }: { term: GlossaryTerm; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        className="inline p-0 text-inherit"
        style={{
          background: "transparent",
          border: "none",
          color: "inherit",
          font: "inherit",
          textDecoration: "underline dotted",
          textUnderlineOffset: 3,
          cursor: "help",
        }}
        title={GLOSSARY[term]}
      >
        {children ?? term}
      </button>
      {open && (
        <span
          className="my-1 block p-2 text-xs"
          style={{
            color: "var(--flurry-mid)",
            border: "1px dashed var(--flurry-dim)",
            background: "var(--flurry-bg)",
          }}
        >
          {term}: {GLOSSARY[term]}
        </span>
      )}
    </span>
  );
}
