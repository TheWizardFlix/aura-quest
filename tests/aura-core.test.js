const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../aura-core.js');

test('core module loads and exposes version', () => {
  assert.equal(core.CORE_VERSION, 1);
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
