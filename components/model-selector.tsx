"use client";

import * as React from "react";
import { Cpu, ChevronDown } from "lucide-react";
import type { ModelOption } from "@/types/datum";

interface ModelSelectorProps {
  models: ModelOption[];
  selectedModelId: string;
  onSelectModel: (modelId: string) => void;
}

export function ModelSelector({
  models,
  selectedModelId,
  onSelectModel,
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeModel = models.find((m) => m.id === selectedModelId) || models[0];

  if (!activeModel) return null;

  // Shorten name cleanly for mobile screens so it never overflows or breaks onto 2 lines
  const shortName = activeModel.name
    .replace(/^GPT-OSS\s+/i, "OSS ")
    .replace(/^Qwen\s+/i, "Qwen ")
    .replace(/^Allam\s+/i, "Allam ");

  return (
    <div className="relative shrink-0" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 rounded-full border border-border bg-surface hover:bg-raised px-2 sm:px-3 py-1.5 text-xs text-text transition-colors shadow-xs whitespace-nowrap"
        title={`Selected evaluation model: ${activeModel.name}`}
      >
        <Cpu size={13} className="text-secondary shrink-0" />
        <span className="font-medium whitespace-nowrap text-[11px] sm:text-xs">
          {shortName}
        </span>
        <ChevronDown size={11} className="text-muted shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-60 sm:w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-surface p-1.5 shadow-xl z-50 select-none animate-in fade-in duration-100">
          <div className="px-2.5 py-1 text-[10px] font-mono text-muted uppercase tracking-wider">
            Model
          </div>
          <div className="space-y-0.5">
            {models.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onSelectModel(m.id);
                  setIsOpen(false);
                }}
                className={`flex flex-col w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  selectedModelId === m.id
                    ? "bg-raised font-medium text-text"
                    : "text-secondary hover:bg-raised/60 hover:text-text"
                }`}
              >
                <div className="flex items-center justify-between w-full gap-2">
                  <span className="font-semibold text-text truncate">{m.name}</span>
                  <span className="text-[10px] font-mono text-tide bg-tide/10 px-1.5 py-0.5 rounded shrink-0">
                    {m.tier}
                  </span>
                </div>
                <span className="text-[11px] text-muted leading-tight mt-0.5 line-clamp-2">
                  {m.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
