# Aura Quest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private, single-folder web app that turns real-life discipline into a glowing mystic RPG grind — complete quests, farm aura, and watch a four-branch constellation ascend.

**Architecture:** A self-contained folder (no build, no deps, runs from `file://`). Pure game logic lives in `aura-core.js` (Node-testable classic script). The DOM, CSS, constellation SVG rendering, and localStorage store live in `index.html`. The store is an isolated seam so a future hosted backend (phone access) is a swap, not a rewrite.

**Tech Stack:** Vanilla HTML/CSS/JS. Node's built-in test runner (`node --test`, zero npm deps) for the pure logic. Inline SVG + CSS animations for the "insanely cool" mystic visuals.

---

## File Structure

- `aura-core.js` — Pure game logic. No DOM, no localStorage. Constants (difficulty→aura, ranks, branches), aura math, streak logic, day rollover, the `completeQuest` reducer, and the pure `buildConstellationSVG(state)` renderer. Dual-exports: attaches to `window` in the browser and `module.exports` in Node.
- `tests/aura-core.test.js` — `node --test` suite covering every pure function with boundary cases.
- `index.html` — The app shell: mystic CSS, header (aura/rank/streak), constellation mount, quest board, add/edit forms, settings/backup. Contains the `Store` (localStorage wrapper with injectable backend) and all DOM wiring. Loads `aura-core.js` via `<script src>`.
- `aura-core.js` is the single source of truth for game rules; `index.html` never re-implements a rule.

**Convention for every task:** run commands from the repo root `C:\Users\nsula\aura-quest`. Tests run with `node --test`.

---

## Task 1: Project scaffold + test runner sanity

**Files:**
- Create: `aura-core.js`
- Test: `tests/aura-core.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/aura-core.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../aura-core.js');

test('core module loads and exposes version', () => {
  assert.equal(core.CORE_VERSION, 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `Cannot find module '../aura-core.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `aura-core.js`:

```js
// aura-core.js — pure game logic. No DOM, no storage.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AuraCore = api;
})(typeof window !== 'undefined' ? window : null, function () {
  const CORE_VERSION = 1;
  return { CORE_VERSION };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add aura-core.js tests/aura-core.test.js
git commit -m "feat: scaffold aura-core with node test runner"
```

---

## Task 2: Constants + rank resolution

**Files:**
- Modify: `aura-core.js`
- Test: `tests/aura-core.test.js`

- [ ] **Step 1: Write the failing test**

Append to `tests/aura-core.test.js`:

```js
test('DIFFICULTY_AURA has the three tiers', () => {
  assert.deepEqual(core.DIFFICULTY_AURA, { quick: 10, solid: 25, epic: 60 });
});

test('BRANCHES are the four life domains', () => {
  assert.deepEqual(core.BRANCHES, ['Body', 'Mind', 'Craft', 'Spirit']);
});

test('resolveRank returns the highest rank whose threshold is met', () => {
  assert.equal(core.resolveRank(0), 'Dormant');
  assert.equal(core.resolveRank(499), 'Dormant');
  assert.equal(core.resolveRank(500), 'Awakening');
  assert.equal(core.resolveRank(1999), 'Awakening');
  assert.equal(core.resolveRank(2000), 'Radiant');
  assert.equal(core.resolveRank(6000), 'Ascended');
  assert.equal(core.resolveRank(15000), 'Transcendent');
  assert.equal(core.resolveRank(999999), 'Transcendent');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `core.DIFFICULTY_AURA` is undefined.

- [ ] **Step 3: Write minimal implementation**

In `aura-core.js`, inside the factory before `return`, add:

```js
const DIFFICULTY_AURA = { quick: 10, solid: 25, epic: 60 };
const BRANCHES = ['Body', 'Mind', 'Craft', 'Spirit'];
const PERFECT_DAY_BONUS = 50;
const RANKS = [
  { name: 'Dormant', min: 0 },
  { name: 'Awakening', min: 500 },
  { name: 'Radiant', min: 2000 },
  { name: 'Ascended', min: 6000 },
  { name: 'Transcendent', min: 15000 },
];

function resolveRank(totalAura) {
  let name = RANKS[0].name;
  for (const r of RANKS) if (totalAura >= r.min) name = r.name;
  return name;
}
```

And extend the returned object:

```js
return { CORE_VERSION, DIFFICULTY_AURA, BRANCHES, PERFECT_DAY_BONUS, RANKS, resolveRank };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add aura-core.js tests/aura-core.test.js
git commit -m "feat: add difficulty/branch constants and rank resolution"
```

---

## Task 3: Date helpers

**Files:**
- Modify: `aura-core.js`
- Test: `tests/aura-core.test.js`

- [ ] **Step 1: Write the failing test**

Append:

```js
test('dateStr formats a Date as local yyyy-mm-dd', () => {
  // Month is 0-indexed in JS Date; June = 5
  assert.equal(core.dateStr(new Date(2026, 5, 5)), '2026-06-05');
  assert.equal(core.dateStr(new Date(2026, 0, 9)), '2026-01-09');
});

test('addDays shifts a yyyy-mm-dd string and handles month/year rollover', () => {
  assert.equal(core.addDays('2026-06-05', -1), '2026-06-04');
  assert.equal(core.addDays('2026-06-05', 1), '2026-06-06');
  assert.equal(core.addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(core.addDays('2026-12-31', 1), '2027-01-01');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `core.dateStr` is undefined.

- [ ] **Step 3: Write minimal implementation**

Add inside the factory:

```js
function dateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(yyyymmdd, n) {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  const date = new Date(y, m - 1, d + n);
  return dateStr(date);
}
```

Add `dateStr, addDays` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add aura-core.js tests/aura-core.test.js
git commit -m "feat: add local-date helpers"
```

---

## Task 4: Streak multiplier + aura-per-quest

**Files:**
- Modify: `aura-core.js`
- Test: `tests/aura-core.test.js`

- [ ] **Step 1: Write the failing test**

Append:

```js
test('streakMultiplier is 1 + 0.05/day, capped at 2.0', () => {
  assert.equal(core.streakMultiplier(0), 1.0);
  assert.equal(core.streakMultiplier(1), 1.05);
  assert.equal(core.streakMultiplier(10), 1.5);
  assert.equal(core.streakMultiplier(20), 2.0);
  assert.equal(core.streakMultiplier(50), 2.0); // capped
});

test('auraForQuest = round(base * streak multiplier)', () => {
  assert.equal(core.auraForQuest('quick', 0), 10);
  assert.equal(core.auraForQuest('solid', 0), 25);
  assert.equal(core.auraForQuest('epic', 0), 60);
  assert.equal(core.auraForQuest('solid', 10), 38); // round(25 * 1.5)
  assert.equal(core.auraForQuest('epic', 20), 120); // 60 * 2.0
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `core.streakMultiplier` is undefined.

- [ ] **Step 3: Write minimal implementation**

Add inside the factory:

```js
function streakMultiplier(streakDays) {
  return Math.min(2.0, 1 + 0.05 * streakDays);
}

function auraForQuest(difficulty, streakDays) {
  const base = DIFFICULTY_AURA[difficulty];
  return Math.round(base * streakMultiplier(streakDays));
}
```

Add `streakMultiplier, auraForQuest` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add aura-core.js tests/aura-core.test.js
git commit -m "feat: add streak multiplier and per-quest aura"
```

---

## Task 5: Streak update + current-streak display

**Files:**
- Modify: `aura-core.js`
- Test: `tests/aura-core.test.js`

- [ ] **Step 1: Write the failing test**

Append:

```js
test('updateStreak: first ever completion sets count to 1', () => {
  const s = core.updateStreak({ count: 0, lastCompletedDate: null }, '2026-06-05');
  assert.deepEqual(s, { count: 1, lastCompletedDate: '2026-06-05' });
});

test('updateStreak: completing again same day does not change count', () => {
  const s = core.updateStreak({ count: 3, lastCompletedDate: '2026-06-05' }, '2026-06-05');
  assert.deepEqual(s, { count: 3, lastCompletedDate: '2026-06-05' });
});

test('updateStreak: completing the next day increments', () => {
  const s = core.updateStreak({ count: 3, lastCompletedDate: '2026-06-04' }, '2026-06-05');
  assert.deepEqual(s, { count: 4, lastCompletedDate: '2026-06-05' });
});

test('updateStreak: a gap resets to 1', () => {
  const s = core.updateStreak({ count: 9, lastCompletedDate: '2026-06-02' }, '2026-06-05');
  assert.deepEqual(s, { count: 1, lastCompletedDate: '2026-06-05' });
});

test('currentStreak: 0 if the streak is broken (not today, not yesterday)', () => {
  assert.equal(core.currentStreak({ count: 9, lastCompletedDate: '2026-06-02' }, '2026-06-05'), 0);
  assert.equal(core.currentStreak({ count: 9, lastCompletedDate: '2026-06-04' }, '2026-06-05'), 9);
  assert.equal(core.currentStreak({ count: 9, lastCompletedDate: '2026-06-05' }, '2026-06-05'), 9);
  assert.equal(core.currentStreak({ count: 0, lastCompletedDate: null }, '2026-06-05'), 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `core.updateStreak` is undefined.

- [ ] **Step 3: Write minimal implementation**

Add inside the factory:

```js
function updateStreak(streak, today) {
  if (streak.lastCompletedDate === today) return { ...streak };
  if (streak.lastCompletedDate === addDays(today, -1)) {
    return { count: streak.count + 1, lastCompletedDate: today };
  }
  return { count: 1, lastCompletedDate: today };
}

// What to DISPLAY today (a streak that wasn't kept up is visually 0).
function currentStreak(streak, today) {
  if (!streak.lastCompletedDate) return 0;
  if (streak.lastCompletedDate === today) return streak.count;
  if (streak.lastCompletedDate === addDays(today, -1)) return streak.count;
  return 0;
}
```

Add `updateStreak, currentStreak` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add aura-core.js tests/aura-core.test.js
git commit -m "feat: add streak update and display logic"
```

---

## Task 6: Fresh state + day rollover

**Files:**
- Modify: `aura-core.js`
- Test: `tests/aura-core.test.js`

- [ ] **Step 1: Write the failing test**

Append:

```js
test('freshState builds a valid empty save with four branches and seed quests', () => {
  const s = core.freshState('2026-06-05');
  assert.equal(s.version, 1);
  assert.equal(s.player.totalAura, 0);
  assert.equal(s.player.rank, 'Dormant');
  assert.deepEqual(Object.keys(s.branches), core.BRANCHES);
  assert.equal(s.branches.Body.aura, 0);
  assert.equal(s.today.date, '2026-06-05');
  assert.deepEqual(s.today.completedQuestIds, []);
  assert.equal(s.today.perfectAwarded, false);
  assert.ok(s.quests.length > 0, 'ships with seed quests');
  assert.ok(s.quests.every(q => core.BRANCHES.includes(q.branch)));
});

test('rolloverIfNewDay: same day is a no-op', () => {
  const s = core.freshState('2026-06-05');
  s.today.completedQuestIds = ['x'];
  const out = core.rolloverIfNewDay(s, '2026-06-05');
  assert.deepEqual(out.today.completedQuestIds, ['x']);
});

test('rolloverIfNewDay: a new day clears completions and resets perfectAwarded', () => {
  const s = core.freshState('2026-06-05');
  s.today.completedQuestIds = ['x', 'y'];
  s.today.perfectAwarded = true;
  const out = core.rolloverIfNewDay(s, '2026-06-06');
  assert.equal(out.today.date, '2026-06-06');
  assert.deepEqual(out.today.completedQuestIds, []);
  assert.equal(out.today.perfectAwarded, false);
});

test('rolloverIfNewDay: completed custom quests are not carried as active', () => {
  const s = core.freshState('2026-06-05');
  s.quests.push({ id: 'c1', name: 'Mix track 3', branch: 'Craft', difficulty: 'epic', type: 'custom', archived: true });
  const out = core.rolloverIfNewDay(s, '2026-06-06');
  assert.ok(!out.quests.find(q => q.id === 'c1'), 'archived custom quest is pruned on rollover');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `core.freshState` is undefined.

- [ ] **Step 3: Write minimal implementation**

Add inside the factory:

```js
let _idCounter = 0;
function makeId() {
  _idCounter += 1;
  return 'q' + Date.now().toString(36) + '_' + _idCounter;
}

const SEED_QUESTS = [
  { name: 'Morning run', branch: 'Body', difficulty: 'solid', type: 'daily' },
  { name: 'Eat clean today', branch: 'Body', difficulty: 'quick', type: 'daily' },
  { name: 'Study 1 hour', branch: 'Mind', difficulty: 'solid', type: 'daily' },
  { name: 'Read 15 minutes', branch: 'Mind', difficulty: 'quick', type: 'daily' },
  { name: 'Album session', branch: 'Craft', difficulty: 'solid', type: 'daily' },
  { name: 'Engineering deep work', branch: 'Craft', difficulty: 'epic', type: 'daily' },
  { name: 'Meditate / journal', branch: 'Spirit', difficulty: 'quick', type: 'daily' },
];

function freshState(today) {
  const branches = {};
  for (const b of BRANCHES) branches[b] = { aura: 0, level: 1 };
  return {
    version: CORE_VERSION,
    player: {
      totalAura: 0,
      rank: 'Dormant',
      createdAt: today,
      lastActiveDate: today,
      streak: { count: 0, lastCompletedDate: null },
    },
    branches,
    quests: SEED_QUESTS.map(q => ({ id: makeId(), archived: false, ...q })),
    today: { date: today, completedQuestIds: [], perfectAwarded: false },
    history: [],
  };
}

function rolloverIfNewDay(state, today) {
  if (state.today.date === today) return state;
  const history = state.history.concat([{
    date: state.today.date,
    completedCount: state.today.completedQuestIds.length,
    perfectDay: state.today.perfectAwarded,
  }]);
  return {
    ...state,
    player: { ...state.player, lastActiveDate: today },
    // drop finished one-off custom quests so they don't linger
    quests: state.quests.filter(q => !(q.type === 'custom' && q.archived)),
    today: { date: today, completedQuestIds: [], perfectAwarded: false },
    history,
  };
}
```

Add `freshState, rolloverIfNewDay, makeId` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add aura-core.js tests/aura-core.test.js
git commit -m "feat: add fresh-state factory and day rollover"
```

---

## Task 7: The completeQuest reducer

**Files:**
- Modify: `aura-core.js`
- Test: `tests/aura-core.test.js`

- [ ] **Step 1: Write the failing test**

Append:

```js
function stateWith(quests, today = '2026-06-05') {
  const s = core.freshState(today);
  s.quests = quests.map(q => ({ id: q.id, archived: false, ...q }));
  return s;
}

test('completeQuest adds aura to branch and total, marks done, sets streak to 1', () => {
  const s = stateWith([{ id: 'a', name: 'Run', branch: 'Body', difficulty: 'solid', type: 'daily' }]);
  const out = core.completeQuest(s, 'a', '2026-06-05');
  assert.equal(out.player.totalAura, 25);
  assert.equal(out.branches.Body.aura, 25);
  assert.equal(out.player.streak.count, 1);
  assert.deepEqual(out.today.completedQuestIds, ['a']);
  assert.equal(out.lastEarned.amount, 25);
});

test('completeQuest is idempotent — completing the same quest twice does nothing extra', () => {
  const s = stateWith([{ id: 'a', name: 'Run', branch: 'Body', difficulty: 'solid', type: 'daily' }]);
  const once = core.completeQuest(s, 'a', '2026-06-05');
  const twice = core.completeQuest(once, 'a', '2026-06-05');
  assert.equal(twice.player.totalAura, 25);
  assert.deepEqual(twice.today.completedQuestIds, ['a']);
});

test('completeQuest awards the Perfect Day bonus once when all dailies are done', () => {
  const s = stateWith([
    { id: 'a', name: 'Run', branch: 'Body', difficulty: 'quick', type: 'daily' },   // 10
    { id: 'b', name: 'Study', branch: 'Mind', difficulty: 'quick', type: 'daily' },  // 10
  ]);
  const afterA = core.completeQuest(s, 'a', '2026-06-05');
  assert.equal(afterA.today.perfectAwarded, false);
  const afterB = core.completeQuest(afterA, 'b', '2026-06-05');
  // 10 + 10 + 50 perfect bonus = 70
  assert.equal(afterB.player.totalAura, 70);
  assert.equal(afterB.today.perfectAwarded, true);
  assert.equal(afterB.lastEarned.perfectBonus, 50);
});

test('completeQuest archives a finished custom quest', () => {
  const s = stateWith([{ id: 'c', name: 'Mix track', branch: 'Craft', difficulty: 'epic', type: 'custom' }]);
  const out = core.completeQuest(s, 'c', '2026-06-05');
  assert.equal(out.quests.find(q => q.id === 'c').archived, true);
});

test('completeQuest updates rank when crossing a threshold', () => {
  const s = stateWith([{ id: 'a', name: 'Epic', branch: 'Craft', difficulty: 'epic', type: 'custom' }]);
  s.player.totalAura = 480;
  const out = core.completeQuest(s, 'a', '2026-06-05'); // +60 -> 540
  assert.equal(out.player.rank, 'Awakening');
  assert.equal(out.lastEarned.rankedUp, true);
});

test('completeQuest applies the streak multiplier from the post-completion streak', () => {
  const s = stateWith([{ id: 'a', name: 'Run', branch: 'Body', difficulty: 'solid', type: 'daily' }]);
  s.player.streak = { count: 9, lastCompletedDate: '2026-06-04' }; // -> becomes 10 today, x1.5
  const out = core.completeQuest(s, 'a', '2026-06-05');
  assert.equal(out.lastEarned.amount, 38); // round(25 * 1.5)
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `core.completeQuest` is undefined.

- [ ] **Step 3: Write minimal implementation**

Add inside the factory:

```js
function completeQuest(state, questId, today) {
  if (state.today.completedQuestIds.includes(questId)) return state;
  const quest = state.quests.find(q => q.id === questId);
  if (!quest) return state;

  const newStreak = updateStreak(state.player.streak, today);
  const earned = auraForQuest(quest.difficulty, newStreak.count);

  const completedQuestIds = state.today.completedQuestIds.concat([questId]);

  // Perfect Day: every daily quest completed, awarded at most once per day.
  const dailyIds = state.quests.filter(q => q.type === 'daily').map(q => q.id);
  const allDailyDone = dailyIds.length > 0 && dailyIds.every(id => completedQuestIds.includes(id));
  const perfectBonus = (allDailyDone && !state.today.perfectAwarded) ? PERFECT_DAY_BONUS : 0;

  const totalAura = state.player.totalAura + earned + perfectBonus;
  const prevRank = state.player.rank;
  const rank = resolveRank(totalAura);

  const branches = { ...state.branches };
  branches[quest.branch] = {
    ...branches[quest.branch],
    aura: branches[quest.branch].aura + earned,
  };

  const quests = state.quests.map(q =>
    (q.id === questId && q.type === 'custom') ? { ...q, archived: true } : q
  );

  return {
    ...state,
    player: { ...state.player, totalAura, rank, streak: newStreak, lastActiveDate: today },
    branches,
    quests,
    today: {
      ...state.today,
      completedQuestIds,
      perfectAwarded: state.today.perfectAwarded || perfectBonus > 0,
    },
    lastEarned: {
      questId,
      branch: quest.branch,
      amount: earned,
      perfectBonus,
      rankedUp: rank !== prevRank,
      rank,
    },
  };
}
```

Add `completeQuest` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add aura-core.js tests/aura-core.test.js
git commit -m "feat: add completeQuest reducer with perfect-day and rank-up"
```

---

## Task 8: Quest add/edit/remove helpers

**Files:**
- Modify: `aura-core.js`
- Test: `tests/aura-core.test.js`

- [ ] **Step 1: Write the failing test**

Append:

```js
test('addQuest appends a quest with a generated id', () => {
  const s = core.freshState('2026-06-05');
  const before = s.quests.length;
  const out = core.addQuest(s, { name: 'Mix track 3', branch: 'Craft', difficulty: 'epic', type: 'custom' });
  assert.equal(out.quests.length, before + 1);
  const added = out.quests[out.quests.length - 1];
  assert.ok(added.id);
  assert.equal(added.name, 'Mix track 3');
  assert.equal(added.archived, false);
});

test('removeQuest deletes by id', () => {
  const s = core.freshState('2026-06-05');
  const id = s.quests[0].id;
  const out = core.removeQuest(s, id);
  assert.ok(!out.quests.find(q => q.id === id));
});

test('activeQuests returns daily quests plus non-archived custom quests', () => {
  const s = core.freshState('2026-06-05');
  const withCustom = core.addQuest(s, { name: 'One off', branch: 'Mind', difficulty: 'quick', type: 'custom' });
  const id = withCustom.quests[withCustom.quests.length - 1].id;
  const done = core.completeQuest(withCustom, id, '2026-06-05'); // archives the custom quest
  const active = core.activeQuests(done);
  assert.ok(!active.find(q => q.id === id), 'archived custom quest is hidden');
  assert.ok(active.find(q => q.type === 'daily'), 'daily quests still shown');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `core.addQuest` is undefined.

- [ ] **Step 3: Write minimal implementation**

Add inside the factory:

```js
function addQuest(state, { name, branch, difficulty, type }) {
  const quest = { id: makeId(), name, branch, difficulty, type, archived: false };
  return { ...state, quests: state.quests.concat([quest]) };
}

function removeQuest(state, questId) {
  return { ...state, quests: state.quests.filter(q => q.id !== questId) };
}

function activeQuests(state) {
  return state.quests.filter(q => q.type === 'daily' || !q.archived);
}
```

Add `addQuest, removeQuest, activeQuests` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add aura-core.js tests/aura-core.test.js
git commit -m "feat: add quest add/remove/active helpers"
```

---

## Task 9: Constellation SVG renderer (pure)

**Files:**
- Modify: `aura-core.js`
- Test: `tests/aura-core.test.js`

The renderer is a pure function `state -> SVG string` so it is unit-testable and reused verbatim by the UI. Each branch gets a cluster; the number of stars in a branch grows with its aura (one star per 50 aura, minimum one), and brightness scales with branch aura.

- [ ] **Step 1: Write the failing test**

Append:

```js
test('starCountFor grows one star per 50 aura, minimum 1', () => {
  assert.equal(core.starCountFor(0), 1);
  assert.equal(core.starCountFor(49), 1);
  assert.equal(core.starCountFor(50), 2);
  assert.equal(core.starCountFor(125), 3);
});

test('buildConstellationSVG returns an svg containing all four branch labels', () => {
  const s = core.freshState('2026-06-05');
  const svg = core.buildConstellationSVG(s);
  assert.match(svg, /^<svg[\s\S]*<\/svg>$/);
  for (const b of core.BRANCHES) assert.ok(svg.includes(b), `mentions ${b}`);
});

test('buildConstellationSVG draws more stars as a branch gains aura', () => {
  const lo = core.buildConstellationSVG(core.freshState('2026-06-05'));
  const hi = core.freshState('2026-06-05');
  hi.branches.Craft.aura = 300; // 7 stars
  const hiSvg = core.buildConstellationSVG(hi);
  const count = (str) => (str.match(/class="star"/g) || []).length;
  assert.ok(count(hiSvg) > count(lo), 'more aura => more stars');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `core.starCountFor` is undefined.

- [ ] **Step 3: Write minimal implementation**

Add inside the factory:

```js
function starCountFor(branchAura) {
  return Math.max(1, 1 + Math.floor(branchAura / 50));
}

// Deterministic pseudo-random so a branch's star layout is stable across renders.
function seeded(n) {
  const x = Math.sin(n * 99.13) * 10000;
  return x - Math.floor(x);
}

function buildConstellationSVG(state) {
  const W = 800, H = 460;
  // Four branch anchors across the canvas.
  const anchors = {
    Body:   { x: 0.22 * W, y: 0.32 * H, hue: 0 },     // red-ish
    Mind:   { x: 0.74 * W, y: 0.28 * H, hue: 210 },   // blue
    Craft:  { x: 0.30 * W, y: 0.74 * H, hue: 280 },   // violet
    Spirit: { x: 0.78 * W, y: 0.72 * H, hue: 140 },   // green
  };
  let stars = '';
  let links = '';
  let labels = '';

  BRANCHES.forEach((branch, bi) => {
    const a = anchors[branch];
    const count = starCountFor(state.branches[branch].aura);
    const bright = Math.min(1, 0.4 + state.branches[branch].aura / 1500);
    const pts = [];
    for (let i = 0; i < count; i++) {
      const ang = seeded(bi * 7 + i) * Math.PI * 2;
      const rad = 12 + seeded(bi * 13 + i) * 70;
      const x = a.x + Math.cos(ang) * rad;
      const y = a.y + Math.sin(ang) * rad;
      pts.push({ x, y });
      const r = 2 + seeded(bi + i) * 2.2;
      stars += `<circle class="star" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" `
        + `fill="hsl(${a.hue} 90% 80%)" opacity="${bright.toFixed(2)}">`
        + `<animate attributeName="opacity" values="${bright.toFixed(2)};${(bright*0.5).toFixed(2)};${bright.toFixed(2)}" `
        + `dur="${(2 + seeded(i+bi)*2).toFixed(1)}s" repeatCount="indefinite"/></circle>`;
    }
    // link stars within the branch into a constellation path
    for (let i = 1; i < pts.length; i++) {
      links += `<line class="link" x1="${pts[i-1].x.toFixed(1)}" y1="${pts[i-1].y.toFixed(1)}" `
        + `x2="${pts[i].x.toFixed(1)}" y2="${pts[i].y.toFixed(1)}" stroke="hsl(${a.hue} 80% 70%)" `
        + `stroke-opacity="0.25" stroke-width="1"/>`;
    }
    labels += `<text class="branch-label" x="${a.x.toFixed(0)}" y="${(a.y - 86).toFixed(0)}" `
      + `text-anchor="middle" fill="hsl(${a.hue} 70% 75%)" font-size="13" `
      + `letter-spacing="2">${branch.toUpperCase()} · ${state.branches[branch].aura}</text>`;
  });

  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" `
    + `xmlns="http://www.w3.org/2000/svg" class="constellation">${links}${stars}${labels}</svg>`;
}
```

Add `starCountFor, buildConstellationSVG` to the returned object.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add aura-core.js tests/aura-core.test.js
git commit -m "feat: add pure constellation SVG renderer"
```

---

## Task 10: index.html shell + mystic styling

**Files:**
- Create: `index.html`

This task builds the visual shell and loads the core. No game wiring yet — just the "insanely cool" look, verified in a browser.

- [ ] **Step 1: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Aura Quest</title>
<style>
  :root{
    --bg:#06040c; --bg2:#0c0820; --aura:#9d5bff; --aura2:#5e2bff;
    --text:#e9e2ff; --muted:#9a8fc0; --line:#2a2150;
  }
  *{box-sizing:border-box}
  html,body{margin:0;height:100%}
  body{
    font-family:"Segoe UI",system-ui,sans-serif; color:var(--text);
    background:
      radial-gradient(1200px 700px at 50% -10%, #251056 0%, transparent 60%),
      radial-gradient(900px 600px at 90% 110%, #15234a 0%, transparent 55%),
      var(--bg);
    overflow-x:hidden;
  }
  /* drifting starfield */
  body::before{
    content:""; position:fixed; inset:0; pointer-events:none; z-index:0;
    background-image:
      radial-gradient(1.5px 1.5px at 20% 30%, #ffffffaa, transparent),
      radial-gradient(1.5px 1.5px at 70% 60%, #c9a8ffaa, transparent),
      radial-gradient(1px 1px at 40% 80%, #ffffff88, transparent),
      radial-gradient(1px 1px at 85% 20%, #b98bff88, transparent),
      radial-gradient(1.5px 1.5px at 55% 15%, #ffffff66, transparent);
    background-size:cover; opacity:.5;
    animation:drift 60s linear infinite;
  }
  @keyframes drift{from{transform:translateY(0)}to{transform:translateY(-40px)}}
  .wrap{position:relative; z-index:1; max-width:920px; margin:0 auto; padding:28px 20px 80px}

  /* HEADER */
  header{text-align:center; padding:18px 0 8px}
  .aura-total{
    font-size:clamp(48px,11vw,96px); font-weight:800; line-height:1;
    background:linear-gradient(180deg,#fff,#c9a8ff 60%,#7b2bff);
    -webkit-background-clip:text; background-clip:text; color:transparent;
    text-shadow:0 0 40px #7b2bff88; letter-spacing:-2px;
  }
  .aura-label{color:var(--muted); letter-spacing:6px; font-size:12px; text-transform:uppercase}
  .meta{display:flex; gap:14px; justify-content:center; margin-top:14px; flex-wrap:wrap}
  .pill{
    background:#140d2e88; border:1px solid var(--line); border-radius:999px;
    padding:8px 16px; font-size:14px; backdrop-filter:blur(6px);
    box-shadow:0 0 24px #5e2bff22 inset;
  }
  .pill .k{color:var(--muted); margin-right:8px; font-size:12px; letter-spacing:1px}
  .rank{color:#d9b3ff; text-shadow:0 0 14px #9d5bff}

  /* CONSTELLATION */
  .constellation-card{
    margin:24px 0; border:1px solid var(--line); border-radius:20px;
    background:linear-gradient(180deg,#0d0922,#070512);
    box-shadow:0 0 60px #5e2bff22, 0 0 0 1px #ffffff05 inset; overflow:hidden;
  }
  svg.constellation{display:block; width:100%; height:auto}
  text.branch-label{font-family:"Segoe UI",sans-serif; font-weight:600}

  /* SECTION TITLES */
  h2.section{font-size:13px; letter-spacing:4px; color:var(--muted);
    text-transform:uppercase; margin:28px 4px 12px}

  /* QUEST BOARD */
  .quests{display:grid; gap:10px}
  .quest{
    display:flex; align-items:center; gap:14px; padding:14px 16px;
    border:1px solid var(--line); border-radius:14px;
    background:linear-gradient(180deg,#120c2b,#0b0820); cursor:pointer;
    transition:transform .12s ease, box-shadow .2s ease, opacity .3s ease;
  }
  .quest:hover{transform:translateY(-1px); box-shadow:0 0 28px #7b2bff33}
  .quest.done{opacity:.45; }
  .quest .check{
    width:26px; height:26px; border-radius:50%; border:2px solid var(--aura);
    display:grid; place-items:center; flex:0 0 auto; transition:.2s;
    box-shadow:0 0 12px #7b2bff55;
  }
  .quest.done .check{background:var(--aura); box-shadow:0 0 22px var(--aura)}
  .quest .name{flex:1; font-weight:600}
  .quest .tags{display:flex; gap:8px; align-items:center}
  .tag{font-size:11px; color:var(--muted); border:1px solid var(--line);
    border-radius:8px; padding:3px 8px}
  .tag.branch{color:#c9a8ff}

  /* BUTTONS */
  button.action{
    border:1px solid var(--line); background:#160e36; color:var(--text);
    border-radius:12px; padding:11px 16px; cursor:pointer; font-size:14px;
    transition:.15s; box-shadow:0 0 18px #5e2bff22;
  }
  button.action:hover{border-color:var(--aura); box-shadow:0 0 24px #7b2bff55}
  .row{display:flex; gap:10px; flex-wrap:wrap; margin-top:14px}

  /* FORMS / MODALS */
  dialog{
    border:1px solid var(--line); border-radius:18px; color:var(--text);
    background:linear-gradient(180deg,#0e0a22,#080513); padding:0; width:min(440px,92vw);
    box-shadow:0 0 80px #5e2bff44;
  }
  dialog::backdrop{background:#04020a; opacity:.7; backdrop-filter:blur(3px)}
  .dlg-body{padding:22px}
  .dlg-body h3{margin:0 0 16px; font-weight:700}
  label.field{display:block; margin-bottom:14px; font-size:13px; color:var(--muted)}
  label.field input, label.field select{
    width:100%; margin-top:6px; padding:10px 12px; border-radius:10px;
    border:1px solid var(--line); background:#0a0718; color:var(--text); font-size:15px;
  }

  /* AURA POP (floating +N on earn) */
  .aura-pop{
    position:fixed; z-index:50; pointer-events:none; font-weight:800;
    color:#e9d4ff; text-shadow:0 0 18px var(--aura); font-size:26px;
    animation:floatUp 1.1s ease-out forwards;
  }
  @keyframes floatUp{
    0%{transform:translate(-50%,0) scale(.8); opacity:0}
    20%{opacity:1; transform:translate(-50%,-10px) scale(1.1)}
    100%{transform:translate(-50%,-70px) scale(1); opacity:0}
  }
  /* RANK-UP banner */
  .rankup{
    position:fixed; inset:0; z-index:60; display:grid; place-items:center;
    pointer-events:none; opacity:0;
  }
  .rankup.show{animation:rankFlash 2.4s ease forwards}
  .rankup .inner{
    text-align:center; font-size:clamp(28px,6vw,56px); font-weight:800;
    color:#fff; text-shadow:0 0 50px var(--aura);
  }
  .rankup .inner small{display:block; font-size:14px; letter-spacing:6px; color:#c9a8ff; margin-bottom:8px}
  @keyframes rankFlash{
    0%{opacity:0; transform:scale(.9)}
    15%{opacity:1; transform:scale(1)}
    85%{opacity:1}
    100%{opacity:0}
  }
  .warn{margin:14px 4px; color:#ffd0d0; font-size:13px; text-align:center;
    border:1px solid #5a2030; background:#2a0c14; border-radius:10px; padding:10px; display:none}
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <div class="aura-label">Total Aura</div>
      <div class="aura-total" id="auraTotal">0</div>
      <div class="meta">
        <div class="pill"><span class="k">RANK</span><span class="rank" id="rank">Dormant</span></div>
        <div class="pill"><span class="k">STREAK</span><span id="streak">0</span> 🔥</div>
        <div class="pill"><span class="k">TODAY</span><span id="todayCount">0</span> done</div>
      </div>
    </header>

    <div id="storageWarn" class="warn"></div>

    <div class="constellation-card" id="constellation"></div>

    <h2 class="section">Today's Quests</h2>
    <div class="quests" id="questBoard"></div>
    <div class="row">
      <button class="action" id="addBtn">➕ Add quest</button>
      <button class="action" id="manageBtn">✎ Manage dailies</button>
      <button class="action" id="backupBtn">☁ Backup / restore</button>
    </div>
  </div>

  <script src="aura-core.js"></script>
  <script>
    // App wiring is added in later tasks.
    document.getElementById('constellation').innerHTML =
      AuraCore.buildConstellationSVG(AuraCore.freshState(AuraCore.dateStr(new Date())));
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify it loads and looks right**

Open `index.html` in a browser (double-click, or use the run/verify tooling). Expected: a dark mystic page, a big glowing "0" aura total, RANK/STREAK/TODAY pills, and a constellation card showing four labeled star clusters (BODY/MIND/CRAFT/SPIRIT) with twinkling stars.

If Playwright is available, navigate to the file URL and take a screenshot to confirm the glow/starfield render.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: add mystic app shell and render seed constellation"
```

---

## Task 11: Store seam (localStorage with injectable backend)

**Files:**
- Modify: `index.html` (add a `<script>` block defining `Store` before the app-wiring script)
- Test: `tests/store.test.js`

The Store is the ONLY persistence touchpoint. It is written so its backend is injectable, which makes it Node-testable with a fake and keeps the future-backend swap to one module. Define `Store` as a factory on `window.Store` so both the browser and a Node test can construct it.

- [ ] **Step 1: Write the failing test**

Create `tests/store.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');

// Minimal localStorage-shaped fake.
function fakeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

const core = require('../aura-core.js');
const { createStore } = require('../store.js');

test('load returns a fresh state when storage is empty', () => {
  const store = createStore(fakeStorage(), core, () => '2026-06-05');
  const s = store.load();
  assert.equal(s.player.totalAura, 0);
  assert.equal(s.today.date, '2026-06-05');
});

test('save then load round-trips state', () => {
  const backend = fakeStorage();
  const store = createStore(backend, core, () => '2026-06-05');
  const s = store.load();
  s.player.totalAura = 123;
  store.save(s);
  const reloaded = store.load();
  assert.equal(reloaded.player.totalAura, 123);
});

test('load applies day rollover when the saved day is stale', () => {
  const backend = fakeStorage();
  let today = '2026-06-05';
  const store = createStore(backend, core, () => today);
  const s = store.load();
  s.today.completedQuestIds = ['x'];
  store.save(s);
  today = '2026-06-06';
  const next = store.load();
  assert.equal(next.today.date, '2026-06-06');
  assert.deepEqual(next.today.completedQuestIds, []);
});

test('corrupt save falls back to fresh state without throwing', () => {
  const backend = fakeStorage();
  backend.setItem('auraquest.save', '{not valid json');
  const store = createStore(backend, core, () => '2026-06-05');
  const s = store.load();
  assert.equal(s.player.totalAura, 0);
  assert.ok(backend.getItem('auraquest.corrupt'), 'preserves the corrupt blob');
});

test('exportJSON/importJSON round-trips', () => {
  const store = createStore(fakeStorage(), core, () => '2026-06-05');
  const s = store.load();
  s.player.totalAura = 777;
  const json = store.exportJSON(s);
  const imported = store.importJSON(json);
  assert.equal(imported.player.totalAura, 777);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `Cannot find module '../store.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `store.js` (a classic script, dual-exported like `aura-core.js` so it loads in the browser AND in Node tests):

```js
// store.js — the ONE persistence seam. Backend is injected (localStorage in the
// browser, a fake in tests, a server adapter in a future "Option B").
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.Store = api;
})(typeof window !== 'undefined' ? window : null, function () {
  const KEY = 'auraquest.save';
  const CORRUPT_KEY = 'auraquest.corrupt';

  function createStore(backend, core, nowDateStr) {
    function today() { return nowDateStr(); }

    function load() {
      const raw = backend.getItem(KEY);
      if (!raw) return core.freshState(today());
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        backend.setItem(CORRUPT_KEY, raw); // keep for manual recovery
        return core.freshState(today());
      }
      const rolled = core.rolloverIfNewDay(parsed, today());
      return rolled;
    }

    function save(state) {
      backend.setItem(KEY, JSON.stringify(state));
      return state;
    }

    function exportJSON(state) {
      return JSON.stringify(state, null, 2);
    }

    function importJSON(json) {
      const parsed = JSON.parse(json);
      save(parsed);
      return parsed;
    }

    return { load, save, exportJSON, importJSON };
  }

  return { createStore };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS (all store tests green).

- [ ] **Step 5: Wire `store.js` into `index.html`**

In `index.html`, add before the app-wiring `<script>`:

```html
<script src="store.js"></script>
```

- [ ] **Step 6: Commit**

```bash
git add store.js tests/store.test.js index.html
git commit -m "feat: add injectable localStorage store seam with rollover and corrupt-recovery"
```

---

## Task 12: App wiring — render loop, complete quests, animations

**Files:**
- Modify: `index.html` (replace the placeholder app-wiring `<script>` at the bottom)

This connects everything: build a live store on `window.localStorage`, render header + constellation + quest board from state, complete quests on click with the floating `+N` pop and rank-up banner, and auto-save after every action.

- [ ] **Step 1: Replace the bottom app-wiring script**

Replace the final `<script> ... </script>` block (the placeholder from Task 10) with:

```html
<script>
(function () {
  const core = window.AuraCore;
  const DIFF_ICON = { quick: '⚡', solid: '🔥', epic: '💎' };

  // ---- storage backend with graceful fallback ----
  let backend, storageOk = true;
  try {
    window.localStorage.setItem('auraquest.ping', '1');
    window.localStorage.removeItem('auraquest.ping');
    backend = window.localStorage;
  } catch (e) {
    storageOk = false;
    const mem = new Map();
    backend = { getItem: k => mem.has(k) ? mem.get(k) : null,
                setItem: (k, v) => mem.set(k, String(v)),
                removeItem: k => mem.delete(k) };
  }
  const store = window.Store.createStore(backend, core, () => core.dateStr(new Date()));
  let state = store.load();

  if (!storageOk) {
    const w = document.getElementById('storageWarn');
    w.style.display = 'block';
    w.textContent = '⚠ This browser is blocking local storage (private mode?). Progress won\'t persist — use Backup → Export to save manually.';
  }

  // ---- render ----
  const el = id => document.getElementById(id);
  function render() {
    const today = core.dateStr(new Date());
    el('auraTotal').textContent = state.player.totalAura.toLocaleString();
    el('rank').textContent = state.player.rank;
    el('streak').textContent = core.currentStreak(state.player.streak, today);
    el('todayCount').textContent = state.today.completedQuestIds.length;
    el('constellation').innerHTML = core.buildConstellationSVG(state);

    const board = el('questBoard');
    board.innerHTML = '';
    core.activeQuests(state).forEach(q => {
      const done = state.today.completedQuestIds.includes(q.id);
      const div = document.createElement('div');
      div.className = 'quest' + (done ? ' done' : '');
      div.innerHTML =
        `<div class="check">${done ? '✦' : ''}</div>` +
        `<div class="name">${escapeHtml(q.name)}</div>` +
        `<div class="tags">` +
          `<span class="tag branch">${q.branch}</span>` +
          `<span class="tag">${DIFF_ICON[q.difficulty]} ${q.difficulty}</span>` +
          (q.type === 'custom' ? `<span class="tag">one-off</span>` : '') +
        `</div>`;
      if (!done) div.addEventListener('click', (ev) => onComplete(q.id, ev));
      board.appendChild(div);
    });
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  // ---- complete a quest ----
  function onComplete(questId, ev) {
    const today = core.dateStr(new Date());
    const next = core.completeQuest(state, questId, today);
    if (next === state) return;
    state = next;
    store.save(state);
    const earned = state.lastEarned;
    auraPop(`+${earned.amount}`, ev.clientX, ev.clientY);
    if (earned.perfectBonus > 0) {
      setTimeout(() => auraPop(`PERFECT DAY +${earned.perfectBonus}`, window.innerWidth/2, 160), 350);
    }
    if (earned.rankedUp) {
      setTimeout(() => rankUp(earned.rank), 500);
    }
    render();
  }

  function auraPop(text, x, y) {
    const p = document.createElement('div');
    p.className = 'aura-pop';
    p.textContent = text;
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1200);
  }

  function rankUp(rank) {
    const banner = document.createElement('div');
    banner.className = 'rankup show';
    banner.innerHTML = `<div class="inner"><small>RANK UP</small>${rank}</div>`;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 2500);
  }

  // expose for later tasks (add/manage/backup wiring)
  window.__aura = {
    get state() { return state; },
    set state(s) { state = s; },
    store, render, core,
  };

  render();
})();
</script>
```

- [ ] **Step 2: Verify in browser**

Open `index.html`. Expected: seed quests listed; clicking one marks it done, floats a `+25` (etc.) where you clicked, the aura total climbs, the TODAY counter and constellation update, and completing every daily fires a "PERFECT DAY +50". Reload the page → progress persists. Use Playwright to click a quest and screenshot if available.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: wire live store, quest completion, aura pop and rank-up"
```

---

## Task 13: Add-quest + manage-dailies + backup dialogs

**Files:**
- Modify: `index.html` (add `<dialog>` markup in `.wrap` and wiring inside the app IIFE)

- [ ] **Step 1: Add dialog markup**

Inside `.wrap`, after the `.row` of buttons, add:

```html
<dialog id="questDialog">
  <form method="dialog" class="dlg-body">
    <h3 id="questDlgTitle">Add a quest</h3>
    <label class="field">Name
      <input id="qName" required maxlength="60" placeholder="e.g. Finish mixing track 3">
    </label>
    <label class="field">Branch
      <select id="qBranch">
        <option>Body</option><option>Mind</option><option>Craft</option><option>Spirit</option>
      </select>
    </label>
    <label class="field">Difficulty
      <select id="qDiff">
        <option value="quick">⚡ Quick (10)</option>
        <option value="solid" selected>🔥 Solid (25)</option>
        <option value="epic">💎 Epic (60)</option>
      </select>
    </label>
    <label class="field">Type
      <select id="qType">
        <option value="custom">One-off (custom)</option>
        <option value="daily">Daily (recurring)</option>
      </select>
    </label>
    <div class="row">
      <button class="action" value="cancel">Cancel</button>
      <button class="action" id="qSave" value="save">Save quest</button>
    </div>
  </form>
</dialog>

<dialog id="manageDialog">
  <div class="dlg-body">
    <h3>Manage daily quests</h3>
    <div id="manageList" class="quests"></div>
    <div class="row"><button class="action" id="manageClose">Done</button></div>
  </div>
</dialog>

<dialog id="backupDialog">
  <div class="dlg-body">
    <h3>Backup &amp; restore</h3>
    <p style="color:var(--muted);font-size:13px">Export saves your whole grind as a file. Import restores it (and is your path to a new device).</p>
    <div class="row">
      <button class="action" id="exportBtn">⬇ Export save</button>
      <button class="action" id="importBtn">⬆ Import save</button>
      <button class="action" id="resetBtn">⟲ Reset everything</button>
    </div>
    <input type="file" id="importFile" accept="application/json" style="display:none">
    <button class="action" id="backupClose" style="margin-top:16px">Close</button>
  </div>
</dialog>
```

- [ ] **Step 2: Add wiring inside the app IIFE**

Inside the IIFE in the bottom script (before the final `render();`), add:

```js
  // ---- Add quest ----
  const questDialog = el('questDialog');
  el('addBtn').addEventListener('click', () => {
    el('questDlgTitle').textContent = 'Add a quest';
    el('qName').value = '';
    questDialog.returnValue = '';
    questDialog.showModal();
  });
  questDialog.addEventListener('close', () => {
    if (questDialog.returnValue !== 'save') return;
    const name = el('qName').value.trim();
    if (!name) return;
    state = core.addQuest(state, {
      name,
      branch: el('qBranch').value,
      difficulty: el('qDiff').value,
      type: el('qType').value,
    });
    store.save(state);
    render();
  });

  // ---- Manage dailies (remove) ----
  const manageDialog = el('manageDialog');
  el('manageBtn').addEventListener('click', () => {
    const list = el('manageList');
    list.innerHTML = '';
    state.quests.filter(q => q.type === 'daily').forEach(q => {
      const row = document.createElement('div');
      row.className = 'quest';
      row.innerHTML = `<div class="name">${escapeHtml(q.name)}</div>` +
        `<div class="tags"><span class="tag branch">${q.branch}</span>` +
        `<span class="tag">${DIFF_ICON[q.difficulty]}</span></div>`;
      const del = document.createElement('button');
      del.className = 'action'; del.textContent = '✕';
      del.addEventListener('click', () => {
        state = core.removeQuest(state, q.id);
        store.save(state);
        render();
        el('manageBtn').click(); // refresh list
        manageDialog.close();
      });
      row.appendChild(del);
      list.appendChild(row);
    });
    manageDialog.showModal();
  });
  el('manageClose').addEventListener('click', () => manageDialog.close());

  // ---- Backup ----
  const backupDialog = el('backupDialog');
  el('backupBtn').addEventListener('click', () => backupDialog.showModal());
  el('backupClose').addEventListener('click', () => backupDialog.close());
  el('exportBtn').addEventListener('click', () => {
    const blob = new Blob([store.exportJSON(state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `aura-quest-${core.dateStr(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });
  el('importBtn').addEventListener('click', () => el('importFile').click());
  el('importFile').addEventListener('change', (ev) => {
    const file = ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        state = store.importJSON(reader.result);
        render();
        backupDialog.close();
      } catch (e) {
        alert('That file is not a valid Aura Quest save.');
      }
    };
    reader.readAsText(file);
  });
  el('resetBtn').addEventListener('click', () => {
    if (!confirm('Reset ALL progress? Export first if you want a backup.')) return;
    state = core.freshState(core.dateStr(new Date()));
    store.save(state);
    render();
    backupDialog.close();
  });
```

- [ ] **Step 3: Verify in browser**

Open `index.html`. Expected: "➕ Add quest" opens the dialog and a saved custom quest appears on the board; "✎ Manage dailies" lists dailies with ✕ removal; "☁ Backup" exports a `.json` download, re-imports it, and reset returns to seed state. Confirm a custom quest disappears after you complete it, and reappears nowhere after the next day.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add quest creation, daily management, and backup/restore dialogs"
```

---

## Task 14: Full-run verification + README

**Files:**
- Create: `README.md`
- Test: full `node --test` run + manual end-to-end

- [ ] **Step 1: Run the whole test suite**

Run: `node --test`
Expected: all tests across `tests/aura-core.test.js` and `tests/store.test.js` PASS.

- [ ] **Step 2: Manual end-to-end pass**

Open `index.html` fresh (reset first). Walk the full loop: complete several quests across different branches, watch aura climb, branches gain stars, a rank-up fire at 500, a perfect day bonus land, reload to confirm persistence, export a backup, reset, and re-import to confirm restore.

- [ ] **Step 3: Write `README.md`**

```markdown
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
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add README and finalize v1"
```

---

## Self-Review Notes

- **Spec coverage:** aesthetic/mystic (Task 10 CSS), four branches (Tasks 6/9), daily + custom quests (Tasks 6/8/13), difficulty→aura (Task 2), pure ascension + ranks (Tasks 2/7), streaks ≥1/day + multiplier + perfect-day (Tasks 5/7), constellation character (Task 9), four screens (Tasks 10/12/13), single-folder file:// (Task 10), isolated store seam + export/import (Task 11/13), edge cases: storage-unavailable (Task 12), corrupt save (Task 11), rollover/missed days (Tasks 6/11), testing of pure logic (Tasks 2–9, 11). All spec requirements map to a task.
- **Type consistency:** `state.lastEarned` shape ({amount, perfectBonus, rankedUp, rank, branch, questId}) is produced in Task 7 and consumed in Task 12. `currentStreak`, `activeQuests`, `buildConstellationSVG`, `addQuest/removeQuest`, `createStore` names match between definition and use. Storage key `auraquest.save` consistent across Store and tests.
- **Note on single-file:** spec preferred one file; plan uses three co-located files (`index.html` + `aura-core.js` + `store.js`) loaded via classic `<script src>` (works on `file://`; only ES-module imports are blocked there). This preserves Node-testability of the core while keeping double-click-to-run and zero dependencies. Documented in README.
