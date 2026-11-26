'use strict';

import { GAME_CONFIG, STORAGE_KEYS } from './config.js';
import { SFX } from './sfx.js';
import {
  runtime,
  createFreshState,
  applyJumpPreset,
  saveProgress,
  loadProgress
} from './state.js';
import { getShiftMaxMins } from './logic.js';
import {
  $,
  toast,
  applySettings,
  updateWorkHUD,
  populateMeterTargets,
  renderMeterDial,
  renderSemanticRadar,
  renderRulebook
} from './ui-hud.js';
import {
  playIntro,
  startDayMorning,
  openSettlement,
  confirmSettlement,
  proceedFromEvening,
  playRestorationCinematic,
  openDictModal,
  openTimelineModal,
  openSettingsModal,
  closeSettingsModal,
  retryCurrentDay,
  returnToTitle
} from './day-cycle.js';
import {
  startWorkShift,
  spendGameMinutes,
  callNextVisitor,
  openEnvelope,
  renderDeskCargo,
  toggleCompareMode,
  runMeasurement,
  toggleEditMode,
  stampRedact,
  stampPass,
  openDenyModal,
  questionVisitor,
  finishCurrentCargo
} from './work.js';

function loadCjsModule(src, reqMap) {
  const mod = { exports: {} };
  const req = (p) => {
    if (p === 'path') return { join: (a, b) => b };
    const k = p.replace(/^\.\//, '');
    if (reqMap[k]) return reqMap[k];
    throw new Error('Unknown module: ' + p);
  };
  new Function('module', 'exports', 'require', '__dirname', src)(mod, mod.exports, req, '.');
  return mod.exports;
}

async function bootStages() {
  try {
    const [buildSrc, lexSrc, engSrc, adpSrc, koSrc, enSrc, ...dayResponses] = await Promise.all([
      fetch('stages/tools/build-data.js').then(r => { if (!r.ok) throw new Error('build-data'); return r.text(); }),
      fetch('stages/tools/lexicon.js').then(r => { if (!r.ok) throw new Error('lexicon.js'); return r.text(); }),
      fetch('stages/tools/engine.js').then(r => { if (!r.ok) throw new Error('engine.js'); return r.text(); }),
      fetch('stages/locales/adapter.js').then(r => { if (!r.ok) throw new Error('adapter.js'); return r.text(); }),
      fetch('stages/locales/ko-KR.js').then(r => { if (!r.ok) throw new Error('ko-KR.js'); return r.text(); }),
      fetch('stages/locales/en-US.js').then(r => { if (!r.ok) throw new Error('en-US.js'); return r.text(); }),
      ...Array.from({ length: 30 }, (_, i) => {
        const fn = 'stages/days/D' + String(i + 1).padStart(2, '0') + '.json';
        return fetch(fn).then(r => { if (!r.ok) throw new Error(fn); return r.json(); });
      })
    ]);
    const B = loadCjsModule(buildSrc, {});
    runtime.LEX = loadCjsModule(lexSrc, { 'build-data.js': B });
    runtime.ENGINE = loadCjsModule(engSrc, { 'lexicon.js': runtime.LEX, 'build-data.js': B });
    runtime.LOCALE_API = loadCjsModule(adpSrc, {});
    loadCjsModule(koSrc, {}).createKoAdapter(runtime.LEX, runtime.ENGINE, runtime.LOCALE_API);
    loadCjsModule(enSrc, {}).createEnAdapter(runtime.LOCALE_API);
    runtime.LOCALE = runtime.LOCALE_API.getLocale('ko-KR');
    dayResponses.forEach((dObj, i) => { runtime.DAYS_DATA[i + 1] = dObj; });

    buildDayJumpButtons();
    $('load-overlay').classList.add('hidden');
    if (loadProgress()) $('btn-continue').style.display = 'inline-block';
  } catch (e) {
    $('load-card-msg').innerHTML = '<strong>stages 데이터를 불러오지 못했습니다(로컬 서버로 여세요)</strong>';
  }
}

function buildDayJumpButtons() {
  const wrap = $('day-jump-btns');
  wrap.innerHTML = '';
  for (let d = 1; d <= 30; d++) {
    const btn = document.createElement('button');
    btn.dataset.jumpDay = String(d);
    btn.textContent = 'D' + d;
    btn.title = runtime.DAYS_DATA[d] ? runtime.DAYS_DATA[d].title || ('D' + d) : ('D' + d);
    btn.addEventListener('click', () => {
      const parentTitle = runtime.state.flags['부모호칭'] || '아빠';
      const prevSettings = Object.assign({}, runtime.state.settings);
      runtime.state = applyJumpPreset(createFreshState(d), d);
      runtime.state.settings = prevSettings;
      runtime.state.flags['부모호칭'] = parentTitle;
      runtime.state.flags['윤희호칭'] = parentTitle === '아빠' ? '엄마' : '아빠';
      applySettings();
      startDayMorning(d);
    });
    wrap.appendChild(btn);
  }
}

function bindTitleEvents() {
  $('btn-parent-dad').addEventListener('click', () => {
    runtime.state.flags['부모호칭'] = '아빠';
    runtime.state.flags['윤희호칭'] = '엄마';
    $('btn-parent-dad').classList.add('picked');
    $('btn-parent-mom').classList.remove('picked');
  });
  $('btn-parent-mom').addEventListener('click', () => {
    runtime.state.flags['부모호칭'] = '엄마';
    runtime.state.flags['윤희호칭'] = '아빠';
    $('btn-parent-mom').classList.add('picked');
    $('btn-parent-dad').classList.remove('picked');
  });
  $('btn-start-new').addEventListener('click', () => {
    const p = runtime.state.flags['부모호칭'] || '아빠';
    const prevSettings = Object.assign({}, runtime.state.settings);
    runtime.state = createFreshState(1);
    runtime.state.settings = prevSettings;
    runtime.state.flags['부모호칭'] = p;
    runtime.state.flags['윤희호칭'] = p === '아빠' ? '엄마' : '아빠';
    applySettings();
    playIntro();
  });
  $('btn-continue').addEventListener('click', () => {
    const saved = loadProgress();
    if (!saved) return;
    runtime.state = Object.assign(createFreshState(saved.day), saved);
    if (!Array.isArray(runtime.state.seoyeonQueue)) {
      runtime.state.seoyeonQueue = runtime.state.seoyeonQueue ? [runtime.state.seoyeonQueue] : [];
    }
    applySettings();
    startDayMorning(runtime.state.day);
  });
  $('btn-intro-skip').addEventListener('click', () => {
    if (runtime.timers.intro) clearInterval(runtime.timers.intro);
    startDayMorning(1);
  });
  $('btn-intro-next').addEventListener('click', () => startDayMorning(1));
  $('btn-start-shift').addEventListener('click', startWorkShift);
}

function bindWorkEvents() {
  $('btn-tip-ok').addEventListener('click', () => {
    $('tutorial-tip').style.display = 'none';
    runtime.state.tipActive = false;
  });
  $('btn-bell').addEventListener('click', callNextVisitor);
  $('btn-stamp-pass').addEventListener('click', stampPass);
  $('btn-stamp-deny').addEventListener('click', openDenyModal);
  $('btn-stamp-edit').addEventListener('click', toggleEditMode);
  $('btn-stamp-redact').addEventListener('click', stampRedact);
  $('btn-question').addEventListener('click', questionVisitor);
  $('btn-compare').addEventListener('click', toggleCompareMode);

  $('btn-view-dial').addEventListener('click', () => {
    runtime.state.meterView = 'dial';
    $('btn-view-dial').classList.add('active');
    $('btn-view-radar').classList.remove('active');
    const r = runtime.state.lastMeterRes;
    if (r) renderMeterDial(r.res, r.effLVal, r.baseLVal);
  });
  $('btn-view-radar').addEventListener('click', () => {
    runtime.state.meterView = 'radar';
    $('btn-view-radar').classList.add('active');
    $('btn-view-dial').classList.remove('active');
    const r = runtime.state.lastMeterRes || { res: null, effLVal: 70, baseLVal: 70 };
    renderSemanticRadar(r.res, r.effLVal);
  });
  $('btn-highlight-first').addEventListener('click', () => {
    runtime.state.highlightFirst = !runtime.state.highlightFirst;
    $('btn-highlight-first').classList.toggle('active', runtime.state.highlightFirst);
    renderDeskCargo();
  });
  $('btn-sentence-mode').addEventListener('click', () => {
    runtime.state.sentenceMode = !runtime.state.sentenceMode;
    $('btn-sentence-mode').textContent = runtime.state.sentenceMode ? '문장 ON' : '문장 OFF';
    $('btn-sentence-mode').classList.toggle('active', runtime.state.sentenceMode);
  });
  $('btn-repair-meter').addEventListener('click', () => {
    spendGameMinutes(GAME_CONFIG.REPAIR_TIME_MINS);
    runtime.state.meterBrokenUntil = 0;
    $('meter-broken-bar').style.display = 'none';
    SFX.stamp('edit');
    toast('측정기를 긴급 수리했습니다. (-' + GAME_CONFIG.REPAIR_TIME_MINS + '게임분)');
  });
  $('btn-end-shift-early').addEventListener('click', openSettlement);
  $('btn-measure-fast').addEventListener('click', () => runMeasurement('fast'));
  $('btn-measure-fine').addEventListener('click', () => runMeasurement('fine'));
  $('meter-direct-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) runMeasurement('fast');
  });
  if ($('meter-target-select')) {
    $('meter-target-select').addEventListener('change', e => {
      runtime.state.meterTarget = e.target.value;
      populateMeterTargets();
    });
  }

  $('btn-mobile-rb').addEventListener('click', () => $('rulebook-col').classList.toggle('mobile-open'));
  $('btn-rb-close').addEventListener('click', () => $('rulebook-col').classList.remove('mobile-open'));
  $('btn-mobile-meter').addEventListener('click', () => $('meter-row').classList.toggle('mobile-open'));
  document.querySelectorAll('.rb-tab').forEach(b => {
    b.addEventListener('click', () => { runtime.state.rbTab = b.dataset.tab; renderRulebook(); });
  });
}

function bindModalAndSettingsEvents() {
  $('btn-close-deny').addEventListener('click', () => $('modal-deny').classList.remove('active'));
  $('btn-close-revision').addEventListener('click', () => {
    $('modal-revision').classList.remove('active');
    runtime.state.revisionOpen = false;
  });
  $('btn-settle-confirm').addEventListener('click', confirmSettlement);
  if ($('btn-settle-retry')) $('btn-settle-retry').addEventListener('click', retryCurrentDay);
  $('btn-next-day').addEventListener('click', proceedFromEvening);
  $('btn-restore-close').addEventListener('click', () => {
    if (runtime.state._restoreQueue && runtime.state._restoreQueue.length > 0) {
      playRestorationCinematic(runtime.state._restoreQueue.shift());
    } else {
      $('modal-restore').classList.remove('active');
    }
  });

  $('btn-open-timeline-title').addEventListener('click', openTimelineModal);
  $('btn-close-timeline').addEventListener('click', () => $('modal-timeline').classList.remove('active'));
  $('btn-hud-sticky').addEventListener('click', () => {
    runtime.state.stickyOpen = !runtime.state.stickyOpen;
    $('sticky-note-panel').classList.toggle('open', runtime.state.stickyOpen);
  });
  $('btn-sticky-hide').addEventListener('click', () => {
    runtime.state.stickyOpen = false;
    $('sticky-note-panel').classList.remove('open');
  });
  try { $('sticky-note-area').value = localStorage.getItem(STORAGE_KEYS.STICKY) || ''; } catch {}
  $('sticky-note-area').addEventListener('input', e => {
    try { localStorage.setItem(STORAGE_KEYS.STICKY, e.target.value); } catch {}
  });

  ['btn-open-dict-title', 'btn-hud-dict', 'btn-evening-dict', 'btn-ending-dict'].forEach(id => {
    $(id).addEventListener('click', openDictModal);
  });
  $('btn-close-dict').addEventListener('click', () => $('modal-dict').classList.remove('active'));

  ['btn-open-settings-title', 'btn-hud-settings', 'btn-hud-pause'].forEach(id => {
    $(id).addEventListener('click', openSettingsModal);
  });
  $('btn-close-settings').addEventListener('click', closeSettingsModal);
  $('btn-settings-ok').addEventListener('click', closeSettingsModal);
  if ($('btn-retry-day')) $('btn-retry-day').addEventListener('click', retryCurrentDay);
  $('btn-back-title').addEventListener('click', returnToTitle);
  $('btn-ending-title').addEventListener('click', returnToTitle);

  $('btn-hud-mute').addEventListener('click', () => {
    runtime.state.settings.muted = !runtime.state.settings.muted;
    applySettings();
    saveProgress();
  });
  $('opt-relaxed').addEventListener('change', e => { runtime.state.settings.relaxed = e.target.checked; applySettings(); });
  $('opt-linguist').addEventListener('change', e => { runtime.state.settings.linguist = e.target.checked; applySettings(); updateWorkHUD(); });
  if ($('opt-quick-flow')) $('opt-quick-flow').addEventListener('change', e => { runtime.state.settings.quickFlow = e.target.checked; applySettings(); });
  $('opt-plain-hand').addEventListener('change', e => { runtime.state.settings.plainHand = e.target.checked; applySettings(); });
  $('opt-colorblind').addEventListener('change', e => { runtime.state.settings.colorblind = e.target.checked; applySettings(); });
  document.querySelectorAll('.opt-font-btn').forEach(b => {
    b.addEventListener('click', () => { runtime.state.settings.fontSize = b.dataset.fsize; applySettings(); });
  });
}

function bindKeyboardShortcuts() {
  window.addEventListener('keydown', e => {
    if (e.isComposing || e.keyCode === 229) return;
    const modalOpen = ['modal-deny', 'modal-dict', 'modal-revision', 'modal-settings', 'modal-timeline', 'modal-dilemma']
      .some(id => $(id) && $(id).classList.contains('active'));

    if (e.key === 'Escape') {
      const s = runtime.state;
      if (s.activeEditWord) { s.activeEditWord = null; renderDeskCargo(); }
      else if ($('sticky-note-panel') && $('sticky-note-panel').classList.contains('open')) { s.stickyOpen = false; $('sticky-note-panel').classList.remove('open'); }
      else if ($('modal-timeline') && $('modal-timeline').classList.contains('active')) $('modal-timeline').classList.remove('active');
      else if ($('modal-deny').classList.contains('active')) $('modal-deny').classList.remove('active');
      else if ($('modal-dict').classList.contains('active')) $('modal-dict').classList.remove('active');
      else if ($('modal-revision').classList.contains('active')) { $('modal-revision').classList.remove('active'); s.revisionOpen = false; }
      else if ($('modal-settings').classList.contains('active')) closeSettingsModal();
      else if ($('screen-work').classList.contains('active')) openSettingsModal();
      return;
    }

    if (!$('screen-work').classList.contains('active') || modalOpen) return;
    const tag = document.activeElement && document.activeElement.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const s = runtime.state;
    if (e.key === 'n' || e.key === 'N' || e.key === 'Enter') {
      if (e.key === 'Enter') e.preventDefault();
      if (s.stamped) {
        finishCurrentCargo();
        if (!s.currentCargo && (s.settings.linguist || s.clockMins < getShiftMaxMins(s.day))) callNextVisitor();
      } else if (!s.currentCargo) {
        callNextVisitor();
      } else if (e.key === 'Enter' && !s.envelopeOpened) {
        openEnvelope();
      }
    } else if (e.key === '1') stampPass();
    else if (e.key === '2') openDenyModal();
    else if (e.key === '3') toggleEditMode();
    else if (e.key === '4') stampRedact();
    else if (e.key === ' ') { e.preventDefault(); toggleCompareMode(); }
    else if (e.key === 'm' || e.key === 'M') runMeasurement(e.shiftKey ? 'fine' : 'fast');
    else if (e.key === 'F1') { e.preventDefault(); $('rulebook-col').classList.toggle('mobile-open'); }
    else if (e.key === 'F2') { e.preventDefault(); openDictModal(); }
  });
}

window.addEventListener('load', () => {
  applySettings();
  bindTitleEvents();
  bindWorkEvents();
  bindModalAndSettingsEvents();
  bindKeyboardShortcuts();
  bootStages();
});
