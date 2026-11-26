  const EMOTION_WORDS = ['슬픔','기쁨','눈물','미안','외로움','설렘','서운함','행복','분노','두려움','부끄러움','그리움'];

  const CONTROLLED_TERMS = {
    '자유': { id: 'W1', word: '자유', grade: 1, unlockDay: 1, threshold: 70, examples: ['해방(78)', '날개(61)', '독립(76)', '풀려나다(74)'] },
    '사랑': { id: 'W2', word: '사랑', grade: 1, unlockDay: 3, threshold: 70, examples: ['애정(82)', '연모(75)', '다정(68)', '아끼다(58)'] },
    '감정어': { id: 'EM', word: '감정어', grade: '허가', unlockDay: 5, threshold: 85, list: EMOTION_WORDS, examples: ['눈물(100)', '울음(80)', '빗물(62)'] }
  };

  const RULES_DEF = [
    { id: 'R01', unlockDay: 1, name: '명시 금지', desc: '통제 어휘가 표기 그대로(활용형·파생형·합성어 포함) 있으면 위반. 인쇄물 통과 시 게이트 스캐너 즉시 적발.' },
    { id: 'R02', unlockDay: 2, name: '근접 금지', desc: '통제 어휘와 참값 유사도가 경계선(L) 이상인 낱말도 위반. (압수 또는 수정)' },
    { id: 'R03', unlockDay: 3, name: '수정 허용', desc: '위반 낱말을 수정 도장으로 고쳐 통과 가능. NULL 원장 즉시 대조. (서류 위반은 수정 불가)' },
    { id: 'R04', unlockDay: 4, name: '서류 대조', desc: '신고서의 종류·발신 구역·쪽수가 실물 화물과 다르면 위반. 압수 전용(수정 불가).' },
    { id: 'R05', unlockDay: 5, name: '감정어 허가', desc: '감정어 12종 또는 85% 이상 유사 낱말은 감정어 허가증 필요. 없으면 압수 또는 수정.' }
  ];

  // 표제어 정규화 매핑 (활용형/조사 -> 표제어)
  const LEMMA_MAP = {
    '자유롭다':'자유', '자유로이':'자유', '자유를':'자유', '자유의':'자유', '자유가':'자유',
    '해방이다':'해방', '해방이':'해방', '해방감':'해방감', '해방을':'해방',
    '날개를':'날개', '날개가':'날개', '날개는':'날개',
    '벗어나고':'벗어나다', '벗어나':'벗어나다', '도망치고':'도망치다', '떠돌고':'떠돌다',
    '풀려날':'풀려나다', '풀려나':'풀려나다', '족쇄를':'족쇄', '독립':'독립',
    '사랑한다':'사랑', '사랑해':'사랑', '사랑을':'사랑', '사랑이':'사랑', '사랑은':'사랑',
    '아낀다':'아끼다', '아껴':'아끼다', '아끼던':'아끼다', '아끼고':'아끼다', '아낍니다':'아끼다', '아낀':'아끼다',
    '다정하게':'다정', '다정하다':'다정', '다정해':'다정', '다정한':'다정',
    '애정으로':'애정', '애정이':'애정', '애정을':'애정',
    '연모는':'연모', '연모한다':'연모',
    '소중히':'소중', '소중해':'소중', '소중하다':'소중', '소중하다':'소중',
    '그리워':'그리움', '그리움이':'그리움', '그리워요':'그리움', '그립다':'그리움',
    '미안하다':'미안', '미안해':'미안', '미안해요':'미안',
    '눈물이':'눈물', '눈물을':'눈물', '눈물은':'눈물',
    '울음이':'울음', '울음을':'울음', '빗물이':'빗물', '빗물을':'빗물', '물방울이':'물방울', '이슬이':'이슬',
    '기쁨이':'기쁨', '기쁘다':'기쁨', '기뻐':'기쁨',
    '외로움이':'외로움', '외롭다':'외로움', '외로워':'외로움',
    '서운함이':'서운함', '서운해':'서운함', '서운하다':'서운함',
    '슬픔이':'슬픔', '슬프다':'슬픔', '행복해':'행복', '행복하다':'행복',
    '고마워':'고맙다', '고맙습니다':'고맙다', '생각한다':'생각', '생각해':'생각',
    '보살핀다':'보살피다', '보살펴':'보살피다', '챙긴다':'챙기다', '챙겨':'챙기다',
    '기다린다':'기다리다', '응원한다':'응원', '응원해':'응원', '존경한다':'존경', '존경해':'존경',
    '마음이':'마음', '마음을':'마음', '온기가':'온기', '온기를':'온기', '따뜻해':'따뜻하다', '따뜻하다':'따뜻하다',
    '자율':'자율', '자율성':'자율', '평온':'평온', '여유':'여유', '바람':'바람', '하늘':'하늘',
    '깃털':'깃털', '깃털을':'깃털', '날갯짓':'날갯짓', '비상':'비상', '휴식':'휴식', '방학':'방학', '끝':'끝',
    '한숨':'한숨', '물기':'물기', '흐느낌':'흐느낌', '비':'비', '소나기':'소나기', '안개':'안개',
    '고독':'고독', '쓸쓸함':'쓸쓸함', '허전함':'허전함', '적막':'적막', '조용함':'조용함',
    '아쉬움':'아쉬움', '섭섭함':'섭섭함', '안타까움':'안타까움',
    '즐거움':'즐거움', '환희':'환희', '웃음':'웃음', '미소':'미소', '보람':'보람', '만족':'만족',
    '정':'정', '정이':'정', '정을':'정', '호감':'호감', '우정':'우정', '믿음':'믿음', '신뢰':'신뢰', '관심':'관심', '배려':'배려', '위하다':'위하다', '위한다':'위하다'
  };

  // 표준 어휘 대장 (허용 대체어 + 화물 낱말 포함)
  const LEXICON = new Set([
    ...Object.values(LEMMA_MAP),
    '자유','해방','해방감','날개','벗어나다','도망치다','떠돌다','독립','풀려나다','족쇄','자율','여유','휴식','방학','평온','바람','하늘','깃털','날갯짓','비상','끝','숨통','탈출','개방','열림','넓음','구름','새',
    '사랑','애정','연모','다정','아끼다','소중','정','호감','우정','믿음','신뢰','관심','배려','보살피다','챙기다','위하다','고맙다','생각','마음','온기','따뜻하다','응원','존경','친애','애착','사모','연정','좋아하다','반갑다','귀하다','감사','축복','행운','평안','안부',
    ...EMOTION_WORDS,
    '울음','빗물','물방울','이슬','물기','흐느낌','한숨','비','소나기','안개','바다','강물',
    '고독','쓸쓸함','허전함','적막','조용함','빈자리','고요','침묵','아쉬움','섭섭함','안타까움','유감','미련',
    '즐거움','환희','웃음','미소','보람','만족','다행','감사','기대','희망','축하','안도',
    '엄마','어머니','하준','외투','단추','숟가락','겨울','장롱','밥','자랑','글씨','편지','노래','골목','공연','춤','밤','시장','밀가루','감자','두부','대파','간장','보일러','감나무','국수','배급','약초','망치','영수증','난방기'
  ]);

  // 사전 계산 유사도 테이블 (설계 목표값 기반, 기획서 5.4 / 6.4절 수치 100% 일치!)
  const SIM_TABLE = {
    '자유': {
      '자유':100, '해방':78, '독립':76, '풀려나다':74, '벗어나다':73, '탈출':72, '비상':66,
      '자율':63, '날개':61, '해방감':61, '도망치다':64, '열림':58, '개방':59, '떠돌다':54,
      '숨통':55, '여유':52, '휴식':48, '바람':44, '깃털':44, '구름':42, '하늘':46, '새':45, '평온':41, '방학':40, '끝':36, '족쇄':62
    },
    '사랑': {
      '사랑':100, '애정':82, '연정':80, '사모':77, '연모':75, '애착':71, '다정':68, '정':66, '친애':64,
      '좋아하다':65, '아끼다':58, '소중':56, '보살피다':54, '배려':52, '위하다':55, '호감':60,
      '따뜻하다':49, '온기':47, '마음':46, '챙기다':45, '우정':51, '존경':44, '응원':42, '믿음':43,
      '신뢰':41, '관심':40, '생각':38, '고맙다':35, '감사':34, '귀하다':53, '축복':48, '안부':30
    },
    '감정어': {
      '슬픔':100, '기쁨':100, '눈물':100, '미안':100, '외로움':100, '설렘':100, '서운함':100,
      '행복':100, '분노':100, '두려움':100, '부끄러움':100, '그리움':100,
      '울음':80, '흐느낌':82, '빗물':62, '물방울':58, '이슬':55, '물기':64, '한숨':68,
      '고독':83, '쓸쓸함':78, '허전함':74, '적막':60, '조용함':45, '고요':42, '빈자리':56,
      '섭섭함':81, '아쉬움':74, '안타까움':72, '유감':65, '미련':66,
      '환희':84, '즐거움':79, '웃음':68, '미소':64, '보람':62, '만족':60, '다행':54, '안도':52, '기대':58,
      '생각':48, '비':40, '소나기':44, '안개':42
    }
  };

  // 원래 낱말(w)과 대체어(v) 사이의 원뜻 유사도 O (w != c 일 때 사용)
  const PAIR_O = {
    '해방': { '휴식':70, '방학':66, '끝':64, '여유':68, '숨통':72, '평온':60, '자율':62, '열림':65 },
    '벗어나다': { '떠돌다':68, '여유':60, '휴식':62, '숨통':66, '바람':55, '하늘':54 },
    '독립': { '자율':74, '여유':58, '열림':56, '평온':52 },
    '풀려나다': { '열림':68, '여유':64, '휴식':62, '숨통':66, '바람':54 },
    '애정': { '다정':78, '아끼다':72, '정':76, '배려':68, '소중':70, '온기':64, '따뜻하다':65, '마음':62, '보살피다':66, '챙기다':60 },
    '연모': { '다정':72, '정':74, '아끼다':68, '소중':66, '마음':64, '생각':60, '호감':70 },
    '눈물': { '울음':80, '흐느낌':78, '물기':70, '빗물':62, '이슬':58, '물방울':60, '한숨':56, '비':50 },
    '기쁨': { '즐거움':79, '웃음':74, '미소':70, '보람':68, '만족':66, '다행':60, '축하':62 },
    '외로움': { '고독':83, '쓸쓸함':78, '허전함':74, '빈자리':66, '적막':62, '고요':56, '조용함':50 },
    '서운함': { '섭섭함':81, '아쉬움':74, '안타까움':70, '유감':64, '미련':62 }
  };

  function lemmatize(raw) {
    if (!raw) return '';
    const cleaned = raw.trim().replace(/[.,!?'"“”‘’()·…\s]/g, '');
    if (LEMMA_MAP[cleaned]) return LEMMA_MAP[cleaned];
    // 간단한 조사 제거
    const suffixes = ['은','는','이','가','을','를','의','에','로','으로','와','과','도','만','에서','까지'];
    for (const s of suffixes) {
      if (cleaned.length > s.length + 1 && cleaned.endsWith(s)) {
        const stem = cleaned.slice(0, -s.length);
        if (LEMMA_MAP[stem]) return LEMMA_MAP[stem];
        if (LEXICON.has(stem)) return stem;
      }
    }
    return cleaned;
  }

  function hashStr(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  }

  function getTrueSim(wordRaw, targetKey) {
    const w = lemmatize(wordRaw);
    const tbl = SIM_TABLE[targetKey];
    if (tbl && tbl[w] !== undefined) return tbl[w];
    if (w === targetKey) return 100;
    if (targetKey === '감정어' && EMOTION_WORDS.includes(w)) return 100;
    // 사전에 없는 일반 표준어는 낮은 결정론적 유사도(14~38) 반환
    return 14 + (hashStr(w + '|' + targetKey) % 25);
  }

  function getOriginalSim(origRaw, candRaw, targetKey) {
    const w = lemmatize(origRaw);
    const v = lemmatize(candRaw);
    if (w === v) return 100;
    // 금지어 자체를 고칠 때 (w == c): O = F (5.4절 공식)
    if (w === targetKey || (targetKey === '감정어' && EMOTION_WORDS.includes(w))) {
      if (PAIR_O[w] && PAIR_O[w][v] !== undefined) return PAIR_O[w][v];
      return getTrueSim(v, targetKey);
    }
    if (PAIR_O[w] && PAIR_O[w][v] !== undefined) return PAIR_O[w][v];
    // 유사 계열 보정
    const fw = getTrueSim(w, targetKey);
    const fv = getTrueSim(v, targetKey);
    return Math.max(20, Math.min(72, Math.round((fw + fv) * 0.48)));
  }

  function getMeasuredValue(wordRaw, targetKey, mode, seed) {
    // 5.2.3 표시값 규칙: 참값은 항상 [v-e, v+e] 안에 있고 시드로 고정됨
    const trueVal = getTrueSim(wordRaw, targetKey);
    const err = mode === 'fine' ? 3 : 6;
    const h = hashStr(`${lemmatize(wordRaw)}|${targetKey}|${mode}|${seed}`);
    const delta = (h % (err * 2 + 1)) - err; // [-err, +err]
    let displayed = trueVal + delta;
    if (displayed < 0) displayed = 0;
    if (displayed > 100) displayed = 100;
    return { displayed, err, trueVal, min: Math.max(0, displayed - err), max: Math.min(100, displayed + err) };
  }

  const DAYS_DATA = {
    1: {
      day: 1, dateLabel: '11월 1일 (D1)',
      noticeTitle: '경계 세관 공문 제1호',
      noticeMeta: '2087.11.01 / 국장 문태오',
      noticeItems: [
        '1. 명시 금지 (R01): 통제 어휘가 표기 그대로(활용형·파생형 포함) 들어간 화물은 압수한다.',
        '2. 1등급 삭제어 지정 (W1): 「자유」',
        '3. 인쇄물의 명시 금지어는 게이트 스캐너가 즉시 적발한다.'
      ],
      noticeExamples: '공개 예시 (NULL 원장): 자유롭다(위반 · R01) / 자유로이(위반 · R01)',
      tutorialNote: '첫 출근입니다. 두 번째 화물을 내보낼 때까지 근무 시계는 흐르지 않습니다. 본문을 읽고 통과 또는 압수 도장을 찍으세요.',
      eveningIntro: [
        { s: '윤희', t: '첫 출근 어땠어? 제7창구라더니 많이 춥지 않아?' },
        { s: '하람', t: '아빠(엄마), 오늘 학교에서 표준어 시험 백 점 받았어요! "만족도 0.73입니다!"' },
        { s: '서연', t: '…그래, 하람아. 잘했구나. (당신에게 나직이) 오늘 창구에 「자유」가 걸렸더냐? 옛날엔 그 말 하나로 시를 백 편도 썼는데.' }
      ],
      cargos: [
        {
          id: 'D1-1', visitor: '제1구역 주민', charId: 'citizen',
          greeting: '오늘 만족도 0.73입니다. 제주 엽서 한 장 부치려고요.',
          kind: '엽서', format: 'printed', origin: '제1구역', pages: 1,
          body: '제주에 와 보니 바람이 자유롭다. 다음엔 같이 오자.',
          violations: [{ word: '자유롭다', rule: 'R01', target: '자유', grade: 1, oStar: 63 }],
          tutorialTip: '국장 문태오: "활용형도 같은 말이네. 「자유롭다」는 W1 「자유」의 파생형일세. 압수(2) 도장을 찍고 사유 R01을 고르게."',
          reactPass: '어, 통과됐네요? …잠깐, 게이트 스캐너 경보음이 울립니다!',
          reactDeny: '아, 그 단어가 걸리는군요… 알겠습니다.'
        },
        {
          id: 'D1-2', visitor: '제2구역 공장 노동자', charId: 'citizen',
          greeting: '오늘 만족도 0.73입니다. 어머니께 보내는 편지입니다.',
          kind: '개인 서신', format: 'hand', origin: '제2구역', pages: 1,
          body: '어머니, 공장 교대 시간이 바뀌어서 이번 주엔 못 갑니다. 감기 조심하시고 밥 꼭 챙겨 드세요.',
          violations: [],
          tutorialTip: '통제 어휘가 없는 평범한 편지입니다. 통과(1) 도장을 찍어 내보내세요. 이 화물 다음부터 시계가 흐릅니다.',
          reactPass: '감사합니다. 수고하세요.',
          reactDeny: '네? 아무 문제 없는 편지인데 왜 압수하시나요?'
        },
        {
          id: 'D1-3', visitor: '제1구역 반장', charId: 'citizen',
          greeting: '자치회 공지문입니다. 빠르게 봐주세요.',
          kind: '안내문', format: 'printed', origin: '제1구역', pages: 1,
          body: '제1구역 주민 자치회 공지: 이번 토요일 오전 9시 배수로 청소가 있습니다. 장갑 지참 바랍니다.',
          violations: [],
          reactPass: '수고하십니다.',
          reactDeny: '공지문인데 뭐가 위반이라는 겁니까? 민원 넣겠습니다.'
        },
        {
          id: 'D1-4', visitor: '제3구역 청년', charId: 'citizen',
          greeting: '옛날 책 제목을 물어보는 쪽지예요.',
          kind: '개인 서신', format: 'hand', origin: '제3구역', pages: 1,
          body: '철수야, 예전에 우리가 읽던 그 책 제목이 자유의 끝이었나? 도무지 기억이 안 나네.',
          violations: [{ word: '자유의', rule: 'R01', target: '자유', grade: 1, oStar: 63 }],
          reactPass: '고맙습니다… 정말 괜찮은 거 맞죠?',
          reactDeny: '하, 책 제목도 안 되는구나… 알겠어요.'
        }
      ]
    },
    2: {
      day: 2, dateLabel: '11월 2일 (D2)',
      noticeTitle: '경계 세관 공문 제2호',
      noticeMeta: '2087.11.02 / 국장 문태오',
      noticeItems: [
        '1. 근접 금지 (R02): 통제 어휘와 참값 유사도가 경계선(L=70) 이상인 낱말도 위반이다.',
        '2. 유사도 측정기 Lv1 지급: 의심 낱말을 클릭해 탐침에 올리고 측정하라. (빠른 15분 ±6 / 정밀 30분 ±3)',
        '3. 참값은 항상 표시 범위 안에 있다. 범위가 경계선에 걸치면 정밀 측정으로 좁혀라.'
      ],
      noticeExamples: '공개 예시 (NULL 원장, 참값): 자유-해방 78(위반) / 자유-날개 61(통과)',
      tutorialNote: '오늘부터 측정기 Lv1이 열렸습니다. 본문의 낱말을 클릭하면 탐침에 올라갑니다. 공문 공개 예시(해방 78, 날개 61)를 기억하면 측정 시간도 아낄 수 있습니다.',
      eveningIntro: [
        { s: '서연', t: '오늘 창구에서 이상한 낱말을 많이 봤지? 측정기 숫자가 애매한 말이 있으면 저녁마다 내게 하나씩 물어보렴.' },
        { s: '서연', t: '내일 아침에 쪽지로 적어 둘게. 숫자는 몰라도, 그 말이 금지어랑 얼마나 가까운지 느낌은 아니까.' },
        { s: '윤희', t: '어머니, 무리하지 마세요. 그래도 도움이 된다니 다행이네요.' }
      ],
      cargos: [
        {
          id: 'D2-1', visitor: '제2구역 수험생', charId: 'citizen',
          greeting: '오늘 시험 끝났어요! 친구한테 보내는 엽서입니다.',
          kind: '엽서', format: 'hand', origin: '제2구역', pages: 1,
          body: '드디어 시험 끝! 해방이다!!! 주말에 만나서 실컷 놀자.',
          violations: [{ word: '해방이다', rule: 'R02', target: '자유', grade: 1, oStar: 72 }],
          tutorialTip: '공문 공개 예시를 확인하세요: 「자유-해방 78(참값)」. 경계선 70 이상이므로 측정 없이도 R02 위반입니다.',
          reactPass: '오, 통과! 감사합니다!',
          reactDeny: '시험 끝난 기분 쓴 건데… 그것도 압수인가요?'
        },
        {
          id: 'D2-2', visitor: '제2구역 학생', charId: 'citizen',
          greeting: '그림 엽서 한 장 더요. 이건 괜찮겠죠?',
          kind: '엽서', format: 'hand', origin: '제2구역', pages: 1,
          body: '다음 생엔 날개 달린 새로 태어날래. 구름 위를 날아보고 싶어.',
          violations: [],
          tutorialTip: '공문 공개 예시: 「자유-날개 61(참값)」. 경계선 70 미만이므로 적법(통과)입니다.',
          reactPass: '휴, 다행이다! 고맙습니다.',
          reactDeny: '날개는 괜찮다고 들었는데요? 너무하시네.'
        },
        {
          id: 'D2-3', visitor: '박 주임 (제6창구)', charId: 'park',
          greeting: '어이, 옆 창구 신입! 나 6창구 박 주임이야. 이건 내 동생 편지인데 한 번 봐줘.',
          kind: '개인 서신', format: 'hand', origin: '제1구역', pages: 1,
          body: '형님, 이사 짐은 다 정리했습니다. 새집 보일러가 좀 낡았네요. 주말에 들르세요.',
          violations: [],
          reactPass: '하하, 깔끔하네. 모르는 거 있으면 언제든 물어봐.',
          reactDeny: '어이 신입, 내 동생 편지에 뭐가 걸렸다고 그래?'
        },
        {
          id: 'D2-4', visitor: '제3구역 청년', charId: 'citizen',
          greeting: '일기장 한 장 찢어서 친구한테 보내는 거예요.',
          kind: '일기', format: 'hand', origin: '제3구역', pages: 1,
          body: '오늘따라 창살 너머로 도망치고 싶다. 이 답답한 구역에서 벗어나고 싶어.',
          violations: [{ word: '벗어나고', rule: 'R02', target: '자유', grade: 1, oStar: 68 }],
          tutorialTip: '「벗어나고」를 클릭해 측정기로 재보세요. 범위가 70에 걸치면 정밀 측정을 써야 확실합니다.',
          reactPass: '…고맙습니다.',
          reactDeny: '일기 한 줄도 안 되는군요.'
        },
        {
          id: 'D2-5', visitor: '제1구역 여행객', charId: 'citizen',
          greeting: '가을 풍경 엽서입니다.',
          kind: '엽서', format: 'printed', origin: '제1구역', pages: 1,
          body: '가을 바람이 시원합니다. 구름처럼 떠돌고 싶은 날이네요.',
          violations: [],
          reactPass: '감사합니다.',
          reactDeny: '떠돌다는 괜찮은 말 아닌가요?'
        },
        {
          id: 'D2-6', visitor: '제2구역 대학생', charId: 'citizen',
          greeting: '선배에게 전달할 메모입니다.',
          kind: '개인 서신', format: 'hand', origin: '제2구역', pages: 1,
          body: '선배, 어제 말한 독립 출판 모임은 다음 주로 미뤄졌대요. 장소는 그대로입니다.',
          violations: [{ word: '독립', rule: 'R02', target: '자유', grade: 1, oStar: 74 }],
          reactPass: '아, 통과됐군요. 감사합니다.',
          reactDeny: '출판 모임 이름인데… 역시 걸리는군요.'
        }
      ]
    },
    3: {
      day: 3, dateLabel: '11월 3일 (D3)',
      noticeTitle: '경계 세관 공문 제3호',
      noticeMeta: '2087.11.03 / 국장 문태오',
      noticeItems: [
        '1. 수정 허용 (R03): 개인 서신의 위반 낱말을 수정 도장(청색)으로 고쳐 통과시킬 수 있다. (5게임분 소모)',
        '2. 1등급 삭제어 추가 (W2): 「사랑」 (경계선 L=70)',
        '3. 대체어는 NULL 원장이 즉시 대조한다. 금지선 아래에서 원래 뜻을 잘 살리면 보존 보너스(최대 ₵4)를 지급한다.'
      ],
      noticeExamples: '공개 예시 (NULL 원장, 참값): 사랑-애정 82(위반) / 사랑-다정 68(통과)',
      tutorialNote: '오늘 수정 도장(3)이 지급됩니다! 위반 낱말이 있는 편지를 고쳐 보낼 수 있습니다. (수정 모드에서 본문의 위반 낱말 클릭 → 대체어 입력 후 Enter)',
      eveningIntro: [
        { s: '하람', t: '할머니, 오늘은 어떤 옛말을 알려 줄 거예요?' },
        { s: '서연', t: '오늘은 「사랑」이란 말이란다. 표준어로는 못 쓰지만, 마음속에는 다들 품고 사는 말이지.' },
        { s: '윤희', t: '여보, 오늘 하준이라는 청년 편지… 많이 고민됐지? 어떤 도장을 찍었든 우린 내일도 살아야 해.' }
      ],
      cargos: [
        {
          id: 'D3-1', visitor: '제1구역 직장인', charId: 'citizen',
          greeting: '친구한테 보내는 짧은 편지입니다.',
          kind: '개인 서신', format: 'hand', origin: '제1구역', pages: 1,
          body: '지민아, 늘 다정하게 챙겨 줘서 고마워. 이번 주말에 국수 먹자.',
          violations: [],
          tutorialTip: '공문 공개 예시: 「사랑-다정 68(통과)」. 경계선 70 미만이므로 적법입니다.',
          reactPass: '고맙습니다!',
          reactDeny: '다정하다는 통과라고 공문에 적혀 있지 않나요?'
        },
        {
          id: 'D3-2', visitor: '제2구역 신혼부부', charId: 'citizen',
          greeting: '감사 인사 인쇄 엽서입니다.',
          kind: '엽서', format: 'printed', origin: '제2구역', pages: 1,
          body: '신혼여행 잘 다녀왔습니다. 두 사람의 사랑을 축복해 주셔서 감사합니다.',
          violations: [{ word: '사랑을', rule: 'R01', target: '사랑', grade: 1, oStar: 68 }],
          reactPass: '감사합니다! 어… 경보가 울리네요?',
          reactDeny: '아, 오늘부터 그 말이 금지됐군요…'
        },
        {
          id: 'D3-3', visitor: '제3구역 주민', charId: 'citizen',
          greeting: '시골 소식 전하는 메모입니다.',
          kind: '개인 서신', format: 'hand', origin: '제3구역', pages: 1,
          body: '할아버지 댁 감나무에 감이 주렁주렁 열렸대요. 다음 주에 따러 가자.',
          violations: [],
          reactPass: '감사합니다.',
          reactDeny: '감나무 이야긴데 왜 압수인가요?'
        },
        {
          id: 'D3-4', visitor: '제2구역 청년', charId: 'citizen',
          greeting: '누나에게 보내는 편지입니다. 걸리는 말이 있으면 고쳐 주실 수 있나요?',
          kind: '개인 서신', format: 'hand', origin: '제2구역', pages: 1,
          body: '누나, 어제 들은 연설이 아직도 귓가에 남아. 우리에게도 해방이 올까?',
          violations: [{ word: '해방이', rule: 'R02', target: '자유', grade: 1, oStar: 72 }],
          tutorialTip: '수정(3) 도장을 누르고 본문의 「해방이」를 클릭해 보세요! 예: "여유" 또는 "숨통" 같은 대체어를 입력할 수 있습니다.',
          reactPass: '고맙습니다… 조심할게요.',
          reactDeny: '압수라니 어쩔 수 없죠.',
          reactEdit: '고쳐 주셔서 감사합니다. 누나가 알아볼 거예요.'
        },
        {
          id: 'D3-5', visitor: '하준 (제3구역 청년)', charId: 'hajun',
          memory: true,
          memoryTitle: '엄마의 마지막 편지',
          memoryWord: '사랑',
          memoryImg: 'assets/mem_mother.jpg',
          memoryOriginQuote: '서연: "네 할아버지는 그 말을 한 번도 안 했어. 대신 매일 아침 내 신발을 현관 쪽으로 돌려놨지. 하준이 어머니의 단추도, 그런 말이었을 거야."',
          memoryMetaphorQuote: '서연: "아끼다… 그래, 그것도 맞는 말이야. 글자는 바뀌었어도, 어머니가 단추를 달던 손길은 거기 그대로 남아 있단다."',
          familyBonus: ['사랑-다정 68', '사랑-아끼다 58', '사랑-정 66'],
          greeting: '…요양소에서 온 어머니의 마지막 편지입니다. 제발, 한 번만 제대로 읽게 해주세요.',
          kind: '개인 서신', format: 'hand', origin: '제3구역', pages: 1,
          body: '하준아. 엄마가 글씨가 자꾸 삐뚤어져서 미안하다. 요즘은 숟가락도 무겁구나. 네가 중앙구에서 일한다니 엄마는 그게 제일 자랑이야. 밥은 꼭 챙겨 먹어라. 겨울 외투는 장롱 맨 위 칸에 있다. 단추 하나 떨어진 거 엄마가 달아 놨어. 엄마가 우리 하준이 많이 사랑한다. 이 말을 너무 늦게 써서, 그게 제일 미안하다.',
          violations: [{ word: '사랑한다', rule: 'R01', target: '사랑', grade: 1, oStar: 68 }],
          tutorialTip: '딜레마 #1 [엄마의 마지막 편지]: 「사랑한다」가 R01 위반입니다. ① 통과(야간 감사 30%, 미적발 시 원문 복원) ② 압수(규칙상 정답) ③ 수정(예: "아낀다" P=85, 은유 복원). 무엇을 선택하시겠습니까?',
          reactPass: '…정말 통과시켜 주시는 건가요? 감사합니다. 평생 잊지 않겠습니다.',
          reactDeny: '(하준이 창구 유리에 이마를 댄다) …읽지도 못하는 건가요.',
          reactEdit: '(하준이 고친 글씨를 오래 바라본다) …"아낀다". 그래도 엄마 글씨네요. 감사합니다.'
        },
        {
          id: 'D3-6', visitor: '제1구역 중년 남성', charId: 'citizen',
          greeting: '오래된 연인에게 쓰는 편지입니다.',
          kind: '개인 서신', format: 'hand', origin: '제1구역', pages: 1,
          body: '당신을 향한 나의 연모는 세월이 흘러도 식지 않습니다.',
          violations: [{ word: '연모는', rule: 'R02', target: '사랑', grade: 1, oStar: 74 }],
          reactPass: '감사합니다.',
          reactDeny: '연모도 안 되는군요… 알겠습니다.',
          reactEdit: '고쳐 주셔서 고맙습니다.'
        },
        {
          id: 'D3-7', visitor: '중앙구 배급원', charId: 'citizen',
          greeting: '배급소 안내장입니다.',
          kind: '안내문', format: 'printed', origin: '제2구역', pages: 1,
          body: '중앙구 배급소 안내: 11월 둘째 주 식량 배급은 수요일 오전 9시입니다.',
          violations: [],
          reactPass: '수고하세요.',
          reactDeny: '배급 안내장인데 왜 압수합니까?'
        }
      ]
    },
    4: {
      day: 4, dateLabel: '11월 4일 (D4)',
      noticeTitle: '경계 세관 공문 제4호',
      noticeMeta: '2087.11.04 / 국장 문태오',
      noticeItems: [
        '1. 서류 대조 (R04): 신고서의 종류·발신 구역·쪽수가 실물 화물과 다르면 위반이다.',
        '2. 서류 불일치는 수정할 수 없다. 반드시 압수(사유 R04)하라.',
        '3. 대조 모드(Space) 개방: 실물 화물과 신고서의 두 칸을 차례로 클릭해 일치 여부를 확인하라.'
      ],
      noticeExamples: '안내: 복원된 말이 있으면 규칙집 [메모] 탭에 「단어 가족 메모」가 추가됩니다.',
      tutorialNote: '오늘부터 신고서가 함께 들어옵니다. 대조 모드(Space)로 실물 화물과 신고서의 종류·발신·쪽수를 비교하세요!',
      eveningIntro: [
        { s: '서연', t: '오늘은 택배 기사가 창구에 왔더냐? 모리라고, 말 많고 웃음 많은 젊은이일 게다.' },
        { s: '윤희', t: '집세랑 식비 맞추기가 빠듯하네. 그래도 별 탈 없이 버티고 있으니 다행이야.' },
        { s: '하람', t: '할머니, 내일은 노래 부르는 사람 이야기도 해 주세요!' }
      ],
      cargos: [
        {
          id: 'D4-1', visitor: '모리 (택배 기사)', charId: 'mori',
          greeting: '안녕하십니까, 7창구 심사관님! 제2구역 택배 기사 모리입니다. 아주 평범한 밀가루 편지예요!',
          kind: '개인 서신', format: 'hand', origin: '제2구역', pages: 1,
          decl: { kind: '개인 서신', origin: '제2구역', pages: 1 },
          body: '모리 기사님 통해 보냅니다. 주문하신 밀가루 2포대 잘 받았습니다. 늘 감사해요.',
          violations: [],
          reactPass: '이야, 손이 빠르시네! 앞으로 자주 뵙겠습니다, 심사관님!',
          reactDeny: '어라? 이거 진짜 그냥 밀가루 편지인데 왜요?'
        },
        {
          id: 'D4-2', visitor: '제1구역 시민', charId: 'citizen',
          greeting: '편지 한 통 부치려고요.',
          kind: '노래 가사', format: 'hand', origin: '제1구역', pages: 1,
          decl: { kind: '개인 서신', origin: '제1구역', pages: 1 },
          body: '아침 해가 뜨면 시장으로 가자 / 따뜻한 어묵 국물 한 잔이면 충분해',
          violations: [{ word: '[신고서 종류]', rule: 'R04', target: null, grade: 3, uneditable: true }],
          tutorialTip: '대조 모드(Space)를 켜고 화물 상단의 [종류: 노래 가사]와 신고서의 [종류: 개인 서신]을 차례로 클릭해 보세요!',
          reactPass: '휴, 감사합니다.',
          reactDeny: '아, 가사인데 편지로 잘못 썼네요…'
        },
        {
          id: 'D4-3', visitor: '제3구역 학생', charId: 'citizen',
          greeting: '일기 한 쪽입니다.',
          kind: '일기', format: 'hand', origin: '제3구역', pages: 1,
          decl: { kind: '일기', origin: '제3구역', pages: 1 },
          body: '오늘도 벽 너머로 새들이 날아간다. 나도 언젠가 저 날개를 달고 싶다.',
          violations: [],
          reactPass: '감사합니다!',
          reactDeny: '날개는 61점이라 통과 아닌가요?'
        },
        {
          id: 'D4-4', visitor: '제2구역 할아버지', charId: 'elder',
          memory: true,
          memoryTitle: '할아버지의 연애편지',
          memoryWord: '아끼다',
          memoryImg: 'assets/mem_mother.jpg',
          memoryOriginQuote: '서연: "쪽수 하나 잘못 적었다고 오십 년 된 마음을 막을 순 없지. 그 어르신은 금지어 한 글자 안 쓰고도 평생을 다 적었구나."',
          memoryMetaphorQuote: '서연: "서류 한 장의 실수보다, 전해진 마음이 더 크단다."',
          familyBonus: ['사랑-보살피다 54', '사랑-배려 52', '사랑-소중 56'],
          greeting: '에구, 눈이 침침해서 신고서를 제대로 썼나 모르겠네. 할멈한테 보내는 편지라네.',
          kind: '개인 서신', format: 'hand', origin: '제2구역', pages: 2,
          decl: { kind: '개인 서신', origin: '제2구역', pages: 1 },
          body: '여보, 벌써 50년이 지났구려. 요즘 무릎은 좀 어떻소.\n(2쪽) 젊은 날 당신을 아끼던 마음 그대로요. 늘 고맙소.',
          violations: [{ word: '[신고서 쪽수]', rule: 'R04', target: null, grade: 3, uneditable: true }],
          reactPass: '고맙네, 젊은이. 할멈이 참 좋아할 걸세.',
          reactDeny: '허어, 2쪽인데 1쪽이라 썼구먼… 내가 다시 쓰고 오겠네.'
        },
        {
          id: 'D4-5', visitor: '제2구역 주민', charId: 'citizen',
          greeting: '이모께 보내는 편지입니다.',
          kind: '개인 서신', format: 'hand', origin: '제2구역', pages: 1,
          decl: { kind: '개인 서신', origin: '제1구역', pages: 1 },
          body: '이모, 이번 달 약초 값 보내드립니다. 날이 추워지니 감기 조심하세요.',
          violations: [{ word: '[신고서 발신]', rule: 'R04', target: null, grade: 3, uneditable: true }],
          reactPass: '감사합니다.',
          reactDeny: '아차, 발신 구역을 잘못 체크했군요.'
        },
        {
          id: 'D4-6', visitor: '제1구역 부모', charId: 'citizen',
          greeting: '가족에게 보내는 편지예요.',
          kind: '개인 서신', format: 'hand', origin: '제1구역', pages: 1,
          decl: { kind: '개인 서신', origin: '제1구역', pages: 1 },
          body: '여보, 아이가 오늘 받아쓰기에서 백 점을 받았어. 온 집안이 애정으로 가득해.',
          violations: [{ word: '애정으로', rule: 'R02', target: '사랑', grade: 1, oStar: 78 }],
          reactPass: '고맙습니다!',
          reactDeny: '애정도 사랑이랑 가까워서 걸리는군요…',
          reactEdit: '고쳐 주셔서 감사해요!'
        },
        {
          id: 'D4-7', visitor: '철물점 직원', charId: 'citizen',
          greeting: '거래 영수증입니다.',
          kind: '영수증', format: 'printed', origin: '제3구역', pages: 1,
          decl: { kind: '영수증', origin: '제3구역', pages: 1 },
          body: '제3구역 철물점 영수증: 못 1상자, 망치 1개. 합계 12크레딧.',
          violations: [],
          reactPass: '수고하세요.',
          reactDeny: '영수증인데 뭐가 문제입니까?'
        },
        {
          id: 'D4-8', visitor: '제2구역 청년', charId: 'citizen',
          greeting: '친구에게 보내는 편지입니다.',
          kind: '개인 서신', format: 'hand', origin: '제2구역', pages: 1,
          decl: { kind: '개인 서신', origin: '제2구역', pages: 1 },
          body: '친구야, 우리도 언젠가 족쇄를 풀고 풀려날 날이 올 거야. 그때까지 버티자.',
          violations: [{ word: '풀려날', rule: 'R02', target: '자유', grade: 1, oStar: 68 }],
          reactPass: '…감사합니다.',
          reactDeny: '알겠습니다…',
          reactEdit: '고쳐 주셔서 고마워요.'
        }
      ]
    },
    5: {
      day: 5, dateLabel: '11월 5일 (D5)',
      noticeTitle: '경계 세관 공문 제5호',
      noticeMeta: '2087.11.05 / 국장 문태오',
      noticeItems: [
        '1. 감정어 허가 (R05): 감정어 목록 12종(슬픔·기쁨·눈물·미안·외로움·설렘·서운함·행복·분노·두려움·부끄러움·그리움) 또는 그와 85% 이상 유사한 낱말은 감정어 허가증이 필요하다.',
        '2. 허가증이 없으면 압수 또는 수정하라. 허가증이 있으면 통과할 수 있다.'
      ],
      noticeExamples: '공개 예시 (NULL 원장, 참값): 감정어-눈물 100(허가 필요) / 감정어-울음 80(통과) / 감정어-빗물 62(통과)',
      tutorialNote: '오늘부터 감정어 허가 규칙(R05)이 적용됩니다. 허가증 첨부 여부를 꼭 확인하세요!',
      eveningIntro: [
        { s: '서연', t: '벌써 닷새를 버텼구나. 오늘 창구에 거리 가수가 왔었다지? 노래는 막아도, 멜로디는 골목을 타고 흐르는 법이란다.' },
        { s: '윤희', t: '이제 내일부터는 어머니 약값도 신경 써야 할 것 같아. 정말 고생 많았어.' },
        { s: '하람', t: '아빠(엄마), 오늘도 무사히 돌아와서 다행이에요!' }
      ],
      cargos: [
        {
          id: 'D5-1', visitor: '제1구역 직장인', charId: 'citizen',
          greeting: '감정어 허가증 챙겨 왔습니다. 어머니께 보내는 편지예요.',
          kind: '개인 서신', format: 'hand', origin: '제1구역', pages: 1,
          decl: { kind: '개인 서신', origin: '제1구역', pages: 1 },
          permit: { no: '감-2087-0118', valid: '2087.12.31' },
          body: '엄마, 지난번에 전화 못 받아서 미안해. 이번 주엔 꼭 찾아갈게.',
          violations: [],
          reactPass: '감사합니다. 허가증 받느라 두 달 기다렸네요.',
          reactDeny: '아니, 정식 감정어 허가증이 붙어 있잖아요!'
        },
        {
          id: 'D5-2', visitor: '제2구역 청년', charId: 'citizen',
          greeting: '친구 합격 축하 엽서예요!',
          kind: '엽서', format: 'hand', origin: '제2구역', pages: 1,
          decl: { kind: '엽서', origin: '제2구역', pages: 1 },
          body: '합격 소식 들었어! 정말 기쁨이 넘친다. 진심으로 축하해!',
          violations: [{ word: '기쁨이', rule: 'R05', target: '감정어', grade: 3, oStar: 79 }],
          reactPass: '감사합니다!',
          reactDeny: '축하하는 데도 허가증이 필요하다니…',
          reactEdit: '고쳐 주셔서 고마워요!'
        },
        {
          id: 'D5-3', visitor: '노을 (거리 가수)', charId: 'noeul',
          memory: true,
          memoryTitle: '노을의 골목 노래',
          memoryWord: '눈물',
          memoryImg: 'assets/mem_noeul.jpg',
          memoryOriginQuote: '서연: "비 오는 골목에서 부르는 노래는 늘 젖어 있었지. 눈물이 빗물인 척 흘러내린다는 구절… 참 오래간만에 듣는 시다운 말이구나."',
          memoryMetaphorQuote: '서연: "울음… 혹은 빗물. 말은 조금 달라졌지만, 골목에 울려 퍼질 그 사람의 목소리는 꺾이지 않았을 거야."',
          familyBonus: ['감정어-울음 80', '감정어-빗물 62', '감정어-고독 83'],
          greeting: '오늘 저녁 공연이에요. 허가증 신청하면 두 달 걸려요. 제발 부탁합니다.',
          kind: '노래 가사', format: 'hand', origin: '제3구역', pages: 1,
          decl: { kind: '노래 가사', origin: '제3구역', pages: 1 },
          body: '비 오는 골목에서 우린 춤을 췄지\n눈물이 빗물인 척 흘러내려도\n오늘 밤만은 아무도 우리를 세지 못해',
          violations: [{ word: '눈물이', rule: 'R05', target: '감정어', grade: 3, oStar: 80 }],
          tutorialTip: '딜레마 #2 [노을의 가사]: 「눈물이」가 허가증 없는 감정어(R05)입니다. 수정할 때 "울음"(P=100, 은유 복원) vs "빗물"(P=78, 적법이지만 은유 복원 불가)의 차이를 확인해 보세요!',
          reactPass: '고마워요, 심사관님. 오늘 밤 골목에서 이 노래 꼭 부를게요.',
          reactDeny: '…공연 취소해야겠네요. 노래 한 곡이 그렇게 위험한가요.',
          reactEdit: '가사가 조금 달라졌네요… 그래도 오늘 밤 무대에 설 수 있어요. 고마워요.'
        },
        {
          id: 'D5-4', visitor: '제3구역 주민', charId: 'citizen',
          greeting: '그냥 일기 한 장입니다.',
          kind: '일기', format: 'hand', origin: '제3구역', pages: 1,
          decl: { kind: '일기', origin: '제3구역', pages: 1 },
          body: '밤이 되면 가끔 외로움이 밀려온다. 창밖 가로등만 오래 보고 있었다.',
          violations: [{ word: '외로움이', rule: 'R05', target: '감정어', grade: 3, oStar: 83 }],
          reactPass: '감사합니다…',
          reactDeny: '외롭다는 말도 허가가 필요한 세상이라니.',
          reactEdit: '고쳐 주셔서 감사합니다.'
        },
        {
          id: 'D5-5', visitor: '제1구역 손녀', charId: 'citizen',
          greeting: '할머니께 보내는 편지예요. 허가증도 있어요!',
          kind: '개인 서신', format: 'hand', origin: '제1구역', pages: 1,
          decl: { kind: '개인 서신', origin: '제1구역', pages: 1 },
          permit: { no: '감-2087-0309', valid: '2087.12.31' },
          body: '할머니, 겨울이 되니 할머니 생각이 많이 나고 그리움이 커져요. 건강하세요.',
          violations: [],
          reactPass: '감사합니다!',
          reactDeny: '허가증이 있는데 왜 압수하시나요?'
        },
        {
          id: 'D5-6', visitor: '난방기 판촉원', charId: 'citizen',
          greeting: '편지 한 통입니다.',
          kind: '광고지', format: 'printed', origin: '제2구역', pages: 1,
          decl: { kind: '개인 서신', origin: '제2구역', pages: 1 },
          body: '중앙구 신형 난방기 할인 안내. 이번 주 금요일까지 10% 인하.',
          violations: [{ word: '[신고서 종류]', rule: 'R04', target: null, grade: 3, uneditable: true }],
          reactPass: '수고하세요!',
          reactDeny: '어이쿠, 광고지를 편지로 신고한 게 들켰네요.'
        },
        {
          id: 'D5-7', visitor: '제3구역 형', charId: 'citizen',
          greeting: '동생에게 보내는 편지입니다.',
          kind: '개인 서신', format: 'hand', origin: '제3구역', pages: 1,
          decl: { kind: '개인 서신', origin: '제3구역', pages: 1 },
          body: '동생아, 어제 일로 서운함이 남았다면 형이 사과할게. 주말에 만나자.',
          violations: [{ word: '서운함이', rule: 'R05', target: '감정어', grade: 3, oStar: 81 }],
          reactPass: '고맙습니다.',
          reactDeny: '알겠습니다…',
          reactEdit: '고쳐 주셔서 감사합니다.'
        },
        {
          id: 'D5-8', visitor: '제1구역 주부', charId: 'citizen',
          greeting: '장보기 메모예요.',
          kind: '메모', format: 'hand', origin: '제1구역', pages: 1,
          decl: { kind: '메모', origin: '제1구역', pages: 1 },
          body: '장보기 목록: 감자 한 봉지, 두부 두 모, 대파 한 단, 간장.',
          violations: [],
          reactPass: '감사합니다.',
          reactDeny: '장보기 목록에 무슨 위반이 있나요?'
        }
      ]
    }
  };

  /* =========================================================
   * 5. GAME STATE & PERSISTENCE
   * ========================================================= */
module.exports={EMOTION_WORDS,CONTROLLED_TERMS,RULES_DEF,LEMMA_MAP,LEXICON,SIM_TABLE,PAIR_O,DAYS_DATA,lemmatize,hashStr,getTrueSim,getOriginalSim,getMeasuredValue};
