"use client";

import * as React from "react";

export function HeaderPlaneAnimation() {
  return (
    <div
      className="hidden sm:inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full border border-tide/30 bg-tide/5 text-xs font-mono text-tide select-none animate-in fade-in slide-in-from-left-2 duration-300"
      title="Supersonic Cloud Daemon: Datum runs autonomously in the background even if you close the browser or shut down your PC"
    >
      <div className="relative h-6 w-28 overflow-visible flex items-center">
        <svg
          viewBox="0 0 120 28"
          className="h-full w-full overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Animated contrail vapor trails streaming behind */}
          <line
            x1="0"
            y1="14"
            x2="66"
            y2="14"
            stroke="var(--tide)"
            strokeWidth="2"
            strokeDasharray="5 3"
            strokeLinecap="round"
            className="animate-pulse"
            opacity="0.9"
          />
          <line
            x1="10"
            y1="10"
            x2="64"
            y2="10"
            stroke="var(--tide)"
            strokeWidth="1"
            strokeDasharray="3 3"
            strokeLinecap="round"
            opacity="0.5"
          />
          <line
            x1="10"
            y1="18"
            x2="64"
            y2="18"
            stroke="var(--tide)"
            strokeWidth="1"
            strokeDasharray="3 3"
            strokeLinecap="round"
            opacity="0.5"
          />

          {/* Engine thrust glow */}
          <circle cx="66" cy="14" r="2.5" fill="var(--tide)" className="animate-ping" />
          <circle cx="66" cy="14" r="1.5" fill="var(--surface)" />

          {/* Sleek Supersonic Jet Plane */}
          <g transform="translate(66, 4) scale(0.7)">
            {/* Wing / Delta body */}
            <path
              d="M 0,14 L 28,2 L 35,14 L 28,26 Z"
              fill="currentColor"
              className="text-text opacity-90"
            />
            {/* Fuselage core */}
            <path
              d="M 10,14 L 46,14 L 50,14 L 32,9 L 14,12 Z"
              fill="currentColor"
              className="text-text"
            />
            <path
              d="M 10,14 L 46,14 L 50,14 L 32,19 L 14,16 Z"
              fill="currentColor"
              className="text-text"
            />
            {/* Cockpit Canopy */}
            <path
              d="M 36,14 L 28,11 L 24,14 L 28,17 Z"
              fill="var(--tide)"
              opacity="0.95"
            />
            {/* Wingtip fins */}
            <line x1="28" y1="2" x2="28" y2="0" stroke="var(--tide)" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="28" y1="26" x2="28" y2="28" stroke="var(--tide)" strokeWidth="1.5" strokeLinecap="round" />
          </g>
        </svg>
      </div>

      <span className="text-xs text-secondary whitespace-nowrap hidden lg:inline">
        cloud agent flying
      </span>
    </div>
  );
}
