# Aura Quest — Design Spec

**Date:** 2026-06-05
**Status:** Approved (design), pending implementation plan

## One-liner

A private, single-file web app that turns real-life discipline into a glowing
RPG grind. Complete quests (running, studying, engineering, album work, etc.),
farm **aura points**, and watch your character — a four-branch **constellation** —
grow brighter as you ascend ranks. Mystic, dark, neon. The aura only ever climbs.

## Quality bar (non-negotiable)

It must look **insanely cool**. This is a motivation tool — if it isn't a
genuine pleasure to open, it fails its only job. Dark mystic aesthetic, real
glow, particle/animation polish on key moments (earning aura, a star igniting,
ranking up, streak ticks). Treat visual delight as a feature, not decoration.

## Aesthetic

- **Vibe:** Mystic / Aura Glow. Dark backgrounds, neon purple/violet aura
  light, soft particles, ethereal glow that intensifies with progress.
- **Character representation:** an **Aura Constellation** — a star map / skill
  tree. The character is not a humanoid; it's the growing shape of the player's
  discipline made visible.

## The four branches

Each branch is its own constellation cluster on the star map. Completing a quest
in a branch adds aura to it, grows new stars, and levels it up (brighter/bigger).

| Branch | Icon | Covers |
|--------|------|--------|
| Body | ⚔️ | runs, workouts, sleep, eating clean |
| Mind | 🧠 | studying, reading, courses, deep focus |
| Craft | 🔧 | engineering, side projects, coding, **album / music work** |
| Spirit | 🌿 | meditation, journaling, no-doomscroll |

## Quests

Two kinds:

- **Daily quests** — recurring habits the player defines. They appear each day
  unchecked and waiting. Reset at local midnight.
- **Custom quests** — one-off tasks added ad-hoc ("finish mixing track 3"),
  completed once, then archived.

Each quest has: `name`, `branch`, `difficulty`, `type` (daily | custom).

**Difficulty → base aura:**

| Tier | Icon | Aura |
|------|------|------|
| Quick | ⚡ | 10 |
| Solid | 🔥 | 25 |
| Epic | 💎 | 60 |

## Aura economy — pure ascension

Aura only ever accumulates. There is no spending and the number never goes down.

- Completing a quest grants `base aura × streak multiplier` to both the quest's
  **branch total** and the **global aura total**.
- **Global aura** drives **Aura Rank** (a climbing title) and the overall glow.
- **Branch aura** drives that branch's level and its constellation growth.

### Aura Rank thresholds (global aura)

Titles that climb and never fall. Starting thresholds (tunable during build):

| Rank | Requires (total aura) |
|------|----------------------|
| Dormant | 0 |
| Awakening | 500 |
| Radiant | 2,000 |
| Ascended | 6,000 |
| Transcendent | 15,000 |

(Implementation should make thresholds a single config array so they're trivial
to retune.)

## Streaks

- **Rule:** completing **≥ 1 quest** on a given day keeps the streak alive.
  Miss a full day with zero completions → streak resets to 0.
- **Streak multiplier:** applied to aura earned. `+5%` per consecutive day,
  capped at `×2.0` (reached at day 20). Formula: `min(2.0, 1 + 0.05 × streakDays)`.
- **Perfect Day bonus:** completing **all** of today's daily quests grants a
  flat bonus on top (e.g. +50 aura). A perfect day is a celebration, not a
  requirement for the streak.
- Streak state tracks `count` and `lastCompletedDate`; gaps are detected on load
  by comparing dates.

## Screens (single page)

1. **Header** — giant glowing aura total, current Aura Rank, today's streak 🔥.
2. **Constellation** — the four-branch star map. The player's "character."
3. **Quest board** — today's daily quests (checkable), active custom quests, and
   an "➕ add quest" affordance. Editing the daily quest list lives here or in
   settings.
4. **Backup / settings** — Export / Import JSON, edit daily quests, reset save.

## Architecture

Designed as isolated units even though it ships as one file, so each piece can be
reasoned about and (for the save layer) swapped independently.

- **Self-contained `index.html`** — HTML + CSS + JS in one file. Double-click to
  run from `file://`. No build step, no dependencies, no internet, no accounts.
  (Avoid ES-module `import` across files, which `file://` blocks — keep it one
  document with clearly sectioned internal modules.)

- **Store / save layer (the seam)** — the ONLY module that touches persistence.
  Responsibilities: load on startup, auto-save after every state change, expose
  `exportJSON()` / `importJSON()`. This isolation is deliberate: migrating to a
  hosted backend (future "Option B" for phone access) means re-pointing this one
  module at a server, not rewriting the app. The Export JSON payload IS the
  migration format.

- **Quest engine** — quest definitions, daily-reset detection, completion,
  aura calculation, streak update, rank resolution. Written as **pure, testable
  functions** (input state → output state) wherever possible.

- **Constellation renderer** — draws the four-branch star map (inline SVG) from
  current state. Pure function of state → visual.

- **UI layer** — header, quest board, add/edit forms, settings; wires DOM events
  to the quest engine and store.

## Data model (shape, not final schema)

```
{
  version: 1,
  player: {
    totalAura: 0,
    rank: "Dormant",
    createdAt: <iso>,
    lastActiveDate: <yyyy-mm-dd>,
    streak: { count: 0, lastCompletedDate: <yyyy-mm-dd|null> }
  },
  branches: {
    Body:   { aura: 0, level: 1 },
    Mind:   { aura: 0, level: 1 },
    Craft:  { aura: 0, level: 1 },
    Spirit: { aura: 0, level: 1 }
  },
  quests: [
    { id, name, branch, difficulty, type }   // type: "daily" | "custom"
  ],
  today: {
    date: <yyyy-mm-dd>,
    completedQuestIds: []                     // resets on new day
  },
  history: [ { date, auraEarned, perfectDay } ]  // optional, for streak + later stats
}
```

## Persistence behavior

- Auto-saves to `localStorage` after every state-changing action. Survives tab
  close, restart, power-off.
- **Export** downloads the full save as a small `.json`; **Import** restores it.
  This is the backup and the future device-migration path.
- Players are advised: stick to one browser; "clear site data" wipes localStorage.

## Edge cases & error handling

- **localStorage unavailable** (private mode / blocked) → warn the player, keep
  running in-memory for the session, strongly suggest Export.
- **Corrupt or unparseable save** → don't crash; fall back to a fresh state but
  preserve the corrupt blob (so a manual recovery is possible) and notify.
- **Day rollover** → on load, compare `today.date` to the real local date; if
  different, archive yesterday into history, clear `completedQuestIds`, and
  re-evaluate the streak (intact if yesterday had ≥1 completion, else reset).
- **Missed days** → detected via the date gap on load; streak resets cleanly.
- **Schema migration** → `version` field gates future format upgrades.

## Testing

- Core logic is pure functions, unit-testable without a DOM:
  - aura calculation (base × streak multiplier, + perfect-day bonus)
  - streak update across same-day / next-day / gap-day transitions
  - rank resolution from total aura (boundary values at each threshold)
  - daily-reset / rollover logic
- A lightweight in-file or sidecar test harness exercises these; UI is verified
  manually against the screens above.

## Out of scope (v1 / YAGNI)

- Cloud sync / accounts / backend (this is the future Option B; the store seam
  keeps the door open).
- Spending aura / shop / cosmetics economy (pure ascension only).
- Social features, leaderboards, notifications.
- Humanoid avatar customization.

## Future path to Option B (phone access)

When phone access is wanted: stand up a minimal backend, re-point the Store
module's load/save/export/import at it, and seed it from an exported JSON. No
change required to the quest engine, renderer, or UI.
