"use client";

import * as React from "react";
import { Github, ArrowRight, ShieldAlert, ListTodo, Bug } from "lucide-react";

interface HeroViewProps {
  inputValue: string;
  setInputValue: (val: string) => void;
  onStartAnalysis: (overrideUrl?: string) => void;
}

const EXAMPLES = ["OWASP/NodeGoat", "expressjs/express", "vercel/next.js"];

const FEATURES = [
  { icon: ShieldAlert, label: "Security flaws", hint: "Leaked keys, injection, unsafe eval" },
  { icon: Bug, label: "Bugs", hint: "Swallowed errors, suppressed types" },
  { icon: ListTodo, label: "TODOs", hint: "Every TODO / FIXME with its line" },
];

export function HeroView({ inputValue, setInputValue, onStartAnalysis }: HeroViewProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-full px-4 sm:px-6 py-10 text-center max-w-2xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text mb-2">
        Scan a codebase for flaws.
      </h1>
      <p className="text-sm text-secondary max-w-md mb-7 leading-relaxed">
        Paste a GitHub repository. Datum reads every file and reports security issues, bugs and TODOs with the exact
        line and how to fix each one.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onStartAnalysis();
        }}
        className="w-full max-w-lg"
      >
        <div className="flex items-center w-full rounded-full border border-border bg-surface shadow-xs focus-within:border-accent transition-colors pl-4 pr-1.5 py-1.5">
          <Github size={18} strokeWidth={1.5} className="text-muted mr-3 shrink-0" />
          <input
            type="text"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="owner/repo or github.com/owner/repo"
            className="w-full min-w-0 bg-transparent text-base sm:text-sm text-text placeholder:text-muted focus:outline-none py-1.5"
            aria-label="GitHub repository"
            autoFocus
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-40 transition-opacity ml-2 shrink-0"
            aria-label="Start scan"
          >
            <ArrowRight size={16} />
          </button>
        </div>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs font-mono text-muted">
        <span>Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => {
              setInputValue(ex);
              onStartAnalysis(ex);
            }}
            className="px-2.5 py-1 rounded-full border border-border text-secondary hover:text-text hover:bg-raised transition-colors"
          >
            {ex}
          </button>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-1 xs:grid-cols-3 gap-3 w-full max-w-lg text-left">
        {FEATURES.map(({ icon: Icon, label, hint }) => (
          <div key={label} className="rounded-lg border border-border-subtle bg-surface p-3">
            <Icon size={15} className="text-tide mb-1.5" />
            <div className="text-xs font-semibold text-text">{label}</div>
            <div className="text-[11px] text-muted leading-snug mt-0.5">{hint}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
