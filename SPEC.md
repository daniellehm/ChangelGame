# Changel — Build Spec v1

Nov 9, 2026 · @Dani

## 1. Overview

Changel is a free daily web game at **changel.app**: five rounds a day, each showing a real number from the past, and the player guesses how many times bigger or smaller it is now. Everyone gets the same puzzle on the same calendar day. v1 must ship with no-login play that remembers history, optional login to sync across devices, a correct local-midnight reset, and a content pipeline that guarantees a new verified puzzle every day.

**Goals for v1**

1. Match the prototype's look and feel exactly (section 9), production-quality on mobile first.
2. Zero-friction play: no account, no signup wall, history kept in the browser and on the server.
3. Optional login (magic link or Google) that merges anonymous history into the account.
4. Never run out of puzzles: at least 30 days scheduled ahead, with an alert below 14.
5. Built to spread: share text, per-result social images, "% of players got this" stats.

**Out of scope for v1:** native apps, paid tiers, multiplayer, unlimited/practice mode (design for it, don't build it), leaderboards beyond friends-free global stats.

**How to use this spec with Claude Code**

- Save this doc as `SPEC.md` in the repo root, and the prototype HTML as `reference/prototype.html`. The prototype is the source of truth for visuals, copy and scoring.
- Build milestone by milestone (section 12). After each milestone, run the tests and check off its acceptance criteria before starting the next.
- Where this spec is silent, choose the simplest option and note it in `DECISIONS.md`.

## 2. Game rules and scoring

Each daily puzzle has exactly 5 rounds, max 100 points each, 500 total. Scoring runs on the server and lives in one pure, unit-tested module (`lib/scoring.ts`) shared with the client for previews.

**A round**

1. Show category, question, start year + start value, end year + "?".
2. Player drags a slider whose value is `g = log10(multiplier)`, range −3 to +3 (÷1000 to ×1000), step 0.005, starting at 0. Fine-tune buttons nudge by ±0.05. Live readout shows the multiplier (×2.4 / ÷3.1), the % change, and the implied end value.
3. "Lock it in" submits the guess. The server returns the true end value, the score, the tier and the round's global stats.
4. Reveal: end value fills in, verdict bar, two pins (YOU and REAL) animate on a track, fun fact, source link, Next.

**Score** — with `a = log10(end / start)`, `SPAN = 0.75` and a no-change threshold `ε = 0.004`:

```latex
\text{points} = \max\left(0,\ \mathrm{round}\left(100\left(1 - \frac{|g - a|}{0.75}\right)\right)\right)
```

If both `|g| > ε` and `|a| > ε` and their signs differ, the round scores 0 and is marked **Wrong way**. Off by 2× scores about 60; off by about 5.6× scores 0.

| Tier | Rule | Emoji | Label |
| --- | --- | --- | --- |
| Nailed it | ≥ 90 | 🟩 | Nailed it |
| Close | 65–89 | 🟨 | Close |
| Meh | 30–64 | 🟧 | Meh |
| Way off | < 30 | 🟥 | Way off |
| Wrong way | wrong direction | 🟥 | Wrong way! |

**Final screen titles** (by total): ≥ 420 Time traveller 🔮 · ≥ 320 History buff · ≥ 200 Not bad, not great · ≥ 100 Living in the past · else Have you been asleep since 1970?

**Rules that must hold**

- One attempt per puzzle per player. Refreshing mid-game resumes at the next unplayed round; answered rounds are locked.
- A started puzzle stays the same puzzle even if the player crosses midnight mid-game.
- Keep these constants (SPAN, ε, tier cut-offs, slider range) in `lib/config.ts` so they can be tuned after launch without touching logic. Changing them later must not rescore past games: store points at submit time.

## 3. Tech stack and architecture

Next.js on Vercel, with Supabase for the database and auth. Supabase's anonymous sign-in gives every visitor a real user id with no login, which makes the anonymous-to-account upgrade a single call.

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js (App Router) + TypeScript, strict mode | Server components for the shell, client component for the game |
| Styling | Plain CSS with the prototype's CSS variables (`app/globals.css`) | Port the prototype CSS nearly verbatim; no UI kit |
| Fonts | `next/font/google`: Bricolage Grotesque, JetBrains Mono | Self-hosted, no layout shift |
| Database | Supabase Postgres with Row Level Security | Migrations in `supabase/migrations` |
| Auth | Supabase Auth: anonymous sign-in, magic link email, Google OAuth | `@supabase/ssr` for cookie sessions |
| Email | Resend as Supabase's SMTP provider | Branded magic-link email from hello@changel.app |
| Hosting | Vercel, domain changel.app | Preview deploy per PR |
| Scheduled jobs | Vercel Cron | Daily stats rollup, content-buffer alert |
| Share images | `next/og` (ImageResponse) | `/api/og?...` per result |
| Analytics | PostHog (cookieless mode) or Plausible | Events in section 11 |
| Errors | Sentry | Client + server |
| Tests | Vitest (unit), Playwright (e2e) | Run in CI on every PR |

**Request flow.** The page loads the shell and today's puzzle *without answers*. Each guess is POSTed to the server, which scores it, stores it, and only then returns the true value. Answers for a round never reach the browser before that round is locked, so the puzzle can't be read from the network tab.

**Repo layout**

```
app/
  page.tsx              # today's game
  archive/page.tsx      # past puzzles (v1.1)
  stats/page.tsx        # player stats
  admin/...             # content tools (allowlisted emails)
  api/puzzle/route.ts
  api/guess/route.ts
  api/me/route.ts
  api/og/route.ts
  api/cron/*/route.ts
components/             # Intro, Round, Reveal, Final, Slider, ShareButton
lib/scoring.ts  lib/dates.ts  lib/format.ts  lib/config.ts  lib/supabase/*
supabase/migrations/   supabase/seed.sql
content/questions.csv  # source of truth for the question bank, imported by script
reference/prototype.html
```

## 4. Daily reset and time zones

The puzzle resets at **local midnight in the player's own time zone**, like Wordle. A puzzle is identified by a calendar date (`puzzle_date`, `YYYY-MM-DD`), and a player in Sydney and a player in London both play the puzzle for their own local date. All date logic lives in `lib/dates.ts` with full unit tests.

**Client**

- Local date = `new Intl.DateTimeFormat('en-CA', { timeZone }).format(now)`, where `timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone`. Never derive the date from UTC.
- Puzzle number = days from `LAUNCH_DATE` (config, e.g. `2026-12-01`) to the local date, plus 1. The same date gives the same number everywhere.
- Countdown on the final screen counts to the next local midnight.
- On `visibilitychange` and every 60 s: if the local date has changed and the player hasn't started today's game, load the new puzzle. If they are mid-game, keep the started puzzle until they finish (section 2).
- Send `puzzle_date` and `tz` with every request; store `tz` on the player for stats and reminder emails later.

**Server: which dates may be served**

A date D exists somewhere on Earth from D 00:00 at UTC+14 to D 24:00 at UTC−12. So the server serves puzzle D only while:

```latex
(D - 1)\ 10{:}00\ \text{UTC} \le \text{now} < (D + 1)\ 12{:}00\ \text{UTC}
```

Requests outside that window get `403 puzzle_not_available`. This blocks peeking at future puzzles by changing the device clock while still serving every real time zone. Accept a guess for date D only inside the same window.

**Edge cases to test**

| Case | Expected |
| --- | --- |
| Player in UTC+14 (Kiribati) at 00:01 | Gets the new puzzle, server accepts it |
| Player in UTC−11 (Samoa US) at 23:59 | Still on the old puzzle, guesses accepted |
| Device clock set 3 days ahead | Server refuses; client shows "Check your device clock" |
| Daylight-saving switch night (e.g. Sydney first Sunday in October) | Countdown correct, no double or skipped puzzle |
| Starts at 23:58, finishes at 00:03 | Finishes the puzzle they started; the new one is offered after |
| Flies Sydney → LA (date goes backwards) | Already-played date shows their result, not a replay |
| Flies LA → Sydney (skips a date) | Streak is not broken by the skipped date (rule below) |

**Streaks** count consecutive *puzzle numbers* played, not calendar days elapsed. A streak continues if the player's previous play was puzzle n−1, or n−2 when their time zone changed in between (the date-line case). Compute streaks on the server from stored plays; the client never trusts its own count when online.

**Caching.** `GET /api/puzzle?date=D` (no answers) can be cached at the edge for 5 minutes once its window is open. Never cache responses containing answers or user data.

## 5. Player identity: no-login play, optional login

Every player is a Supabase user from their first game. They start **anonymous** (no email, nothing asked) and can upgrade to a **permanent** account later without losing anything. Their history is stored on the server and mirrored in `localStorage` so the game still works if the network or cookies fail.

**Anonymous play**

1. On the first click of "Play", call `supabase.auth.signInAnonymously()` (protected by Cloudflare Turnstile, invisible mode, to stop bot sign-ups). Don't create users on page load, so bounces don't create rows.
2. The session lives in an HTTP-only cookie via `@supabase/ssr`. Returning visitors are recognised automatically.
3. Every locked-in round is written to the server *and* to `localStorage` under versioned keys: `changel:v1:play:<puzzle_date>` and `changel:v1:stats`.
4. If anonymous sign-in fails (private mode, blocked cookies, offline), the game falls back to local-only mode, scoring on the client with the same `lib/scoring.ts`. In that mode the puzzle response includes answers, but only after the window check, and the play is synced the next time a session exists.

**Upgrading to an account** (the "Save your streak" prompt)

- Show it on the final screen after the **2nd** completed game, and in the header menu at any time. Never block play behind it.
- Methods: email magic link and Google. Use `supabase.auth.updateUser({ email })` / `linkIdentity({ provider: 'google' })` so the anonymous user *becomes* the permanent user: same user id, so no data moves.
- **If that email or Google account already exists** (they signed up on another device): before redirecting, the server stores a short-lived `merge_token` (15 min, single use) tied to the current anonymous user id. After sign-in, `POST /api/merge` with the token moves the anonymous plays to the account:
  - for each `puzzle_date`, if the account already has a play, keep the **earlier-started** one (the first attempt is the honest one) and discard the other;
  - recompute stats; delete the anonymous user.
- Sign out returns the player to a fresh anonymous state and clears the local cache.

**Housekeeping**

- Nightly cron deletes anonymous users with no plays older than 7 days, and anonymous users inactive for 400 days.
- Account settings page: change email, export my data (JSON), delete my account (hard delete of user + plays).

## 6. Data model

Seven core Postgres tables, plus `merge_tokens` and `question_edits`. Questions are reusable content; a puzzle is a date with 5 ordered questions; a play is one player's attempt at one puzzle.

| Table | Key columns | Constraints and notes |
| --- | --- | --- |
| `players` | `id` (= `auth.users.id`), `tz`, `created_at`, `last_seen_at` | One row per auth user, created by a trigger on `auth.users` insert |
| `questions` | `id`, `category`, `prompt`, `start_year`, `start_value`, `end_year`, `end_value`, `format`, `fact`, `source_name`, `source_url`, `source_url_2`, `region`, `tags[]`, `status`, `verified_by`, `verified_at`, `notes` | `start_value > 0`, `end_value > 0`, `end_year > start_year`; `status` in draft / verified / scheduled / used / retired; `region` in global / AU / US / UK |
| `puzzles` | `puzzle_date` (PK), `number`, `theme` (nullable), `status` | `status` in draft / ready; only `ready` puzzles are served |
| `puzzle_rounds` | `puzzle_date`, `position` (1–5), `question_id` | PK (`puzzle_date`, `position`); a question appears in at most one puzzle |
| `plays` | `id`, `player_id`, `puzzle_date`, `started_at`, `completed_at`, `total`, `tz_at_play` | Unique (`player_id`, `puzzle_date`) |
| `guesses` | `play_id`, `position`, `guess_log`, `points`, `tier`, `wrong_way`, `created_at` | PK (`play_id`, `position`); insert-only, never updated |
| `round_stats` | `puzzle_date`, `position`, `n`, `avg_points`, `pct_wrong_way`, `pct_nailed`, `histogram` (jsonb, 24 buckets over the log range) | Updated incrementally on each guess, recomputed nightly |

`format` values, matching the prototype's formatter: `big` ("8.2 billion"), `int`, `usd`, `aud`, `sec`, `m`, `yrs`, `time` (h:mm:ss), `pct`. Add new formats in `lib/format.ts` with a test each.

**Player stats** come from a SQL view `player_stats`: games played, current streak, max streak, best total, average total, tier counts. The stats page and final screen read this view.

**Row Level Security**

- `questions`, `puzzle_rounds`: no direct client access. Only server routes (service role) read them, which is how answers stay hidden.
- `plays`, `guesses`: a player can `select` only their own rows. All writes go through the API with the service role.
- `round_stats`, `puzzles` (ready only, date window open): readable via the API, not directly.
- `merge_tokens` (`token`, `anon_user_id`, `expires_at`, `used_at`): service role only.

## 7. API

Six route handlers. All take and return JSON, validate input with Zod, and return errors as `{ error: { code, message } }`.

| Method + path | Auth | Purpose | Returns |
| --- | --- | --- | --- |
| `GET /api/puzzle?date=D` | none | Today's puzzle, no answers | `{ date, number, theme, rounds: [{ position, category, prompt, start_year, start_value, end_year, format }] }` |
| `POST /api/play` | session | Start (or resume) a play for date D | `{ play_id, answered: [{ position, guess_log, points, tier, end_value, fact, source }] }` |
| `POST /api/guess` | session | Lock in one round | `{ points, tier, wrong_way, end_value, actual_log, fact, source_name, source_url, stats: { n, avg_points, pct_wrong_way, pct_nailed } }` |
| `GET /api/me` | session | Player stats + recent plays | `player_stats` view + last 30 plays |
| `POST /api/merge` | session + token | Merge anonymous history after login | `{ merged: n, kept: n }` |
| `GET /api/og` | none | Share image for a result | PNG, 1200×630 |

**`POST /api/guess` rules**

- Body: `{ play_id, position, guess_log }`. Clamp `guess_log` to \[−3, 3\].
- Reject unless: the play belongs to the session user, its date window is open (section 4), `position` is the next unanswered round, and that round has no guess yet. Duplicates return `409 already_answered` with the stored result, so double taps are harmless.
- Score with `lib/scoring.ts`, insert the guess, update `round_stats`, and set `completed_at` and `total` on round 5, all in one transaction.

**Rate limits** (Upstash Redis or Vercel KV): 30 guesses/min per user, 60 puzzle reads/min per IP, 5 anonymous sign-ups/hour per IP.

**Cron routes** (protected by `CRON_SECRET`): `/api/cron/stats` nightly round-stats recompute; `/api/cron/content-check` daily buffer check (section 8); `/api/cron/cleanup` nightly anonymous-user purge.

## 8. Question content: fully automatic, human review optional

Questions are generated, fact-checked and scheduled automatically every night, with no human step needed. A question that passes every automatic check goes live on its own. A question that fails any check is held back and never published without a human. Every auto-approved question sits in the calendar for **at least 7 days before it goes live**, so Dani can optionally look over what's coming and pull anything. At 5 questions a day the game uses about 1,825 a year.

**Nightly pipeline** (`/api/cron/content`, runs at 02:00 UTC)

1. **Top up.** Count `ready` days ahead. If fewer than 30, generate enough candidates for the gap plus 20% (some will fail checks).
2. **Generate.** Two kinds of candidate, mixed:
   - **Data-backed (target at least 50%):** code pulls both values straight from trusted datasets: Our World in Data, World Bank API, ABS, FRED, UN data. Claude only writes the prompt wording and the fun fact. The numbers come from the API, not the model.
   - **Researched:** Claude (with web search) proposes a question with values, years, a fact and two source URLs from different publishers.
3. **Auto-verify.** Each candidate must pass every check below. Any failure → `status=flagged`, with the reason stored.
4. **Auto-approve.** All checks pass → `status=verified`, `verified_by='auto'`, with the check results saved for audit.
5. **Schedule.** Fill dates from day 7 to day 30 ahead using the balance rules. Never schedule an auto-approved question less than 7 days out. Mark those puzzles `ready`.
6. **Keep a reserve.** Always keep at least 10 spare verified questions unscheduled, for same-day swaps.

**Automatic checks** (all must pass)

| Check | How | Fails when |
| --- | --- | --- |
| Source support | Server fetches each source URL, extracts the text, and a separate Claude call is asked: does this page state value X for year Y? Answer must quote the sentence or table cell | Either value isn't supported by at least one fetched source (data-backed questions pass by construction) |
| Independent cross-check | A second Claude call, without seeing the draft's numbers, estimates both values from its own research | Its estimate differs by more than 15% from either value |
| Like-for-like | Rule + model check that both values use the same measure and units; money says nominal or inflation-adjusted in the prompt | Mixed measures, missing money label |
| Sanity | Code | Values ≤ 0, end year ≤ start year, change outside ÷1000 to ×1000, more than 3 significant figures |
| Duplicate | Trigram similarity of the prompt against all past questions | Similarity > 0.6 to any existing question |
| Topic safety | Blocklist + model check | Death tolls, tragedies, living private people, active political fights |
| Fact quality | Code + model | Fact over 140 characters, or not supported by a source |

**Admin portal** (`/admin`, allowlisted emails only, works on mobile). Everything that needs a human decision goes into a queue here instead of an email. The home page shows a count badge for each queue. Reviewing is optional: if you never open it, the game keeps running.

| Page | What it shows | Actions |
| --- | --- | --- |
| Reports | Questions over the 10% report rate: report rate, count, reasons, player notes, sources | Edit, Pull (swap in a reserve question), Dismiss (won't re-queue unless the rate rises 10 more points) |
| Upcoming | The next 30 days, 5 questions per day, each with sources and check results | Pull, Swap, drag to reorder, Preview the day as a player |
| Question editor | Every field of one question, with a live preview of the round and its edit history | Save (re-runs the automatic checks), Retire. Editing a live or past question adds the "Corrected" note |
| Flagged | Candidates that failed a check, with the reason | Fix and approve, Delete |
| Question bank | All questions, filterable by status, category, region, difficulty | Open in editor; see avg points, wrong-way %, report rate per question |
| Health | Ready days ahead, last nightly run, check pass rate, Claude spend this month | Run the nightly job now |

**Analytics page** (`/admin/analytics`). Player and game stats computed from Changel's own database, so it works without opening PostHog. Date-range picker (7 / 30 / 90 days / all time) and a time-zone toggle (player-local or AEST). Charts with Recharts; every chart has a "Download CSV" button.

| Panel | Metrics | Chart |
| --- | --- | --- |
| Headline tiles | Players today, DAU / WAU / MAU, total players, logged-in accounts, average score today, share rate today | Tiles with change vs previous period |
| Players over time | Daily players, split new vs returning | Stacked area by day |
| Where people drop off | Visited → pressed Play → locked round 1 → 2 → 3 → 4 → 5 → shared, with % lost at each step | Funnel, for today or the selected range |
| Scores | Average total per day; score distribution (0–500 in 50-point buckets); average points per round position | Line, histogram, bars |
| Hardest and easiest questions | Each question's avg points, wrong-way %, completion rate after that round, report rate | Sortable table, links to the editor |
| Retention | D1 / D7 / D30 return rate by signup week | Cohort grid |
| Streaks | Distribution of current streaks; players with a 7+ and 30+ streak | Bars |
| Accounts | Anonymous → account conversion rate; sign-ups per day by method (email, Google) | Line |
| Growth sources | Visits from share links (`?r=`) vs direct vs referrer domains; shares per completed game by method | Bars |
| Geography and devices | Players by country (from Vercel's geo header) and time zone; mobile vs desktop | Table + bars |

**How it is measured**

- New table `visits` (`visitor_id` cookie, `puzzle_date`, `country`, `device`, `referrer`, `from_share`, `created_at`): one row per daily visit, written server-side when the page loads, so people who leave before pressing Play are counted. Respect Do Not Track by skipping the referrer.
- The funnel uses `visits` → `plays` → `guesses` → `share_clicked` events, matched by user per `puzzle_date`. Store `share_clicked` in an `events` table (`user_id`, `name`, `props` jsonb, `created_at`) rather than only in PostHog.
- A nightly cron writes a `daily_metrics` row per date (all tile and chart numbers) so the page loads in under 1 s. Today's numbers are computed live and cached for 5 minutes.
- Only aggregates are shown; no page lists individual players' emails or histories.

**Safety nets once live**

- **Report button** on every reveal ("Something wrong with this?"). Players pick a reason (number looks wrong / wrong year / fact is wrong / other) plus an optional note. Reports are measured as a **report rate = valid reports ÷ players who saw that round's reveal**:

  Questions are **never pulled automatically**. When a question's report rate passes **10%** (with at least 10 valid reports, so 2 reports out of 15 early players doesn't trigger it), add it to the Reports queue in the admin portal. No email is sent, and the question stays live until the admin acts on it.

  A report only counts as **valid** if the player locked in that round, hasn't already reported it (one per player per question), and isn't a habitual reporter (players who report more than 30% of rounds they play are ignored). Keep the 10% rate and 10-report minimum in `lib/config.ts`.
- **Same-day pull:** pulling today's question swaps in a reserve question for players who haven't reached that round yet. Players who already answered keep their score, and the reveal shows a "Corrected" note.
- **Corrections** never rescore past games. Every edit is logged in `question_edits`.
- **Rerun fallback:** if a date somehow has no ready puzzle when its window opens, serve a puzzle from at least 365 days earlier, labelled "Rerun".

**Balance rules** (scheduler): no two questions from the same category on one day (unless it's a theme day); at least one "trap" (|log10 change| < 0.1) daily; at least one big mover (beyond ×10 or ÷10) daily; at least one AU question a week; once play data exists, mix easy and hard using each question's `avg_points`.

**Theme days (optional):** `puzzles.theme`, e.g. "Money Monday", shown as a chip on the intro screen.

**Alerts** appear as a banner on the admin portal home: fewer than 14 ready days, more than 40% of a night's candidates failing checks, or a failed nightly run. Email is sent only when the game itself is at risk: fewer than 7 ready days, or the nightly job failing two nights in a row.

**Cost:** roughly 4 Claude calls per candidate (draft, source check ×2, cross-check). Log tokens per run in a `content_runs` table and show monthly spend in the admin.

**Seed data:** import the 20 questions in `reference/prototype.html` as candidates and run them through the same checks. Several are approximate and may be flagged.

## 9. Design system and screens

Keep the prototype's look exactly: warm paper background, heavy black type, one chunky card with a hard offset shadow, red for up and blue for down. `reference/prototype.html` is the visual source of truth; match it pixel for pixel at 390 px wide before adding anything.

**Tokens** (`app/globals.css`)

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#f6f1e7` | Page |
| `--ink` | `#16130f` | Text, borders, buttons, card shadow |
| `--muted` | `#7a7166` | Labels, years, metadata |
| `--card` | `#fffdf8` | Card surface |
| `--line` | `#e3dacb` | Quiet borders, empty progress |
| `--up` | `#ff5a36` | Increase, current round |
| `--down` | `#2f7cf6` | Decrease |
| `--g` / `--y` / `--o` / `--r` | `#2bb673` / `#f3c13a` / `#ff8a3d` / `#e5484d` | Tier verdicts |

- **Type:** Bricolage Grotesque 400/600/800 for everything; JetBrains Mono 500/700 for numbers, labels, years, countdowns. Question 25 px/800, multiplier 56 px/800 with −2 px tracking, final score 72 px/800.
- **Shape:** card 2 px ink border, 20 px radius, `5px 5px 0` ink shadow; buttons 14 px radius, press moves down 2 px; max content width 520 px.
- **Motion:** reveal pops in (0.35 s), pins slide to place (0.6 s, `cubic-bezier(.2,.8,.2,1)`). Respect `prefers-reduced-motion`.
- **Dark mode (v1.1):** invert `--bg`/`--ink`, keep accent colours. Design tokens so this is a token swap only.

**Screens**

| Screen | Contents |
| --- | --- |
| Header | Logo (⇅ mark + "Changel"), puzzle # and date, menu (How to play, Stats, Account, About) |
| Intro | "How much did it change?", 3 rules, theme chip if any, Play button. Skipped for returning players (go straight to round 1) |
| Round | Progress bar (5 segments), category, question, start/end year cards, multiplier readout, slider with ticks (÷1000, ÷10, same, ×10, ×1000), ± nudges, Lock it in |
| Reveal | Verdict bar + points, YOU/REAL pins, **"X% of players got this direction wrong"** line, fact, source link, Next |
| Final | Score / 500, emoji grid, title, per-round rows, played/streak/best, Share, "Save your streak" (section 5), countdown |
| Stats | Played, win-ish metrics (avg, best), current and max streak, tier distribution bar, last 30 days calendar strip |
| Admin | Reports, Upcoming, Question editor, Flagged, Question bank, Health, Analytics (full spec in section 8). Same tokens as the game, denser layout |

**Slider accessibility:** keyboard arrows move 0.005, Page Up/Down move 0.1, `aria-valuetext` reads the multiplier ("2.4 times bigger"). Touch target at least 44 px. Snap to exactly 0 within ±0.01 so "no change" is easy to hit.

## 10. Sharing and virality

The share result is the main growth channel, so it must be one tap, spoiler-free and recognisable in a group chat at a glance.

**Share text** (exact format):

```
Changel #12 ⇅ 412/500
🟩🟨🟩🟥🟩
changel.app
```

- On mobile, use `navigator.share({ text, url })`; elsewhere copy to the clipboard and show the "Copied" toast. If both fail, show the text in a selectable box (the prototype's fallback).
- The shared URL is `https://changel.app/?r=<code>`, where `<code>` encodes puzzle number + per-round tiers (no answers). Its page `<meta og:image>` points to `/api/og?r=<code>`, which renders the score, the emoji grid and the logo on the paper background, 1200×630.

**Built-in hooks**

- **Crowd line on every reveal:** "38% of players went the wrong way" or "Only 9% nailed this". Hide until at least 50 plays for that round; show a neutral line before that.
- **Daily best surprise:** on the final screen, call out the round the crowd did worst on today ("Today's trap: the 100m record").
- **Streak protection:** streaks are the retention engine, so show the streak prominently and make "Save your streak" the login pitch.
- **Archive (v1.1):** past puzzles playable at `/archive/<number>`; they don't count toward streaks.

**SEO and launch basics:** title "Changel — the daily game about how much the world changed", meta description, OG/Twitter tags, `/how-to-play` page, sitemap. Submit to the daily-game directories (Listdle, Alldle, Playlin, Dle Hunt) on launch day.

## 11. Performance, accessibility, privacy, analytics, security

**Performance:** Lighthouse mobile at least 95 for performance and accessibility. First paint under 1.5 s on 4G. JS for the game page under 120 KB gzipped. Guess round trip under 300 ms p95 (deploy Supabase in the region nearest most players, and use Vercel's matching region).

**Accessibility:** WCAG 2.2 AA. Full keyboard play. Tier colours always paired with a word (never colour alone). Focus moves to the verdict on reveal and to the question on a new round. Screen-reader announcement of the result.

**Privacy:** anonymous play stores no personal data beyond a random user id, time zone and plays. Email only when the player chooses to log in. Privacy policy and terms pages written for the Australian Privacy Principles and GDPR basics. Cookieless analytics, so no cookie banner is needed for analytics; the auth cookie is strictly necessary.

**Analytics events:** `puzzle_viewed`, `play_started`, `round_locked` (position, points, wrong\_way), `play_completed` (total), `share_clicked` (method), `share_landing` (from `?r=`), `signup_prompt_shown`, `signup_completed` (method), `streak_broken`. Weekly view: D1/D7 retention, completion rate, share rate per completed game.

**Security:**

- Answers never sent before a round is locked (except local-only fallback, section 5).
- Service-role key only on the server; never in client bundles (add a CI check that greps the build output).
- Admin routes check the session email against `ADMIN_EMAILS` on the server and in RLS.
- Zod validation on every input; rate limits as in section 7; Turnstile on anonymous sign-up.

**Environment variables:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LAUNCH_DATE`, `ADMIN_EMAILS`, `CRON_SECRET`, `RESEND_API_KEY`, `TURNSTILE_SECRET`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `ANTHROPIC_API_KEY` (draft script only), `SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`. Provide `.env.example`.

## 12. Testing, milestones and acceptance

Build in six milestones, each shippable to a preview URL. Don't start the next until the current one's tests pass and its acceptance criteria are ticked.

**Tests that must exist**

- Unit (Vitest): `scoring` (exact hits, 2× off, wrong way, no-change threshold, clamp), `dates` (every row of the section 4 edge-case table, using fixed clocks and time zones), `format` (each format), streak calculation including the date-line case.
- Integration: guess route rejects out-of-order, duplicate, wrong-user and out-of-window guesses; merge keeps the earlier-started play.
- E2E (Playwright, mobile viewport): full game anonymous → refresh mid-game resumes → finish → share copies the exact text → next day (mocked clock) offers a new puzzle and streak = 2 → log in by magic link (test inbox) → stats persist on a second browser context.

**Milestones**

1. **Scaffold + visuals.** Next.js app, tokens, fonts, all game screens ported from the prototype, running on hard-coded data. *Accepted when* side-by-side screenshots match the prototype at 390 px and 1280 px.
2. **Database + puzzle API.** Migrations, RLS, seed import, `GET /api/puzzle`, date window. *Accepted when* answers are absent from every network response before lock-in and all date unit tests pass.
3. **Anonymous play + scoring on the server.** Anonymous sign-in, `play`/`guess` routes, resume, local mirror and offline fallback, stats view, streaks. *Accepted when* the E2E anonymous flow passes and a cleared-cookie browser falls back to local play.
4. **Login + merge.** Magic link, Google, upgrade in place, merge-token flow, account page with export/delete. *Accepted when* an anonymous player with 3 plays logs in on a second device holding 2 other plays and ends with all 5 (earlier-started kept on clashes).
5. **Content pipeline + admin.** Nightly generate → auto-verify → schedule cron, data-backed generators for OWID and World Bank, the admin portal (Reports, Upcoming, editor, Flagged, bank, Health), report button, reserve swap, alerts, rerun fallback. *Accepted when* a cold start with an empty database fills 30 days with no human action; a planted wrong number is flagged by the checks; simulated reports from 11% of players add it once to the Reports queue, send no email, and leave the question live, while 3 reports out of 5,000 players do nothing; and deleting a day triggers the rerun plus an alert.
6. **Virality + launch hardening.** Share sheet, `?r=` landing + OG images, crowd stats on reveal, analytics events + admin Analytics page, Sentry, rate limits, Turnstile, privacy/terms, SEO. *Accepted when* Lighthouse mobile ≥ 95, the share link unfurls correctly in iMessage/WhatsApp/X, and 60 days of verified puzzles are scheduled.

**Launch checklist**

- [ ] `LAUNCH_DATE` set and puzzle #1 previewed
- [ ] changel.app DNS on Vercel, HTTPS, www redirect
- [ ] Supabase backups on, auth emails branded, Google OAuth consent screen verified
- [ ] 60 days scheduled, admin alert tested
- [ ] Submitted to Listdle, Alldle, Playlin, Dle Hunt

**Open questions**

- Launch date, and whether puzzle #1 should be themed.
- Region mix: global with an Australian flavour (assumed here), or Australia-first?
- Should launch week's questions get one manual look, even though later weeks run fully automatically?
