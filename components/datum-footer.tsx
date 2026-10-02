import * as React from "react";

export function DatumFooter() {
  return (
    <footer className="h-10 border-t border-border-subtle/50 px-6 sm:px-8 flex items-center justify-between text-xs text-muted font-mono shrink-0 select-none bg-surface/30">
      <span>Datum</span>
      <div className="flex items-center gap-4">
        <span>Free</span>
        <span>·</span>
        <a
          href="https://github.com/apreezofficial/datum"
          target="_blank"
          rel="noreferrer"
          className="hover:text-text transition-colors"
        >
          GitHub
        </a>
        <span>·</span>
        <span>Built on Datum</span>
      </div>
    </footer>
  );
}
