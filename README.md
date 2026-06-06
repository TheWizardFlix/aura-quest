# 🟣 Aura Quest

A private web app that turns real-life discipline into a glowing mystic RPG
grind. Complete quests, farm aura, and watch your four-branch constellation
ascend. The aura only ever climbs — no spending, no punishment, no shame.

Built on one principle: **reward what you do away from your phone, and give you
zero reason to linger in the app.** Check in, log, leave.

## Run it

Double-click `index.html`. No install, no internet, no accounts. Your progress
saves automatically in your browser (localStorage).

Keep the files together in one folder: `index.html`, `aura-core.js`, `store.js`,
plus the PWA shell (`manifest.json`, `service-worker.js`, `icon.svg`).

## Put it on your phone (PWA)

Aura Quest is an installable Progressive Web App — host the folder and add it to
your home screen for a full-screen, offline, app-like experience.

1. Deploy the folder to any free static host:
   - **Netlify:** drag the folder onto <https://app.netlify.com/drop>.
   - **GitHub Pages:** push the folder to a repo, enable Pages on the branch.
   - **Vercel:** `vercel` in the folder, or import the repo.
2. Open the URL on your phone.
3. **iOS Safari:** Share → *Add to Home Screen*. **Android Chrome:** menu →
   *Install app* (or the install prompt).

The service worker caches everything, so it works with no signal. Data lives in
that device's storage — this is a phone-first, single-device app. Use
**Backup → Export** to move your save between devices.

## What's inside

- **Four branches** — Body ⚔️, Mind 🧠, Craft 🔧, Spirit 🌿 — each a cluster on
  your aura constellation.
- **Daily + one-off quests**, with **day-of-week scheduling** for dailies (run
  Mon/Wed/Fri).
- **Streaks** with a best-ever record, **Perfect Days**, and **Aura Surges**
  earned by finishing a Trial or a Perfect Week (never random, never for opening
  the app).
- **Constellation perks** — passive bonuses unlocked at branch level 5.
- **Trials** — self-defined, time-bound campaigns with a payoff.
- **Daily reflection** — a one-tap mood + line, for Spirit aura.
- **Insight** — a "year in aura" heatmap and a stats panel.
- **Trophies** — achievement badges and unlocked perks.
- **Quick-exit curtain** — when the day's quests are done, the app sends you off.

## Back it up

**Backup → Export** downloads your whole save as a `.json`. Import it to restore
or to move to a new device. Tip: stick to one browser; "clear site data" wipes
your progress, so export first.

## Develop / test

Game logic lives in `aura-core.js` (pure functions) and is covered by tests:

```
node --test
```

Persistence is isolated in `store.js` (the save seam), which also runs the
v1 → v2 schema migration on load.
