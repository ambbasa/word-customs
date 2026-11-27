'use strict';

import { PORTRAIT_MAP, RULES_META } from './config.js';
import { SFX } from './sfx.js';
import { runtime } from './state.js';
import {
  escapeHtml,
  getShiftMaxMins,
  formatClock,
  formatClock12,
  currentPhase,
  cargoPhase,
  isD30FinalCargo,
  getActiveTermsList,
  getMeterChipTerms,
  isLinguistActive,
  getFamilyStatusLabel
} from './logic.js';

export const $ = id => document.getElementById(id);

export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
  if (id !== 'screen-work') document.body.classList.remove('d30-final');
}

export function toast(msg, type = 'info') {
  const wrap = $('toast-container');
  while (wrap.children.length >= 3) wrap.firstElementChild.remove();
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'warn' ? ' warn' : type === 'err' ? ' err' : '');
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.25s'; }, 2400);
  setTimeout(() => el.remove(), 2700);
}

export function applySettings() {
  const s = runtime.state;
  document.body.classList.toggle('plain-hand', !!s.settings.plainHand);
  document.body.classList.remove('font-sm', 'font-lg');
  if (s.settings.fontSize === 'sm') document.body.classList.add('font-sm');
  if (s.settings.fontSize === 'lg') document.body.classList.add('font-lg');

  $('opt-relaxed').checked = !!s.settings.relaxed;
  if ($('opt-linguist')) $('opt-linguist').checked = !!s.settings.linguist;
  if ($('opt-quick-flow')) $('opt-quick-flow').checked = !!s.settings.quickFlow;
  $('opt-plain-hand').checked = !!s.settings.plainHand;
  $('opt-colorblind').checked = !!s.settings.colorblind;

  document.querySelectorAll('.opt-font-btn').forEach(b => {
    const active = b.dataset.fsize === (s.settings.fontSize || 'md');
    b.style.background = active ? '#1E1F22' : '';
    b.style.color = active ? '#EEF1EC' : '';
  });

  const cb = s.settings.colorblind;
  $('btn-stamp-pass').querySelector('.stamp-name').textContent = cb ? '● 통과' : '통과';
  $('btn-stamp-deny').querySelector('.stamp-name').textContent = cb ? '▲ 압수' : '압수';
  $('btn-stamp-edit').querySelector('.stamp-name').textContent = cb ? '◆ 수정' : '수정';
  if ($('btn-stamp-redact')) $('btn-stamp-redact').querySelector('.stamp-name').textContent = cb ? '■ 먹칠' : '먹칠';

  SFX.muted = !!s.settings.muted;
  if ($('btn-hud-mute')) $('btn-hud-mute').textContent = SFX.muted ? '소리 OFF' : '소리 ON';
}

export function renderPortraitSVG(charId, mood = 'normal') {
  const src = PORTRAIT_MAP[charId] || PORTRAIT_MAP.citizen;
  const moodCls = mood === 'sad' ? 'mood-sad' : (mood === 'happy' ? 'mood-happy' : '');
  return '<div class="portrait-frame">'
    + '<img class="portrait-img ' + moodCls + '" src="' + src + '" alt="' + escapeHtml(charId || 'citizen') + '">'
    + '<div class="portrait-glass-glare"></div>'
    + '</div>';
}

export function bouncePaper() {
  const p = $('cargo-paper');
  if (!p) return;
  p.classList.remove('stamp-hit');
  void p.offsetWidth;
  p.classList.add('stamp-hit');
}

export function updateClockUI() {
  const s = runtime.state;
  const maxM = getShiftMaxMins(s.day);
  const remMins = Math.max(0, Math.ceil(maxM - s.clockMins));
  const warn = !isLinguistActive() && remMins > 0 && remMins <= 60;
  const clockEl = $('hud-clock');
  // 시계는 현재 시각(오전/오후)이며, 마감 임박 시 남은 시간임을 라벨로 밝힌다 ("(-N분)"은 분으로 오해된다).
  clockEl.textContent = warn ? (formatClock12(s.clockMins) + ' (마감 ' + remMins + '분 전)') : formatClock12(s.clockMins);
  clockEl.classList.toggle('clock-warn', warn);
  const pct = Math.min(100, (s.clockMins / maxM) * 100);
  if ($('hud-clock-end')) $('hud-clock-end').textContent = '마감 ' + formatClock12(maxM);
  const fill = $('hud-clock-fill');
  fill.style.width = pct + '%';
  fill.classList.toggle('over', pct >= 100 || warn);
}

export function updateWorkHUD() {
  const s = runtime.state;
  const d = runtime.DAYS_DATA[s.day];
  $('hud-day').textContent = d.dateLabel;
  $('hud-queue').textContent = Math.max(0, d.cargos.length - s.queueIndex);
  $('hud-rating').textContent = s.rating;
  $('hud-credits').textContent = '₵' + s.credits;
  $('hud-family').textContent = getFamilyStatusLabel();
  $('hud-family-pill').classList.toggle('plate-alert', s.foodMissed >= 1 || s.familyGone);
  $('hud-warn-pill').style.display = s.dayWarnings > 0 ? 'inline-flex' : 'none';
  $('hud-warns').textContent = s.dayWarnings;
  if ($('hud-quota-pill')) {
    $('hud-quota-pill').style.display = isLinguistActive() ? 'inline-flex' : 'none';
    $('hud-quota').textContent = Math.max(0, s.dayMeasureQuota - s.dayMeasureUsed) + '/' + s.dayMeasureQuota;
  }
  $('rack-edit-quota').textContent = s.day >= 23 ? ('수정 잔여 ' + Math.max(0, 4 - s.dayEditsUsed) + '/4') : '';
  updateClockUI();
}

export function updateToolButtons() {
  const s = runtime.state;
  const isD30Final = isD30FinalCargo(s.currentCargo);
  const canJudge = !!(s.currentCargo && s.envelopeOpened && !s.stamped && !s.dilemmaOpen);

  $('btn-stamp-pass').disabled = !canJudge || isD30Final;
  $('btn-stamp-deny').disabled = !canJudge || isD30Final;
  $('btn-stamp-edit').disabled = !canJudge || (isD30Final && !s.d30Editing);
  $('btn-stamp-redact').disabled = !canJudge || isD30Final;
  if ($('btn-question')) $('btn-question').disabled = !(canJudge && s.probeWord && !s.currentCargo._questioned);
  $('btn-stamp-edit').classList.toggle('active-tool', s.editMode);
  $('btn-stamp-redact').classList.toggle('active-tool', !!s.redactMode);
  $('btn-compare').classList.toggle('active', s.compareMode);

  const d = runtime.DAYS_DATA[s.day];
  const hasMore = s.queueIndex < d.cargos.length;
  const canCall = !s.currentCargo && hasMore && (isLinguistActive() || s.clockMins < getShiftMaxMins(s.day));
  $('btn-bell').disabled = !canCall;
  $('btn-bell').classList.toggle('pulse', canCall);
  $('btn-end-shift-early').style.display = (!s.currentCargo && !hasMore) ? 'inline-block' : 'none';
}

/* (P0-2) 측정기 칩이 좁은 열에서 잘리지 않도록, 실제로 보여줄 소수만 고른다.
   우선순위: 추천 통제어 → 현재 선택 → 화물 관련(위반·시뮬) → 등급 1→2→3 순서. */
function pickChipTerms(terms, cargo, recommendedTerm, selected, max) {
  const picked = [];
  const push = t => {
    if (t && terms.includes(t) && !picked.includes(t) && picked.length < max) picked.push(t);
  };
  push(recommendedTerm);
  if (selected && selected !== 'AUTO') push(selected);
  if (cargo) {
    (cargo.violations || []).forEach(v => push(v && v.target));
    (cargo.sims || []).forEach(sm => push(sm && sm.target));
  }
  const gradeOf = t => {
    const g = runtime.LEX.TERMS[t] && runtime.LEX.TERMS[t].grade;
    return g === 1 ? 1 : (g === 2 ? 2 : 3);
  };
  terms.filter(t => !picked.includes(t)).sort((a, b) => gradeOf(a) - gradeOf(b)).forEach(push);
  return picked;
}

export function populateMeterTargets(recommendedTerm = null) {
  const { LEX, state: s } = runtime;
  const cargo = s.currentCargo;
  const terms = getMeterChipTerms(cargo);
  const tutorialTerms = (cargo && Array.isArray(cargo.tutorialChips)) ? cargo.tutorialChips : [];
  const useAutoOption = terms.length >= 2;
  if (s.meterTarget !== 'AUTO' && !terms.includes(s.meterTarget)) {
    s.meterTarget = useAutoOption ? 'AUTO' : (terms[0] || '자유');
  }
  const wrap = $('meter-target-chips');
  wrap.innerHTML = '';
  const origin = cargo ? cargo.origin : '제1구역';
  const ph = cargo ? cargoPhase(cargo) : currentPhase();

  const selectTarget = (t) => {
    s.meterTarget = t;
    populateMeterTargets(recommendedTerm);
    const dialTerm = t === 'AUTO' ? (recommendedTerm || terms[0] || '자유') : t;
    renderMeterDial(null, LEX.effL(dialTerm, s.day, ph, origin), LEX.baseL(dialTerm, s.day, ph));
    $('meter-val-short').textContent = '—';
    $('meter-result').textContent = t === 'AUTO' ? '자동 탐색 모드: 낱말 측정 시 최고 위험 통제어와 대조합니다.' : '낱말을 선택해 측정하세요.';
    $('meter-result').className = 'verdict-msg';
  };

  if (useAutoOption) {
    const autoBtn = document.createElement('button');
    autoBtn.className = 'target-chip-btn auto-chip' + (s.meterTarget === 'AUTO' ? ' active' : '');
    autoBtn.textContent = '✨ 자동';
    autoBtn.title = '선택한 낱말과 가장 가까운 활성 통제어를 자동 판별해 측정합니다';
    autoBtn.addEventListener('click', () => selectTarget('AUTO'));
    wrap.appendChild(autoBtn);
  }

  // 칩은 ✨자동 + 최대 3개. 나머지 통제어는 오른쪽 드롭다운에서 고른다 (스크롤 잘림·중복 노출 없음).
  const MAX_CHIP_TERMS = 3;
  const chipTerms = pickChipTerms(terms, cargo, recommendedTerm, s.meterTarget, MAX_CHIP_TERMS);

  chipTerms.forEach(t => {
    const L = LEX.effL(t, s.day, ph, origin);
    const g = LEX.TERMS[t] && LEX.TERMS[t].grade;
    const gCls = g === 1 ? ' g1' : (g === 2 ? ' g2' : ' g3');
    const isTutorial = tutorialTerms.includes(t);
    const recCls = (recommendedTerm && t === recommendedTerm) ? ' recommended' : '';
    const btn = document.createElement('button');
    btn.className = 'target-chip-btn' + gCls + recCls + (isTutorial ? ' tutorial-chip' : '') + (t === s.meterTarget ? ' active' : '');
    btn.innerHTML = escapeHtml(t) + ' ' + L + (isTutorial ? '<span class="chip-badge">훈련용</span>' : '');
    btn.title = isTutorial
      ? '훈련용 측정 칩 — 국장이 빌려준 연습용입니다. 실제 통제어 목록에는 없는 낱말입니다.'
      : ('「' + t + '」 유사도 측정 (경계 L' + L + ')');
    btn.addEventListener('click', () => selectTarget(t));
    wrap.appendChild(btn);
  });

  const sel = $('meter-target-select');
  if (sel) {
    const hiddenCount = terms.length - chipTerms.length;
    if (hiddenCount > 0) {
      sel.style.display = 'inline-block';
      sel.innerHTML = (useAutoOption ? '<option value="AUTO">✨ 자동 탐색</option>' : '')
        + terms.map(t => '<option value="' + escapeHtml(t) + '">' + escapeHtml(t) + ' (L' + LEX.effL(t, s.day, ph, origin) + ')'
          + (tutorialTerms.includes(t) ? ' · 훈련용' : '') + '</option>').join('');
      sel.value = s.meterTarget;
      sel.title = '전체 통제어 ' + terms.length + '개 — 칩에 없는 ' + hiddenCount + '개는 여기서 고릅니다';
    } else {
      sel.style.display = 'none';
    }
  }

  const labelTerm = s.meterTarget === 'AUTO' ? ('자동' + (recommendedTerm ? '(' + recommendedTerm + ')' : '')) : s.meterTarget;
  $('meter-target-label').textContent = labelTerm + (tutorialTerms.includes(s.meterTarget) ? ' · 훈련용' : '');
}

/* (P2-5) 브라우저 기본 confirm() 대신 인게임 모달로 묻는다. 확인=true / 취소=false */
export function confirmModal({ title = '확인', body = '', okLabel = '계속', cancelLabel = '취소', danger = false } = {}) {
  return new Promise(resolve => {
    const modal = $('modal-confirm');
    if (!modal) { resolve(false); return; }
    const okBtn = $('btn-confirm-ok');
    const cancelBtn = $('btn-confirm-cancel');
    const closeBtn = $('btn-close-confirm');
    $('confirm-title').textContent = title;
    $('confirm-body').innerHTML = body;
    okBtn.textContent = okLabel;
    okBtn.className = danger ? 'btn-danger' : 'btn-primary';
    cancelBtn.textContent = cancelLabel;
    const prevFocus = document.activeElement;

    const cleanup = (val) => {
      modal.classList.remove('active');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      closeBtn.removeEventListener('click', onCancel);
      document.removeEventListener('keydown', onKey, true);
      if (prevFocus && typeof prevFocus.focus === 'function') { try { prevFocus.focus(); } catch {} }
      resolve(val);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onKey = (e) => {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cleanup(false); }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); cleanup(true); }
    };

    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    closeBtn.addEventListener('click', onCancel);
    document.addEventListener('keydown', onKey, true);
    modal.classList.add('active');
    okBtn.focus();
  });
}

function polarPt(cx, cy, r, v) {
  const clamped = Math.max(0, Math.min(100, v));
  const a = Math.PI * (1 - clamped / 100);
  return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
}

export function renderMeterDial(res, effLVal, baseLVal) {
  const svg = $('meter-dial-svg');
  const cx = 145, cy = 86, rOut = 65, rIn = 18;
  let bandPath = '';
  if (res) {
    const [x1, y1] = polarPt(cx, cy, rOut, res.min);
    const [x2, y2] = polarPt(cx, cy, rOut, res.max);
    const [x3, y3] = polarPt(cx, cy, rIn, res.max);
    const [x4, y4] = polarPt(cx, cy, rIn, res.min);
    const bandColor = res.min >= effLVal ? 'rgba(224,79,62,0.45)' : (res.max < effLVal ? 'rgba(53,242,160,0.35)' : 'rgba(244,185,66,0.42)');
    bandPath = '<path d="M ' + x1.toFixed(1) + ' ' + y1.toFixed(1)
      + ' A ' + rOut + ' ' + rOut + ' 0 0 1 ' + x2.toFixed(1) + ' ' + y2.toFixed(1)
      + ' L ' + x3.toFixed(1) + ' ' + y3.toFixed(1)
      + ' A ' + rIn + ' ' + rIn + ' 0 0 0 ' + x4.toFixed(1) + ' ' + y4.toFixed(1)
      + ' Z" fill="' + bandColor + '" stroke="#E6EDF3" stroke-width="1.2"/>';
  }
  const [el1, ey1] = polarPt(cx, cy, rIn, effLVal);
  const [el2, ey2] = polarPt(cx, cy, rOut + 5, effLVal);
  let baseLine = '';
  if (baseLVal !== effLVal) {
    const [bl1, by1] = polarPt(cx, cy, rIn, baseLVal);
    const [bl2, by2] = polarPt(cx, cy, rOut + 5, baseLVal);
    baseLine = '<line x1="' + bl1.toFixed(1) + '" y1="' + by1.toFixed(1) + '" x2="' + bl2.toFixed(1) + '" y2="' + by2.toFixed(1) + '" stroke="#F4B942" stroke-width="1.6" stroke-dasharray="3 2.5" opacity="0.85"/>';
  }
  const [nx, ny] = polarPt(cx, cy, rOut - 4, res ? res.displayed : 0);
  const rangeLabel = res ? ('구간 ' + res.min + '~' + res.max) : ('경계 L' + effLVal);

  svg.innerHTML =
    '<g>'
    + '<rect x="6" y="4" width="280" height="112" rx="5" fill="#0B1117"/>'
    + '<path d="M 103.5 86 A 41.5 41.5 0 0 1 186.5 86" fill="none" stroke="#182430" stroke-width="47"/>'
    + bandPath
    + '<path d="M 80 86 A 65 65 0 0 1 210 86" fill="none" stroke="#3E5266" stroke-width="2"/>'
    + '<path d="M 127 86 A 18 18 0 0 1 163 86" fill="none" stroke="#3E5266" stroke-width="1.6"/>'
    + '<line x1="80" y1="86" x2="90" y2="86" stroke="#647B91" stroke-width="2"/>'
    + '<line x1="145" y1="21" x2="145" y2="31" stroke="#647B91" stroke-width="2"/>'
    + '<line x1="210" y1="86" x2="200" y2="86" stroke="#647B91" stroke-width="2"/>'
    + baseLine
    + '<line x1="' + el1.toFixed(1) + '" y1="' + ey1.toFixed(1) + '" x2="' + el2.toFixed(1) + '" y2="' + ey2.toFixed(1) + '" stroke="#E04F3E" stroke-width="3"/>'
    + '<line x1="' + cx + '" y1="' + cy + '" x2="' + nx.toFixed(1) + '" y2="' + ny.toFixed(1) + '" stroke="#F8FAFC" stroke-width="2.6" stroke-linecap="round"/>'
    + '<circle cx="' + cx + '" cy="' + cy + '" r="5.5" fill="#35F2A0" stroke="#0B1117" stroke-width="1.8"/>'
    + '</g>'
    + '<text x="145" y="16" font-size="10" font-weight="700" fill="#FCA5A5" text-anchor="middle">L' + effLVal + (baseLVal !== effLVal ? ' (원래 ' + baseLVal + ')' : '') + '</text>'
    + '<text x="145" y="109" font-size="10" font-weight="700" fill="#9CB0C4" text-anchor="middle">' + rangeLabel + '</text>'
    + '<text x="72" y="89" font-size="9.5" font-weight="700" fill="#9CB0C4" text-anchor="end">0</text>'
    + '<text x="218" y="89" font-size="9.5" font-weight="700" fill="#9CB0C4">100</text>';

  runtime.state.lastMeterRes = { res, effLVal, baseLVal };
  if (runtime.state.meterView === 'radar') renderSemanticRadar(res, effLVal);
}

export function renderSemanticRadar(res, effLVal) {
  const { LEX, state: s } = runtime;
  const svg = $('meter-dial-svg');
  const cx = 146, cy = 60, maxR = 50;
  const target = (res && res.resolvedTarget) || (s.meterTarget === 'AUTO' ? (getActiveTermsList()[0] || '자유') : (s.meterTarget || '자유'));
  const rL = Math.max(10, Math.min(maxR - 4, maxR * (1 - effLVal / 100)));
  const pts = [];
  const seen = new Set();

  if (res && res.lemma) {
    pts.push({ word: res.lemma, val: res.displayed, tier: 'latest' });
    seen.add(res.lemma);
  }
  const cargoPts = (s.currentCargo && Array.isArray(s.currentCargo._measuredPoints)) ? s.currentCargo._measuredPoints : [];
  cargoPts.filter(m => m.target === target).forEach(m => {
    if (!seen.has(m.word)) { pts.push({ word: m.word, val: m.displayed, tier: 'cargo' }); seen.add(m.word); }
  });
  s.memos.filter(m => m.target === target).slice(0, 8).forEach(m => {
    if (!seen.has(m.word)) { pts.push({ word: m.word, val: m.displayed, tier: 'memo' }); seen.add(m.word); }
  });

  const dotsHtml = pts.map(p => {
    const ang = ((LEX.hashStr(p.word + '|' + target) % 360) * Math.PI) / 180;
    const dist = Math.max(8, Math.min(maxR - 3, maxR * (1 - p.val / 100)));
    const x = cx + dist * Math.cos(ang);
    const y = cy + dist * Math.sin(ang);
    const col = p.val >= effLVal ? '#E04F3E' : '#35F2A0';
    const r = p.tier === 'latest' ? 4.8 : (p.tier === 'cargo' ? 4 : 2.8);
    const op = p.tier === 'memo' ? '0.68' : '1';
    const line = p.tier !== 'memo' ? '<line x1="' + cx + '" y1="' + cy + '" x2="' + x.toFixed(1) + '" y2="' + y.toFixed(1) + '" stroke="' + col + '" stroke-opacity="0.32" stroke-width="1"/>' : '';
    const ring = p.tier === 'latest' ? '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="7.5" fill="none" stroke="#FFFFFF" stroke-opacity="0.6" stroke-width="1"/>' : '';
    return line + ring
      + '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r + '" fill="' + col + '" fill-opacity="' + op + '" stroke="#0D141A" stroke-width="1"/>'
      + '<text x="' + (x + 5).toFixed(1) + '" y="' + (y + 3.5).toFixed(1) + '" font-size="' + (p.tier === 'memo' ? '8.5' : '9.5') + '" font-weight="700" fill="' + (p.tier === 'latest' ? '#FFF' : (p.tier === 'cargo' ? '#E2ECF5' : '#9CB0C4')) + '" fill-opacity="' + op + '">' + escapeHtml(p.word) + '</text>';
  }).join('');

  svg.innerHTML =
    '<rect x="6" y="4" width="280" height="112" rx="5" fill="#0B1117"/>'
    + '<circle cx="' + cx + '" cy="' + cy + '" r="' + maxR + '" fill="none" stroke="#22303D" stroke-width="1"/>'
    + '<circle cx="' + cx + '" cy="' + cy + '" r="' + rL.toFixed(1) + '" fill="rgba(224,79,62,0.12)" stroke="#E04F3E" stroke-width="1.6" stroke-dasharray="3 2"/>'
    + '<circle cx="' + cx + '" cy="' + cy + '" r="6" fill="#E04F3E"/>'
    + '<text x="' + cx + '" y="' + (cy - 9) + '" font-size="9.5" font-weight="700" fill="#FCA5A5" text-anchor="middle">' + escapeHtml(target) + '</text>'
    + dotsHtml
    + '<text x="12" y="16" font-size="9" fill="#9CB0C4">별자리 (안=위반 / 바깥=안전 L' + effLVal + ')</text>'
    + (res ? '<text x="12" y="111" font-size="9.5" font-weight="700" fill="' + (res.displayed >= effLVal ? '#FCA5A5' : '#86EFAC') + '">' + escapeHtml(res.lemma) + ' ↔ ' + escapeHtml(target) + ': L대비 ' + (res.displayed >= effLVal ? '+' : '') + (res.displayed - effLVal) + '</text>' : '');
}

function renderRulebookTermsTab(ph) {
  const { LEX, state: s } = runtime;
  const emoList = LEX.emotionMembers(s.day, ph);
  return getActiveTermsList().map(t => {
    const info = LEX.TERMS[t];
    const bL = LEX.baseL(t, s.day, ph);
    const r06Note = (s.day >= 7 && s.day <= 19 && t !== '감정어') ? (' · 제3구역 L' + (bL - 10)) : '';
    const gradeStr = info.grade === 'permit' ? '허가제' : (info.grade + '등급');
    const extra = t === '감정어'
      ? ('<div class="rb-sub">목록(' + emoList.length + '): ' + emoList.join('·') + '</div>')
      : (info.members ? '<div class="rb-sub">목록: ' + info.members.join('·') + '</div>' : '');
    const mediaNote = info.media ? '<div class="rb-sub">적용: ' + info.media.join('·') + '</div>' : '';
    return '<div class="rb-card"><div class="rb-card-head"><span>' + info.id + ' · ' + t + '</span><span class="grade-tag ' + (info.grade === 'permit' ? 'grade-e' : '') + '">' + gradeStr + ' L' + bL + '</span></div>' + extra + mediaNote + (r06Note ? '<div class="rb-sub">' + r06Note + '</div>' : '') + '</div>';
  }).join('');
}

function renderRulebookMemoTab() {
  const { LEX, state: s } = runtime;
  const ph = currentPhase();
  let html = '';
  if (s.seoyeonNotes.length) {
    html += '<div style="font-size:0.74rem;font-weight:800;margin-bottom:4px;">[서연의 쪽지]</div>';
    html += s.seoyeonNotes.map(n => '<div class="memo-item seoyeon">D' + n.day + ' · ' + escapeHtml(n.text) + '</div>').join('');
  }
  const driftEntries = Object.entries(s.driftWords || {}).filter(([, v]) => v.count >= 1);
  if (driftEntries.length) {
    html += '<div style="font-size:0.74rem;font-weight:800;margin:8px 0 4px;color:#F4B942;">[언어 전염 · NULL 감시]</div>';
    html += driftEntries.map(([w, info]) => '<div class="memo-item seoyeon">「' + escapeHtml(w) + '」 확산 ' + info.count + '회' + (info.count >= 3 ? ' <strong style="color:#FCA5A5;">(감시 +8 적용 중)</strong>' : '') + '</div>').join('');
  }
  if (s.familyMemos.length) {
    html += '<div style="font-size:0.74rem;font-weight:800;margin:8px 0 4px;">[단어 가족 · 정보 메모]</div>';
    html += s.familyMemos.map(m => '<div class="memo-item family">' + escapeHtml(m) + '</div>').join('');
  }
  if (s.memos.length) {
    html += '<div style="font-size:0.74rem;font-weight:800;margin:8px 0 5px;color:#35F2A0;">[의미 지도 장부 — 안전 / 회색 / 위반]</div>';
    const byTarget = new Map();
    s.memos.forEach(m => {
      if (!byTarget.has(m.target)) byTarget.set(m.target, new Map());
      if (!byTarget.get(m.target).has(m.word)) byTarget.get(m.target).set(m.word, m);
    });
    for (const [target, wordMap] of byTarget.entries()) {
      const bL = LEX.TERMS[target] ? LEX.baseL(target, s.day, ph) : 70;
      const pills = [...wordMap.values()]
        .sort((a, b) => b.displayed - a.displayed)
        .map(m => {
          const cls = m.displayed >= bL ? 'viol' : (m.displayed >= bL - 10 ? 'gray' : 'safe');
          return '<span class="sp-pill ' + cls + '" title="D' + m.day + ' ±' + m.err + '">' + escapeHtml(m.word) + ' ' + m.displayed + '</span>';
        }).join('');
      html += '<div class="spectrum-group"><div class="spectrum-head"><span>' + escapeHtml(target) + '</span><span>기준 L' + bL + '</span></div><div class="spectrum-row">' + pills + '</div></div>';
    }
  }
  return html || '<div style="color:#7A8D9E;text-align:center;margin-top:20px;">기록된 메모가 없습니다.<br>측정기로 낱말을 재면 의미 지도에 자동 정리됩니다.</div>';
}

export function renderAlignmentDashboard(containerId) {
  const el = $(containerId);
  if (!el) return;
  const s = runtime.state;
  const avgQ = s.editPs.length > 0 ? Math.round(s.editPs.reduce((a, b) => a + b, 0) / s.editPs.length) : 0;
  const sLabel = s.S >= 70 ? '위험' : (s.S >= 40 ? '주의' : '안전');
  const tLabel = s.T >= 70 ? '동지' : (s.T >= 45 ? '우호' : '관망');
  const totalMem = s.M + s.E;
  const cards = [
    { name: '감시 의심 (S)', val: s.S + '% · ' + sLabel, pct: s.S, col: s.S >= 70 ? '#E04F3E' : (s.S >= 40 ? '#F4B942' : '#35F2A0') },
    { name: '지하 신뢰 (T)', val: s.T + ' · ' + tLabel, pct: s.T, col: '#38BDF8' },
    { name: '기억 복원 (M+E)', val: s.M + '+' + s.E + ' (' + totalMem + '/40)', pct: Math.min(100, Math.round((totalMem / 30) * 100)), col: '#F2A33A' },
    { name: '평균 보존율 (Q)', val: s.editPs.length ? (avgQ + '% (' + s.editPs.length + '건)') : '미기록', pct: avgQ, col: avgQ >= 85 ? '#35F2A0' : '#A78BFA' }
  ];
  el.innerHTML = cards.map(c =>
    '<div class="align-card"><div class="align-top"><span>' + c.name + '</span><span class="align-val">' + c.val + '</span></div>'
    + '<div class="align-bar"><div class="align-fill" style="width:' + Math.max(0, Math.min(100, c.pct)) + '%;background:' + c.col + ';"></div></div></div>'
  ).join('');
}

export function renderRulebook() {
  const { ENGINE, DAYS_DATA, state: s } = runtime;
  const box = $('rb-content');
  const tab = s.rbTab;
  const ph = currentPhase();
  document.querySelectorAll('.rb-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));

  if (tab === 'terms') {
    box.innerHTML = renderRulebookTermsTab(ph);
  } else if (tab === 'rules') {
    // 고정 안내 카드 — 첫 방문객 인사말에 덮이지 않도록 규칙집 첫 페이지에 둔다.
    const guideCard = '<div class="rb-card" style="border-color:var(--accent);"><div class="rb-card-head"><span>📌 첫 출근 안내</span><span class="rb-sub">고정</span></div><div class="rb-sub">심사 절차는 세 단계입니다. ① 본문에서 의심 낱말을 클릭해 탐침에 올립니다. ② 칩을 골라 측정기로 유사도를 재고 경계선과 비교합니다. ③ 통과·압수·수정 도장 중 하나를 찍습니다. (측정기는 D2부터 정식 지급, 수정 도장은 D3부터. D1은 국장이 빌려준 훈련용 측정기로 연습합니다.)</div></div>';
    box.innerHTML = guideCard + RULES_META
      .filter(r => ENGINE.RULE_DAY[r.id] <= s.day)
      .map(r => '<div class="rb-card"><div class="rb-card-head"><span>' + r.id + ' · ' + r.name + '</span><span class="rb-sub">D' + ENGINE.RULE_DAY[r.id] + '~</span></div><div class="rb-sub">' + escapeHtml(r.desc(s.day, ph)) + '</div></div>')
      .join('');
  } else if (tab === 'notices') {
    let html = '';
    for (let i = s.day; i >= 1; i--) {
      const d = DAYS_DATA[i];
      if (!d) continue;
      html += '<div class="rb-card"><div class="rb-card-head"><span>' + escapeHtml(d.noticeTitle) + '</span><span class="rb-sub">D' + i + '</span></div>'
        + (d.noticeExamples ? '<div class="rb-sub" style="margin-top:3px;">' + escapeHtml(d.noticeExamples) + '</div>' : '')
        + (d.revision && (i < s.day || s.revisionArrived) ? '<div class="rb-sub" style="color:var(--stamp-deny);margin-top:3px;">[' + escapeHtml(d.revision.at || '') + ' 개정] ' + escapeHtml((d.revision.items || []).join(' ')) + '</div>' : '')
        + '</div>';
    }
    box.innerHTML = html;
  } else {
    box.innerHTML = renderRulebookMemoTab();
  }
}
