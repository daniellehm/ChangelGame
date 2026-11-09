# Decisions

Choices the spec doesn't cover, or where it was unclear or contradictory. Newest at the bottom. Format: date, decision, why. Entries marked **(proposed)** are waiting for Dani to confirm or override.

---

### 2026-11-09: Package manager is npm, Node 22 LTS
**Decision:** Use npm (lockfile `package-lock.json`). Pin Node to 22.x via `engines` and `.nvmrc`, and use Node 22 on Vercel too. Use TypeScript 5.9, not 7.
**Why:** Node 20 reached end-of-life in April 2026, and Vitest 5 needs Node 22.12+. Node 22.18 is already installed via nvm, and it is LTS until April 2027. TypeScript 7 is the new native compiler, and Next.js tooling support for it isn't proven yet.

### 2026-11-09: "Close" verdict colour is `#c99a12`, not `--y`
**Decision:** The verdict bar for the Close tier uses `#c99a12`, exactly as in the prototype. It becomes a token, `--y-strong: #c99a12`. `--y` (`#f3c13a`) stays for other uses.
**Why:** The prototype is the visual source of truth, and the spec's token table conflicts with it here. The prototype's darker yellow makes white text readable.

### 2026-11-09: Extra tokens for hard-coded prototype colours
**Decision:** Add the prototype's literal colours as tokens in `app/globals.css`: `--ink-2: #3b352d` (body copy), `--slider-down-mid: #cfd8e6` and `--slider-up-mid: #f2d3c9` (slider track), `--y-strong: #c99a12`, and `--on-accent: #fff` (verdict text). The values don't change.
**Why:** The spec wants dark mode to be "a token swap only" (v1.1). Literal colours outside tokens would break that.

### 2026-11-09: Fonts include the Bricolage `opsz` axis
**Decision:** Load Bricolage Grotesque through `next/font/google` as a variable font with the `opsz` axis, and weights 400/600/800. Load JetBrains Mono at 500/700.
**Why:** The prototype requests `opsz 12..96`. Without the axis, the heavy headings render visibly differently, and the M1 screenshot match would fail.

### 2026-11-09: M1 uses the prototype's 20-question pool and its seeded daily selection
**Decision:** M1's hard-coded data is the prototype's `POOL`, with the same `seeded(20261109)` shuffle and `EPOCH`. For a given date, the app then shows the same 5 rounds as the prototype. The fixture is dev-only and is deleted in M2, when the API replaces it.
**Why:** M1 is accepted by side-by-side screenshots. Identical content on both sides is the only way to get a fair comparison.

### 2026-11-09: Screens not in the prototype are designed in prototype style
**Decision:** The header menu, How to play, Stats, Account and About are not in the prototype. They will be built from the existing tokens and components (card, `.cat` labels, `.stats` tiles, `.btn`). They are excluded from the screenshot-match acceptance.
**Why:** The spec lists these screens, but there's nothing to match pixel for pixel.

### 2026-11-09: Vercel plan, build for scale
**Decision:** Design for scale from the start, and don't contort the design to fit Hobby limits. Long-running work (the nightly content pipeline) is split into short, chained steps with Upstash QStash/Workflow, so no single function run is long. Dani will upgrade to Vercel Pro when a milestone needs it (cron more often than daily, longer functions, or commercial use). We will flag it in "Needs from Dani" at that point.
**Why:** Dani's instruction: "build with scalability and if i need a bigger vercel plan we can do that". Chained steps scale on any plan and survive one-off failures.

### 2026-11-09: Spec fixes accepted by Dani (go-ahead on the 2026-11-09 plan)
Each item is applied in the milestone where it comes up.
1. **Cold start vs the 7-day rule (M5).** The nightly pipeline starts at least 7 days before `LAUNCH_DATE`. The M5 cold-start acceptance becomes "night 1 fills days 7–36", and days 0–6 are covered by the emergency path (item 2).
2. **Fallback when a day has no puzzle (M5).** First build an emergency puzzle from the reserve of 10 verified questions. Only use a "Rerun" of a puzzle from 365+ days earlier when the reserve can't cover it. Add a `puzzles.rerun_of` column, so a rerun reuses the old puzzle's rounds without breaking "a question appears in at most one puzzle".
3. **Significant-figure sanity check (M2/M5).** Round values to 3 significant figures at import, except the `sec`, `time` and `yrs` formats. The ">3 significant figures" check then applies to the rounded value.
4. **Missing schema (M2).** Add `flagged` to the question statuses. Add a `reports` table with `POST /api/report`, and a `checks` jsonb column on `questions` for audit results.
5. **`ANTHROPIC_API_KEY` (M5).** It is a server-only env var on Vercel (the nightly pipeline needs it), not "draft script only".
6. **Guess grace period (M3).** A guess is accepted if its play was started inside the date window and `now < window end + 6 h`. Starting a play still needs the window to be open. Answers to past puzzles aren't secret, so the grace period gives nothing away.
7. **Local-only fallback (M3).** Peeking in this mode is accepted. When local plays sync, the server re-scores them from `guess_log`, marks them `source = 'local'`, and leaves them out of `round_stats` and the crowd percentages.
8. **Same-day pulls (M2/M5).** `guesses.question_id` stores the question that was actually answered. `POST /api/guess` takes the `question_id` the client showed, and returns `409 question_changed` if the round has since been swapped.
9. **Magic link on phones (M4).** The sign-in email has both the magic link and a 6-digit code ({{ .Token }}), and the app accepts either.
10. **Anonymous sign-up (M3).** Sign-in goes through our own `POST /api/session` route: Turnstile verify, then the Upstash rate limit, then `signInAnonymously` with `@supabase/ssr` cookies. The limit is 30 per hour per IP (not 5), because mobile carriers put many users behind one shared IP.
11. **JS budget (M3/M6).** No `supabase-js` in the game page's client bundle (all calls go through our API routes). Sentry is lazy-loaded. Plausible is chosen over PostHog for analytics.
12. **Colour contrast (M6).** M1 matches the prototype exactly. In M6, the verdict text on the green, orange and Close bars moves to `--ink`, and `--muted` darkens slightly to pass 4.5:1 on `--bg`, to meet WCAG AA and Lighthouse ≥ 95.
13. **Pipeline orchestration (M5).** Use Upstash QStash/Workflow to chain the steps (see "Vercel plan" above).
14. **Supabase auth config (M3).** The MCP can't change auth settings or read the secret key. Dani provides these (see PROGRESS "Needs from Dani").
15. **Puzzle #1 date.** `LAUNCH_DATE` is an env var read by `lib/config.ts`. M1 uses the prototype's epoch, 2026-11-09, so its numbers match the prototype.
16. **Admin authorisation (M5).** Admin checks happen server-side against `ADMIN_EMAILS`. RLS can't read env vars, and admin routes use the service role anyway.

### 2026-11-09: Formats `aud` and `pct`, and no "trillion"
**Decision:** `aud` follows the prototype's `usd` rules with an `A$` prefix (cents still show as `¢`). `pct` shows the value to 3 significant figures plus `%` (e.g. `3.46%`). `big` keeps the prototype's behaviour above 1e12, so the slider can read "1290 billion". All formatting is pinned to the `en-US` locale.
**Why:** The spec names `aud` and `pct` but doesn't define them. A "trillion" step would have changed the prototype's slider readout, and the prototype is the reference for copy. Pinning the locale makes server and client render the same, matching how the prototype looks in an en-US/en-AU browser.

### 2026-11-09: Local mirror details (M1 game screens)
**Decision:**
- There is one extra localStorage key, `changel:v1:active`. It holds the date of an in-progress play, so a game started before midnight resumes on that same puzzle after midnight. It is only honoured within ±1 day.
- `changel:v1:play:<date>` stores the puzzle (no answers) plus each locked `RoundResult`, so the final screen renders offline. Records older than 45 days are pruned.
- `changel:v1:stats` stores a compact entry per completed play (`date`, `number`, `tz`, `total`, `tiers`). Played/streak/best/average are derived from it. Streaks use `lib/streaks.ts`, the same pure function the server will use in M3, including the date-line n−2 rule.
- A play counts as complete as soon as round 5 is locked, not when "See my score" is tapped (the prototype waits for the tap). A refresh in between can no longer lose the game.
- Returning players skip the intro on page load (SPEC §9). If the date rolls over while someone is on the intro or the final screen, the new puzzle is shown on the intro (an "offer"), not dropped straight into round 1.
- A tiny inline script hides the server-rendered intro before first paint for returning players, so they don't see it flash.
**Why:** The spec defines these behaviours but not their storage. These are the simplest shapes that satisfy SPEC §2/§4/§5. The streak function is shared, so client and server can't disagree.

### 2026-11-09: Header menu button is 34 px (hit area 44 px)
**Decision:** The menu button is drawn at 34 × 34 px, the same as the logo mark, and an invisible `::after` extends its touch area to 44 px.
**Why:** A visible 44 px button would make the header taller than the prototype's and push every screen down, which breaks the screenshot match. The spec's 44 px minimum is for the slider. The larger hit area still meets it here.

### 2026-11-09: Font fallbacks and weights mirror what the prototype actually renders
**Decision:**
- `next/font` runs with `adjustFontFallback: false`, and its fallbacks are the prototype's stacks (`system-ui, sans-serif` / `monospace`).
- Bricolage text that is "bold" (700) is set to 800: `h1`–`h3`, `b`, `strong`, `.btn`, `.nudge button`, `.toast`. JetBrains Mono keeps 700, because it has a real 700 face.
**Why:** Found by the parity test. (1) → and ≈ aren't in either font's subsets. The prototype falls back to `system-ui` for them, but `next/font`'s auto fallback is a metric-adjusted Arial, which drew a thin arrow and shifted the year cards. (2) The prototype's Google Fonts request declares only 400/600/800 faces, so the browser renders every 700 at 800. With both fixed, all 14 parity screenshots differ by 0 pixels. Cost: no metric-matched fallback during font swap. The fonts are preloaded, so any layout shift is rare. We'll re-check it in the M6 Lighthouse pass.

### 2026-11-09: Design pass before M2. The prototype becomes a baseline, not a constraint
**Decision:** With M1 approved, Dani asked for UX improvements beyond the prototype: less text, keep the chunky weights, and more fun/funky. The ideas are trialled in an interactive playground first. Whatever Dani picks becomes the new visual reference: the parity test then guards the new look instead of the prototype, and each departure is listed here.
**Why:** Dani's instruction overrides "match the prototype exactly". The playground lets Dani judge ideas by playing them rather than from descriptions.

### 2026-11-09: Design pass, Dani's picks from the playground
**Decision:** Build into the app:
1. **Trimmed copy**: shorter intro ("One number from the past. How big is it now?") and rules. Buttons read "Play #N", "Lock in", "Next" / "Score" and "Share". The readout is "+140% · ≈ 75,935". The source line has no "Source:" prefix, and the countdown reads "Next in h:mm:ss".
2. **Round screen**: keep the "Round 1 of 5" label (Dani: "we should still show what round we are in"), and move − / + beside the big multiplier as 44 px round buttons. The separate nudge row is removed.
3. **Live progress**: each finished progress segment takes its round's tier colour.
4. **Sticker look**: the category is a tilted sticker (colour and tilt fixed per category). Primary buttons get a 4 px `--up` hard shadow and press flat, and ghost/secondary buttons get an ink shadow. The verdict bar and final title are tilted stickers, and the year cards and stat tiles get ink borders, with a dashed border for the unknown year.
5. **Motion & juice**: pins drop with an overshoot, points and the final score count up, the result emoji flip in one by one, confetti plays on "Nailed it", and the multiplier pops (plus an 8 ms vibration where supported) each time the slider crosses a ×10/÷10 boundary. All of it is off under `prefers-reduced-motion`.
**Why:** Dani tried each idea in the playground and chose these.

### 2026-11-09: Prototype parity test replaced by visual regression baselines
**Decision:** `tests/e2e/parity.spec.ts`, which diffed against `reference/prototype.html`, is removed together with pixelmatch/pngjs. `tests/e2e/visual.spec.ts` uses Playwright's `toHaveScreenshot` to check 6 key screens at 390 and 1280 px against committed baselines, with reduced motion so animations settle. The baselines are macOS (`-darwin`) for now; CI will need Linux baselines when it is set up.
**Why:** After the design pass the app deliberately differs from the prototype, so parity is no longer the goal. The check that matters now is that the approved look doesn't drift.

### 2026-11-09: About merged into How to play
**Decision:** The About page is removed, and its content is now "The deal" on How to play: same five for everyone, new puzzle at midnight, free with no account, every number sourced. `/about` permanently redirects to `/how-to-play`, and the menu now has How to play, Stats and Account. How to play is rebuilt as a worked example round (scored with the real `lib/scoring`), three step tiles, tier stickers and the deal list.
**Why:** Dani asked to drop About, fold it into How to play, and make that page more fun and less wordy.

### 2026-11-09: Region is Singapore for both database and functions
**Decision:** The Supabase project "Changel" (`icnxbpyoldnlpgxsgmcn`) is in ap-southeast-1 (Singapore), not Sydney as assumed. Dani chose to keep it and move Vercel functions to Singapore (`sin1`), both in the project settings and in `vercel.json`. All the earlier `syd1` mentions are superseded.
**Why:** A Supabase region can't be changed after creation. Putting functions next to the database keeps each guess to one short round trip. Singapore costs Australian players ~50 ms and is about the same or better for Asia, the US and the UK.

### 2026-11-09: Migrations applied via the Supabase MCP, mirrored in the repo
**Decision:** Each migration is written to `supabase/migrations/<version>_<name>.sql`, where `<version>` is the one the database records, and applied with the Supabase MCP `apply_migration`. `list_migrations` must match the files in the repo. No local Supabase stack for now (it needs Docker).
**Why:** It's the simplest setup that keeps a reviewable migration history in git without new tooling. We can add the CLI later for local testing.

### 2026-11-09: Supabase key format
**Decision:** `NEXT_PUBLIC_SUPABASE_ANON_KEY` holds the new-style publishable key (`sb_publishable_…`), and `SUPABASE_SERVICE_ROLE_KEY` holds the secret key (`sb_secret_…`). The env var names stay as written in the spec.
**Why:** Supabase recommends the new key formats (they can be rotated independently). Keeping the spec's names avoids churn.

### 2026-11-09: Question slugs, derived puzzle numbers, dev seed
**Decision:**
- `questions.slug` (unique, kebab-case) is the stable key between `content/questions.csv` and the DB. `npm run content:import` inserts new slugs and updates only the content fields of existing ones. It never changes status or verification, and it rounds values to 3 significant figures (except sec/time/yrs) per decision item 3.
- The puzzle number is computed from `LAUNCH_DATE` in the API. `puzzles.number` is kept nullable and unused: dropping it was blocked by Claude Code's permission check on destructive DDL, and the empty column does no harm.
- `npm run content:seed-dev` schedules the 20 prototype questions as 4 ready puzzles (2026-11-09…12) in the prototype's order, using `lib/content/dev-seed.ts`. Seed questions stay `draft` until the M5 checks run on them. **Launch checklist: delete the dev puzzles first.**
**Why:** Re-runnable imports are needed for an editable CSV source of truth. A stored puzzle number goes stale if the launch date moves. 20 questions can only fill 4 days because a question appears in at most one puzzle. Real scheduling is M5.

### 2026-11-09: `POST /api/reveal` for M2 (and the M3 offline fallback)
**Decision:** M2 adds a stateless `POST /api/reveal { date, position, guess_log }`. It checks the date window, then returns that one round's answer and score, and stores nothing. The M2 client uses it on "Lock in" until M3's session-based `/api/guess` replaces it. M3's local-only fallback then reuses it, instead of putting every answer in the puzzle response (this refines decision item 7).
**Why:** It's needed to switch the client to the API in M2 (task 2.7) before sessions exist. It keeps answers out of the page bundle and the puzzle response. Peeking costs one deliberate request per round, which was already accepted for the offline mode. Rate limits arrive in M3.

### 2026-11-09: M3 auth setup (Dani's choices) and how sign-up is rate-limited
**Decision:**
- Supabase auth settings are applied by Dani from a dashboard checklist (option b), not via a personal access token. That avoids sharing an account-wide key.
- Turnstile moves to M6 (launch hardening). M3 keeps a slot for it in `POST /api/session` but doesn't require it.
- `POST /api/session` signs players in anonymously on the server with the **secret** key, forwarding the player's IP in the `Sb-Forwarded-For` header. Supabase then applies its anonymous sign-in limit (30/hour) **per player IP**, not per Vercel server, which would otherwise throttle everyone. This needs "IP Address Forwarding" enabled in Supabase (checklist). Supabase's own per-IP limit replaces our planned Upstash limit for sign-ups. Upstash still covers guesses and puzzle reads.
**Why:** Dani asked to use the checklist and to defer Turnstile. Supabase's docs say server-side sign-ins are rate-limited by the server's IP unless `Sb-Forwarded-For` is sent with a secret key and forwarding is enabled.

### 2026-11-09: Guess transaction and stats split
**Decision:** `POST /api/guess` scores in TypeScript (`lib/scoring.ts`, the only scoring code), then calls `public.submit_guess`. That Postgres function (execute: service_role only) locks the play row and, in one transaction, rejects duplicates and out-of-order positions, inserts the guess, increments `round_stats` (server-scored plays only), and completes the play on round 5. The `player_stats` view holds games played, best, average and tier counts. **Streaks are computed in TypeScript** from the player's plays with `lib/streaks.ts`, because the date-line n−2 rule needs each play's time zone.
**Why:** Keeps one scoring implementation while getting real transactional guarantees, which a double-tap can't break. Streak logic in SQL would duplicate `lib/streaks.ts` and risk the two disagreeing.

### 2026-11-09: Client modes and offline sync
**Decision:**
- On Play the client calls `/api/session`, then `/api/play`. If either fails (sign-in off, cookies blocked, rate-limited, offline), the game runs in **local mode**: each round is revealed via `/api/reveal` and saved in localStorage.
- Server-mode lock-ins use `/api/guess`. On a refresh, the server's answered rounds win. Edge cases:
  - `out_of_order`: another tab moved ahead, so the game resyncs from the server.
  - `question_changed`: the round was swapped, so the game reloads the rounds and keeps what's answered.
  - `unauthorized`: the session was lost mid-game, so the game finishes in local mode.
- Finished local plays are uploaded with `POST /api/sync` the next time a session exists. The server re-scores from `guess_log`, stores `source='local'` (no crowd stats), ignores the upload if it already has a play for that date (server wins), and refuses anything older than 7 days. Partly played local games aren't synced.
- Server mode shows `/api/me` stats (games played, streak, best) on the final screen, with local stats as the fallback.
**Why:** It implements SPEC §5's fallback with the M2 reveal design, so the game always works while server records stay authoritative and honest.
