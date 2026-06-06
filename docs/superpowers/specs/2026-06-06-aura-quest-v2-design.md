# Aura Quest v2 — Design Spec ("Cool, not addictive, on your phone")

**Date:** 2026-06-06
**Status:** Approved (design), pending implementation plan
**Builds on:** `2026-06-05-aura-quest-design.md` (v1, shipped). This spec adds
features; it does not replace the v1 spine.

## Why this exists

v1 shipped as a private, offline, single-folder web app. The owner wants to (a)
pull in the best ideas from other tracking / RPG apps (Habitica, Finch,
GitHub-style heatmap trackers), (b) **without making it addictive** — the app
should pull him *off* his phone, not into it — and (c) **publish it as a website
he opens on his phone**.

## The spine (v1, preserved)

- **Pure ascension:** aura only ever climbs. No spending, no HP, no punishment,
  no shame. Missing a day resets the streak quietly; that's the only "loss."
- **Four branches:** Body ⚔️, Mind 🧠, Craft 🔧, Spirit 🌿.
- **Mystic neon aesthetic, visual delight as a feature.**
- **Single self-contained `index.html`** (HTML+CSS+JS in one document, no ES
  module imports across files so it runs from `file://` and any static host).
- **Store seam** is the only module touching persistence; export JSON is the
  backup + migration format.

## The new first law (v2)

> **Reward real-world action, never app-opening.**

Every aura grant, badge, and celebration is tied to *completing a real quest*.
Nothing fires for merely opening the app, checking in, or refreshing a screen.
This is the single rule that keeps the app motivating without becoming a
slot machine.

### Anti-addiction guardrails (hard rules)

1. **No app-open rewards.** No random "open the app" drops, no daily login
   bonus, no streak that advances just by visiting. Aura comes only from quests.
2. **Quick-exit by design.** After logging, the app shows a "✦ You're done —
   go be legendary" curtain that dims the UI and invites you to leave. An
   optional gentle "you've been in here a while" nudge appears after a few
   minutes in-app. The app celebrates you leaving.
3. **Reward staying off-phone.** A first-class self-reported Spirit daily quest
   ("Stayed off socials today") makes restraint grow the constellation.
4. **No notifications / nags.** The app never reaches out. (Also a technical
   reality for a backend-less static PWA — see Out of Scope.)

## Platform: phone-only PWA

The owner uses it primarily on his phone. We ship the existing static app as an
installable **PWA**:

- `manifest.json` (name, icons, `display: standalone`, theme/background color,
  start URL) so it installs to the home screen and runs full-screen without
  browser chrome.
- A **service worker** that caches `index.html`, `aura-core.js`, `store.js`, and
  icons for full offline use (cache-first; bump a cache version string on
  release to update).
- App icons (maskable + standard) and a splash background matching the mystic
  theme.
- Deploy the static folder to **Netlify or GitHub Pages** (free, instant). No
  build step.

**Data stays in `localStorage` on the device.** This is phone-only by choice;
cross-device auto-sync (a backend) remains the parked "Option B." Export/Import
JSON remains the manual backup + move path.

## Feature set

### 1. Visualization & Insight (read-only — pure upside, no engagement loops)

- **"Year in Aura" heatmap** — a calendar grid (GitHub-contribution style) of the
  trailing ~365 days. Each cell's glow intensity maps to aura earned that day
  (bucketed). Tapping a day reveals that day's completed quests and aura. Pure
  function of `history`.
- **Stats panel** — current streak, **best-ever streak**, daily completion rate
  (dailies completed ÷ dailies scheduled), per-branch level + aura bars, an
  aura-over-time sparkline, and lifetime perfect-day count. All derived from
  existing state; nothing here grants aura or pulls you back.

### 2. Quest scheduling

Quests remain simple **done / not-done** checks (the v1 behavior). The one
addition is **day-of-week scheduling** for dailies: a `schedule` field (array of
weekdays, default = all 7). Only scheduled days surface the quest, count it
toward completion rate, and require it for a Perfect Day.

- **(Dropped) `count` quests** — numeric-target quests (log km / pages / reps)
  were considered and cut to keep quests dead-simple and the data model lean.
- **(Dropped) `timer` quests** — a live in-app timer keeps the app open, which
  fights the quick-exit law.

### 3. Surprise & reward — de-fanged (earned, never random)

- **Achievements / badges** — deterministic milestone unlocks that fire **on the
  completing action**, shown on a badge shelf. Starter set (config-driven, easy
  to extend):
  - First ⚡ / 🔥 / 💎 quest completed
  - Streaks: 7 / 30 / 100 consecutive days
  - Branch mastery: 1,000 aura in a single branch; all four branches at level 5
  - Aura ranks reached (one badge per rank: Awakening → Transcendent)
  - First Trial completed; first Perfect Week
  None are random; none trigger on app-open.
- **Aura Surge** — the "surprise & delight" beat, made honest by attaching it to
  real effort instead of luck. A celebratory bonus + big animation fires when
  you finish a **Trial** or complete a **Perfect Week** (all scheduled dailies
  every day for 7 days). Bonus amounts live in config.

### 4. Depth & ritual

- **Constellation passive perks** — at branch level milestones, unlock a
  permanent passive (purely additive — never a penalty). Starter set (config):
  - Body L5: +10% aura on Body quests
  - Mind L5: +10% aura on Mind quests
  - Craft L5: +10% aura on Craft quests
  - Spirit L5: Perfect-Day bonus +50%
  Perks are resolved in the aura calculation; they make the four-branch map read
  as a real skill tree without any humanoid avatar.
- **Trials** — owner-defined, time-bound campaigns with a goal and a payoff.
  Shape: `{ id, name, branch, startDate, endDate, goal, status }` where goal is
  e.g. "complete this daily every scheduled day" or "complete N quests in this
  branch." On success → Aura Surge + a badge. On expiry without success → quiet
  close (no penalty, consistent with pure ascension).
- **Daily reflection** *(Spirit, optional)* — a one-tap mood pick (small enum)
  plus an optional one-line journal entry, stored per day. Completing it grants
  Spirit aura like any quick quest. No streak is attached to it; skipping costs
  nothing.

### 5. Off-phone mechanic

A web PWA **cannot read device screen-time** (no browser API; the OS walls it
off). So this is implemented as a **self-reported Spirit daily quest** —
"Stayed off socials today" (honor system). No timer, no tracking, no nag. It is
just a normal `check` daily living in the Spirit branch, but called out in the
default seed so it's there from day one.

## Architecture (changes from v1)

Still four internal units plus the new platform shell. New/changed pieces:

- **PWA shell (new):** `manifest.json`, `service-worker.js`, icon assets. The
  service worker is the only piece that must live in a separate file (SWs can't
  be inline); it's tiny and isolated.
- **Quest engine (extended):** day-of-week schedule resolution, perk resolution
  in aura calc, achievement evaluation, Trial evaluation, and Perfect-Week
  detection. All added as **pure functions** alongside the existing ones.
- **Constellation renderer (extended):** render perk badges / level milestones on
  the star map. Still pure state → SVG.
- **New view: Insight** (heatmap + stats). Pure render from `history` + state.
- **UI layer (extended):** quest kinds in add/edit forms, schedule picker, badge
  shelf, Trials management, reflection input, the quick-exit curtain.
- **Store seam (unchanged role):** now persists the v2 schema; gains a v1→v2
  migration on load.

## Data model v2

`version: 2`. Migration runs on load when a v1 (`version: 1`) save is found.

```
{
  version: 2,
  player: {
    totalAura, rank, createdAt, lastActiveDate,
    streak: { count, lastCompletedDate, best }      // + best (best-ever streak)
  },
  branches: {
    Body:   { aura, level, perks: [] },             // + perks unlocked
    Mind:   { aura, level, perks: [] },
    Craft:  { aura, level, perks: [] },
    Spirit: { aura, level, perks: [] }
  },
  quests: [
    {
      id, name, branch, difficulty, type,           // type: "daily" | "custom"
      schedule: [0..6] | null                        // NEW (weekdays; null = all)
    }
  ],
  today: {
    date,
    completedQuestIds: [],                           // resets on new day (v1)
    reflection: { mood, note } | null                // NEW
  },
  trials: [
    { id, name, branch, startDate, endDate, goal, status }   // NEW
  ],
  achievements: [ { id, unlockedAt } ],              // NEW (unlocked badges)
  history: [
    { date, auraEarned, perfectDay, completedQuestIds, mood? }  // mood NEW
  ]
}
```

### Migration v1 → v2

On load, if `version === 1`: set `version: 2`; add `schedule: null` to each
quest; add `perks: []` to each branch; add `streak.best` (seed from current
count); add empty `trials`, `achievements`; add `reflection: null` to `today`.
Preserve the original blob first (same corrupt-recovery discipline as v1) in
case migration needs to be redone.

## Aura economy additions (all config-driven)

A single config block holds: difficulty→base aura (v1), rank thresholds (v1),
streak multiplier curve (v1), perfect-day bonus (v1), **perk effects**, **Aura
Surge bonus amounts**, **achievement definitions**, **perfect-week bonus**.
Everything tunable in one place.

## Quick-exit UX

After any completing action that ends a session (last scheduled daily done, or a
custom quest completed and the board is now quiet), show a dismissible "✦ You're
done — go be legendary" curtain that dims the UI. A soft, infrequent "still
here?" nudge appears after a configurable minutes-in-app threshold. Neither
grants nor withholds aura — they exist purely to send the user away.

## Testing

Extend the pure-function test suite (`node --test`) to cover:

- Day-of-week schedule: quest surfaces/counts only on scheduled days; Perfect
  Day ignores unscheduled quests.
- Perk resolution: branch-level perks correctly multiply aura.
- Achievement evaluation: each starter badge unlocks at its boundary, exactly
  once, never on app-open.
- Aura Surge triggers: Trial success, Perfect Week.
- Best-ever streak tracking across same-day / next-day / gap transitions.
- v1→v2 migration: a v1 save loads, upgrades, and preserves totals.

UI, PWA install, offline behavior, and the heatmap are verified manually on a
phone.

## Out of scope (v2 / YAGNI)

- **Cross-device auto-sync / accounts / backend** — still Option B; the store
  seam keeps the door open.
- **Push / scheduled notifications** — a backend-less static PWA cannot fire
  scheduled push (web push needs a server; the Notification API only fires while
  the page is open). Aligns with the no-nag guardrail anyway. Revisit only if a
  backend is ever added.
- **Real device screen-time reading** — no web API exists; off-phone is
  self-reported.
- **Count / numeric-target quests** — dropped to keep quests dead-simple.
- **Live in-app focus timer** — dropped on purpose (fights quick-exit).
- **Spending / shop / cosmetics economy, HP / punishment, social / leaderboards,
  humanoid avatar** — all remain out, per the v1 spine.

## Future path to Option B (cross-device)

Unchanged from v1: stand up a minimal backend, re-point the store module's
load/save/export/import at it, seed from an exported JSON. The v2 schema (with
`version`) is the migration payload. Engine, renderer, and UI are untouched.
