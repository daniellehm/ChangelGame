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

### 2026-11-09: Upstash Redis in Singapore; limiter details
**Decision:** The Upstash database "changel" is in ap-southeast-1 (Singapore), not Sydney as first planned, so it sits with the functions and Supabase (Dani's region choice). Limits are sliding windows: guess 30/min, play 30/min, me 30/min and sync 10/min per player; puzzle 60/min and reveal 30/min per IP. Anonymous sign-ups are limited by Supabase, per forwarded IP. The limiter fails **open** if Redis is unreachable, and it's disabled when the Upstash env vars are empty (local dev, E2E and route integration tests). `tests/integration/ratelimit.test.ts` tests it against the real Redis.
**Why:** Same co-location reasoning as the database region. Failing open keeps the game up during a Redis blip. Test runs from one IP would otherwise hit the per-IP limits.

### 2026-11-09: E2E test players are tagged and cleaned up; test IPs
**Decision:** When the test clock is on (`ALLOW_TEST_CLOCK=1`, never in production) and the request carries the test-clock header, `/api/session` tags new anonymous users with `user_metadata.e2e = true`. A Playwright global teardown deletes exactly those users. E2E pages send a stable fake `x-forwarded-for` from the RFC 2544 test range, so local runs don't exhaust Supabase's per-IP sign-up limit for the developer's machine. Test games still add to the crowd-stat counters of the dev seed puzzles. That's harmless, since those puzzles are deleted before launch.
**Why:** The tests share the one Supabase project. Tagging makes cleanup exact without risking real players. Vercel overwrites `x-forwarded-for` (no spoofing in production), so the fake IP only matters locally.

### 2026-11-09: M4 login is email-only (no Google), sessions persist
**Decision:**
- **No Google sign-in** (Dani: "I don't want Google full stop"). Login is passwordless email only: a sign-in link and a 6-digit code in the same email, either of which works. This drops SPEC §5 `linkIdentity({ provider: 'google' })`, the Google OAuth setup and the launch-checklist item on Google consent-screen verification.
- **Players stay logged in** in a browser after signing in once. The session lives in the HTTP-only cookie (400-day max-age, refreshed as they play). Supabase's time-box and inactivity limits stay off, so a code is only needed on a new browser or device, or after signing out or clearing site data.
- DNS for changel.app is at **GoDaddy**. Claude adds only `changel.app` to the existing Resend team and creates one sending-only key restricted to it. Other Resend domains and keys are never touched.
**Why:** Dani's instructions. Email login covers everyone without a third-party account, and the persistent cookie avoids re-entering codes.

### 2026-11-09: changel.app DNS is hosted on Vercel (nameservers moved from GoDaddy)
**Decision:** There's no GoDaddy MCP, and GoDaddy's DNS API is limited to large accounts, so Dani pointed changel.app's nameservers at `ns1/ns2.vercel-dns.com`. The domain stays registered and billed at GoDaddy. Vercel serves the apex and `www` automatically (`www` → 308 → apex). Claude added the Resend records via the Vercel API: DKIM `resend._domainkey`, `send` MX + SPF TXT, `rsend` CNAME, and `_dmarc` (`p=none`). Vercel only accepted records once it had created the zone, about 12 minutes after nameserver verification. `docs/setup/godaddy-dns.md` (manual GoDaddy records) is superseded.
**Why:** Claude can then manage DNS directly. It's one edit at GoDaddy instead of eleven, and it can be reversed by restoring GoDaddy's nameservers.

### 2026-11-09: Sign-in UX and single-flight sessions
**Decision:**
- One reusable `SaveStreak` card (email → 6-digit code) in three modes: save (anonymous), sign in (no session) and change email. It appears on the final screen from the 2nd completed game for players without an account (never blocking), and on `/account`.
- `/account` shows "Sign in" when there's no session (visiting creates no user), "Save your streak" for anonymous players, and email + change email / export / sign out / delete (two-step) for accounts. Sign-out and delete clear every `changel:*` localStorage key (SPEC §5).
- Sign-in emails (Supabase templates in `supabase/templates/`) put the code first, with a link as the alternative. The link goes to `/auth/confirm` via `{{ .RedirectTo }}`, so it works on previews and in production once each origin is allow-listed.
- **Bug fixed:** concurrent `ensureSession()` calls could create two anonymous users (React dev double-effects on the returning-player auto-start; also two tabs at once). It's now single-flight per page, with a unit test and an E2E regression test.
**Why:** Matches SPEC §5 with Dani's email-only choice. The duplicate-user race broke guesses ("play not found").

### 2026-11-09: Save button from the 1st game; email cooldowns; one account per email
**Decision:**
- Players without an account get a **"Save your streak"** button under Share on **every** final screen (Dani's request). It opens one email form that covers both creating an account and signing in (the email decides). From the 2nd completed game the form opens by itself (SPEC §5). It never blocks play.
- Supabase allows **one email per address per 60 s**, which Dani kept hitting while testing. The API now returns "You can ask for another in N seconds", and the form shows a live countdown on "Email me a code" / "Send a new code" (60 s after each send). Our own per-IP limit is relaxed from 5 to 10 emails per 10 minutes.
- A **signed-in account can't change to an email another account uses** (409 `email_taken`). Before, it would silently have signed into that other account. This tells a signed-in player that the email is registered, which is acceptable; anonymous and signed-out flows still never reveal it.
- Games are never copied between accounts. Each play belongs to exactly one player. Signing into an existing account from an anonymous browser *moves* that browser's games into it (earlier-started wins on clashes). Signing out starts a fresh, empty anonymous player.
**Why:** Dani's feedback from testing M4 on the preview.

### 2026-11-09: One attempt per day per account, shown honestly after sign-in
**Decision:** Signing in can never let a replay count. The server already kept the **first** attempt on a same-day clash and discarded the other (`merge_players`). The bug was on the device: after signing in, the browser kept showing the replay's score. Now, after any sign-in (final screen or account page), `refreshFromAccount()` uploads offline games, then reloads this device's recent plays from the account (`/api/play` per stored date). The screen therefore shows the account's result. A banner then explains what happened, e.g. "You'd already played that day on your account, so your first score stands. This device's replay was discarded."
**Why:** Dani found that signing in after replaying today on another browser looked as if the replay counted. A browser can't know who someone is before they sign in, so it can't block the replay itself. Instead the replay is never kept and never shown as counting.

### 2026-11-09: Per-question guess ranges replace the fixed ÷1000 … ×1000 slider
**Decision:** Every question has a `max_change` k, its biggest plausible change in either direction. The slider runs ÷k … ×k (UN members: ÷8 … ×8), always centred on "no change", and scoring tolerance scales with the width. With k = 1000, everything is identical to the prototype. This departs from the prototype's scoring, at Dani's request.
- **Why symmetric:** the first version used separate low/high bounds (UN: 40 … 300). Dani pointed out that a lopsided slider shows players which way to go. With ÷k … ×k, "same" is always the middle, so the slider's shape gives away only the rough size of the change, never its direction.
- **Rules every question must pass** (`rangeProblems()` in `lib/range.ts`, run by the importer and mirrored by the DB constraint `questions_max_change_sane`):
  - k is between 1.05 (a sprint record) and 1000;
  - the real answer is at most 85% of the way from "same" to the end (so changes beyond about ×355 can't be used; none of the seed questions come close).
- **A range is required** once a question is past draft (`questions_max_change_required`). Questions without one fall back to the full range (only a test fixture uses this).
- **Scoring:** with K = log10 k and W = 2K, tolerance = min(0.75 × √(W ÷ 6), W ÷ 3), and points = 100 × (1 − |guess − answer| ÷ tolerance), floored at 0.
  - The wrong-way rule is unchanged.
  - Its "no change" threshold scales too: ε = 0.004 × W ÷ 6, so a narrow range isn't mostly dead zone.
  - Wider ranges forgive more, but less than in proportion.
  - On every valid question:
    - the exact answer is always 100;
    - the end of the slider furthest from the answer always scores 0;
    - slamming the slider to either end never scores more than 78.

  Property tests check all of these over 3,000 random valid questions.
- **Slider:** 1,200 steps end to end. Nudge = 1/120 of W, Page Up/Down = 1/60, pointer snap to 0 = 1/600 (the prototype's 0.005 / 0.05 / 0.1 / 0.01 at full width). Native `step="any"`, so exact 0 is always reachable; `lib/slider` does the rounding. The server clamps guesses to the question's range.
- **Ticks:**
  - Both ends are labelled at 2 significant figures (÷8, ×8). "same" is always in the middle.
  - Up to two round multipliers per side are shown (×2, ×5, ×10, ×100, ×1,000), only where they fit on a 250 px phone row without overlapping.
  - The reveal pins use the same positions. The readout's pop now fires on crossing a tick rather than a power of ten.
- **Seed content:** k was chosen for all 20 questions from plausibility, as round numbers (1.1, 2, 4, 5, 8, 10, 20 … 1000). Answers sit 32–84% of the way out.
- **For M5:** the generators must propose k *without seeing the answer*, so how far out the answer sits leaks nothing. Then the rules above are checked, and k is raised if the answer is too close to the end.
- **Cleanup:** the first version's `min_end_value`/`max_end_value` columns were dropped by Dani in the SQL editor on 2026-11-09 (migration file `drop_unused_end_value_bounds`).

**Why:** Dani: with ×1000 available on "UN members since 1945", a silly ×10 still scored well. With k = 8, the scores change (real answer ×3.8):

| Guess | Old score | New score |
| --- | --- | --- |
| ×2 | 63 | 33 |
| ×3 | 87 | 75 |
| ×5 | 84 | 71 |
| ×8 | 57 | 21 (the top of the slider) |
| ×10 | 44 | not selectable |

### 2026-11-09: Scoring is relative to the slider (replaces the √-width tolerance)
**Decision:** Points depend only on how far the guess is from the answer *as a share of the slider's length*: points = 100 × (1 − distance ÷ (⅓ of the slider)), floored at 0. A guess a third of the slider away scores 0 on every question, and each 1/300 of the slider costs 1 point. The setting is `RANGE.TOLERANCE_FRACTION` = 1/3 in `lib/config.ts`.
- Tiers, the wrong-way rule, the scaled ε, the symmetric ÷k … ×k ranges and the content rules (k between 1.05 and 1000, answer at most 85% of the way out) are unchanged.
- The guarantees still hold on every valid question: the exact answer scores 100, the far end scores 0, and slamming the slider to an end never scores more than 78.
- **This no longer matches the prototype on ÷1000…×1000 questions.** Those are now more forgiving in absolute terms, because their slider is wider. A question's k is therefore the one difficulty knob: a tighter k makes the same miss cost more.
- On average across the 20 seed questions, a miss of a given size now scores:

  | Off by | Prototype | Previous (√-width) | Now |
  | --- | --- | --- | --- |
  | ×1.1 | 89 | 82 | 84 |
  | ×1.25 | 83 | 69 | 75 |
  | ×1.5 | 71 | 52 | 63 |
  | ×2 | 53 | 30 | 48 |

  UN (÷8 … ×8, real ×3.8): ×2 scores 54, ×3 scores 83, ×8 (the top) 46.
- 1/3 was chosen as closest to the prototype's average feel while keeping the far end at 0. It must stay at most ½ to keep that guarantee.

**Why:** Dani: the √-width version felt harsh, and "it should be based on the slider width and how close you are relative to that."

### 2026-11-09: Buy Me a Coffee floating button
**Decision:** Dani's Buy Me a Coffee widget (`data-id` releasedani, colour #40DCA5, bottom right, 18 px margins, exactly the embed code's attributes) is on every page via `components/BuyMeACoffee.tsx` in the root layout.
- **How it loads:** the official script only initialises on window `DOMContentLoaded`, which has already fired when a client component mounts. The component inserts the same script tag and replays that event once the script has loaded.
- **Production builds only.** Dev, E2E and the visual baselines never load the third-party script.
- **Hidden mid-round** (`html[data-playing]`, set by Game). At phone size the fixed 64 px button covered the right end of "Next" on the reveal. It shows on the intro, final, How to play, Stats and Account screens, and `html.has-bmc` adds 110 px of bottom padding so the last button can scroll clear of it.
- **Phones:** the widget always opens its popup at a fixed 420 px wide, and it picks its phone or desktop layout only once, at page load. On narrow or resized screens the popup ran off the edge. Below 480 px, CSS pins `#bmc-iframe` 8 px from each side and above the button (`max-height: calc(100dvh - 104px)`). Checked at iPhone 13, iPhone SE and desktop-resized-to-400 sizes: it fits on screen and closes cleanly.
- **Security:** checked the widget script. It reads `document.cookie` only to set its own one-day `visited` cookie. Changel's session cookies are HTTP-only, so it can't read them. There's no CSP to update.

**Why:** Dani's request. Hiding it mid-round is a small visual departure, made so it never blocks play.

### 2026-11-09: Tab icon is the logo mark
**Decision:** The favicon is the header's logo mark: ink rounded square #16130f with the ⇅ arrows in #f6f1e7. It's drawn as SVG paths, not the font glyph, so it renders the same everywhere.
- Files use the Next.js file conventions: `app/icon.svg` (modern browsers), `app/favicon.ico` (16 + 32 px PNGs, for older browsers), and `app/apple-icon.png` (180 px, full-bleed square, because iOS rounds it).
- The PNGs were rendered from the SVG.

**Why:** Dani's request.

### 2026-11-09: M5 pipeline: models, spend cap, global mix
**Decision (Dani):**
- **Models:**
  - Claude Opus 5.5 writes researched questions and does the independent cross-check (the steps that catch wrong numbers).
  - Claude Sonnet 5.5 does everything else: source-quote check, like-for-like, topic safety, fact quality, wording for data-backed questions, and the blind `max_change` proposal.
  - Both use the server-side refusal fallback (`fallbacks: "default"`).
- **Hard cap of $50 a month on Claude spend.** Every call is metered: tokens × price, plus web searches at $10 per 1,000. No new call starts once the month's spend reaches the cap, and the admin page warns. The game keeps serving what's already scheduled.
- **Global questions only, with no Australian bias.** This drops SPEC §8's "at least one AU question a week" balance rule. Country versions may come later.

**To fit the cap** (my estimate for this model mix was about $65 a month at the spec's settings):
- aim for about 70% data-backed questions (numbers from World Bank / Our World in Data, about half the cost of researched ones);
- cap web searches per call;
- run checks at low effort and the Opus steps at medium effort;
- generate only 20% more candidates than needed.

That targets about $35–45 a month. The one-time cold-start fill (about $55) spreads over two months.
**Why:** Dani's choices (models, cap, region). The cost levers are mine.

### 2026-11-09: M5 pipeline: how the nightly job runs
**Decision:**
- **State lives in the database.** A candidate's status (draft → verified / flagged → scheduled → used) and its `checks` record what's done, so any run can stop and the next one resumes.
- **Hops.** Vercel Hobby runs a cron once a day, and one function call can't do a cold start's ~200 candidates. `/api/cron/content` (02:00 UTC) therefore works in **time-boxed hops** of about 4 minutes.
  - Each hop takes a lease on the night's `content_runs` row (an atomic update, so two hops never run at once).
  - At the end of a hop, if work remains and the run is under its hop limit and the spend cap, it triggers the next hop: a request to its own production URL with `CRON_SECRET`, sent via `after()`.
  - Admin "Run now" uses the same entry point.
- **QStash** would be more robust, but needs the Upstash account's QStash token. That's an account-wide secret, not a "changel" resource, so we don't use it.
- **Tests** inject fake Claude and data-source clients, so the pipeline logic is tested for free. Real-model behaviour gets one small, paid smoke run (the planted wrong number) only once the key is in.

**Why:** It works within the Hobby plan, survives timeouts and crashes mid-run, and touches no non-changel secrets.

### 2026-11-09: M5: batching, duplicate check, data-backed share
**Decision:**
- **Data-backed questions are world-level only** (52 curated World Bank / OWID series), per Dani's "global, no country bias". That's roughly one question per series, about 50 in total. So in the long run most questions are researched. Data-backed series are spread in at about one per day while they last.
- **To keep researched questions inside the $50 cap,** Opus researches **5 questions per call** (up to 8 web searches shared across them) and cross-checks in batches. The smoke run cost about $0.09 per drafted question, against about $0.27 estimated for one at a time.
- **Duplicate check.**
  - Data-backed: a duplicate is the same dataset series (source + id + entity).
  - Otherwise: trigram similarity over 0.6 to an existing prompt gets a quick Sonnet "same measure?" call, instead of failing outright.
  - Why: the spec's plain over-0.6 rule rejects different questions (solar vs wind share 0.80, wheat vs rice yields 0.74, measured).
- **Range menu** for `max_change`: 1.05, 1.1, 1.2, 1.3, 1.5, 2, 3, 4, 5, 8, 10, 20, 30, 50, 100, 200, 500, 1000. Round numbers keep the slider's end labels readable.

**Why:** It fits Dani's cap and "global only" choice, and the duplicate check stops rejecting genuinely different questions.

### 2026-11-09: M5 checks: one combined review, order, fail-safe
**Decision:**
- **One Sonnet "review" call** returns three verdicts: like-for-like, topic safety and fact quality. That's cheaper than three calls, and SPEC §8 doesn't require separate calls.
  - The code parts of those checks still run first for free: blocklist, money label, fact length.
  - Researched facts may add other true, documented information. Data-backed facts may only use the two dataset values.
- **Order** is cheapest first, and any failure skips the remaining paid checks. A flagged question records every result so far in `questions.checks` and a summary in `flag_reason`.
- **Fail safe.** These all flag the question rather than letting it through:
  - a source page that can't be fetched (or is a PDF, not read in v1);
  - an estimate the cross-check can't find;
  - an unusable model answer.
- **The cross-check is Opus with web search, in batches of 5, and is never shown the values,** matching SPEC §8's "without seeing the draft's numbers"; a unit test enforces it. It also runs on data-backed questions.

**Why:** Accuracy over volume: a wrong number going live is worse than a held-back good one, which Dani can approve from the Flagged queue.

### 2026-11-09: M5 scheduler details
**Decision:**
- **Cold start.** The 7-day rule (SPEC §8) means an empty database can only fill days 7–30 on the first night. Days 0–6 get puzzles only as the window moves, so "30 days ready ahead" is reached after one week of nightly runs. Before launch this costs nothing. At launch, the dev-seed / launch week can be scheduled by hand from the admin Upcoming page, or the launch date set at least 7 days after the first run.
- **When the balance rules can't be met:** a day more than 9 days out stays empty (tomorrow's candidates may include the missing trap or big mover). Within 9 days it takes the best day it can, marked `relaxed` and logged. Five different categories always hold.
- **At most 2 data-backed questions per day,** so the roughly 50 world-level series last and days stay varied.
- **Round order** within a day is a fixed shuffle by question id, so the trap isn't always round 1.

**Why:** These follow from SPEC §8 plus Dani's global-only choice; this is my best reading of "fills 30 days" given the 7-day rule.

### 2026-11-09: M5 admin: server-checked, client-rendered
**Decision:**
- Admin pages are client components that load everything from `/api/admin/*`.
- Every admin route calls `requireAdmin`: the session must be signed in, not anonymous, with an email in ADMIN_EMAILS (comma-separated, case-insensitive; empty means nobody). Otherwise it returns 401 / 403.
- Data is read only by the server, with the service role. There's no client database access, so the "in RLS" part of SPEC §11 is met by keeping every admin table closed to clients (RLS on, no policies) rather than with an admin RLS policy.
- `/admin` is noindex.
- Pages are client-rendered because route handlers can refresh an expired session cookie and server components can't. Server-rendered admin pages would show "signed out" an hour after sign-in.

**Why:** It's simplest with the existing session plumbing, and admin data never leaves the server without the email check.

### 2026-11-09: M5 reports: details
**Decision:**
- **A report is about the question the player actually answered** (`guesses.question_id`), so a same-day swap can't misdirect it. It must be on a round they locked in; the button only appears on reveals.
- **The habitual-reporter rule** (ignore players who report more than 30% of their rounds) applies only once a player has **10 or more rounds**. Taken literally, a first-time player reporting their first round has reported 100% of their rounds and would be ignored. The rule is worked out live from each reporter's full history, so `reports.valid` only records the locked-in check.
- **"Players who saw that round's reveal"** = guesses on that question.
- **Local-only (offline) plays don't show the button**, because a report needs the server play.
- **The queue is computed on demand** (SQL `report_queue`), so the badge and page are always current. Nothing is pulled or emailed automatically.
- **A "Corrected" note shows on the reveal** for any question edited after it went live (`corrected_at`, set by the editor).

**Why:** These are the simplest readings of SPEC §8 that avoid the literal-rule trap and misattributed reports.

### 2026-11-09: M5 rerun fallback, same-day pull, alert emails
**Decision:**
- **Rerun source:** the most recent original (non-rerun) ready puzzle at least 365 days earlier (SPEC §8). Until the game is a year old there is none, so it uses the oldest original puzzle rather than serve nothing. The rerun is stored as a ready `puzzles` row with `rerun_of`, so every route serves the same rounds and players see "Rerun".
- **When a rerun is created:** on the first lookup of a date whose window is open **by the real clock** with no ready puzzle. Tests use a simulated clock, so they can never create reruns on real dates (two existing tests ask about a real near-future date).
- **Same-day pull:** the round's question is swapped atomically (`swap_round`). Players who already answered keep their stored guess and points, and the pulled question gets `corrected_at`, so their reveal says "Corrected". Players mid-game get `question_changed` on that round and reload it uncached (`?fresh=`).
- **Alert emails go only to ADMIN_EMAILS, and only when the game is at risk:**
  - fewer than 7 ready days;
  - the nightly run failing two nights in a row;
  - a rerun being served.

  Each kind is sent at most once per 20 hours, and everything else stays on the admin banner. Tests set `CHANGEL_NO_ALERT_EMAIL=1`, so they record alerts without sending.

**Why:** SPEC §8, plus the simplest safe choices where it's silent (the first year of reruns; never letting tests touch real dates or email Dani).

## 2026-11-09: Content checks tuned after the first real runs (M5 review)

**Context:** Dani's first "Run now" flagged 6 of 8 questions, and re-checking the 20 prototype questions showed the review failing true, neutral facts. Typical cases:
- CO₂ levels and the minimum wage were called "political";
- facts failed because a small detail "can't be confirmed";
- a verdict was given before the reasoning ("on reflection the fact holds, so this fail is a mistake").

The numbers themselves are already guarded by the source quote and the blind cross-check.

**Decision:**
- **Review schema puts the reason before the verdict** (and the source check puts quotes before "supported"), so the model reasons first.
- **Review prompt:**
  - like-for-like stays strict (when unsure, fail), and an ambiguous scope now fails;
  - safety is strict on taking sides in live political disputes, but neutral measurements (CO₂, temperatures, wages, prices, populations, tax rates) are fine;
  - the fact fails if it's false, misleading, an implied cause or an unsupported superlative, but not merely because a small detail can't be confirmed.
- **Source check:**
  - reads .csv/.txt data files served as `application/octet-stream`;
  - finds the page's exact figure when the stored value is rounded to 3 s.f. (1,864 stored as 1,860).
- **Duplicate detection ignores retired questions**, so a rejected near-copy can't block a good question forever (migration `similar_questions_skip_retired`).
- **Re-checking:** pipeline questions that failed only on the old review (fact, like-for-like, safety) were requeued once for a re-check.
- **Editing a live question:** changing only its sources or category doesn't mark it "Corrected"; changes to the question, numbers, slider range or fact still do.
- **Re-checked scheduled questions:** a scheduled question that passes a re-check stays scheduled and is stamped verified. One that fails stays on its day with the reason shown (pull it to take it off).
- **Approved questions on a day:** an approved or passing question already on a day becomes 'scheduled', never 'verified', so the scheduler can't put it on a second day.

**Why:** these are false rejections. Each one costs a replacement question (about $0.30) and starves the schedule. Everything that guards correctness stays strict.

## 2026-11-09: Filling days inside the 7-day lead (one-off, at Dani's request)

**Context:** the nightly job only fills days 7–30 ahead, so 13–16 Nov (after the 4 dev days) would get reruns.

**Decision:**
- `npm run content:fill-days -- FIRST LAST` runs the real pipeline (same generator, checks, scheduling rules and cap) with only those dates open.
- The nightly job's 7-day rule is unchanged.
- The 20 prototype questions were fact-checked, with two sources each and corrections where the numbers were off, via `npm run content:apply-edits` (the editor's save, logged as "fact-check (Claude, for Dani)").

**Why:** Dani asked for the first days to be filled with strong, checked questions now.

## 2026-11-09: Admin edits are trusted; days can be filled by hand (Dani's request)

**Decision:**
- **Saving in the editor:**
  - doesn't run the automatic checks;
  - counts as approval: flagged or draft becomes verified (or scheduled if it's on a day), and any failed-check note is cleared;
  - still refuses what the game can't play (answer outside the slider, values ≤ 0, end year not after start).
- **"Run checks (second opinion)"** in the editor runs the full checks and shows the result, and never changes the status.
- **Upcoming:**
  - an empty day (today or later) has "Choose questions…" (pick 5 ready questions, in that order) and "Auto-fill" (the scheduler's balance rules, relaxed if needed);
  - "Swap…" opens the same picker instead of asking for an id;
  - same-category clashes are shown as a warning, not blocked.
- **Scripts** (`content:apply-edits`) still run the full checks.

**Why:** Dani's edits should be trusted, and the nightly job's assignment was invisible: nothing showed how a question gets onto a day.

## 2026-11-10: Stats and account page tweaks (Dani's request)

**Decision:**
- **Stats:** the "Your stats are saved to your account…" note is gone. The "Stats are kept on this device. Add your email…" prompt for signed-out players stays.
- **Stats, last 30 days:** each played day is a button that opens a pop-up with that day's total and each round's result (emoji, label, points), plus the question when this device still has that game saved. It closes with ×, Escape or a tap outside, and focus returns to the square.
- **Account:**
  - the "Export my data" button is removed. The `/api/account/export` endpoint stays, so a data request (e.g. under the Privacy Act or GDPR) can still be answered by hand;
  - the "Delete account" heading above "Delete my account" is removed.

- **Delete account** now has 20px more space above it, since it lost its heading.
- **Buttons:** "Back to today's Changel" (at the bottom of every page) is filled ink, like Play. The account's "Change email", "Sign out" and "Delete my account" stay outlined (Dani tried them filled and preferred this).
- **Last 30 days:** each played square is coloured by that day's average round (total ÷ 5), with the round result cut-offs and colours (green Nailed it, yellow Close, orange Meh, red Way off). The label says the result too.
- **Stats on another device:** the result bar, last-30-days strip and day pop-up also use the account's history. `/api/me` returns each recent play's rounds (tier, points, question prompt). Before this they only used games stored on this device, so a new device showed the account's totals but an empty strip and an all-zero result bar.
- **Copy:** questions don't always end in the present (e.g. 2009, 2012), so "One number from the past. How big is it now?" became "A real number from one year. How big was it years later?". The How to Play page and its description were changed the same way.

**Why:** Dani's call on look and feel (a visual departure from the M4 screens, approved by her).

## 2026-11-10: M6 6.1: share sheet and `?r=` links

**Decision:**
- **`?r=` code** `<number base36>-<total base36>-<5 digits>` (e.g. `c-ac-01040`): the puzzle number, the total and each round's result. The total isn't an answer, and the OG image needs it. Malformed or impossible codes are ignored, e.g. a total that doesn't fit the rounds' results.
- **Phones** (a share API and a coarse pointer): Share opens the OS share sheet with the first two lines of the share text plus `url: https://changel.app/?r=<code>`, so the chat unfurls this result's image. Closing the sheet does nothing; any other failure copies instead.
- **Desktops** copy the exact SPEC §10 text, which still ends in plain `changel.app` (the spec's exact format). Only the share sheet carries the `?r=` link.
- **Landing:** the home page reads `?r=` on the server. It sets the OG/Twitter title and `og:image` = `/api/og?r=<code>`, and shows "A friend scored N 🟩🟨… Can you beat it?" on the intro. A returning player opening a shared link sees the intro too, so the challenge isn't skipped. If the friend played a different puzzle, it says "A friend playing #N scored … Try today's."
- **The home page is now rendered per request** (it reads the query string). Re-check speed in 6.9; it was static before.
- `metadataBase` is `https://changel.app`.

**Why:** SPEC §10 asks for one-tap sharing that unfurls with the result; these are the simplest shapes that do it.

## 2026-11-10: M6 6.2: share images

**Decision:**
- **`/api/og`** (Node runtime, `next/og`) renders 1200×630 PNGs: the game's card (paper background, ink border, hard offset shadow, logo), plus either a shared result (puzzle number, score/500, five coloured squares, "Can you beat it?") or, without a valid code, the default "How much did it change?" card.
  - Squares use the share emoji's colours (🟩 `--g`, 🟨 `--y`, 🟧 `--o`, 🟥 `--r`), with no text in them; the score is in words beside them.
- **Fonts:** static TTFs of Bricolage Grotesque 800 (opsz 96) and JetBrains Mono 700 are committed in `assets/fonts/` (OFL). Satori can't read the site's WOFF2 or variable fonts. `outputFileTracingIncludes` ships them with the route.
- **Caching:** an image depends only on its code, so it's `public, s-maxage=31536000, immutable`.
- **Every page** has the default card as its OG/Twitter image (`summary_large_image`); a shared result overrides it.

**Why:** SPEC §10. One renderer for both cards keeps the look consistent.

## 2026-11-10: M6 6.3: crowd line and today's trap

**Decision:**
- **Data:** `round_crowd(date)` (migration `round_crowd`) counts each round's plays, wrong-way and nailed guesses, and average points, from that date's plays.
  - It only counts guesses on the question currently in the round, so a same-day swap doesn't mix two questions. A rerun day starts its own count.
  - `GET /api/crowd?date=` serves it CDN-cached for 60 s; it holds no answers or user data. Days whose window hasn't opened get 403.
- **Reveal line** (under the pins, above the fact; `lib/game/crowd.ts`):
  - under 50 plays: "Too early for crowd stats on this one.";
  - else if ≥ 20% went the wrong way: "N% of players went the wrong way";
  - else if under 25% nailed it: "Only N% nailed this";
  - else "N% of players nailed this".

  The line reserves its height while loading, so the fact doesn't jump. Offline, it stays blank.
- **Today's trap** (final screen, above the stats): the round with the lowest average points, shown only once every round has 50 plays, as "Today's trap: <question>".
- The game refetches crowd stats after each locked round (cheap: CDN-cached).

**Why:** SPEC §10 gives the examples and the 50-play threshold. The 20% and 25% cut-offs pick whichever fact is more striking, and they're constants in `CROWD`.

## 2026-11-10: M6 6.4: first-party, cookieless analytics

**Decision:**
- **No visitor cookie.** SPEC §8 says `visitor_id` cookie, but §11 requires cookieless analytics (no banner). Visits use a daily-rotating salted hash of IP + user agent + UTC date, like Plausible. It's stable within a day, so one row per visitor per day, and no one can be followed across days. Retention (D1/D7) comes from plays (player ids), which need no cookie.
- **`visits`:** written server-side on every game-page load, after the response (`runAfter`).
  - Country comes from `x-vercel-ip-country`, the puzzle date from `x-vercel-ip-timezone` (else UTC), device from the user agent.
  - Referrer is stored as a domain only, and dropped for our own site, Do Not Track or GPC.
  - `from_share` is set when there's a valid `?r=`.
  - Bots, link unfurlers and headless browsers (our tests, Lighthouse) are skipped.
- **`events`** holds only what the browser or auth knows: `share_clicked` {method: share_sheet, clipboard or manual}, `signup_prompt_shown` (once per day per device), and `signup_completed` (server-side, the first time an account confirms an email; reserved test domains like example.com are skipped). SPEC §11's other events come from existing data:

  | SPEC event | Source |
  | --- | --- |
  | `puzzle_viewed` | visits |
  | `play_started` | plays |
  | `round_locked` | guesses |
  | `play_completed` | plays.completed_at |
  | `share_landing` | visits.from_share |
  | `streak_broken` | derived from plays |

- **`daily_metrics`:** one jsonb row per finished puzzle day (`compute_daily_metrics`). It holds visits by share, device, country and referrer; players, new players and completions; locked rounds by position; score buckets; average and wrong-way by round; shares by method; sign-up prompts and sign-ups.
  - It's written by the existing nightly cleanup cron, before old anonymous players are purged, so their games still count. That avoids a third cron on the Hobby plan.
  - A day is final once its window closes (D+1 12:00 UTC). Missing days in the last 14 are back-filled.
  - Raw visits and events are deleted after 400 days; daily rows stay.
- **No Plausible or PostHog for now.** The Analytics page reads Changel's own database (SPEC §8), so an outside tool is optional. Its account and key move to "Needs from Dani: optional".

**Why:** this is cookieless and first-party, and nothing is shown per person.

## 2026-11-10: M6 6.5: admin Analytics page

**Decision:**
- **`/admin/analytics`** has every panel in SPEC §8, a 7 / 30 / 90 days / all time picker, and a "Download CSV" button on each panel. Charts use Recharts 3.10.1 (admin bundle only).
  - The colours passed the dataviz validator on `--card`, in this order: blue `#2f7cf6`, red `#ff5a36`, green `#2bb673`. Single series are blue.
  - The validator's warnings (green contrast; green and red close for deutan colour blindness) are covered by legends, tables and CSV, so colour never carries meaning alone.
- **Data:**
  - finished days come from `daily_metrics`;
  - open days, and any finished day not written yet, are computed live (cached 5 min in the function instance);
  - `analytics_live(today)` (security definer, service role only) gives daily, weekly and monthly actives and the previous periods, totals, email accounts, retention cohorts by first-play week (D1, D7, D30 = played exactly N days after the first game; cells stay blank until the cohort is old enough), and current-streak buckets;
  - questions come from `question_stats`, plus "carried on" = locked the next round (or finished) ÷ locked this round.
- **Time zone:** days are puzzle dates, which are already each player's local day. "Today" on the tiles is Sydney's date. The SPEC's AEST re-bucketing toggle is deferred to v1.1: it would re-bucket plays by `started_at` and adds little for one admin.
- Ranges never start before `LAUNCH_DATE`.
- **Funnel and growth bars** are tables with inline bars, scaled to the largest row, so every number is printed.
- Nothing lists emails or individual players; the API test asserts no "@" anywhere in the response.

**Why:** SPEC §8. The time-zone toggle is the one simplification.

## 2026-11-10: M6 6.6: Sentry

**Decision:**
- **Server:** `instrumentation.ts` starts `@sentry/nextjs` 11.9.0 only when `SENTRY_DSN` is set, and exports `onRequestError = captureRequestError`. Errors only, no tracing.
- **Browser:** `instrumentation-client.ts` listens for uncaught errors and rejected promises. It fetches `@sentry/browser` (a separate chunk) only the first time one happens, and only when `NEXT_PUBLIC_SENTRY_DSN` is set. Nothing is added to the game page's initial JavaScript (DECISIONS item 11, "Sentry is lazy-loaded"). There's no replay or tracing, and only the dedupe and linked-errors integrations are on.
- Versions were chosen at least two weeks old (11.11.0 was too new).
- No source-map upload yet (it needs a Sentry auth token in the build). Stack traces show minified names until it's added.

**Why:** SPEC §11 plus the JS budget. It's inert until Dani creates the Sentry project.
