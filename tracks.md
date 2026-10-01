# Datum — Implementation Tracking (`tracks.md`)

This file tracks progress item-by-item across all 16 phases.
Rule 0: Work **one phase at a time**. Stop at the end of each phase, list what to verify by hand, and wait.

---

## Current Status: Phase 1 Complete — Awaiting Verification

### Phase 1 Tasks — Foundation and Design System
- [x] 1.1 Next.js 15 + TypeScript strict + Tailwind + ESLint + Prettier, pnpm. Folder structure from section 3
- [x] 1.2 `styles/tokens.ts` with all tokens for Night and Day, CSS variable generation, Tailwind theme mapped to variables, theme switching (system default, persisted)
- [x] 1.3 `next/font` Archivo (variable, width axis) and IBM Plex Mono; type scale utilities
- [x] 1.4 Build components 1 to 7 and 11 to 12 from 5.8 with all states:
  - [x] `Button` (primary = tide, secondary, ghost, destructive = peak), `IconButton`
  - [x] `Input`, `Select`, `Checkbox`, `Switch`, `SearchField`, `CodeInput` (mono)
  - [x] `Table` (dense, sortable, sticky header, keyboard row focus), `Pagination`
  - [x] `Tabs`, `Menu`, `Dialog`, `Tooltip`, `Toast`
  - [x] `Sheet` (panel with crop marks), `SheetHeader`
  - [x] `SeverityBadge` (color + text label + height value)
  - [x] `CodeSnippet` (highlighted line, line numbers, file path header)
  - [x] `EmptyState`, `ErrorState`, `Skeleton`
  - [x] `DiffStat` (+/- counts), `Kbd`, `CopyButton`
- [x] 1.5 `/styleguide` page showing tokens, type, spacing and every component in both themes
- [x] 1.6 ESLint/Stylelint bans from 5.11 configured and passing:
  - Ban arbitrary Tailwind values (`p-[13px]`, `bg-[#fff]`)
  - Ban hex/rgb/hsl literals outside `styles/tokens.ts`
  - Ban inline `style` colors or sizes (allowed in `lib/terrain/` only)
  - Proved with failing test component
- [x] 1.7 Supabase local dev (`supabase init`), `@supabase/ssr` clients in `lib/supabase/` (browser, server, admin)
- [x] 1.8 Vitest + Playwright set up, one test each:
  - Vitest: `tests/tokens.test.ts` (6 tests passing, WCAG AA contrast checked)
  - Playwright: `tests/e2e/styleguide.spec.ts` (passes, verifies styleguide render & theme toggle)
- [x] 1.9 Phase 1 verification:
  - `/styleguide` renders everything in Night and Day
  - Lint bans work (proven with failing example)
  - Typecheck (`tsc --noEmit`), lint (`next lint`, `stylelint`), build (`next build`), and tests pass clean

---

## Roadmap

- [x] **Phase 1** — Foundation and design system *(Complete)*
- [ ] **Phase 2** — Database and RLS
- [ ] **Phase 3** — Auth, app shell, API foundations
- [ ] **Phase 4** — GitHub App and connecting sites
- [ ] **Phase 5** — Benchmark extraction
- [ ] **Phase 6** — Detection engine
- [ ] **Phase 7** — Survey pipeline and jobs
- [ ] **Phase 8** — Terrain component
- [ ] **Phase 9** — Site pages
- [ ] **Phase 10** — Fixes
- [ ] **Phase 11** — PR guard
- [ ] **Phase 12** — Figma sync
- [ ] **Phase 13** — Public try and badge
- [ ] **Phase 14** — Billing and account
- [ ] **Phase 15** — Landing, docs, changelog, legal
- [ ] **Phase 16** — Hardening and dogfooding
