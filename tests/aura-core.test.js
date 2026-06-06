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
