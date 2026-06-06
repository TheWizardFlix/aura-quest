# 🟣 Aura Quest

A private, single-folder web app that turns real-life discipline into a glowing
mystic RPG grind. Complete quests, farm aura, and watch your four-branch
constellation ascend. The aura only ever climbs.

## Run it
Double-click `index.html`. That's it — no install, no internet, no accounts.
Your progress saves automatically in your browser (localStorage).

Keep all files together in one folder:
`index.html`, `aura-core.js`, `store.js`.

## Back it up
Use **Backup → Export** to download your save as a `.json` file. Import it to
restore — that's also how you'll move to a new device later.

Tip: stick to one browser. "Clear site data" will wipe your progress, so export
first.

## Develop / test
Game logic lives in `aura-core.js` (pure functions) and is covered by tests:

```
node --test
```
