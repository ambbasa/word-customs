'use strict';

/**
 * LocaleAdapter Registry for Word Customs (Ver 4.0)
 * Separates language-specific morphology, homonym sense checking,
 * masked-pattern rules (R11), surface inflection adaptation, and
 * open-lexicon synonym scoring from the core 30-day game engine.
 */
const REGISTRY = Object.create(null);

function registerLocale(adapter) {
  if (!adapter || !adapter.id) throw new Error('LocaleAdapter requires an id');
  REGISTRY[adapter.id] = adapter;
  return adapter;
}

function getLocale(id) {
  return REGISTRY[id] || REGISTRY['ko-KR'] || null;
}

function listLocales() {
  return Object.keys(REGISTRY);
}

/**
 * Helper to check whether a cargo token has an explicitly allowed homonym sense (R07).
 * Supports both canonical JSON schema ({ token, sense }) and legacy ({ word, forbidden }).
 */
function resolveSafeSense(cargo, wordRaw, lemma, senseTermsMap) {
  if (!cargo || !Array.isArray(cargo.senses) || !cargo.senses.length) return null;
  const cleanRaw = String(wordRaw || '').replace(/[.,!?…"'「『」』()·\s]/g, '');
  const entry = cargo.senses.find(s => {
    const t = String(s.token || s.word || '').replace(/[.,!?…"'「『」』()·\s]/g, '');
    return t === cleanRaw || (s.lemma && s.lemma === lemma) || t === lemma;
  });
  if (!entry) return null;
  if (entry.forbidden === false) return { safe: true, sense: entry.sense || '허용 뜻' };
  const pair = senseTermsMap && senseTermsMap[lemma];
  if (pair && entry.sense && entry.sense !== pair[0]) {
    return { safe: true, sense: entry.sense };
  }
  return { safe: false, sense: entry.sense || (pair ? pair[0] : '') };
}

module.exports = { registerLocale, getLocale, listLocales, resolveSafeSense };
