// aura-core.js — pure game logic. No DOM, no storage.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.AuraCore = api;
})(typeof window !== 'undefined' ? window : null, function () {
  const CORE_VERSION = 2;

  const DIFFICULTY_AURA = { quick: 10, solid: 25, epic: 60 };
  const BRANCHES = ['Body', 'Mind', 'Craft', 'Spirit'];
  const PERFECT_DAY_BONUS = 50;
  const REFLECTION_AURA = 10;       // flat Spirit aura for a daily reflection
  const PERFECT_WEEK_BONUS = 300;   // Aura Surge for 7 perfect days in a row
  const TRIAL_BONUS = 200;          // Aura Surge for completing a Trial
  const RANKS = [
    { name: 'Dormant', min: 0 },
    { name: 'Awakening', min: 500 },
    { name: 'Radiant', min: 2000 },
    { name: 'Ascended', min: 6000 },
    { name: 'Transcendent', min: 15000 },
  ];

  // Branch leveling: one level per BRANCH_LEVEL_STEP aura, starting at level 1.
  // Level 5 (1000 aura) is the perk-unlock milestone.
  const BRANCH_LEVEL_STEP = 250;
  function branchLevel(aura) { return 1 + Math.floor(aura / BRANCH_LEVEL_STEP); }

  // Passive perks unlock at a branch level milestone. Purely additive, never a
  // penalty. `auraMult` boosts aura on that branch's quests; `perfectMult`
  // (Spirit) boosts the Perfect-Day bonus.
  const PERKS = {
    Body:   { id: 'body-flow',    level: 5, name: 'Iron Flow',     desc: '+10% aura on Body quests',   auraMult: 1.10 },
    Mind:   { id: 'mind-clarity', level: 5, name: 'Clarity',       desc: '+10% aura on Mind quests',   auraMult: 1.10 },
    Craft:  { id: 'craft-forge',  level: 5, name: 'Forgesight',    desc: '+10% aura on Craft quests',  auraMult: 1.10 },
    Spirit: { id: 'spirit-deep',  level: 5, name: 'Deep Stillness', desc: 'Perfect-Day bonus +50%',    perfectMult: 1.50 },
  };

  // Achievements are deterministic milestone badges, evaluated as pure
  // predicates over state. They NEVER fire on app-open — only when a completing
  // action changes the state that satisfies a predicate.
  const ACHIEVEMENTS = [
    { id: 'first-light',   name: 'First Light',    desc: 'Earn your first aura',        test: s => s.player.totalAura > 0 },
    { id: 'streak-7',      name: 'Kindled',        desc: '7-day streak',                test: s => (s.player.streak.best || 0) >= 7 },
    { id: 'streak-30',     name: 'Relentless',     desc: '30-day streak',               test: s => (s.player.streak.best || 0) >= 30 },
    { id: 'streak-100',    name: 'Unbroken',       desc: '100-day streak',              test: s => (s.player.streak.best || 0) >= 100 },
    { id: 'rank-awakening', name: 'Awakened',      desc: 'Reach Awakening',             test: s => s.player.totalAura >= 500 },
    { id: 'rank-radiant',  name: 'Radiance',       desc: 'Reach Radiant',               test: s => s.player.totalAura >= 2000 },
    { id: 'rank-ascended', name: 'Ascension',      desc: 'Reach Ascended',              test: s => s.player.totalAura >= 6000 },
    { id: 'rank-transcendent', name: 'Transcendence', desc: 'Reach Transcendent',      test: s => s.player.totalAura >= 15000 },
    { id: 'branch-1k',     name: 'Branch Master',  desc: '1,000 aura in one branch',    test: s => BRANCHES.some(b => s.branches[b].aura >= 1000) },
    { id: 'all-l5',        name: 'Constellation',  desc: 'All four branches at level 5', test: s => BRANCHES.every(b => branchLevel(s.branches[b].aura) >= 5) },
    { id: 'first-trial',   name: 'Trial by Fire',  desc: 'Complete your first Trial',   test: s => (s.trials || []).some(t => t.status === 'complete') },
    { id: 'first-perfect-week', name: 'Perfect Week', desc: 'Seven perfect days in a row', test: s => (s.player.perfectWeeks || 0) >= 1 },
  ];

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function weekdayOf(yyyymmdd) {
    const [y, m, d] = yyyymmdd.split('-').map(Number);
    return new Date(y, m - 1, d).getDay(); // 0=Sun..6=Sat
  }
  // A daily with no schedule (null) runs every day; otherwise only on the listed weekdays.
  function isScheduledOn(quest, yyyymmdd) {
    if (quest.type !== 'daily') return true;
    if (!quest.schedule || quest.schedule.length === 0) return true;
    return quest.schedule.includes(weekdayOf(yyyymmdd));
  }

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
    const best = streak.best || streak.count || 0;
    if (streak.lastCompletedDate === today) return { ...streak, best };
    let count;
    if (streak.lastCompletedDate === addDays(today, -1)) count = streak.count + 1;
    else count = 1;
    return { count, lastCompletedDate: today, best: Math.max(best, count) };
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
    { name: 'Morning run', branch: 'Body', difficulty: 'solid', type: 'daily', schedule: null },
    { name: 'Eat clean today', branch: 'Body', difficulty: 'quick', type: 'daily', schedule: null },
    { name: 'Study 1 hour', branch: 'Mind', difficulty: 'solid', type: 'daily', schedule: null },
    { name: 'Read 15 minutes', branch: 'Mind', difficulty: 'quick', type: 'daily', schedule: null },
    { name: 'Album session', branch: 'Craft', difficulty: 'solid', type: 'daily', schedule: null },
    { name: 'Engineering deep work', branch: 'Craft', difficulty: 'epic', type: 'daily', schedule: null },
    { name: 'Meditate / journal', branch: 'Spirit', difficulty: 'quick', type: 'daily', schedule: null },
    { name: 'Stayed off socials', branch: 'Spirit', difficulty: 'solid', type: 'daily', schedule: null },
  ];

  function freshState(today) {
    const branches = {};
    for (const b of BRANCHES) branches[b] = { aura: 0, level: 1, perks: [] };
    return {
      version: CORE_VERSION,
      player: {
        totalAura: 0,
        rank: 'Dormant',
        createdAt: today,
        lastActiveDate: today,
        perfectWeeks: 0,
        streak: { count: 0, lastCompletedDate: null, best: 0 },
      },
      branches,
      quests: SEED_QUESTS.map(q => ({ id: makeId(), archived: false, ...q })),
      trials: [],
      achievements: [],
      today: { date: today, completedQuestIds: [], perfectAwarded: false, perfectWeekAwarded: false, reflection: null, auraEarned: 0 },
      history: [],
    };
  }

  // Upgrade an older save to the current schema. Idempotent. Pure.
  function migrate(state) {
    if (!state || typeof state !== 'object') return state;
    if (state.version === CORE_VERSION) return state;
    const s = JSON.parse(JSON.stringify(state));
    // v1 -> v2
    for (const b of BRANCHES) {
      s.branches[b] = s.branches[b] || { aura: 0, level: 1 };
      if (!Array.isArray(s.branches[b].perks)) s.branches[b].perks = [];
    }
    s.player = s.player || {};
    s.player.streak = s.player.streak || { count: 0, lastCompletedDate: null };
    if (s.player.streak.best == null) s.player.streak.best = s.player.streak.count || 0;
    if (s.player.perfectWeeks == null) s.player.perfectWeeks = 0;
    s.quests = (s.quests || []).map(q => ({ schedule: null, ...q }));
    if (!Array.isArray(s.trials)) s.trials = [];
    if (!Array.isArray(s.achievements)) s.achievements = [];
    s.today = s.today || { date: null, completedQuestIds: [], perfectAwarded: false };
    if (s.today.reflection === undefined) s.today.reflection = null;
    if (s.today.perfectWeekAwarded === undefined) s.today.perfectWeekAwarded = false;
    if (s.today.auraEarned === undefined) s.today.auraEarned = 0;
    s.version = CORE_VERSION;
    return s;
  }

  function rolloverIfNewDay(state, today) {
    if (state.today.date === today) return state;
    const history = state.history.concat([{
      date: state.today.date,
      completedCount: state.today.completedQuestIds.length,
      perfectDay: state.today.perfectAwarded,
      auraEarned: state.today.auraEarned || 0,
      mood: state.today.reflection ? state.today.reflection.mood : null,
    }]);
    return {
      ...state,
      player: { ...state.player, lastActiveDate: today },
      // expire finished one-off custom quests and any trials past their window
      quests: state.quests.filter(q => !(q.type === 'custom' && q.archived)),
      trials: (state.trials || []).map(t =>
        (t.status === 'active' && t.endDate && today > t.endDate) ? { ...t, status: 'expired' } : t
      ),
      today: { date: today, completedQuestIds: [], perfectAwarded: false, perfectWeekAwarded: false, reflection: null, auraEarned: 0 },
      history,
    };
  }

  function branchHasPerk(branches, branch) {
    const perk = PERKS[branch];
    return !!(perk && branches[branch] && (branches[branch].perks || []).includes(perk.id));
  }

  // Add aura to a branch, recompute its level, and unlock its perk on reaching
  // the milestone. Returns { branches, newPerks }.
  function growBranch(branches, branch, earned) {
    const prev = branches[branch];
    const aura = prev.aura + earned;
    const level = branchLevel(aura);
    const perks = (prev.perks || []).slice();
    const newPerks = [];
    const perk = PERKS[branch];
    if (perk && level >= perk.level && !perks.includes(perk.id)) {
      perks.push(perk.id);
      newPerks.push({ branch, ...perk });
    }
    const out = { ...branches, [branch]: { ...prev, aura, level, perks } };
    return { branches: out, newPerks };
  }

  // Seven consecutive perfect days ending today (today must already be perfect).
  function isPerfectWeek(history, today) {
    for (let i = 1; i <= 6; i++) {
      const d = addDays(today, -i);
      const h = history.find(e => e.date === d);
      if (!h || !h.perfectDay) return false;
    }
    return true;
  }

  // Pure: returns the full set of achievement ids that should be unlocked for a
  // given state. Caller diffs against already-unlocked to find what's NEW.
  function earnedAchievementIds(state) {
    return ACHIEVEMENTS.filter(a => { try { return a.test(state); } catch (e) { return false; } }).map(a => a.id);
  }

  function completeQuest(state, questId, today) {
    if (state.today.completedQuestIds.includes(questId)) return state;
    const quest = state.quests.find(q => q.id === questId);
    if (!quest) return state;
    if (!isScheduledOn(quest, today)) return state; // not on today's schedule

    const newStreak = updateStreak(state.player.streak, today);
    let earned = auraForQuest(quest.difficulty, newStreak.count);
    // Branch perk: +aura on its own branch's quests (uses pre-completion perks).
    const bperk = PERKS[quest.branch];
    if (bperk && bperk.auraMult && branchHasPerk(state.branches, quest.branch)) {
      earned = Math.round(earned * bperk.auraMult);
    }

    const completedQuestIds = state.today.completedQuestIds.concat([questId]);

    // Perfect Day: every SCHEDULED daily completed, awarded at most once per day.
    const dailyIds = state.quests.filter(q => q.type === 'daily' && isScheduledOn(q, today)).map(q => q.id);
    const allDailyDone = dailyIds.length > 0 && dailyIds.every(id => completedQuestIds.includes(id));
    let perfectBonus = (allDailyDone && !state.today.perfectAwarded) ? PERFECT_DAY_BONUS : 0;
    if (perfectBonus > 0 && branchHasPerk(state.branches, 'Spirit')) {
      perfectBonus = Math.round(perfectBonus * PERKS.Spirit.perfectMult);
    }
    const perfectAwarded = state.today.perfectAwarded || perfectBonus > 0;

    // Grow the branch + unlock perk.
    const grown = growBranch(state.branches, quest.branch, earned);
    let branches = grown.branches;
    const newPerks = grown.newPerks;

    // Trials: advance any active trial covering this branch + within its window.
    let trialSurge = 0;
    const completedTrials = [];
    const trials = (state.trials || []).map(t => {
      if (t.status !== 'active') return t;
      if (t.branch && t.branch !== quest.branch) return t;
      if (t.startDate && today < t.startDate) return t;
      if (t.endDate && today > t.endDate) return t;
      const progress = (t.progress || 0) + 1;
      if (progress >= t.target) {
        completedTrials.push({ ...t, progress, status: 'complete' });
        trialSurge += TRIAL_BONUS;
        return { ...t, progress, status: 'complete', completedAt: today };
      }
      return { ...t, progress };
    });

    // Perfect Week surge (only on the completion that seals today's perfect day).
    let perfectWeeks = state.player.perfectWeeks || 0;
    let perfectWeekAwarded = state.today.perfectWeekAwarded;
    let weekSurge = 0;
    if (perfectBonus > 0 && !perfectWeekAwarded && isPerfectWeek(state.history, today)) {
      weekSurge = PERFECT_WEEK_BONUS;
      perfectWeeks += 1;
      perfectWeekAwarded = true;
    }

    const surge = trialSurge + weekSurge;
    const totalAura = state.player.totalAura + earned + perfectBonus + surge;
    const prevRank = state.player.rank;
    const rank = resolveRank(totalAura);

    const quests = state.quests.map(q =>
      (q.id === questId && q.type === 'custom') ? { ...q, archived: true } : q
    );

    let next = {
      ...state,
      player: { ...state.player, totalAura, rank, streak: newStreak, perfectWeeks, lastActiveDate: today },
      branches,
      quests,
      trials,
      today: {
        ...state.today,
        completedQuestIds,
        perfectAwarded,
        perfectWeekAwarded,
        auraEarned: (state.today.auraEarned || 0) + earned + perfectBonus + surge,
      },
    };

    // Achievements (evaluated on the post-completion state).
    const had = new Set((next.achievements || []).map(a => a.id));
    const newAchievements = earnedAchievementIds(next)
      .filter(id => !had.has(id))
      .map(id => ({ ...ACHIEVEMENTS.find(a => a.id === id), unlockedAt: today }));
    next.achievements = (next.achievements || []).concat(newAchievements);

    next.lastEarned = {
      questId,
      branch: quest.branch,
      amount: earned,
      perfectBonus,
      surge,
      surgeReason: weekSurge > 0 ? 'Perfect Week' : (trialSurge > 0 ? 'Trial Complete' : null),
      rankedUp: rank !== prevRank,
      rank,
      newPerks,
      completedTrials,
      newAchievements,
    };
    return next;
  }

  // Daily reflection: a one-tap mood + optional note. Grants flat Spirit aura
  // once per day, keeps the streak alive, but is never required for it.
  function setReflection(state, { mood, note }, today) {
    if (state.today.reflection) return state; // already reflected today
    const newStreak = updateStreak(state.player.streak, today);
    let earned = REFLECTION_AURA;
    if (branchHasPerk(state.branches, 'Spirit')) earned = Math.round(earned * 1.0); // reflection isn't perk-boosted
    const grown = growBranch(state.branches, 'Spirit', earned);
    const totalAura = state.player.totalAura + earned;
    const prevRank = state.player.rank;
    const rank = resolveRank(totalAura);
    let next = {
      ...state,
      player: { ...state.player, totalAura, rank, streak: newStreak, lastActiveDate: today },
      branches: grown.branches,
      today: {
        ...state.today,
        reflection: { mood: mood || null, note: (note || '').slice(0, 140) },
        auraEarned: (state.today.auraEarned || 0) + earned,
      },
    };
    const had = new Set((next.achievements || []).map(a => a.id));
    const newAchievements = earnedAchievementIds(next).filter(id => !had.has(id))
      .map(id => ({ ...ACHIEVEMENTS.find(a => a.id === id), unlockedAt: today }));
    next.achievements = (next.achievements || []).concat(newAchievements);
    next.lastEarned = { branch: 'Spirit', amount: earned, perfectBonus: 0, surge: 0,
      rankedUp: rank !== prevRank, rank, newPerks: grown.newPerks, newAchievements };
    return next;
  }

  function addTrial(state, { name, branch, target, startDate, endDate }) {
    const trial = {
      id: makeId(), name, branch: branch || null,
      target: Math.max(1, target | 0), progress: 0,
      startDate: startDate || null, endDate: endDate || null, status: 'active',
    };
    return { ...state, trials: (state.trials || []).concat([trial]) };
  }

  function removeTrial(state, trialId) {
    return { ...state, trials: (state.trials || []).filter(t => t.id !== trialId) };
  }

  function addQuest(state, { name, branch, difficulty, type, schedule }) {
    const quest = { id: makeId(), name, branch, difficulty, type, schedule: schedule || null, archived: false };
    return { ...state, quests: state.quests.concat([quest]) };
  }

  function removeQuest(state, questId) {
    return { ...state, quests: state.quests.filter(q => q.id !== questId) };
  }

  // Quests to show on the board. Dailies only appear on their scheduled days.
  function activeQuests(state, today) {
    return state.quests.filter(q => {
      if (q.type === 'custom') return !q.archived;
      return today ? isScheduledOn(q, today) : true;
    });
  }

  // --- stats / visualization helpers (pure, read-only) ---

  // Map of yyyy-mm-dd -> aura earned that day, from history plus the live today.
  function auraByDate(state) {
    const map = {};
    for (const h of state.history || []) map[h.date] = (map[h.date] || 0) + (h.auraEarned || 0);
    if (state.today && state.today.date) {
      map[state.today.date] = (map[state.today.date] || 0) + (state.today.auraEarned || 0);
    }
    return map;
  }

  // Today's scheduled-daily completion progress.
  function completionStats(state, today) {
    const scheduled = state.quests.filter(q => q.type === 'daily' && isScheduledOn(q, today));
    const done = scheduled.filter(q => state.today.completedQuestIds.includes(q.id)).length;
    return { done, scheduled: scheduled.length };
  }

  function perfectDayCount(state) {
    return (state.history || []).filter(h => h.perfectDay).length + (state.today && state.today.perfectAwarded ? 1 : 0);
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
        + `letter-spacing="2">${branch.toUpperCase()} · ${state.branches[branch].aura}</text>`;
    });

    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" `
      + `xmlns="http://www.w3.org/2000/svg" class="constellation">${links}${stars}${labels}</svg>`;
  }

  return {
    CORE_VERSION, DIFFICULTY_AURA, BRANCHES, PERFECT_DAY_BONUS, REFLECTION_AURA,
    PERFECT_WEEK_BONUS, TRIAL_BONUS, RANKS, BRANCH_LEVEL_STEP, PERKS, ACHIEVEMENTS, WEEKDAYS,
    resolveRank, dateStr, addDays, weekdayOf, isScheduledOn, branchLevel, streakMultiplier,
    auraForQuest, updateStreak, currentStreak, freshState, migrate, rolloverIfNewDay, makeId,
    branchHasPerk, growBranch, isPerfectWeek, earnedAchievementIds,
    completeQuest, setReflection, addTrial, removeTrial, addQuest, removeQuest, activeQuests,
    auraByDate, completionStats, perfectDayCount, starCountFor, buildConstellationSVG,
  };
});
