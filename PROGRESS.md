# Progress

## Current status

**M1 in progress (go-ahead given 2026-11-09).** 1.1–1.2 done. Next: task 1.3, config + scoring.

## Needs from Dani

**Now (blocks M1 or its plan):**
- [x] Go-ahead on the M1 plan + spec fixes (2026-11-09, all accepted, see DECISIONS.md)
- [x] Vercel plan: build for scale; Dani will upgrade to Pro when a milestone needs it (we flag it here)
- [ ] Only if task 1.11 hits it: grant Vercel's GitHub app access to `daniellehm/ChangelGame`

**Later (not blocking yet, listed so nothing surprises us):**
- [ ] M2: the Supabase **secret / service-role key** pasted into `.env.local`. The Supabase MCP can read publishable keys only.
- [ ] M3: Supabase auth settings (anonymous sign-ins, captcha, rate limits, redirect URLs, custom SMTP). The MCP has no auth-config tool. Either Dani gives a Supabase personal access token (scoped use: Management API for project "changel" only), or follows a short dashboard checklist that I'll write.
- [ ] M3: Cloudflare Turnstile site key + secret (invisible widget, domains `changel.app`, `localhost`, `*.vercel.app`)
- [ ] M4: DNS records for changel.app at the registrar (exact table to come: Resend SPF/DKIM/MX + Vercel A/CNAME)
- [ ] M4: Google OAuth client (Google Cloud console) for Supabase
- [ ] M5: Anthropic API key
- [ ] M6: Sentry account/DSN; PostHog or Plausible account
- [ ] Launch: `LAUNCH_DATE`, and whether puzzle #1 is themed (spec open question)

---

## Milestone 1: Scaffold + visuals

Next.js app, tokens, fonts, all game screens ported from the prototype, running on hard-coded data.
**Milestone accepted when:** side-by-side screenshots match the prototype at 390 px and 1280 px.

- [x] **1.1 Scaffold.** Next.js (App Router, TypeScript strict, ESLint), Vitest, Playwright, npm scripts, `.nvmrc`, `.env.example`, repo layout from SPEC section 3.
  *Accept:* `npm run dev` serves a page; `npm run typecheck`, `npm run lint` and `npm test` pass; `.env.example` lists every variable from SPEC section 11 with no values.
- [x] **1.2 Tokens + fonts.** Port the prototype CSS into `app/globals.css` nearly verbatim, with all colours as `:root` tokens (DECISIONS: extra tokens). Bricolage (with opsz axis) + JetBrains Mono via `next/font`. Respect `prefers-reduced-motion`.
  *Accept:* no hard-coded colour outside `:root`; fonts self-hosted (no request to fonts.googleapis.com); reduced-motion disables pop/pin/toast animations.
- [ ] **1.3 Config + scoring.** `lib/config.ts` (SPAN, ε, tier cut-offs, slider range/step/nudge/snap, final titles, LAUNCH_DATE) and a pure `lib/scoring.ts` that matches the prototype's `score`/`tier`.
  *Accept:* Vitest covers exact hit = 100, 2× off ≈ 60, ~5.6× off = 0, wrong way = 0 + flag, both sides within ε are never wrong-way, clamp to [−3, 3], every tier boundary (89/90, 64/65, 29/30) and every title boundary.
- [ ] **1.4 Formatting.** `lib/format.ts`: `fmt` (big, int, usd, sec, m, yrs, time from the prototype; plus aud, pct), `multLabel`, `pct`, using a fixed `en-US` locale so output is deterministic.
  *Accept:* a Vitest case per format (and per branch, e.g. usd ≥1000 / ≥1 / ¢ / tiny), and multLabel up/down/no-change. Output is identical to the prototype for all 20 pool values.
- [ ] **1.5 Basic dates.** `lib/dates.ts`: local date via `Intl` (never UTC), puzzle number from LAUNCH_DATE, time to the next local midnight. The full edge-case table is M2.
  *Accept:* unit tests with fixed clocks for Sydney, London and LA; countdown is correct across a Sydney DST night.
- [ ] **1.6 Hard-coded data.** `lib/fixtures/prototype-pool.ts`: the 20 prototype questions with the prototype's seeded shuffle and epoch (dev-only, removed in M2).
  *Accept:* for a fixed date, the app picks the same 5 questions in the same order as the prototype.
- [ ] **1.7 Game screens.** Components `Header`, `Intro`, `Round`, `Slider`, `Reveal`, `Final`, `ShareButton`, `Toast`, plus a client `Game` state machine (intro → round → reveal → … → final), local mirror under `changel:v1:play:<date>` / `changel:v1:stats`, and the already-played → final behaviour.
  *Accept:* the full 5-round game plays end to end on hard-coded data; copy is identical to the prototype; share text is exact; the clipboard → selectable-box fallback works; refreshing after finishing shows the final screen.
- [ ] **1.8 Slider accessibility.** Arrows ±0.005, Page Up/Down ±0.1, `aria-valuetext` ("2.4 times bigger"), snap to 0 within ±0.01, 44 px target, focus to the verdict on reveal and to the question on a new round.
  *Accept:* a Playwright keyboard-only run completes a game; axe shows no violations other than the documented prototype colour-contrast items.
- [ ] **1.9 Extra screens.** Header menu (How to play, Stats, Account, About), `/how-to-play`, `/stats` (hard-coded local stats), Account and About placeholders, all in prototype style.
  *Accept:* reachable by keyboard and mouse at 390 px; no layout break at 320 px.
- [ ] **1.10 Visual parity test.** A Playwright spec that opens `reference/prototype.html` and the app with the same frozen clock, plays the same slider values, and screenshots intro, round (slider at 0 and at +0.38), reveal and final at 390 px and 1280 px. It also writes side-by-side PNGs to `test-results/parity/`.
  *Accept:* every pair is within a 0.5% pixel-diff threshold (emoji glyph AA allowed); Dani has reviewed the side-by-sides.
- [ ] **1.11 Preview deploy.** Vercel project "changel" linked to `daniellehm/ChangelGame`, functions region syd1 (`vercel.json`), with a preview deploy of the branch.
  *Accept:* a preview URL serves the game; no env vars needed yet.

## Milestone 2: Database + puzzle API

Migrations, RLS, seed import, `GET /api/puzzle`, date window.
**Milestone accepted when:** answers are absent from every network response before lock-in, and all date unit tests pass.

- [ ] 2.1 Supabase CLI + `supabase/migrations` set-up; `.env.local` written (URL, publishable key; secret key from Dani). *Accept:* `list_migrations` matches the repo.
- [ ] 2.2 Core schema: players (+ auth trigger), questions, puzzles, puzzle_rounds, plays, guesses, round_stats, merge_tokens, question_edits, with all constraints from SPEC section 6. *Accept:* constraint tests (bad values rejected); Supabase advisors clean.
- [ ] 2.3 RLS policies per SPEC section 6. *Accept:* the anon/authenticated roles cannot read questions/puzzle_rounds; a player can read only their own plays/guesses; advisors clean.
- [ ] 2.4 `content/questions.csv` + import script; seed the 20 prototype questions as candidates. *Accept:* re-runnable (idempotent) import; seed puzzles available for dev dates.
- [ ] 2.5 `lib/dates.ts` window check + every row of the SPEC section 4 edge-case table. *Accept:* all date tests pass with fixed clocks and time zones.
- [ ] 2.6 `GET /api/puzzle?date=D` (Zod, error envelope, 403 `puzzle_not_available`, edge cache 5 min). *Accept:* the response has no end_value/fact/source; out-of-window dates return 403; the client shows "Check your device clock".
- [ ] 2.7 Client switched from the fixture to the API; fixture deleted. *Accept:* a Playwright network spy finds no answer fields in any response before lock-in.

## Milestone 3: Anonymous play + scoring on the server

Anonymous sign-in, `play`/`guess` routes, resume, local mirror and offline fallback, stats view, streaks.
**Milestone accepted when:** the E2E anonymous flow passes, and a cleared-cookie browser falls back to local play.

- [ ] 3.1 Supabase auth config: anonymous sign-ins, Turnstile captcha. *Accept:* anonymous sign-in works from localhost and preview.
- [ ] 3.2 Session creation on the first Play click, via `@supabase/ssr` HTTP-only cookies. *Accept:* no user row on a page load without Play.
- [ ] 3.3 `POST /api/play` (start/resume). *Accept:* idempotent; returns answered rounds.
- [ ] 3.4 `POST /api/guess` in one transaction, with round_stats incremental update. *Accept:* integration tests reject out-of-order, duplicate (409 + stored result), wrong-user and out-of-window guesses.
- [ ] 3.5 Resume mid-game + midnight crossing. *Accept:* a refresh resumes at the next unplayed round; the started puzzle persists past midnight.
- [ ] 3.6 Local-only fallback + later sync. *Accept:* a cleared-cookie / blocked-storage browser can play the full game; it syncs when a session exists.
- [ ] 3.7 `player_stats` view, server streaks (date-line rule), `GET /api/me`. *Accept:* streak unit tests, including n−2 with a tz change.
- [ ] 3.8 Upstash Redis "changel" (Sydney) + rate limits. *Accept:* limits from SPEC section 7 enforced, with tests.
- [ ] 3.9 E2E anonymous flow (mobile viewport): full game → refresh resumes → finish → share text exact → next day (mocked clock) new puzzle, streak = 2.

## Milestone 4: Login + merge

Magic link, Google, upgrade in place, merge-token flow, account page with export/delete.
**Milestone accepted when:** an anonymous player with 3 plays logs in on a second device holding 2 other plays and ends with all 5 (earlier-started kept on clashes).

- [ ] 4.1 Resend: domain changel.app + sending-only key restricted to it; Supabase custom SMTP; branded magic-link email from hello@changel.app.
- [ ] 4.2 "Save your streak" prompt (after the 2nd completed game + header menu); upgrade in place via `updateUser({ email })`.
- [ ] 4.3 Google via `linkIdentity`.
- [ ] 4.4 merge_tokens + `POST /api/merge` (earlier-started wins, stats recomputed, anon user deleted). *Accept:* integration test for the clash rule.
- [ ] 4.5 Account page: change email, export JSON, delete account (hard delete).
- [ ] 4.6 Sign out → fresh anonymous state + local cache cleared.
- [ ] 4.7 Nightly cleanup cron (anon users with no plays > 7 days, inactive > 400 days).
- [ ] 4.8 E2E: magic link via test inbox → stats persist in a second browser context; the 3 + 2 = 5 acceptance scenario.

## Milestone 5: Content pipeline + admin

**Milestone accepted when:** a cold start with an empty database fills 30 days with no human action; a planted wrong number is flagged; simulated reports from 11% of players add the question once to the Reports queue, send no email and leave it live, while 3 reports out of 5,000 players do nothing; and deleting a day triggers the rerun plus an alert.

- [ ] 5.1 Pipeline tables: content_runs, check results, reports, events (+ `flagged` question status).
- [ ] 5.2 Data-backed generators: OWID, World Bank.
- [ ] 5.3 Researched generator (Claude + web search).
- [ ] 5.4 Automatic checks (source support, cross-check, like-for-like, sanity, duplicate, topic safety, fact quality). *Accept:* a planted wrong number is flagged.
- [ ] 5.5 Scheduler with balance rules, the 7-day rule and the reserve of 10. *Accept:* cold-start fill.
- [ ] 5.6 Nightly cron orchestration (fits Vercel limits), cost logging.
- [ ] 5.7 Admin auth (ADMIN_EMAILS) + portal shell with queue badges and alert banner.
- [ ] 5.8 Admin pages: Reports, Upcoming, Question editor (+ question_edits, "Corrected" note), Flagged, Question bank, Health.
- [ ] 5.9 Report button + validity rules + report-rate queueing. *Accept:* 11% vs 3/5,000 simulations.
- [ ] 5.10 Same-day pull / reserve swap; rerun fallback; alert emails (game-at-risk only). *Accept:* deleting a day → rerun + alert.

## Milestone 6: Virality + launch hardening

**Milestone accepted when:** Lighthouse mobile ≥ 95, the share link unfurls correctly in iMessage/WhatsApp/X, and 60 days of verified puzzles are scheduled.

- [ ] 6.1 Share sheet (`navigator.share`) + `?r=` code + landing.
- [ ] 6.2 `/api/og` images (1200×630).
- [ ] 6.3 Crowd stats line on reveal (≥ 50 plays) + "Today's trap" on the final screen.
- [ ] 6.4 Analytics events + `visits` + `daily_metrics` cron.
- [ ] 6.5 Admin Analytics page (Recharts, CSV export).
- [ ] 6.6 Sentry client + server.
- [ ] 6.7 Turnstile hardening, rate-limit review, CI grep for the service-role key in build output.
- [ ] 6.8 Privacy + terms pages, SEO (title, meta, OG/Twitter, sitemap, /how-to-play).
- [ ] 6.9 Lighthouse ≥ 95 + bundle budget; domain + DNS; launch checklist.

---

## Done log

_Newest first._

- 2026-11-09: 1.2 Tokens + fonts: prototype CSS ported to `app/globals.css` with all colours tokenised (test enforces no colours outside `:root`), reduced-motion rule, Bricolage (variable, opsz) + JetBrains Mono self-hosted via `app/fonts.ts`.
- 2026-11-09: 1.1 Scaffold: Next 16.4 + React 19.3, TS 5.9 strict, ESLint 9, Vitest 5, Playwright 1.65, Node 22, `.env.example` + test that it lists every var. (8 moderate npm-audit advisories, all in dev-only typescript-eslint; not shipped.)
- 2026-11-09: Logged Dani's go-ahead and the 16 accepted spec fixes in DECISIONS.md.
- 2026-11-09: Created CLAUDE.md, PROGRESS.md and DECISIONS.md.
