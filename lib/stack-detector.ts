export interface StackInfo {
  /** Dominant language by file count, e.g. "TypeScript". */
  language: string;
  /** Frameworks / tooling inferred from manifest and config files. */
  frameworks: string[];
  /** Top languages with their file counts. */
  languages: Array<{ name: string; files: number }>;
  fileCount: number;
}

const LANGUAGES: Array<[RegExp, string]> = [
  [/\.tsx?$/i, "TypeScript"],
  [/\.(jsx?|mjs|cjs)$/i, "JavaScript"],
  [/\.py$/i, "Python"],
  [/\.go$/i, "Go"],
  [/\.rs$/i, "Rust"],
  [/\.rb$/i, "Ruby"],
  [/\.php$/i, "PHP"],
  [/\.java$/i, "Java"],
  [/\.kt$/i, "Kotlin"],
  [/\.cs$/i, "C#"],
  [/\.(c|h)$/i, "C"],
  [/\.(cc|cpp|hpp)$/i, "C++"],
  [/\.swift$/i, "Swift"],
  [/\.vue$/i, "Vue"],
  [/\.svelte$/i, "Svelte"],
  [/\.(sh|bash)$/i, "Shell"],
];

const FRAMEWORKS: Array<[RegExp, string]> = [
  [/(^|\/)next\.config\.(js|mjs|ts)$/, "Next.js"],
  [/(^|\/)vite\.config\.(js|ts|mjs)$/, "Vite"],
  [/(^|\/)nuxt\.config\.(js|ts)$/, "Nuxt"],
  [/(^|\/)svelte\.config\.js$/, "SvelteKit"],
  [/(^|\/)angular\.json$/, "Angular"],
  [/(^|\/)tailwind\.config\.(js|ts|mjs|cjs)$/, "Tailwind CSS"],
  [/(^|\/)package\.json$/, "Node.js"],
  [/(^|\/)(pyproject\.toml|requirements\.txt|Pipfile)$/, "Python packaging"],
  [/(^|\/)manage\.py$/, "Django"],
  [/(^|\/)Cargo\.toml$/, "Cargo"],
  [/(^|\/)go\.mod$/, "Go modules"],
  [/(^|\/)composer\.json$/, "Composer"],
  [/(^|\/)artisan$/, "Laravel"],
  [/(^|\/)Gemfile$/, "Bundler"],
  [/(^|\/)(Dockerfile|docker-compose\.ya?ml)$/, "Docker"],
  [/(^|\/)\.github\/workflows\//, "GitHub Actions"],
];

/** Derives the stack from the repository's real file list. */
export function detectStack(paths: string[]): StackInfo {
  const counts = new Map<string, number>();
  for (const p of paths) {
    const hit = LANGUAGES.find(([re]) => re.test(p));
    if (hit) counts.set(hit[1], (counts.get(hit[1]) ?? 0) + 1);
  }
  const languages = [...counts.entries()]
    .map(([name, files]) => ({ name, files }))
    .sort((a, b) => b.files - a.files)
    .slice(0, 4);

  const frameworks = FRAMEWORKS.filter(([re]) => paths.some((p) => re.test(p))).map(([, name]) => name);

  return {
    language: languages[0]?.name ?? "Unknown",
    frameworks: [...new Set(frameworks)],
    languages,
    fileCount: paths.length,
  };
}
