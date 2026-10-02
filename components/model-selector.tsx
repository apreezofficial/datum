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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 rounded-full border border-border bg-surface hover:bg-raised px-2.5 sm:px-3 py-1.5 text-xs text-text transition-colors shadow-xs"
        title="Select evaluation model"
      >
        <Cpu size={13} className="text-secondary shrink-0" />
        <span className="font-medium hidden xs:inline">{activeModel.name}</span>
        <span className="font-medium xs:hidden">{activeModel.name.replace(/^[^-]+-/, "")}</span>
        <ChevronDown size={11} className="text-muted shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-64 rounded-xl border border-border bg-surface p-1.5 shadow-xl z-50 select-none animate-in fade-in duration-100">
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
                <div className="flex items-center justify-between w-full">
                  <span className="font-semibold text-text">{m.name}</span>
                  <span className="text-[10px] font-mono text-tide bg-tide/10 px-1.5 py-0.5 rounded">
                    {m.tier}
                  </span>
                </div>
                <span className="text-[11px] text-muted leading-tight mt-0.5">
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
