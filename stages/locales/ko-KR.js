'use strict';

function createKoAdapter(LEX, ENGINE, adapterApi) {
  const OPEN_SYN_CLUSTERS = {
    '서운함': { '섭섭함':82, '섭섭하다':82, '아쉬움':78, '아쉽다':78, '속상함':76, '속상하다':76, '안타까움':74, '안타깝다':74, '허전함':74, '허전하다':74, '쓸쓸함':72, '쓸쓸하다':72, '먹먹함':70, '먹먹하다':70, '적적함':68, '적적하다':68, '미련':68, '유감':66, '야속함':72, '야속하다':72, '씁쓸함':70, '씁쓸하다':70, '마음':56, '기분':52, '생각':52 },
    '외로움': { '고독':83, '고독하다':83, '쓸쓸함':80, '쓸쓸하다':80, '허전함':78, '허전하다':78, '적적함':76, '적적하다':76, '공허함':74, '공허하다':74, '빈자리':70, '혼자':72, '홀로':72, '고요':64, '고요하다':64, '침묵':60, '정적':62, '적막':68, '적막하다':68, '막막함':64 },
    '눈물': { '울음':80, '흐느낌':82, '눈시울':76, '한숨':70, '물기':68, '눈가':66, '빗물':64, '물방울':62, '이슬':60, '방울':60, '촉촉함':62, '적시다':58, '비':54, '소나기':52, '안개':48 },
    '슬픔': { '비통':80, '애통':78, '안타까움':76, '안타깝다':76, '먹먹함':74, '먹먹하다':74, '서러움':78, '서럽다':78, '아픔':74, '아프다':74, '괴로움':72, '괴롭다':72, '우울':74, '침울':70, '허탈':68, '한숨':64, '쓸쓸함':70, '쓸쓸하다':70 },
    '기쁨': { '환희':84, '즐거움':80, '즐겁다':80, '웃음':74, '미소':72, '보람':70, '만족':68, '뿌듯함':76, '뿌듯하다':76, '반가움':74, '반갑다':74, '신남':72, '신나다':72, '다행':64, '축하':66, '안도':62, '유쾌':72 },
    '미안': { '죄송':82, '죄송하다':82, '사과':78, '사죄':76, '면목':72, '유감':70, '송구':74, '민망':66, '부끄럽다':64, '안타깝다':62, '고맙다':52 },
    '그리움': { '보고싶다':78, '애틋함':74, '애틋하다':74, '아련함':72, '아련하다':72, '생각':66, '기억':68, '회상':66, '여운':64, '잔상':62, '허전함':64, '허전하다':64, '기다림':66, '기다리다':66 },
    '행복': { '만족':74, '평온':76, '평안':76, '즐거움':78, '즐겁다':78, '포근함':72, '포근하다':72, '따뜻함':70, '따뜻하다':70, '보람':68, '웃음':70, '감사':64, '다행':62, '안식':68 },
    '분노': { '화남':80, '화나다':80, '격분':82, '울분':78, '억울함':74, '억울하다':74, '짜증':72, '원망':70, '불만':68, '열받다':70, '답답함':64 },
    '두려움': { '공포':82, '무서움':80, '무섭다':80, '불안':78, '불안하다':78, '걱정':74, '걱정되다':74, '겁남':76, '긴장':68, '초조':70, '떨림':66, '조마조마':68 },
    '부끄러움': { '민망함':80, '민망하다':80, '쑥스러움':82, '쑥스럽다':82, '수줍음':78, '수줍다':78, '겸연쩍다':74, '창피':76, '어색함':68, '어색하다':68 },
    '설렘': { '두근거림':82, '두근대다':82, '기대':78, '기대감':78, '들뜸':76, '들뜨다':76, '떨림':74, '떨리다':74, '기다림':70, '희망':66, '반가움':70 },
    '사랑': { '다정':68, '다정하다':68, '정':66, '애틋함':64, '애틋하다':64, '좋아하다':65, '호감':62, '아끼다':60, '아낌':60, '소중':62, '소중함':62, '소중하다':62, '보살피다':58, '배려':56, '챙기다':56, '위하다':58, '따스함':56, '따스하다':56, '따뜻함':56, '따뜻하다':56, '따뜻한 마음':62, '온기':56, '포근함':56, '포근하다':56, '마음':54, '진심':60, '연애':62, '품다':54, '지키다':52, '우정':54, '믿음':50, '신뢰':48, '존경':50, '응원':48, '고맙다':46, '감사':46, '귀하다':58 },
    '자유': { '자율':63, '날개':61, '열림':58, '숨통':60, '여유':58, '탁트임':58, '트임':56, '마음껏':60, '마음대로':58, '편안함':56, '편안하다':56, '홀가분함':62, '홀가분하다':62, '시원함':56, '시원하다':56, '후련함':60, '휴식':54, '바람':50, '하늘':50, '구름':48, '평온':50, '평화':54, '안식':52, '방학':48, '깃털':48, '새':48, '떠돌다':54, '넓음':50, '끝':42 },
    '꿈': { '바람':64, '목표':62, '장래':66, '포부':64, '앞날':62, '열망':64, '계획':58, '미래':60, '내일':58, '기대':60, '별':56, '빛':52, '상상':62, '이상':60, '다짐':56, '잠':50 },
    '추억': { '기억':72, '회상':70, '지난날':70, '옛날':68, '옛일':68, '발자취':64, '흔적':62, '기록':60, '사진':58, '앨범':58, '여운':62, '되새김':64 },
    '약속': { '다짐':72, '기약':72, '언약':70, '계약':66, '신뢰':64, '믿음':64, '기다림':62, '결심':64, '맹세':72, '약조':72 },
    '고향': { '고장':72, '동네':68, '마을':68, '시골':66, '본가':70, '옛집':70, '터전':66, '집':62, '품':58, '어린시절':62 },
    '노래': { '가락':72, '선율':72, '멜로디':70, '흥얼거림':70, '목소리':66, '소리':62, '음정':62, '리듬':64, '시':60, '연주':66, '합창':70 },
    '어머니': { '부모':64, '부모님':64, '가족':62, '어른':60, '어르신':58, '우리 어른':60, '우리집 어른':60, '보호자':58, '식구':58, '할머니':58, '친정':60 },
    '엄마': { '부모':64, '부모님':64, '가족':62, '어른':60, '어르신':58, '우리 어른':60, '우리집 어른':60, '보호자':58, '식구':58, '할머니':58, '친정':60 },
    '불': { '온기':74, '열기':76, '빛':72, '불꽃':80, '촛불':78, '난로':68, '따뜻함':66, '불빛':76, '연기':60 },
    '눈': { '서리':74, '우박':76, '얼음':70, '겨울':64, '하얀':66, '송이':62, '바람':54, '비':56, '안개':58 },
    '사전': { '책':66, '기록':68, '공책':68, '장부':64, '목록':66, '문서':62, '종이':58, '글':64 },
    '낱말': { '글자':70, '어휘':72, '표현':70, '단어':72, '문장':66, '소리':60, '이름':62 },
    '말': { '이야기':70, '대화':70, '목소리':68, '표현':68, '글':64, '소리':62, '안부':60, '인사':60 }
  };

  const SINGLE_OK = new Set(['정','꿈','별','비','눈','말','불','집','길','밤','빛','봄','꽃','손','힘','뜻','삶','글','책','시','춤','품','물','산','강','해','달','새','끝']);

  function lemmatize(raw) {
    const c = LEX.clean(raw);
    if (!c) return '';
    if (LEX.SURFACE[c]) return LEX.SURFACE[c];
    const base = LEX.lemmaOf(raw);
    if (LEX.LEXICON.has(base)) return base;
    const rules = [
      [/워요$|웠어$|워$|운$|울$/, '움'],
      [/해요$|했어$|해$|한$|하게$|하는$|한다$|합니다$/, '하다'],
      [/아요$|았어$|아$/, '다'],
      [/어요$|었어$|어$/, '다'],
      [/이에요$|예요$|이다$/, ''],
      [/(은|는|이|가|을|를|의|에|로|으로|와|과|도|만)$/, '']
    ];
    for (const [re, rep] of rules) {
      if (c.length >= 2 && re.test(c)) {
        const cand = c.replace(re, rep);
        if (cand.length >= 2) {
          if (LEX.SURFACE[cand]) return LEX.SURFACE[cand];
          if (LEX.LEXICON.has(cand)) return cand;
          for (const grp of Object.values(OPEN_SYN_CLUSTERS)) {
            if (grp[cand] !== undefined) return cand;
            if (grp[cand + '다'] !== undefined) return cand + '다';
            if (cand.endsWith('하다') && grp[cand.slice(0, -2) + '함'] !== undefined) return cand.slice(0, -2) + '함';
          }
        }
      }
    }
    return base || c;
  }

  function isValidWord(raw) {
    const trimmed = String(raw || '').trim().replace(/\s+/g, ' ');
    const c = LEX.clean(trimmed);
    if (!c) return false;
    if (LEX.LEXICON.has(c) || LEX.SURFACE[c]) return true;
    const norm = lemmatize(trimmed);
    if (LEX.LEXICON.has(norm)) return true;
    for (const grp of Object.values(OPEN_SYN_CLUSTERS)) {
      if (grp[trimmed] !== undefined || grp[c] !== undefined || grp[norm] !== undefined) return true;
    }
    if (SINGLE_OK.has(c)) return true;
    // Allow single Korean words (2~10 chars) or natural 2-word Korean phrases (e.g. "따뜻한 마음")
    if (/^[가-힣]{2,10}$/.test(c) && !/^(.)\1+$/.test(c)) return true;
    if (/^[가-힣]{1,6} [가-힣]{1,6}$/.test(trimmed) && !/^(.)\1+$/.test(trimmed.replace(/\s/g, ''))) return true;
    return false;
  }

  function matchMaskedTerm(raw, day) {
    const c = LEX.clean(raw);
    if (day < 16 || !/^[ㄱ-ㅎ]+$/.test(c)) return null;
    return (LEX.CHOSUNG && Object.keys(LEX.CHOSUNG).find(t => LEX.CHOSUNG[t] === c)) || null;
  }

  function lookupOpenSynO(origLemma, targetKey, vLemma) {
    const rawTrim = String(vLemma || '').trim().replace(/\s+/g, ' ');
    const normV = lemmatize(rawTrim);
    const grpOrig = OPEN_SYN_CLUSTERS[origLemma];
    if (grpOrig) {
      if (grpOrig[rawTrim] !== undefined) return grpOrig[rawTrim];
      if (grpOrig[vLemma] !== undefined) return grpOrig[vLemma];
      if (grpOrig[normV] !== undefined) return grpOrig[normV];
    }
    const grpTarget = OPEN_SYN_CLUSTERS[targetKey];
    if (grpTarget) {
      if (grpTarget[rawTrim] !== undefined) return grpTarget[rawTrim];
      if (grpTarget[vLemma] !== undefined) return grpTarget[vLemma];
      if (grpTarget[normV] !== undefined) return grpTarget[normV];
    }
    return null;
  }

  function checkSafeSense(cargo, wordRaw, lemma) {
    return adapterApi.resolveSafeSense(cargo, wordRaw, lemma, ENGINE.SENSE_TERMS);
  }

  return adapterApi.registerLocale({
    id: 'ko-KR',
    name: '한국어 (Korean)',
    lemmatize,
    isValidWord,
    matchMaskedTerm,
    lookupOpenSynO,
    checkSafeSense,
    senseTerms: ENGINE.SENSE_TERMS
  });
}

module.exports = { createKoAdapter };
