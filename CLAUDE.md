# Changel

Changel is a free daily web game at changel.app. Each day has five rounds. Every round shows a real number from the past (for example, world population in 1975), and the player drags a log-scale slider to guess how many times bigger or smaller it is now. Each round scores up to 100 points by how close the guess is, and 0 if the guess goes the wrong direction. Everyone plays the same puzzle on the same local calendar date, and it resets at local midnight. Play needs no login (Supabase anonymous users), and an optional login (magic link or Google) syncs history across devices. A nightly pipeline generates, fact-checks and schedules questions so the game never runs out. Stack: Next.js (App Router, TypeScript strict) on Vercel (syd1), Supabase (Postgres + Auth, Sydney), Resend for email and Upstash Redis for rate limits.

**Sources of truth:** `SPEC.md` decides features. `reference/prototype.html` decides visuals, copy and scoring.

## Start of every session

**Always read PROGRESS.md and DECISIONS.md at the start of a session before doing anything.**
PROGRESS.md says where we are and what's next. DECISIONS.md records every choice the spec doesn't cover.

## Working rules

- Build one milestone at a time, in the order in SPEC.md section 12. At the end of each milestone, stop and wait for Dani's go-ahead.
- Match the prototype exactly for look, feel and scoring.
- Write the tests the spec lists as you go. Run them before calling a task done.
- Commit to git after each completed task with a clear message (e.g. "M2: add puzzle date-window check"), then push. Each milestone has its own branch (e.g. `m1-scaffold-visuals`), pushed to GitHub after every commit and merged into `main` when Dani approves the milestone. Never commit straight to `main`.
- Never put secrets in client code or commit them. Use .env.local and keep .env.example current.
- If something in the spec is unclear or contradictory, pick the simplest option, log it in DECISIONS.md, and tell Dani.
- When you show Dani code changes, show them inline in the chat.
- Update PROGRESS.md after EVERY task, not just at the end of a milestone. A fresh session must be able to continue from it alone.

## Infrastructure rules (MCP: Supabase, Vercel, Resend, Upstash)

- These accounts also hold Dani's other projects. Only create or change resources named "changel". Never modify, delete or read secrets from anything else.
- Ask before deleting anything, and before any change to production once we've launched.
- Set things up yourself via MCP instead of asking Dani to click through dashboards. Only ask for what you truly can't do: account sign-ups, DNS records at the registrar (give an exact table), Google OAuth setup, the Anthropic API key and Cloudflare Turnstile keys. Add each to "Needs from Dani" in PROGRESS.md and keep working on whatever isn't blocked.
- Set up infrastructure only when the current milestone needs it, not all up front.
- Supabase: org "Changel", project "changel" (Sydney). Data API on, auto-expose new tables OFF, automatic RLS ON.

## Key commands

_Filled in as they come to exist._

| What | Command |
| --- | --- |
| Node | Node 22 via nvm. If `node -v` isn't 22, prefix commands with `export PATH="$HOME/.nvm/versions/node/v22.18.0/bin:$PATH" &&` |
| Install | `npm install` |
| Dev server | `npm run dev` (http://localhost:3000) |
| Unit tests | `npm test` (Vitest, `tests/unit/**/*.test.ts`) |
| E2E tests | `npm run test:e2e` (Playwright, `tests/e2e`) |
| Visual parity vs prototype | `npm run test:parity` (side-by-side PNGs in `test-results/parity/`) |
| Typecheck + lint + unit | `npm run check` (run before every commit) |
| Migrations | _TBD (M2)_ |
| Deploy | Push a branch → Vercel preview (project `changel`, id `prj_4qiuH4a01M4Il52WrKi8zd75EjCS`, team `team_aHOu0Tqfx6VbGGGipjmx66jE`, Node 22, functions syd1). Merge to `main` → production. Previews are behind Vercel Authentication. |
