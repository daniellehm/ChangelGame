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
