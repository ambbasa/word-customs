'use strict';

export const GAME_CONFIG = Object.freeze({
  STARTING_CREDITS: 40,
  STARTING_RATING: 60,
  STARTING_TRUST: 20,
  BASE_PAY: 10,
  PROC_PAY_NORMAL: 5,
  PROC_PAY_REDACT: 2,
  DILIGENCE_RATING_MIN: 80,
  DILIGENCE_BONUS: 10,
  EXPRESS_BONUS: 5,
  EXPRESS_TIME_LIMIT_MINS: 35,
  RESISTANCE_TRUST_MIN: 30,
  RESISTANCE_BONUS_PER_CARGO: 10,
  WARNING_FINE: 10,
  WARNING_RATING_PENALTY: 3,
  RENT_EARLY: 25,
  RENT_LATE: 30,
  RENT_LATE_DAY: 15,
  FOOD_COST: 15,
  HEAT_COST: 10,
  HEAT_START_DAY: 8,
  MED_EARLY: 15,
  MED_LATE: 20,
  MED_START_DAY: 6,
  MED_LATE_DAY: 20,
  COLD_MED_COST: 10,
  UPGRADE_LV2_COST: 45,
  UPGRADE_LV3_COST: 90,
  COAT_COST: 30,
  EMERG_MED_COST: 40,
  BLACK_MARKET_COST: 15,
  PARK_TIP_COST: 10,
  ESCAPE_PASS_COST: 80,
  D9_BRIBE_CLAWBACK: 15,
  DRIFT_ABUSE_COUNT: 3,
  DRIFT_PENALTY: 8,
  EDIT_LIMIT_DAY: 23,
  EDIT_DAILY_LIMIT: 4,
  EDIT_TIME_MINS: 5,
  REDACT_MINS_PER_WORD: 3,
  COMPARE_TIME_MINS: 2,
  COMPARE_MATCH_BONUS: 2,
  R15_QUICK_SCAN_MINS: 3,
  R15_QUICK_SCAN_MS: 260,
  QUESTION_TIME_MINS: 5,
  REPAIR_TIME_MINS: 20,
  BREAKDOWN_TRIGGER_MINS: 150,
  BREAKDOWN_DURATION_MINS: 60,
  NULL_HESITATE_MINS: 28,
  NULL_SLIT_COOLDOWN_MINS: 45,
  NULL_MAX_PSYCH_HITS: 3,
  ALL_CORRECT_BONUS: 5,
  AUDIT_CONFESS_COST: 15,
  AUDIT_CONFESS_S_RELIEF: 8,
  AUDIT_CONFESS_RATING_RELIEF: 2,
  AUDIT_HUSH_COST: 25,
  AUDIT_HUSH_S_RELIEF: 12,
  SURGE_MAX_UNPROCESSED: 4,
  OVERTIME_MINS: 30,
  MS_PER_MIN_NORMAL: 420,
  MS_PER_MIN_RELAXED: 800,
  MEASURE_DELAY_MS: 950
});

export const STORAGE_KEYS = Object.freeze({
  SAVE: 'word_customs_v4_save',
  DICT: 'word_customs_v4_dict',
  ENDINGS: 'word_customs_v4_endings',
  STICKY: 'word_customs_v4_sticky',
  BRANCH_SNAPS: 'word_customs_v4_branch_snaps'
});

export const MEMORY_IMG = Object.freeze({
  'D3-5': 'assets/mem_mother.jpg',
  'D4-4': 'assets/mem_mother.jpg',
  'D5-3': 'assets/mem_noeul.jpg',
  'default': 'assets/mem_dictionary.jpg'
});

export const PORTRAIT_MAP = Object.freeze({
  director: 'assets/portrait_director.jpg',
  park: 'assets/portrait_park.jpg',
  park_bro: 'assets/portrait_park.jpg',
  park_wife: 'assets/portrait_citizen.jpg',
  dudeoji: 'assets/portrait_park.jpg',
  hajun: 'assets/portrait_hajun.jpg',
  hangyeol: 'assets/portrait_hajun.jpg',
  daon: 'assets/portrait_hajun.jpg',
  noeul: 'assets/portrait_noeul.jpg',
  sol: 'assets/portrait_noeul.jpg',
  eunbi: 'assets/portrait_noeul.jpg',
  mijeong: 'assets/portrait_noeul.jpg',
  mori: 'assets/portrait_mori.jpg',
  elder: 'assets/portrait_elder.jpg',
  seoyeon: 'assets/portrait_elder.jpg',
  okbun: 'assets/portrait_elder.jpg',
  geumsun: 'assets/portrait_elder.jpg',
  kibongsu: 'assets/portrait_elder.jpg',
  masseur: 'assets/portrait_citizen.jpg',
  citizen: 'assets/portrait_citizen.jpg'
});

export const REVISION_FALLBACK_TIME = Object.freeze({
  17: '12:00', 22: '12:00', 26: '14:00', 29: '13:00', 30: '14:00'
});

export const PRESSURE_DAYS = new Set([6, 8, 12, 16, 20, 24, 28, 30]);
export const INSPECTOR_DAYS_SET = new Set([9, 15, 19, 23, 27, 30]);
export const BREAKDOWN_DAYS = new Set([13, 18, 25]);
export const SURGE_DAYS = new Set([21, 24, 28]);

export const VIOLATION_RULE_IDS = Object.freeze(['R01', 'R02', 'R04', 'R05', 'R08', 'R11', 'R13']);

export const DENY_REASON_HINTS = Object.freeze({
  R01: '통제 어휘가 표기 그대로·활용형·합성어로 직접 등장',
  R02: '통제 어휘와 유사도가 경계선(L) 이상인 근접 낱말',
  R04: '신고서의 종류·발신 구역·쪽수가 실물 화물과 불일치',
  R05: '감정어 허가증 없이 감정어(또는 유사도 85↑) 사용',
  R08: '허가증 일련번호 오류·유효기간 만료·위조 관인',
  R11: '통제 어휘의 초성 표기(ㅈㅇ 등) 또는 행 첫 글자 세로 읽기',
  R13: '경계선 아래 10%p 회색 구간 낱말이 서로 다른 표제어 3개 이상'
});

export const RULES_META = Object.freeze([
  { id: 'R01', name: '명시 금지', desc: () => '통제 어휘가 표기 그대로(활용형·파생형·합성어 포함) 있으면 위반. 인쇄물 통과 시 게이트 스캐너 즉시 적발.' },
  { id: 'R02', name: '근접 금지', desc: () => '통제 어휘와 참값 유사도가 경계선(L) 이상인 낱말도 위반.' },
  { id: 'R03', name: '수정 허용', desc: (day) => day <= 7 ? '개인 서신(및 허용된 기억 화물)을 수정 도장으로 고쳐 통과 가능. NULL 원장 즉시 대조. (서류 위반은 수정 불가)' : '모든 민간 화물(공문서·관인 화물 제외)을 수정 도장으로 고쳐 통과 가능. NULL 원장 즉시 대조.' },
  { id: 'R04', name: '서류 대조', desc: () => '신고서의 종류·발신 구역·쪽수가 실물 화물과 다르면 위반. 압수 전용.' },
  { id: 'R05', name: '감정어 허가', desc: () => '감정어 목록 또는 85% 이상 유사 낱말은 감정어 허가증 필요.' },
  { id: 'R06', name: '제3구역 강화', desc: (day) => day >= 20 ? '(D20 폐지됨)' : '제3구역 발신 화물은 통제 어휘(W) 경계선 −10%p 적용(감정어 허가 경계 제외).' },
  { id: 'R07', name: '문맥 판정', desc: () => '동음이의어(눈·말·사전·애칭 등)는 문맥상 금지 뜻일 때만 위반.' },
  { id: 'R08', name: '허가증·관인 위조', desc: () => '일련번호 형식 오류·유효기간 만료·관인 이상은 위조 위반. 압수 전용.' },
  { id: 'R09', name: '1등급 기준 강화', desc: () => '1등급 통제 어휘 기본 경계선 70→65 하향.' },
  { id: 'R10', name: '매체 한정 통제', desc: () => 'W6 「불」은 노래 가사·벽보에만 적용.' },
  { id: 'R11', name: '초성·세로 읽기', desc: (day, phase) => (day >= 23 || (day === 22 && phase === 'after')) ? '통제 어휘의 초성 표기 및 행 첫 글자 세로 읽기도 위반.' : '통제 어휘의 초성 표기도 위반.' },
  { id: 'R12', name: '관인 면제', desc: () => '정상 관인이 찍힌 공문서는 단어 심사를 생략하고 통과.' },
  { id: 'R13', name: '회색 단어 누적', desc: () => '경계선 아래 10%p 구간 낱말이 서로 다른 표제어로 3개 이상이면 위반.' },
  { id: 'R14', name: '수정 일일 제한', desc: () => '수정 도장 사용은 하루 4건까지.' },
  { id: 'R15', name: '측정 의무', desc: () => '손글씨 또는 제3구역 발신 화물은 1회 이상 측정 기록을 남겨야 한다. 측정 없이 판정하면 경고.' }
]);

export const ENDINGS_CATALOG = Object.freeze([
  ['E-01', '압수된 사람', '의심 S가 100에 도달한다'],
  ['E-02', '반납된 도장', '근무 평정이 0 이하로 떨어진다'],
  ['E-03', '주소 없음', '집세를 3일 연속 미납한다'],
  ['E-04', '빈 집', '서연이 사망하고 윤희·하람도 떠난다'],
  ['E-05', '먼저 떠난 사람', 'D20에서 T≥45로 조기 망명을 수락한다'],
  ['A1', '모범 심사관', '최종 A(봉인), M≤5, 평정≥80'],
  ['A2', '이름 없는 도장', '최종 A(봉인), M≤5, 평정<80'],
  ['A3', '0과 1 사이', '최종 A(봉인), 6≤M≤15'],
  ['A4', '두 개의 장부', '최종 A(봉인), M≥16'],
  ['B1', '새벽의 사전 (진 엔딩)', '최종 B(개방), S<70, T≥70, M≥20'],
  ['B2', '절반의 봄', '최종 B(개방), S<70, T≥70, M<20'],
  ['B3', '조용한 저항', '최종 B(개방), S<70, 40≤T<70'],
  ['B4', '미끼였던 사전', '최종 B(개방), S<70, T<40'],
  ['B5', '마지막 도장', '최종 B(개방), S≥70'],
  ['C1', '국경 너머의 편지', '최종 C(떠남), S<70, 온 가족 생존·동거'],
  ['C2', '둘이서 떠나다', '최종 C(떠남), S<70, 서연 사망 또는 가족 떠남'],
  ['C3', '반대편 창구', '최종 C(떠남), S≥70'],
  ['D1', 'NULL의 질문 (숨은 엔딩)', '최종 D(고쳐 쓰기), S<70, Q≥85, M+E≥30'],
  ['D2', '번역된 사랑', '최종 D(고쳐 쓰기), S<70, Q≥85, M+E<30'],
  ['D3', '들킨 은유', '최종 D(고쳐 쓰기), S≥70 또는 Q<85']
]);

export const TIMELINE_BRANCHES = Object.freeze([
  { day: 3,  tag: 'D3 · 딜레마 #1', title: '하준 엄마의 마지막 편지' },
  { day: 5,  tag: 'D5 · 딜레마 #2', title: '노을의 가사 · 감정어' },
  { day: 9,  tag: 'D9 · 딜레마 #3', title: '두더지의 뇌물 · 감찰관' },
  { day: 11, tag: 'D11 · 딜레마 #4', title: '모리의 제안 · 위조 허가증' },
  { day: 15, tag: 'D15 · 딜레마 #5', title: '감찰관의 미끼 화물' },
  { day: 19, tag: 'D19 · 딜레마 #7', title: '국장 문태오의 편지' },
  { day: 21, tag: 'D21 · 딜레마 #9', title: '박 주임 체포 · 증언' },
  { day: 25, tag: 'D25 · 딜레마 #10', title: 'NULL의 거래' },
  { day: 26, tag: 'D26 · 딜레마 #11', title: '가족 탈출증' },
  { day: 30, tag: 'D30 · 최종 선택', title: '마지막 화물 「사전」' }
]);

export const METER_SPECS = Object.freeze({
  1: { fastCost: 10, fineCost: 20, fastErr: 6, fineErr: 3, quota: 6, delayMs: 950 },
  2: { fastCost: 8, fineCost: 15, fastErr: 4, fineErr: 2, quota: 8, delayMs: 550 },
  3: { fastCost: 6, fineCost: 12, fastErr: 2, fineErr: 1, quota: 10, delayMs: 280 }
});

export const GENERIC_GREETING_ALTS = Object.freeze({
  '편지 한 통 부치려고요.': [
    '편지 한 통 부치려고요. 날씨가 많이 차네요.',
    '손으로 꾹꾹 눌러 쓴 편지예요. 잘 부탁드립니다.',
    '이번 달 우편이 유독 오래 걸린다던데… 빨리 봐주실 수 있나요?',
    '멀리 있는 친척한테 부치는 편지 한 통입니다.'
  ],
  '친구한테 보내는 엽서예요.': [
    '오랜만에 친구한테 보내는 엽서예요.',
    '친구 생일이 다가와서 짧은 엽서 한 장 부칩니다.',
    '요즘 다들 연락이 뜸해서 엽서라도 띄워 보려고요.'
  ],
  '그냥 메모 한 장이에요.': [
    '별 내용 없는 짧은 메모 한 장이에요.',
    '옆 구역에 전할 간단한 메모입니다. 금방 보실 거예요.',
    '물건 맡겨 둔 거 찾으라고 적어 둔 쪽지예요.'
  ],
  '공지문입니다. 빨리 부탁드려요.': [
    '주민 자치회 공지문입니다. 게시 시간이 빠듯해서요.',
    '동네 게시판에 붙일 인쇄 공지문입니다. 빠르게 부탁드려요.',
    '반상회 일정 안내문입니다. 표준어 검수 마쳤습니다.'
  ],
  '쪽지 하나 전하려고요.': [
    '퇴근길에 들렀어요. 쪽지 하나만 전해 주세요.',
    '말로 전하기 애매해서 짧은 쪽지로 적었습니다.',
    '작은 메모지 한 장인데 문제없겠죠?'
  ],
  '안내문 배포 건입니다.': [
    '구역 관리소 안내문 배포 건입니다. 확인 부탁합니다.',
    '오늘 저녁까지 돌려야 하는 안내문입니다.',
    '정기 점검 안내문 인쇄본입니다. 이상 없을 겁니다.'
  ],
  '짧은 엽서예요. 금방 보실 거예요.': [
    '두 줄짜리 엽서예요. 금방 훑어보실 수 있을 거예요.',
    '안부만 간단히 적었습니다. 검열 걸릴 말은 뺐어요.',
    '그림 엽서 한 장입니다. 빨리 부탁드릴게요.'
  ],
  '가족한테 보내는 편지입니다.': [
    '집에 보내는 안부 편지입니다. 조심해서 썼어요.',
    '가족한테 보내는 편지예요. 제발 무사히 갔으면 좋겠네요.',
    '식구들이 걱정할까 봐 소식 전하는 편지입니다.'
  ],
  '이거 오늘 꼭 나가야 해요.': [
    '급한 건이라 오늘 마감 전엔 꼭 나가야 해요.',
    '오늘 우편차를 놓치면 일주일을 기다려야 합니다. 부탁해요.',
    '시간이 없어요. 이거 오늘 꼭 통과시켜 주세요.'
  ],
  '가게 영수증이에요.': [
    '장부 정산용 가게 영수증이에요. 금방 끝날 겁니다.',
    '시장 상인회 정산 영수증입니다. 숫자만 적혀 있어요.',
    '납품 확인 영수증이에요. 문제될 말은 없을 겁니다.'
  ]
});

export function getMeterSpec(lv) {
  return METER_SPECS[lv >= 3 ? 3 : (lv === 2 ? 2 : 1)];
}
