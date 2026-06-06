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

  function streakMultiplier(streakDays) {
    return Math.min(2.0, 1 + 0.05 * streakDays);
  }

  function auraForQuest(difficulty, streakDays) {
    const base = DIFFICULTY_AURA[difficulty];
    return Math.round(base * streakMultiplier(streakDays));
  }

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

  return { CORE_VERSION, DIFFICULTY_AURA, BRANCHES, PERFECT_DAY_BONUS, RANKS, resolveRank, dateStr, addDays, streakMultiplier, auraForQuest, updateStreak, currentStreak, freshState, rolloverIfNewDay, makeId };
});
