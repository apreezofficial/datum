"use client";

import * as React from "react";
import { Github, Figma, ArrowRight } from "lucide-react";

interface HeroViewProps {
  sourceType: "github" | "figma";
  setSourceType: (type: "github" | "figma") => void;
  inputValue: string;
  setInputValue: (val: string) => void;
  onStartAnalysis: (overrideUrl?: string) => void;
}

export function HeroView({
  sourceType,
  setSourceType,
  inputValue,
  setInputValue,
  onStartAnalysis,
}: HeroViewProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartAnalysis();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-6 text-center max-w-2xl mx-auto">
      {/* Type Switcher (GitHub vs Figma) */}
      <div className="inline-flex items-center p-1 rounded-full border border-border bg-surface mb-6 shadow-xs">
        <button
          type="button"
          onClick={() => setSourceType("github")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            sourceType === "github"
              ? "bg-accent text-accent-foreground"
              : "text-secondary hover:text-text"
          }`}
        >
          <Github size={13} />
          <span>GitHub</span>
        </button>
        <button
          type="button"
          onClick={() => setSourceType("figma")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            sourceType === "figma"
              ? "bg-accent text-accent-foreground"
              : "text-secondary hover:text-text"
          }`}
        >
          <Figma size={13} />
          <span>Figma</span>
        </button>
      </div>

      {/* Clean, perfectly sized title & subtitle */}
      <h1 className="text-2xl font-semibold tracking-tight text-text mb-2">
        {sourceType === "github" ? "Analyze your codebase for flaws." : "Analyze your Figma design for flaws."}
      </h1>
      <p className="text-xs sm:text-sm text-secondary max-w-md mb-7 leading-relaxed">
        {sourceType === "github"
          ? "Scan any repository for security vulnerabilities, genuine in-code TODOs, bugs, performance bottlenecks, and architectural defects."
          : "Audit any Figma design file for token discrepancies, missing variables, accessibility contrasts, and design-to-code alignment."}
      </p>

      {/* Pill Search Input with Arrow button */}
      <form onSubmit={handleSubmit} className="w-full max-w-lg">
        <div className="relative flex items-center w-full rounded-full border border-border bg-surface shadow-xs hover:border-border/80 focus-within:border-accent transition-all px-4 py-2.5">
          <div className="text-muted mr-3">
            {sourceType === "github" ? (
              <Github size={18} strokeWidth={1.5} />
            ) : (
              <Figma size={18} strokeWidth={1.5} />
            )}
          </div>

          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={
              sourceType === "github"
                ? "github.com/shadcn/ui or owner/repo..."
                : "figma.com/file/... or design system..."
            }
            className="w-full bg-transparent text-sm text-text placeholder:text-muted focus:outline-none"
            autoFocus
          />

          <button
            type="submit"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-foreground hover:opacity-90 transition-opacity ml-2 shrink-0"
            aria-label="Start analysis"
          >
            <ArrowRight size={14} />
          </button>
        </div>
      </form>

      {/* Quick Example Suggestions */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs font-mono text-muted">
        <span>Try:</span>
        {sourceType === "github" ? (
          <>
            <button
              type="button"
              onClick={() => {
                setInputValue("shadcn/ui");
                onStartAnalysis("shadcn/ui");
              }}
              className="text-secondary hover:text-text underline underline-offset-2"
            >
              shadcn/ui
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => {
                setInputValue("tailwindlabs/tailwindcss");
                onStartAnalysis("tailwindlabs/tailwindcss");
              }}
              className="text-secondary hover:text-text underline underline-offset-2"
            >
              tailwindcss
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => {
                setInputValue("vercel/next.js");
                onStartAnalysis("vercel/next.js");
              }}
              className="text-secondary hover:text-text underline underline-offset-2"
            >
              vercel/next.js
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                setInputValue("figma.com/file/acme-design-system");
                onStartAnalysis("figma.com/file/acme-design-system");
              }}
              className="text-secondary hover:text-text underline underline-offset-2"
            >
              acme-design-system
            </button>
            <span>·</span>
            <button
              type="button"
              onClick={() => {
                setInputValue("figma.com/file/shadcn-tokens");
                onStartAnalysis("figma.com/file/shadcn-tokens");
              }}
              className="text-secondary hover:text-text underline underline-offset-2"
            >
              shadcn-tokens
            </button>
          </>
        )}
      </div>
    </div>
  );
}
