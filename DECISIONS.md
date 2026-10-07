# Architectural and Design Decisions

Record format: Date | Decision | Why

- 2026-09-30 | Initial project setup with Next.js 15, Tailwind CSS, TypeScript strict | Baseline stack
- 2026-10-07 | Product is a codebase scanner for security flaws, bugs and TODOs; design-system/vibecoding/Figma direction dropped | The earlier direction was a mistake; this is the intended product
- 2026-10-07 | Deterministic static rules do the primary detection; the LLM only adds a second pass on high-risk files | TODOs and secrets must be real and line-accurate; models hallucinate and can't read a whole repo in context
- 2026-10-07 | Read every scannable file server-side (no file-count cap, 1 MB each, 4 min budget) instead of sampling 18 files | Sampling made "scanned N files" claims untrue; the cap is surfaced as `filesSkipped`
- 2026-10-07 | `POST /api/scan` streams NDJSON events | Progress shown in the UI reflects actual work instead of timed delays
- 2026-10-07 | Removed `/api/repo/*`, `/api/groq/audit`, the fake Figma flow, `tasks.md` and `tracks.md` | Superseded by `/api/scan`; the old plans described a different product
- 2026-10-07 | AI failures degrade to static-only results with a visible note | A missing key or rate limit shouldn't hide real findings
- 2026-10-07 | Repos over 1,500 scannable files require choosing folders before scanning (`select` event) | Reading 30k+ files can't finish in one request; letting the user pick, then scan more later, keeps scans fast and the results complete for what was chosen
- 2026-10-07 | Tests, docs, examples, fixtures and benchmarks are skipped by default (opt-in via the folder picker); vendored/generated dirs always skipped | They inflate file counts and produce noisy false positives; opting in stays possible
