export interface FolderGroup {
  /** Folder path without trailing slash; "" means files at the repo root. */
  path: string;
  files: number;
  /** Tests, docs, examples, benchmarks: listed but not ticked by default. */
  lowValue?: boolean;
}

/**
 * Splits a big file list into selectable folders. Starts at the top level and
 * keeps expanding any folder larger than `maxPerGroup` into its children, so
 * every choice is small enough to scan on its own.
 */
export function groupFolders(paths: string[], maxPerGroup: number, maxDepth = 4): FolderGroup[] {
  const result: FolderGroup[] = [];

  const rootFiles = paths.filter((p) => !p.includes("/")).length;
  if (rootFiles > 0) result.push({ path: "", files: rootFiles });

  const expand = (prefix: string, items: string[], depth: number) => {
    const buckets = new Map<string, string[]>();
    const direct: string[] = [];
    for (const p of items) {
      const rest = prefix ? p.slice(prefix.length + 1) : p;
      const slash = rest.indexOf("/");
      if (slash < 0) {
        direct.push(p);
        continue;
      }
      const key = prefix ? `${prefix}/${rest.slice(0, slash)}` : rest.slice(0, slash);
      const list = buckets.get(key);
      if (list) list.push(p);
      else buckets.set(key, [p]);
    }
    if (prefix && direct.length > 0) result.push({ path: `${prefix}/*`, files: direct.length });
    for (const [key, list] of buckets) {
      if (list.length > maxPerGroup && depth < maxDepth) expand(key, list, depth + 1);
      else result.push({ path: key, files: list.length });
    }
  };

  expand("", paths.filter((p) => p.includes("/")), 1);
  return result.sort((a, b) => b.files - a.files || a.path.localeCompare(b.path));
}

/** True when `file` falls inside any selected group ("x/*" = files directly in x). */
export function inFolders(file: string, folders: string[]): boolean {
  return folders.some((f) => {
    if (f === "") return !file.includes("/");
    if (f.endsWith("/*")) {
      const dir = f.slice(0, -2);
      return file.startsWith(dir + "/") && !file.slice(dir.length + 1).includes("/");
    }
    return file.startsWith(f + "/");
  });
}
