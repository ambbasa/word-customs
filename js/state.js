'use strict';

import { GAME_CONFIG, STORAGE_KEYS, TIMELINE_BRANCHES } from './config.js';

function safeReadJson(key, fallback) {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function safeWriteJson(key, val) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(val));
    }
  } catch {}
}

export function createFreshState(startDay = 1) {
  return {
    day: startDay,
    seed: Math.floor(Math.random() * 900000) + 100000,
    credits: GAME_CONFIG.STARTING_CREDITS,
    rating: GAME_CONFIG.STARTING_RATING,
    S: 0,
    T: GAME_CONFIG.STARTING_TRUST,
    M: 0,
    E: 0,
    editPs: [],
    rentMissed: 0,
    foodMissed: 0,
    heatMissed: 0,
    medMissed: 0,
    medGraceUsed: 0,
    coldMedDue: false,
    medExempt: false,
    familyGone: false,
    seoyeonHealth: '보통',
    seoyeonSadDays: 0,
    meterLv: 1,
    sentenceMode: false,
    blackMarketBought: false,
    parkTipBought: false,
    prevResPassed: 0,
    resCargosSeen: 0,
    totalMercyPassed: 0,
    consecutivePerfectDays: 0,
    prevDayStats: null,
    pendingMercyLetters: [],
    d30Editing: false,
    settledDay: 0,
    eveningAdviceNotes: [],
    tutorialStep: 0,
    tutorialDone: false,
    _d30SettleSummary: null,
    highlightFirst: false,
    meterBrokenUntil: 0,
    meterBrokenDone: false,
    eveningEventDone: false,
    driftWords: {},
    meterView: 'dial',
    lastMeterRes: null,
    lastNullSlitAt: 0,
    stickyOpen: false,
    stickyCaughtToday: false,
    dayMeasureQuota: 6,
    dayMeasureUsed: 0,
    flags: {
      '부모호칭': '아빠',
      '윤희호칭': '엄마',
      '하람옛말': 0,
      'rel.노을': 0,
      'rel.모리': 0,
      'rel.국장': 0,
      'rel.윤희': 0
    },
    memos: [],
    familyMemos: [],
    seoyeonQueue: [],
    seoyeonNotes: [],
    settings: { relaxed: false, linguist: false, quickFlow: false, plainHand: false, colorblind: false, fontSize: 'md', muted: false },
    clockMins: 0,
    clockRunning: false,
    overtimeUsed: false,
    paused: false,
    measuring: false,
    tipActive: false,
    dilemmaOpen: false,
    revisionOpen: false,
    revisionArrived: false,
    queueIndex: 0,
    currentCargo: null,
    envelopeOpened: false,
    stamped: null,
    editMode: false,
    redactMode: false,
    activeEditWord: null,
    probeWord: null,
    meterTarget: '자유',
    compareMode: false,
    compareFirst: null,
    compareMarked: {},
    dayProcessed: 0,
    dayRedactedCount: 0,
    dayBonus: 0,
    dayWarnings: 0,
    dayFines: 0,
    dayEditsUsed: 0,
    dayAuditQueue: [],
    dayComplaints: [],
    dayWrongDenyReasons: [],
    dayRestorations: [],
    daySeenWords: [],
    dayReviewLog: [],
    dayInstantCaught: 0,
    dayNullPsychHits: 0,
    dayAdviceCount: 0,
    dayPendingSettleFlags: [],
    rbTab: 'terms'
  };
}

export function applyJumpPreset(st, d) {
  if (d >= 30) {
    st.meterLv = 3; st.sentenceMode = true; st.T = 70; st.M = 20; st.E = 10;
    st.credits = 80; st.rating = 80; st.editPs = [88, 86, 90, 85, 89];
  } else if (d >= 20) {
    st.meterLv = 3; st.sentenceMode = true; st.T = 55; st.M = 14; st.E = 4;
    st.credits = 65; st.rating = 75; st.editPs = [84, 86, 82];
  } else if (d >= 11) {
    st.meterLv = 2; st.sentenceMode = true; st.T = 35; st.M = 6; st.E = 2;
    st.credits = 55; st.rating = 70;
  } else if (d >= 8) {
    st.meterLv = 2; st.T = 28; st.M = 3; st.credits = 50;
  }
  return st;
}

export const runtime = {
  LEX: null,
  ENGINE: null,
  LOCALE_API: null,
  LOCALE: null,
  DAYS_DATA: {},
  state: createFreshState(1),
  persistentDict: safeReadJson(STORAGE_KEYS.DICT, {}),
  unlockedEndings: safeReadJson(STORAGE_KEYS.ENDINGS, {}),
  branchSnaps: safeReadJson(STORAGE_KEYS.BRANCH_SNAPS, {}),
  timers: {
    clock: null,
    intro: null,
    introStages: [],
    eveningType: null,
    measure: null
  },
  isComposingIME: false,
  settleDraft: { payRent: true, payFood: true },
  hooks: {
    startWorkShift: null,
    callNextVisitor: null,
    openSettlement: null,
    openEvening: null,
    showEnding: null
  }
};

export function savePersistentDict() {
  safeWriteJson(STORAGE_KEYS.DICT, runtime.persistentDict);
}

export function saveUnlockedEnding(id, title, desc) {
  runtime.unlockedEndings[id] = { title, desc, at: new Date().toISOString().slice(0, 10) };
  safeWriteJson(STORAGE_KEYS.ENDINGS, runtime.unlockedEndings);
}

export function saveBranchSnap(dayNum) {
  if (!TIMELINE_BRANCHES.some(b => b.day === dayNum)) return;
  const s = runtime.state;
  runtime.branchSnaps[String(dayNum)] = {
    day: dayNum, credits: s.credits, rating: s.rating, S: s.S, T: s.T, M: s.M, E: s.E,
    editPs: (s.editPs || []).slice(), rentMissed: s.rentMissed, foodMissed: s.foodMissed,
    heatMissed: s.heatMissed, medMissed: s.medMissed, medGraceUsed: s.medGraceUsed,
    coldMedDue: s.coldMedDue, medExempt: s.medExempt, familyGone: s.familyGone,
    seoyeonHealth: s.seoyeonHealth, meterLv: s.meterLv, sentenceMode: s.sentenceMode,
    prevResPassed: s.prevResPassed, resCargosSeen: s.resCargosSeen,
    driftWords: Object.assign({}, s.driftWords), flags: Object.assign({}, s.flags),
    memos: (s.memos || []).slice(0, 40), familyMemos: (s.familyMemos || []).slice(0, 20),
    seoyeonNotes: (s.seoyeonNotes || []).slice(0, 20)
  };
  safeWriteJson(STORAGE_KEYS.BRANCH_SNAPS, runtime.branchSnaps);
}

export function saveProgress() {
  const s = runtime.state;
  const snap = {
    day: s.day, seed: s.seed, credits: s.credits, rating: s.rating,
    S: s.S, T: s.T, M: s.M, E: s.E, editPs: s.editPs,
    rentMissed: s.rentMissed, foodMissed: s.foodMissed, heatMissed: s.heatMissed,
    medMissed: s.medMissed, medGraceUsed: s.medGraceUsed, coldMedDue: s.coldMedDue,
    medExempt: s.medExempt, familyGone: s.familyGone, seoyeonHealth: s.seoyeonHealth,
    seoyeonSadDays: s.seoyeonSadDays, meterLv: s.meterLv, sentenceMode: s.sentenceMode,
    blackMarketBought: s.blackMarketBought, parkTipBought: s.parkTipBought, meterView: s.meterView,
    prevResPassed: s.prevResPassed, resCargosSeen: s.resCargosSeen,
    totalMercyPassed: s.totalMercyPassed, consecutivePerfectDays: s.consecutivePerfectDays,
    prevDayStats: s.prevDayStats, pendingMercyLetters: s.pendingMercyLetters,
    driftWords: s.driftWords, flags: s.flags,
    memos: s.memos, familyMemos: s.familyMemos,
    seoyeonQueue: s.seoyeonQueue, seoyeonNotes: s.seoyeonNotes,
    settings: s.settings
  };
  safeWriteJson(STORAGE_KEYS.SAVE, snap);
}

export function loadProgress() {
  return safeReadJson(STORAGE_KEYS.SAVE, null);
}

export function resetDayState(dayNum) {
  const s = runtime.state;
  Object.assign(s, {
    day: dayNum,
    clockMins: 0,
    clockRunning: false,
    overtimeUsed: false,
    paused: false,
    measuring: false,
    tipActive: false,
    dilemmaOpen: false,
    revisionOpen: false,
    revisionArrived: false,
    queueIndex: 0,
    currentCargo: null,
    envelopeOpened: false,
    stamped: null,
    editMode: false,
    redactMode: false,
    activeEditWord: null,
    probeWord: null,
    compareMode: false,
    compareFirst: null,
    compareMarked: {},
    dayProcessed: 0,
    dayRedactedCount: 0,
    dayBonus: 0,
    dayWarnings: 0,
    dayFines: 0,
    dayEditsUsed: 0,
    dayAuditQueue: [],
    dayComplaints: [],
    dayWrongDenyReasons: [],
    dayRestorations: [],
    daySeenWords: [],
    dayReviewLog: [],
    dayInstantCaught: 0,
    dayNullPsychHits: 0,
    dayAdviceCount: 0,
    dayPendingSettleFlags: [],
    d30Editing: false,
    settledDay: 0,
    eveningAdviceNotes: [],
    _d30SettleSummary: null,
    _eveningTyped: false,
    _d30CutsceneShown: false,
    highlightFirst: false,
    meterBrokenUntil: 0,
    meterBrokenDone: false,
    eveningEventDone: false,
    stickyCaughtToday: false,
    dayMeasureUsed: 0,
    _todayMercyLetters: []
  });
}

export function resetInteractionModes() {
  const s = runtime.state;
  s.editMode = false;
  s.redactMode = false;
  s.compareMode = false;
  s.activeEditWord = null;
}
