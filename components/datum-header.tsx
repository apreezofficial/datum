"use client";

import * as React from "react";
import { PanelLeftOpen, Github, Figma, Plane } from "lucide-react";
import { HeaderPlaneAnimation } from "@/components/header-plane-animation";
import { ModelSelector } from "@/components/model-selector";
import type { ModelOption, UserProfile } from "@/types/datum";

interface DatumHeaderProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  activeItem: string | null;
  sourceType: "github" | "figma";
  analysisComplete: boolean;
  models: ModelOption[];
  selectedModelId: string;
  onSelectModel: (id: string) => void;
  autopilot: boolean;
  setAutopilot: (val: boolean) => void;
  isLoggedIn: boolean;
  userProfile: UserProfile | null;
  onToggleLogin: () => void;
  isFigmaConnected: boolean;
  onToggleFigmaConnection: () => void;
}

export function DatumHeader({
  sidebarOpen,
  setSidebarOpen,
  activeItem,
  sourceType,
  analysisComplete,
  models,
  selectedModelId,
  onSelectModel,
  autopilot,
  setAutopilot,
  isLoggedIn,
  userProfile,
  onToggleLogin,
  isFigmaConnected,
  onToggleFigmaConnection,
}: DatumHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between px-4 sm:px-6 bg-surface shrink-0">
      <div className="flex items-center gap-2.5 sm:gap-3">
        {!sidebarOpen && (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 text-secondary hover:text-text hover:bg-raised rounded-md transition-colors"
            title="Open sidebar"
          >
            <PanelLeftOpen size={16} strokeWidth={1.5} />
          </button>
        )}

        {/* When viewing an analyzed repo or file */}
        {activeItem && (
          <div className="flex items-center gap-2 text-xs font-mono text-text">
            {sourceType === "github" ? (
              <Github size={14} className="text-secondary shrink-0" />
            ) : (
              <Figma size={14} className="text-secondary shrink-0" />
            )}
            <span className="font-semibold text-text truncate max-w-[130px] sm:max-w-xs">
              {activeItem}
            </span>
            {analysisComplete && (
              <span className="text-[11px] text-tide bg-tide/10 px-2 py-0.5 rounded-full font-sans hidden sm:inline-block">
                Surveyed
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Model Selector Dropdown */}
        <ModelSelector
          models={models}
          selectedModelId={selectedModelId}
          onSelectModel={onSelectModel}
        />

        {/* Auto-Pilot Toggle Button & Supersonic Plane Animation beside it */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutopilot(!autopilot)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              autopilot
                ? "bg-tide/15 text-tide border border-tide/40 shadow-xs"
                : "border border-border bg-surface text-secondary hover:text-text hover:bg-raised"
            }`}
            title={
              autopilot
                ? "Auto-Pilot active: Datum cloud daemon works even if you close the browser or shut your PC"
                : "Enable Auto-Pilot for background cloud execution"
            }
          >
            <Plane
              size={13}
              className={autopilot ? "rotate-[-25deg] text-tide transition-transform" : "text-muted"}
            />
            <span className="hidden sm:inline">Auto-Pilot:</span>
            <span className={autopilot ? "font-bold text-tide" : "font-normal text-muted"}>
              {autopilot ? "ON" : "OFF"}
            </span>
            {autopilot && <span className="h-1.5 w-1.5 rounded-full bg-tide animate-ping shrink-0" />}
          </button>

          {/* Animated Supersonic Plane flying right beside the button */}
          {autopilot && <HeaderPlaneAnimation />}
        </div>

        {sourceType === "github" ? (
          isLoggedIn ? (
            <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-text font-medium">{userProfile?.name}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onToggleLogin}
              className="flex items-center gap-1.5 rounded-full border border-border bg-surface hover:bg-raised px-3.5 py-1.5 text-xs text-text transition-colors shadow-xs"
            >
              <Github size={13} />
              <span>Sign in</span>
            </button>
          )
        ) : isFigmaConnected ? (
          <div className="flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
            <span className="text-text font-medium">Figma Authorized</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggleFigmaConnection}
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface hover:bg-raised px-3.5 py-1.5 text-xs text-text transition-colors shadow-xs"
          >
            <Figma size={13} />
            <span>Connect Figma</span>
          </button>
        )}
      </div>
    </header>
  );
}
