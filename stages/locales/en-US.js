'use strict';

/**
 * English (en-US) LocaleAdapter scaffold ready for English content pack (GDD 9.6).
 * Maps Korean gimmicks to English equivalents:
 * - R07 Homonyms: free (liberty/no-cost), fire (flame/dismiss), tear (weep/rip),
 *   letter (mail/character), spring (season/coil), honey (pet-name/food), pumpkin (pet-name/vegetable)
 * - R11 Masked/Initials: F.R.E.E., L-word, f---, d.r.e.a.m.
 * - R01 Inflections: freely->free, loved/loving->love, dreams/dreaming->dream
 */
function createEnAdapter(adapterApi) {
  const SENSE_TERMS = {
    free: ['liberty', 'no-cost'],
    fire: ['flame', 'dismiss'],
    tear: ['weep', 'rip'],
    letter: ['mail', 'alphabet'],
    spring: ['season', 'coil'],
    honey: ['pet-name', 'food'],
    pumpkin: ['pet-name', 'vegetable'],
    baby: ['pet-name', 'infant']
  };

  const MASKED_PATTERNS = [
    { re: /^(f\.?r\.?e\.?e\.?|f-+|f-word)$/i, term: 'free' },
    { re: /^(l\.?o\.?v\.?e\.?|l-+|l-word)$/i, term: 'love' },
    { re: /^(d\.?r\.?e\.?a\.?m\.?|d-word)$/i, term: 'dream' },
    { re: /^(h\.?o\.?m\.?e\.?|h-word)$/i, term: 'home' }
  ];

  const IRREGULAR_LEMMAS = {
    freely: 'free', freedom: 'free', freed: 'free', freeing: 'free',
    loved: 'love', loving: 'love', loves: 'love', lovely: 'love',
    dreamed: 'dream', dreamt: 'dream', dreaming: 'dream', dreams: 'dream',
    tears: 'tear', crying: 'cry', cried: 'cry',
    missed: 'miss', missing: 'miss', longing: 'long',
    cherished: 'cherish', cherishing: 'cherish', caring: 'care', cared: 'care'
  };

  const OPEN_SYN_CLUSTERS = {
    free: { autonomy: 64, wing: 61, open: 58, leisure: 56, breeze: 50, sky: 48, rest: 52, peace: 54 },
    love: { cherish: 66, fondness: 68, care: 60, warmth: 56, devotion: 64, gentle: 58, dear: 62, hold: 50 },
    tear: { sob: 80, drop: 64, rain: 62, dew: 58, mist: 52, sigh: 68 },
    lonely: { solitude: 82, hollow: 74, quiet: 62, empty: 72, still: 60, alone: 76 },
    dream: { wish: 66, hope: 68, star: 56, plan: 58, tomorrow: 58 },
    memory: { past: 70, trace: 64, echo: 66, record: 60, yesterday: 68 },
    promise: { vow: 74, pledge: 72, oath: 72, trust: 64, word: 62 },
    home: { town: 68, hearth: 72, village: 66, roots: 68, shelter: 60 }
  };

  function clean(raw) {
    return String(raw || '').trim().replace(/^[("'“‘]+|[.,!?…)"'”’]+$/g, '');
  }

  function lemmatize(raw) {
    const c = clean(raw).toLowerCase();
    if (!c) return '';
    if (IRREGULAR_LEMMAS[c]) return IRREGULAR_LEMMAS[c];
    if (c.length > 4 && c.endsWith('ing')) return c.slice(0, -3);
    if (c.length > 4 && c.endsWith('ed')) return c.slice(0, -2);
    if (c.length > 3 && c.endsWith('es')) return c.slice(0, -2);
    if (c.length > 3 && c.endsWith('s') && !c.endsWith('ss')) return c.slice(0, -1);
    return c;
  }

  function isValidWord(raw) {
    const c = clean(raw);
    return /^[A-Za-z][A-Za-z'-]{1,20}$/.test(c) && !/^(.)\1+$/i.test(c);
  }

  function matchMaskedTerm(raw, day) {
    if (day < 16) return null;
    const c = clean(raw);
    for (const p of MASKED_PATTERNS) {
      if (p.re.test(c)) return p.term;
    }
    return null;
  }

  function adaptSurface(origRaw, userInput) {
    const lead = (origRaw.match(/^[("'“‘]+/) || [''])[0];
    const trail = (origRaw.match(/[.,!?…)"'”’]+$/) || [''])[0];
    const bareOrig = origRaw.slice(lead.length, origRaw.length - trail.length);
    let out = clean(userInput);
    // Preserve sentence-initial capitalization
    if (bareOrig && /^[A-Z]/.test(bareOrig) && out) {
      out = out[0].toUpperCase() + out.slice(1);
    }
    return lead + out + trail;
  }

  function lookupOpenSynO(origLemma, targetKey, vLemma) {
    const v = lemmatize(vLemma);
    const g1 = OPEN_SYN_CLUSTERS[origLemma];
    if (g1 && g1[v] !== undefined) return g1[v];
    const g2 = OPEN_SYN_CLUSTERS[targetKey];
    if (g2 && g2[v] !== undefined) return g2[v];
    return null;
  }

  function checkSafeSense(cargo, wordRaw, lemma) {
    return adapterApi.resolveSafeSense(cargo, wordRaw, lemma, SENSE_TERMS);
  }

  return adapterApi.registerLocale({
    id: 'en-US',
    name: 'English (US)',
    lemmatize,
    isValidWord,
    matchMaskedTerm,
    adaptSurface,
    lookupOpenSynO,
    checkSafeSense,
    senseTerms: SENSE_TERMS
  });
}

module.exports = { createEnAdapter };
