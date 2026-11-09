# Decisions

Choices the spec doesn't cover, or where it was unclear or contradictory. Newest at the bottom. Format: date, decision, why. Entries marked **(proposed)** are waiting for Dani to confirm or override.

---

### 2026-11-09: Package manager is npm, Node 20 LTS
**Decision:** Use npm (lockfile `package-lock.json`). Pin Node to 20.x via `engines` and `.nvmrc`.
**Why:** It's what's installed locally (Node 20.20, npm 10.8), and Vercel supports it out of the box. Simplest option.

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
