"use client";

import * as React from "react";

export function AutopilotPlaneAnimation() {
  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border bg-surface p-6 shadow-sm select-none">
      {/* Background Radar & Elevation Grid */}
      <div className="absolute inset-0 opacity-15 pointer-events-none">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="radar-pulse" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--tide)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="50%" cy="50%" r="90" fill="none" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
          <circle cx="50%" cy="50%" r="140" fill="none" stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="0" y1="50%" x2="100%" y2="50%" stroke="var(--border)" strokeWidth="0.75" />
          <line x1="50%" y1="0" x2="50%" y2="100%" stroke="var(--border)" strokeWidth="0.75" />
        </svg>
      </div>

      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
        {/* Animated Supersonic Jet with Contrail */}
        <div className="relative w-48 h-28 flex items-center justify-center">
          <svg
            viewBox="0 0 200 100"
            className="w-full h-full overflow-visible"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Pulsing Jet Contrails / Vapor Trails */}
            <path
              d="M 10,50 Q 50,45 85,50"
              stroke="var(--tide)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="6 4"
              className="animate-pulse"
              opacity="0.8"
            />
            <path
              d="M 5,53 Q 45,50 82,53"
              stroke="var(--tide)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="4 3"
              className="animate-pulse"
              opacity="0.4"
            />
            <path
              d="M 15,47 Q 55,44 85,47"
              stroke="var(--tide)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="4 3"
              className="animate-pulse"
              opacity="0.4"
            />

            {/* Glowing Engine Thrust Particles */}
            <circle cx="84" cy="50" r="3" fill="var(--tide)" className="animate-ping" />
            <circle cx="85" cy="50" r="2" fill="var(--surface)" />

            {/* Modern Supersonic Jet SVG (Sleek aerodynamic delta wing) */}
            <g transform="translate(85, 30)">
              {/* Jet Wing Shadows */}
              <path
                d="M 0,20 L 35,6 L 42,20 L 35,34 Z"
                fill="currentColor"
                className="text-text opacity-90"
              />
              {/* Main Fuselage */}
              <path
                d="M 15,20 L 52,20 L 58,20 L 40,15 L 20,18 Z"
                fill="currentColor"
                className="text-text"
              />
              <path
                d="M 15,20 L 52,20 L 58,20 L 40,25 L 20,22 Z"
                fill="currentColor"
                className="text-text"
              />
              {/* Cockpit Canopy */}
              <path
                d="M 44,20 L 36,18 L 32,20 L 36,22 Z"
                fill="var(--tide)"
                opacity="0.9"
              />
              {/* Wingtips & Fin */}
              <line x1="35" y1="6" x2="35" y2="4" stroke="var(--tide)" strokeWidth="2" strokeLinecap="round" />
              <line x1="35" y1="34" x2="35" y2="36" stroke="var(--tide)" strokeWidth="2" strokeLinecap="round" />
            </g>
          </svg>
        </div>

        {/* Text Description & Status Info */}
        <div className="flex-1 space-y-1.5 text-center sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full bg-tide/10 px-2.5 py-0.5 text-xs font-mono font-medium text-tide">
            <span className="h-1.5 w-1.5 rounded-full bg-tide animate-ping" />
            <span>AUTOPILOT ENGAGED · CLOUD DAEMON ACTIVE</span>
          </div>

          <h4 className="text-sm font-bold text-text">
            Agent is running autonomously in the cloud
          </h4>
          <p className="text-xs text-secondary leading-relaxed max-w-md">
            You can safely close this browser tab, shut your laptop, or walk away. Datum will complete the survey, map all UI drift, and open the fix PR on GitHub automatically.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-4 font-mono text-xs text-muted">
            <span>Daemon: <b className="text-text">datum-worker-01</b></span>
            <span>·</span>
            <span>Persistence: <b className="text-emerald-500">Always-On</b></span>
            <span>·</span>
            <span>Browser Independent: <b className="text-tide">Yes</b></span>
          </div>
        </div>
      </div>
    </div>
  );
}
