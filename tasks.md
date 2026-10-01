# Datum — build spec and tasks

> Datum surveys a codebase's UI layer against its design system, maps every place the code has drifted, and opens pull requests that fix it.
> This file is the complete spec: product, design world, data model, every API route, every page, and the phased task list. Build exactly what is written here.

---

## 0. Rules for the AI building this (read first)

1. Work **one phase at a time** (section 9). Stop at the end of each phase, list what to verify by hand, and wait.
2. The stack in section 3 is fixed. Do not swap or add libraries without asking.
3. TypeScript strict. No `any`. Validate every request body, query and env var with `zod`. Keep files small and named clearly.
4. After each task run typecheck, lint and tests. Do not tick a box until they pass.
5. Every route in section 7 and every page in section 8 must exist at exactly the specified path with the specified behavior. If you think a path or shape should change, ask first.
6. **Section 5 (The World) overrides your design defaults.** If a screen looks like a generic SaaS dashboard, it is wrong. Redo it.
7. If something is ambiguous, choose the simplest reading, record it in `DECISIONS.md` (one line: decision + why), and continue.
8. Never commit secrets. Use `.env.local`; keep `.env.example` complete.
9. Never call the repo's code from our servers. We only read and parse source files, we never execute them.

---

## 1. Product

**What it is.** A GitHub App plus a web dashboard. It reads a repo's frontend code, compares every color, spacing, radius, type and shadow value and every repeated component against the design system (Tailwind theme, CSS variables, optionally Figma), reports each mismatch, scores the repo, and opens a PR that fixes the safe ones. It also comments on new PRs so drift stops piling up.

**Who it's for.** Frontend teams using React/Next.js/Tailwind, agencies juggling many client codebases, and solo devs whose AI-generated code keeps inventing new paddings and hex codes. AI-written UI drifts fast; that is the sharpest pitch.

**Core idea in one line.** The design system is the datum (the zero point). Anything that sits off it is drift.

### Vocabulary (use these words everywhere: code, UI, docs, errors)

| Term | Meaning | Never call it |
|---|---|---|
| **Site** | A connected GitHub repo | project, repo (in UI copy) |
| **Survey** | One analysis run of a site at a commit | scan, analysis, run |
| **Benchmark** | A canonical design value (a token) | token, variable (in UI copy) |
| **Deviation** | One place the code is off a benchmark | issue, finding, violation |
| **Drift score** | 0 to 100 for a site or file. **0 = sits exactly on the datum, 100 = maximum drift. Lower is better.** | health score, grade |
| **Fix** | A PR Datum opens that resolves deviations | autofix PR |

(Code identifiers may say `repo`, `token`, `scan` only where GitHub or a library forces it. Database and API use the vocabulary above.)

### Main user journeys

1. **Try it.** Visitor pastes a public GitHub URL on `/try`, gets a survey result with the terrain map. No login.
2. **Connect.** User logs in with GitHub, installs the GitHub App, picks repos. First survey runs automatically.
3. **Review.** User opens a site, sees the terrain chart, filters deviations, inspects one, ignores false positives.
4. **Fix.** User clicks "Open fix PR". Datum pushes a branch, opens a PR. After merge, the next survey shows the drift gone and the terrain floods.
5. **Guard.** Every new pull request gets a check run and a comment listing only the drift it introduces.
6. **Sync with Figma.** User connects a Figma file, Datum lists where Figma values and code benchmarks disagree.

---

## 2. Scope

**MVP includes:** everything in sections 5 to 9.
**Not in MVP:** Vue/Svelte/Angular, native mobile code, IDE plugin, CLI, auto-merge, multi-org admin roles, SSO, Slack reports, Storybook screenshot diffing.

---

## 3. Stack, structure, environment

| Layer | Choice |
|---|---|
| Framework | Next.js 15 App Router, React, TypeScript strict |
| Styling | Tailwind CSS mapped to CSS variables from `styles/tokens.ts`; no component library look-alikes; `@radix-ui/react-*` primitives for behavior only |
| Database | Supabase Postgres, SQL migrations via Supabase CLI, generated types, RLS on every table |
| Auth | Supabase Auth, GitHub provider |
| Realtime | Supabase Realtime (survey progress) |
| Storage | Supabase Storage bucket `reports` (full survey JSON) |
| GitHub | GitHub App, `octokit` + `@octokit/webhooks` + `@octokit/auth-app` |
| Code analysis | `ts-morph` (TSX/JSX), `postcss` + `postcss-value-parser` (CSS/SCSS), `culori` (color math, OKLab), a Tailwind config resolver (`tailwindcss/resolveConfig` + jiti) |
| Map rendering | `d3-contour`, `d3-hierarchy`, `d3-zoom`, `d3-scale`, `d3-interpolate`. SVG (canvas fallback above 800 files) |
| Jobs | Inngest |
| Payments | Stripe (Checkout + Customer Portal) |
| Validation | zod |
| Tests | Vitest (unit), Playwright (e2e + screenshots) |
| Hosting | Vercel |
| Monitoring | Sentry |

### Folder structure

```
app/
  (marketing)/           page.tsx  try/  pricing/  docs/[[...slug]]/  changelog/  legal/privacy/  legal/terms/
  (auth)/login/
  (app)/app/             page.tsx (atlas)  connect/  account/  billing/
                         sites/[siteId]/  layout.tsx  page.tsx (chart)  deviations/  deviations/[deviationId]/
                                          benchmarks/  surveys/  surveys/[surveyId]/  components/  fixes/  figma/  settings/
  auth/callback/route.ts
  api/                   (all routes from section 7)
  badge/[owner]/[repo]/route.ts
  styleguide/            (dev + preview only, noindex)
components/
  ui/                    primitives (Button, Input, Table, Sheet, Dialog, ...)
  terrain/               Terrain, TerrainLegend, ScaleBar, TimeScrubber
  app/                   feature components (DeviationRow, ValueCompare, SiteHeader, ...)
  marketing/
lib/
  supabase/  github/  detect/  benchmarks/  fix/  terrain/  score/  billing/  figma/  api/ (error + auth helpers)
jobs/                    inngest functions
styles/tokens.ts
supabase/migrations/  supabase/seed.sql
tests/fixtures/          small fake repos used by detection tests
content/docs/            MDX docs
DECISIONS.md
```

### Environment variables (`.env.example` must list all)

```
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server only
GITHUB_APP_ID=
GITHUB_APP_SLUG=
GITHUB_APP_PRIVATE_KEY=             # base64
GITHUB_WEBHOOK_SECRET=
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO=
STRIPE_PRICE_TEAM=
FIGMA_ENCRYPTION_KEY=               # 32-byte key for encrypting stored Figma tokens
SENTRY_DSN=
```

---

## 4. Core concepts (how the engine thinks)

- **Benchmark categories:** `color`, `spacing`, `radius`, `font_size`, `font_weight`, `font_family`, `shadow`.
- **Canonical form:** colors are stored as hex `#rrggbb` plus OKLab; lengths as px numbers (rem x 16); shadows as normalized strings.
- **Nearest benchmark:** colors by OKLab distance (delta E x 100); lengths by absolute px difference.
- **Confidence (0 to 1):** colors `1 - (dE / 6)`, clamped; lengths `1 - (|px diff| / 4)`, clamped. A deviation is autofixable when confidence is at least 0.9 **and** the rule allows autofix.
- **Fingerprint:** `sha1(rule_id + file_path + found_value + 3 lines of normalized context)`. Used to track the same deviation across surveys and to store ignores.
- **Inferred benchmarks:** if a repo has no detectable design system, take the most frequent values per category (used at least 5 times), mark them `source = inferred`, and show a banner explaining it.

---

## 5. The World (design direction)

This section overrides any default design instinct. Datum must feel like **a place you go into**, not a dashboard you open.

### 5.1 Concept: The Survey

In surveying, the **datum** is the reference level all heights are measured from, usually sea level. Datum's whole interface is built on that.

- A healthy UI is **calm, flat sea**.
- Every deviation is **land rising out of the water**. The more drift, the higher and hotter the terrain.
- Your codebase is a **territory**. Directories are regions. Files are points on the map. You are the surveyor.
- **Surveying a site** draws its contour map. **Fixing** drift makes the **water rise** and flood the land back to sea level.

The recurring visual is the **terrain map**: contour lines, stepped elevation bands, spot heights. It appears on the landing hero, the site chart, the atlas thumbnails, survey reports, the public `/try` result, and the README badge. The rest of the UI is deliberately quiet so the map is the star.

### 5.2 How the world shows up

- Every primary screen has a map or a map-derived element. No screen is only a table.
- Panels are **sheets**: 1px border and small corner crop marks (like a map sheet or print registration marks). Use sheets for top-level panels only, never nested.
- Small instrument details: a coordinate readout (`x 312 · y 88`) and a scale bar on maps, survey IDs shown as `Survey 0047`, heights written as `+7` or `+12 px`. These are functional, not decoration. If it doesn't read real data, remove it.
- Map labels (region names on the terrain) are the **only** place condensed uppercase text with letter-spacing is allowed.
- World language (sea, land, flood, survey) lives in: the landing page, empty states, survey-complete moments and fix-merged moments. Everywhere else copy is plain and exact (section 5.9).

### 5.3 Tokens (single source: `styles/tokens.ts` → CSS variables → Tailwind theme)

Nothing else in the codebase may define a color, size or radius. Night is the default theme; Day is supported. Every token exists in both.

| Token | Night | Day | Use |
|---|---|---|---|
| `bg` | `#06141F` | `#F1F7F5` | page background |
| `surface` | `#0A2233` | `#FFFFFF` | sheets, inputs |
| `raised` | `#10344D` | `#E3EEEB` | hover rows, menus |
| `line` | `#1D4A68` | `#C3D6D3` | borders, rules, contour lines |
| `text` | `#E6F2EE` | `#0A2233` | primary text |
| `muted` | `#8FB0BF` | `#486979` | secondary text |
| `sea` | `#0B3048` | `#CFE6E6` | flat water on maps (zero drift) |
| `tide` | `#37C2C9` | `#0B7A85` | benchmarks, primary actions, links, focus ring, healthy state |
| `sand` | `#E8D5A1` | `#C9A227` | low drift (score 5 to 20), severity low |
| `ochre` | `#E3A13F` | `#C77C0E` | medium drift (20 to 40), severity medium |
| `rust` | `#D9582B` | `#BF4317` | high drift (40 to 65), severity high |
| `peak` | `#F0475A` | `#96111F` | extreme drift (65+), destructive actions, errors |

Rules:
- No other colors. No gradients anywhere. Elevation on maps is shown as **stepped bands** between contour lines, never a smooth blend.
- Semantics are fixed: **tide = canonical/healthy/interactive**, **sand→peak = drift**. Never use the land colors for anything else.
- Never use color alone to convey status; always pair with text or a height value.
- Verify WCAG AA contrast for every text/background pairing in both themes (add a test).

### 5.4 Typography

- One family: **Archivo** (variable, via `next/font`), using its width axis as the system:
  - Display and headings: width 125 (expanded), weight 700 to 800.
  - Body and UI: width 100, weights 400 and 500.
  - Map labels only: width 75 (condensed), weight 600, uppercase, tracking `0.08em`.
- Code, values, paths, coordinates: **IBM Plex Mono**, only for real data.
- Scale (px / line-height): `12/16`, `14/20`, `16/24`, `20/28`, `28/34`, `44/48`, `72/72`. Nothing outside it. `72` is for the landing hero only.
- Sentence case. Max body line length 75 characters. No highlighted-word tricks in headlines.

### 5.5 Space, shape, layout

- 4px base unit. Scale: `4, 8, 12, 16, 24, 32, 48, 64, 96, 128`. No arbitrary values.
- Radius: `0` for sheets, tables, map, layout. `3px` for controls only. No pills except status dots.
- Shadow: none, except one `overlay` shadow on menus and dialogs.
- Structure comes from rules, alignment and whitespace. No grids of identical cards.
- Left-aligned by default. Centered only for empty states and the `/try` input.
- App shell: left rail (Datum mark, atlas link, site switcher, account), main area with a site header and tab bar (Chart, Deviations, Benchmarks, Surveys, Components, Fixes, Figma, Settings). The rail collapses to icons under 1024px and becomes a bottom bar under 640px.

### 5.6 The Terrain component (the signature piece)

`components/terrain/Terrain.tsx`. Used in many places, so build it once, well, in Phase 8.

**Input:** `files: { path: string; drift: number /*0-100*/ }[]`, optional `previousFiles` for flood animation, `mode: 'hero' | 'chart' | 'thumb' | 'badge'`.

**Algorithm (pure functions in `lib/terrain/`, unit tested):**
1. Build a hierarchy from file paths (directories → files). Use `d3-hierarchy` squarified `treemap` to lay out rectangles in a 1000 x 640 space. A file's area is proportional to `max(lines, 20)`. Directory rectangles are regions.
2. Each file becomes a point at its rectangle's centroid.
3. Create a 160 x 100 height grid. For each file add a Gaussian bump at its centroid with amplitude `drift` and radius `0.6 * sqrt(rectArea)`. Sum bumps, clamp at 100.
4. Generate contours with `d3-contour` at every 5 units from 5 to 100.
5. Fill: below 5 is `sea`. Bands 5 to 20 `sand`, 20 to 40 `ochre`, 40 to 65 `rust`, 65+ `peak`. Stepped fills, no blending.
6. Draw contour lines in `line` at 1px. Every fifth line (25, 50, 75, 100) is an **index contour**: 1.5px, with a spot-height label in Plex Mono 12px (`+25`).
7. Region names drawn as condensed uppercase map labels at directory centroids, only for directories large enough to fit the label.

**Interaction (`chart` mode):** pan (drag), zoom (wheel, pinch, +/- buttons, keyboard `+ - 0` and arrow keys), hover shows a tooltip (path, drift score, top rule hit), click on a file selects it and filters the deviations tab via query string `?file=`. Coordinate readout updates on pointer move. Scale bar shows "1 contour = 5 drift". Legend lists the four bands. All of it is keyboard reachable, and the tooltip content is available via an accessible file list (`<ul>` visually hidden).

**Modes:**
- `hero`: no controls, slow ambient drift of the height field (60s loop, amplitude ±3), low contrast labels.
- `chart`: full interaction.
- `thumb`: 160 x 100, static, no labels (used in the atlas rows).
- `badge`: server-rendered static SVG, no labels (README badge).

**Flood animation:** when `previousFiles` is given, animate heights from previous to current over 1200ms (easing `cubic-bezier(0.22, 1, 0.36, 1)`), recomputing contours per frame at reduced grid resolution (80 x 50), then snap to full resolution. Play once when a survey finishes and current drift is lower than previous. With `prefers-reduced-motion`, render the final state instantly.

**Performance:** up to 800 files in SVG. Above that, aggregate files per directory before building the field, and render on canvas. Must stay above 50fps pan/zoom on a mid laptop.

**Empty state (zero drift):** a perfectly flat `sea` with the single line "Sea level. Nothing has drifted." and the benchmark count.

### 5.7 Motion

- Motion only responds to user action or to one of three signature moments: **contour draw-in** when a map first loads (contours draw outward from the highest point, 800ms, staggered), **flood** (above), and the **landing scroll sequence** (section 8, M1).
- Durations: `120ms` small state changes, `240ms` panels and dialogs, `800ms` and `1200ms` signature only. One easing curve for UI (`cubic-bezier(0.2, 0, 0, 1)`).
- No scroll fade-ins, no hover transitions on whole rows, no animated gradients, no parallax.
- Respect `prefers-reduced-motion` everywhere.

### 5.8 Components to build (all shown in `/styleguide` in every state: default, hover, focus, active, disabled, loading, error, both themes)

1. `Button` (primary = tide, secondary, ghost, destructive = peak), `IconButton`
2. `Input`, `Select`, `Checkbox`, `Switch`, `SearchField`, `CodeInput` (mono)
3. `Table` (dense, sortable, sticky header, keyboard row focus), `Pagination`
4. `Tabs`, `Menu`, `Dialog`, `Tooltip`, `Toast`
5. `Sheet` (panel with crop marks), `SheetHeader`
6. `SeverityBadge` (color + text label + height value)
7. `CodeSnippet` (highlighted line, line numbers, file path header)
8. `ValueCompare` (found vs benchmark side by side with the measured delta; swatches for colors, ruler bars for lengths)
9. `Terrain`, `TerrainLegend`, `ScaleBar`, `TimeScrubber` (steps through past surveys and plays the flood between them)
10. `DriftGauge` (horizontal bar on a sea-level line showing the score; the bar rises out of the line in drift colors)
11. `EmptyState`, `ErrorState`, `Skeleton` (skeletons shaped like the final layout; map skeleton is a flat sea with contours drawing in)
12. `DiffStat` (+/- counts), `Kbd`, `CopyButton`

Icons: Lucide only, stroke 1.5, sizes 16 and 20.

### 5.9 Copy and voice

- Plain verbs, sentence case, exact. Buttons say what they do: "Survey now", "Open fix PR", "Ignore deviation", "Connect repository".
- One verb per action across the whole flow (the button says "Open fix PR", the toast says "Fix PR opened", the row says "Fix PR open").
- Errors: what happened + what to do. No apologies, no jokes. Example: "GitHub rejected the request. Reinstall the app to reconnect."
- World language only in the places listed in 5.2.
- No emojis, no exclamation marks, no "supercharge / seamless / unlock / revolutionize / effortless".

**Copy deck (use verbatim):**

| Where | String |
|---|---|
| Landing hero h1 | Your UI has drifted. |
| Landing hero sub | Datum surveys your code against your design system, maps every place it wandered, and fixes it. |
| Landing CTAs | Survey a repository · Install on GitHub |
| Empty atlas | No sites yet. Connect a repository and Datum will draw its first map. |
| Survey queued | Survey queued. |
| Survey running | Surveying 214 files. |
| Survey done (drift > 0) | Survey 0047 complete. Drift score 34. |
| Survey done (drift = 0) | Sea level. Nothing has drifted. |
| Fix PR opened toast | Fix PR opened. |
| Fix merged banner | Fix merged. Drift score fell from 34 to 6. |
| No deviations (filtered) | No deviations match these filters. |
| No benchmarks found | No design system found. Datum inferred benchmarks from your most-used values. |
| Survey failed | Survey failed: {reason}. Try again or check the GitHub connection. |
| Ignore confirm | Ignore this deviation? Datum will stop reporting it on this site. |
| Plan limit | Your plan includes {n} site(s). Upgrade to connect more. |

### 5.10 Never do this

Gradients of any kind, gradient text, glow, glassmorphism, blurred blobs · grids of identical rounded cards with icon + title + line · one radius and one soft shadow on everything · all-caps tracked eyebrow labels outside map labels · `01 / 02 / 03` numbering on non-sequential content · an arrow on every button · big-number-small-label heroes · cream + serif + terracotta look · near-black with a single acid accent · Inter, Roboto, system fonts, Space Grotesk · emoji as icons · lorem ipsum or fake testimonials · everything centered · decorative instruments that don't read real data.

### 5.11 Design-system enforcement (Datum must pass its own survey)

- [ ] ESLint bans arbitrary Tailwind values (`p-[13px]`, `bg-[#fff]`), hex/rgb/hsl literals outside `styles/tokens.ts`, and inline `style` colors or sizes (map SVG attributes are computed from tokens, allowed in `lib/terrain/` only).
- [ ] Stylelint for raw CSS with the same rules.
- [ ] CI runs Datum on this repo with a threshold of **0 deviations**.
- [ ] Playwright screenshots of `/styleguide` in Night and Day run in CI.
- [ ] Quality floor: visible 2px `tide` focus ring with 2px offset; full keyboard support for tables, menus, dialogs and the map; responsive down to 360px (tables become stacked rows under 640px); skeletons not spinners.

---

## 6. Data model (Supabase)

All tables: `id uuid primary key default gen_random_uuid()` unless noted, `created_at timestamptz default now()`. SQL lives in `supabase/migrations/`. Generate types and commit them. `SUPABASE_SERVICE_ROLE_KEY` is used **only** in server code (webhooks, jobs, API routes that must bypass RLS), never sent to the client.

| Table | Columns |
|---|---|
| `profiles` | `id` (= auth.users.id), `github_login`, `avatar_url`, `plan` (`free`/`pro`/`team`, default `free`), `stripe_customer_id` |
| `installations` | `id bigint` (GitHub installation id), `account_login`, `account_type`, `suspended_at`, `plan_owner_id` → profiles |
| `installation_members` | `installation_id`, `user_id`, `role` (`owner`/`member`). Basis of RLS |
| `sites` | `installation_id`, `github_repo_id bigint unique`, `full_name`, `default_branch`, `framework` (`next`/`react`/`unknown`), `status` (`pending`/`active`/`paused`), `drift_score int null`, `last_survey_id null`, `config jsonb default '{}'` |
| `surveys` | `site_id null` (null for public surveys), `public_repo text null`, `seq int` (per-site counter, shown as `Survey 0047`), `commit_sha`, `branch`, `trigger` (`install`/`push`/`pull_request`/`manual`/`public`), `pr_number null`, `status` (`queued`/`running`/`done`/`failed`), `progress int 0-100`, `drift_score int null`, `file_count`, `deviation_count`, `error null`, `report_path null`, `started_at`, `finished_at` |
| `survey_files` | `survey_id`, `path`, `lines int`, `drift int`. One row per UI file. Feeds the terrain |
| `benchmarks` | `site_id`, `category`, `name`, `value_raw`, `value_canonical`, `source` (`tailwind`/`css`/`figma`/`inferred`/`custom`), `source_ref`. Unique `(site_id, category, name)` |
| `deviations` | `survey_id`, `site_id null`, `rule_id`, `category`, `severity` (`low`/`medium`/`high`), `file_path`, `line`, `col`, `end_line`, `end_col`, `found_value`, `suggested_benchmark_id null`, `suggested_value null`, `delta numeric null` (px or dE), `confidence real`, `autofixable bool`, `snippet text`, `fingerprint text`, `status` (`open`/`ignored`/`fixed`) |
| `deviation_ignores` | `site_id`, `fingerprint`, `reason null`, `user_id`. Unique `(site_id, fingerprint)` |
| `fixes` | `site_id`, `survey_id`, `branch`, `pr_number null`, `pr_url null`, `status` (`creating`/`open`/`merged`/`closed`/`failed`), `deviation_count`, `file_count`, `error null`, `created_by`, `merged_at null` |
| `figma_connections` | `site_id primary key`, `file_key`, `token_encrypted`, `last_synced_at null` |
| `figma_mismatches` | `site_id`, `benchmark_id null`, `category`, `figma_name`, `figma_value`, `code_value null`, `kind` (`value_differs`/`missing_in_code`/`missing_in_figma`), `synced_at` |
| `subscriptions` | `user_id`, `stripe_subscription_id`, `plan`, `status`, `seats int`, `current_period_end` |
| `rate_limits` | `key text primary key`, `count int`, `window_start timestamptz` (public survey limiter) |

**Indexes:** `deviations(survey_id, status)`, `deviations(site_id, fingerprint)`, `surveys(site_id, seq desc)`, `survey_files(survey_id)`, `benchmarks(site_id, category)`.
**RLS:** a user can read/write rows for sites whose `installation_id` appears in `installation_members` for that user. `surveys`/`deviations`/`survey_files` with `site_id is null` (public surveys) are readable by anyone who knows the survey id via a server route only (no direct client access). Write a test proving user A cannot read user B's rows.
**Realtime:** enable on `surveys` (status, progress) for members.
**Seed:** `supabase/seed.sql` inserts two sites, three surveys each with 60 to 120 deviations across all categories and realistic file paths, so every page can be developed without GitHub.

---

## 7. Backend

### 7.1 Conventions

- Route handlers in `app/api/**/route.ts`. Each one: parse auth → validate with zod → authorize (membership check) → do work → return JSON.
- Auth helper `requireUser()` (reads Supabase session) and `requireSiteAccess(siteId, user)`. Webhook routes use signature verification instead.
- Error shape for all non-2xx: `{ "error": { "code": "string_snake_case", "message": "Human sentence." } }`. Codes: `unauthenticated` 401, `forbidden` 403, `not_found` 404, `invalid_input` 422, `plan_limit` 402, `rate_limited` 429, `upstream_failed` 502, `internal` 500.
- Pagination: `?page=1&pageSize=50` (max 200), response `{ items, page, pageSize, total }`.
- All timestamps ISO 8601 UTC.
- Rate limits: public survey 3 per IP per hour; other authenticated routes 120 per minute per user.

### 7.2 Route list

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/auth/callback` | none | Exchange Supabase OAuth code, create `profiles` row, redirect to `/app` |
| POST | `/api/auth/logout` | user | Clear session |
| GET | `/api/github/install` | user | Redirect to the GitHub App install URL with signed `state` |
| GET | `/api/github/setup` | user | Post-install callback: verify `state`, link installation to user, sync repos, redirect to `/app/connect?installed=1` |
| POST | `/api/github/webhook` | signature | Receive GitHub events (7.4) |
| GET | `/api/installations` | user | Installations the user belongs to, with repos available to connect |
| GET | `/api/sites` | user | Sites the user can access (id, full_name, drift_score, last survey summary, trend of last 12 scores, thumb file list) |
| POST | `/api/sites` | user | Connect repos: body `{ installationId, repoIds: number[] }`. Checks plan limit, creates sites, queues first surveys |
| GET | `/api/sites/:siteId` | user | One site with latest survey summary |
| PATCH | `/api/sites/:siteId` | user | Update `status` (pause/resume) and `config` |
| DELETE | `/api/sites/:siteId` | user | Disconnect site and delete its data |
| POST | `/api/sites/:siteId/surveys` | user | Start a manual survey |
| GET | `/api/sites/:siteId/surveys` | user | Paginated survey history |
| GET | `/api/surveys/:surveyId` | user | One survey (status, progress, score, counts, per-category counts) |
| GET | `/api/surveys/:surveyId/terrain` | user | `survey_files` for the map + directory tree |
| GET | `/api/surveys/:surveyId/deviations` | user | Paginated deviations with filters (7.3) |
| GET | `/api/surveys/:surveyId/diff` | user | Compare to previous survey: new, fixed, unchanged counts and lists |
| GET | `/api/deviations/:deviationId` | user | One deviation with code context (±8 lines), suggestion and related deviations (same fingerprint in other surveys) |
| POST | `/api/deviations/:deviationId/ignore` | user | Add ignore by fingerprint (`{ reason? }`) |
| DELETE | `/api/deviations/:deviationId/ignore` | user | Remove the ignore |
| GET | `/api/sites/:siteId/benchmarks` | user | List benchmarks, filter by `category` |
| POST | `/api/sites/:siteId/benchmarks` | user | Add a custom benchmark |
| PATCH | `/api/benchmarks/:benchmarkId` | user | Edit a custom benchmark |
| DELETE | `/api/benchmarks/:benchmarkId` | user | Delete a custom benchmark |
| GET | `/api/sites/:siteId/components` | user | Duplicate component groups from the latest survey |
| POST | `/api/sites/:siteId/fixes` | user | Create a fix PR (7.3) |
| GET | `/api/sites/:siteId/fixes` | user | List fixes |
| GET | `/api/fixes/:fixId` | user | One fix with status |
| PUT | `/api/sites/:siteId/figma` | user | Connect Figma: `{ fileKey, token }` (token validated then stored encrypted) |
| DELETE | `/api/sites/:siteId/figma` | user | Disconnect |
| POST | `/api/sites/:siteId/figma/sync` | user | Queue a Figma sync |
| GET | `/api/sites/:siteId/figma/mismatches` | user | List mismatches |
| POST | `/api/public/survey` | none | Start a public survey for `{ repoUrl }` (public GitHub repos only) |
| GET | `/api/public/survey/:surveyId` | none | Status, score and terrain for a public survey (no code snippets beyond line + value) |
| GET | `/badge/:owner/:repo` | none | SVG badge (`.svg`) with the drift score and a mini terrain, cached 1h. Only for connected sites that enabled the badge in settings |
| POST | `/api/billing/checkout` | user | Create a Stripe Checkout session `{ plan, seats }` → `{ url }` |
| POST | `/api/billing/portal` | user | Create a Customer Portal session → `{ url }` |
| POST | `/api/stripe/webhook` | signature | Sync subscriptions and plan |
| ALL | `/api/inngest` | signing key | Inngest serve endpoint |
| GET | `/api/health` | none | `{ ok: true, version }` |

### 7.3 Key route details

**`POST /api/sites`**
```json
// request
{ "installationId": 123456, "repoIds": [998877, 998878] }
// 201
{ "items": [ { "id": "uuid", "fullName": "acme/web", "status": "pending", "surveyId": "uuid" } ] }
// 402 plan_limit when free plan would exceed 1 site
```

**`POST /api/sites/:siteId/surveys`** → `202 { "surveyId": "uuid", "seq": 47 }`. 409 `conflict` if a survey for the same commit is already queued or running (idempotent: return the existing id with 200).

**`GET /api/surveys/:surveyId/deviations`** query: `category`, `severity`, `rule`, `status` (default `open`), `file` (prefix match), `q` (search in path or found value), `autofixable` (`true`/`false`), `sort` (`severity`,`file`,`delta`,`confidence`; prefix `-` for desc), `page`, `pageSize`.
```json
{ "items": [ {
  "id": "uuid", "ruleId": "spacing/arbitrary", "category": "spacing", "severity": "medium",
  "filePath": "components/Card.tsx", "line": 42, "col": 18,
  "foundValue": "p-[13px]", "suggestedValue": "p-3", "delta": 1, "confidence": 0.75,
  "autofixable": true, "status": "open"
} ], "page": 1, "pageSize": 50, "total": 312,
  "facets": { "category": { "color": 120, "spacing": 98 }, "severity": { "low": 90, "medium": 160, "high": 62 } } }
```

**`GET /api/surveys/:surveyId/terrain`**
```json
{ "files": [ { "path": "components/Card.tsx", "lines": 88, "drift": 41 } ], "driftScore": 34, "surveySeq": 47 }
```

**`POST /api/sites/:siteId/fixes`**
```json
// request: either explicit ids or a mode
{ "surveyId": "uuid", "deviationIds": ["uuid"], "mode": "all_safe" }
// 202
{ "fixId": "uuid", "status": "creating" }
// 422 invalid_input when nothing autofixable is selected; 402 plan_limit on Free plan
```

**`POST /api/public/survey`** body `{ "repoUrl": "https://github.com/vercel/next.js" }` → `202 { "surveyId": "uuid" }`. Validate host is github.com, repo exists and is public, repo size under 200 MB and under 2,000 UI files (else 422 with a clear message). Cache results per `(repo, commit)` for 24h.

### 7.4 GitHub webhook handling (`POST /api/github/webhook`)

Verify `X-Hub-Signature-256` with `GITHUB_WEBHOOK_SECRET`. Respond 200 fast; do work in Inngest.

| Event + action | Behavior |
|---|---|
| `installation.created` | Upsert `installations`. Wait for user setup callback to link members |
| `installation.deleted` | Mark sites `paused`, set installation `suspended_at` |
| `installation.suspend` / `unsuspend` | Set/clear `suspended_at`, pause/resume sites |
| `installation_repositories.added` | Make repos available in `/api/installations` |
| `installation_repositories.removed` | Pause the corresponding sites |
| `push` (default branch only) | If site is `active`, send `survey/run` with trigger `push` |
| `pull_request.opened` / `synchronize` / `reopened` | Send `survey/pr` |
| `pull_request.closed` (merged) on a Datum fix branch (`datum/fix-*`) | Mark the fix `merged`, send `survey/run` |
| `check_run.rerequested` | Re-send `survey/pr` |

### 7.5 Background jobs (Inngest, `jobs/`)

| Function | Trigger | Does |
|---|---|---|
| `survey.run` | event `survey/run` | Full pipeline (7.6) |
| `survey.pr` | event `survey/pr` | Pipeline on the PR head, diffed against the base survey, then check run + comment (7.9) |
| `fix.create` | event `fix/create` | Fix generation (7.8) |
| `figma.sync` | event `figma/sync` | Pull Figma variables/styles, upsert benchmarks with `source='figma'`, compute mismatches |
| `public.cleanup` | cron daily | Delete public surveys older than 7 days and expired rate-limit rows |

All jobs: concurrency limit per site of 1, retries 2 with backoff, timeout 10 minutes, write errors to `surveys.error` / `fixes.error`.

### 7.6 Survey pipeline (`survey.run`)

1. Set status `running`, progress 0. Resolve commit SHA of the target branch.
2. Idempotency: if a `done` survey exists for this site and SHA, reuse it and exit.
3. Download the tarball through the GitHub API into memory/temp dir (limit 200 MB). Progress 10.
4. List UI files: `.tsx .jsx .ts .js .css .scss .mdx`, skipping `node_modules`, `.next`, `dist`, `build`, `coverage`, `*.test.*`, `*.stories.*`, generated files, and paths from `config.ignore`. Cap at 2,000 files (rank by size desc to keep the rest if over).
5. Extract benchmarks (7.7). If none, infer. Save to `benchmarks`. Progress 30.
6. Run every rule (7.10) over every file. Progress scales 30 to 85.
7. Compute fingerprints; mark deviations whose fingerprint is in `deviation_ignores` as `ignored`.
8. Compute per-file and site drift scores (7.11). Write `survey_files`, `deviations`, upload full JSON to Storage `reports/{surveyId}.json`. Progress 95.
9. Update survey (`done`, score, counts, `finished_at`), update `sites.drift_score` and `last_survey_id`. Emit Realtime via table update. Progress 100.
10. On any thrown error: status `failed`, store a readable message, never leave a survey `running`.

### 7.7 Benchmark extraction

- **Tailwind:** find `tailwind.config.{js,ts,mjs,cjs}`; resolve `theme` + `theme.extend` (colors, spacing, borderRadius, fontSize, fontWeight, fontFamily, boxShadow). Flatten nested colors (`brand.500`).
- **Tailwind v4 / CSS:** parse `@theme` blocks and `:root` / `.dark` custom properties in global CSS files.
- **Figma:** added later by `figma.sync`, `source='figma'`.
- **Custom:** user-added benchmarks via the API.
- Normalize values to canonical form (section 4). Dedupe by `(category, value_canonical)` keeping the first name.
- If the repo uses no design system, run inference (section 4) and flag the survey with `inferred: true`.

### 7.8 Fix generation (`fix.create`)

1. Load selected deviations (`autofixable` and confidence ≥ 0.9, or explicit ids that meet this). Reject others with a reason list in the PR body.
2. Fetch the files at the survey's commit SHA.
3. Apply edits with `ts-morph` / PostCSS positions (never string replace): Tailwind arbitrary class → scale class, hardcoded color literal → Tailwind color class or `var(--name)` depending on where it appears, inline style number → left as manual (not autofixable).
4. Re-parse every changed file to ensure it is still syntactically valid. Re-run the rules on changed files; the fix must reduce the deviation count for the selected ones and introduce none. If it fails, drop that file from the fix and list it as manual.
5. Create a branch `datum/fix-{yyyymmdd}-{shortid}` from the commit SHA using the Git Data API (blobs → tree → one commit → ref). Commit message: `fix: align {n} values with design benchmarks (Datum)`.
6. Open the PR against the default branch, body from template below, label `datum`. Store `pr_number`, `pr_url`, status `open`.
7. Limits: max 200 changed files and 1,000 edits per PR; over that, split by top-level directory into multiple PRs.
8. We do not install or build the repo. The PR body tells the reviewer to rely on their CI.

**Fix PR body template**
```
## Datum fix

This PR aligns {n} values in {f} files with your design benchmarks.

| Category | Changes |
|---|---|
| color | 12 |
| spacing | 9 |

Drift score after this fix: {before} → {after} (estimated).

### Not included
{m} deviations need a human decision (listed in Datum: {site_url}/deviations).

Every change replaces a value with its nearest benchmark (confidence ≥ 90%). Review visually before merging.
```

### 7.9 PR check run and comment (`survey.pr`)

1. Survey the PR head. Load the latest `done` survey of the base branch as the baseline.
2. New deviations = head deviations whose fingerprints are not in the baseline.
3. Create a GitHub **Check Run** `Datum`. Conclusion `success` if no new deviations or drift delta ≤ site `config.threshold` (default 0 new high-severity); otherwise `failure`. Annotate up to 50 deviations on the changed lines.
4. Post or update one PR comment (identified by a hidden marker `<!-- datum-pr-comment -->`):
```
**Datum:** this PR adds {n} deviations (drift {base} → {head}).

| File | Line | Found | Use instead |
|---|---|---|---|
| components/Card.tsx | 42 | `p-[13px]` | `p-3` |

[Open in Datum]({url})
```
5. If there are none: comment `This PR stays on the datum.` (only when the site enabled "always comment").

### 7.10 Rule catalog (`lib/detect/rules/`, one file per rule, each with fixtures and tests)

| Rule id | Category | Detects | Example found → suggestion | Autofix | Severity |
|---|---|---|---|---|---|
| `color/literal-near` | color | Hex/rgb/hsl literal within dE < 6 of a benchmark but not equal | `#3b82f7` → `brand.500` | yes if dE < 2.5 | low |
| `color/literal-far` | color | Color literal with no benchmark within dE 6 | `#ff5533` | no | high |
| `color/literal-exact` | color | Literal equal to a benchmark but hardcoded | `#3b82f6` → `bg-brand-500` | yes | low |
| `color/arbitrary-class` | color | Tailwind arbitrary color class | `bg-[#ff5533]` | yes if near, else no | medium |
| `spacing/arbitrary-class` | spacing | Arbitrary spacing class (`p-`,`m-`,`gap-`,`space-`,`w-`,`h-` with `[..px]`) | `p-[13px]` → `p-3` | yes if diff ≤ 2px | medium |
| `spacing/inline-style` | spacing | Inline style padding/margin/gap numbers off the scale | `style={{ padding: 13 }}` | no | medium |
| `radius/off-scale` | radius | Arbitrary or inline radius not in benchmarks | `rounded-[7px]` → `rounded-md` | yes if diff ≤ 2px | low |
| `type/size-off-scale` | font_size | Arbitrary font size | `text-[15px]` → `text-sm` | yes if diff ≤ 1px | medium |
| `type/family` | font_family | Font family not in benchmarks | `font-['Comic Sans']` | no | medium |
| `shadow/custom` | shadow | Custom shadow not in benchmarks | `shadow-[0_2px_8px_rgba(0,0,0,.2)]` | no | low |
| `component/duplicate` | component | 3+ components with ≥ 85% structural similarity (AST shape hash with literals normalized) | `Button`, `PrimaryButton`, `CtaButton` | no | high |
| `state/missing` | state | Interactive element (`button`, `a`, `input`, `[role=button]`) without `hover:`/`focus-visible:`/`disabled:` while sibling instances of the same component have them | | no | medium |

Each rule exports `{ id, category, run(file, ctx): Deviation[] }`. `ctx` includes benchmarks and helpers. Rules must be deterministic, handle `cn()`/`clsx()`/template literals for class strings, and never crash on unparsable files (skip and record in the survey report).

### 7.11 Scoring

- Severity weight: low 1, medium 3, high 6. Category weight: color 1.0, spacing 0.8, radius 0.6, font_size 0.8, font_family 0.8, shadow 0.5, component 1.5, state 1.2.
- `w(d) = severityWeight × categoryWeight`. Ignored and fixed deviations count 0.
- File drift: `round(100 × (1 − e^(−Σw_file / 6)))`.
- Site drift: `density = Σw_all / max(1, uiFileCount)`, `drift = round(100 × (1 − e^(−density / 3)))`.
- Band names for UI: 0 sea level, 1–20 sand, 21–40 ochre, 41–65 rust, 66–100 peak. Unit-test the function with fixed inputs so it never changes silently.

---

## 8. Frontend pages (every page, exact behavior)

Every page has Night and Day, loading skeleton, error state and empty state, is keyboard accessible, and works at 360px. "Data" lists the endpoints it uses.

### Marketing

**M1 `/` Landing**
- *Layout:* full-bleed hero, then four sections, then footer. Left-aligned type.
- *Hero:* `Terrain` in `hero` mode fills the viewport behind the headline, using a bundled demo dataset (a believable fake repo). h1 "Your UI has drifted." at 72/72 expanded. Sub line and two buttons (copy deck). A small live readout in the corner of the map ("Drift 34 · 214 files") that matches the demo data.
- *Section "The flood" (scroll sequence):* sticky `Terrain` on the right, four left-hand steps that advance on scroll: Survey (map appears), See the land (peaks highlighted, a `ValueCompare` example shows `p-[13px]` vs `p-3`), Fix (a fake PR diff), Sea level (terrain floods flat). Scroll position drives the height interpolation. Reduced-motion: show the four states as a static stack.
- *Section "What Datum catches":* a table of the rules from 7.10 as rows with a real code example (found → benchmark) per row. No cards.
- *Section "Built for AI-written code":* two short paragraphs on why generated UI drifts, with a before/after `DriftGauge`.
- *Section pricing teaser:* three plan rows linking to `/pricing`. *FAQ:* 6 questions (what it reads, does it run my code, permissions, pricing, Figma, data retention) as an accordion.
- *Footer:* docs, pricing, changelog, privacy, terms, GitHub.

**M2 `/try` Public survey**
- *Layout:* centered input sheet over a calm flat-sea `Terrain`.
- *Flow:* input "github.com/owner/repo" + button "Survey repository". After submit, the sheet becomes a progress state (Realtime/polling `GET /api/public/survey/:id` every 2s). On done, the map draws in (contour draw-in), below it: drift score with `DriftGauge`, per-category counts, top 10 deviations table, and a CTA "Install Datum to see all {n} deviations and open a fix PR".
- *Errors:* invalid URL, private repo, too large, rate limited (show retry-after).
- *Data:* `POST /api/public/survey`, `GET /api/public/survey/:id`.

**M3 `/pricing`**
- Three plan columns as table-like rows (Free, Pro, Team) with a comparison table below. Defaults (edit in `lib/billing/plans.ts`, nowhere else): Free = 1 site, push + manual surveys, PR comments. Pro = $15 per seat/month, unlimited sites, fix PRs, Figma sync, badge. Team = $39 per seat/month, everything in Pro plus priority survey queue and audit log (future). Monthly/annual switch. CTA "Start free" / "Upgrade".
- *Data:* none; static.

**M4 `/docs` and `/docs/[slug]`**
- MDX from `content/docs/`. Left nav, right on-this-page list. Pages: `quickstart`, `how-surveys-work`, `rules` (generated from 7.10), `config` (full `datum.config.json` reference), `github-permissions`, `figma`, `scoring`, `badge`.
- Search box filtering page titles and headings client-side.

**M5 `/changelog`** — list of dated entries from `content/changelog/*.mdx`.
**M6 `/legal/privacy`, `/legal/terms`** — plain MDX pages.

### Auth

**A1 `/login`** — left: short line "Sign in to survey your UI." and a single button "Continue with GitHub". Right: flat-sea terrain with slow ambient drift. Redirect to `/app` if already signed in. *Data:* Supabase OAuth.

### App (`/app/...`, all require login; shell from 5.5)

**P1 `/app` Atlas**
- *Purpose:* all sites at a glance.
- *Layout:* page header with "Connect repository" button. Below, a **table of rows** (not cards): mini `Terrain` thumb, site name (`owner/repo`), `DriftGauge`, score, trend sparkline (12 surveys), last survey time, status.
- *Sort/filter:* sort by drift, name, last survey; filter by status.
- *Row click:* opens the site chart.
- *Empty:* copy deck "No sites yet..." with button "Connect repository".
- *Data:* `GET /api/sites`.

**P2 `/app/connect`**
- *Purpose:* install the GitHub App and pick repos.
- *States:* (a) no installation: explanation of exactly which permissions are requested and why (read contents, write contents and PRs, read metadata), button "Install on GitHub" → `/api/github/install`. (b) installed: searchable list of repos with checkboxes, plan-limit indicator ("1 of 1 site on Free"), button "Connect {n} repositories". (c) after connect: each selected site shows live survey progress; on done, a "Sea level" or score message with a link to the chart.
- *Data:* `GET /api/installations`, `POST /api/sites`, Realtime on `surveys`.

**P3 `/app/sites/[siteId]` Chart (site home)**
- *Layout:* site header (name, branch, last commit, "Survey now" button, more menu), tab bar, then a large `Terrain` in `chart` mode (min-height 60vh) with `TerrainLegend`, `ScaleBar`, coordinate readout, and `TimeScrubber` beneath it. Right side sheet (collapsible): drift score with `DriftGauge`, change since last survey, counts by category and severity, and the "Top 10 files by drift" list (click zooms the map to the file).
- *Behavior:* selecting a file on the map filters the list below to its deviations (first 10, link "See all in Deviations"). When a survey finishes with lower drift, play the flood. Banner if benchmarks are inferred.
- *Live:* survey in progress shows progress bar in the header and a skeleton map.
- *Data:* `GET /api/sites/:siteId`, `GET /api/surveys/:id/terrain`, `GET /api/surveys/:id/diff`.

**P4 `/app/sites/[siteId]/deviations`**
- *Layout:* filter bar (category, severity, rule, file search, autofixable toggle, status) + dense `Table` (columns: severity, rule, file:line, found, suggested, confidence, status), sticky header, pagination, row keyboard navigation.
- *Bulk:* select rows → "Ignore selected" or "Open fix PR for selected" (only enabled when all selected are autofixable). A primary button "Open fix PR for all safe fixes ({n})".
- *URL state:* all filters live in the query string so links are shareable.
- *Data:* `GET /api/surveys/:id/deviations`, `POST .../ignore`, `POST /api/sites/:id/fixes`.

**P5 `/app/sites/[siteId]/deviations/[deviationId]`**
- *Layout:* two columns. Left: `CodeSnippet` with the offending line highlighted. Right: `ValueCompare` (found vs benchmark, delta), rule explanation (what it is and why it matters), confidence, fingerprint history ("First seen in Survey 0031, present in 17 surveys"), actions: "Ignore deviation", "Copy suggested fix", "Open file on GitHub" (deep link with line anchor).
- *Below:* other deviations in the same file.
- *Data:* `GET /api/deviations/:id`.

**P6 `/app/sites/[siteId]/benchmarks`**
- Tabs by category. Per category: for colors a swatch table (swatch, name, value, source, usage count); for lengths a ruler view (bars scaled to px) plus table. Each row shows "used N times". Add/edit/delete custom benchmarks in a dialog. Banner when inferred. Orphaned benchmarks (used 0 times) are flagged.
- *Data:* `GET/POST /api/sites/:id/benchmarks`, `PATCH/DELETE /api/benchmarks/:id`.

**P7 `/app/sites/[siteId]/surveys`**
- Table of surveys: `Survey 0047`, trigger, commit (short sha linking to GitHub), branch, status, drift score, delta vs previous (colored sand→peak or tide if down), deviations, duration. Row opens the report.
- *Data:* `GET /api/sites/:id/surveys`.

**P8 `/app/sites/[siteId]/surveys/[surveyId]` Survey report**
- Header: `Survey 0047 · commit · time`. Terrain of this survey (chart mode, read-only). Sheet: score, per-category counts, "New since previous / Fixed since previous / Unchanged" with counts, and the lists of new and fixed deviations. Button "Compare with previous" toggles the terrain to flood-compare between the two surveys.
- *Data:* `GET /api/surveys/:id`, `.../terrain`, `.../diff`, `.../deviations`.

**P9 `/app/sites/[siteId]/components`**
- Groups of duplicate components (rule `component/duplicate`). Each group is a row with name list, files, similarity %, and expandable side-by-side `CodeSnippet`s. Action: "Copy merge brief" (copies a text brief describing what to consolidate, to paste into an AI tool).
- *Data:* `GET /api/sites/:id/components`.

**P10 `/app/sites/[siteId]/fixes`**
- Table of fix PRs: status, PR number (link), deviations fixed, files, created by, time. Row expands to show the per-category breakdown and any items left manual. "Open fix PR" button at the top with a confirmation dialog summarizing what will change (counts by category) before sending. After merge, the banner from the copy deck appears and the next survey floods the map.
- *Data:* `GET /api/sites/:id/fixes`, `POST /api/sites/:id/fixes`, `GET /api/fixes/:id`.

**P11 `/app/sites/[siteId]/figma`**
- Not connected: form for Figma file URL + access token with short instructions on creating a token, "Connect Figma". Connected: file name, last synced, "Sync now". Mismatch table (kind, Figma name, Figma value, code value) with `ValueCompare` per row, filter by kind and category.
- *Data:* `PUT/DELETE /api/sites/:id/figma`, `POST .../sync`, `GET .../mismatches`.

**P12 `/app/sites/[siteId]/settings`**
- Sections in one scrolling page with anchors: General (branch, pause surveys), Surveys (ignore paths, enabled rules toggles, framework override), PR guard (threshold for failing the check, always-comment toggle), Badge (enable + copy markdown snippet with live preview), Danger zone (disconnect site, typed confirmation).
- Saves via `PATCH /api/sites/:id`. Show a "Read from datum.config.json" notice when the repo config overrides a setting.

**P13 `/app/account`** — profile (GitHub avatar + login), connected installations list with "Manage on GitHub" links, sign out button.
**P14 `/app/billing`** — current plan, seats, next invoice date, "Change plan" (→ Checkout), "Manage billing" (→ Portal). Usage bar for sites.

### Utility

- **`/styleguide`** — every token, type style, spacing step, and all components in all states, both themes, plus the Terrain in each mode with sample data. Hidden in production unless `NEXT_PUBLIC_STYLEGUIDE=1`. `noindex`.
- **`not-found`** — flat sea map, "That page isn't on the map." and a link home.
- **`error`** — plain explanation, reference id, retry button.

---

## 9. Tasks (build in this order)

### Phase 1 — Foundation and design system
- [ ] Next.js 15 + TypeScript strict + Tailwind + ESLint + Prettier, pnpm. Folder structure from section 3
- [ ] `styles/tokens.ts` with all tokens for Night and Day, CSS variable generation, Tailwind theme mapped to variables, theme switching (system default, persisted)
- [ ] `next/font` Archivo (variable, width axis) and IBM Plex Mono; type scale utilities
- [ ] Build components 1 to 7 and 11 to 12 from 5.8 with all states
- [ ] `/styleguide` page showing tokens, type, spacing and every component in both themes
- [ ] ESLint/Stylelint bans from 5.11 configured and passing
- [ ] Supabase local dev (`supabase init`, `supabase start`), `@supabase/ssr` clients in `lib/supabase/`
- [ ] Vitest + Playwright set up, one test each
- **Done when:** `/styleguide` renders everything in Night and Day, lint bans work (prove with a failing example), and it does not look like a generic dashboard.

### Phase 2 — Database and RLS
- [ ] Migrations for every table in section 6, enums, indexes, triggers for `surveys.seq`
- [ ] RLS policies and a test that user A cannot read user B's sites, surveys or deviations
- [ ] Realtime enabled on `surveys`; Storage bucket `reports` (private)
- [ ] `seed.sql` with two sites and realistic deviations
- [ ] Generate and commit types
- **Done when:** `supabase db reset` runs clean, seed loads, RLS test passes.

### Phase 3 — Auth, app shell, API foundations
- [ ] Supabase GitHub login, `/login`, `/auth/callback`, `/api/auth/logout`, route protection middleware
- [ ] `lib/api/` helpers: `requireUser`, `requireSiteAccess`, zod parse helper, error helper (7.1), pagination helper, rate limiter
- [ ] App shell (rail, site header, tab bar), `not-found`, `error`, `/api/health`
- [ ] `/app` atlas and `/app/sites/[siteId]` pages wired to **seed data** (table and placeholders for the map)
- **Done when:** I can log in, see the seeded sites, and move through the shell.

### Phase 4 — GitHub App and connecting sites
- [ ] Register GitHub App (permissions: contents read/write, pull requests read/write, checks write, metadata read; events from 7.4). Document the exact settings in `docs/github-app.md`
- [ ] `/api/github/install`, `/api/github/setup`, `/api/installations`, `/api/github/webhook` with signature verification and handlers that only store data for now
- [ ] `POST/GET/PATCH/DELETE` site routes, plan-limit enforcement
- [ ] `/app/connect` (all three states) with Realtime progress placeholder
- **Done when:** installing the app on a test repo lists it, connecting it creates a site.

### Phase 5 — Benchmark extraction
- [ ] Tailwind config resolver, v4 `@theme` parser, CSS custom property parser, normalization (hex/rgb/hsl → hex + OKLab; rem/px → px)
- [ ] Inference fallback (section 4)
- [ ] Benchmark routes (7.2) and the Benchmarks page (P6)
- [ ] Tests with fixture repos for Tailwind v3, v4, CSS-variables-only, no design system
- **Done when:** a real Tailwind repo produces the correct benchmark list in the UI.

### Phase 6 — Detection engine (the core; review this phase by hand)
- [ ] File walker and ignore rules
- [ ] Class-string extractor handling `className`, `cn()`, `clsx()`, `cva()`, template literals
- [ ] Implement every rule in 7.10, one file each, each with fixtures and tests (positive, negative, edge)
- [ ] Nearest-benchmark and confidence helpers with unit tests
- [ ] Fingerprints; scoring functions (7.11) with fixed-value tests
- [ ] A CLI script `pnpm detect <dir>` that prints results (dev tool, not a product feature)
- **Done when:** the fixture repo returns exactly the expected deviations and a stable score.

### Phase 7 — Survey pipeline and jobs
- [ ] Inngest setup and `/api/inngest`
- [ ] `survey.run` following 7.6, progress updates, idempotency, error handling
- [ ] `POST /api/sites/:id/surveys`, survey routes, deviation routes, diff route, terrain route
- [ ] Webhook `push` triggers surveys; install triggers the first survey
- **Done when:** pushing to a connected repo produces a survey with deviations visible through the API.

### Phase 8 — Terrain component
- [ ] `lib/terrain/` pure functions: hierarchy layout, height field, contours, bands. Unit tests
- [ ] `Terrain` in all four modes, interaction, legend, scale bar, coordinate readout
- [ ] Contour draw-in and flood animation, reduced-motion fallback
- [ ] `TimeScrubber`, `DriftGauge`, empty sea state
- [ ] Server-rendered SVG for the badge; badge route
- [ ] Performance check at 800 files; canvas fallback above
- [ ] Add to `/styleguide` with sample data for all modes
- **Done when:** a seeded site's map looks distinct, pans and zooms smoothly, and the flood plays between two seeded surveys.

### Phase 9 — Site pages
- [ ] P3 Chart, P4 Deviations, P5 Deviation detail, P7 Surveys, P8 Survey report, P9 Components, P6 Benchmarks (if not done)
- [ ] `ValueCompare`, `CodeSnippet`, filters in query string, bulk actions (ignore)
- [ ] Ignore/unignore routes
- [ ] Live survey progress via Realtime on the site header
- **Done when:** every page in this phase works with real surveys and all empty/loading/error states.

### Phase 10 — Fixes
- [ ] Fix generator (7.8) with tests proving edited files still parse and deviations drop
- [ ] `fix.create` job, `POST/GET /api/sites/:id/fixes`, `GET /api/fixes/:id`
- [ ] Fixes page (P10) with confirmation dialog; fix-merged handling and banner
- **Done when:** "Open fix PR" on a test repo opens a clean PR, and after merging it the next survey shows lower drift and the map floods.

### Phase 11 — PR guard
- [ ] `survey.pr` job, baseline diff, check run with annotations, single updatable comment (7.9)
- [ ] Settings page (P12) with threshold and always-comment options
- **Done when:** a PR that adds `p-[13px]` gets a failing check and a comment naming the line.

### Phase 12 — Figma sync
- [ ] Encrypted token storage, Figma variables/styles client, `figma.sync` job
- [ ] Mismatch computation and routes, Figma page (P11)
- **Done when:** a Figma file and a repo produce a mismatch list.

### Phase 13 — Public try and badge
- [ ] `POST /api/public/survey`, `GET /api/public/survey/:id`, rate limits, caching, size guards
- [ ] `/try` page (M2)
- [ ] Badge enabling in settings, `/badge/:owner/:repo` with caching
- **Done when:** a stranger can survey a public repo without logging in and sees the terrain.

### Phase 14 — Billing and account
- [ ] `lib/billing/plans.ts`, Stripe Checkout, Portal, webhook, plan enforcement (sites, fix PRs, Figma, badge)
- [ ] `/app/account`, `/app/billing`, `/pricing`
- **Done when:** a Stripe test-mode subscription unlocks Pro features and downgrade locks them.

### Phase 15 — Landing, docs, changelog, legal
- [ ] Landing page (M1) including the hero terrain and the scroll "flood" sequence
- [ ] Docs (M4) with generated rules reference, changelog, privacy, terms
- [ ] SEO basics, OG image (static terrain render), analytics, Sentry
- **Done when:** landing matches section 5, Lighthouse performance and accessibility ≥ 90 on `/`.

### Phase 16 — Hardening and dogfooding
- [ ] Playwright e2e: login → connect (mocked GitHub) → survey → filter → ignore → fix
- [ ] Security pass: webhook replay protection, RLS review, service-role usage audit, input limits, SSRF guard on public repo URLs, secrets scan
- [ ] Datum surveys its own repo in CI with threshold 0
- [ ] Screenshot tests for key pages in both themes
- **Done when:** CI is green including the self-survey, and all acceptance checks pass.

---

## 10. Acceptance checklist (final)

- [ ] Every route in 7.2 exists and returns the documented shape
- [ ] Every page in section 8 exists with loading, empty, error states
- [ ] A fresh user can go from `/try` → login → connect → survey → fix PR → merged → flooded map without help
- [ ] No gradients, no arbitrary Tailwind values, no hex outside tokens; the self-survey reports 0 deviations
- [ ] AA contrast in both themes; full keyboard use of table, menus, dialogs and map
- [ ] The terrain map is recognizably the product's face on landing, atlas, chart, report, `/try` and badge
- [ ] `DECISIONS.md` lists every ambiguity resolved along the way

## 11. Future (do not build now)

VS Code extension · CLI (`npx datum survey`) · Slack digest · Storybook screenshot diffing · Vue/Svelte support · multi-org roles and SSO · audit log · accessibility drift (contrast regressions)
