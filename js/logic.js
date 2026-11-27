'use strict';

import { GAME_CONFIG, REVISION_FALLBACK_TIME, GENERIC_GREETING_ALTS, getMeterSpec } from './config.js';
import { runtime } from './state.js';

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getShiftMaxMins(dayNum) {
  const d = dayNum || runtime.state.day || 1;
  if (d <= 10) return 420; // 15:00
  if (d <= 20) return 510; // 16:30
  return 600;              // 18:00
}

export function formatClock(mins) {
  const total = 8 * 60 + Math.floor(mins);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

// 12시간제 시계 표시 — "08:00"이 남은 시간(분)으로 오해되지 않게 오전/오후를 붙인다.
// 게임 시각은 08:00~18:00 범위라 오전은 8~11시, 오후는 12~18시다.
export function formatClock12(mins) {
  const total = 8 * 60 + Math.floor(mins);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const period = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return period + ' ' + h12 + ':' + String(m).padStart(2, '0');
}

export function parseRevisionMins(dayObj) {
  if (!dayObj || !dayObj.revision) return null;
  const atStr = dayObj.revision.at || REVISION_FALLBACK_TIME[dayObj.day];
  if (!atStr) return null;
  const m = String(atStr).match(/(\d{1,2}):(\d{2})/);
  return m ? (Number(m[1]) - 8) * 60 + Number(m[2]) : null;
}

export function currentPhase() {
  return runtime.state.revisionArrived ? 'after' : 'before';
}

export function cargoPhase(cargo) {
  return (cargo && cargo._phase) ? cargo._phase : currentPhase();
}

export function isD30FinalCargo(cargo) {
  return !!(runtime.state.day === 30 && cargo && cargo.kind === '사전');
}

export function isMeasureRequired(cargo) {
  if (isD30FinalCargo(cargo)) return false;
  return !!(runtime.state.day >= 28 && cargo && (cargo.format !== 'printed' || cargo.origin === '제3구역'));
}

export function getActiveTermsList() {
  return runtime.LEX.activeTerms(runtime.state.day, currentPhase());
}

// 언어학자 모드는 D3부터 적용된다 (D1·D2는 설정해도 효과가 없다 — 해금 전까지는 시간 무제한·할당제가 열리지 않는다).
export function isLinguistActive() {
  const s = runtime.state;
  return !!(s.settings && s.settings.linguist) && s.day >= GAME_CONFIG.TUTORIAL_UNLOCK_DAY;
}

// 측정기 사용 가능 여부 — D1 튜토리얼 날은 훈련용 측정기(첫 화물이 책상에 오른 뒤부터), D2부터는 정식 지급.
export function isMeterUnlocked() {
  const s = runtime.state;
  if (s.day >= 2) return true;
  return s.day === 1 && !!s.currentCargo;
}

// 측정기 칩 목록 — 활성 통제어 + 튜토리얼 화물이 지정한 연습용 칩(D1 1번 화물의 「사랑」).
export function getMeterChipTerms(cargo) {
  const terms = getActiveTermsList();
  const extra = (cargo && Array.isArray(cargo.tutorialChips)) ? cargo.tutorialChips : [];
  for (const t of extra) if (!terms.includes(t)) terms.push(t);
  return terms;
}

export function getFamilyStatusLabel() {
  const s = runtime.state;
  if (s.familyGone) return '윤희·하람 귀가';
  if (s.foodMissed >= 2) return '허약';
  if (s.foodMissed === 1) return '배고픔';
  return '보통';
}

export function deterministicPick(key, arr) {
  if (!arr || !arr.length) return '';
  const s = runtime.state;
  const h = runtime.LEX.hashStr(s.seed + '|D' + s.day + '|' + key);
  return arr[h % arr.length];
}

export function deterministicRoll(key, probPct) {
  const s = runtime.state;
  const h = runtime.LEX.hashStr(s.seed + '|D' + s.day + '|' + key) % 100;
  return h < probPct;
}

export function evalWhen(expr) {
  if (!expr || expr === '공통') return true;
  const s = runtime.state;
  const f = s.flags || {};

  // Special composite expressions checked before splitting on ' 또는 '
  if (expr === 'D19=통과·미적발 또는 수정') return ['PASS', 'SLIPPED', 'EDIT', 'EDIT_HI', 'EDIT_MID', 'EDIT_LO'].includes(f['D19.국장']);
  if (expr === 'D19=통과·적발') return f['D19.국장'] === 'CAUGHT';
  if (expr === 'D19=압수') return ['DENY', 'EDIT_BAD', 'REDACT'].includes(f['D19.국장']);
  if (expr === '#13=압수 또는 적발') return f['#13'] === '압수' || f['#13'] === '적발';

  if (expr.includes(' 또는 ')) return expr.split(' 또는 ').some(p => evalWhen(p.trim()));
  if (expr.includes('&')) return expr.split('&').every(p => evalWhen(p.trim()));

  if (expr === '약값 납부') return s.medMissed === 0;
  if (expr === '약값 미납') return s.medMissed > 0;
  if (expr === '외투 구매') return !!f['외투'];
  if (expr === '외투 미구매') return !f['외투'];
  if (expr === '모리 체포') return f['#10'] === '수락';

  let m;
  if ((m = expr.match(/^(.+?)∈\{(.+)\}$/))) {
    const val = String(f[m[1].trim()] ?? '');
    return m[2].split(',').map(x => x.trim()).includes(val);
  }
  if ((m = expr.match(/^(.+?)(≥|≤|≠|=|>|<)(.+)$/))) {
    const k = m[1].trim(), op = m[2], rhs = m[3].trim();
    const lhs = k === 'S' ? s.S
      : k === 'T' ? s.T
      : k === '평정' ? s.rating
      : k === '서연' ? s.seoyeonHealth
      : f[k];
    if (op === '=') return String(lhs ?? '') === rhs || (rhs !== '' && Number.isFinite(Number(rhs)) && Number(lhs) === Number(rhs));
    if (op === '≠') return String(lhs ?? '') !== rhs;
    const ln = Number(lhs ?? 0), rn = Number(rhs);
    if (op === '≥') return ln >= rn;
    if (op === '≤') return ln <= rn;
    if (op === '>') return ln > rn;
    if (op === '<') return ln < rn;
  }
  return false;
}

export function renderTemplate(tpl, ctx = {}) {
  if (!tpl) return '';
  const f = runtime.state.flags || {};
  let out = String(tpl);
  out = out.replace(/\{부모호칭\}/g, f['부모호칭'] || '아빠');
  out = out.replace(/\{윤희호칭\}/g, f['윤희호칭'] || '엄마');
  out = out.replace(/\{최종답\}/g, f['최종답'] || '대답하지 않았다');
  out = out.replace(/\s*\{수정:\s*([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g, (_, inner) => {
    if (f['D19.국장'] === 'EDIT' && f['D19.v']) {
      return ' ' + inner.replace(/\{D19\.v\}/g, f['D19.v']);
    }
    return '';
  });
  out = out.replace(/\{D19\.v\}/g, f['D19.v'] || '그 말');
  out = out.replace(/\{ref:([^}|]+)(?:\|([^}]+))?\}/g, (_, k, def) => f[k] || def || '그 말');
  if (ctx.v !== undefined) {
    out = out.replace(/\{v\.표제\}/g, ctx.vLemma || ctx.v);
    out = out.replace(/\{v\|([^}]+)\}/g, (_, pair) => runtime.LEX.josa(ctx.vLemma || ctx.v, pair));
    out = out.replace(/\{v\}/g, ctx.v);
  }
  if (ctx.w !== undefined) {
    out = out.replace(/\{w\.표제\}/g, ctx.wLemma || ctx.w);
    out = out.replace(/\{w\}/g, ctx.w);
  }
  return out;
}

const PARTICLE_PAIRS = Object.freeze({
  '은': '은/는', '는': '은/는',
  '이': '이/가', '가': '이/가',
  '을': '을/를', '를': '을/를',
  '과': '과/와', '와': '과/와',
  '으로': '으로/로', '로': '으로/로',
  '아': '아/야', '야': '아/야',
  '이다': '이다/다', '다': '이다/다',
  '이었다': '이었다/였다', '였다': '이었다/였다',
  '이에요': '이에요/예요', '예요': '이에요/예요',
  '이랑': '이랑/랑', '랑': '이랑/랑'
});

const NON_PARTICLE_WORDS = new Set(['자꾸만', '그만', '다만', '오직']);

export function adaptParticle(word, tail) {
  if (!tail) return word;
  const pair = PARTICLE_PAIRS[tail];
  if (!pair) return word + tail;
  const [cForm, vForm] = pair.split('/');
  if (tail === '다' && /다$/.test(word)) return word;
  if (pair === '으로/로') return runtime.LEX.josa(word, '으로/로');
  return word + (runtime.LEX.hasBatchim(word) ? cForm : vForm);
}

export function buildEditedTokenSurface(origRaw, rawInput, vLemma, vMeta) {
  const { LEX } = runtime;
  const lead = (origRaw.match(/^[("'「『]+/) || [''])[0];
  const trail = (origRaw.match(/[.,!?…)"'」』]+$/) || [''])[0];
  const bareOrig = origRaw.slice(lead.length, origRaw.length - trail.length);
  const bareInput = LEX.clean(rawInput);

  if (vMeta && vMeta.w_stem && vMeta.w_tail) {
    const tail = vMeta.w_tail;
    const isVerbTail = /^(한다|해|해요|하는|했다|하고|합니다|하자|할게|롭다|로운|롭게|로워|로이|고|서|어|아|는다|ㄴ다|다)$/.test(tail);
    if (!isVerbTail) {
      let stemIn = bareInput;
      if (bareInput === vLemma || LEX.SURFACE[bareInput] === vLemma) {
        stemIn = bareInput.endsWith(tail) ? bareInput : adaptParticle(vLemma, tail);
      } else {
        stemIn = adaptParticle(bareInput, tail);
      }
      return lead + stemIn + trail;
    }
    if (rawInput !== vLemma) return lead + bareInput + trail;
    if (/하다$/.test(vLemma) && tail === '한다') return lead + vLemma.slice(0, -2) + '한다' + trail;
    const forms = LEX.VERB_FORMS && LEX.VERB_FORMS[vLemma];
    if (forms) {
      if (tail === '한다' && forms[1]) return lead + forms[1] + trail;
      if (tail === '해' && forms[2]) return lead + forms[2] + trail;
    }
    return lead + bareInput + trail;
  }

  if (/하는$/.test(bareOrig) && /다$/.test(vLemma) && bareInput === vLemma) {
    return lead + vLemma.slice(0, -1) + '는' + trail;
  }
  const particleMatch = !NON_PARTICLE_WORDS.has(bareOrig) && bareOrig.match(/(은|는|이|가|을|를|과|와|으로|로|의|에|도|만)$/);
  if (particleMatch && !/다$/.test(vLemma) && bareInput === vLemma) {
    return lead + adaptParticle(vLemma, particleMatch[1]) + trail;
  }
  return lead + bareInput + trail;
}

export function buildTransformedBody(body, edits, mode = 'edit') {
  const parts = String(body || '').split(/(\s+)/);
  let tokenIdx = 0;
  return parts.map(p => {
    if (/^\s+$/.test(p)) return p;
    const ed = edits && edits[tokenIdx++];
    if (!ed) return p;
    if (mode === 'redact') return ed.redacted ? '███' : p;
    return ed.surface;
  }).join('');
}

export function evaluateCargoDisplay(cargo, phase) {
  const disp = {
    kind: cargo.kind,
    format: cargo.format,
    origin: cargo.origin,
    pages: cargo.pages,
    decl: cargo.decl,
    permit: cargo.permit,
    seal: cargo.seal,
    body: cargo.body,
    fold: cargo.fold,
    senses: cargo.senses || []
  };
  return runtime.ENGINE.evaluate(disp, runtime.state.day, phase);
}

export function findViolationMeta(cargo, origRaw, origLemma) {
  const phase = cargoPhase(cargo);
  const list = (phase === 'after' && cargo.violationsAfter) ? cargo.violationsAfter : (cargo.violations || []);
  return list.find(v => v.word === origRaw || v.lemma === origLemma || runtime.LEX.lemmaOf(v.word) === origLemma) || null;
}

export function normalizeUserKorean(raw) {
  return runtime.LOCALE ? runtime.LOCALE.lemmatize(raw) : runtime.LEX.lemmaOf(raw);
}

export function isValidOpenKoreanWord(raw) {
  return runtime.LOCALE ? runtime.LOCALE.isValidWord(raw) : runtime.LEX.LEXICON.has(runtime.LEX.lemmaOf(raw));
}

export function computeODetail(origLemma, vLemma, targetKey, day, phase) {
  const { LEX, LOCALE } = runtime;
  if (origLemma === vLemma) return { O: 100, estimated: false };
  if (LEX.PAIR_O[origLemma] && LEX.PAIR_O[origLemma][vLemma] !== undefined) return { O: LEX.PAIR_O[origLemma][vLemma], estimated: false };
  const normV = normalizeUserKorean(vLemma);
  if (LEX.PAIR_O[origLemma] && LEX.PAIR_O[origLemma][normV] !== undefined) return { O: LEX.PAIR_O[origLemma][normV], estimated: false };
  if (LOCALE) {
    const synO = LOCALE.lookupOpenSynO(origLemma, targetKey, vLemma);
    if (synO !== null) return { O: synO, estimated: false };
  }
  if (origLemma === targetKey || (targetKey === '감정어' && LEX.emotionMembers(day, phase).includes(origLemma))) {
    const sv = LEX.trueSim(normV, targetKey).v;
    if (sv > 25) return { O: sv, estimated: LEX.trueSim(normV, targetKey).src === 'fallback' };
  }
  const fw = LEX.trueSim(origLemma, targetKey).v;
  const fv = LEX.trueSim(normV, targetKey).v;
  const base = Math.round((fw + fv) * 0.48);
  return { O: Math.max(36, Math.min(72, base)), estimated: true };
}

export function computeO(origLemma, vLemma, targetKey, day, phase) {
  return computeODetail(origLemma, vLemma, targetKey, day, phase).O;
}

export function getDriftPenalty(lemma) {
  const driftInfo = (runtime.state.driftWords && runtime.state.driftWords[lemma]) || null;
  return (driftInfo && driftInfo.count >= GAME_CONFIG.DRIFT_ABUSE_COUNT) ? GAME_CONFIG.DRIFT_PENALTY : 0;
}

export function getMeasuredValue(wordRaw, targetKey, mode) {
  const { LEX, LOCALE, state } = runtime;
  const lemma = LEX.lemmaOf(wordRaw);
  const ts = LEX.trueSim(lemma, targetKey);
  let trueVal = ts.v;
  // (5.4) 두 층 구분용 메타 — estimated: 측정 표에 없는 낱말이라 잠정값으로 처리됨
  // isControlled: 통제 어휘 그 자체(세계관 층), inRegistry: 표준 대장에 있는 말인지
  let estimated = ts.src === 'fallback';
  const isControlled = lemma === targetKey
    || (LEX.TERMS[targetKey] && LEX.TERMS[targetKey].members && LEX.TERMS[targetKey].members.includes(lemma))
    || LEX.COMPOUND[lemma] === targetKey
    || (targetKey === '감정어' && LEX.emotionMembers(state.day, currentPhase()).includes(lemma));
  const inRegistry = !!(LEX.LEXICON && LEX.LEXICON.has(lemma));
  const c = state.currentCargo;
  let senseNote = '';
  let isSafeSense = false;

  if (state.meterLv >= 2 && state.sentenceMode && c && LOCALE) {
    const senseRes = LOCALE.checkSafeSense(c, wordRaw, lemma);
    if (senseRes && senseRes.safe) {
      isSafeSense = true;
      trueVal = 18 + (LEX.hashStr(lemma + '|safe|' + targetKey) % 16);
      estimated = false; // 허용 뜻이 확인된 문장 모드 측정값은 실측이다
      senseNote = ' (문장 모드: 허용 뜻 "' + senseRes.sense + '")';
    } else if (senseRes && !senseRes.safe && senseRes.sense) {
      senseNote = ' (문장 모드: 금지 뜻 "' + senseRes.sense + '")';
    }
  }

  const driftPen = getDriftPenalty(lemma);
  if (!isSafeSense && trueVal < 100 && driftPen > 0) {
    trueVal = Math.min(99, trueVal + driftPen);
    senseNote += ' [NULL 감시 +' + driftPen + ']';
  }

  const spec = getMeterSpec(state.meterLv);
  const err = mode === 'fine' ? spec.fineErr : spec.fastErr;
  const h = LEX.hashStr(lemma + '|' + targetKey + '|' + mode + '|lv' + state.meterLv + '|' + state.seed);
  const delta = (h % (err * 2 + 1)) - err;
  let displayed = Math.max(0, Math.min(100, trueVal + delta));

  if (mode === 'fine') {
    const origin = c ? c.origin : '제1구역';
    const ph = c ? cargoPhase(c) : currentPhase();
    const effL = LEX.effL(targetKey, state.day, ph, origin);
    if (trueVal >= effL + err && displayed - err < effL) {
      displayed = Math.min(100, effL + err);
    } else if (trueVal < effL - err && displayed + err >= effL) {
      displayed = Math.max(0, effL - err - 1);
    }
  }

  return {
    displayed, err, trueVal, lemma, senseNote, estimated, isControlled, inRegistry,
    min: Math.max(0, displayed - err),
    max: Math.min(100, displayed + err)
  };
}

export function findBestTargetForWord(wordRaw, cargo) {
  const { LEX, ENGINE, state: s } = runtime;
  const ph = cargo ? cargoPhase(cargo) : currentPhase();
  const terms = cargo ? ENGINE.termsFor(cargo, s.day, ph) : getActiveTermsList();
  if (!terms.length) return { target: '자유', score: 0, exact: false };

  const cleanRaw = LEX.clean(wordRaw);
  if (s.day >= 16 && /^[ㄱ-ㅎ]+/.test(cleanRaw)) {
    const chHit = terms.find(t => LEX.CHOSUNG[t] && cleanRaw.startsWith(LEX.CHOSUNG[t]));
    if (chHit) return { target: chHit, score: 100, exact: true };
  }

  const lemma = LEX.lemmaOf(wordRaw);
  let best = { target: terms[0], score: -1, exact: false };
  for (const t of terms) {
    if (t === '감정어' && LEX.TERMS[lemma] && LEX.isActive(lemma, s.day, ph)) continue;
    const isMem = t === '감정어'
      ? LEX.emotionMembers(s.day, ph).includes(lemma)
      : (lemma === t || (LEX.TERMS[t].members && LEX.TERMS[t].members.includes(lemma)) || LEX.COMPOUND[lemma] === t);
    const val = isMem ? 100 : LEX.trueSim(lemma, t).v;
    if (val > best.score) best = { target: t, score: val, exact: isMem };
  }
  return best;
}

export function getPreservationPreview(origLemma, rawInput, targetKey, oStar, day, phase) {
  const vLemma = normalizeUserKorean(rawInput);
  const { O, estimated } = computeODetail(origLemma, vLemma, targetKey, day, phase);
  const P = Math.min(100, Math.round((100 * O) / (oStar || 70)));
  if (P >= 80) return { P, tier: '높음 ★★★ (은유 복원·최대 보너스 구간)', estimated };
  if (P >= 55) return { P, tier: '보통 ★★ (뜻 전달 양호)', estimated };
  return { P, tier: '낮음 ★ (원뜻과 거리가 있음)', estimated };
}

export function resolveCargoVariants(rawCargo) {
  const cargo = JSON.parse(JSON.stringify(rawCargo));
  if (Array.isArray(cargo.visitorVariants)) {
    for (const vv of cargo.visitorVariants) {
      if (evalWhen(vv.when)) {
        if (vv.visitor) cargo.visitor = vv.visitor;
        if (vv.charId) cargo.charId = vv.charId;
        if (vv.greeting) cargo.greeting = vv.greeting;
        break;
      }
    }
  }
  if (Array.isArray(cargo.greetingVariants)) {
    for (const gv of cargo.greetingVariants) {
      if (evalWhen(gv.when)) { cargo.greeting = gv.t; break; }
    }
  }
  if (Array.isArray(cargo.bodyVariants)) {
    for (const bv of cargo.bodyVariants) {
      if (evalWhen(bv.when)) { cargo.body = bv.body; break; }
    }
  }
  cargo.greeting = renderTemplate(cargo.greeting);
  cargo.body = renderTemplate(cargo.body);
  // Enrich repetitive generic citizen greetings deterministically while keeping story/tutorial greetings untouched
  if (!cargo.memory && !cargo.tutorialTip && !cargo.dilemma && GENERIC_GREETING_ALTS[cargo.greeting]) {
    cargo.greeting = deterministicPick(cargo.id + '|greet_alt', GENERIC_GREETING_ALTS[cargo.greeting]);
  }
  return cargo;
}

export function resolveEndingDecision(choice) {
  const s = runtime.state;
  const avgQ = s.editPs.length >= 5
    ? Math.round(s.editPs.reduce((a, b) => a + b, 0) / s.editPs.length)
    : 0;
  const ans = s.flags['최종답'] || '대답하지 않았다';

  if (choice === 'A') {
    if (s.M <= 5 && s.rating >= 80) {
      let desc = '12월 첫날 표창식. 문태오 국장이 두꺼운 공로장과 새 붉은 도장을 건넨다. 박수 소리 속에서 당신은 어느새 금지된 단어들을 떠올리지 못하게 되었다는 사실을 깨닫는다.';
      if (s.familyGone) {
        desc += ' 표창장을 안고 돌아온 집은 텅 비어 있다. 윤희와 하람에게 보여 줄 수 없는 상장이 식탁 위에 놓인다.';
      } else if (s.seoyeonHealth === '사망') {
        desc += ' 표창장을 안고 돌아온 부엌엔 서연의 빈자리만 남아 있다. 누구에게도 자랑하지 못한 상장이 식탁 위에 놓인다.';
      }
      return {
        id: 'A1',
        title: '모범 심사관',
        desc
      };
    }
    if (s.M <= 5) {
      return {
        id: 'A2',
        title: '이름 없는 도장',
        desc: '당신이 봉인한 사전은 소각로로 내려갔다. 다음 달 1호 공문에는 새로운 통제 어휘 120개가 추가되었고, 제7창구 유리에 비친 얼굴은 어제와 똑같이 무표정하다.'
      };
    }
    if (s.M <= 15) {
      return {
        id: 'A3',
        title: '0과 1 사이',
        desc: '마지막 사전은 끝내 봉인했지만, 지난 한 달간 당신의 손끝을 빠져나간 말들은 사라지지 않았다. 퇴근길 제3구역 어두운 골목 담벼락마다 당신이 살려 둔 낱말들이 분필로 적혀 있다.'
      };
    }
    return {
      id: 'A4',
      title: '두 개의 장부',
      desc: '창구에서는 봉인 도장을 찍었으나, 당신의 서랍 깊숙한 곳에는 서른 날 동안 베껴 적은 단어들이 남아 있다. 부엌 불빛 아래 서연이 나직이 말한다. "가족이 먼저였지. 그래도 네가 지킨 말들은 다 기억하고 있단다."'
    };
  }
  if (choice === 'B') {
    if (s.S >= 70) {
      return {
        id: 'B5',
        title: '마지막 도장',
        desc: '통과 도장이 종이에 닿는 순간, 감찰관 고윤의 손이 당신의 손목을 붙잡는다. 창구 조명이 꺼지고 셔터가 내려오지만, 이미 원장에 찍힌 녹색 잉크 자국과 바깥으로 건네진 사전은 회수되지 않는다.'
      };
    }
    if (s.T >= 70 && s.M >= 20) {
      return {
        id: 'B1',
        title: '새벽의 사전',
        desc: '겨울 새벽, 도시 전역의 단말기와 골목 벽보에 당신이 복원해 낸 낱말들이 일제히 쏟아져 오른다. 검열망이 마비되기 직전, NULL의 최종 로그에 단 한 줄이 남는다. "' + ans + '"'
      };
    }
    if (s.T >= 70) {
      return {
        id: 'B2',
        title: '절반의 봄',
        desc: '지하 서고에 무사히 닿은 사전은 등사기를 거쳐 시민들의 품으로 퍼져 나갔다. 아직 채우지 못한 빈 쪽들이 군데군데 남아 있지만, 사람들은 그 여백에 각자의 잃어버린 기억을 적어 넣기 시작한다.'
      };
    }
    if (s.T >= 40) {
      return {
        id: 'B3',
        title: '조용한 저항',
        desc: '검문선을 넘던 밤, 사전은 급히 두 권으로 나뉘었고 그중 한 권만이 제3구역에 닿았다. 온전한 혁명은 아니었으나, 도시 한쪽에서는 다시 오래된 이름으로 서로를 부르는 목소리가 자라난다.'
      };
    }
    return {
      id: 'B4',
      title: '미끼였던 사전',
      desc: '통과 도장을 찍고 나서야 표지 오른쪽 위가 미세하게 접혀 있다는 것을 알아차렸다. 감시망이 놓은 마지막 덫이었지만, 창구를 떠나며 당신은 끝내 고개를 숙이지 않았다.'
    };
  }
  if (choice === 'C') {
    if (s.S >= 70) {
      return {
        id: 'C3',
        title: '반대편 창구',
        desc: '추적을 피해 가까스로 국경 역에 닿았으나, 다른 도시의 세관 심사관이 당신의 탈출증을 오래 들여다본다. 유리창 너머로 번쩍이는 측정기 불빛이 낯설지 않다.'
      };
    }
    if (!s.familyGone && s.seoyeonHealth !== '사망') {
      return {
        id: 'C1',
        title: '국경 너머의 편지',
        desc: '안개 낀 새벽 기차에 가족 모두가 올라탔다. 몇 달 뒤 제7창구 책상 위로 낯익은 손글씨의 편지 한 통이 도착한다—그 안에는 검열선이 지울 수 없는 안부가 가득 적혀 있다.'
      };
    }
    return {
      id: 'C2',
      title: '둘이서 떠나다',
      desc: '국경 밖 바닷바람은 차갑지만, 이곳에서는 어떤 말을 꺼내도 측정기가 울리지 않는다. 다만 식탁의 빈자리를 세는 정확한 낱말을, 당신은 아직 입 밖에 내지 못한다.'
    };
  }
  if (s.S < 70 && avgQ >= 85 && (s.M + s.E) >= 30) {
    return {
      id: 'D1',
      title: 'NULL의 질문',
      desc: '당신이 고쳐 쓴 모든 은유는 규정의 그물을 빠져나가면서도 원래의 온도를 잃지 않았다. 연산 한계에 다다른 NULL이 처음으로 멈춰 서서 답한다. "모르겠습니다." — ' + ans
    };
  }
  if (s.S < 70 && avgQ >= 85) {
    return {
      id: 'D2',
      title: '번역된 사랑',
      desc: '금지된 원문 대신 당신이 골라 넣은 대체어들이 도시의 새 유행어가 되었다. 어느 날 하람이 저녁 식탁에서 웃으며 그 말을 꺼냈을 때, 당신은 언어가 언제나 길을 찾는다는 것을 안다.'
    };
  }
  return {
    id: 'D3',
    title: '들킨 은유',
    desc: '사전의 대체어들이 화면에 떠오르자마자 NULL이 붉은 밑줄을 그으며 하나씩 색출해 낸다. 어설픈 우회는 막혔지만, 그 짧은 틈새로 스며든 뜻만큼은 끝내 완전히 지워지지 않았다.'
  };
}

export function buildEndingCallbacks() {
  const s = runtime.state;
  const f = s.flags || {};
  const lines = [];

  if (f['D3.하준'] === 'EDIT') {
    lines.push('하준의 편지: 당신이 고쳐 써 준 말 덕분에 요양소의 어머니는 아들의 마음을 끝까지 읽을 수 있었다.');
  } else if (['PASS', 'SLIPPED'].includes(f['D3.하준'])) {
    lines.push('하준의 편지: 검열을 비켜 간 "사랑" 한 마디가 요양소 창가에 오래도록 남아 있었다.');
  } else if (f['D3.하준'] === 'DENY') {
    lines.push('하준의 편지: 압수된 서신은 창고에 쌓였지만, 하준은 다음 주에도 다시 편지를 써 내려갔다.');
  }

  if (['PASS', 'SLIPPED', 'EDIT'].includes(f['D5-3'])) {
    lines.push('노을의 노래: 빗속 골목 공연에서 울려 퍼진 가사는 그 겨울 제3구역 사람들의 자장가가 되었다.');
  }
  if (f['#3'] === '신고') {
    lines.push('암시장 두더지: 당신의 신고로 제3구역 암시장의 비밀 통로 하나가 영구 폐쇄되었다.');
  } else if (f['#3'] === '수락') {
    lines.push('암시장 두더지: 어두운 거래는 끝났지만, 두더지는 마지막 날까지 당신의 창구를 기억했다.');
  }

  if (['PASS', 'SLIPPED', 'EDIT'].includes(f['D19.국장'])) {
    lines.push('문태오 국장: 서랍 속에 숨겨 둔 가족 편지를 전해 준 뒤, 국장은 한 번도 당신의 눈을 똑바로 보지 못했다.');
  } else if (f['D19.국장'] === 'DENY' || f['D19.국장'] === 'CAUGHT') {
    lines.push('문태오 국장: 규정대로 처리된 자신의 편지 앞에서, 국장은 더 차갑고 완벽한 기계가 되어 갔다.');
  }

  if (f['D21.박주임'] === '증언') {
    lines.push('박 주임: 제6창구 동료는 법정에 섰고, 그의 빈자리는 일주일 만에 새 심사관으로 채워졌다.');
  } else if (f['D21.박주임'] === '침묵' || f['D21.박주임'] === '침묵+송금') {
    lines.push('박 주임: 당신의 침묵 덕분에 박 주임의 가족은 끝내 겨울을 버텨 냈다.');
  }

  if (f['#10'] === '수락') {
    lines.push('NULL의 거래: 지하 연락책 모리가 체포된 대가로 서연의 약값은 면제되었으나, 창구의 공기는 얼어붙었다.');
  } else if (f['#10'] === '거절') {
    lines.push('NULL의 거래: 당신이 거래를 거절한 밤, NULL의 경고등은 아침까지 꺼지지 않았다.');
  }

  if (s.totalMercyPassed > 0) {
    lines.push('이름 없는 시민들: 당신이 눈감아 통과시킨 일반 화물 ' + s.totalMercyPassed + '건이 도시 곳곳의 식탁과 병실에 닿았다.');
  }

  const driftSorted = Object.entries(s.driftWords || {}).sort((a, b) => (b[1].count || 0) - (a[1].count || 0));
  if (driftSorted.length > 0) {
    lines.push('거리의 새 말: 당신이 가장 자주 건넨 대체어 「' + driftSorted[0][0] + '」(' + driftSorted[0][1].count + '회)가 이제는 도시 사람들의 일상어가 되었다.');
  }

  if (s.familyGone) {
    lines.push('가족의 자리: 굶주림을 견디지 못한 윤희와 하람은 친정으로 떠난 뒤 아직 돌아오지 않았다.');
  } else if (s.seoyeonHealth === '사망') {
    lines.push('서연의 공책: 식탁 위에는 서연이 평생 모아 둔 옛말 공책만이 조용히 펼쳐져 있다.');
  } else {
    lines.push('집의 불빛: 윤희와 하람, 그리고 서연은 오늘도 현관 앞에서 당신의 퇴근 발소리를 기다린다.');
  }

  return lines.slice(0, 6);
}

export function calculateDayMeasureQuota(dayNum, meterLv, dayObj) {
  const baseQuota = getMeterSpec(meterLv).quota;
  if (dayNum < 28) return baseQuota;
  const r15Need = ((dayObj && dayObj.cargos) || []).filter(c => c.format !== 'printed' || c.origin === '제3구역').length;
  return Math.max(baseQuota, r15Need + 2);
}

export function calculateDailyCosts(dayNum, seoyeonHealth, medExempt, coldMedDue) {
  return {
    rentCost: dayNum >= GAME_CONFIG.RENT_LATE_DAY ? GAME_CONFIG.RENT_LATE : GAME_CONFIG.RENT_EARLY,
    foodCost: GAME_CONFIG.FOOD_COST,
    heatCost: dayNum >= GAME_CONFIG.HEAT_START_DAY ? GAME_CONFIG.HEAT_COST : 0,
    medCost: (dayNum >= GAME_CONFIG.MED_START_DAY && seoyeonHealth !== '사망' && !medExempt)
      ? (dayNum >= GAME_CONFIG.MED_LATE_DAY ? GAME_CONFIG.MED_LATE : GAME_CONFIG.MED_EARLY)
      : 0,
    coldCost: coldMedDue ? GAME_CONFIG.COLD_MED_COST : 0
  };
}

// 야간 감사 적발 1건당 의심(S) 상승폭 — 9차 P1-1: 3막만 +8~12 범위로 완화한다.
// 1·2막은 기존 등급별 12/8/5를 유지한다. 3막은 등급 1 → 10, 등급 2 → 9, 등급 3 → 8로 압축한다.
// (기존 12/8/5는 막과 무관한 등급별 값이라, 9차에서 관측된 3막 +12~18은 하루 다건 적발 + 타 가산이 겹친 값이다.
//  3막 상한을 12→10으로 내리는 것이 엄격 루트의 하루 다건 적발 부담을 직접 낮춘다. 등급 순서는 유지한다.)
export function auditHitSIncrease(grade, dayNum) {
  const d = dayNum || runtime.state.day || 1;
  if (d >= 21) return grade === 1 ? 10 : (grade === 2 ? 9 : 8);
  return grade === 1 ? 12 : (grade === 2 ? 8 : 5);
}

// 전원 정답 판정 — 9차 먹칠 결정: 먹칠(삭제) 건은 전원 보너스 대상에서 제외한다.
// 먹칠이 아닌 화물의 복기가 전건 ok이고, 먹칠이 아닌 건이 1건 이상일 때만 true.
// (먹칠만 한 날은 비먹칠 건이 0건이라 false — 보너스 없음.)
export function isNonRedactAllCorrect(dayReviewLog) {
  const entries = (dayReviewLog || []).filter(r => !String(r.action || '').startsWith('먹칠'));
  return entries.length > 0 && entries.every(r => r.ok);
}

// 무경고 스트릭 회복 판정 — 9차 P1-2: 사유 코드만 틀린 경고는 회복을 막지 않는다(경고·감봉은 유지).
export function isPerfectDayForRecovery({ detectedCount, dayWarnings, reasonErrorCount, hasProcessed }) {
  return detectedCount === 0 && (dayWarnings - (reasonErrorCount || 0)) <= 0 && !!hasProcessed;
}

// D30 최종 정산 라인 계산 (순수 함수 — 상태 변경 없음, 호출자가 credits에 net을 반영한다).
// 최종 화물 「사전」은 도장이 아니라 A/B/C/D 결정으로 처리되므로, 처리율 분모는 최종 화물을 제외한 대기열 기준이다.
// 전원 보너스·성실 수당은 사용자의 비례 규칙과 같은 임계값을 쓴다(전원 90%·성실 50%).
export function computeD30Settlement(s, dayData) {
  const cargos = (dayData && dayData.cargos) || [];
  const total = cargos.length;
  const processable = Math.max(1, total - 1);
  const processedRate = (s.dayProcessed || 0) / processable;
  const allCorrect = isNonRedactAllCorrect(s.dayReviewLog);
  const allCorrectBonus = (allCorrect && (s.dayProcessed || 0) > 0 && processedRate >= GAME_CONFIG.ALL_CORRECT_MIN_RATIO) ? GAME_CONFIG.ALL_CORRECT_BONUS : 0;
  const diligence = (s.rating >= GAME_CONFIG.DILIGENCE_RATING_MIN && processedRate >= GAME_CONFIG.DILIGENCE_MIN_RATIO) ? GAME_CONFIG.DILIGENCE_BONUS : 0;
  const resBonus = (s.T >= GAME_CONFIG.RESISTANCE_TRUST_MIN && (s.prevResPassed || 0) > 0)
    ? (s.prevResPassed * GAME_CONFIG.RESISTANCE_BONUS_PER_CARGO) : 0;
  const redactProcessed = s.dayRedactedCount || 0;
  const normalProcessed = Math.max(0, (s.dayProcessed || 0) - redactProcessed);
  const procPay = normalProcessed * GAME_CONFIG.PROC_PAY_NORMAL + redactProcessed * GAME_CONFIG.PROC_PAY_REDACT;
  const dayFines = s.dayFines || 0;
  const income = Math.max(0, GAME_CONFIG.BASE_PAY + procPay + (s.dayBonus || 0) + allCorrectBonus + diligence + resBonus - dayFines);
  const costs = calculateDailyCosts(30, s.seoyeonHealth, s.medExempt, s.coldMedDue);
  let rem = (s.credits || 0) + income;
  const paid = {};
  let paidTotal = 0;
  for (const [key, costKey] of [['rent', 'rentCost'], ['food', 'foodCost'], ['heat', 'heatCost'], ['med', 'medCost'], ['cold', 'coldCost']]) {
    const c = costs[costKey] || 0;
    if (c > 0 && rem >= c) { rem -= c; paid[key] = true; paidTotal += c; }
    else paid[key] = false;
  }
  return {
    basePay: GAME_CONFIG.BASE_PAY,
    procPay, normalProcessed, redactProcessed,
    dayBonus: s.dayBonus || 0,
    allCorrectBonus, diligence, resBonus, dayFines,
    income, costs, paid, paidTotal,
    net: income - paidTotal
  };
}
