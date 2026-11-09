# Progress

## Current status

**M4 in progress on branch `m4-login-merge` (email-only, no Google).** All code done and tested; Resend verified; Dani's Supabase email checklist done. Next: Dani's real sign-in test on the preview, then the M4 review.

## Needs from Dani

**Now:**
- [x] Supabase email checklist (done by Dani 2026-11-09: custom SMTP via Resend, templates, redirect URLs, secure email change off, 6-digit OTP)
- [x] GoDaddy: nameservers pointed to Vercel (done by Dani 2026-11-09); Claude manages DNS records in Vercel
- [x] Review M3 (approved 2026-11-09; Dani's preview game verified server-side: 423, anonymous, source=server)
- [x] Go-ahead for M4 (2026-11-09): email-only, no Google; stay logged in
- [x] Review M2 (approved 2026-11-09)
- [x] Go-ahead for M3 (2026-11-09): dashboard checklist for Supabase, Turnstile deferred to M6
- [x] (done 2026-11-09) **Supabase dashboard checklist:** project Changel → **Authentication → Sign In / Providers** → turn on **Allow anonymous sign-ins** → Save. Then **Authentication → Rate Limits** → **IP Address Forwarding** → turn it on → Save. Leave the anonymous sign-ins limit at its default of 30/hour.
- [x] Add `SUPABASE_SERVICE_ROLE_KEY` in Vercel (done by Dani 2026-11-09; Sensitive, all environments)
- [x] Review M1 (approved 2026-11-09)
- [x] Pick which design-playground ideas to keep (2026-11-09: all five, but keep the round label; see DECISIONS)
- [x] Go-ahead on the M1 plan + spec fixes (2026-11-09, all accepted, see DECISIONS.md)
- [x] Vercel plan: build for scale; Dani will upgrade to Pro when a milestone needs it (we flag it here)
- [x] Approve the Vercel MCP connection for the `releasedani` scope, and confirm it's the right account (done 2026-11-09)
- [x] Connect GitHub to the Vercel account (done 2026-11-09)
- [x] Add `ChangelGame` to the Vercel GitHub app's repository access (done 2026-11-09)

**Later (not blocking yet, listed so nothing surprises us):**
- [x] M2: Supabase secret key in `.env.local` (done 2026-11-09, verified working)
- [ ] M6 (moved from M3 by Dani): Cloudflare Turnstile site key + secret (invisible widget, domains `changel.app`, `localhost`, `*.vercel.app`)
- [ ] M5: Anthropic API key
- [ ] M6: Sentry account/DSN; PostHog or Plausible account
- [ ] Launch: `LAUNCH_DATE`, and whether puzzle #1 is themed (spec open question)
- [ ] Launch (Claude does it, with Dani's OK, since it's a delete): remove the dev seed puzzles 2026-11-09…12

---

## Milestone 1: Scaffold + visuals

Next.js app, tokens, fonts, all game screens ported from the prototype, running on hard-coded data.
**Milestone accepted when:** side-by-side screenshots match the prototype at 390 px and 1280 px.
**Status:** ✅ approved by Dani and merged to `main` on 2026-11-09. Parity = 0 px difference on all 14 screenshots.

- [x] **1.1 Scaffold.** Next.js (App Router, TypeScript strict, ESLint), Vitest, Playwright, npm scripts, `.nvmrc`, `.env.example`, repo layout from SPEC section 3.
  *Accept:* `npm run dev` serves a page; `npm run typecheck`, `npm run lint` and `npm test` pass; `.env.example` lists every variable from SPEC section 11 with no values.
- [x] **1.2 Tokens + fonts.** Port the prototype CSS into `app/globals.css` nearly verbatim, with all colours as `:root` tokens (DECISIONS: extra tokens). Bricolage (with opsz axis) + JetBrains Mono via `next/font`. Respect `prefers-reduced-motion`.
  *Accept:* no hard-coded colour outside `:root`; fonts self-hosted (no request to fonts.googleapis.com); reduced-motion disables pop/pin/toast animations.
- [x] **1.3 Config + scoring.** `lib/config.ts` (SPAN, ε, tier cut-offs, slider range/step/nudge/snap, final titles, LAUNCH_DATE) and a pure `lib/scoring.ts` that matches the prototype's `score`/`tier`.
  *Accept:* Vitest covers exact hit = 100, 2× off ≈ 60, ~5.6× off = 0, wrong way = 0 + flag, both sides within ε are never wrong-way, clamp to [−3, 3], every tier boundary (89/90, 64/65, 29/30) and every title boundary.
- [x] **1.4 Formatting.** `lib/format.ts`: `fmt` (big, int, usd, sec, m, yrs, time from the prototype; plus aud, pct), `multLabel`, `pct`, using a fixed `en-US` locale so output is deterministic.
  *Accept:* a Vitest case per format (and per branch, e.g. usd ≥1000 / ≥1 / ¢ / tiny), and multLabel up/down/no-change. Output is identical to the prototype for all 20 pool values.
- [x] **1.5 Basic dates.** `lib/dates.ts`: local date via `Intl` (never UTC), puzzle number from LAUNCH_DATE, time to the next local midnight. The full edge-case table is M2.
  *Accept:* unit tests with fixed clocks for Sydney, London and LA; countdown is correct across a Sydney DST night.
- [x] **1.6 Hard-coded data.** `lib/fixtures/prototype-pool.ts`: the 20 prototype questions with the prototype's seeded shuffle and epoch (dev-only, removed in M2).
  *Accept:* for a fixed date, the app picks the same 5 questions in the same order as the prototype.
- [x] **1.7 Game screens.** Components `Header`, `Intro`, `Round`, `Slider`, `Reveal`, `Final`, `ShareButton`, `Toast`, plus a client `Game` state machine (intro → round → reveal → … → final), local mirror under `changel:v1:play:<date>` / `changel:v1:stats`, and the already-played → final behaviour.
  *Accept:* the full 5-round game plays end to end on hard-coded data; copy is identical to the prototype; share text is exact; the clipboard → selectable-box fallback works; refreshing after finishing shows the final screen.
- [x] **1.8 Slider accessibility.** Arrows ±0.005, Page Up/Down ±0.1, `aria-valuetext` ("2.4 times bigger"), snap to 0 within ±0.01, 44 px target, focus to the verdict on reveal and to the question on a new round.
  *Accept:* a Playwright keyboard-only run completes a game; axe shows no violations other than the documented prototype colour-contrast items.
- [x] **1.9 Extra screens.** Header menu (How to play, Stats, Account, About), `/how-to-play`, `/stats` (hard-coded local stats), Account and About placeholders, all in prototype style.
  *Accept:* reachable by keyboard and mouse at 390 px; no layout break at 320 px.
- [x] **1.10 Visual parity test.** A Playwright spec that opens `reference/prototype.html` and the app with the same frozen clock, plays the same slider values, and screenshots intro, round (slider at 0 and at +0.38), reveal and final at 390 px and 1280 px. It also writes side-by-side PNGs to `test-results/parity/`.
  *Accept:* every pair is within a 0.5% pixel-diff threshold (emoji glyph AA allowed); Dani has reviewed the side-by-sides.
- [x] **1.11 Preview deploy.** Vercel project "changel" linked to `daniellehm/ChangelGame`, functions region syd1 (`vercel.json`), with a preview deploy of the branch.
  *Accept:* a preview URL serves the game; no env vars needed yet.

## Milestone 2: Database + puzzle API

Migrations, RLS, seed import, `GET /api/puzzle`, date window.
**Milestone accepted when:** answers are absent from every network response before lock-in, and all date unit tests pass.
**Status:** both met (E2E `tests/e2e/api.spec.ts` spies on every response; all date tests pass). Preview verified live (sin1). ✅ Approved by Dani and merged to `main` on 2026-11-09.

- [x] 2.1 `supabase/migrations` set-up (applied via MCP, see DECISIONS); `.env.local` written (URL, publishable key; secret key from Dani). *Accept:* `list_migrations` matches the repo.
- [x] 2.2 Core schema: players (+ auth trigger), questions, puzzles, puzzle_rounds, plays, guesses, round_stats, merge_tokens, question_edits, with all constraints from SPEC section 6. *Accept:* constraint tests (bad values rejected); Supabase advisors clean.
- [x] 2.3 RLS policies per SPEC section 6. *Accept:* the anon/authenticated roles cannot read questions/puzzle_rounds; a player can read only their own plays/guesses; advisors clean.
- [x] 2.4 `content/questions.csv` + import script; seed the 20 prototype questions as candidates. *Accept:* re-runnable (idempotent) import; seed puzzles available for dev dates.
- [x] 2.5 `lib/dates.ts` window check + every row of the SPEC section 4 edge-case table. *Accept:* all date tests pass with fixed clocks and time zones.
- [x] 2.6 `GET /api/puzzle?date=D` + stateless `POST /api/reveal` (DECISIONS 2026-11-09) (Zod, error envelope, 403 `puzzle_not_available`, edge cache 5 min). *Accept:* the response has no end_value/fact/source; out-of-window dates return 403; the client shows "Check your device clock".
- [x] 2.7 Client switched from the fixture to the API; fixture deleted. *Accept:* a Playwright network spy finds no answer fields in any response before lock-in.

## Milestone 3: Anonymous play + scoring on the server

Anonymous sign-in, `play`/`guess` routes, resume, local mirror and offline fallback, stats view, streaks.
**Milestone accepted when:** the E2E anonymous flow passes, and a cleared-cookie browser falls back to local play.
**Status:** both met (`tests/e2e/anonymous.spec.ts`, real anonymous sign-in). Preview serves from sin1 with rate limiting live. ✅ Approved by Dani and merged to `main` on 2026-11-09.

- [x] 3.1 Supabase auth config (Dani's dashboard checklist): anonymous sign-ins + IP address forwarding. Turnstile moved to M6. *Accept:* anonymous sign-in works from localhost and preview.
- [x] 3.2 `POST /api/session` on the first Play click: server-side `signInAnonymously` with the secret key + `Sb-Forwarded-For`, `@supabase/ssr` HTTP-only cookies. *Accept:* no user row on a page load without Play; sign-ups are rate-limited per player IP.
- [x] 3.3 `POST /api/play` (start/resume). *Accept:* idempotent; returns answered rounds.
- [x] 3.4 `POST /api/guess` in one transaction, with round_stats incremental update. **Also cover the DB checks deferred from 2.2:** player-row trigger, account-delete cascade, one play per puzzle, insert-only guesses, guess tier/wrong-way check. *Accept:* integration tests reject out-of-order, duplicate (409 + stored result), wrong-user and out-of-window guesses.
- [x] 3.5 Resume mid-game + midnight crossing. *Accept:* a refresh resumes at the next unplayed round; the started puzzle persists past midnight.
- [x] 3.6 Local-only fallback + later sync. *Accept:* a cleared-cookie / blocked-storage browser can play the full game; it syncs when a session exists.
- [x] 3.7 `player_stats` view, server streaks (date-line rule), `GET /api/me`. *Accept:* streak unit tests, including n−2 with a tz change.
- [x] 3.8 Upstash Redis "changel" (Singapore, see DECISIONS) + rate limits. *Accept:* limits from SPEC section 7 enforced, with tests.
- [x] 3.9 (`tests/e2e/anonymous.spec.ts`) E2E anonymous flow (mobile viewport): full game → refresh resumes → finish → share text exact → next day (mocked clock) new puzzle, streak = 2.

## Milestone 4: Login + merge

Magic link, Google, upgrade in place, merge-token flow, account page with export/delete.
**Milestone accepted when:** an anonymous player with 3 plays logs in on a second device holding 2 other plays and ends with all 5 (earlier-started kept on clashes). Email-only; Google dropped by Dani (DECISIONS 2026-11-09).

- [ ] 4.1 Resend: domain changel.app + sending-only key restricted to it; Supabase custom SMTP; branded sign-in email (link + 6-digit code) from hello@changel.app; changel.app added to Vercel; DNS table for GoDaddy.
- [x] 4.2 "Save your streak" prompt (after the 2nd completed game + header menu); upgrade in place via `updateUser({ email })`; verify by 6-digit code or link; sessions persist (no re-entering codes).
- [~] 4.3 Google via `linkIdentity`: **dropped by Dani** (email-only).
- [x] 4.4 merge_tokens + `POST /api/merge` (earlier-started wins, stats recomputed, anon user deleted). *Accept:* integration test for the clash rule.
- [x] 4.5 Account page: change email, export JSON, delete account (hard delete).
- [x] 4.6 Sign out → fresh anonymous state + local cache cleared.
- [x] 4.7 Nightly cleanup cron (anon users with no plays > 7 days, inactive > 400 days).
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

- 2026-11-09: Dani finished the Supabase email settings (Supabase defaults had secure email change on and 8-digit codes; both changed). Found the branch preview link pointing at an older build (a queued build finished last); redeployed.
- 2026-11-09: 4.7 Cleanup cron: migration `cleanup_candidates` (anonymous + no plays after 7 days, or inactive 400 days; never permanent accounts), `GET /api/cron/cleanup` (Bearer CRON_SECRET, timing-safe; deletes in batches of 500; drops expired merge tokens), `vercel.json` cron at 17:30 UTC daily. CRON_SECRET generated into `.env.local` + Vercel (Sensitive). Resend domain verified. 173 unit + 57 integration pass.
- 2026-11-09: M4 UI: `SaveStreak` (email → code), final-screen prompt from the 2nd game, `/account` (sign in / save / change email / export / sign out / two-step delete), branded email templates + `docs/setup/supabase-email.md`. Fixed a duplicate-anonymous-user race (single-flight `ensureSession`; unit + E2E regression). Idle toast now hidden. 173 unit, 54 integration, 27 Playwright pass.
- 2026-11-09: 4.2/4.4/4.5/4.6 server side: `POST /api/auth/email` (always `{sent:true}`; flow kept in an HTTP-only cookie; upgrade in place via updateUser, or a merge token + sign-in code for an existing email), `POST /api/auth/verify` (6-digit code → session + merge), `GET /auth/confirm` (email link), `POST /api/merge`, `POST /api/auth/signout`, `GET /api/account/export`, `POST /api/account/delete`. Rate limits: 5 emails / 10 codes per 10 min per IP. Integration test of the M4 acceptance passes (5 plays end up on the account, earlier-started kept on the clash, anonymous user deleted, token single-use). UI + Supabase email config still to do.
- 2026-11-09: DNS: Dani moved changel.app nameservers to Vercel; Claude added the 5 Resend records via the Vercel API (after Vercel created the zone) and started Resend verification. https://changel.app returns 200 over HTTPS (public, serves `main`); the www certificate is pending. Migrations `merge_players` (earlier-started wins on clashes) and `email_registered` (server-only) applied.
- 2026-11-09: 4.1 (part): Resend domain `changel.app` created (sending only, ap-northeast-1, no tracking; the other Resend domain untouched); sending-only key restricted to changel.app in `.env.local` + Vercel (Sensitive). `changel.app` + `www` (308 → apex) added to the Vercel project. DNS instructions for Dani: `docs/setup/godaddy-dns.md`.
- 2026-11-09: M4 started (branch `m4-login-merge`). Dani: email-only login, no Google; players must stay logged in; DNS is at GoDaddy; don't touch other Resend domains or keys.
- 2026-11-09: M3 approved by Dani and merged into `main`. Dani's preview game verified in the DB (Nov 9, 423, anonymous, server-scored). With Dani's OK, deleted 16 untagged test players from the earliest real-sign-in E2E runs (cascaded 18 plays). The DB now holds just Dani's player and play.
- 2026-11-09: M3 preview check: `/api/puzzle` 200 from sin1 (rate limiter loads with the Vercel Upstash env), `/api/me` 401 without a session (body not visible to the fetch tool). **M3 complete**, awaiting Dani's review.
- 2026-11-09: 3.1/3.2/3.9: Dani enabled anonymous sign-ins + IP forwarding. The spec E2E passes with real anonymous players (play → refresh resumes from the server with local storage wiped → finish → exact share text → next day streak 2), and a cookie-refusing browser falls back to local play. Integration tests now use real anonymous sign-in. E2E users tagged e2e + global teardown (deleted 15); per-page fake IPs. Vercel docs confirm x-forwarded-for can't be spoofed. 170 unit + 47 integration + 25 Playwright pass.
- 2026-11-09: 3.9 written: `tests/e2e/anonymous.spec.ts` (spec flow: play → refresh resumes from the server even with local storage cleared → finish → exact share text → next day streak 2; plus the cookie-blocked browser falls back to local play; deletes its test users). Skips until anonymous sign-ins are on. Stats page now prefers `/api/me`. 170 unit + 47 integration + 22 E2E pass, 1 skipped.
- 2026-11-09: 3.8 Rate limits: Upstash Redis "changel" created (free, ap-southeast-1); URL + token in `.env.local` and Vercel (token Sensitive). `lib/api/ratelimit.ts` (sliding windows, fails open, off without env) on puzzle/reveal (per IP) and play/guess/sync/me (per player). Real-Redis test: 30 allowed, the 31st gets 429 + Retry-After. 170 unit, 47 integration, 23 Playwright pass.
- 2026-11-09: 3.5/3.6 Client modes: `lib/game/session-client.ts`; `Game` starts via /api/session + /api/play (server mode) or falls back to local mode via /api/reveal; resumes from the server's answered rounds; handles out_of_order / question_changed / unauthorized mid-game; final screen uses /api/me stats. `POST /api/sync` uploads finished local plays (server re-scores, source='local', server wins, ≤7 days). 46 integration, 169 unit, 21 E2E, 2 visual pass. E2E currently runs in local mode (anonymous sign-ins off).
- 2026-11-09: 3.3/3.4/3.7: `POST /api/play` (start needs an open window, resume allowed through grace, returns answered rounds), `POST /api/guess` (lib/scoring + `submit_guess`; 401/404/403/409 out_of_order/already_answered with stored result/question_changed), `GET /api/me` (player_stats view + TS streaks with the date-line rule). Public rounds now carry `question_id`. Integration tests on a throwaway 2099-03-01 puzzle (cleaned up): 41 pass, including a concurrent double-tap (1 stored) and the 2.2 deferred checks (player trigger, insert-only guesses, delete cascade). Test players use the email fallback until anonymous sign-ins are on.
- 2026-11-09: M3 groundwork: `lib/supabase/request.ts` (request-scoped @supabase/ssr client, HTTP-only Lax cookies, `clientIp`), `lib/api/auth.ts` (`sessionUser` via getClaims), `POST /api/session` (reuse or server-side anonymous sign-in with Sb-Forwarded-For; 429/503 mapping). Migration `submit_guess_and_player_stats` (atomic guess function, service-role only; `player_stats` view; plays index). Advisors clean. End-to-end sign-in tests wait for Dani's checklist.
- 2026-11-09: M3 started (branch `m3-anonymous-play`). Dani chose the Supabase dashboard checklist and deferred Turnstile to M6. Sign-up design changed to forward the player IP to Supabase (see DECISIONS).
- 2026-11-09: M2 approved by Dani and merged into `main`.
- 2026-11-09: M2 preview verified on Vercel (functions in sin1): `/api/puzzle` 200 without answers for an open date, 403 `puzzle_not_available` for a future date, 400 for an invalid date. **M2 complete.**
- 2026-11-09: Dani added `SUPABASE_SERVICE_ROLE_KEY` to Vercel (Sensitive; production, preview, development). All 4 env vars are mirrored.
- 2026-11-09: 2.7 Client on the API: `lib/game/api-source.ts` (GET /api/puzzle, POST /api/reveal, typed load errors), `components/LoadError.tsx` (device clock / no puzzle / offline, with retry). Fixture + fixture source deleted (no answers in JS bundles). E2E pins the server clock to the browser clock (`setClock`, dev server runs with `ALLOW_TEST_CLOCK=1`). New `tests/e2e/api.spec.ts`: no answer in any document/script/API response before its lock-in, one reveal per lock-in, clock-error and no-puzzle screens. Visual baselines refreshed (values now rounded to 3 s.f.). 166 unit + 24 integration + 21 E2E + 2 visual pass. Vercel env: URL, publishable key, LAUNCH_DATE set; the secret key is pending (Dani).
- 2026-11-09: 2.6 API: `GET /api/puzzle` (Zod, window 403, 404 if not ready, 5-min edge cache on 200s only, number from LAUNCH_DATE, rerun-aware) and `POST /api/reveal` (window + 6 h grace, clamp, one round's answer + score, no-store). `lib/puzzles/repo.ts` selects public columns and answers in separate functions. Test clock header (`ALLOW_TEST_CLOCK=1`, never on Vercel production). New `npm run test:integration` (real DB): 24 pass, incl. no answer fields or values in any puzzle response. 176 unit tests pass.
- 2026-11-09: 2.5 Date window: `puzzleWindow`, `isWindowOpen`, `isGuessAcceptable` (6 h grace), `servableDates` in `lib/dates.ts`; `tests/unit/dates-window.test.ts` covers the window boundaries, that every real local date in UTC−12…+14 is always servable, and all 7 rows of the SPEC §4 edge-case table. 172 unit tests pass.
- 2026-11-09: 2.4 Content: migration `question_slug_puzzle_number_optional`; `lib/content/csv.ts` (RFC 4180 parser), `lib/content/questions.ts` (Zod schema mirroring DB checks, 3 s.f. rounding), `content/questions.csv` (20 prototype questions), `scripts/import-questions.ts` (`npm run content:import`, idempotent by slug, `--dry-run`), `lib/content/dev-seed.ts` + `scripts/seed-dev-puzzles.ts` (`npm run content:seed-dev`, 4 ready puzzles 2026-11-09…12). Imported + seeded; second runs are no-ops. 161 unit tests pass.
- 2026-11-09: 2.3 RLS + grants: migrations `rls_and_grants` (revoke client defaults incl. TRUNCATE, service_role data access, authenticated read-own on players/plays/guesses via 3 policies, safe default privileges for future tables), `service_role_no_truncate`, `lock_rls_auto_enable` (advisor WARN on Supabase's auto-RLS function). Verified: privilege matrix correct, public API returns 42501 on every table, security advisor shows only the intentional 'RLS enabled, no policy' notices. Per-user row isolation is tested in M3 with real users.
- 2026-11-09: 2.2 Core schema: migrations `20261109035556_core_schema` (players + auth trigger, questions incl. `flagged`/`checks`, puzzles incl. `rerun_of`, puzzle_rounds with question-once, plays incl. `source`, insert-only guesses incl. `question_id`, round_stats counters with derived avg/pct, merge_tokens (hashed), question_edits, reports) and `20261109040519_questions_change_check_guard` (a division-by-zero bug found by the tests). `supabase/tests/schema_constraints.sql`: 15/15 pass, rolled back. Checks needing an auth user moved to M3 (Claude Code's permission check blocks SQL writes to auth.users).
- 2026-11-09: 2.1: Supabase project found in Singapore. Dani chose to move Vercel functions to `sin1`. `.env.local` filled in (URL, publishable key, LAUNCH_DATE) and the secret key verified with an admin call (HTTP 200). The DB was empty.
- 2026-11-09: Design pass approved by Dani and merged into `main`.
- 2026-11-09: Design pass: About removed and merged into How to play (redirect `/about` → `/how-to-play`, menu item removed). How to play rebuilt as an example round + 3 step tiles + tier stickers + "The deal". 141 unit + 18 E2E + 2 visual tests pass.
- 2026-11-09: Design pass: How to play page cleaned up (Dani's request). Trimmed rules, score tiers shown as stickers, titles list dropped (players discover them), new visual baseline `7-how-to-play`.
- 2026-11-09: Design pass built: trimmed copy, round label + category sticker, − / + beside the multiplier (SVG icons, 44 px), tier-coloured live progress, sticker look (orange-shadow press buttons, tilted verdict/title, ink-bordered cards), motion (bouncy pins, count-ups, flip-in grid, confetti on Nailed it, pop + buzz at ×10), all off under reduced motion. New `lib/sticker.ts`, `components/motion.ts`, `MultLabel.short`. Parity test replaced by `npm run test:visual` (12 baselines). 141 unit + 18 E2E + 2 visual tests pass.
- 2026-11-09: Design pass: Dani chose "less text" (keep weights) and to do it before M2, and was unsure about the fun ideas. Published an interactive playground with each idea switchable.
- 2026-11-09: M1 approved by Dani and merged into `main`. Dani asked for UX improvements beyond the prototype (lighter text, sleeker, fun/funky).
- 2026-11-09: 1.11 Preview deploy: first build green on Vercel (26 s, 6 static routes, syd1). Preview verified live (200, intro HTML, fonts preloaded, noindex). **M1 complete.**
- 2026-11-09: 1.11: Vercel project `changel` created and linked to `daniellehm/ChangelGame` (prj_4qiuH4a01M4Il52WrKi8zd75EjCS), with Node 22.x, Next.js preset and functions in syd1. Previews are behind Vercel Authentication.
- 2026-11-09: 1.11: GitHub login connected. Retry failed with "install the GitHub integration first". The app is restricted to selected repos and `search_repo` can't see ChangelGame.
- 2026-11-09: 1.11: Dani approved MCP access and confirmed the Vercel account. The retry failed: "add a Login Connection to your GitHub account first".
- 2026-11-09: 1.11 started: no existing "changel" project on Vercel. `create_git_project` was refused with 403, because the MCP connection isn't granted to the account scope. Blocked on Dani's consent.
- 2026-11-09: 1.10 Visual parity: `tests/e2e/parity.spec.ts` (`npm run test:parity`) diffs the app against `reference/prototype.html` at 390 and 1280 px across 7 steps (intro → final). It found and fixed two real differences: next/font's Arial fallback (→, ≈ glyphs) and the prototype rendering bold at 800. Result: **0 differing pixels on all 14 screenshots**, threshold tightened to 0.1%. Side-by-sides in `test-results/parity/`. Also started pushing the branch to GitHub after each commit (Dani's request).
- 2026-11-09: 1.9 Extra screens: header menu (keyboard + outside-click + Escape), `/how-to-play`, `/stats` (local stats: played/avg/best, current + max streak, tier distribution with labels, 30-day strip), `/account` and `/about` placeholders via `PageShell` (About later merged into How to play). E2E: menu by mouse/keyboard, no horizontal scroll at 320 px, stats after a game (18 E2E total).
- 2026-11-09: 1.8 Slider accessibility: pure `lib/slider.ts` (keyboard steps without snap, pointer snap ±0.01, nudges), persistent live region for results, nudge labels fixed for WCAG 2.5.3. E2E: keyboard-only full game, 44 px target, axe clean on intro/round/reveal/final except the known prototype contrast (header meta, verdict bar; fixed in M6).
- 2026-11-09: 1.7 Game screens: Header/Menu/Intro/Round/Slider/Reveal/Final/ShareButton/Toast + `Game` state machine; `lib/streaks.ts` (date-line rule, 9 tests), `lib/game/storage.ts` (local mirror), `lib/game/share.ts`. Playwright (mobile 390 px, Sydney tz, frozen clock): 7 E2E tests pass, covering full game, exact share text, clipboard fallback, resume mid-game, midnight crossing, returning player streak = 2, and no console errors.
- 2026-11-09: 1.6 Hard-coded data: `lib/fixtures/prototype-pool.ts` (verbatim pool + seeded shuffle), `lib/game/types.ts` (API-shaped Puzzle/RoundResult + `GameSource` interface), `lib/game/fixture-source.ts`; tests prove identical pool, order and daily picks vs the prototype.
- 2026-11-09: 1.5 Basic dates: `lib/dates.ts` (Intl local date, puzzle number via pure date arithmetic, next-local-midnight by binary search so DST/skipped-midnight zones are exact, countdown format); 22 tests incl. Sydney 23 h / 25 h DST days and Chile.
- 2026-11-09: 1.4 Formatting: `lib/format.ts` (9 formats, multLabel, pctChange, multSpoken for aria); tests compare against functions loaded live from `reference/prototype.html` (`tests/helpers/prototype.ts`) across the full slider range.
- 2026-11-09: 1.3 Config + scoring: `lib/config.ts` (all tunables, versioned storage keys, LAUNCH_DATE as a server-only env passed to the client as a prop) and pure `lib/scoring.ts`; 30 tests incl. a full-range parity sweep against the prototype's score().
- 2026-11-09: 1.2 Tokens + fonts: prototype CSS ported to `app/globals.css` with all colours tokenised (test enforces no colours outside `:root`), reduced-motion rule, Bricolage (variable, opsz) + JetBrains Mono self-hosted via `app/fonts.ts`.
- 2026-11-09: 1.1 Scaffold: Next 16.4 + React 19.3, TS 5.9 strict, ESLint 9, Vitest 5, Playwright 1.65, Node 22, `.env.example` + test that it lists every var. (8 moderate npm-audit advisories, all in dev-only typescript-eslint; not shipped.)
- 2026-11-09: Logged Dani's go-ahead and the 16 accepted spec fixes in DECISIONS.md.
- 2026-11-09: Created CLAUDE.md, PROGRESS.md and DECISIONS.md.
