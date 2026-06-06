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
