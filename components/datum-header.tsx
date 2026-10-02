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
  workspaceView?: "vibe" | "audit";
  onToggleWorkspaceView?: (view: "vibe" | "audit") => void;
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
  workspaceView = "vibe",
  onToggleWorkspaceView,
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
    <header className="flex h-14 items-center justify-between px-3 sm:px-6 bg-surface shrink-0 border-b border-border/40 gap-2 overflow-x-hidden">
      {/* Left: Sidebar toggle + Active Repository Badge */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
        {!sidebarOpen && (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 text-secondary hover:text-text hover:bg-raised rounded-md transition-colors shrink-0"
            title="Open sidebar"
          >
            <PanelLeftOpen size={16} strokeWidth={1.5} />
          </button>
        )}

        {/* When viewing an analyzed repo or file */}
        {activeItem && (
          <div className="flex items-center gap-1.5 text-xs font-mono text-text min-w-0">
            {sourceType === "github" ? (
              <Github size={13} className="text-secondary shrink-0" />
            ) : (
              <Figma size={13} className="text-secondary shrink-0" />
            )}
            <span className="font-semibold text-text truncate max-w-[100px] xs:max-w-[140px] sm:max-w-[200px] md:max-w-xs">
              {activeItem}
            </span>
            {analysisComplete && (
              <span className="text-[10px] text-tide bg-tide/10 border border-tide/20 px-2 py-0.5 rounded-full font-mono hidden md:inline-flex items-center gap-1 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-tide animate-pulse" />
                <span>Vibe Ready</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Center: Vibe Code vs Audit Mode Toggle (when a repo/file is active) */}
      {activeItem && onToggleWorkspaceView && (
        <div className="hidden sm:inline-flex items-center p-0.5 rounded-full border border-border bg-raised/50 text-xs font-mono">
          <button
            type="button"
            onClick={() => onToggleWorkspaceView("vibe")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              workspaceView === "vibe"
                ? "bg-accent text-accent-foreground shadow-xs"
                : "text-secondary hover:text-text"
            }`}
          >
            ✨ Vibe Code
          </button>
          <button
            type="button"
            onClick={() => onToggleWorkspaceView("audit")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              workspaceView === "audit"
                ? "bg-accent text-accent-foreground shadow-xs"
                : "text-secondary hover:text-text"
            }`}
          >
            🔍 Audit
          </button>
        </div>
      )}

      {/* Right: Model Selector, Auto-Pilot, and Auth Button */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Model Selector Dropdown */}
        <ModelSelector
          models={models}
          selectedModelId={selectedModelId}
          onSelectModel={onSelectModel}
        />

        {/* Auto-Pilot Toggle Button */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => setAutopilot(!autopilot)}
            className={`flex items-center gap-1 sm:gap-1.5 rounded-full px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-all shrink-0 ${
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
              className={autopilot ? "rotate-[-25deg] text-tide transition-transform shrink-0" : "text-muted shrink-0"}
            />
            <span className="hidden md:inline">Auto-Pilot:</span>
            <span className={`text-[11px] sm:text-xs ${autopilot ? "font-bold text-tide" : "font-normal text-muted"}`}>
              {autopilot ? "ON" : "OFF"}
            </span>
            {autopilot && <span className="h-1.5 w-1.5 rounded-full bg-tide animate-ping shrink-0" />}
          </button>

          {/* Animated Supersonic Plane flying right beside the button on desktop */}
          {autopilot && <HeaderPlaneAnimation />}
        </div>

        {/* Auth / Connection Button */}
        {sourceType === "github" ? (
          isLoggedIn ? (
            <div className="flex items-center gap-1.5 rounded-full border border-border px-2.5 sm:px-3 py-1 text-xs shrink-0 max-w-[110px] sm:max-w-none">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-text font-medium truncate text-[11px] sm:text-xs">
                {userProfile?.name}
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onToggleLogin}
              className="flex items-center gap-1.5 rounded-full border border-border bg-surface hover:bg-raised px-2.5 sm:px-3.5 py-1.5 text-xs text-text transition-colors shadow-xs shrink-0 whitespace-nowrap"
            >
              <Github size={13} className="shrink-0" />
              <span className="hidden xs:inline text-[11px] sm:text-xs">Sign in</span>
            </button>
          )
        ) : isFigmaConnected ? (
          <div className="flex items-center gap-1.5 rounded-full border border-border px-2.5 sm:px-3 py-1 text-xs shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0" />
            <span className="text-text font-medium text-[11px] sm:text-xs">Connected</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggleFigmaConnection}
            className="flex items-center gap-1.5 rounded-full border border-border bg-surface hover:bg-raised px-2.5 sm:px-3.5 py-1.5 text-xs text-text transition-colors shadow-xs shrink-0 whitespace-nowrap"
          >
            <Figma size={13} className="shrink-0" />
            <span className="hidden xs:inline text-[11px] sm:text-xs">Connect</span>
          </button>
        )}
      </div>
    </header>
  );
}
