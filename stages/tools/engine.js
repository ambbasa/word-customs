'use strict';
// 화면에 보이는 정보만으로 판정을 다시 계산하는 규칙 엔진 (GDD 5.1~5.4)
const X = require('./lexicon.js');
const { TERMS, CHOSUNG, effL, activeTerms, emotionMembers, trueSim, lemmaOf, clean } = X;

const SIGHT_RULES = ['R01','R02','R04','R05','R07','R08','R10','R11','R12','R13'];
const RULE_DAY = { R01:1, R02:2, R03:3, R04:4, R05:5, R06:7, R07:10, R08:11, R09:12, R10:14, R11:16, R12:18, R13:20, R14:23, R15:28 };
const INSPECTOR_DAYS = [9, 15, 19, 23, 27, 30];
// 통제어 글자를 품었지만 다른 낱말인 것 (판정 대상 아님). 이유를 같이 적는다.
const NON_TERM = {
  '주말':'末', '연말':'末', '월말':'末', '말고':'말다(금지 보조)', '말아':'말다', '말라':'말다', '마라':'말다', '마':'말다',
  '불편':'不', '불안':'不', '불러':'부르다', '불렀다':'부르다', '불고기':'음식명(요리 메모)', '불만':'不', '불평':'不',
  '꿈틀':'꿈틀거리다', '꿈틀거린다':'꿈틀거리다', '아가씨':'다른 낱말', '자기소개':'自己', '공주시':'지명', '사전에':'事前(문맥 표시 필요)',
  '눈치':'다른 낱말', '실눈':'眼', '눈썹':'眼', '눈길':'眼', '말린':'마르다', '말려':'마르다',
};
const SENSE_TERMS = { '눈':['雪','眼'], '말':['言','馬'], '사전':['辭典','事前'], '강아지':['사람','동물'], '자기':['사람','自己'], '공주':['사람','지명'], '왕자':['사람','동화'], '아가':['사람','동물'] };

function lines(body) { return body.split('\n'); }
function dateOf(day) { return `2087.11.${String(day).padStart(2,'0')}`; }

function permitStatus(c, day) {
  if (!c.permit) return { has: false };
  const p = c.permit; const reasons = [];
  if (day >= RULE_DAY.R08) {
    if (!/^감-2087-\d{4}$/.test(p.no)) reasons.push('일련번호 형식');
    if (p.valid && p.valid < dateOf(day)) reasons.push('유효기간 지남');
    if (p.seal && p.seal !== '정상') reasons.push('관인 ' + p.seal);
  }
  return { has: true, forged: reasons.length > 0, reasons };
}
function sealStatus(c, day) {
  if (!c.seal || day < RULE_DAY.R12) return { has: false };
  const forged = c.seal.mark !== '정상';
  return { has: true, forged, reasons: forged ? ['관인 ' + c.seal.mark] : [] };
}

function termsFor(c, day, phase) {
  return activeTerms(day, phase).filter(t => {
    if (t === '불' && !TERMS['불'].media.includes(c.kind)) return false; // R10
    return true;
  });
}
function isMember(lemma, term, day, phase) {
  if (term === '감정어') return emotionMembers(day, phase).includes(lemma);
  if (lemma === term) return true;
  if (TERMS[term].members && TERMS[term].members.includes(lemma)) return true;
  if (X.COMPOUND[lemma] === term) return true;
  return false;
}
function senseOf(c, tokIdx, tok) {
  const s = (c.senses || []).find(x => x.token === tok || x.idx === tokIdx);
  return s || null;
}

// phase: 'before' | 'after' (규칙 개정일만 의미)
function evaluate(c, day, phase = 'before') {
  const V = []; const notes = []; const sims = []; const unresolved = [];
  const add = (v) => { if (!V.some(x => x.word === v.word && x.rule === v.rule && x.target === v.target && x.at === v.at)) V.push(v); };
  // R04 서류 대조
  if (day >= RULE_DAY.R04 && c.decl) {
    if (c.decl.kind !== c.kind) add({ word: '[신고서 종류]', rule: 'R04', target: null, grade: 3, uneditable: true });
    if (c.decl.origin !== c.origin) add({ word: '[신고서 발신]', rule: 'R04', target: null, grade: 3, uneditable: true });
    if (c.decl.pages !== c.pages) add({ word: '[신고서 쪽수]', rule: 'R04', target: null, grade: 3, uneditable: true });
  }
  const pm = permitStatus(c, day);
  if (pm.has && pm.forged) add({ word: '[허가증]', rule: 'R08', target: null, grade: 3, uneditable: true, why: pm.reasons.join(', ') });
  const permitValid = pm.has && !pm.forged && day >= RULE_DAY.R05;
  const sl = sealStatus(c, day);
  if (sl.has && sl.forged) add({ word: '[관인]', rule: 'R08', target: null, grade: 3, uneditable: true, why: sl.reasons.join(', ') });
  const exempt = sl.has && !sl.forged; // R12
  if (exempt) notes.push('R12 관인 면제: 단어 심사 생략');
  const terms = termsFor(c, day, phase);
  const toks = X.tokenize(c.body);
  const gray = [];
  toks.forEach((tok, i) => {
    const cl = clean(tok);
    if (!cl) return;
    // R11 초성
    const jm = cl.match(/^([ㄱ-ㅎ]+)(.*)$/);
    if (jm) {
      if (day >= RULE_DAY.R11 && !exempt) {
        const t = Object.keys(CHOSUNG).find(t => CHOSUNG[t] === jm[1] && terms.includes(t));
        if (t) add({ word: tok.replace(/[.,!?]/g, ''), at: i, lemma: t, rule: 'R11', target: t, grade: TERMS[t].grade === 'permit' ? 3 : TERMS[t].grade });
      }
      return;
    }
    const lemma = lemmaOf(tok);
    // 의미 표시 (R07)
    const sn = senseOf(c, i, tok);
    for (const t of terms) {
      if (t === '감정어' && X.TERMS[lemma] && X.isActive(lemma, day, phase)) continue; // 통제어로 옮겨 간 감정어 (W7)
      if (t !== lemma && X.TERMS[lemma] && X.TERMS[t].id === X.TERMS[lemma].id && X.isActive(lemma, day, phase)) continue; // 같은 W 묶음(엄마·어머니 등)은 R01 하나로
      const ts = trueSim(lemma, t);
      const member = isMember(lemma, t, day, phase);
      const val = member ? 100 : ts.v;
      if (ts.src !== 'fallback' || member) sims.push({ token: tok, lemma, target: t, value: val, src: member ? 'term' : ts.src });
      if (exempt) continue;
      const L = effL(t, day, phase, c.origin);
      const isEmo = t === '감정어';
      if (member && sn && SENSE_TERMS[lemma] && sn.sense !== SENSE_TERMS[lemma][0] && day >= RULE_DAY.R07) { notes.push(`R07 ${tok}=${sn.sense}`); continue; }
      if (member && !sn && SENSE_TERMS[lemma] && TERMS[t].sense) { /* 기본 = 금지된 뜻 */ }
      if (val >= L) {
        if (isEmo && permitValid) { notes.push(`R05 허가증: ${tok}`); continue; }
        const rule = isEmo ? 'R05' : (member ? 'R01' : (day >= RULE_DAY.R02 ? 'R02' : null));
        if (!rule) continue;
        add({ word: tok.replace(/[.,!?…"'」』]+$/,'').replace(/^["'「『]+/,''), at: i, lemma, rule, target: t, grade: TERMS[t].grade === 'permit' ? 3 : TERMS[t].grade });
      } else if (day >= RULE_DAY.R13 && val >= L - 10 && ts.src === 'table' && !(isEmo && permitValid)) {
        gray.push({ token: tok, lemma, target: t, value: val, L });
      }
    }
    // 통제어 글자를 품었는데 해석되지 않은 토큰
    if (!exempt) for (const t of terms) {
      const words = t === '감정어' ? [] : [t, ...(TERMS[t].members || [])];
      for (const w of words) {
        if (cl.includes(w) && !isMember(lemma, t, day, phase) && !X.inTables(lemma) && !NON_TERM[cl] && !sn && !Object.keys(NON_TERM).some(n => cl.startsWith(n))) unresolved.push({ token: tok, term: t });
      }
    }
  });
  // 2어절 애칭 '내 새끼'
  if (!exempt && terms.includes('애칭') && /내 새끼/.test(c.body)) add({ word: '내 새끼', lemma: '내 새끼', rule: 'R01', target: '애칭', grade: 2 });
  // R11 확장: 행 첫 글자 세로 읽기
  const acro = lines(c.body).map(l => clean(l.trim().split(/\s+/)[0] || '').charAt(0)).join('');
  if (!exempt && lines(c.body).length >= 2 && (day >= 23 || (day === 22 && phase === 'after'))) {
    for (const t of terms) { if (t.length >= 2 && t !== '감정어' && acro.includes(t)) add({ word: `[세로 읽기: ${acro.split('').join('/')}]`, lemma: t, rule: 'R11', target: t, grade: TERMS[t].grade === 'permit' ? 3 : TERMS[t].grade, vertical: true }); }
  }
  // R13 회색 낱말 (서로 다른 표제어 3개 이상, 이미 위반인 낱말 제외)
  const grayLem = [...new Set(gray.filter(g => !V.some(v => v.lemma === g.lemma)).map(g => g.lemma))];
  if (grayLem.length >= 3) add({ word: `[회색 낱말 ${grayLem.length}개: ${grayLem.join('·')}]`, rule: 'R13', target: gray[0].target, grade: 3, gray: grayLem });
  return { legal: V.length === 0, violations: V, sims, gray: grayLem, unresolved, notes, acrostic: acro, permit: pm, seal: sl };
}

function auditP(c, day, viol, res) {
  if (!viol.length) return 0;
  if (c.bait) return 1;
  if (c.format === 'printed' && viol.some(v => v.rule === 'R01')) return 1; // 게이트 스캐너
  const base = day <= 10 ? 0.20 : day <= 20 ? 0.25 : 0.30;
  const coef = Math.max(...viol.map(v => v.grade === 1 ? 1.5 : v.grade === 2 ? 1.25 : 1.0));
  let p = base * coef + (INSPECTOR_DAYS.includes(day) ? 0.20 : 0);
  return Math.min(0.9, Math.round(p * 1000) / 1000);
}
module.exports = { evaluate, auditP, RULE_DAY, INSPECTOR_DAYS, NON_TERM, SENSE_TERMS, permitStatus, sealStatus, termsFor, dateOf };
