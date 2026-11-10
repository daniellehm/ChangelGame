# Progress

## Current status

**M5 (content pipeline + admin) approved by Dani and merged to `main` (2026-11-10).** The nightly content cron now runs on production (02:00 UTC). M5 and the UI tweaks are live on changel.app (pushed 2026-11-10 with Dani's OK). **M6 in progress** on branch `m6-virality-launch`. Claude spend this month: about $6.70 of the $50 cap. **The Anthropic account is out of credit** (see Needs from Dani), so the nightly job will fail until it's topped up.

## Needs from Dani

**Now:**
- [x] M4 reviewed and approved (2026-11-09)
- [x] Test the per-question ranges on the preview and approve the merge (2026-11-09)
- [x] Dropped the unused `min_end_value`/`max_end_value` columns (Dani, SQL editor, 2026-11-09; saved as a migration file, not in the remote migration history)
- [x] Relative scoring approved and merged (2026-11-09)
- [x] Go-ahead for M5 (2026-11-09)
- [x] Review M5 and approve the merge (2026-11-10)
- [ ] **Top up Anthropic credit** (console.anthropic.com → Plans & Billing). The 9–10 Nov fill run stopped with "credit balance is too low"; until then every nightly run fails.
- [ ] Days 15–16 Nov are empty (Dani: "forget about the fill for now"). Fill by hand on Upcoming, or they get reruns.
- [ ] Three prototype questions still fail the automatic checks (solar, pandas on days 1–2; Wikipedia was edited by Dani). Dani can approve them by saving in the editor.
- [ ] **Approve one database fix** (Upcoming → reorder a day's rounds).
  - Why: the MCP permission check declined it because it deletes and re-inserts the day's 5 rounds; it's only allowed on days nobody has played.
  - How: approve the prompt when Claude retries, or run in the Supabase SQL editor, then Claude saves it as a migration:
    ```sql
    create or replace function public.reorder_rounds(p_date date, p_ids bigint[]) returns text language plpgsql set search_path = '' as $$
    begin
      if coalesce(array_length(p_ids, 1), 0) <> 5 or (select count(distinct x) from unnest(p_ids) as t(x)) <> 5 then
        raise exception 'reorder_rounds needs 5 distinct ids' using errcode = '22023';
      end if;
      if exists (select 1 from public.plays where puzzle_date = p_date) then return 'played'; end if;
      if (select count(*) from public.puzzle_rounds where puzzle_date = p_date and question_id = any (p_ids)) <> 5 then return 'mismatch'; end if;
      delete from public.puzzle_rounds where puzzle_date = p_date;
      insert into public.puzzle_rounds (puzzle_date, position, question_id) select p_date, t.ord, t.qid from unnest(p_ids) with ordinality as t(qid, ord);
      return 'ok';
    end; $$;
    ```
  - Until then the Upcoming page has Pull and Swap but no reorder.
- [x] `ANTHROPIC_API_KEY` in `.env.local` and Vercel (done by Dani 2026-11-09; verified with a free models call). `ADMIN_EMAILS` set in Vercel by Claude.
- [ ] Open questions: delete the 2 stray anonymous test players from the duplicate-session bug? Add `noindex` to changel.app until launch?
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
**Status:** ✅ met (integration test `api-auth.test.ts` + E2E `replay-merge.spec.ts`); Dani tested real sign-in, email change and the replay case on the preview. Approved and merged to `main` on 2026-11-09.

- [x] 4.1 Resend: domain changel.app + sending-only key restricted to it; Supabase custom SMTP; branded sign-in email (link + 6-digit code) from hello@changel.app; changel.app added to Vercel; DNS table for GoDaddy.
- [x] 4.2 "Save your streak" prompt (after the 2nd completed game + header menu); upgrade in place via `updateUser({ email })`; verify by 6-digit code or link; sessions persist (no re-entering codes).
- [~] 4.3 Google via `linkIdentity`: **dropped by Dani** (email-only).
- [x] 4.4 merge_tokens + `POST /api/merge` (earlier-started wins, stats recomputed, anon user deleted). *Accept:* integration test for the clash rule.
- [x] 4.5 Account page: change email, export JSON, delete account (hard delete).
- [x] 4.6 Sign out → fresh anonymous state + local cache cleared.
- [x] 4.7 Nightly cleanup cron (anon users with no plays > 7 days, inactive > 400 days).
- [x] 4.8 (integration acceptance with real Supabase codes via the admin API + E2E replay/sign-in; Dani's real-inbox test) E2E: magic link via test inbox → stats persist in a second browser context; the 3 + 2 = 5 acceptance scenario.

## Milestone 5: Content pipeline + admin

**Milestone accepted when:** a cold start with an empty database fills 30 days with no human action; a planted wrong number is flagged; simulated reports from 11% of players add the question once to the Reports queue, send no email and leave it live, while 3 reports out of 5,000 players do nothing; and deleting a day triggers the rerun plus an alert.
**Status:** all 10 tasks built and tested on branch `m5-content-admin` (2026-11-09); **waiting for Dani's review**, then merge. Decisions: DECISIONS 2026-11-09 "M5 pipeline: models, spend cap, global mix" and "M5 pipeline: how the nightly job runs".

**How it works (summary):** a candidate question is inserted as `draft`. The checks run, and it becomes `verified` (all pass, `verified_by='auto'`) or `flagged` (any fail, `flag_reason`). The scheduler fills days 7–30 ahead with verified questions (status `scheduled`, puzzle `ready`) and keeps ≥10 verified spares. Once a puzzle date has passed, its questions become `used`. All of this state lives in the database, so the nightly job can stop at any point and resume in the next run.

- [x] 5.1 **Pipeline tables:**
  - `content_runs` (runs, leases, hops, tokens, searches, cost)
  - `question_edits`, `reports`, `events`, `alerts_sent`
  - question columns: `origin`, `flag_reason`, `corrected_at`, `reports_dismissed_rate`
  - `pg_trgm` for duplicate checks
- [x] 5.2 **Claude client wrapper** (`lib/content/llm.ts`): Opus 5.5 / Sonnet 5.5, spend metering against the $50/month cap, server-side fallbacks, typed results. Data sources: World Bank + OWID fetchers with fixtures.
- [x] 5.3 **Generators:**
  - data-backed (curated indicator list, global series; Claude writes only the wording and the fact)
  - researched (Opus + web search, two sources from different publishers)
  - blind `max_change` proposal (sees prompt, start value and years only)
- [x] 5.4 **Automatic checks:** source support, independent cross-check (15%), like-for-like, sanity, duplicate (trigram > 0.6), topic safety, fact quality, range rules. *Accept:* a planted wrong number is flagged.
- [x] 5.5 **Scheduler:** balance rules (no repeated category per day; ≥1 trap |log| < 0.1; ≥1 big mover beyond ×10/÷10; no AU rule, see DECISIONS), the 7-day rule, the reserve of 10. *Accept:* cold-start fill.
- [x] 5.6 **Nightly cron orchestration:** `/api/cron/content` 02:00 UTC; leased, time-boxed hops chained until done; cost logging; `used` marking.
- [x] 5.7 **Admin auth + portal shell:** auth via ADMIN_EMAILS (server check + RLS); portal with queue badges and alert banner.
- [x] 5.8 **Admin pages:**
  - Reports
  - Upcoming
  - Question editor (+ question_edits, "Corrected" note)
  - Flagged
  - Question bank
  - Health (+ "Run now")
- [x] 5.9 **Report button** + validity rules + report-rate queueing. *Accept:* 11% vs 3/5,000 simulations.
- [x] 5.10 **Same-day pull / reserve swap;** rerun fallback; alert emails (game-at-risk only). *Accept:* deleting a day → rerun + alert.

## Milestone 6: Virality + launch hardening

**Milestone accepted when:** Lighthouse mobile ≥ 95, the share link unfurls correctly in iMessage/WhatsApp/X, and 60 days of verified puzzles are scheduled.

- [x] 6.1 Share sheet (`navigator.share`) + `?r=` code + landing. (`lib/game/share.ts` encode/decode, `ShareButton` sheet-or-copy, home page reads `?r=` for OG tags + the intro's friend line; tests: unit share, E2E `share.spec.ts`.)
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

- 2026-11-10: M5 merged into `main` locally (approved by Dani: "ready to move on"); pushing `main` needs Dani's explicit OK (production deploy).
  - UI tweaks on branch `ui-tweaks` (DECISIONS 2026-11-10):
    - a stats day pop-up (score + each round);
    - removed the "saved to your account" note, the Export my data button and the Delete account heading, and fixed the spacing above Delete;
    - stats on a new device now show the account's strip, results and pop-up (`/api/me` returns rounds);
    - the intro and How to Play copy no longer say "now".
  - Tests: unit 283, integration 101, E2E all passing, visual baselines updated (reveal text only).

- 2026-11-09: M5 review, round 2 (from Dani testing):
  - **Admin edits are trusted:** saving doesn't re-run the checks and approves the question. "Run checks (second opinion)" is a separate button.
  - **Assigning days:** Upcoming has "Choose questions…" and "Auto-fill" on empty days, and a question picker for Swap.
  - **Fact-checked the 20 prototype questions:** two sources each, wrong numbers corrected (arctic ice, solar, internet users, CO₂, world population, years for minimum wage, stamp and cinema). 17 pass the full checks; solar, Wikipedia and pandas don't yet (sources don't state the value next to the year, or the year is ambiguous).
  - **Checks tuned (DECISIONS):**
    - the review puts the reason before the verdict and is fairer on neutral facts;
    - the source check reads octet-stream CSVs, 3 s.f. figures and h:mm:ss times;
    - duplicates ignore retired questions;
    - the question writer must cite specific pages it opened with web_fetch.
  - **Filling 13–16 Nov:** `npm run content:fill-days -- 2026-11-13 2026-11-16` is running.

- 2026-11-09: M5 review fixes (from Dani testing the preview):
  - Bank: a Day column (day, round, date), sort by newest added or by puzzle day, and a "Day #" filter.
  - The dev seed's 20 questions were still 'draft' though they're on the 4 test days, so the status filter "scheduled" found nothing. The seed script now marks them 'scheduled', and the DB rows were fixed (19 updated; #19 Bitcoin was flagged by Dani's edit, left as is).
  - A question already on a day that passes its re-check, or is approved, goes back to 'scheduled', not 'verified' (otherwise the scheduler could put it on a second day). Test added.
  - The card label "Held back" is now "Failed checks" (a failed question already on a day is still played until it's pulled).
  - Admin and alert email is now releasedani@gmail.com (Vercel and .env.local).

- 2026-11-09: 5.10 Same-day pull, rerun fallback, alert emails:
  - **Same-day pull:**
    - pulling a live or past round sets `corrected_at` on the old question, so players who already answered keep their score and their reveal says Corrected;
    - players who haven't reached the round get the replacement: the existing `question_changed` reload now asks for `?fresh=…`, which is never cached, so the 5-minute CDN cache can't serve the old round back.
  - **Rerun fallback** (`lib/puzzles/rerun.ts`):
    - when a date's window opens with no ready puzzle, a ready puzzle with `rerun_of` is created (the most recent original at least 365 days earlier, else the oldest original), labelled Rerun, and an alert is emailed;
    - only by the real clock, so tests can't create reruns on real dates.
  - **Alert emails** (`lib/admin/notify.ts`, Resend from hello@changel.app to ADMIN_EMAILS):
    - only when the game is at risk (fewer than 7 ready days, two failed nights, a rerun served);
    - at most once per kind per 20 hours, recorded in `alerts_sent`;
    - sent after each nightly run ends;
    - `CHANGEL_NO_ALERT_EMAIL=1` in every test run, so tests record alerts without sending.
  - **Acceptance:** deleting a day → rerun served (labelled, the original's rounds) + one alert, idempotent (`tests/integration/rerun.test.ts`); same-day pull keeps scores and adds Corrected (`tests/integration/same-day-pull.test.ts`).
  - `questionRange` moved to `lib/range.ts` (pure), so browser tests don't load server-only code.
  - Final counts: unit 279, integration 95, E2E 35, visual 2, all passing. The DB was checked clean after the test runs: no reruns, no running runs, no test questions.

- 2026-11-09: 5.9 Report button + Reports queue:
  - **Player side:**
    - "Something wrong with this?" on each reveal in server mode (`components/ReportButton.tsx`): 4 reasons plus an optional note, then "Thanks"; it never blocks the game.
    - `POST /api/report`: only a locked-in round; the report is about the question actually answered; one per player per question; rate-limited.
  - **Queue** (migration `report_queue`):
    - rate = valid reports ÷ players who saw the reveal; queued over 10% with at least 10 valid;
    - habitual reporters (over 30% of their rounds, once they've played 10+) are ignored, worked out live;
    - a dismissed question comes back only at +10 points. Settings live in `REPORTS` (`lib/config.ts`).
  - **Admin:** `/admin/reports` shows rate, counts, reasons and notes, with Pull and Dismiss; the badge count is on Home and Health.
  - **Also (part of 5.10):** answers carry `corrected`, and the reveal shows "Corrected since it first went live."
  - **Acceptance** (`tests/integration/reports.test.ts`, real DB, 100 players):
    - 11% → in the queue exactly once, no email, question still scheduled and on its day;
    - 3 reports → nothing; exactly 10% → nothing; a habitual reporter is ignored; dismiss and re-queue work.
  - **Other tests:** 1 E2E for the button. The keyboard test now tabs through the report link. Reveal screenshots updated (the new link) and reviewed.

- 2026-11-09: 5.8 Admin pages:
  - **Data and actions** (`lib/admin/data.ts`):
    - Upcoming (yesterday + the next 30 days with sources and check results); Pull (a spare from a category not already on that day; the old question goes to Flagged with the reason) and Swap (a chosen id);
    - Question editor: save rounds values like the importer, logs before/after in `question_edits`, sets `corrected_at` when the question is live or past, refuses edits the game can't play, and re-runs the checks (flagged/draft → verified if they pass);
    - Approve (human, from Flagged); Retire (swaps it out of future days first); Delete (only never-scheduled, never-played candidates);
    - Bank (filters by status, origin, category, text, difficulty and puzzle "Day #"; sort by newest added or by puzzle day, Day 1 first or latest first; a Day column shows each question's day, date and round; stats per question: plays, average points, wrong-way %, report rate);
    - Health (recent runs with logs, pass rate, spend by step, Run now).
  - **Database:** migration `admin_functions` (`question_stats`, `swap_round`; `reorder_rounds` needs a fix, see Needs from Dani).
  - **UI:** routes `/api/admin/{upcoming,upcoming/pull,questions,questions/:id,questions/:id/{approve,retire},health}`; pages `/admin/{upcoming,flagged,bank,health,questions/:id}` with a shared `QuestionCard`.
  - **Tests:** 8 integration (real DB, throwaway 2099 data), 6 E2E.
  - "Preview the day as a player" is shown as the day's question cards, not a full play-through.

- 2026-11-09: 5.7 Admin auth + portal shell:
  - **Access:** `lib/admin/auth.ts` (`requireAdmin`: signed in, not anonymous, email in ADMIN_EMAILS, case-insensitive; 401 / 403).
  - **Alert rules** (`lib/admin/alerts.ts`):
    - banner: under 14 ready days, over 40% of a night failing, a failed run, the spend cap;
    - email: under 7 ready days, or 2 failed nights in a row.
  - **Overview** (`lib/admin/overview.ts`, `GET /api/admin/overview`): queues, ready days ahead, spare verified questions, last run, month spend.
  - **"Run now":** `POST /api/admin/run` uses the same leased hop as the cron (`lib/content/trigger.ts`).
  - **UI:** `/admin` (noindex) with `AdminShell` (sign-in / no-access gates, section nav, works at 320 px) and a home page with alert banner and tiles.
  - **Tests:** 8 unit, 3 integration (401 / 403 / admin), 1 E2E.

- 2026-11-09: 5.6 Nightly orchestration:
  - **`lib/content/pipeline.ts` (`runHop`)**, one time-boxed hop: mark used → schedule → check pending drafts → generate (one data-backed + a researched batch of 5) → repeat → schedule.
    - The remaining need comes from simulating the schedule, so days still empty for lack of a trap or big mover, or of 5 different categories, ask for more candidates of that kind.
    - At most 220 candidates per night.
  - **`lib/content/store.ts`:** database adapter.
  - **`lib/content/run.ts`:** `content_runs` bookkeeping (find or start tonight's run, lease, counters, log, fail-safe error recording; a run older than 20 h is closed as abandoned).
  - **`/api/cron/content`** (Vercel Cron 02:00 UTC): replies 202 at once and does the hop afterwards; it chains the next hop by calling itself.
  - **Tests:** an end-to-end cold start on fakes (30 days ready after a week; planted wrong numbers never scheduled; spend cap; deadline); run bookkeeping against the real table. 271 unit + 74 integration tests.
  - **Bugs found by the tests and fixed:** the run could finish with days left empty when the pool was big enough but missing a kind, or lacking 5 different categories.

- 2026-11-09: 5.5 Scheduler:
  - **`lib/content/schedule.ts`** (pure functions):
    - fills days 7–30 ahead, keeps 10 verified spares, uses the oldest verified questions first;
    - per day: 5 different categories, at least one trap, at least one big mover, at most 2 data-backed;
    - a day that can't meet the trap/big-mover rule stays empty while more than 9 days out, then takes its best set (flagged `relaxed`);
    - top-up = (open days × 5 + reserve − pool) × 1.2.
  - **Migration `scheduler_functions`:** `schedule_puzzle` (atomic: ready puzzle + 5 rounds + `scheduled`; refuses taken/unverified questions and existing days) and `mark_used_questions`.
  - **Cold-start acceptance** simulated in a unit test: an empty database has every one of the next 30 days ready after a week of nightly runs (the 7-day rule means the first week can't be auto-filled).
  - Tests: 12 unit + 4 DB (266 unit total).

- 2026-11-09: 5.4 Automatic checks (`lib/content/checks.ts`, `checkBatch`):
  - **Order:**
    1. free code checks: sanity, range rules, topic blocklist, fact length;
    2. duplicate: same dataset series, or trigram over 0.6 then a Sonnet "same measure?" call;
    3. one Sonnet review covering like-for-like, safety and fact quality;
    4. source support (researched only): our server fetches each page, keeps the passages mentioning the years or values, and Sonnet must quote the value;
    5. independent cross-check: Opus with web search, batches of 5, never shown the values, held back if more than 15% off or not found.
  - Any failure skips the later paid checks and fails safe (flagged, kept for a human).
  - **Acceptance met on real models** (`npm run content:check-smoke`, $0.06):
    - the correct UN question was verified through all 8 checks (both values quoted from un.org + Wikipedia; cross-check 0% off);
    - the planted 293 was flagged, even with a fact written to agree with it;
    - the US Open question with its mismatched fact was flagged.
  - One prompt fix along the way: the reviewer had applied the data-backed fact rule to researched questions.
  - 24 new unit tests (254 total).

- 2026-11-09: 5.3 Generators (`lib/content/generate.ts`, `lib/content/catalog.ts`):
  - **Catalog:** 52 world-level World Bank/OWID series, each checked live.
  - **Data-backed:** code picks a round start year at least 10 years back and the latest year, and reads both values from the dataset; Sonnet writes only the prompt and the fact.
  - **Researched:** batches drafted by Opus with up to 8 web searches.
  - **Range:** a blind `max_change` proposal (never sees the end value; unit test enforces it), raised along a menu only if the range rules need it.
  - **Fix:** OWID charts can ignore the country filter, so the fetcher downloads the full table and keeps only World rows. Multi-measure charts are refused and zero values dropped.
  - **Real smoke run** (`npm run content:smoke`): $0.19, all calls OK. The US Open fact said $90M while the answer was $85M (prize money vs total pay), a good case for the fact-quality check.
  - 230 unit tests.

- 2026-11-09: Stats page note no longer says accounts are "coming soon" (requested by Dani). Signed in: "Your stats are saved to your account, so they follow you to any device you sign in on." Not signed in: "Stats are kept on this device. Add your email (link to /account) to keep your streak on any device." The note waits for the account check, so the wrong one never flashes. Branch `fix-stats-sync-note`. `npm run check` and the pages E2E pass.
- 2026-11-09: 5.2 Claude wrapper + data sources:
  - `lib/content/llm.ts` (`ClaudeLlm`):
    - refuses to call Claude once the month reaches the $50 cap;
    - structured JSON via Zod, with `fallbacks: "default"`;
    - resumes paused web-search turns;
    - refusals, truncated answers and bad JSON become `LlmUnusable` (the candidate gets flagged);
    - prices each call by the model that actually answered and records it in `llm_calls`.
  - `lib/content/ledger.ts`: month spend and recording.
  - `lib/content/sources.ts`: World Bank + OWID fetchers, with recorded fixtures in `tests/fixtures/content/`.
  - 12 unit tests (217 total). `CONTENT` settings live in `lib/config.ts`.
  - Note: a second Claude session (Dani's, for a UI fix) briefly committed these files on its branch `fix-stats-sync-note` and then removed them. That branch was otherwise separate (Stats note only); Dani merged it to `main`.
- 2026-11-09: 5.1 Pipeline tables: migration `content_pipeline_tables`.
  - New tables: `content_runs` (+ atomic `lease_content_run`), `llm_calls` spend ledger (+ `llm_spend_since`), `alerts_sent`.
  - Question columns: `origin`, `flag_reason`, `corrected_at`, `reports_dismissed_rate`, `source_data`; `reports.invalid_reason`.
  - `pg_trgm` + `similar_questions`; `question_edits` and `reports` already existed from M2.
  - Security advisors show only the expected items. 5 new integration tests (65 total).
  - `@anthropic-ai/sdk` 1.6.0 installed; key verified.

- 2026-11-09: M5 started (branch `m5-content-admin`). Dani's decisions: Opus 5.5 + Sonnet 5.5 mix, $50/month hard cap, global questions with no Australian bias. Admin email releasedani@gmail.com (changed from the work address at Dani's request).

- 2026-11-09: Tab icon (logo mark: SVG + favicon.ico + apple-icon), and the Buy Me a Coffee popup fixed on phones (it ran off the left edge; pinned inside the screen below 480 px). Checked with a local production build at iPhone 13, iPhone SE, desktop→400 px and desktop sizes. E2E 28 and visual pass.

- 2026-11-09: Buy Me a Coffee floating button (production builds only; hidden mid-round so it never covers Next; extra bottom room). Checked with a local production build at 375×667 and 390×844: it shows on the intro, final and How to play screens, is hidden on rounds and reveals, doesn't overlap Share or Save, and causes no page errors. E2E 28 and visual pass.

- 2026-11-09: Relative scoring approved by Dani and merged into `main`.

- 2026-11-09: **Hotfix (branch `hotfix-stored-ranges`, shipped to production with Dani's OK):** changel.app showed a blank page for anyone with a game saved in their browser from before the ranges change (old saved rounds had no `range`, so the page crashed). `loadPlay` now falls back to the full range, and boot re-fetches the real ranges, keeping the results. Two E2E regression tests (finished and half-played old saves) crash without the fix; all 28 E2E pass with it.
- 2026-11-09: Unused range columns dropped by Dani in the SQL editor; recorded as `supabase/migrations/*_drop_unused_end_value_bounds.sql` (`if exists`, safe to re-run).

- 2026-11-09: Relative scoring (branch `relative-scoring`): tolerance = ⅓ of the slider on every question. The prototype-parity sweep is replaced by scale-invariance tests. Unit 205, integration 60, E2E 26 pass. Every visual baseline was regenerated: the 0.1% diff threshold had hidden small number changes.
- 2026-11-09: Per-question ranges approved by Dani and merged into `main`.
- 2026-11-09: Per-question ranges made symmetric at Dani's request: one `max_change` per question (slider ÷k … ×k, "same" always centred). Migration `question_max_change`; all 20 seed questions re-set and imported; tests updated (unit 205, integration 60, E2E 26 + visual, baselines reviewed).
- 2026-11-09: Per-question guess ranges (branch `per-question-range`):
  - Code: `lib/range.ts` (range maths, rules, tolerance, ε, steps, ticks); `scoreRound`, `clampGuess` and `lib/slider` take the range. Rounds and answers carry `range`. Slider, Round ticks and Reveal pins are positioned on it.
  - Data: migration `question_guess_range` (columns + 2 constraints); bounds for all 20 seed questions, imported.
  - Tests: unit tests went from 177 to 206, including property tests over 3,000 random questions. Integration tests: 60, including API ranges, the full-range fallback and DB rejection of bad ranges. All 28 E2E pass. Visual baselines updated and reviewed (round, reveal and final screens changed; intro and how-to-play didn't).

- 2026-11-09: `account-copy` polish (one message in the sign-in form, no nested box, no duplicate Account label, Stats sign-in link) approved by Dani and merged into `main`.
- 2026-11-09: Copy polish 4 (Dani): the empty Stats page offers "or · Sign in to restore your stats" (link to /account) when not signed in.
- 2026-11-09: Copy polish 3 (Dani): removed the duplicate "Account" label above "Your account".
- 2026-11-09: Copy polish 2 (Dani): no box inside a box. The save/sign-in form now sits directly in the page card (a dashed divider on the final screen).
- 2026-11-09: Copy polish (Dani): the save/sign-in card holds one message (main line, "or", sign-in line); removed the extra paragraphs around it on /account and the final screen. Branch `account-copy`.
- 2026-11-09: M4 approved by Dani and merged into `main` (production at changel.app now has email sign-in).
- 2026-11-09: Dani's replay case: the server already kept the account's first score (checked: 323 intact), but the device kept showing the replay. Added `lib/game/sync.ts` (`refreshFromAccount` after sign-in reloads this device's plays from the account) + a banner explaining the outcome. New E2E `replay-merge.spec.ts` (account plays first → replay elsewhere → sign in → first score shown, replay discarded, 1 play in DB). 177 unit + 58 integration + 28 Playwright pass.
- 2026-11-09: Dani hit our per-IP sign-in email limit ("Slow down a little"; old preview still had 5/10 min). Rate-limit messages now say what tripped + seconds left (feeds the form's countdown). Vercel hadn't built the previous push; re-pushed.
- 2026-11-09: M4 feedback from Dani's preview test (sign-in + email change worked): save button under Share from game 1 (auto-open from game 2); Supabase's 60 s per-address email cooldown surfaced as a countdown (not a generic "too many emails"); per-IP email limit 10/10 min; `email_taken` (409) when an account changes to another account's email. Visual baselines refreshed (final screen). 173 unit + 58 integration + 27 Playwright pass.
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
