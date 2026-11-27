'use strict';

import { PORTRAIT_MAP } from './config.js';
import { SFX } from './sfx.js';
import { runtime } from './state.js';
import { escapeHtml, renderTemplate, evalWhen } from './logic.js';
import { $ } from './ui-hud.js';

// 스토리 연출 모듈 — 컷씬 카드, 저녁 대화 타이핑, 인트로 무대.
// 게임 로직·밸런스·대사 내용을 바꾸지 않는다. 연출(표시)만 담당한다.

// 화자 → 초상화 키. 매핑이 없는 화자(독백·연출·NULL 등)는 초상화 없이 텍스트만 표시한다.
export const SPEAKER_PORTRAIT = Object.freeze({
  '국장 문태오': 'director',
  '서연': 'seoyeon',
  '하람': 'hajun',
  '윤희': 'citizen',
  '모리': 'mori',
  '두더지': 'park',
  '박주임': 'park',
  '노을': 'noeul'
});

export function speakerPortraitKey(speaker) {
  if (!speaker) return null;
  if (SPEAKER_PORTRAIT[speaker]) return SPEAKER_PORTRAIT[speaker];
  // '모리 (택배 기사)'처럼 괄호 수식이 붙은 화자명은 앞부분으로 매핑한다.
  const base = speaker.split(' (')[0];
  return SPEAKER_PORTRAIT[base] || null;
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// 타이핑 효과: el에 text를 한 글자씩 채운다.
// 반환값 { promise, complete }: complete()를 호출하면 즉시 전체 표시하고 promise가 resolve된다.
export function typeInto(el, text, opts = {}) {
  const cps = opts.cps || 45;
  let timer = null;
  let done = false;
  let resolveFn;
  const promise = new Promise(res => { resolveFn = res; });
  const finish = () => {
    if (done) return;
    done = true;
    if (timer) { clearInterval(timer); timer = null; }
    el.textContent = text;
    el.classList.remove('typing');
    resolveFn();
  };
  if (prefersReducedMotion() || !text) {
    finish();
    return { promise, complete: finish };
  }
  el.textContent = '';
  el.classList.add('typing');
  const perTick = Math.max(1, Math.round(cps / 45));
  timer = setInterval(() => {
    const next = el.textContent.length + perTick;
    el.textContent = text.slice(0, next);
    if (next >= text.length) finish();
  }, 22);
  return { promise, complete: finish };
}

// ---------------------------------------------------------------------------
// 컷씬 비트 정의 (데이터 기반 — 대사 원문은 stages/days/*.json에서 가져온다)
// ---------------------------------------------------------------------------

// 저녁 핵심 선택 이벤트 → 컷씬. speaker가 null이면 장면 서술(연출)로 표시한다.
const EVENT_BEATS = Object.freeze({
  '#D7_꿈': { title: 'D7 · 저녁 — 꿈', speaker: null, sting: 'bell' },
  '#8': { title: 'D20 · 저녁 — 트럭', speaker: '모리', sting: 'bell' },
  '#9': { title: 'D21 · 저녁 — 증언', speaker: '박주임', sting: 'bell' },
  '#10': { title: 'D25 · 저녁 — NULL의 거래', speaker: 'NULL', sting: 'motif' },
  '#11': { title: 'D26 · 저녁 — 탈출증', speaker: null, sting: 'motif' },
  '#12': { title: 'D27 · 저녁 — 공책', speaker: '하람', sting: 'bell' }
});

// 저녁 인트로 중 컷씬으로 올리는 날 (첫 저녁·초성·그리움 개정).
const INTRO_BEATS = Object.freeze({
  1: 'D1 · 첫 저녁 — 부엌 식탁',
  16: 'D16 · 저녁 — 초성',
  17: 'D17 · 저녁 — 그리움'
});

function eventCutsceneText(ev) {
  const s = runtime.state;
  const useAlt = ev.alt && evalWhen(ev.alt.when);
  const raw = (useAlt ? ev.alt.text : ev.text || '').replace('{본 레지스탕스 화물 수}', String(s.resCargosSeen));
  return renderTemplate(raw);
}

function stripSpeakerPrefix(speaker, text) {
  if (speaker && text.startsWith(speaker + ': ')) return text.slice(speaker.length + 2);
  return text;
}

// 저녁 컷씬 명세 { title, sting, lines: [{s, t}] } 또는 null. DOM 없음 — 단위 테스트 가능.
export function getEveningCutscene(dayNum, dayData) {
  const ev = (dayData && dayData.evening) || {};
  if (ev.event && ev.event.id && EVENT_BEATS[ev.event.id]) {
    const beat = EVENT_BEATS[ev.event.id];
    let speaker = beat.speaker;
    if (ev.event.id === '#11') {
      const useAlt = ev.event.alt && evalWhen(ev.event.alt.when);
      speaker = useAlt ? '두더지' : '모리';
    }
    const text = stripSpeakerPrefix(speaker, eventCutsceneText(ev.event));
    return { title: beat.title, sting: beat.sting, lines: [{ s: speaker || '연출', t: text }] };
  }
  if (Array.isArray(ev.director) && ev.director.length > 0) {
    const lines = ev.director.filter(l => evalWhen(l.when)).map(l => ({ s: '국장 문태오', t: renderTemplate(l.t) }));
    if (lines.length > 0) return { title: 'D' + dayNum + ' · 저녁 — 국장의 고백', sting: 'motif', lines };
  }
  if (Array.isArray(ev.interview) && ev.interview.length > 0) {
    const lines = ev.interview.filter(l => evalWhen(l.when)).map(l => ({ s: '국장 문태오', t: renderTemplate(l.t) }));
    if (lines.length > 0) return { title: 'D' + dayNum + ' · 저녁 — 국장의 방문', sting: 'motif', lines };
  }
  if (INTRO_BEATS[dayNum] && Array.isArray(dayData.eveningIntro) && dayData.eveningIntro.length > 0) {
    const lines = dayData.eveningIntro.filter(l => evalWhen(l.when)).map(l => ({ s: l.s || '저녁', t: renderTemplate(l.t) }));
    if (lines.length > 0) return { title: INTRO_BEATS[dayNum], sting: 'bell', lines };
  }
  return null;
}

// D30 최종 화물 「사전」 컷씬 명세. 대사 원문은 화물 데이터(greeting/body)에서 가져온다.
export function getD30Cutscene(cargo) {
  if (!cargo) return null;
  const lines = [];
  if (cargo.greeting) lines.push({ s: cargo.visitor || '모리', t: renderTemplate(cargo.greeting) });
  const bodyFirst = String(cargo.body || '').split('\n')[0].trim();
  if (bodyFirst) lines.push({ s: '연출', t: renderTemplate(bodyFirst) });
  if (lines.length === 0) return null;
  return { title: 'D30 · 마지막 화물 — 「사전」', sting: 'motif', lines };
}

// ---------------------------------------------------------------------------
// 컷씬 재생 (DOM)
// ---------------------------------------------------------------------------

let activeCutscene = null;

function playSting(kind) {
  if (kind === 'motif') SFX.motif(false);
  else if (kind === 'bell') SFX.bell();
}

export function isCutsceneOpen() {
  return !!activeCutscene;
}

// 컷씬을 전 화면 카드로 재생한다. 닫히면 resolve되는 Promise를 반환한다.
// (이미 재생 중이면 기존 Promise를 반환해 중복 재생을 막는다.)
export function playCutscene(spec) {
  if (!spec || !Array.isArray(spec.lines) || spec.lines.length === 0) return Promise.resolve();
  if (activeCutscene) return activeCutscene.promise;
  const modal = $('modal-cutscene');
  if (!modal) return Promise.resolve();

  playSting(spec.sting);
  document.body.classList.add('cutscene-on');
  $('cutscene-kicker').textContent = spec.title;
  modal.classList.add('active');

  let idx = 0;
  let currentTyper = null;
  let closed = false;
  let resolveFn;
  const promise = new Promise(res => { resolveFn = res; });

  const close = () => {
    if (closed) return;
    closed = true;
    if (currentTyper) currentTyper.complete();
    document.removeEventListener('keydown', onKey, true);
    modal.classList.remove('active');
    document.body.classList.remove('cutscene-on');
    activeCutscene = null;
    resolveFn();
  };
  activeCutscene = { promise, closeFn: close };

  const isTypingDone = () => !$('cutscene-text').classList.contains('typing');

  const renderLine = () => {
    const line = spec.lines[idx];
    const key = speakerPortraitKey(line.s);
    const portraitEl = $('cutscene-portrait');
    if (key && PORTRAIT_MAP[key]) {
      portraitEl.innerHTML = '<img src="' + PORTRAIT_MAP[key] + '" alt="' + escapeHtml(line.s || '') + '">';
      portraitEl.style.display = 'block';
    } else {
      portraitEl.innerHTML = '';
      portraitEl.style.display = 'none';
    }
    $('cutscene-speaker').textContent = line.s || '';
    const textEl = $('cutscene-text');
    currentTyper = typeInto(textEl, line.t, { cps: 40 });
    $('btn-cutscene-next').textContent = idx >= spec.lines.length - 1 ? '이야기로 돌아가기' : '계속 ▸';
  };

  const advance = () => {
    if (currentTyper && !isTypingDone()) { currentTyper.complete(); return; }
    idx++;
    if (idx >= spec.lines.length) close();
    else renderLine();
  };

  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(); }
  };

  $('btn-cutscene-next').onclick = advance;
  $('btn-cutscene-skip').onclick = close;
  $('cutscene-text').onclick = () => { if (currentTyper) currentTyper.complete(); };
  document.addEventListener('keydown', onKey, true);

  renderLine();
  return promise;
}

// 컷씬을 강제로 닫는다 (전역 Esc 핸들러 등에서 사용). 열려 있지 않으면 아무 일도 안 한다.
export function closeCutscene() {
  if (activeCutscene) activeCutscene.closeFn();
}

// ---------------------------------------------------------------------------
// 저녁 대화 타이핑 렌더링
// ---------------------------------------------------------------------------

// 저녁 대화 로그를 한 줄씩 타이핑하며 렌더링한다. 화자별 초상화를 함께 표시한다.
// 클릭하면 현재 줄이 즉시 전체 표시된다. 재렌더링 시 진행 중인 타이핑은 취소하고
// 남은 줄을 즉시 표시한다.
export function renderTypedDialogue(box, lines) {
  if (runtime.timers.eveningType) {
    runtime.timers.eveningType();
    runtime.timers.eveningType = null;
  }
  box.innerHTML = '';
  if (!lines || lines.length === 0) {
    box.innerHTML = '<div class="dialogue-line">조용한 저녁이 지났다.</div>';
    return;
  }
  const rows = lines.map(line => {
    const row = document.createElement('div');
    row.className = 'dialogue-line';
    const key = speakerPortraitKey(line.s);
    const portrait = (key && PORTRAIT_MAP[key])
      ? '<span class="dlg-portrait"><img src="' + PORTRAIT_MAP[key] + '" alt="' + escapeHtml(line.s || '') + '"></span>'
      : '';
    row.innerHTML = portrait + '<span class="speaker-tag">' + escapeHtml(line.s || '') + '</span><span class="dlg-text"></span>';
    box.appendChild(row);
    return { row, textEl: row.querySelector('.dlg-text'), text: renderTemplate(line.t) };
  });

  let cancelled = false;
  let current = null;
  let rowIdx = 0;
  const cancel = () => {
    cancelled = true;
    if (current) current.complete();
    rows.forEach(r => { r.textEl.textContent = r.text; r.textEl.classList.remove('typing'); });
  };
  runtime.timers.eveningType = cancel;

  const typeNext = () => {
    if (cancelled) return;
    if (rowIdx >= rows.length) {
      runtime.timers.eveningType = null;
      return;
    }
    const row = rows[rowIdx];
    current = typeInto(row.textEl, row.text, { cps: 90 });
    current.promise.then(() => {
      if (cancelled) return;
      rowIdx++;
      setTimeout(typeNext, 220);
    });
  };
  box.onclick = () => {
    if (current && !cancelled) current.complete();
  };
  typeNext();
}
