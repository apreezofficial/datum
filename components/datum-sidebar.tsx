"use client";

import * as React from "react";
import { DatumLogoSmall } from "@/components/datum-logo";
import {
  PanelLeftClose,
  Plus,
  Github,
  Figma,
  ExternalLink,
  LogIn,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import type { HistoryItem, UserProfile } from "@/types/datum";

interface DatumSidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  onResetToNew: () => void;
  history: HistoryItem[];
  activeItem?: string | null;
  onSelectHistory: (item: HistoryItem) => void;
  isLoggedIn: boolean;
  userProfile: UserProfile | null;
  onToggleLogin: () => void;
  theme: string;
  onToggleTheme: () => void;
}

export function DatumSidebar({
  sidebarOpen,
  setSidebarOpen,
  onResetToNew,
  history,
  activeItem,
  onSelectHistory,
  isLoggedIn,
  userProfile,
  onToggleLogin,
  theme,
  onToggleTheme,
}: DatumSidebarProps) {
  return (
    <>
      {/* Mobile drawer backdrop overlay */}
      {sidebarOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape" || e.key === "Enter") setSidebarOpen(false);
          }}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden cursor-pointer transition-opacity"
        />
      )}

      <aside
        className={`${
          sidebarOpen ? "translate-x-0 w-64" : "-translate-x-full md:translate-x-0 md:w-0"
        } fixed md:static inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-surface transition-all duration-200 ease-in-out shrink-0 overflow-hidden shadow-2xl md:shadow-none`}
      >
        {/* Top: Logo + Toggle Sidebar */}
        <div className="flex h-14 items-center justify-between px-3.5 border-b border-border-subtle shrink-0">
          <button
            type="button"
            onClick={onResetToNew}
            className="flex items-center gap-2 p-1 rounded hover:opacity-80 transition-opacity"
            aria-label="New session"
          >
            <DatumLogoSmall size={20} />
          </button>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="p-1 text-secondary hover:text-text rounded transition-colors focus:outline-none"
            title="Close sidebar"
          >
            <PanelLeftClose size={17} strokeWidth={1.5} />
          </button>
        </div>

        {/* Minimal + New Chat / New Survey */}
        <div className="px-3 pt-2 shrink-0">
          <button
            type="button"
            onClick={onResetToNew}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-normal text-text hover:bg-raised transition-colors whitespace-nowrap"
          >
            <Plus size={15} strokeWidth={1.75} className="text-secondary shrink-0" />
            <span className="whitespace-nowrap">New survey</span>
          </button>
        </div>

        {/* Center: Session History */}
        <div className="flex-1 overflow-y-auto px-3 py-6">
          {history.length > 0 ? (
            <div className="space-y-1">
              <span className="text-[10px] font-mono text-muted uppercase tracking-wider px-2 block mb-2">
                Recent Audits
              </span>
              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectHistory(item)}
                  className={`flex flex-col w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors truncate ${
                    activeItem === item.name
                      ? "bg-raised font-medium text-text"
                      : "text-secondary hover:text-text hover:bg-raised"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-medium truncate">
                    {item.type === "github" ? (
                      <Github size={12} className="shrink-0 text-muted" />
                    ) : (
                      <Figma size={12} className="shrink-0 text-muted" />
                    )}
                    <span className="truncate">{item.name}</span>
                  </div>
                  <span className="text-[10px] text-muted font-mono pl-4">{item.summary}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <p className="text-xs text-muted leading-relaxed">
                Sign in to save and sync your design system surveys.
              </p>
            </div>
          )}
        </div>

        {/* Bottom User Profile + Light/Dark Mode Switcher */}
        <div className="flex items-center justify-between p-3 border-t border-border-subtle shrink-0">
          {isLoggedIn ? (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={userProfile?.avatar}
                  alt={userProfile?.name}
                  className="h-6 w-6 rounded-full object-cover shrink-0"
                />
                <span className="absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full bg-emerald-500 ring-1 ring-surface" />
              </div>
              <div className="truncate">
                <p className="text-xs font-medium text-text truncate">{userProfile?.name}</p>
              </div>
              <button
                type="button"
                onClick={onToggleLogin}
                className="text-muted hover:text-peak ml-1 shrink-0"
                title="Sign out"
              >
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onToggleLogin}
              className="flex items-center gap-2 text-secondary hover:text-text transition-colors focus:outline-none whitespace-nowrap"
            >
              <LogIn size={15} strokeWidth={1.5} className="shrink-0" />
              <span className="whitespace-nowrap">Sign in</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleTheme}
            className="p-1 text-secondary hover:text-text rounded transition-colors focus:outline-none shrink-0"
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? <Moon size={15} strokeWidth={1.5} /> : <Sun size={15} strokeWidth={1.5} />}
          </button>
        </div>
      </aside>
    </>
  );
}
