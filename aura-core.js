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

  // Multiplier uses the POST-completion streak count, so the first completion of a
  // fresh streak is streak day 1 => x1.05 (not x1.0).
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
        + `letter-spacing="2">${branch} · ${state.branches[branch].aura}</text>`;
    });

    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" `
      + `xmlns="http://www.w3.org/2000/svg" class="constellation">${links}${stars}${labels}</svg>`;
  }

  return { CORE_VERSION, DIFFICULTY_AURA, BRANCHES, PERFECT_DAY_BONUS, RANKS, resolveRank, dateStr, addDays, streakMultiplier, auraForQuest, updateStreak, currentStreak, freshState, rolloverIfNewDay, makeId, completeQuest, addQuest, removeQuest, activeQuests, starCountFor, buildConstellationSVG };
});
