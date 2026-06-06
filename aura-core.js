// aura-core.js — pure game logic. No DOM, no storage.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AuraCore = api;
})(typeof window !== 'undefined' ? window : null, function () {
  const CORE_VERSION = 1;

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

  return { CORE_VERSION, DIFFICULTY_AURA, BRANCHES, PERFECT_DAY_BONUS, RANKS, resolveRank };
});
