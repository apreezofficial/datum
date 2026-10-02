import * as React from "react";

export function DatumFooter() {
  return (
    <footer className="h-10 border-t border-border-subtle/50 px-3 sm:px-8 flex items-center justify-between text-[11px] sm:text-xs text-muted font-mono shrink-0 select-none bg-surface/30">
      <span className="font-medium text-text">Datum</span>
      <div className="flex items-center gap-2 sm:gap-4">
        <span>Free</span>
        <span>·</span>
        <a
          href="https://github.com/apreezofficial/datum"
          target="_blank"
          rel="noreferrer"
          className="hover:text-text transition-colors underline underline-offset-2 sm:no-underline"
        >
          GitHub
        </a>
        <span>·</span>
        <span className="truncate max-w-[90px] sm:max-w-none">Built on Datum</span>
      </div>
    </footer>
  );
}
