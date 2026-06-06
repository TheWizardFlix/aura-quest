const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../aura-core.js');

test('core module loads and exposes version', () => {
  assert.equal(core.CORE_VERSION, 2);
});

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

test('updateStreak: first ever completion sets count to 1', () => {
  const s = core.updateStreak({ count: 0, lastCompletedDate: null }, '2026-06-05');
  assert.deepEqual(s, { count: 1, lastCompletedDate: '2026-06-05', best: 1 });
});

test('updateStreak: completing again same day does not change count', () => {
  const s = core.updateStreak({ count: 3, lastCompletedDate: '2026-06-05', best: 3 }, '2026-06-05');
  assert.deepEqual(s, { count: 3, lastCompletedDate: '2026-06-05', best: 3 });
});

test('updateStreak: completing the next day increments', () => {
  const s = core.updateStreak({ count: 3, lastCompletedDate: '2026-06-04', best: 3 }, '2026-06-05');
  assert.deepEqual(s, { count: 4, lastCompletedDate: '2026-06-05', best: 4 });
});

test('updateStreak: a gap resets count to 1 but preserves best-ever', () => {
  const s = core.updateStreak({ count: 9, lastCompletedDate: '2026-06-02', best: 9 }, '2026-06-05');
  assert.deepEqual(s, { count: 1, lastCompletedDate: '2026-06-05', best: 9 });
});

test('currentStreak: 0 if the streak is broken (not today, not yesterday)', () => {
  assert.equal(core.currentStreak({ count: 9, lastCompletedDate: '2026-06-02' }, '2026-06-05'), 0);
  assert.equal(core.currentStreak({ count: 9, lastCompletedDate: '2026-06-04' }, '2026-06-05'), 9);
  assert.equal(core.currentStreak({ count: 9, lastCompletedDate: '2026-06-05' }, '2026-06-05'), 9);
  assert.equal(core.currentStreak({ count: 0, lastCompletedDate: null }, '2026-06-05'), 0);
});

test('freshState builds a valid empty save with four branches and seed quests', () => {
  const s = core.freshState('2026-06-05');
  assert.equal(s.version, 2);
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

function stateWith(quests, today = '2026-06-05') {
  const s = core.freshState(today);
  s.quests = quests.map(q => ({ id: q.id, archived: false, ...q }));
  return s;
}

test('completeQuest adds aura to branch and total, marks done, sets streak to 1', () => {
  const s = stateWith([
    { id: 'a', name: 'Run', branch: 'Body', difficulty: 'solid', type: 'daily' },
    { id: 'b', name: 'Study', branch: 'Mind', difficulty: 'solid', type: 'daily' }, // 2nd daily so Perfect Day does NOT fire here
  ]);
  const out = core.completeQuest(s, 'a', '2026-06-05');
  assert.equal(out.player.streak.count, 1);
  assert.equal(out.lastEarned.amount, 26);   // round(25 * 1.05), day-1 streak multiplier
  assert.equal(out.player.totalAura, 26);
  assert.equal(out.branches.Body.aura, 26);
  assert.deepEqual(out.today.completedQuestIds, ['a']);
  assert.equal(out.today.perfectAwarded, false);
});

test('completeQuest is idempotent — completing the same quest twice does nothing extra', () => {
  const s = stateWith([
    { id: 'a', name: 'Run', branch: 'Body', difficulty: 'solid', type: 'daily' },
    { id: 'b', name: 'Study', branch: 'Mind', difficulty: 'solid', type: 'daily' },
  ]);
  const once = core.completeQuest(s, 'a', '2026-06-05');
  const twice = core.completeQuest(once, 'a', '2026-06-05');
  assert.equal(twice.player.totalAura, 26);
  assert.deepEqual(twice.today.completedQuestIds, ['a']);
});

test('completeQuest awards the Perfect Day bonus once when all dailies are done', () => {
  const s = stateWith([
    { id: 'a', name: 'Run', branch: 'Body', difficulty: 'quick', type: 'daily' },   // round(10*1.05)=11
    { id: 'b', name: 'Study', branch: 'Mind', difficulty: 'quick', type: 'daily' },  // round(10*1.05)=11
  ]);
  const afterA = core.completeQuest(s, 'a', '2026-06-05');
  assert.equal(afterA.today.perfectAwarded, false);
  const afterB = core.completeQuest(afterA, 'b', '2026-06-05');
  // 11 + 11 + 50 perfect bonus = 72
  assert.equal(afterB.player.totalAura, 72);
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
  // Labels are uppercased for the HUD look, so match case-insensitively.
  for (const b of core.BRANCHES) assert.ok(svg.toUpperCase().includes(b.toUpperCase()), `mentions ${b}`);
});

test('buildConstellationSVG draws more stars as a branch gains aura', () => {
  const lo = core.buildConstellationSVG(core.freshState('2026-06-05'));
  const hi = core.freshState('2026-06-05');
  hi.branches.Craft.aura = 300; // 7 stars
  const hiSvg = core.buildConstellationSVG(hi);
  const count = (str) => (str.match(/class="star"/g) || []).length;
  assert.ok(count(hiSvg) > count(lo), 'more aura => more stars');
});

// ---------------------------------------------------------------------------
// v2: day-of-week scheduling
// ---------------------------------------------------------------------------

test('weekdayOf returns 0..6 (Sun..Sat)', () => {
  assert.equal(core.weekdayOf('2026-06-07'), 0); // Sunday
  assert.equal(core.weekdayOf('2026-06-08'), 1); // Monday
  assert.equal(core.weekdayOf('2026-06-06'), 6); // Saturday
});

test('isScheduledOn: null schedule = every day; custom quests always count', () => {
  assert.equal(core.isScheduledOn({ type: 'daily', schedule: null }, '2026-06-08'), true);
  assert.equal(core.isScheduledOn({ type: 'daily', schedule: [] }, '2026-06-08'), true);
  assert.equal(core.isScheduledOn({ type: 'custom' }, '2026-06-08'), true);
});

test('isScheduledOn: a weekday list only matches listed days', () => {
  const mwf = { type: 'daily', schedule: [1, 3, 5] };
  assert.equal(core.isScheduledOn(mwf, '2026-06-08'), true);  // Monday
  assert.equal(core.isScheduledOn(mwf, '2026-06-09'), false); // Tuesday
});

test('completeQuest refuses a quest not scheduled today', () => {
  const s = core.freshState('2026-06-09'); // Tuesday
  s.quests = [{ id: 'a', name: 'Run', branch: 'Body', difficulty: 'solid', type: 'daily', schedule: [1] }]; // Mon only
  const out = core.completeQuest(s, 'a', '2026-06-09');
  assert.equal(out, s, 'unscheduled completion is a no-op');
});

test('Perfect Day ignores quests not scheduled for today', () => {
  const s = core.freshState('2026-06-09'); // Tuesday
  s.quests = [
    { id: 'a', name: 'Run', branch: 'Body', difficulty: 'quick', type: 'daily', schedule: null },     // today
    { id: 'b', name: 'Mon thing', branch: 'Mind', difficulty: 'quick', type: 'daily', schedule: [1] }, // not today
  ];
  const out = core.completeQuest(s, 'a', '2026-06-09'); // only scheduled daily -> perfect
  assert.equal(out.today.perfectAwarded, true);
  assert.equal(out.lastEarned.perfectBonus, 50);
});

// ---------------------------------------------------------------------------
// v2: branch levels + perks
// ---------------------------------------------------------------------------

test('branchLevel is 1 + floor(aura/250); level 5 at 1000', () => {
  assert.equal(core.branchLevel(0), 1);
  assert.equal(core.branchLevel(249), 1);
  assert.equal(core.branchLevel(250), 2);
  assert.equal(core.branchLevel(1000), 5);
});

test('growBranch unlocks the branch perk on reaching level 5', () => {
  const branches = { Body: { aura: 980, level: 4, perks: [] }, Mind: { aura: 0, level: 1, perks: [] }, Craft: { aura: 0, level: 1, perks: [] }, Spirit: { aura: 0, level: 1, perks: [] } };
  const out = core.growBranch(branches, 'Body', 30); // 980 -> 1010 = level 5
  assert.equal(out.branches.Body.level, 5);
  assert.ok(out.branches.Body.perks.includes('body-flow'));
  assert.equal(out.newPerks.length, 1);
  assert.equal(out.newPerks[0].id, 'body-flow');
});

test('Body perk adds +10% aura on Body quests once unlocked', () => {
  const s = core.freshState('2026-06-05');
  s.branches.Body = { aura: 1000, level: 5, perks: ['body-flow'] };
  s.quests = [{ id: 'a', name: 'Run', branch: 'Body', difficulty: 'epic', type: 'custom', schedule: null }];
  const out = core.completeQuest(s, 'a', '2026-06-05');
  // base epic day-1 = round(60*1.05)=63, +10% perk = round(63*1.1)=69
  assert.equal(out.lastEarned.amount, 69);
});

test('Spirit perk boosts the Perfect-Day bonus by 50%', () => {
  const s = core.freshState('2026-06-05');
  s.branches.Spirit = { aura: 1000, level: 5, perks: ['spirit-deep'] };
  s.quests = [{ id: 'a', name: 'Sit', branch: 'Spirit', difficulty: 'quick', type: 'daily', schedule: null }];
  const out = core.completeQuest(s, 'a', '2026-06-05');
  assert.equal(out.lastEarned.perfectBonus, 75); // 50 * 1.5
});

// ---------------------------------------------------------------------------
// v2: achievements
// ---------------------------------------------------------------------------

test('first completion unlocks the First Light achievement, exactly once', () => {
  const s = stateWith([{ id: 'a', name: 'Run', branch: 'Body', difficulty: 'solid', type: 'daily' }]);
  const out = core.completeQuest(s, 'a', '2026-06-05');
  const ids = out.achievements.map(a => a.id);
  assert.ok(ids.includes('first-light'));
  // completing another quest the same day must not re-award it
  const s2 = core.addQuest(out, { name: 'Read', branch: 'Mind', difficulty: 'quick', type: 'daily', schedule: null });
  const id2 = s2.quests[s2.quests.length - 1].id;
  const out2 = core.completeQuest(s2, id2, '2026-06-05');
  assert.equal(out2.achievements.filter(a => a.id === 'first-light').length, 1);
  assert.ok(!out2.lastEarned.newAchievements.find(a => a.id === 'first-light'));
});

test('crossing 500 total aura unlocks the Awakened achievement', () => {
  const s = stateWith([{ id: 'a', name: 'Epic', branch: 'Craft', difficulty: 'epic', type: 'custom' }]);
  s.player.totalAura = 480;
  const out = core.completeQuest(s, 'a', '2026-06-05'); // -> 543
  assert.ok(out.lastEarned.newAchievements.find(a => a.id === 'rank-awakening'));
});

// ---------------------------------------------------------------------------
// v2: perfect week surge
// ---------------------------------------------------------------------------

test('a 7th consecutive perfect day fires the Perfect Week surge once', () => {
  const s = stateWith([{ id: 'a', name: 'Run', branch: 'Body', difficulty: 'quick', type: 'daily' }], '2026-06-10');
  // seed 6 prior perfect days
  s.history = [];
  for (let i = 6; i >= 1; i--) s.history.push({ date: core.addDays('2026-06-10', -i), perfectDay: true, auraEarned: 11 });
  const out = core.completeQuest(s, 'a', '2026-06-10'); // today becomes perfect -> 7 in a row
  assert.equal(out.lastEarned.surge, core.PERFECT_WEEK_BONUS);
  assert.equal(out.lastEarned.surgeReason, 'Perfect Week');
  assert.equal(out.player.perfectWeeks, 1);
  assert.ok(out.achievements.find(a => a.id === 'first-perfect-week'));
});

test('perfect week does not fire if a prior day was missed', () => {
  const s = stateWith([{ id: 'a', name: 'Run', branch: 'Body', difficulty: 'quick', type: 'daily' }], '2026-06-10');
  s.history = [];
  for (let i = 6; i >= 1; i--) s.history.push({ date: core.addDays('2026-06-10', -i), perfectDay: i !== 3, auraEarned: 11 });
  const out = core.completeQuest(s, 'a', '2026-06-10');
  assert.equal(out.lastEarned.surge, 0);
});

// ---------------------------------------------------------------------------
// v2: trials
// ---------------------------------------------------------------------------

test('completing trial-target quests in the window completes the trial with a surge', () => {
  let s = core.freshState('2026-06-05');
  s.quests = [
    { id: 'a', name: 'Mix', branch: 'Craft', difficulty: 'solid', type: 'daily', schedule: null },
    { id: 'b', name: 'Master', branch: 'Craft', difficulty: 'solid', type: 'daily', schedule: null },
  ];
  s = core.addTrial(s, { name: 'Album sprint', branch: 'Craft', target: 2, startDate: '2026-06-01', endDate: '2026-06-30' });
  s = core.completeQuest(s, 'a', '2026-06-05');
  assert.equal(s.trials[0].progress, 1);
  assert.equal(s.trials[0].status, 'active');
  s = core.completeQuest(s, 'b', '2026-06-05');
  assert.equal(s.trials[0].status, 'complete');
  assert.equal(s.lastEarned.surge, core.TRIAL_BONUS);
  assert.equal(s.lastEarned.surgeReason, 'Trial Complete');
  assert.ok(s.achievements.find(a => a.id === 'first-trial'));
});

test('a trial only advances for its own branch', () => {
  let s = core.freshState('2026-06-05');
  s.quests = [{ id: 'a', name: 'Run', branch: 'Body', difficulty: 'solid', type: 'daily', schedule: null }];
  s = core.addTrial(s, { name: 'Craft only', branch: 'Craft', target: 1, startDate: '2026-06-01', endDate: '2026-06-30' });
  s = core.completeQuest(s, 'a', '2026-06-05');
  assert.equal(s.trials[0].progress, 0);
  assert.equal(s.trials[0].status, 'active');
});

test('rolloverIfNewDay expires trials past their end date', () => {
  let s = core.freshState('2026-06-05');
  s = core.addTrial(s, { name: 'Old', branch: null, target: 5, startDate: '2026-06-01', endDate: '2026-06-04' });
  const out = core.rolloverIfNewDay(s, '2026-06-06');
  assert.equal(out.trials[0].status, 'expired');
});

// ---------------------------------------------------------------------------
// v2: reflection
// ---------------------------------------------------------------------------

test('setReflection grants Spirit aura once per day and stores the entry', () => {
  const s = core.freshState('2026-06-05');
  const out = core.setReflection(s, { mood: 'calm', note: 'good day' }, '2026-06-05');
  assert.equal(out.today.reflection.mood, 'calm');
  assert.equal(out.branches.Spirit.aura, core.REFLECTION_AURA);
  assert.equal(out.player.totalAura, core.REFLECTION_AURA);
  // second call same day is a no-op
  const again = core.setReflection(out, { mood: 'tired', note: 'x' }, '2026-06-05');
  assert.equal(again, out);
});

// ---------------------------------------------------------------------------
// v2: migration
// ---------------------------------------------------------------------------

test('migrate upgrades a v1 save to v2 and preserves totals', () => {
  const v1 = {
    version: 1,
    player: { totalAura: 1234, rank: 'Awakening', createdAt: '2026-05-01', lastActiveDate: '2026-06-04', streak: { count: 5, lastCompletedDate: '2026-06-04' } },
    branches: { Body: { aura: 600, level: 1 }, Mind: { aura: 200, level: 1 }, Craft: { aura: 434, level: 1 }, Spirit: { aura: 0, level: 1 } },
    quests: [{ id: 'q1', name: 'Run', branch: 'Body', difficulty: 'solid', type: 'daily' }],
    today: { date: '2026-06-04', completedQuestIds: ['q1'], perfectAwarded: false },
    history: [{ date: '2026-06-03', completedCount: 2, perfectDay: true }],
  };
  const out = core.migrate(v1);
  assert.equal(out.version, 2);
  assert.equal(out.player.totalAura, 1234);
  assert.equal(out.player.streak.best, 5);
  assert.equal(out.player.perfectWeeks, 0);
  assert.deepEqual(out.branches.Body.perks, []);
  assert.equal(out.quests[0].schedule, null);
  assert.deepEqual(out.trials, []);
  assert.deepEqual(out.achievements, []);
  assert.equal(out.today.reflection, null);
});

test('migrate is idempotent on a v2 save', () => {
  const s = core.freshState('2026-06-05');
  assert.equal(core.migrate(s), s); // already current -> returned as-is
});

// ---------------------------------------------------------------------------
// v2: stats helpers
// ---------------------------------------------------------------------------

test('auraByDate merges history with the live today total', () => {
  const s = core.freshState('2026-06-05');
  s.history = [{ date: '2026-06-03', auraEarned: 40, perfectDay: false }, { date: '2026-06-04', auraEarned: 25, perfectDay: false }];
  s.today.auraEarned = 60;
  const map = core.auraByDate(s);
  assert.equal(map['2026-06-03'], 40);
  assert.equal(map['2026-06-04'], 25);
  assert.equal(map['2026-06-05'], 60);
});

test('completionStats counts only scheduled dailies for today', () => {
  const s = core.freshState('2026-06-09'); // Tuesday
  s.quests = [
    { id: 'a', name: 'A', branch: 'Body', difficulty: 'quick', type: 'daily', schedule: null },
    { id: 'b', name: 'B', branch: 'Mind', difficulty: 'quick', type: 'daily', schedule: [1] }, // Mon only - excluded
  ];
  s.today.completedQuestIds = ['a'];
  const cs = core.completionStats(s, '2026-06-09');
  assert.deepEqual(cs, { done: 1, scheduled: 1 });
});
