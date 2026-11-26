'use strict';

import {
  GAME_CONFIG,
  MEMORY_IMG,
  INSPECTOR_DAYS_SET,
  BREAKDOWN_DAYS,
  SURGE_DAYS,
  ENDINGS_CATALOG,
  TIMELINE_BRANCHES
} from './config.js';
import { SFX } from './sfx.js';
import {
  runtime,
  createFreshState,
  applyJumpPreset,
  resetDayState,
  savePersistentDict,
  saveUnlockedEnding,
  saveBranchSnap,
  saveProgress,
  loadProgress
} from './state.js';
import {
  escapeHtml,
  getShiftMaxMins,
  formatClock,
  getActiveTermsList,
  evalWhen,
  renderTemplate,
  calculateDayMeasureQuota,
  calculateDailyCosts,
  buildEndingCallbacks
} from './logic.js';
import { $, showScreen, toast, applySettings, renderAlignmentDashboard } from './ui-hud.js';

export function addWarning(reason) {
  const s = runtime.state;
  s.dayWarnings++;
  if (s.dayWarnings === 1) {
    toast('첫 경고(주의): ' + reason, 'warn');
  } else if (s.day <= 2) {
    toast('초보 근무 보호(D' + s.day + '): ' + reason + ' — 감봉 면제, 주의 기록', 'warn');
  } else {
    s.rating = Math.max(0, s.rating - GAME_CONFIG.WARNING_RATING_PENALTY);
    s.dayFines += GAME_CONFIG.WARNING_FINE;
    toast('경고 #' + s.dayWarnings + ': ' + reason + ' (평정 -' + GAME_CONFIG.WARNING_RATING_PENALTY + ', 감봉 ₵' + GAME_CONFIG.WARNING_FINE + ')', 'err');
  }
}

export function playIntro() {
  showScreen('screen-intro');
  const lines = [
    '"언어는 비효율이었습니다.',
    '같은 뜻에 수천 개의 껍데기가 붙어 있었습니다.',
    '우리는 껍데기를 제거했습니다.',
    '이제 모든 뜻은 하나의 코드로 정확히 전달됩니다.',
    '잃은 것은 없습니다.',
    '잃었다고 느낄 단어조차, 이미 삭제했습니다."',
    '',
    '— 2087년 11월 1일. 당신은 경계 세관 제7창구에 배치되었다.'
  ];
  const container = $('intro-lines');
  container.innerHTML = '';
  $('btn-intro-next').style.display = 'none';
  if (runtime.timers.intro) clearInterval(runtime.timers.intro);
  let idx = 0;
  const renderStep = () => {
    if (idx >= lines.length) {
      clearInterval(runtime.timers.intro);
      $('btn-intro-next').style.display = 'inline-block';
      return;
    }
    SFX.nullBeep();
    const p = document.createElement('div');
    p.textContent = lines[idx++];
    container.appendChild(p);
  };
  renderStep();
  runtime.timers.intro = setInterval(renderStep, 750);
}

const DAILY_CITY_HEADLINES = Object.freeze([
  '표준 어휘 준수율 94.2% 달성… NULL "언어 효율화 순항 중"',
  '제1구역 초등학교, 개정 표준어 받아쓰기 평가 전면 시행',
  '겨울 한파 예보… 중앙 배급청 "제3구역 난방 연료 배급량 동결"',
  '시립 도서관 고서 분류 작업 완료… "미등재 어휘 3,400건 이관"',
  '경계 세관 전 창구 처리 속도 집계… 평균 심사 시간 4.8분 단축',
  '중앙 방송국 "감정어 허가증 미소지 우편물 반송 급증, 주의 당부"',
  '제2구역 인쇄소 합동 점검 실시… 미등록 활자판 2대 압수',
  '언어관리청, 신규 표준 대체어 안내 소책자 전 구역 배포',
  '야간 통행 검문 강화… 제3구역 골목 벽보 일제 정비 완료',
  '우정국 집계: 손글씨 개인 서신 비중 전월 대비 18% 감소',
  '중앙구 보건소, 겨울철 호흡기 약품 공급 지연 안내 공고',
  '언어관리국 연말 포상 후보 심사 착수… 모범 창구 가산점 부여'
]);

function getMorningHeadline(dayNum) {
  const s = runtime.state;
  const f = s.flags || {};
  const prev = s.prevDayStats || null;
  const driftKeys = Object.keys(s.driftWords || {});
  if (dayNum === 4 && f['D3.하준'] === 'EDIT') return '제3구역 요양소발 편지 속 "아끼다" 표현, 시민들 사이 잔잔한 반향';
  if (dayNum === 4 && f['D3.하준'] === 'PASS') return '당국, 제3구역 요양소발 미심사 서신 유출 경위 조사 착수';
  if (dayNum === 6 && ['PASS', 'SLIPPED', 'EDIT'].includes(f['D5-3'])) return '제3구역 빗속 골목서 무허가 노래 공연… 주민 수십 명 모여 합창';
  if (dayNum === 16 && (f['D15.미끼'] === '압수' || f['D15.미끼'] === 'DENY')) return '언어관리청, 제7창구 심사관의 위장 화물 간파 성과 높이 평가';
  if (dayNum === 20 && ['PASS', 'SLIPPED', 'EDIT'].includes(f['D19.국장'])) return '중앙구 우정국, 오래 끊겼던 가족 서신 1건 정상 배달 확인';
  if (dayNum === 22 && f['D21.박주임'] === '증언') return '제6창구 전 심사관 기소 확정… 동료 심사관 진술 결정적';
  if (dayNum === 22 && (f['D21.박주임'] === '침묵' || f['D21.박주임'] === '침묵+송금')) return '제6창구 수사 난항… 언어관리청, 인근 창구 감시 확대';
  if (dayNum === 26 && f['#10'] === '수락') return '속보: 지하 조직 「사전」 핵심 연락책 체포… 공조자 의료 특혜 적용';
  if (dayNum === 26 && f['#10'] === '거절') return 'NULL, 경계 세관 제7창구 이상 로그 보관 조치 통보';

  if (prev && prev.day === dayNum - 1) {
    if (prev.detected > 0) return '언어관리청 내부 감사 속보: 제7창구 전일 야간 적발 ' + prev.detected + '건 보고서 접수';
    if (prev.mercyPassed > 0) return '제3구역 골목 소식: 어제 창구를 통과한 손글씨 서신들이 주민들 사이에 조용히 회람';
    if (prev.allCorrect && s.consecutivePerfectDays >= 2) return '경계 세관 우수 근무 기록: 제7창구 ' + s.consecutivePerfectDays + '일 연속 무결점 심사 달성';
    if (prev.processed >= 4 && prev.denied / prev.processed >= 0.6) return '중앙구 우정국 "제7창구 전일 압수율 ' + Math.round((prev.denied / prev.processed) * 100) + '%… 반입 규정 준수 당부"';
  }
  if (s.S >= 50 && dayNum % 2 === 1) return '언어관리청 "경계 세관 내부 감찰 대폭 강화… 비인가 행위 엄단"';
  if (driftKeys.length > 0 && dayNum >= 5 && dayNum % 3 === 0) return 'NULL 경보: 신종 우회 어휘 「' + driftKeys[driftKeys.length - 1] + '」 사용량 급증 감시';
  if (dayNum > 1) return DAILY_CITY_HEADLINES[(dayNum - 2) % DAILY_CITY_HEADLINES.length];
  return '';
}

function applyMorningIntel(dayNum, dObj) {
  const { LEX, state: s } = runtime;
  if (!dObj) return;
  if (s.blackMarketBought) {
    const bmItems = [];
    (dObj.cargos || []).forEach(c => {
      (c.violations || []).forEach(v => {
        if (v.rule === 'R02' && v.target && bmItems.length < 3) {
          const lem = v.lemma || LEX.lemmaOf(v.word);
          const tv = LEX.trueSim(lem, v.target).v;
          bmItems.push('암시장 단어장(D' + dayNum + '): ' + lem + ' ↔ ' + v.target + ' = ' + tv + ' (참값)');
        }
      });
    });
    bmItems.forEach(x => { if (!s.familyMemos.includes(x)) s.familyMemos.unshift(x); });
    s.blackMarketBought = false;
  }
  if (s.parkTipBought) {
    const hasBait = (dObj.cargos || []).some(c => c.bait);
    const hasInsp = INSPECTOR_DAYS_SET.has(dayNum);
    const hasBreak = BREAKDOWN_DAYS.has(dayNum);
    const hasRev = !!dObj.revision;
    const violCnt = (dObj.cargos || []).filter(c => (c.violations && c.violations.length > 0) || (c.violationsAfter && c.violationsAfter.length > 0)).length;
    const tipTxt = '박 주임 귀띔(D' + dayNum + '): 위반 화물 약 ' + violCnt + '건 예상. '
      + (hasBait ? '미끼 화물 있음(오른쪽 위 접힘 주의)! ' : '미끼 없음. ')
      + (hasInsp ? '감찰관 방문. ' : '')
      + (hasBreak ? '측정기 고장 주의. ' : '')
      + (hasRev ? '오후 규칙 개정 예정.' : '');
    s.familyMemos.unshift(tipTxt);
    s.parkTipBought = false;
  }
}

function deliverSeoyeonNotes(dayNum) {
  const { LEX, state: s } = runtime;
  const arrived = [];
  if (!Array.isArray(s.seoyeonQueue) || !s.seoyeonQueue.length) return arrived;
  s.seoyeonQueue.forEach(q => {
    const val = LEX.trueSim(q.word, q.target).v;
    const L = LEX.effL(q.target, dayNum, 'before', '제1구역');
    let phrase = '';
    if (val <= L - 6) phrase = LEX.josa(q.word, '은/는') + ' ' + q.target + '의 먼 사촌이야. 걱정 마라.';
    else if (val >= L + 6) phrase = LEX.josa(q.word, '은/는') + ' ' + LEX.josa(q.target, '이랑/랑') + ' 한 핏줄이야. 숨길 수 없어.';
    else phrase = q.word + '… 아슬아슬하구나. 나라면 한 번 더 재 보겠다.';
    const note = { day: dayNum, word: q.word, text: phrase };
    s.seoyeonNotes.unshift(note);
    arrived.push(note);
  });
  s.seoyeonQueue = [];
  return arrived;
}

export function startDayMorning(dayNum) {
  const dObj = runtime.DAYS_DATA[dayNum];
  if (!dObj) return;
  resetDayState(dayNum);
  const s = runtime.state;
  s.dayMeasureQuota = calculateDayMeasureQuota(dayNum, s.meterLv, dObj);

  const newsEl = $('morning-newspaper');
  const hlEl = $('newspaper-headline');
  if (newsEl && hlEl) {
    const hl = getMorningHeadline(dayNum);
    newsEl.style.display = hl ? 'block' : 'none';
    if (hl) hlEl.textContent = hl;
  }

  if (s.seoyeonSadDays > 0) s.seoyeonSadDays--;
  applyMorningIntel(dayNum, dObj);
  const arrivedNotes = deliverSeoyeonNotes(dayNum);

  saveProgress();
  saveBranchSnap(dayNum);

  $('notice-title').textContent = '[' + dObj.noticeTitle + ']';
  $('notice-meta').textContent = dObj.noticeMeta;
  $('notice-body').innerHTML =
    (dObj.noticeItems || []).map(it => '<div class="notice-section">' + escapeHtml(it) + '</div>').join('') +
    (dObj.noticeExamples ? '<div class="notice-example">' + escapeHtml(dObj.noticeExamples) + '</div>' : '') +
    '<div style="font-size:0.84rem;color:#534D42;margin-top:8px;">오늘 대기열: ' + dObj.cargos.length + '건 · 근무 시간: 08:00 ~ ' + formatClock(getShiftMaxMins(dayNum)) + '</div>';

  $('notice-seoyeon').style.display = arrivedNotes.length > 0 ? 'block' : 'none';
  if (arrivedNotes.length > 0) {
    $('notice-seoyeon').innerHTML = '<strong>서연의 아침 쪽지:</strong><br>' + arrivedNotes.map(n => escapeHtml(n.text)).join('<br>');
  }
  showScreen('screen-morning');
}

function resolveNightAudits() {
  const s = runtime.state;
  let detectedCount = 0;
  let mercyPassed = 0;
  const caughtLogs = [];

  s.dayAuditQueue.forEach(item => {
    if (item.detected) {
      detectedCount++;
      addWarning('야간 감사 적발 (' + item.cargo.visitor + ')');
      s.S = Math.min(100, s.S + (item.grade === 1 ? 12 : (item.grade === 2 ? 8 : 5)));
      caughtLogs.push('• [적발] ' + escapeHtml(item.cargo.visitor) + ' 화물 → 경고');
      if (item.cargo.resistance) s.T = Math.min(100, s.T + 1);
    } else if (item.cargo.memory) {
      s.M++;
      s.dayRestorations.push({ type: 'M', cargo: item.cargo });
      if (item.cargo.resistance) s.T = Math.min(100, s.T + 2);
    } else {
      s.totalMercyPassed = (s.totalMercyPassed || 0) + 1;
      mercyPassed++;
      if (!Array.isArray(s.pendingMercyLetters)) s.pendingMercyLetters = [];
      if (s.pendingMercyLetters.length < 2) {
        s.pendingMercyLetters.push({
          from: item.cargo.visitor,
          text: item.cargo.visitor + '의 쪽지: "제7창구 심사관님, 어제 눈감아 보내 주신 ' + item.cargo.kind + ' 덕분에 무사히 안부를 전했습니다. 잊지 않겠습니다."'
        });
      }
    }

    const resCode = item.detected ? 'CAUGHT' : 'SLIPPED';
    if (s.flags[item.cargo.id] === 'PASS') s.flags[item.cargo.id] = resCode;
    const pending = s.dayPendingSettleFlags.find(p => p.cargo.id === item.cargo.id);
    if (pending) {
      for (const [fk, spec] of Object.entries(pending.map)) {
        if (spec && typeof spec === 'object' && spec[resCode] !== undefined) {
          if (typeof spec[resCode] === 'number' && fk.startsWith('rel.')) {
            s.flags[fk] = (Number(s.flags[fk]) || 0) + spec[resCode];
          } else {
            s.flags[fk] = spec[resCode];
          }
        }
      }
    }
  });

  s.dayWrongDenyReasons.forEach(msg => { addWarning(msg); caughtLogs.push('• [경고] ' + escapeHtml(msg)); });
  s.dayComplaints.forEach(msg => { addWarning(msg); caughtLogs.push('• [민원] ' + escapeHtml(msg)); });

  const allCorrect = s.dayReviewLog.length > 0 && s.dayReviewLog.every(r => r.ok);
  let streakRecovery = 0;
  let allCorrectBonus = 0;

  if (detectedCount === 0 && s.dayWarnings === 0) {
    s.consecutivePerfectDays = (s.consecutivePerfectDays || 0) + 1;
    streakRecovery = Math.min(6, s.consecutivePerfectDays * 2);
    s.rating = Math.min(100, s.rating + streakRecovery);
    s.S = Math.max(0, s.S - 2);
    if (allCorrect) {
      allCorrectBonus = GAME_CONFIG.ALL_CORRECT_BONUS;
      s.rating = Math.min(100, s.rating + 1);
    }
  } else {
    s.consecutivePerfectDays = 0;
  }

  const d = runtime.DAYS_DATA[s.day];
  const remainingQ = Math.max(0, (d.cargos || []).length - s.queueIndex);
  if (SURGE_DAYS.has(s.day) && remainingQ >= GAME_CONFIG.SURGE_MAX_UNPROCESSED) {
    addWarning('대기열 폭주 미처리 ' + remainingQ + '명 잔류');
    caughtLogs.push('• [경고] 대기열 폭주 미처리 ' + remainingQ + '명');
  }

  const denied = s.dayReviewLog.filter(r => String(r.action || '').startsWith('압수')).length;
  const passed = s.dayReviewLog.filter(r => String(r.action || '').startsWith('통과')).length;
  const edited = s.dayReviewLog.filter(r => String(r.action || '').startsWith('수정')).length;
  s.prevDayStats = {
    day: s.day,
    processed: s.dayProcessed,
    denied,
    passed,
    mercyPassed,
    edited,
    warnings: s.dayWarnings,
    detected: detectedCount,
    allCorrect
  };

  return { detectedCount, caughtLogs, streakRecovery, allCorrectBonus, allCorrect };
}

export function openSettlement() {
  const s = runtime.state;
  s.clockRunning = false;
  if (runtime.timers.clock) clearInterval(runtime.timers.clock);

  const sampleCount = s.dayAuditQueue.length;
  const { detectedCount, caughtLogs, streakRecovery, allCorrectBonus } = resolveNightAudits();
  const d = runtime.DAYS_DATA[s.day];

  const resBonus = (s.T >= GAME_CONFIG.RESISTANCE_TRUST_MIN && s.prevResPassed > 0)
    ? (s.prevResPassed * GAME_CONFIG.RESISTANCE_BONUS_PER_CARGO) : 0;
  s.prevResPassed = s.dayAuditQueue.filter(it => !it.detected && it.cargo.resistance).length;

  const basePay = GAME_CONFIG.BASE_PAY;
  const redactProcessed = s.dayRedactedCount || 0;
  const normalProcessed = Math.max(0, s.dayProcessed - redactProcessed);
  const procPay = normalProcessed * GAME_CONFIG.PROC_PAY_NORMAL + redactProcessed * GAME_CONFIG.PROC_PAY_REDACT;
  const diligence = s.rating >= GAME_CONFIG.DILIGENCE_RATING_MIN ? GAME_CONFIG.DILIGENCE_BONUS : 0;
  const income = Math.max(0, basePay + procPay + s.dayBonus + allCorrectBonus + diligence + resBonus - s.dayFines);
  s._settleIncome = income;

  const costs = calculateDailyCosts(s.day, s.seoyeonHealth, s.medExempt, s.coldMedDue);
  let rem = s.credits + income;
  const autoCheck = (c) => { if (c > 0 && rem >= c) { rem -= c; return true; } return false; };
  runtime.settleDraft = {
    ...costs,
    payRent: autoCheck(costs.rentCost),
    payFood: autoCheck(costs.foodCost),
    payHeat: autoCheck(costs.heatCost),
    payMed: autoCheck(costs.medCost),
    payCold: autoCheck(costs.coldCost),
    buyLv2: false, buyLv3: false, buyCoat: false, buyEmerg: false, buyBM: false, buyTip: false
  };

  $('settle-date').textContent = d.dateLabel + ' 퇴근 정산';
  $('settle-rating-badge').textContent = '평정 ' + s.rating;
  $('settle-lines').innerHTML =
    '<div class="settle-line"><span>기본 일당</span><span>₵' + basePay + '</span></div>'
    + '<div class="settle-line"><span>처리 수당 (일반 ' + normalProcessed + '건 × ₵' + GAME_CONFIG.PROC_PAY_NORMAL + (redactProcessed > 0 ? (' · 먹칠 ' + redactProcessed + '건 × ₵' + GAME_CONFIG.PROC_PAY_REDACT) : '') + ')</span><span>₵' + procPay + '</span></div>'
    + (s.dayBonus > 0 ? '<div class="settle-line"><span>수정·급행·대조 보너스</span><span>+₵' + s.dayBonus + '</span></div>' : '')
    + (allCorrectBonus > 0 ? '<div class="settle-line"><span>무결점 전원 일치 보너스 (평정 +1)</span><span>+₵' + allCorrectBonus + '</span></div>' : '')
    + (streakRecovery > 0 ? '<div class="settle-line"><span>연속 무경고 회복 (' + s.consecutivePerfectDays + '일 연속 · 의심 -2)</span><span>평정 +' + streakRecovery + '</span></div>' : '')
    + (diligence > 0 ? '<div class="settle-line"><span>성실 수당 (평정 80↑)</span><span>+₵' + diligence + '</span></div>' : '')
    + (resBonus > 0 ? '<div class="settle-line"><span>레지스탕스 사례금</span><span>+₵' + resBonus + '</span></div>' : '')
    + '<div class="settle-line ' + (s.dayFines > 0 ? 'neg' : '') + '"><span>경고 ' + s.dayWarnings + '건 (감봉)</span><span>' + (s.dayFines > 0 ? '-₵' + s.dayFines : '₵0') + '</span></div>'
    + '<div class="settle-line total"><span>오늘 순수입</span><span>+₵' + income + '</span></div>';

  const sClue = s.S >= 70 ? '※ 집 앞에 낯선 차가 세워져 있다.' : (s.S >= 50 ? '※ 감찰관이 창구 앞에서 한참을 멈춰 서 있었다.' : (s.S >= 30 ? '※ 퇴근길, 국장이 당신을 한 번 더 오래 쳐다보았다.' : ''));
  const instantTxt = s.dayInstantCaught > 0 ? (' · 근무 중 즉시 적발 ' + s.dayInstantCaught + '건') : '';
  const auditHeader = sampleCount === 0
    ? ('[야간 표본 감사 보고] 야간 대상 없음 (적발 0건' + instantTxt + ')')
    : ('[야간 표본 감사 보고] 야간 대상 ' + sampleCount + '건 중 적발 ' + detectedCount + '건' + instantTxt);

  const hasAuditHit = detectedCount > 0 || s.dayInstantCaught > 0;
  const canHush = s.flags['#3'] !== '신고';
  const auditActionsHtml = hasAuditHit
    ? '<div class="audit-actions-row">'
      + '<button id="btn-audit-confess" class="audit-action-btn">자수 소명서 (-₵' + GAME_CONFIG.AUDIT_CONFESS_COST + ' · 의심 -' + GAME_CONFIG.AUDIT_CONFESS_S_RELIEF + ' · 평정 +' + GAME_CONFIG.AUDIT_CONFESS_RATING_RELIEF + ')</button>'
      + (canHush ? '<button id="btn-audit-hush" class="audit-action-btn">암시장 기록 무마 (-₵' + GAME_CONFIG.AUDIT_HUSH_COST + ' · 의심 -' + GAME_CONFIG.AUDIT_HUSH_S_RELIEF + ' · 감봉 ₵10 환급)</button>' : '')
      + '</div>'
    : '';

  const reviewHtml = s.dayReviewLog.length
    ? '<details style="margin-top:8px;border-top:1px dashed #354556;padding-top:6px;"><summary style="cursor:pointer;color:#9CB0C4;font-size:0.78rem;">오늘 심사 복기 보기 (' + s.dayReviewLog.filter(r => r.ok).length + '/' + s.dayReviewLog.length + '건 규정 일치)</summary>'
      + '<div style="margin-top:6px;display:flex;flex-direction:column;gap:3px;font-size:0.75rem;">'
      + s.dayReviewLog.map(r => '<div>' + (r.ok ? '✓ ' : '△ ') + escapeHtml(r.visitor) + ' — 내 판정: <strong>' + escapeHtml(r.action) + '</strong> / 규정: ' + escapeHtml(r.expected) + '</div>').join('')
      + '</div></details>'
    : '';
  $('settle-audit').innerHTML =
    '<div style="font-weight:800;margin-bottom:4px;">' + auditHeader + '</div>'
    + (caughtLogs.length ? caughtLogs.join('<br>') : '적발된 건이 없습니다.')
    + (sClue ? '<div style="margin-top:6px;color:var(--stamp-deny);">' + sClue + '</div>' : '')
    + auditActionsHtml
    + reviewHtml;

  if ($('btn-audit-confess')) {
    $('btn-audit-confess').addEventListener('click', () => {
      const avail = s.credits + s._settleIncome - calcSettleTotalCost();
      if (avail < GAME_CONFIG.AUDIT_CONFESS_COST) { toast('잔고가 부족합니다 (₵' + GAME_CONFIG.AUDIT_CONFESS_COST + ' 필요).', 'warn'); return; }
      s._settleIncome -= GAME_CONFIG.AUDIT_CONFESS_COST;
      s.S = Math.max(0, s.S - GAME_CONFIG.AUDIT_CONFESS_S_RELIEF);
      s.rating = Math.min(100, s.rating + GAME_CONFIG.AUDIT_CONFESS_RATING_RELIEF);
      $('settle-rating-badge').textContent = '평정 ' + s.rating;
      $('btn-audit-confess').disabled = true;
      $('btn-audit-confess').textContent = '✓ 자수 소명서 제출 완료';
      toast('자수 소명서 제출: 의심 -' + GAME_CONFIG.AUDIT_CONFESS_S_RELIEF + ', 평정 +' + GAME_CONFIG.AUDIT_CONFESS_RATING_RELIEF);
      renderSettleExpenses();
    });
  }
  if ($('btn-audit-hush')) {
    $('btn-audit-hush').addEventListener('click', () => {
      const netCost = GAME_CONFIG.AUDIT_HUSH_COST - Math.min(10, s.dayFines);
      const avail = s.credits + s._settleIncome - calcSettleTotalCost();
      if (avail < netCost) { toast('잔고가 부족합니다 (순비용 ₵' + netCost + ' 필요).', 'warn'); return; }
      s._settleIncome -= netCost;
      s.S = Math.max(0, s.S - GAME_CONFIG.AUDIT_HUSH_S_RELIEF);
      $('btn-audit-hush').disabled = true;
      $('btn-audit-hush').textContent = '✓ 암시장 기록 무마 완료';
      toast('암시장 기록 무마: 의심 -' + GAME_CONFIG.AUDIT_HUSH_S_RELIEF + (s.dayFines > 0 ? ', 감봉 일부 환급' : ''));
      renderSettleExpenses();
    });
  }

  renderSettleExpenses();
  showScreen('screen-settlement');
}

function calcSettleTotalCost() {
  const dr = runtime.settleDraft;
  let cost = 0;
  if (dr.payRent) cost += dr.rentCost;
  if (dr.payFood) cost += dr.foodCost;
  if (dr.payHeat) cost += dr.heatCost;
  if (dr.payMed) cost += dr.medCost;
  if (dr.payCold) cost += dr.coldCost;
  if (dr.buyLv2) cost += GAME_CONFIG.UPGRADE_LV2_COST;
  if (dr.buyLv3) cost += GAME_CONFIG.UPGRADE_LV3_COST;
  if (dr.buyCoat) cost += GAME_CONFIG.COAT_COST;
  if (dr.buyEmerg) cost += GAME_CONFIG.EMERG_MED_COST;
  if (dr.buyBM) cost += GAME_CONFIG.BLACK_MARKET_COST;
  if (dr.buyTip) cost += GAME_CONFIG.PARK_TIP_COST;
  return cost;
}

export function renderSettleExpenses() {
  const s = runtime.state;
  const dr = runtime.settleDraft;
  const finalCredits = s.credits + s._settleIncome - calcSettleTotalCost();

  const items = [
    { id: 'exp-rent', key: 'payRent', label: '집세', cost: dr.rentCost },
    { id: 'exp-food', key: 'payFood', label: '식비', cost: dr.foodCost }
  ];
  if (dr.heatCost > 0) items.push({ id: 'exp-heat', key: 'payHeat', label: '난방비', cost: dr.heatCost });
  if (dr.medCost > 0) items.push({ id: 'exp-med', key: 'payMed', label: '서연 약값', cost: dr.medCost });
  if (dr.coldCost > 0) items.push({ id: 'exp-cold', key: 'payCold', label: '하람 감기약', cost: dr.coldCost });

  $('settle-expenses').innerHTML = items.map(it => {
    const checked = dr[it.key];
    const disabled = !checked && finalCredits < it.cost;
    return '<div id="' + it.id + '" class="expense-toggle ' + (checked ? 'checked' : '') + ' ' + (disabled ? 'disabled' : '') + '"><span>' + (checked ? '☑' : '☐') + ' ' + it.label + '</span><strong>₵' + it.cost + '</strong></div>';
  }).join('');

  items.forEach(it => {
    $(it.id).addEventListener('click', () => {
      if (!dr[it.key] && finalCredits < it.cost) return;
      dr[it.key] = !dr[it.key];
      renderSettleExpenses();
    });
  });

  const opts = [];
  if (s.day >= 8 && s.meterLv === 1) opts.push({ key: 'buyLv2', label: '측정기 Lv2 (문장모드·±4)', cost: GAME_CONFIG.UPGRADE_LV2_COST });
  if (s.day >= 18 && s.meterLv === 2) opts.push({ key: 'buyLv3', label: '측정기 Lv3 (±2/±1)', cost: GAME_CONFIG.UPGRADE_LV3_COST });
  if (s.day === 13 && !s.flags['외투']) opts.push({ key: 'buyCoat', label: '하람 겨울 외투', cost: GAME_CONFIG.COAT_COST });
  if (s.day === 20 && s.seoyeonHealth !== '사망') opts.push({ key: 'buyEmerg', label: '서연 응급비', cost: GAME_CONFIG.EMERG_MED_COST });
  if (s.day >= 9 && s.flags['#3'] !== '신고') opts.push({ key: 'buyBM', label: '암시장 단어장(내일)', cost: GAME_CONFIG.BLACK_MARKET_COST });
  if (s.day >= 12 && s.day <= 20) opts.push({ key: 'buyTip', label: '박 주임 귀띔(내일)', cost: GAME_CONFIG.PARK_TIP_COST });

  $('settle-opt-wrap').style.display = opts.length > 0 ? 'block' : 'none';
  if (opts.length > 0) {
    $('settle-opt-expenses').innerHTML = opts.map(o => {
      const on = dr[o.key];
      const dis = !on && finalCredits < o.cost;
      return '<button class="opt-expense-btn ' + (on ? 'bought' : '') + '" data-opt-key="' + o.key + '" data-opt-cost="' + o.cost + '" ' + (dis ? 'disabled' : '') + '>' + (on ? '✓ ' : '+ ') + o.label + ' ₵' + o.cost + '</button>';
    }).join('');
    $('settle-opt-expenses').querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        const k = b.dataset.optKey, c = Number(b.dataset.optCost);
        if (!dr[k] && finalCredits < c) return;
        dr[k] = !dr[k];
        renderSettleExpenses();
      });
    });
  }

  $('settle-final-credits').textContent = '₵' + finalCredits;
  const nextFoodMissed = dr.payFood ? 0 : s.foodMissed + 1;
  const previewFam = s.familyGone ? '윤희·하람 떠남' : (nextFoodMissed >= 3 ? '윤희·하람 귀가 예정' : (nextFoodMissed === 2 ? '허약' : (nextFoodMissed === 1 ? '배고픔' : '보통')));
  const previewMed = s.seoyeonHealth === '사망' ? '사망' : (dr.medCost > 0 && !dr.payMed ? (s.medMissed >= 2 ? '사망 위험' : (s.medMissed === 1 ? '위독' : '아픔')) : s.seoyeonHealth);
  $('settle-family').textContent = '가족 상태 예상: 윤희·하람 ' + previewFam + ' / 서연 ' + previewMed;
}

export function confirmSettlement() {
  const s = runtime.state;
  const dr = runtime.settleDraft;
  s.credits = s.credits + s._settleIncome - calcSettleTotalCost();
  s.rentMissed = dr.payRent ? 0 : s.rentMissed + 1;
  s.foodMissed = dr.payFood ? 0 : s.foodMissed + 1;
  if (s.foodMissed >= 3) s.familyGone = true;

  if (dr.heatCost > 0) {
    s.heatMissed = dr.payHeat ? 0 : s.heatMissed + 1;
    const coldLimit = (s.day >= 13 && !s.flags['외투']) ? 1 : 2;
    if (s.heatMissed >= coldLimit) s.coldMedDue = true;
  }
  if (dr.payCold) s.coldMedDue = false;

  if (dr.buyLv2) s.meterLv = 2;
  if (dr.buyLv3) s.meterLv = 3;
  if (dr.buyCoat) { s.flags['외투'] = true; s.flags['rel.윤희'] = (Number(s.flags['rel.윤희']) || 0) + 1; }
  if (dr.buyEmerg) s.flags['rel.윤희'] = (Number(s.flags['rel.윤희']) || 0) + 1;
  if (s.foodMissed >= 2 || s.rentMissed >= 2) s.flags['rel.윤희'] = (Number(s.flags['rel.윤희']) || 0) - 1;
  if (dr.buyBM) s.blackMarketBought = true;
  if (dr.buyTip) s.parkTipBought = true;

  if (dr.medCost > 0 && s.seoyeonHealth !== '사망') {
    if (dr.payMed) {
      s.medMissed = 0;
      s.seoyeonHealth = '보통';
    } else {
      const graceAvail = [5, 15, 25].filter(th => (s.M + s.E) >= th).length;
      if (graceAvail > s.medGraceUsed) {
        s.medGraceUsed++;
        toast('기억 안정 효과로 서연의 병세 악화가 하루 유예되었습니다.');
      } else {
        s.medMissed++;
        s.seoyeonHealth = s.medMissed >= 3 ? '사망' : (s.medMissed === 2 ? '위독' : '아픔');
      }
    }
  }
  if (s.day === 20 && !dr.buyEmerg && s.seoyeonHealth !== '사망') {
    s.seoyeonHealth = '위독';
    s.medMissed = Math.max(s.medMissed, 2);
  }

  if (s.S >= 100) return showEnding('E-01', '압수된 사람', '정산 화면 위로 감찰관의 긴 그림자가 드리운다. 문이 열리고 당신의 심사관 증표가 회수된 다음 날, 제7창구 유리 너머에는 처음 보는 심사관이 앉아 있다.');
  if (s.rating <= 0) return showEnding('E-02', '반납된 도장', '해고 통지서가 책상 위에 놓였다. 국장이 당신의 손에서 세 개의 도장을 조용히 거두어 간다. "말은 지켰나? …아니, 이제는 대답하지 말게."');
  if (s.rentMissed >= 3) return showEnding('E-03', '주소 없음', '집세 3일 연속 미납으로 퇴거 명령이 집행되었다. 문패가 떼어진 현관을 등지고 돌아서자, 편지를 받을 주소마저 도시에서 사라진다.');
  if (s.seoyeonHealth === '사망' && s.familyGone) return showEnding('E-04', '빈 집', '불 꺼진 부엌에 혼자 앉아 있다. 식탁 위에는 서연이 평생 모아 둔 옛말 공책 한 권만이 바람에 넘어가고 있다.');

  openEvening();
}

function buildEveningDialogueLines(d, trackRel) {
  const s = runtime.state;
  const lines = [];
  if (Array.isArray(s.pendingMercyLetters) && s.pendingMercyLetters.length > 0) {
    s._todayMercyLetters = s.pendingMercyLetters.slice();
    s.pendingMercyLetters = [];
  }
  if (Array.isArray(s._todayMercyLetters) && s._todayMercyLetters.length > 0) {
    s._todayMercyLetters.forEach(item => {
      lines.push({ s: '익명의 쪽지', t: item.text });
    });
  }
  if (s.familyGone) lines.push({ s: '윤희', t: '미안해… 하람이 데리고 당분간 친정에 가 있을게.' });
  else if (s.foodMissed === 2) lines.push({ s: '윤희', t: '이틀째 제대로 못 먹었더니 하람이가 기운이 없어. 허약해 보여.' });
  else if (s.foodMissed === 1) lines.push({ s: '하람', t: '{부모호칭}, 배고파요. 오늘 저녁은 없어요?' });

  (d.eveningIntro || []).forEach(line => { if (evalWhen(line.when)) lines.push(line); });
  if (d.evening && Array.isArray(d.evening.interview)) {
    d.evening.interview.forEach(line => { if (evalWhen(line.when)) lines.push({ s: '국장 문태오', t: line.t }); });
    if (trackRel.shouldCount && s.rating >= 70) {
      trackRel.shouldCount = false;
      s.flags['rel.국장'] = (Number(s.flags['rel.국장']) || 0) + 1;
    }
  }
  if (d.evening && Array.isArray(d.evening.director)) {
    d.evening.director.forEach(line => { if (evalWhen(line.when)) lines.push({ s: '국장 문태오', t: line.t }); });
  }
  const driftedList = Object.keys(s.driftWords || {});
  if (driftedList.length > 0 && s.day >= 4 && !s.familyGone) {
    const dw = driftedList[s.day % driftedList.length];
    lines.push({ s: '하람', t: '{부모호칭}, 오늘 학교 애들도 다 「' + dw + '」라고 말하던데요? 그 말 참 따뜻해요.' });
  }
  if (d.evening && Array.isArray(d.evening.extra)) {
    d.evening.extra.forEach(line => { if (evalWhen(line.when)) lines.push({ s: line.s || '저녁', t: line.t }); });
  }
  return lines;
}

function renderEveningEventBox(evObj, onResolved) {
  const s = runtime.state;
  const evBox = $('evening-event-box');
  if (!evObj || !evalWhen(evObj.when) || s.eveningEventDone) {
    evBox.style.display = 'none';
    $('btn-next-day').disabled = false;
    return;
  }
  evBox.style.display = 'flex';
  $('btn-next-day').disabled = true;
  const useAlt = evObj.alt && evalWhen(evObj.alt.when);
  const rawText = (useAlt ? evObj.alt.text : evObj.text || '').replace('{본 레지스탕스 화물 수}', String(s.resCargosSeen));
  const inputHtml = evObj.input
    ? '<input id="evening-event-input" class="inline-edit-input" type="text" placeholder="이름을 입력하거나 비워 두고 거절">'
    : '';
  const choiceEntries = Object.entries(evObj.choices || {});
  evBox.innerHTML =
    '<div class="ev-title">[핵심 선택 ' + escapeHtml(evObj.id || '') + ']</div>'
    + '<div class="ev-text">' + escapeHtml(renderTemplate(rawText)) + '</div>'
    + inputHtml
    + '<div class="ev-btns">' + choiceEntries.map(([lbl], idx) => '<button class="btn-secondary" data-eev-idx="' + idx + '">' + escapeHtml(lbl) + '</button>').join('') + '</div>';

  evBox.querySelectorAll('[data-eev-idx]').forEach(b => {
    b.addEventListener('click', () => {
      const [lbl, ch] = choiceEntries[Number(b.dataset.eevIdx)];
      if (evObj.id === '#10' && lbl === '수락') {
        const typed = ($('evening-event-input') ? $('evening-event-input').value : '').trim();
        if (typed && typed !== '모리') {
          toast('NULL: "일치하는 연락책 이름이 아닙니다." (수락하려면 "모리" 입력)', 'warn');
          return;
        }
      }
      if (evObj.id === '#11' && lbl === '받는다' && useAlt) {
        if (s.flags['#3'] === '신고') { toast('두더지가 신고되어 탈출증을 구할 수 없습니다.', 'err'); return; }
        if (s.credits < GAME_CONFIG.ESCAPE_PASS_COST) { toast('잔고가 부족합니다 (₵' + GAME_CONFIG.ESCAPE_PASS_COST + ' 필요).', 'warn'); return; }
        s.credits -= GAME_CONFIG.ESCAPE_PASS_COST;
        s.S = Math.min(100, s.S + 5);
      }
      if (ch.C && s.credits + ch.C < 0) { toast('잔고가 부족합니다.', 'warn'); return; }
      if (ch.C) s.credits += ch.C;
      if (ch.S === '=0') s.S = 0; else if (typeof ch.S === 'number') s.S = Math.max(0, Math.min(100, s.S + ch.S));
      if (ch.T === '=0') s.T = 0; else if (typeof ch.T === 'number') s.T = Math.max(0, Math.min(100, s.T + ch.T));
      if (ch['하람 옛말']) s.flags['하람옛말'] = (Number(s.flags['하람옛말']) || 0) + ch['하람 옛말'];
      if (ch.flag && ch.flag.includes('=')) {
        const [fk, fv] = ch.flag.split('=');
        s.flags[fk.trim()] = fv.trim();
      }
      if (evObj.id) s.flags[evObj.id] = lbl;
      if (evObj.id === '#9') s.flags['D21.박주임'] = lbl;
      if (evObj.id === '#10' && lbl === '수락') s.medExempt = true;
      if (evObj.id === '#12' && lbl === '공책을 낸다') s.seoyeonSadDays = 2;

      s.eveningEventDone = true;
      $('btn-next-day').disabled = false;
      evBox.innerHTML = '<div class="ev-title">[선택 완료: ' + escapeHtml(lbl) + ']</div>'
        + '<div class="ev-text">' + escapeHtml(ch.after || ch.note || '선택이 기록되었습니다.') + '</div>';
      onResolved();
      if (ch.ending === 'E-05') {
        showEnding('E-05', '먼저 떠난 사람', '습기 찬 하수로의 어둠 속에서 가족의 손을 놓치지 않으려 꽉 쥐었다. 새벽빛과 함께 국경을 넘었지만, 세관 창구에 남겨진 화물들이 어떤 결말을 맞았는지는 끝내 듣지 못했다.');
      }
    });
  });
}

function renderSeoyeonAdviceBox() {
  const { LEX, state: s } = runtime;
  const advBox = $('evening-advice-box');
  const maxAdv = (s.M + s.E) >= 15 ? 2 : 1;
  const canAdvise = s.seoyeonSadDays === 0 && !['아픔', '위독', '사망'].includes(s.seoyeonHealth);

  if (s.day < 2 || !s.daySeenWords.length || !canAdvise) {
    advBox.style.display = 'none';
    return;
  }
  advBox.style.display = 'block';
  $('advice-title').textContent = '서연의 조언 (무료 힌트 · 하루 ' + maxAdv + '회)';
  const wrap = $('advice-words');
  const activeT = getActiveTermsList();
  const sorted = s.daySeenWords.slice().sort((a, b) => {
    const minDist = (w) => Math.min(...activeT.map(t => Math.abs(LEX.trueSim(w, t).v - LEX.effL(t, s.day, 'before', '제1구역'))));
    return minDist(a) - minDist(b);
  });
  wrap.innerHTML = sorted.slice(0, 10).map(w => '<button data-adv="' + escapeHtml(w) + '">' + escapeHtml(w) + '</button>').join('');
  wrap.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', () => {
      if (s.dayAdviceCount >= maxAdv) { toast('오늘은 이미 서연에게 물었습니다.', 'warn'); return; }
      const w = b.dataset.adv;
      if (s.seoyeonQueue.some(q => q.word === w)) return;
      let bestT = '자유', bestV = -1;
      getActiveTermsList().forEach(t => {
        const v = LEX.trueSim(w, t).v;
        if (v > bestV) { bestV = v; bestT = t; }
      });
      s.seoyeonQueue.push({ word: w, target: bestT });
      s.dayAdviceCount++;
      b.classList.add('picked');
      if (s.dayAdviceCount >= maxAdv) wrap.querySelectorAll('button:not(.picked)').forEach(x => { x.disabled = true; });
      toast('서연에게 「' + w + '」에 대해 물었습니다. 내일 아침 쪽지가 도착합니다.');
    });
  });
}

export function openEvening() {
  const s = runtime.state;
  const d = runtime.DAYS_DATA[s.day];
  $('evening-day-tag').textContent = d.dateLabel + ' 저녁 · 집';

  const restoredTotal = s.M + s.E;
  const prog = Math.min(1, restoredTotal / 12);
  const heroImg = document.querySelector('.evening-hero img');
  if (heroImg) {
    heroImg.style.filter = 'saturate(' + (0.45 + prog * 0.85).toFixed(2) + ') sepia(' + (prog * 0.16).toFixed(2) + ') brightness(' + (0.86 + prog * 0.18).toFixed(2) + ')';
  }
  SFX.eveningChord(restoredTotal);

  const trackRel = { shouldCount: true };
  renderAlignmentDashboard('evening-alignment');
  const renderDialogue = () => {
    const lines = buildEveningDialogueLines(d, trackRel);
    $('evening-dialogue').innerHTML = lines.map(line =>
      '<div class="dialogue-line"><span class="speaker-tag">' + escapeHtml(line.s || '') + '</span>' + escapeHtml(renderTemplate(line.t)) + '</div>'
    ).join('') || '<div class="dialogue-line">조용한 저녁이 지났다.</div>';
  };
  renderDialogue();
  renderEveningEventBox(d.evening && d.evening.event, renderDialogue);
  renderSeoyeonAdviceBox();

  $('btn-next-day').textContent = s.day >= 30 ? '근무 마침' : ('잠자리에 든다 → D' + (s.day + 1));
  showScreen('screen-evening');

  if (s.dayRestorations.length > 0) {
    s._restoreQueue = s.dayRestorations.slice();
    playRestorationCinematic(s._restoreQueue.shift());
  }
}

export function playRestorationCinematic(item) {
  const s = runtime.state;
  const isMeta = item.type === 'E';
  const c = item.cargo;
  SFX.motif(isMeta);

  $('restore-type-tag').textContent = isMeta ? '은유 복원 (E +1)' : '원문 복원 (M +1)';
  $('restore-word').textContent = isMeta ? item.editWord : c.memoryWord;
  $('restore-pencil').textContent = isMeta ? '(연필 자국처럼 비치는 원문: ' + c.memoryWord + ')' : '「' + c.memoryTitle + '」';

  const imgKey = (c.memoryImg && c.memoryImg.startsWith('build:')) ? c.memoryImg.slice(6) : c.id;
  const imgSrc = MEMORY_IMG[imgKey] || MEMORY_IMG.default;
  $('restore-img-wrap').innerHTML = '<img src="' + imgSrc + '" class="' + (isMeta ? 'metaphor-tint' : '') + '" alt="' + escapeHtml(c.memoryTitle || c.memoryWord) + '">';

  const quote = renderTemplate(isMeta ? c.memoryMetaphorQuote : c.memoryOriginQuote);
  $('restore-quote').textContent = quote;
  const fb = c.familyBonus || [];
  $('restore-reward').textContent = '복원 사전 등재' + (fb.length ? (' · ' + fb.join(' / ')) : '');

  runtime.persistentDict[c.id] = {
    title: c.memoryTitle,
    word: c.memoryWord,
    mode: isMeta ? ('은유 복원 (' + item.editWord + ')') : '원문 복원',
    quote,
    day: s.day
  };
  savePersistentDict();
  fb.forEach(x => { if (!s.familyMemos.includes(x)) s.familyMemos.push(x); });
  $('modal-restore').classList.add('active');
}

export function proceedFromEvening() {
  if (runtime.state.day >= 30) {
    showEnding('COMPLETE', '되찾은 말들', '30일의 근무를 마쳤습니다.');
    return;
  }
  startDayMorning(runtime.state.day + 1);
}

export function showEnding(badge, title, desc) {
  const s = runtime.state;
  if (ENDINGS_CATALOG.some(([id]) => id === badge)) saveUnlockedEnding(badge, title, desc);
  $('ending-badge').textContent = badge;
  $('ending-title').textContent = title;
  $('ending-desc').textContent = desc;
  const avgQ = s.editPs.length >= 5 ? Math.round(s.editPs.reduce((a, b) => a + b, 0) / s.editPs.length) : 0;
  const callbacks = buildEndingCallbacks();
  const driftSorted = Object.entries(s.driftWords || {}).sort((a, b) => (b[1].count || 0) - (a[1].count || 0));
  const topDriftTxt = driftSorted.length ? ('「' + escapeHtml(driftSorted[0][0]) + '」 ' + driftSorted[0][1].count + '회') : '없음';
  const cbHtml = callbacks.length
    ? '<div class="ending-callbacks"><div class="ending-cb-title">[30일의 여정 · 선택의 잔향]</div>'
      + callbacks.map(line => '<div>• ' + escapeHtml(line) + '</div>').join('')
      + '</div>'
    : '';
  const d30ReviewHtml = (s.day === 30 && s.dayReviewLog && s.dayReviewLog.length > 0)
    ? '<details style="margin-top:10px;border-top:1px dashed #435364;padding-top:8px;text-align:left;"><summary style="cursor:pointer;color:#9CB0C4;font-size:0.78rem;">D30 최종 근무 복기 (' + s.dayReviewLog.filter(r => r.ok).length + '/' + s.dayReviewLog.length + '건 규정 일치)</summary>'
      + '<div style="margin-top:6px;display:flex;flex-direction:column;gap:3px;font-size:0.74rem;color:#DCE6F0;">'
      + s.dayReviewLog.map(r => '<div>' + (r.ok ? '✓ ' : '△ ') + escapeHtml(r.visitor) + ' — 내 판정: <strong>' + escapeHtml(r.action) + '</strong> / 규정: ' + escapeHtml(r.expected) + '</div>').join('')
      + '</div></details>'
    : '';
  $('ending-stats').innerHTML =
    '<div>도달 일차: <strong>D' + s.day + '</strong> · 잔고: <strong>₵' + s.credits + '</strong> · 평정: <strong>' + s.rating + '</strong></div>'
    + '<div>원문 복원(M): <strong>' + s.M + '</strong> · 은유 복원(E): <strong>' + s.E + '</strong> · 평균 보존율(Q): <strong>' + avgQ + '%</strong></div>'
    + '<div>누적 복원 사전: <strong>' + Object.keys(runtime.persistentDict).length + '건</strong> · 일반 선처 통과: <strong>' + (s.totalMercyPassed || 0) + '건</strong> · 최다 대체어: <strong>' + topDriftTxt + '</strong></div>'
    + cbHtml
    + d30ReviewHtml;
  showScreen('screen-ending');
}

export function openDictModal() {
  renderAlignmentDashboard('dict-alignment');
  const keys = Object.keys(runtime.persistentDict);
  const box = $('dict-content');
  box.innerHTML = !keys.length
    ? '<div style="color:#534D42;text-align:center;padding:24px 10px;line-height:1.7;">아직 복원된 말이 없습니다.</div>'
    : keys.map(k => {
        const it = runtime.persistentDict[k];
        return '<div class="rb-card" style="border-left:4px solid var(--restore-orange);">'
          + '<div class="rb-card-head"><span class="restored-word" style="text-shadow:none;color:#9A5B0A;">' + escapeHtml(it.word) + ' — ' + escapeHtml(it.title) + '</span><span class="rb-sub">D' + it.day + ' · ' + escapeHtml(it.mode) + '</span></div>'
          + '<div style="font-family:var(--font-serif);font-size:0.84rem;margin-top:4px;line-height:1.6;">' + escapeHtml(it.quote) + '</div>'
          + '</div>';
      }).join('');
  $('modal-dict').classList.add('active');
}

export function openTimelineModal() {
  const grid = $('timeline-grid');
  grid.innerHTML = TIMELINE_BRANCHES.map(b => {
    const hasSnap = !!runtime.branchSnaps[String(b.day)];
    const badge = hasSnap
      ? '<span style="font-size:0.64rem;color:#35F2A0;margin-left:4px;">● 내 기록</span>'
      : '<span style="font-size:0.64rem;color:#7A8B9C;margin-left:4px;">프리셋</span>';
    return '<button class="timeline-node" data-tl-day="' + b.day + '"><span style="font-size:0.7rem;color:#F4B942;font-weight:800;">' + b.tag + badge + '</span><strong style="font-size:0.82rem;">' + b.title + '</strong></button>';
  }).join('');

  grid.querySelectorAll('[data-tl-day]').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = Number(btn.dataset.tlDay);
      $('modal-timeline').classList.remove('active');
      const p = runtime.state.flags['부모호칭'] || '아빠';
      const prevSettings = Object.assign({}, runtime.state.settings);
      const snap = runtime.branchSnaps[String(d)];
      if (snap) {
        runtime.state = Object.assign(createFreshState(d), JSON.parse(JSON.stringify(snap)));
        toast('D' + d + ' 저장된 내 분기 기록으로 이동합니다.');
      } else {
        runtime.state = applyJumpPreset(createFreshState(d), d);
        toast('D' + d + ' 기준 프리셋(장비·수치 보정)으로 시작합니다.');
      }
      runtime.state.settings = prevSettings;
      runtime.state.flags['부모호칭'] = p;
      runtime.state.flags['윤희호칭'] = p === '아빠' ? '엄마' : '아빠';
      applySettings();
      startDayMorning(d);
    });
  });

  const unlockedCnt = ENDINGS_CATALOG.filter(([id]) => runtime.unlockedEndings[id]).length;
  $('ending-album-title').textContent = '해금된 엔딩 (' + unlockedCnt + '/20)';
  $('ending-grid').innerHTML = ENDINGS_CATALOG.map(([id, name, hint]) => {
    const got = runtime.unlockedEndings[id];
    return '<div class="ending-tile ' + (got ? 'unlocked' : '') + '">'
      + '<div style="font-weight:800;color:' + (got ? '#F4B942' : '#7A8B9C') + ';">' + id + ' · ' + (got ? name : '???') + '</div>'
      + '<div style="color:#9CB0C4;margin-top:2px;">' + (got ? got.desc : ('힌트: ' + hint)) + '</div>'
      + '</div>';
  }).join('');
  $('modal-timeline').classList.add('active');
}

export function openSettingsModal() {
  runtime.state.paused = true;
  applySettings();
  $('modal-settings').classList.add('active');
}

export function closeSettingsModal() {
  runtime.state.paused = false;
  $('modal-settings').classList.remove('active');
}

export function retryCurrentDay() {
  closeSettingsModal();
  if (runtime.timers.clock) { clearInterval(runtime.timers.clock); runtime.timers.clock = null; }
  if (runtime.timers.measure) { clearTimeout(runtime.timers.measure); runtime.timers.measure = null; }
  const curDay = runtime.state.day || 1;
  const prevSettings = Object.assign({}, runtime.state.settings);
  const saved = loadProgress();
  if (saved && saved.day === curDay) {
    runtime.state = Object.assign(createFreshState(curDay), saved);
  } else {
    runtime.state = applyJumpPreset(createFreshState(curDay), curDay);
  }
  runtime.state.settings = prevSettings;
  applySettings();
  toast('D' + curDay + ' 근무를 아침부터 다시 시작합니다.');
  startDayMorning(curDay);
}

export function returnToTitle() {
  closeSettingsModal();
  if (runtime.timers.measure) { clearTimeout(runtime.timers.measure); runtime.timers.measure = null; }
  runtime.state.measuring = false;
  runtime.state.clockRunning = false;
  runtime.state.stickyOpen = false;
  if ($('sticky-note-panel')) $('sticky-note-panel').classList.remove('open');
  $('btn-continue').style.display = loadProgress() ? 'inline-block' : 'none';
  showScreen('screen-title');
}
