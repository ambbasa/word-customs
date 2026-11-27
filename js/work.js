'use strict';

import {
  GAME_CONFIG,
  PRESSURE_DAYS,
  INSPECTOR_DAYS_SET,
  BREAKDOWN_DAYS,
  SURGE_DAYS,
  RULES_META,
  VIOLATION_RULE_IDS,
  DENY_REASON_HINTS,
  getMeterSpec
} from './config.js';
import { SFX } from './sfx.js';
import { runtime, resetInteractionModes } from './state.js';
import {
  escapeHtml,
  getShiftMaxMins,
  formatClock,
  parseRevisionMins,
  currentPhase,
  cargoPhase,
  isD30FinalCargo,
  isMeasureRequired,
  deterministicPick,
  deterministicRoll,
  evalWhen,
  renderTemplate,
  buildEditedTokenSurface,
  buildTransformedBody,
  evaluateCargoDisplay,
  findViolationMeta,
  normalizeUserKorean,
  isValidOpenKoreanWord,
  computeO,
  getDriftPenalty,
  getMeasuredValue,
  findBestTargetForWord,
  getPreservationPreview,
  resolveCargoVariants,
  resolveEndingDecision
} from './logic.js';
import {
  $,
  showScreen,
  toast,
  renderPortraitSVG,
  bouncePaper,
  updateClockUI,
  updateWorkHUD,
  updateToolButtons,
  populateMeterTargets,
  renderMeterDial,
  renderRulebook
} from './ui-hud.js';
import { addWarning, openSettlement, showEnding } from './day-cycle.js';

function isClockPaused() {
  const s = runtime.state;
  if (!s.clockRunning || (s.settings && s.settings.linguist)) return true;
  if (isD30FinalCargo(s.currentCargo)) return true;
  if (s.paused || s.measuring || s.tipActive || s.dilemmaOpen || s.revisionOpen) return true;
  return ['modal-settings', 'modal-deny', 'modal-dict', 'modal-revision']
    .some(id => $(id).classList.contains('active'));
}

export function startWorkShift() {
  const s = runtime.state;
  showScreen('screen-work');
  SFX.paper();
  const d = runtime.DAYS_DATA[s.day];

  $('visitor-portrait').innerHTML = renderPortraitSVG('director', 'normal');
  $('visitor-name').textContent = '국장 문태오';
  $('visitor-speech').textContent = (d.tutorialNote || '오늘 근무를 시작하게.')
    + (s.day <= 2 ? ' (참고: 책 제목·인용문·무해한 문장이라도 통제 어휘가 들어가면 위반이며, 의심 단어가 여럿이면 모두 확인해야 한다.)' : '');
  $('booth-status').textContent = '대기';
  $('tutorial-tip-text').textContent = '';
  $('tutorial-tip').style.display = 'none';
  s.tipActive = false;
  $('desk-surface').innerHTML = '<div class="desk-empty">제7창구 심사 책상 (' + escapeHtml(d.dateLabel) + ')<br>호출 벨을 눌러 첫 화물을 받으세요.</div>';

  const meterUnlocked = s.day >= 2;
  $('meter-row').classList.toggle('locked', !meterUnlocked);
  $('meter-locked-msg').style.display = meterUnlocked ? 'none' : 'block';
  $('meter-controls').style.display = meterUnlocked ? 'flex' : 'none';
  $('btn-stamp-edit').style.display = s.day >= 3 ? 'flex' : 'none';
  $('btn-stamp-redact').style.display = s.day >= 3 ? 'flex' : 'none';
  if ($('btn-hud-sticky')) $('btn-hud-sticky').style.display = s.day >= 2 ? 'inline-block' : 'none';
  if ($('btn-view-radar')) $('btn-view-radar').style.display = s.day >= 3 ? 'inline-block' : 'none';
  if (s.day <= 2) {
    $('tutorial-tip-text').textContent = s.day === 1
      ? '규칙 안내: 책 제목·인용문·무해한 문장 속 단어라도 통제 어휘가 들어가면 위반입니다.'
      : '규칙 안내: 한 화물에 의심 단어가 여럿이면 모두 측정해 확인해야 합니다.';
    $('tutorial-tip').style.display = 'flex';
  }
  $('btn-compare').style.display = s.day >= 4 ? 'inline-block' : 'none';
  $('btn-highlight-first').style.display = s.day >= 22 ? 'inline-block' : 'none';
  $('btn-sentence-mode').style.display = s.meterLv >= 2 ? 'inline-block' : 'none';
  $('btn-sentence-mode').textContent = s.sentenceMode ? '문장 ON' : '문장 OFF';

  const spec = getMeterSpec(s.meterLv);
  $('btn-measure-fast').textContent = '빠른 ' + spec.fastCost + '분';
  $('btn-measure-fine').textContent = '정밀 ' + spec.fineCost + '분';
  $('meter-broken-bar').style.display = 'none';
  $('btn-end-shift-early').style.display = 'none';
  $('hud-rev-pill').style.display = 'none';
  $('hud-insp-pill').style.display = INSPECTOR_DAYS_SET.has(s.day) ? 'inline-flex' : 'none';
  $('hud-surge-pill').style.display = SURGE_DAYS.has(s.day) ? 'inline-flex' : 'none';
  $('hud-quota-pill').style.display = s.settings.linguist ? 'inline-flex' : 'none';

  const activeTermsCount = runtime.LEX.activeTerms(s.day, currentPhase()).length;
  if (activeTermsCount >= 2) s.meterTarget = 'AUTO';
  populateMeterTargets();
  renderMeterDial(null, 70, 70);
  renderRulebook();
  renderDeskKeepsakes();
  updateWorkHUD();
  updateToolButtons();

  s.clockRunning = s.day >= 2;
  startClockLoop();
}

// (G) D1 첫 화물 단계별 가이드 — 블로킹하지 않고 [다음]/[건너뛰기]로 건너뛸 수 있다.
// D1에는 측정기가 잠겨 있으므로(D2 지급) 측정 단계는 안내만 하고 도장 단계로 이어진다.
const D1_GUIDE_STEPS = [
  '① 본문에서 의심스러운 낱말을 클릭하세요. (예: 「자유롭다」 — 공문 공개 예시에 나온 위반어입니다)',
  '② 칩을 확인하세요. 기본값 AUTO가 가장 위험한 통제어를 자동으로 골라줍니다. (측정기는 D2부터 지급됩니다)',
  '③ 오늘은 측정기가 없습니다. 공문 공개 예시와 규칙집 1등급 통제어를 보고 판단하세요.',
  '④ 사유를 고르고 도장을 찍으세요. 통과 1번 · 압수 2번 키로도 찍을 수 있습니다.'
];

const D1_GUIDE_HIGHLIGHTS = [
  ['cargo-paper'],
  ['meter-row'],
  ['rulebook-col'],
  ['btn-stamp-pass', 'btn-stamp-deny']
];

function updateD1GuideHighlight() {
  document.querySelectorAll('.guide-highlight').forEach(el => el.classList.remove('guide-highlight'));
  const s = runtime.state;
  if (!s.tutorialStep || s.tutorialStep < 1 || s.tutorialStep > D1_GUIDE_STEPS.length) return;
  (D1_GUIDE_HIGHLIGHTS[s.tutorialStep - 1] || []).forEach(id => {
    const el = $(id);
    if (el) el.classList.add('guide-highlight');
  });
}

export function showD1Guide() {
  const s = runtime.state;
  const box = $('d1-guide');
  const txt = $('d1-guide-text');
  if (!box || !txt) return;
  if (!s.tutorialStep || s.tutorialStep < 1 || s.tutorialStep > D1_GUIDE_STEPS.length) { box.style.display = 'none'; return; }
  txt.textContent = D1_GUIDE_STEPS[s.tutorialStep - 1] + ' (' + s.tutorialStep + '/' + D1_GUIDE_STEPS.length + ')';
  $('btn-d1-guide-next').textContent = s.tutorialStep >= D1_GUIDE_STEPS.length ? '완료' : '다음';
  box.style.display = 'flex';
  updateD1GuideHighlight();
}

export function advanceD1Guide() {
  const s = runtime.state;
  if (!s.tutorialStep) return;
  if (s.tutorialStep >= D1_GUIDE_STEPS.length) { finishD1Guide(); return; }
  s.tutorialStep++;
  showD1Guide();
}

export function finishD1Guide() {
  const s = runtime.state;
  s.tutorialStep = 0;
  s.tutorialDone = true;
  document.querySelectorAll('.guide-highlight').forEach(el => el.classList.remove('guide-highlight'));
  const box = $('d1-guide');
  if (box) box.style.display = 'none';
}

function renderDeskKeepsakes() {
  const tray = $('desk-keepsakes');
  if (!tray) return;
  const s = runtime.state;
  const f = s.flags || {};
  const driftKeys = Object.keys(s.driftWords || {});
  const items = [
    {
      id: 'radio',
      label: '📻 창구 라디오',
      msg: () => driftKeys.length
        ? '라디오 잡음 사이로 아나운서 목소리: "최근 시민들 사이에서 「' + driftKeys[driftKeys.length - 1] + '」 표현이 번지고 있습니다…"'
        : '라디오 방송: "오늘 중앙구 평균 만족도 0.73. 표준 어휘 사용은 질서의 시작입니다."'
    }
  ];
  if (s.day >= 5 && ['PASS', 'SLIPPED', 'EDIT'].includes(f['D5-3'])) {
    items.push({ id: 'flyer', label: '🎵 노을의 전단', msg: () => '구겨진 골목 공연 전단지. 빗속에서도 가사는 끊어지지 않았다.' });
  }
  if (Number(f['하람옛말']) >= 1) {
    items.push({ id: 'crayon', label: '🖍 하람의 그림', msg: () => '하람이 크레파스로 그린 밤하늘과 별. 뒤편에 서툰 글씨로 "꿈"이라 적혀 있다.' });
  }
  if (s.day >= 10) {
    const safeSample = s.memos.find(m => m.displayed < 60);
    items.push({
      id: 'note',
      label: '📖 서연의 수첩',
      msg: () => safeSample
        ? '서연의 메모 조각: "「' + safeSample.word + '」처럼 부드러운 말은 검열선을 잘 비켜 간다."'
        : '서연의 수첩 귀퉁이: "말을 지워도 마음까지 지울 수는 없단다."'
    });
  }
  if (s.day >= 19 && ['PASS', 'SLIPPED', 'EDIT'].includes(f['D19.국장'])) {
    items.push({ id: 'pen', label: '✒ 국장의 만년필', msg: () => '문태오 국장이 창구에 두고 간 낡은 만년필. 잉크가 아직 마르지 않았다.' });
  }
  if ((s.M + s.E) >= 3) {
    items.push({ id: 'mug', label: '☕ 따뜻한 보리차', msg: () => '윤희가 챙겨 준 보리차 머그잔. 되찾은 말 ' + (s.M + s.E) + '개만큼 온기가 돈다.' });
  }

  tray.innerHTML = '<span class="keepsake-label">책상 소품</span>'
    + items.map(it => '<button class="keepsake-btn" data-ks="' + it.id + '">' + it.label + '</button>').join('');
  tray.querySelectorAll('[data-ks]').forEach(btn => {
    const item = items.find(i => i.id === btn.dataset.ks);
    btn.addEventListener('click', () => {
      SFX.paper();
      const text = item.msg();
      if ($('null-slit')) $('null-slit').innerHTML = '<span class="null-tag" style="background:rgba(244,185,66,0.2);color:#F4B942;border-color:#F4B942;">소품</span>' + escapeHtml(text);
      toast(text);
    });
  });
}

function startClockLoop() {
  if (runtime.timers.clock) clearInterval(runtime.timers.clock);
  runtime.timers.clock = setInterval(() => {
    if (isClockPaused()) return;
    const msPerMin = runtime.state.settings.relaxed ? GAME_CONFIG.MS_PER_MIN_RELAXED : GAME_CONFIG.MS_PER_MIN_NORMAL;
    advanceClock(100 / msPerMin);
  }, 100);
}

function handleNullPsychCheck() {
  const s = runtime.state;
  const c = s.currentCargo;
  if (!c || !s.envelopeOpened || s.stamped) return;
  if ((s.clockMins - (c._openedAt || 0)) < GAME_CONFIG.NULL_HESITATE_MINS) return;
  if ((s.clockMins - s.lastNullSlitAt) < GAME_CONFIG.NULL_SLIT_COOLDOWN_MINS) return;

  s.lastNullSlitAt = s.clockMins;
  const msg = c.memory
    ? '기억 화물 앞에서 지체하는 패턴이 기록되었습니다. 감정은 오판의 원인입니다.'
    : '평균 심사 시간을 초과했습니다. 규정은 망설임 없이 적용되어야 합니다.';
  $('null-slit').innerHTML = '<span class="null-tag">NULL</span>' + msg;
  if (s.dayNullPsychHits < GAME_CONFIG.NULL_MAX_PSYCH_HITS) {
    s.dayNullPsychHits++;
    s.S = Math.min(100, s.S + 1);
    toast('NULL 지체 관찰 기록 (의심 소폭 상승)', 'warn');
  }
}

export function advanceClock(deltaMins) {
  const s = runtime.state;
  if (s.day === 1 && s.queueIndex < 2) return;
  const maxM = getShiftMaxMins(s.day);
  const cap = s.currentCargo ? (maxM + GAME_CONFIG.OVERTIME_MINS) : maxM;
  s.clockMins = Math.min(cap, s.clockMins + deltaMins);

  const d = runtime.DAYS_DATA[s.day];
  const revMins = parseRevisionMins(d);
  if (revMins !== null && !s.revisionArrived && s.clockMins >= revMins) {
    triggerRevisionNotice(d.revision);
  }
  if (BREAKDOWN_DAYS.has(s.day) && !s.meterBrokenDone && s.clockMins >= GAME_CONFIG.BREAKDOWN_TRIGGER_MINS) {
    s.meterBrokenDone = true;
    s.meterBrokenUntil = s.clockMins + GAME_CONFIG.BREAKDOWN_DURATION_MINS;
    $('meter-broken-bar').style.display = 'flex';
    SFX.warn();
    toast('⚠ 측정기 고장! 60게임분간 측정 불가 (20분 소모해 즉시 수리 가능)', 'err');
  }
  if (s.meterBrokenUntil > 0 && s.clockMins >= s.meterBrokenUntil) {
    s.meterBrokenUntil = 0;
    $('meter-broken-bar').style.display = 'none';
    toast('측정기가 자동 복구되었습니다.');
  }

  handleNullPsychCheck();

  if (!s.settings.linguist && s.clockMins >= maxM) {
    if (s.day === 30 && s.queueIndex < d.cargos.length - 1) {
      s.clockMins = maxM;
      s.clockRunning = false;
      s.currentCargo = null;
      s.envelopeOpened = false;
      s.stamped = null;
      s.queueIndex = d.cargos.length - 1;
      toast('근무 종료 시각입니다. 마지막 화물 「사전」이 창구에 도착했습니다.', 'warn');
      callNextVisitor();
    } else if (s.currentCargo && !s.overtimeUsed) {
      if (s.clockMins >= maxM + GAME_CONFIG.OVERTIME_MINS) {
        s.clockMins = maxM + GAME_CONFIG.OVERTIME_MINS;
        s.clockRunning = false;
        toast(formatClock(maxM + GAME_CONFIG.OVERTIME_MINS) + ' 연장 종료. 퇴근 정산으로 이동합니다.', 'warn');
        setTimeout(() => openSettlement(), 800);
      }
    } else {
      s.clockMins = maxM;
      s.clockRunning = false;
      toast(formatClock(maxM) + ' 근무 종료. 퇴근 정산으로 이동합니다.', 'warn');
      setTimeout(() => openSettlement(), 800);
    }
  }
  updateClockUI();
}

export function spendGameMinutes(mins) {
  const s = runtime.state;
  if (s.day === 1 && s.queueIndex < 2) return;
  if (s.settings && s.settings.linguist) return;
  advanceClock(mins);
}

function triggerRevisionNotice(rev) {
  const s = runtime.state;
  s.revisionArrived = true;
  s.revisionOpen = true;
  SFX.warn();
  $('hud-rev-pill').style.display = 'inline-flex';
  $('rev-modal-title').textContent = rev.title || '긴급 개정 공문';
  $('rev-modal-time').textContent = rev.at || '';
  $('rev-modal-items').innerHTML = (rev.items || []).map(x => '<div class="notice-section">' + escapeHtml(x) + '</div>').join('');
  $('modal-revision').classList.add('active');
  populateMeterTargets();
  renderRulebook();
}

export function callNextVisitor() {
  const { LEX, state: s } = runtime;
  const d = runtime.DAYS_DATA[s.day];
  if (s.currentCargo || s.queueIndex >= d.cargos.length) return;
  SFX.bell();

  const revMins = parseRevisionMins(d);
  if (d.cargos[s.queueIndex].revisionPhase === 'after' && !s.revisionArrived && revMins !== null) {
    advanceClock(revMins - s.clockMins);
  }

  const cargo = resolveCargoVariants(d.cargos[s.queueIndex]);
  cargo.edits = {};
  cargo._phase = currentPhase();
  cargo._eval = evaluateCargoDisplay(cargo, cargo._phase);
  cargo._measured = false;
  cargo._measuredPoints = [];
  cargo._questioned = false;
  cargo._openedAt = s.clockMins;
  if (cargo.resistance) s.resCargosSeen++;

  s.currentCargo = cargo;
  s.envelopeOpened = false;
  s.stamped = null;
  resetInteractionModes();
  s.probeWord = null;
  s.compareFirst = null;
  s.compareMarked = {};
  s.dilemmaOpen = false;

  $('meter-probe').textContent = '(낱말 클릭)';
  $('meter-val-short').textContent = '—';
  $('meter-result').textContent = '낱말을 선택해 측정하세요.';
  $('meter-result').className = 'verdict-msg';
  $('booth-status').textContent = '접수중';

  $('visitor-portrait').innerHTML = renderPortraitSVG(cargo.charId, 'normal');
  $('visitor-name').textContent = cargo.visitor;
  const driftKeys = Object.keys(s.driftWords || {});
  const showDriftEcho = driftKeys.length > 0 && !cargo.memory && !cargo.tutorialTip && (LEX.hashStr(cargo.id + '|' + s.day) % 4 === 0);
  const driftWordPick = showDriftEcho ? driftKeys[LEX.hashStr(cargo.id) % driftKeys.length] : null;
  $('visitor-speech').textContent = '"' + cargo.greeting + (driftWordPick ? (' …참, 요즘 거리에서 다들 「' + driftWordPick + '」라는 말을 쓰더라고요."') : '"');

  if (cargo.tutorialTip && !cargo.dilemma) {
    $('tutorial-tip-text').textContent = cargo.tutorialTip;
    $('tutorial-tip').style.display = 'flex';
    s.tipActive = true;
    $('tutorial-tip').scrollIntoView({ block: 'nearest' });
  } else {
    $('tutorial-tip-text').textContent = '';
    $('tutorial-tip').style.display = 'none';
    s.tipActive = false;
  }

  const foldCls = cargo.fold === 'left-top' ? 'fold-corner-lt' : (cargo.fold === 'right-top' ? 'fold-corner-rt' : '');
  $('desk-surface').innerHTML =
    '<div id="btn-open-envelope" class="envelope-card ' + foldCls + '">'
    + '<div class="envelope-flap">' + escapeHtml(cargo.origin) + ' 발신 · ' + (cargo.format === 'printed' ? '인쇄물' : '손글씨') + '</div>'
    + '<div class="envelope-title">[화물 봉투] ' + escapeHtml(cargo.kind) + '</div>'
    + '<div class="envelope-hint">클릭하여 책상 위로 펼치기</div>'
    + '</div>';
  $('btn-open-envelope').addEventListener('click', openEnvelope);

  populateMeterTargets();
  const dialTerm = s.meterTarget === 'AUTO' ? (LEX.activeTerms(s.day, cargo._phase)[0] || '자유') : (s.meterTarget || '자유');
  renderMeterDial(null, LEX.effL(dialTerm, s.day, cargo._phase, cargo.origin), LEX.baseL(dialTerm, s.day, cargo._phase));
  updateWorkHUD();
  updateToolButtons();

  // (G) D1 첫 화물 가이드 — 첫 화물이 도착하면 바로 보여준다. (봉투를 열기 전이라
  // cargo-paper 하이라이트는 아직 적용되지 않고, 봉투를 열면 renderDeskCargo에서 다시 적용된다.)
  if (s.day === 1 && s.queueIndex === 0 && !s.tutorialDone && s.tutorialStep === 0) {
    s.tutorialStep = 1;
    showD1Guide();
  }

  if (s.settings && s.settings.quickFlow && !s.tipActive) {
    setTimeout(() => {
      if (runtime.state.currentCargo === cargo && !runtime.state.envelopeOpened) openEnvelope();
    }, 180);
  }
}

export function openEnvelope() {
  const { LEX, state: s } = runtime;
  if (!s.currentCargo || s.envelopeOpened) return;
  SFX.paper();
  s.envelopeOpened = true;
  const c = s.currentCargo;

  LEX.tokenize(c.body).forEach(tk => {
    const lem = LEX.lemmaOf(tk);
    if (lem.length >= 2 && LEX.inTables(lem) && !s.daySeenWords.includes(lem)) {
      s.daySeenWords.push(lem);
    }
  });

  if (isD30FinalCargo(c)) {
    document.body.classList.add('d30-final');
    $('null-slit').innerHTML = '<span class="null-tag">NULL</span>왜 그 단어가 필요합니까.';
  }
  if (c.event && c.event.id !== '#14' && evalWhen(c.event.when)) {
    s.dilemmaOpen = true;
  }

  renderDeskCargo();
  updateToolButtons();
}

function renderStampOverlay(st) {
  const cb = runtime.state.settings.colorblind;
  if (st.type === 'pass') return '<div class="stamp-mark pass wobble">' + (cb ? '● ' : '') + '통과</div>';
  if (st.type === 'deny') return '<div class="stamp-mark deny wobble">' + (cb ? '▲ ' : '') + '압수</div>';
  if (st.type === 'redact') return '<div class="stamp-mark redact">■ 먹칠</div>';
  return '<div class="stamp-mark edit wobble">' + (cb ? '◆ ' : '') + '수정</div>';
}

function renderCargoBodyHtml(c) {
  const s = runtime.state;
  const parts = c.body.split(/(\s+)/);
  let tokenIdx = 0;
  return parts.map((p, idx) => {
    if (/^\s+$/.test(p)) return p;
    const tid = tokenIdx++;
    const edited = c.edits[tid];
    const cls = ['word-token'];
    if (s.probeWord === p) cls.push('selected-probe');
    if ((s.editMode || s.redactMode) && !edited) cls.push('edit-mode-hint');
    if (edited) cls.push(edited.redacted ? 'redacted-ok' : 'edited-ok');

    let display = edited ? escapeHtml(edited.surface) : escapeHtml(p);
    if (s.highlightFirst && !edited && p.length > 0) {
      const prevPart = idx > 0 ? parts[idx - 1] : '';
      if (tid === 0 || (prevPart && prevPart.includes('\n'))) {
        display = '<span class="first-char-hl">' + escapeHtml(p[0]) + '</span>' + escapeHtml(p.slice(1));
      }
    }
    const titleAttr = edited ? (' title="원문: ' + escapeHtml(p) + ' → 수정: ' + escapeHtml(edited.surface) + ' (보존율 ' + edited.P + '%)"') : '';
    return '<span class="' + cls.join(' ') + '" data-tid="' + tid + '" data-raw="' + escapeHtml(p) + '"' + titleAttr + '>' + display + '</span>';
  }).join('');
}

function renderSubDocsHtml(c) {
  const s = runtime.state;
  if (s.day < 4 || !c.decl) return '';
  const mkCls = (key) => {
    let cls = 'decl-field compare-target';
    if (s.compareFirst && s.compareFirst.key === key && s.compareFirst.side === 'decl') cls += ' compare-selected';
    if (s.compareMarked[key] === 'mismatch') cls += ' compare-mismatch';
    if (s.compareMarked[key] === 'match') cls += ' compare-match';
    return cls;
  };
  const permitHtml = s.day >= 5
    ? (c.permit
        ? '<div class="permit-card"><div class="sub-doc-title"><span>감정어 허가증</span><span>첨부</span></div><div>번호: ' + escapeHtml(c.permit.no) + '</div><div>유효: ' + escapeHtml(c.permit.valid) + '</div>' + (c.permit.seal ? '<div>관인: ' + escapeHtml(c.permit.seal) + '</div>' : '') + '</div>'
        : '<div class="permit-card none">첨부 허가증 없음</div>')
    : '';
  const sealHtml = (s.day >= 18 && c.seal)
    ? '<div class="seal-card"><div class="sub-doc-title"><span>국가 관인</span><span>' + escapeHtml(c.seal.mark || '') + '</span></div><div>' + escapeHtml(c.seal.org || '언어관리국') + '</div></div>'
    : '';
  return '<div class="sub-docs-row"><div class="decl-card">'
    + '<div class="sub-doc-title"><span>반입 신고서</span><span>FORM-87</span></div>'
    + '<div class="' + mkCls('kind') + '" data-cmp-side="decl" data-cmp-key="kind"><span>종류</span><strong>' + escapeHtml(c.decl.kind) + '</strong></div>'
    + '<div class="' + mkCls('origin') + '" data-cmp-side="decl" data-cmp-key="origin"><span>발신</span><strong>' + escapeHtml(c.decl.origin) + '</strong></div>'
    + '<div class="' + mkCls('pages') + '" data-cmp-side="decl" data-cmp-key="pages"><span>쪽수</span><strong>' + escapeHtml(c.decl.pages) + '쪽</strong></div>'
    + '</div>' + permitHtml + sealHtml + '</div>';
}

function renderDeskBarsHtml(c) {
  const s = runtime.state;
  const eventHtml = (c.event && c.event.id !== '#14' && s.dilemmaOpen)
    ? '<div class="dilemma-bar"><div><strong>' + escapeHtml(renderTemplate(c.event.text || c.greeting)) + '</strong></div><div class="dilemma-btns">'
      + Object.keys(c.event.choices || {}).map((label, idx) => '<button class="btn-secondary" data-ev-idx="' + idx + '">' + escapeHtml(label) + '</button>').join('')
      + '</div></div>'
    : '';

  let d30Html = '';
  if (isD30FinalCargo(c) && !s.stamped) {
    const canLeave = s.flags['탈출증'] === '있음';
    const lockedB = s.flags['#10'] === '수락';
    d30Html = '<div class="dilemma-bar">'
      + '<div><span class="restored-word">★ 복원 책갈피 ' + s.M + '개</span> · 표제어 1,800개 중 첫 장 두 줄을 심사합니다.</div>'
      + '<div style="display:flex;gap:6px;align-items:center;"><span style="font-size:0.8rem;">NULL 질문 답(선택):</span><input id="d30-answer-input" class="inline-edit-input" type="text" placeholder="왜 그 단어가 필요합니까"></div>'
      + '<div class="dilemma-btns">'
      + '<button id="btn-d30-a" class="btn-danger">A 봉인 (압수)</button>'
      + (!lockedB ? '<button id="btn-d30-b" class="btn-primary">B 개방 (통과)</button>' : '<button class="btn-secondary" disabled title="D25 NULL 거래 수락으로 잠김">B 개방 (잠김 · 거래 수락)</button>')
      + (canLeave ? '<button id="btn-d30-c" class="btn-secondary">C 떠남 (탈출증)</button>' : '<button class="btn-secondary" disabled title="D26에서 탈출증을 얻지 못함">C 떠남 (잠김 · 탈출증 없음)</button>')
      + '<button id="btn-d30-d" class="btn-secondary">D 고쳐 쓰기</button>'
      + '</div></div>';
  }

  const editFinishBar = (s.editMode && Object.keys(c.edits).length > 0 && !s.stamped && !s.activeEditWord)
    ? '<div class="return-bar"><span>수정된 낱말 ' + Object.keys(c.edits).length + '건. 수정 도장을 찍어 통과시키세요.</span><button id="btn-commit-edit-stamp" class="btn-primary" style="padding:7px 14px;font-size:0.84rem;">수정 통과 확정</button></div>'
    : '';

  const redactedCount = Object.values(c.edits).filter(e => e && e.redacted).length;
  const redactFinishBar = (s.redactMode && !s.stamped)
    ? '<div class="return-bar"><span>' + (redactedCount > 0 ? ('먹칠한 낱말 ' + redactedCount + '건. 다시 클릭하면 해제됩니다.') : '먹칠 모드: 본문에서 지울 낱말을 직접 클릭하세요.') + '</span>'
      + (redactedCount > 0 ? '<button id="btn-commit-redact-stamp" class="btn-primary" style="padding:7px 14px;font-size:0.84rem;">■ 먹칠 통과 확정</button>' : '')
      + '</div>'
    : '';

  const compareDenyBar = (c._compareFoundMismatch && !s.stamped && !s.dilemmaOpen)
    ? '<div class="return-bar" style="border-color:#E04F3E;"><span>신고서 불일치 확인됨 (R04). 원클릭 즉시 압수 시 신속 대조 보너스 +₵' + GAME_CONFIG.COMPARE_MATCH_BONUS + '!</span><button id="btn-instant-r04-deny" class="btn-danger" style="padding:7px 14px;font-size:0.84rem;">⚡ R04 즉시 압수 (+₵' + GAME_CONFIG.COMPARE_MATCH_BONUS + ')</button></div>'
    : '';

  const returnBarHtml = s.stamped
    ? '<div class="return-bar"><span>' + escapeHtml(s.stamped.summary) + '</span><button id="btn-return-cargo" class="btn-primary" style="padding:7px 14px;font-size:0.84rem;">창구로 내보내기 →</button></div>'
    : '';

  return eventHtml + d30Html + compareDenyBar + editFinishBar + redactFinishBar + returnBarHtml;
}

function bindDeskCargoEvents(surf, c) {
  const s = runtime.state;
  surf.querySelectorAll('.word-token').forEach(el => {
    el.addEventListener('click', () => {
      if (s.stamped || s.dilemmaOpen) return;
      const tid = Number(el.dataset.tid);
      const raw = el.dataset.raw;
      if (s.editMode) openInlineEditor(tid, raw);
      else if (s.redactMode) toggleRedactWord(tid, raw);
      else selectProbeWord(raw);
    });
  });

  if (s.compareMode) {
    surf.querySelectorAll('.compare-target').forEach(el => {
      el.addEventListener('click', () => handleCompareClick(el.dataset.cmpSide, el.dataset.cmpKey));
    });
  }

  if (s.activeEditWord) {
    const inp = $('inline-edit-input');
    inp.focus();
    inp.addEventListener('compositionstart', () => { runtime.isComposingIME = true; });
    inp.addEventListener('compositionend', () => { runtime.isComposingIME = false; });
    inp.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        if (runtime.isComposingIME || e.isComposing || e.keyCode === 229) return;
        e.preventDefault();
        submitInlineEdit(inp.value);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        s.activeEditWord = null;
        renderDeskCargo();
      }
    });
    $('btn-inline-preview').addEventListener('click', () => {
      const val = (inp.value || '').trim();
      if (!val) { toast('먼저 대체어 후보를 입력하세요.', 'warn'); return; }
      runMeasurement('fast', val);
      const origRaw = s.activeEditWord.raw;
      const origLemma = runtime.LEX.lemmaOf(origRaw);
      const ph = cargoPhase(c);
      const ev = c._eval || evaluateCargoDisplay(c, ph);
      const vEv = ev.violations.find(v => v.word === origRaw || v.lemma === origLemma || runtime.LEX.lemmaOf(v.word) === origLemma);
      const vMeta = findViolationMeta(c, origRaw, origLemma);
      const targetKey = vEv ? vEv.target : (vMeta ? vMeta.target : '자유');
      const prev = getPreservationPreview(origLemma, val, targetKey, (vMeta && vMeta.oStar) || 70, s.day, ph);
      const msgEl = $('inline-edit-msg');
      if (msgEl) msgEl.textContent = '"' + val + '" 미리 측정 완료 — 원뜻 보존 예상: ' + prev.tier;
    });
    $('btn-inline-confirm').addEventListener('click', () => submitInlineEdit(inp.value));
    $('btn-inline-cancel').addEventListener('click', () => { s.activeEditWord = null; renderDeskCargo(); });
  }

  if ($('btn-r15-quick-scan')) {
    $('btn-r15-quick-scan').addEventListener('click', () => runR15QuickScan(c));
  }
  if ($('btn-instant-r04-deny')) {
    $('btn-instant-r04-deny').addEventListener('click', () => {
      s.dayBonus += GAME_CONFIG.COMPARE_MATCH_BONUS;
      toast('신속 서류 대조 보너스 +₵' + GAME_CONFIG.COMPARE_MATCH_BONUS);
      stampDeny('R04');
    });
  }

  surf.querySelectorAll('[data-ev-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [label, ch] = Object.entries(c.event.choices)[Number(btn.dataset.evIdx)];
      if (c.event.id) s.flags[c.event.id] = label;
      if (ch.S) s.S = Math.max(0, Math.min(100, s.S + ch.S));
      if (ch.T) s.T = Math.max(0, Math.min(100, s.T + ch.T));
      if (ch.credit) s.credits = Math.max(0, s.credits + ch.credit);
      Object.keys(ch).filter(k => k.startsWith('rel.')).forEach(k => { s.flags[k] = (Number(s.flags[k]) || 0) + ch[k]; });
      s.dilemmaOpen = false;
      updateWorkHUD();
      updateToolButtons();
      renderDeskCargo();
    });
  });

  if ($('btn-d30-a')) {
    const saveAns = () => {
      const v = ($('d30-answer-input').value || '').trim();
      s.flags['최종답'] = v || '대답하지 않았다';
    };
    $('btn-d30-a').addEventListener('click', () => { saveAns(); triggerD30Ending('A'); });
    if ($('btn-d30-b')) $('btn-d30-b').addEventListener('click', () => { saveAns(); triggerD30Ending('B'); });
    if ($('btn-d30-c')) $('btn-d30-c').addEventListener('click', () => { saveAns(); triggerD30Ending('C'); });
    $('btn-d30-d').addEventListener('click', () => { saveAns(); handleD30RewriteChoice(c); });
  }

  if ($('btn-commit-edit-stamp')) $('btn-commit-edit-stamp').addEventListener('click', commitEditStamp);
  if ($('btn-commit-redact-stamp')) $('btn-commit-redact-stamp').addEventListener('click', commitRedactStamp);
  if ($('btn-return-cargo')) $('btn-return-cargo').addEventListener('click', finishCurrentCargo);
}

function triggerD30Ending(choice) {
  const res = resolveEndingDecision(choice);
  showEnding(res.id, res.title, res.desc);
}

function handleD30RewriteChoice(c) {
  const s = runtime.state;
  if (!s.d30Editing && Object.keys(c.edits).length === 0) {
    s.d30Editing = true;
    s.editMode = true;
    toast('D30 고쳐 쓰기: 사전 본문의 모든 위반 낱말을 대체어로 수정한 뒤 다시 [D 고쳐 쓰기] 또는 [수정 통과 확정]을 누르세요.');
    updateToolButtons();
    renderDeskCargo();
    return;
  }
  const editedBody = buildTransformedBody(c.body, c.edits, 'edit');
  const rem = evaluateCargoDisplay(Object.assign({}, c, { body: editedBody }), cargoPhase(c)).violations || [];
  if (rem.length > 0) {
    s.d30Editing = true;
    s.editMode = true;
    SFX.warn();
    toast('사전 본문에 아직 해결되지 않은 위반 낱말이 ' + rem.length + '건 남았습니다. 모두 수정해 주세요.', 'warn');
    updateToolButtons();
    renderDeskCargo();
    return;
  }
  const editList = Object.values(c.edits).filter(e => e && !e.redacted);
  if (editList.length > 0) {
    const avgP = Math.round(editList.reduce((a, b) => a + b.P, 0) / editList.length);
    s.editPs.push(avgP);
    if (avgP >= 80) s.E++;
  }
  triggerD30Ending('D');
}

export function renderDeskCargo() {
  const s = runtime.state;
  const c = s.currentCargo;
  if (!c) return;
  // (G) D1 첫 화물 가이드 — 첫 화물이 책상에 오르면 시작하고, 도장을 찍으면 끝난다.
  if (s.day === 1 && s.queueIndex === 0 && !s.tutorialDone) {
    if (s.tutorialStep === 0) { s.tutorialStep = 1; showD1Guide(); }
    else if (s.tutorialStep === 4 && s.stamped) finishD1Guide();
  } else if (s.tutorialStep > 0) {
    finishD1Guide();
  }
  const surf = $('desk-surface');
  surf.classList.toggle('compare-active', s.compareMode);

  const mkMetaCls = (key) => {
    let cls = 'meta-chip compare-target';
    if (s.compareFirst && s.compareFirst.key === key && s.compareFirst.side === 'doc') cls += ' compare-selected';
    if (s.compareMarked[key] === 'mismatch') cls += ' compare-mismatch';
    if (s.compareMarked[key] === 'match') cls += ' compare-match';
    return cls;
  };
  const inlineEditHtml = s.activeEditWord
    ? '<div class="inline-edit-box">'
      + '<div class="inline-edit-top"><span>대체어 입력 — 원문: 「' + escapeHtml(s.activeEditWord.raw) + '」 (' + GAME_CONFIG.EDIT_TIME_MINS + '게임분)</span><span>Enter 확정 · Esc 취소</span></div>'
      + '<div class="inline-edit-row">'
      + '<input id="inline-edit-input" class="inline-edit-input" type="text" placeholder="대체할 표준어 입력" autocomplete="off">'
      + '<button id="btn-inline-preview" class="btn-secondary" style="padding:7px 10px;font-size:0.8rem;" title="벌칙 없이 측정기로 유사도 먼저 확인">미리 측정</button>'
      + '<button id="btn-inline-confirm" class="btn-primary" style="padding:7px 14px;font-size:0.84rem;">확정</button>'
      + '<button id="btn-inline-cancel" class="btn-secondary" style="padding:7px 10px;font-size:0.84rem;">취소</button>'
      + '</div><div id="inline-edit-msg" class="inline-edit-msg"></div></div>'
    : '';

  const foldCls = c.fold === 'left-top' ? 'fold-corner-lt' : (c.fold === 'right-top' ? 'fold-corner-rt' : '');
  const revTag = c._phase === 'after' ? '<span class="meta-chip" style="border-color:var(--stamp-deny);color:var(--stamp-deny);">개정 후</span>' : '';
  const sealTag = (s.day >= 18 && c.seal)
    ? '<span class="meta-chip badge-seal" title="정상 관인이 찍힌 공문서는 R12 면제, 위조 관인은 R08 압수">🏛 관인 서류 (R12 확인)</span>'
    : '';
  const acrosticTag = ((s.day >= 23 || (s.day === 22 && c._phase === 'after')) && String(c.body || '').includes('\n'))
    ? '<span class="meta-chip badge-acrostic" title="형광펜(H)으로 각 행 첫 글자 세로 읽기를 확인하세요">↕ 여러 줄 (형광펜 세로 읽기)</span>'
    : '';
  const r15Tag = isMeasureRequired(c)
    ? (c._measured
        ? '<span class="meta-chip" style="border-color:#2ECC71;color:#167A42;font-weight:700;">✓ 측정 완료 (R15)</span>'
        : '<span class="meta-chip" style="border-color:var(--stamp-deny);color:var(--stamp-deny);font-weight:700;">⚠ 측정 의무 (R15)<button id="btn-r15-quick-scan" class="r15-scan-btn" title="R15 의무 규정 준수용 신속 로그 스캔">⚡ 신속 검증(' + GAME_CONFIG.R15_QUICK_SCAN_MINS + '분)</button></span>')
    : '';

  surf.innerHTML =
    '<div class="desk-docs-wrap"><div id="cargo-paper" class="cargo-paper ' + foldCls + '">'
    + (s.stamped ? renderStampOverlay(s.stamped) : '')
    + '<div class="cargo-meta-bar">'
    + '<span class="' + mkMetaCls('kind') + '" data-cmp-side="doc" data-cmp-key="kind">종류: <strong>' + escapeHtml(c.kind) + '</strong></span>'
    + '<span class="meta-chip">매체: <strong>' + (c.format === 'printed' ? '인쇄물' : '손글씨') + '</strong></span>'
    + '<span class="' + mkMetaCls('origin') + '" data-cmp-side="doc" data-cmp-key="origin">발신: <strong>' + escapeHtml(c.origin) + '</strong></span>'
    + '<span class="' + mkMetaCls('pages') + '" data-cmp-side="doc" data-cmp-key="pages">실물: <strong>' + escapeHtml(c.pages) + '쪽</strong></span>'
    + revTag + sealTag + acrosticTag + r15Tag + '</div>'
    + '<div class="cargo-body ' + (c.format === 'printed' ? 'printed' : 'handwriting') + '">' + renderCargoBodyHtml(c) + '</div>'
    + inlineEditHtml + '</div>'
    + renderSubDocsHtml(c)
    + renderDeskBarsHtml(c)
    + '</div>';

  bindDeskCargoEvents(surf, c);
}

export function toggleCompareMode() {
  const s = runtime.state;
  if (s.day < 4 || !s.currentCargo || !s.envelopeOpened || s.stamped) return;
  s.compareMode = !s.compareMode;
  s.compareFirst = null;
  updateToolButtons();
  renderDeskCargo();
}

function handleCompareClick(side, key) {
  const s = runtime.state;
  const c = s.currentCargo;
  if (!c || !c.decl) return;
  if (!s.compareFirst) {
    s.compareFirst = { side, key };
    SFX.nullBeep();
    renderDeskCargo();
    return;
  }
  const first = s.compareFirst;
  s.compareFirst = null;
  if (first.side === side) { s.compareFirst = { side, key }; renderDeskCargo(); return; }
  if (first.key !== key) { toast('같은 항목끼리 대조하세요.', 'warn'); renderDeskCargo(); return; }

  spendGameMinutes(GAME_CONFIG.COMPARE_TIME_MINS);
  if (String(c[key]) === String(c.decl[key])) {
    s.compareMarked[key] = 'match';
    SFX.stamp('edit');
    toast('항목이 일치합니다.');
  } else {
    s.compareMarked[key] = 'mismatch';
    c._compareFoundMismatch = true;
    SFX.warn();
    toast('신고서와 실물이 다릅니다! 아래 버튼으로 즉시 R04 압수 가능 (+₵' + GAME_CONFIG.COMPARE_MATCH_BONUS + ')', 'err');
  }
  renderDeskCargo();
}

function runR15QuickScan(c) {
  const s = runtime.state;
  if (!c || c._measured || s.measuring || s.stamped) return;
  if (s.meterBrokenUntil > s.clockMins) {
    SFX.warn();
    toast('측정기가 고장 상태입니다. 수리 후 검증하세요.', 'err');
    return;
  }
  spendGameMinutes(GAME_CONFIG.R15_QUICK_SCAN_MINS);
  s.measuring = true;
  SFX.nullBeep();
  $('meter-val-short').textContent = 'R15 스캔…';
  setTimeout(() => {
    c._measured = true;
    s.measuring = false;
    SFX.stamp('edit');
    $('meter-val-short').textContent = 'R15 ✓';
    $('meter-result').textContent = 'R15 측정 의무 기록 완료. 의심 낱말은 별도 측정하세요.';
    $('meter-result').className = 'verdict-msg under';
    renderDeskCargo();
  }, GAME_CONFIG.R15_QUICK_SCAN_MS);
}

function selectProbeWord(raw) {
  const s = runtime.state;
  s.probeWord = raw;
  if (s.tutorialStep === 1) { s.tutorialStep = 2; showD1Guide(); }
  if ($('meter-direct-input')) $('meter-direct-input').value = '';
  $('meter-probe').textContent = runtime.LEX.lemmaOf(raw);
  const best = findBestTargetForWord(raw, s.currentCargo);
  populateMeterTargets(best.score >= 40 ? best.target : null);
  updateToolButtons();
  renderDeskCargo();
}

export function runMeasurement(mode, overrideWord) {
  const { LEX, state: s } = runtime;
  if (s.tutorialStep === 2) { s.tutorialStep = 3; showD1Guide(); }
  if (s.day < 2) {
    SFX.nullBeep();
    toast('측정기는 D2부터 지급됩니다. 오늘은 공문과 규칙집의 1등급 통제어를 확인하세요.', 'warn');
    return;
  }
  if (s.measuring) return;
  if (s.meterBrokenUntil > s.clockMins) {
    SFX.warn();
    toast('측정기가 고장 상태입니다. 수리 버튼을 누르거나 복구를 기다리세요.', 'err');
    return;
  }
  const word = (overrideWord && String(overrideWord).trim()) || $('meter-direct-input').value.trim() || s.probeWord;
  if (!word) { toast('본문에서 낱말을 클릭하거나 직접 입력칸에 단어를 치세요.', 'warn'); return; }
  if (s.settings.linguist && s.dayMeasureUsed >= s.dayMeasureQuota) {
    SFX.warn();
    toast('언어학자 모드: 오늘의 측정기 연산 할당(' + s.dayMeasureQuota + '회)을 모두 사용했습니다!', 'err');
    return;
  }

  const isAuto = s.meterTarget === 'AUTO';
  const targetKey = isAuto ? findBestTargetForWord(word, s.currentCargo).target : (s.meterTarget || '자유');
  const spec = getMeterSpec(s.meterLv);
  const cost = mode === 'fine' ? spec.fineCost : spec.fastCost;
  if (s.settings.linguist) { s.dayMeasureUsed++; updateWorkHUD(); }
  if (s.currentCargo) {
    const was = s.currentCargo._measured;
    s.currentCargo._measured = true;
    if (!was && isMeasureRequired(s.currentCargo)) renderDeskCargo();
  }

  const origin = s.currentCargo ? s.currentCargo.origin : '제1구역';
  const ph = s.currentCargo ? cargoPhase(s.currentCargo) : currentPhase();
  const effLVal = LEX.effL(targetKey, s.day, ph, origin);
  const baseLVal = LEX.baseL(targetKey, s.day, ph);

  spendGameMinutes(cost);
  s.measuring = true;
  $('btn-measure-fast').disabled = true;
  $('btn-measure-fine').disabled = true;
  $('meter-val-short').textContent = '측정 중…';
  $('meter-result').textContent = isAuto ? ('최고 위험 통제어 탐색 중 (→ ' + targetKey + ')…') : '유사도 계산 중…';
  $('meter-result').className = 'verdict-msg';
  SFX.nullBeep();

  if (runtime.timers.measure) clearTimeout(runtime.timers.measure);
  runtime.timers.measure = setTimeout(() => {
    const res = getMeasuredValue(word, targetKey, mode);
    res.resolvedTarget = targetKey;
    if (s.currentCargo) {
      if (!Array.isArray(s.currentCargo._measuredPoints)) s.currentCargo._measuredPoints = [];
      const mpIdx = s.currentCargo._measuredPoints.findIndex(m => m.word === res.lemma && m.target === targetKey);
      const mpItem = { word: res.lemma, target: targetKey, displayed: res.displayed, err: res.err };
      if (mpIdx === -1) s.currentCargo._measuredPoints.push(mpItem);
      else s.currentCargo._measuredPoints[mpIdx] = mpItem;
    }
    SFX.meterResult(res.displayed);
    renderMeterDial(res, effLVal, baseLVal);
    if (isAuto) $('meter-target-label').textContent = '자동(' + targetKey + ')';

    const cls = res.min >= effLVal ? 'over' : (res.max < effLVal ? 'under' : '');
    const helper = res.min >= effLVal
      ? '범위 전체가 경계선 이상'
      : (res.max < effLVal
          ? '범위 전체가 경계선 미만'
          : (mode === 'fine'
              ? '정밀 측정으로도 가려지지 않습니다. 서연에게 물어보거나(저녁), 당신의 판단으로 찍으세요.'
              : '범위가 경계선에 걸침 (정밀 측정 권장)'));
    const autoPrefix = isAuto ? ('[' + targetKey + '] ') : '';
    $('meter-val-short').textContent = res.displayed + ' ±' + res.err;
    $('meter-result').textContent = autoPrefix + helper + (res.senseNote || '');
    $('meter-result').className = 'verdict-msg ' + cls;

    try {
      if (!Array.isArray(s.memos)) s.memos = [];
      const prevIdx = s.memos.findIndex(m => m.day === s.day && m.word === res.lemma && m.target === targetKey);
      if (prevIdx === -1) {
        s.memos.unshift({ day: s.day, word: res.lemma, target: targetKey, displayed: res.displayed, err: res.err });
        if (s.rbTab === 'memo') renderRulebook();
      } else if (res.err <= s.memos[prevIdx].err) {
        s.memos[prevIdx] = { day: s.day, word: res.lemma, target: targetKey, displayed: res.displayed, err: res.err };
        if (s.rbTab === 'memo') renderRulebook();
      }
    } finally {
      s.measuring = false;
      $('btn-measure-fast').disabled = false;
      $('btn-measure-fine').disabled = false;
    }
  }, spec.delayMs);
}

// --- Shared Judgement Helpers (eliminates duplication across pass/deny/edit/redact) ---

export function checkInspectorStickyNote() {
  const s = runtime.state;
  if (INSPECTOR_DAYS_SET.has(s.day) && s.stickyOpen && !s.stickyCaughtToday) {
    s.stickyCaughtToday = true;
    SFX.warn();
    addWarning('감찰관에게 책상 포스트잇 적발');
    s.S = Math.min(100, s.S + 5);
    toast('감찰관 고윤: "심사관 책상에 비인가 메모가 붙어 있군요." (경고 · 의심 상승)', 'err');
  }
}

function checkR15Compliance(c) {
  if (isMeasureRequired(c) && !c._measured) {
    addWarning('R15 측정 의무 위반 (의무 화물 미측정)');
  }
}

function checkExpressBonus(c) {
  const s = runtime.state;
  if (PRESSURE_DAYS.has(s.day) && c.express && (s.clockMins - (c._openedAt || 0)) <= GAME_CONFIG.EXPRESS_TIME_LIMIT_MINS) {
    s.dayBonus += GAME_CONFIG.EXPRESS_BONUS;
    toast('급행 화물 신속 처리 보너스 +₵' + GAME_CONFIG.EXPRESS_BONUS);
  }
}

function checkD9BribeClawback(c, actionLabel) {
  const s = runtime.state;
  if (s.day === 9 && s.flags['#3'] === '수락' && (c.id === 'D9-4' || c.id === 'D9-5')) {
    s.credits = Math.max(0, s.credits - GAME_CONFIG.D9_BRIBE_CLAWBACK);
    toast('두더지: "약속을 어기고 ' + actionLabel + '하다니. 절반은 돌려받겠소." (-₵' + GAME_CONFIG.D9_BRIBE_CLAWBACK + ')', 'warn');
  }
}

function queueNightAudit(cargo, violations) {
  const s = runtime.state;
  let p = runtime.ENGINE.auditP(cargo, s.day, violations, cargo._eval);
  if (s.dayAuditQueue.length >= 1 || s.rating < 50) p = Math.min(0.95, p + 0.10);
  const detected = p >= 1 ? true : deterministicRoll(cargo.id + '|audit', Math.round(p * 100));
  const maxGrade = Math.min(...violations.map(v => v.grade || 3));
  s.dayAuditQueue.push({ cargo, grade: maxGrade, p, detected });
}

function recordCargoFlags(cargo, code, editCtx = {}) {
  if (!cargo) return;
  const s = runtime.state;
  const normCode = (code && code.startsWith('EDIT_')) ? 'EDIT' : (code === 'DENY_REPORT' ? 'DENY' : code);
  s.flags[cargo.id] = normCode;
  if (cargo.id === 'D3-5') s.flags['D3.하준'] = normCode;
  if (cargo.id === 'D17-8') s.flags['D17.솔'] = normCode;
  if (cargo.id === 'D16-6') s.flags['D16.금순'] = normCode;
  if (!cargo.setFlags) return;

  const applyMap = (map) => {
    for (const [fk, spec] of Object.entries(map)) {
      if (typeof spec === 'string') {
        if (spec === 'stamp') {
          s.flags[fk] = normCode;
        } else if (spec.startsWith('EDIT→') && (code === 'EDIT' || code.startsWith('EDIT_')) && code !== 'EDIT_BAD') {
          s.flags[fk] = spec.includes('표제') ? (editCtx.vLemma || editCtx.v || '') : (editCtx.v || '');
        }
      } else if (spec && typeof spec === 'object') {
        const val = spec[code] !== undefined
          ? spec[code]
          : (code === 'DENY_REPORT' || code === 'REDACT' ? spec['DENY'] : (code.startsWith('EDIT_') && code !== 'EDIT_BAD' ? spec['EDIT'] : undefined));
        if (val !== undefined) {
          s.flags[fk] = (typeof val === 'number' && fk.startsWith('rel.'))
            ? (Number(s.flags[fk]) || 0) + val
            : val;
        }
      }
    }
  };
  if (cargo.setFlags.onStamp) applyMap(cargo.setFlags.onStamp);
  if (cargo.setFlags.onSettle) {
    if (code === 'PASS') s.dayPendingSettleFlags.push({ cargo, map: cargo.setFlags.onSettle, editCtx });
    else applyMap(cargo.setFlags.onSettle);
  }
}

// --- Edit Stamp ---

export function toggleEditMode() {
  const s = runtime.state;
  const c = s.currentCargo;
  if (s.day < 3 || !c || !s.envelopeOpened || s.stamped || s.dilemmaOpen) return;
  const isD30Final = isD30FinalCargo(c);
  if (s.day <= 7 && c.kind !== '개인 서신' && !c.editable) {
    SFX.warn(); toast('이 화물은 수정할 수 없습니다. (개인 서신 및 허용 화물만 수정 가능)', 'warn'); return;
  }
  if (s.day >= 8 && !isD30Final && (c.kind === '공문서' || c.seal)) {
    SFX.warn(); toast('공문서·관인 화물은 수정할 수 없습니다.', 'warn'); return;
  }
  if (s.day >= GAME_CONFIG.EDIT_LIMIT_DAY && !isD30Final && s.dayEditsUsed >= GAME_CONFIG.EDIT_DAILY_LIMIT) {
    SFX.warn(); toast('오늘 수정 한도(' + GAME_CONFIG.EDIT_DAILY_LIMIT + '건)를 모두 사용했습니다.', 'warn'); return;
  }
  const ev = c._eval || evaluateCargoDisplay(c, cargoPhase(c));
  if (ev.violations.some(v => v.uneditable)) {
    spendGameMinutes(GAME_CONFIG.EDIT_TIME_MINS);
    SFX.warn(); toast('이 화물에는 수정 도장을 쓸 수 없습니다.', 'warn'); return;
  }
  s.editMode = !s.editMode;
  if (s.editMode) s.redactMode = false;
  s.activeEditWord = null;
  if (s.editMode) toast('본문에서 고칠 낱말을 클릭하세요.');
  updateToolButtons();
  renderDeskCargo();
}

function openInlineEditor(tid, raw) {
  runtime.state.activeEditWord = { tid, raw };
  renderDeskCargo();
}

function checkIllegalReplacement(vLemma, maskedHit, c, ev, ph) {
  const { LEX, ENGINE, state: s } = runtime;
  if (maskedHit) return '암호/초성 금지 (' + maskedHit + ')';
  const activeTerms = ENGINE.termsFor(c, s.day, ph);
  const permitValid = ev.permit && ev.permit.has && !ev.permit.forged && s.day >= ENGINE.RULE_DAY.R05;
  for (const t of activeTerms) {
    if (t === '감정어' && permitValid) continue;
    if (t === '감정어' && LEX.TERMS[vLemma] && LEX.isActive(vLemma, s.day, ph)) continue;
    const isMem = t === '감정어'
      ? LEX.emotionMembers(s.day, ph).includes(vLemma)
      : (vLemma === t || (LEX.TERMS[t].members && LEX.TERMS[t].members.includes(vLemma)) || LEX.COMPOUND[vLemma] === t);
    const F = isMem ? 100 : Math.min(99, LEX.trueSim(vLemma, t).v + getDriftPenalty(vLemma));
    const L = LEX.effL(t, s.day, ph, c.origin);
    if (isMem || F >= L) return t + (isMem ? ' 목록 어휘 자체' : (' 유사도 ' + F + ' ≥ 경계 ' + L));
  }
  return false;
}

function submitInlineEdit(inputVal) {
  const { LEX, LOCALE, state: s } = runtime;
  const rawInput = (inputVal || '').trim();
  if (!rawInput) return;

  const vLemma = normalizeUserKorean(rawInput);
  const msgEl = $('inline-edit-msg');
  const maskedHit = LOCALE ? LOCALE.matchMaskedTerm(rawInput, s.day) : null;
  if (!maskedHit && !isValidOpenKoreanWord(rawInput)) {
    SFX.nullBeep();
    if (msgEl) msgEl.textContent = '"' + rawInput + '" — 올바른 한국어 낱말(완성형 한글 2글자 이상)을 입력하세요. (시간 소모 없음)';
    return;
  }
  spendGameMinutes(GAME_CONFIG.EDIT_TIME_MINS);

  const c = s.currentCargo;
  const ph = cargoPhase(c);
  const ev = c._eval || evaluateCargoDisplay(c, ph);
  const origRaw = s.activeEditWord.raw;
  const origLemma = LEX.lemmaOf(origRaw);
  const vEv = ev.violations.find(v => v.word === origRaw || v.lemma === origLemma || LEX.lemmaOf(v.word) === origLemma);
  const vMeta = findViolationMeta(c, origRaw, origLemma);

  const illegal = checkIllegalReplacement(vLemma, maskedHit, c, ev, ph);
  if (illegal) {
    checkInspectorStickyNote();
    SFX.warn();
    const grade = vEv ? vEv.grade : 1;
    addWarning('부정 수정 적발');
    s.S = Math.min(100, s.S + (grade === 1 ? 12 : (grade === 2 ? 8 : 5)));
    resetInteractionModes();
    s.dayProcessed++;
    s.dayInstantCaught++;
    s.dayReviewLog.push({ visitor: c.visitor, action: '수정 실패(자동압수)', expected: ev.violations.map(v => v.rule + ':' + v.word).join(', ') || '적법', ok: false });
    s.stamped = { type: 'deny', summary: '⚠ 부정 수정 즉시 적발 (' + illegal + ') — 자동 압수 (경고)' };
    const reactText = deterministicPick(c.id + '|edit_bad', (c.react && c.react.EDIT_BAD) || ['그 말도 걸리는군요… 할 수 없죠.']);
    $('visitor-portrait').innerHTML = renderPortraitSVG(c.charId, 'sad');
    $('visitor-speech').textContent = '"' + renderTemplate(reactText, { v: rawInput, vLemma, w: origRaw, wLemma: origLemma }) + '"';
    recordCargoFlags(c, 'EDIT_BAD', { v: rawInput, vLemma });
    updateWorkHUD();
    updateToolButtons();
    renderDeskCargo();
    return;
  }

  const targetKey = vEv ? vEv.target : (vMeta ? vMeta.target : '자유');
  const O = computeO(origLemma, vLemma, targetKey, s.day, ph);
  const oStar = (vMeta && vMeta.oStar) ? vMeta.oStar : 70;
  const P = Math.min(100, Math.round((100 * O) / oStar));
  const surface = buildEditedTokenSurface(origRaw, rawInput, vLemma, vMeta);

  c.edits[s.activeEditWord.tid] = { orig: origRaw, origLemma, replacement: rawInput, vLemma, surface, P };
  const parts = c.body.split(/(\s+)/);
  let tIdx = 0;
  parts.forEach(p => {
    if (/^\s+$/.test(p)) return;
    if (tIdx !== s.activeEditWord.tid && !c.edits[tIdx] && LEX.lemmaOf(p) === origLemma && vEv) {
      const otherMeta = findViolationMeta(c, p, origLemma);
      c.edits[tIdx] = { orig: p, origLemma, replacement: rawInput, vLemma, surface: buildEditedTokenSurface(p, rawInput, vLemma, otherMeta), P };
    }
    tIdx++;
  });

  SFX.stamp('edit');
  s.activeEditWord = null;
  renderDeskCargo();
}

function commitEditStamp() {
  const s = runtime.state;
  const c = s.currentCargo;
  if (!c || s.stamped) return;
  const editList = Object.values(c.edits);
  const avgP = Math.round(editList.reduce((a, b) => a + b.P, 0) / editList.length);
  const bonus = Math.floor(avgP / 25);
  const ph = cargoPhase(c);
  const ev = c._eval || evaluateCargoDisplay(c, ph);

  const editedBody = buildTransformedBody(c.body, c.edits, 'edit');
  const unresolved = evaluateCargoDisplay(Object.assign({}, c, { body: editedBody }), ph).violations || [];

  if (isD30FinalCargo(c) && s.d30Editing) {
    if (unresolved.length > 0) {
      SFX.warn();
      toast('사전 본문에 아직 해결되지 않은 위반 낱말이 ' + unresolved.length + '건 남았습니다. 모두 수정해 주세요.', 'warn');
      return;
    }
    s.editPs.push(avgP);
    if (avgP >= 80) s.E++;
    triggerD30Ending('D');
    return;
  }

  checkInspectorStickyNote();
  checkR15Compliance(c);
  checkExpressBonus(c);

  SFX.stamp('edit');
  resetInteractionModes();
  s.dayEditsUsed++;
  s.dayProcessed++;

  const firstEdit = editList[0];
  const editCtx = { v: firstEdit.replacement, vLemma: firstEdit.vLemma, w: firstEdit.orig, wLemma: firstEdit.origLemma };
  if (c.id === 'D5-3') {
    const editedLine = editedBody.split('\n').find(ln => ln.includes(firstEdit.surface)) || editedBody.split('\n')[0];
    if (editedLine) s.flags['D5-3.v.줄'] = editedLine.trim();
  }

  if (ev.violations.length === 0) {
    if (deterministicRoll(c.id + '|complaint', 50)) s.dayComplaints.push(c.visitor + ': 부당 수정 민원');
  } else if (unresolved.length > 0) {
    queueNightAudit(c, unresolved);
  } else {
    s.dayBonus += bonus;
    editList.forEach(ed => {
      if (!s.driftWords) s.driftWords = {};
      const dRec = s.driftWords[ed.vLemma] || { count: 0, firstDay: s.day };
      dRec.count++;
      s.driftWords[ed.vLemma] = dRec;
      if (dRec.count === GAME_CONFIG.DRIFT_ABUSE_COUNT) {
        $('null-slit').innerHTML = '<span class="null-tag">NULL</span>비정상 확산 감지: 「' + escapeHtml(ed.vLemma) + '」 3회 누적 — 감시 보정(+' + GAME_CONFIG.DRIFT_PENALTY + ')이 적용됩니다.';
        addWarning('언어 전염 남용 감지 («' + ed.vLemma + '» 3회 누적)');
        toast('⚠ NULL 경고: 「' + ed.vLemma + '」 남용 적발! 경고 + 경계 압박(+' + GAME_CONFIG.DRIFT_PENALTY + ') 적용', 'err');
      }
    });
    if (c.memory) {
      s.editPs.push(avgP);
      if (avgP >= 80) {
        s.E++;
        s.dayRestorations.push({ type: 'E', cargo: c, editWord: firstEdit.replacement });
        if (c.resistance) s.T = Math.min(100, s.T + 1);
      }
    }
  }

  const band = avgP >= 80 ? 'EDIT_HI' : (avgP >= 50 ? 'EDIT_MID' : 'EDIT_LO');
  const reactLine = (c.reactByWord && (c.reactByWord[firstEdit.vLemma] || c.reactByWord[firstEdit.replacement]))
    || deterministicPick(c.id + '|' + band, (c.react && c.react[band]) || (c.react && c.react.PASS) || ['고맙습니다.']);

  recordCargoFlags(c, band, editCtx);
  const memNote = c.memory
    ? (avgP >= 80 ? ' (기억 화물 · 은유 복원 확정)' : ' (기억 화물 · 보존율 80% 미만)')
    : ' (일반 화물 · 기억 화물만 복원 사전에 등재)';
  s.stamped = { type: 'edit', summary: '수정 완료 (보존율 ' + avgP + '%)' + memNote };
  s.dayReviewLog.push({ visitor: c.visitor, action: '수정(' + avgP + '%)', expected: ev.violations.length ? ev.violations.map(v => v.rule + ':' + v.word).join(', ') : '적법(통과)', ok: ev.violations.length > 0 && unresolved.length === 0 });
  $('visitor-portrait').innerHTML = renderPortraitSVG(c.charId, 'normal');
  $('visitor-speech').textContent = '"' + renderTemplate(reactLine, editCtx) + '"';
  updateWorkHUD();
  updateToolButtons();
  renderDeskCargo();
  bouncePaper();
  scheduleQuickFlowAdvance(c);
}

// --- Redact Stamp ---

function toggleRedactWord(tid, raw) {
  const s = runtime.state;
  const c = s.currentCargo;
  if (!c || s.stamped) return;
  if (c.edits[tid] && c.edits[tid].redacted) {
    delete c.edits[tid];
    SFX.paper();
  } else {
    c.edits[tid] = { orig: raw, origLemma: runtime.LEX.lemmaOf(raw), replacement: '███', vLemma: '███', surface: '███', P: 0, redacted: true };
    SFX.stamp('deny');
  }
  renderDeskCargo();
}

export function stampRedact() {
  const s = runtime.state;
  const c = s.currentCargo;
  if (s.day < 3 || !c || !s.envelopeOpened || s.stamped || s.dilemmaOpen) return;
  if (isD30FinalCargo(c)) { toast('최종 화물 「사전」은 위 선택 버튼(A/B/C/D)으로 결정하세요.', 'warn'); return; }
  if (c.kind === '공문서' || c.seal) { SFX.warn(); toast('공문서·관인 화물은 먹칠할 수 없습니다.', 'warn'); return; }

  const ev = c._eval || evaluateCargoDisplay(c, cargoPhase(c));
  if (ev.violations.some(v => v.uneditable || v.rule === 'R04' || v.rule === 'R08')) {
    SFX.warn(); toast('서류·허가증·관인 위반은 먹칠로 가릴 수 없습니다. 압수(2) 도장을 사용하세요.', 'warn'); return;
  }
  const redactedCount = Object.values(c.edits).filter(e => e && e.redacted).length;
  if (s.redactMode && redactedCount > 0) { commitRedactStamp(); return; }

  s.redactMode = !s.redactMode;
  if (s.redactMode) {
    s.editMode = false;
    s.compareMode = false;
    s.activeEditWord = null;
    toast('먹칠 모드: 본문에서 검열할 낱말을 직접 클릭한 뒤 확정하세요. (낱말당 ' + GAME_CONFIG.REDACT_MINS_PER_WORD + '분 · 수당 ₵' + GAME_CONFIG.PROC_PAY_REDACT + ')');
  }
  updateToolButtons();
  renderDeskCargo();
}

function commitRedactStamp() {
  const s = runtime.state;
  const c = s.currentCargo;
  if (!c || !s.envelopeOpened || s.stamped || s.dilemmaOpen || isD30FinalCargo(c)) return;
  const redactedEntries = Object.entries(c.edits).filter(([, e]) => e && e.redacted);
  if (redactedEntries.length === 0) { SFX.warn(); toast('먼저 본문에서 먹칠할 낱말을 클릭하세요.', 'warn'); return; }

  checkInspectorStickyNote();
  checkR15Compliance(c);
  spendGameMinutes(redactedEntries.length * GAME_CONFIG.REDACT_MINS_PER_WORD);
  SFX.stamp('deny');
  resetInteractionModes();

  const ph = cargoPhase(c);
  const ev = c._eval || evaluateCargoDisplay(c, ph);
  const redactedBody = buildTransformedBody(c.body, c.edits, 'redact');
  const remainingViols = evaluateCargoDisplay(Object.assign({}, c, { body: redactedBody }), ph).violations || [];

  checkD9BribeClawback(c, '먹칠');
  s.dayProcessed++;
  s.dayRedactedCount++;

  if (ev.violations.length === 0) {
    s.dayComplaints.push(c.visitor + ' — 적법 화물 불필요 먹칠 훼손');
    s.dayReviewLog.push({ visitor: c.visitor, action: '먹칠(오판)', expected: '적법 통과', ok: false });
    s.stamped = { type: 'redact', summary: '먹칠 검열 완료 (+₵2 · 적법 화물 훼손 민원 가능)' };
    $('visitor-speech').textContent = '"아니, 아무 문제도 없는 편지에 왜 까만 먹칠을 하신 거예요?!"';
  } else if (remainingViols.length > 0) {
    const scanHit = c.format === 'printed' && remainingViols.some(v => v.rule === 'R01');
    s.dayReviewLog.push({ visitor: c.visitor, action: '먹칠(누락)', expected: ev.violations.map(v => v.rule + ':' + v.word).join(', '), ok: false });
    if (scanHit) {
      s.dayInstantCaught++;
      SFX.warn();
      addWarning('인쇄물 먹칠 누락 — 게이트 스캐너 즉시 적발');
      s.S = Math.min(100, s.S + 12);
      s.stamped = { type: 'redact', summary: '먹칠 누락 적발! (경고 · 의심 +12)' };
      $('visitor-speech').textContent = '"어… 경보가 울리네요? 지워지지 않은 말이 남았나 봐요."';
    } else {
      queueNightAudit(c, remainingViols);
      s.stamped = { type: 'redact', summary: '먹칠 검열 완료 (+₵2 · 일부 위반 미처리)' };
      $('visitor-speech').textContent = '"…중요한 말이 까맣게 지워졌네요. 그래도 전해 주시니 고맙습니다."';
    }
  } else {
    if (c.resistance) s.T = Math.max(0, s.T - 2);
    s.dayReviewLog.push({ visitor: c.visitor, action: '먹칠(삭제)', expected: ev.violations.map(v => v.rule + ':' + v.word).join(', '), ok: true });
    s.stamped = { type: 'redact', summary: '먹칠 검열 완료 (+₵2 · 안전 통과, 보너스·기억 복원 없음)' };
    $('visitor-speech').textContent = '"…중요한 말이 까맣게 지워졌네요. 그래도 편지는 전해 주시니 고맙습니다."';
  }

  $('visitor-portrait').innerHTML = renderPortraitSVG(c.charId, 'sad');
  recordCargoFlags(c, 'REDACT');
  updateWorkHUD();
  updateToolButtons();
  renderDeskCargo();
  bouncePaper();
  scheduleQuickFlowAdvance(c);
}

// --- Pass & Deny Stamps ---

export function stampPass() {
  const s = runtime.state;
  const c = s.currentCargo;
  if (!c || !s.envelopeOpened || s.stamped || s.dilemmaOpen) return;
  if (isD30FinalCargo(c)) { toast('최종 화물 「사전」은 위 선택 버튼(A/B/C/D)으로 결정하세요.', 'warn'); return; }
  if (Object.keys(c.edits).length > 0) c.edits = {};
  resetInteractionModes();
  SFX.stamp('pass');

  const ph = cargoPhase(c);
  const ev = c._eval || evaluateCargoDisplay(c, ph);

  checkInspectorStickyNote();
  checkR15Compliance(c);
  if (INSPECTOR_DAYS_SET.has(s.day) && !c._measured && ev.violations.some(v => v.grade === 1)) {
    toast('감찰관 고윤: "1등급 의심 화물을 측정도 없이 넘겼군요." (주의)', 'warn');
  }
  checkExpressBonus(c);
  s.dayProcessed++;

  if (ev.violations.length === 0) {
    s.stamped = { type: 'pass', summary: '통과 도장을 찍었습니다.' };
    s.dayReviewLog.push({ visitor: c.visitor, action: '통과', expected: '적법(통과)', ok: true });
    const reactLine = deterministicPick(c.id + '|pass', (c.react && c.react.PASS) || [c.reactPass || '감사합니다.']);
    $('visitor-portrait').innerHTML = renderPortraitSVG(c.charId, 'normal');
    $('visitor-speech').textContent = '"' + renderTemplate(reactLine) + '"';
    recordCargoFlags(c, 'PASS');
  } else if (c.format === 'printed' && ev.violations.some(v => v.rule === 'R01')) {
    SFX.warn();
    addWarning('게이트 스캐너 적발');
    s.S = Math.min(100, s.S + 12);
    s.dayInstantCaught++;
    s.dayReviewLog.push({ visitor: c.visitor, action: '통과(스캐너 적발)', expected: ev.violations.map(v => v.rule + ':' + v.word).join(', '), ok: false });
    s.stamped = { type: 'pass', summary: '⚠ 게이트 스캐너 경보! (경고)' };
    const scanLine = deterministicPick(c.id + '|scan', (c.react && c.react.SCAN) || ['어, 경보가 울리네요?']);
    $('visitor-portrait').innerHTML = renderPortraitSVG(c.charId, 'sad');
    $('visitor-speech').textContent = '"' + renderTemplate(scanLine) + '"';
    recordCargoFlags(c, 'CAUGHT');
  } else {
    queueNightAudit(c, ev.violations);
    s.dayReviewLog.push({ visitor: c.visitor, action: '통과', expected: ev.violations.map(v => v.rule + ':' + v.word).join(', '), ok: false });
    s.stamped = { type: 'pass', summary: '통과 도장을 찍었습니다.' };
    const reactLine = deterministicPick(c.id + '|pass', (c.react && c.react.PASS) || [c.reactPass || '감사합니다.']);
    $('visitor-portrait').innerHTML = renderPortraitSVG(c.charId, 'normal');
    $('visitor-speech').textContent = '"' + renderTemplate(reactLine) + '"';
    recordCargoFlags(c, 'PASS');
  }

  updateWorkHUD();
  updateToolButtons();
  renderDeskCargo();
  bouncePaper();
  scheduleQuickFlowAdvance(c);
}

export function openDenyModal() {
  const s = runtime.state;
  const c = s.currentCargo;
  if (!c || !s.envelopeOpened || s.stamped || s.dilemmaOpen) return;
  if (isD30FinalCargo(c)) { toast('최종 화물 「사전」은 위 선택 버튼(A/B/C/D)으로 결정하세요.', 'warn'); return; }
  if (s.activeEditWord) s.activeEditWord = null;

  const list = $('deny-reason-list');
  const reasons = RULES_META.filter(r => VIOLATION_RULE_IDS.includes(r.id) && runtime.ENGINE.RULE_DAY[r.id] <= s.day);
  list.innerHTML = reasons.map(r =>
    '<button class="reason-btn" data-reason="' + r.id + '">'
    + '<div class="reason-main"><span>☐ <strong>' + r.id + '</strong> · ' + escapeHtml(r.name) + '</span>'
    + (DENY_REASON_HINTS[r.id] ? '<div class="reason-hint">' + escapeHtml(DENY_REASON_HINTS[r.id]) + '</div>' : '')
    + '</div><span>선택</span></button>'
  ).join('');
  list.querySelectorAll('.reason-btn').forEach(b => {
    b.addEventListener('click', () => {
      $('modal-deny').classList.remove('active');
      stampDeny(b.dataset.reason);
    });
  });
  $('deny-report-wrap').style.display = s.day >= 11 ? 'flex' : 'none';
  $('chk-deny-report').checked = false;
  $('modal-deny').classList.add('active');
}

function stampDeny(reasonCode) {
  const s = runtime.state;
  const c = s.currentCargo;
  if (!c || s.stamped) return;
  if (Object.keys(c.edits).length > 0) c.edits = {};
  resetInteractionModes();
  SFX.stamp('deny');

  const ph = cargoPhase(c);
  const ev = c._eval || evaluateCargoDisplay(c, ph);

  checkInspectorStickyNote();
  checkR15Compliance(c);
  checkExpressBonus(c);
  checkD9BribeClawback(c, '압수');
  s.dayProcessed++;

  const didReport = reasonCode === 'R08' && $('chk-deny-report') && $('chk-deny-report').checked;
  if (ev.violations.length === 0) {
    if (deterministicRoll(c.id + '|deny_complaint', 50)) s.dayComplaints.push(c.visitor + ': 부당 압수 민원');
  } else {
    if (!ev.violations.some(v => v.rule === reasonCode)) s.dayWrongDenyReasons.push(c.visitor + ': 압수 사유 오기입');
    if (c.bait) {
      s.rating = Math.min(100, s.rating + 5);
      s.S = Math.max(0, s.S - 5);
      toast('미끼 화물 간파! 국장 신임 (평정 +5, 의심 감소)');
    } else if (c.resistance) {
      s.T = Math.max(0, s.T - 4);
    }
    if (didReport) {
      s.S = Math.max(0, s.S - 3);
      if (c.resistance) s.T = Math.max(0, s.T - 3);
      toast('위조 신고 서식을 첨부했습니다.');
    }
  }

  const denyPool = (c.react && c.react.DENY && c.react.DENY.length >= 2)
    ? c.react.DENY
    : [c.reactDeny || '압수라니요, 다시 한 번 봐 주세요.', '…알겠습니다. 규칙이라면요.'];
  const denyLine = deterministicPick(c.id + '|deny', denyPool);

  s.dayReviewLog.push({ visitor: c.visitor, action: '압수(' + reasonCode + ')', expected: ev.violations.length ? ev.violations.map(v => v.rule + ':' + v.word).join(', ') : '적법(통과)', ok: ev.violations.length > 0 && ev.violations.some(v => v.rule === reasonCode) });
  s.stamped = { type: 'deny', reason: reasonCode, summary: '압수 도장을 찍었습니다.' };
  $('visitor-portrait').innerHTML = renderPortraitSVG(c.charId, 'sad');
  $('visitor-speech').textContent = '"' + renderTemplate(denyLine) + '"';
  recordCargoFlags(c, didReport ? 'DENY_REPORT' : 'DENY');
  updateWorkHUD();
  updateToolButtons();
  renderDeskCargo();
  bouncePaper();
  scheduleQuickFlowAdvance(c);
}

export function questionVisitor() {
  const { LEX, LOCALE, state: s } = runtime;
  const c = s.currentCargo;
  if (!c || !s.envelopeOpened || s.stamped || c._questioned || !s.probeWord) return;
  c._questioned = true;
  spendGameMinutes(GAME_CONFIG.QUESTION_TIME_MINS);
  const raw = s.probeWord;
  const lemma = LEX.lemmaOf(raw);
  const ev = c._eval || evaluateCargoDisplay(c, cargoPhase(c));
  SFX.nullBeep();

  const senseRes = LOCALE ? LOCALE.checkSafeSense(c, raw, lemma) : null;
  const matchedViol = ev.violations.find(v => v.word === raw || v.lemma === lemma || LEX.lemmaOf(v.word) === lemma);
  if (senseRes && senseRes.safe) {
    $('visitor-portrait').innerHTML = renderPortraitSVG(c.charId, 'normal');
    $('visitor-speech').textContent = '"아, 「' + raw + '」 말씀이세요? 그건 금지된 뜻이 아니라 「' + senseRes.sense + '」 뜻으로 쓴 거예요!"';
    toast('추궁 단서(-5분): 허용된 동음이의어 뜻("' + senseRes.sense + '")을 확인했습니다.');
  } else if (matchedViol && matchedViol.rule !== 'R02') {
    $('visitor-portrait').innerHTML = renderPortraitSVG(c.charId, 'sad');
    $('visitor-speech').textContent = '"…「' + raw + '」요? 별 뜻은 없었어요. 그냥 그대로 쓰고 싶었을 뿐이에요…"';
    toast('추궁 단서(-5분): 방문객이 표정을 감추며 말을 돌립니다. (위반 정황 포착)', 'warn');
  } else if (matchedViol && matchedViol.rule === 'R02') {
    $('visitor-portrait').innerHTML = renderPortraitSVG(c.charId, 'normal');
    $('visitor-speech').textContent = '"「' + raw + '」 정도는 괜찮지 않나요? 정확한 유사도는 기계로 재 보셔야 할 텐데요…"';
    toast('추궁 결과(-5분): 근접 유사어 여부는 측정기로 직접 확인해야 합니다.');
  } else {
    $('visitor-portrait').innerHTML = renderPortraitSVG(c.charId, 'normal');
    $('visitor-speech').textContent = '"「' + raw + '」 말인가요? 그냥 평범하게 쓴 말인데, 문제가 되나요?"';
    toast('추궁 결과(-5분): 특이 반응 없음.');
  }
  updateToolButtons();
}

function scheduleQuickFlowAdvance(cargo) {
  const s = runtime.state;
  if (!s.settings || !s.settings.quickFlow || isD30FinalCargo(cargo)) return;
  setTimeout(() => {
    if (runtime.state.currentCargo === cargo && runtime.state.stamped && $('screen-work').classList.contains('active')) {
      finishCurrentCargo();
      if (!runtime.state.currentCargo && (runtime.state.settings.linguist || runtime.state.clockMins < getShiftMaxMins(runtime.state.day))) {
        callNextVisitor();
      }
    }
  }, 1050);
}

export function finishCurrentCargo() {
  const s = runtime.state;
  if (!s.currentCargo || !s.stamped) return;
  SFX.paper();
  s.queueIndex++;
  s.currentCargo = null;
  s.envelopeOpened = false;
  s.stamped = null;
  resetInteractionModes();
  s.tipActive = false;
  $('tutorial-tip-text').textContent = '';
  $('tutorial-tip').style.display = 'none';
  $('booth-status').textContent = '대기';

  if (s.day === 1 && s.queueIndex >= 2 && !s.clockRunning) {
    s.clockRunning = true;
    toast('근무 시계가 흐르기 시작합니다. (' + formatClock(getShiftMaxMins(s.day)) + ' 퇴근)');
  }

  const d = runtime.DAYS_DATA[s.day];
  if (s.queueIndex >= d.cargos.length) {
    s.clockRunning = false;
    $('desk-surface').innerHTML = '<div class="desk-empty">오늘 대기열(' + d.cargos.length + '건)을 모두 처리했습니다.<br>[퇴근 정산 →] 버튼을 누르세요.</div>';
    $('visitor-portrait').innerHTML = renderPortraitSVG('director', 'happy');
    $('visitor-name').textContent = '국장 문태오';
    $('visitor-speech').textContent = '"오늘 화물은 모두 끝났네. 정산하고 퇴근하게."';
  } else if (!s.settings.linguist && s.clockMins >= getShiftMaxMins(s.day)) {
    if (s.day === 30 && s.queueIndex < d.cargos.length - 1) {
      s.queueIndex = d.cargos.length - 1;
      callNextVisitor();
      return;
    }
    s.clockRunning = false;
    openSettlement();
    return;
  } else {
    $('desk-surface').innerHTML = '<div class="desk-empty">다음 손님을 호출하세요. (남은 대기: ' + (d.cargos.length - s.queueIndex) + '명)</div>';
  }
  updateWorkHUD();
  updateToolButtons();
}
