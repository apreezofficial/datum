"use client";

import * as React from "react";
import { PanelLeftOpen, Github } from "lucide-react";
import { ModelSelector } from "@/components/model-selector";
import type { ModelOption } from "@/types/datum";

interface DatumHeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  activeItem: string | null;
  analysisComplete: boolean;
  models: ModelOption[];
  selectedModelId: string;
  onSelectModel: (id: string) => void;
}

export function DatumHeader({
  sidebarOpen,
  setSidebarOpen,
  activeItem,
  analysisComplete,
  models,
  selectedModelId,
  onSelectModel,
}: DatumHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between gap-2 px-3 sm:px-6 bg-surface shrink-0 border-b border-border/40">
      <div className="flex items-center gap-2 min-w-0">
        {!sidebarOpen && (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-2 -ml-1 text-secondary hover:text-text hover:bg-raised rounded-md transition-colors shrink-0"
            aria-label="Open sidebar"
          >
            <PanelLeftOpen size={18} strokeWidth={1.5} />
          </button>
        )}

        {activeItem && (
          <div className="flex items-center gap-1.5 text-xs font-mono text-text min-w-0">
            <Github size={13} className="text-secondary shrink-0" />
            <span className="font-semibold truncate">{activeItem}</span>
            {analysisComplete && (
              <span className="hidden md:inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Scanned
              </span>
            )}
          </div>
        )}
      </div>

      <ModelSelector models={models} selectedModelId={selectedModelId} onSelectModel={onSelectModel} />
    </header>
  );
}
