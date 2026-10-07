"use client";

import * as React from "react";
import { FolderTree, Loader2, Play } from "lucide-react";
import type { FolderGroup } from "@/lib/folders";

export interface FolderSelection {
  repo: string;
  total: number;
  limit: number;
  groups: FolderGroup[];
}

const LIKELY_SOURCE = /^(src|app|apps|lib|libs|server|api|packages|pkg|cmd|internal|components|pages|core)(\/|$)/;

/** Pre-tick likely source folders until we hit the comfortable-scan limit. */
function defaultPicks(groups: FolderGroup[], limit: number): Set<string> {
  const picked = new Set<string>();
  let used = 0;
  for (const g of [...groups].sort((a, b) => a.files - b.files)) {
    if (!LIKELY_SOURCE.test(g.path) || used + g.files > limit) continue;
    picked.add(g.path);
    used += g.files;
  }
  return picked;
}

export function FolderPicker({
  selection,
  busy,
  onScan,
}: {
  selection: FolderSelection;
  busy: boolean;
  onScan: (folders: string[]) => void;
}) {
  const [picked, setPicked] = React.useState<Set<string>>(() =>
    defaultPicks(selection.groups, selection.limit)
  );
  React.useEffect(() => {
    setPicked(defaultPicks(selection.groups, selection.limit));
  }, [selection]);

  const count = selection.groups.filter((g) => picked.has(g.path)).reduce((n, g) => n + g.files, 0);
  const over = count > selection.limit * 2;

  const toggle = (path: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  return (
    <div className="border border-border rounded-xl bg-surface p-4 sm:p-5 space-y-4">
      <div className="flex items-start gap-2.5">
        <FolderTree size={18} className="text-tide shrink-0 mt-0.5" />
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-text">
            {selection.repo} is large ({selection.total.toLocaleString()} files)
          </h3>
          <p className="text-xs text-secondary mt-1 leading-relaxed">
            Pick the folders to scan. You can come back and scan others afterwards.
          </p>
        </div>
      </div>

      <div className="flex gap-3 text-[11px] font-mono text-secondary">
        <button
          type="button"
          className="hover:text-text underline"
          onClick={() => setPicked(new Set(selection.groups.map((g) => g.path)))}
        >
          Select all
        </button>
        <button type="button" className="hover:text-text underline" onClick={() => setPicked(new Set())}>
          Clear
        </button>
      </div>

      <div className="max-h-[50dvh] overflow-y-auto divide-y divide-border-subtle border border-border-subtle rounded-lg">
        {selection.groups.map((g) => (
          <label
            key={g.path || "(root)"}
            className="flex items-center gap-3 px-3 py-3 text-xs cursor-pointer hover:bg-raised"
          >
            <input
              type="checkbox"
              checked={picked.has(g.path)}
              onChange={() => toggle(g.path)}
              className="accent-[var(--tide,#2563eb)]"
            />
            <span className="font-mono text-text truncate flex-1">{g.path === "" ? "(root files)" : g.path}</span>
            <span className="font-mono text-secondary shrink-0">{g.files.toLocaleString()} files</span>
          </label>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className={`text-xs font-mono ${over ? "text-peak" : "text-secondary"}`}>
          {count.toLocaleString()} files selected
          {over ? " — large; may not finish in one pass" : ""}
        </span>
        <button
          type="button"
          disabled={busy || picked.size === 0}
          onClick={() => onScan([...picked])}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded bg-tide text-white disabled:opacity-40"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          <span>Scan selected</span>
        </button>
      </div>
    </div>
  );
}
