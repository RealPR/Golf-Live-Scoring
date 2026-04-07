# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev    # Start dev server at http://localhost:3000
npm run build  # Production build
npm start      # Run production build
```

There are no tests or linting scripts configured.

## Environment

Requires `.env.local` with:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Architecture

**Single-page app** — essentially all application logic lives in `src/app/page.js` (~850 lines). This is a Next.js 14 App Router project with a single `"use client"` component.

**Data layer** — `src/lib/supabase.js` exports a single Supabase client. All DB reads/writes go through this client directly from `page.js`. The `scores` table has a `UNIQUE (player, day, hole)` constraint; upserts use `onConflict: "player,day,hole"`.

**Realtime** — Supabase Realtime subscription in `page.js` listens to all `INSERT`/`UPDATE`/`DELETE` events on the `scores` table and updates local React state immediately. This is how all devices see live changes.

**Key config constants** (top of `page.js`):
- `PLAYERS` — array of player names (stored in localStorage per device)
- `COURSES` — object mapping day (1–4) to `{ name, par[] }` for 18 holes

**Points system** (implemented in `calcPoints()`):
| Result | Condition | Points |
|--------|-----------|--------|
| Eagle+ | ≤ par − 2 | 4 |
| Birdie | par − 1 | 3 |
| Par | = par | 2 |
| Bogey | par + 1 | 1 |
| Dbl Bogey+ | > par + 1 | 0 |

> Note: `supabase-schema.sql` has `CHECK (points BETWEEN 0 AND 2)` which is outdated — the actual range is 0–4. If rerunning the schema, update this constraint.

**Player identity** — stored in `localStorage` under `"golf-my-player"`. On first visit, a player-selection screen appears. The selected player pre-fills the scoring form.

**Tabs**: `live` (score entry), `board` (day leaderboard), `total` (overall + daily winners), `card` (scorecard per player/day).

**Database schema** — run `supabase-schema.sql` in the Supabase SQL Editor to set up the `scores` table, RLS policies (public read/write, no auth), and Realtime publication.
