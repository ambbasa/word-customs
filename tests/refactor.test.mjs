import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = process.cwd();

// Load CJS stage modules into runtime
const B = require(path.join(root, 'stages/tools/build-data.js'));
const LEX = require(path.join(root, 'stages/tools/lexicon.js'));
const ENGINE = require(path.join(root, 'stages/tools/engine.js'));
const LOCALE_API = require(path.join(root, 'stages/locales/adapter.js'));
require(path.join(root, 'stages/locales/ko-KR.js')).createKoAdapter(LEX, ENGINE, LOCALE_API);
require(path.join(root, 'stages/locales/en-US.js')).createEnAdapter(LOCALE_API);

// Import refactored ES modules
const config = await import('../js/config.js');
const { SFX } = await import('../js/sfx.js');
const stateMod = await import('../js/state.js');
const logic = await import('../js/logic.js');

const { runtime, createFreshState, applyJumpPreset, resetDayState, resetInteractionModes } = stateMod;
runtime.LEX = LEX;
runtime.ENGINE = ENGINE;
runtime.LOCALE_API = LOCALE_API;
runtime.LOCALE = LOCALE_API.getLocale('ko-KR');
for (let d = 1; d <= 30; d++) {
  runtime.DAYS_DATA[d] = JSON.parse(fs.readFileSync(path.join(root, 'stages/days', `D${String(d).padStart(2, '0')}.json`), 'utf8'));
}

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log('=== Word Customs Refactoring Verification Suite ===');

test('All ES modules load with valid syntax and zero circular dependencies', () => {
  const jsFiles = ['config.js', 'sfx.js', 'state.js', 'logic.js', 'ui-hud.js', 'cutscene.js', 'day-cycle.js', 'work.js', 'main.js'];
  const graph = {};
  for (const f of jsFiles) {
    const src = fs.readFileSync(path.join(root, 'js', f), 'utf8');
    const deps = [...src.matchAll(/from\s+['"]\.\/([^'"]+)['"]/g)].map(m => m[1]);
    graph[f] = deps;
  }
  const visiting = new Set();
  const visited = new Set();
  function dfs(node) {
    if (visiting.has(node)) throw new Error(`Circular dependency detected at ${node}`);
    if (visited.has(node)) return;
    visiting.add(node);
    for (const dep of (graph[node] || [])) dfs(dep);
    visiting.delete(node);
    visited.add(node);
  }
  jsFiles.forEach(dfs);
});

test('index.html & css/styles.css are properly separated and asset paths valid', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'css/styles.css'), 'utf8');
  assert(html.includes('<link rel="stylesheet" href="css/styles.css">'));
  assert(html.includes('<script type="module" src="js/main.js"></script>'));
  assert(!html.includes('<style>'));
  assert(html.split('\n').length < 500, 'index.html should be concise');
  // Every file url(...) in css/styles.css must point to an existing file relative to css/
  for (const m of css.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)) {
    const target = m[1];
    if (target.startsWith('#') || target.startsWith('data:') || target.startsWith('http')) continue;
    const resolved = path.resolve(root, 'css', target);
    assert(fs.existsSync(resolved), `Missing CSS asset: ${target} -> ${resolved}`);
  }
});

test('Every DOM element ID queried via $(...) in main/ui/day-cycle/work exists in index.html or dynamic templates', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const allJs = ['ui-hud.js', 'day-cycle.js', 'work.js', 'main.js']
    .map(f => fs.readFileSync(path.join(root, 'js', f), 'utf8')).join('\n');
  const combinedMarkup = html + '\n' + allJs;
  const ids = new Set([...allJs.matchAll(/\$\(\s*'([^']+)'\s*\)/g)].map(m => m[1]));
  const missing = [];
  for (const id of ids) {
    if (!combinedMarkup.includes(`id="${id}"`) && !combinedMarkup.includes(`id=\\"${id}\\"`)) {
      missing.push(id);
    }
  }
  assert.deepEqual(missing, [], `Missing DOM IDs: ${missing.join(', ')}`);
});

test('All 30 days JSON (336 cargos) match ENGINE.evaluate with 0 mismatches', () => {
  let total = 0;
  for (let d = 1; d <= 30; d++) {
    runtime.state = createFreshState(d);
    for (const c of runtime.DAYS_DATA[d].cargos) {
      total++;
      const ph = c.revisionPhase === 'after' ? 'after' : 'before';
      const ev = logic.evaluateCargoDisplay(c, ph);
      const jsonViols = (ph === 'after' && c.violationsAfter) ? c.violationsAfter : (c.violations || []);
      assert.equal(ev.violations.length, jsonViols.length, `Mismatch on ${c.id}`);
    }
  }
  assert.equal(total, 336);
});

test('evalWhen handles composite OR expressions and story flags accurately', () => {
  runtime.state = createFreshState(28);
  runtime.state.flags['D19.국장'] = 'EDIT';
  runtime.state.flags['#13'] = '적발';
  runtime.state.flags['D5-3'] = 'SLIPPED';
  runtime.state.flags['탈출증'] = '있음';
  runtime.state.flags['rel.윤희'] = 1;
  assert.equal(logic.evalWhen('D19=통과·미적발 또는 수정'), true);
  assert.equal(logic.evalWhen('#13=압수 또는 적발'), true);
  assert.equal(logic.evalWhen('D5-3∈{SLIPPED,EDIT}'), true);
  assert.equal(logic.evalWhen('탈출증=있음 & rel.윤희≥1'), true);
});

test('renderTemplate resolves D28 conditional {수정:...} and {D19.v}', () => {
  runtime.state = createFreshState(28);
  const dirLine = runtime.DAYS_DATA[28].evening.director.find(x => x.when === 'D19=통과·미적발 또는 수정').t;
  runtime.state.flags['D19.국장'] = 'EDIT';
  runtime.state.flags['D19.v'] = '송구';
  const edited = logic.renderTemplate(dirLine);
  assert(edited.includes("'송구'라고 고쳐 왔다고"));
  assert(!edited.includes('{'));
  runtime.state.flags['D19.국장'] = 'PASS';
  const passedLine = logic.renderTemplate(dirLine);
  assert(!passedLine.includes('고쳐 왔다고') && !passedLine.includes('{'));
});

test('buildTransformedBody accurately transforms edited & redacted text for R11 & R13', () => {
  const d16_3 = runtime.DAYS_DATA[16].cargos.find(c => c.id === 'D16-3');
  runtime.state = createFreshState(16);
  const red16 = logic.buildTransformedBody(d16_3.body, { 2: { redacted: true, surface: '███' } }, 'redact');
  assert.equal(logic.evaluateCargoDisplay({ ...d16_3, body: red16 }, 'before').violations.length, 0);

  const d22_4 = runtime.DAYS_DATA[22].cargos.find(c => c.id === 'D22-4');
  runtime.state = createFreshState(22);
  const red22 = logic.buildTransformedBody(d22_4.body, { 0: { redacted: true, surface: '███' } }, 'redact');
  assert.equal(logic.evaluateCargoDisplay({ ...d22_4, body: red22 }, 'after').violations.length, 0);

  const d20_3 = runtime.DAYS_DATA[20].cargos.find(c => c.id === 'D20-3');
  runtime.state = createFreshState(20);
  const idx = d20_3.body.split(/\s+/).findIndex(t => t === '정겹고');
  const red20 = logic.buildTransformedBody(d20_3.body, { [idx]: { redacted: true, surface: '███' } }, 'redact');
  assert.equal(logic.evaluateCargoDisplay({ ...d20_3, body: red20 }, 'before').violations.length, 0);
});

test('getMeasuredValue syncs Language Drift (+8) penalty with submitInlineEdit', () => {
  runtime.state = createFreshState(10);
  runtime.state.meterLv = 3;
  const base = logic.getMeasuredValue('여유', '자유', 'fine');
  runtime.state.driftWords['여유'] = { count: 3, firstDay: 3 };
  const drifted = logic.getMeasuredValue('여유', '자유', 'fine');
  assert.equal(drifted.trueVal, base.trueVal + config.GAME_CONFIG.DRIFT_PENALTY);
  assert(drifted.senseNote.includes('[NULL 감시 +8]'));
});

test('Linguist mode quota covers all R15 mandatory cargos on D28~D30', () => {
  for (const d of [28, 29, 30]) {
    const dayObj = runtime.DAYS_DATA[d];
    const r15Count = dayObj.cargos.filter(c => c.format !== 'printed' || c.origin === '제3구역').length;
    const quota = logic.calculateDayMeasureQuota(d, 1, dayObj);
    assert(quota >= r15Count + 2, `D${d} quota (${quota}) must cover R15 count (${r15Count})`);
  }
});

test('All 20 endings & E-05 reachability + resolveEndingDecision', () => {
  assert.equal(config.ENDINGS_CATALOG.length, 20);
  assert.equal(runtime.DAYS_DATA[20].evening.event.when, 'T≥45');
  runtime.state = applyJumpPreset(createFreshState(30), 30);
  runtime.state.S = 10;
  assert.equal(logic.resolveEndingDecision('B').id, 'B1');
  assert.equal(logic.resolveEndingDecision('D').id, 'D1');
  runtime.state.S = 80;
  assert.equal(logic.resolveEndingDecision('B').id, 'B5');
});

test('Economy simulation with GAME_CONFIG stays solvent across D1~D30', () => {
  let bal = config.GAME_CONFIG.STARTING_CREDITS;
  let minBal = bal;
  for (let d = 1; d <= 30; d++) {
    const income = config.GAME_CONFIG.BASE_PAY + runtime.DAYS_DATA[d].cargos.length * config.GAME_CONFIG.PROC_PAY_NORMAL;
    const c = logic.calculateDailyCosts(d, '보통', false, false);
    bal += income - (c.rentCost + c.foodCost + c.heatCost + c.medCost + c.coldCost);
    minBal = Math.min(minBal, bal);
  }
  assert(minBal >= 20, `Min balance too low: ${minBal}`);
  assert.equal(bal, 80);
});

test('SFX & state helpers run safely without browser globals', () => {
  assert.equal(SFX.ensure(), null);
  resetDayState(5);
  resetInteractionModes();
  assert.equal(runtime.state.day, 5);
  assert.equal(runtime.state.editMode, false);
});

test('Smart auto-target, 2-word open Korean phrases, preservation preview & greeting variety', () => {
  runtime.state = createFreshState(28);
  const best1 = logic.findBestTargetForWord('다정하게', runtime.DAYS_DATA[3].cargos[0]);
  assert.equal(best1.target, '사랑');
  const best2 = logic.findBestTargetForWord('모친', runtime.DAYS_DATA[26].cargos[1]);
  assert.equal(best2.target, '엄마');

  assert.equal(logic.isValidOpenKoreanWord('따뜻한 마음'), true);
  assert.equal(logic.isValidOpenKoreanWord('편안함'), true);
  assert.equal(logic.isValidOpenKoreanWord('홀가분함'), true);
  const prev = logic.getPreservationPreview('사랑', '따뜻한 마음', '사랑', 68, 3, 'before');
  assert(prev.P >= 80 && prev.tier.includes('높음'), 'Expected high preservation for 따뜻한 마음: ' + JSON.stringify(prev));

  assert(config.getMeterSpec(3).delayMs < config.getMeterSpec(2).delayMs);
  assert(config.getMeterSpec(2).delayMs < config.getMeterSpec(1).delayMs);
});

test('Playtest 7-item package: hints, rich endings, callbacks, JSON notices & clock/meter balance', () => {
  // 1. All 7 violation rules have 1-line deny hints
  for (const rId of config.VIOLATION_RULE_IDS) {
    assert(config.DENY_REASON_HINTS[rId] && config.DENY_REASON_HINTS[rId].length >= 10, `Missing DENY_REASON_HINTS for ${rId}`);
  }

  // 2. D06 express notice matches GAME_CONFIG (35분 / ₵5) and zero phantom rulebook tab names in D01~D30 JSON
  const d06Text = JSON.stringify(runtime.DAYS_DATA[6]);
  assert(d06Text.includes('35게임분') && d06Text.includes('₵5'), 'D06 express notice must match 35게임분 / ₵5');
  const phantomTabs = ['[허가]', '[문맥]', '[초성]', '[애칭]', '원장 조회(10게임분)'];
  for (let d = 1; d <= 30; d++) {
    const raw = JSON.stringify(runtime.DAYS_DATA[d]);
    for (const pt of phantomTabs) {
      assert(!raw.includes(pt), `Phantom rulebook label "${pt}" found in D${String(d).padStart(2, '0')}.json`);
    }
  }

  // 3. Rich multi-sentence endings & personalized buildEndingCallbacks()
  runtime.state = applyJumpPreset(createFreshState(30), 30);
  runtime.state.flags['D3.하준'] = 'EDIT';
  runtime.state.flags['D5-3'] = 'SLIPPED';
  runtime.state.flags['D19.국장'] = 'EDIT';
  runtime.state.totalMercyPassed = 3;
  runtime.state.driftWords = { '온기': { count: 4, firstDay: 5 } };
  for (const ch of ['A', 'B', 'C', 'D']) {
    const res = logic.resolveEndingDecision(ch);
    assert(res.desc.length >= 45, `Ending ${res.id} desc too short: ${res.desc}`);
  }
  const cbs = logic.buildEndingCallbacks();
  assert(cbs.length >= 4, `Expected >=4 personalized callbacks, got ${cbs.length}`);
  assert(cbs.some(line => line.includes('하준')), 'Expected Hajun callback');
  assert(cbs.some(line => line.includes('온기')), 'Expected top drifted word callback');

  // 4. Rebalanced clock pace & meter measurement time costs
  assert(config.GAME_CONFIG.MS_PER_MIN_NORMAL >= 400);
  assert(config.GAME_CONFIG.MS_PER_MIN_RELAXED >= 750);
  assert.equal(config.getMeterSpec(1).fastCost, 10);
  assert.equal(config.getMeterSpec(1).fineCost, 20);
  assert.equal(config.getMeterSpec(3).fastCost, 6);
  assert.equal(config.getMeterSpec(3).fineCost, 12);
});

test('Night exploit rules use proportional thresholds (90% all-correct, 50% diligence)', () => {
  assert.equal(config.GAME_CONFIG.ALL_CORRECT_MIN_RATIO, 0.9, 'All-correct bonus needs 90% processed');
  assert.equal(config.GAME_CONFIG.DILIGENCE_MIN_RATIO, 0.5, 'Diligence needs 50% processed');
  assert.equal(config.GAME_CONFIG.SURGE_MAX_UNPROCESSED, 4);
});

test('A1 (모범 심사관) branches its description on family state', () => {
  runtime.state = applyJumpPreset(createFreshState(30), 30);
  runtime.state.M = 3;
  runtime.state.rating = 90;
  runtime.state.familyGone = false;
  runtime.state.seoyeonHealth = '보통';
  const intact = logic.resolveEndingDecision('A');
  assert.equal(intact.id, 'A1');
  assert(!intact.desc.includes('텅 비어'), 'Intact family should not mention the empty house');

  runtime.state.familyGone = true;
  const gone = logic.resolveEndingDecision('A');
  assert.equal(gone.id, 'A1', 'Family gone still earns A1, with a different description');
  assert(gone.desc.includes('텅 비어'), 'Family-gone A1 should mention the empty house');
  runtime.state.familyGone = false;
  runtime.state.seoyeonHealth = '사망';
  const dead = logic.resolveEndingDecision('A');
  assert.equal(dead.id, 'A1');
  assert(dead.desc.includes('빈자리'), 'Seoyeon-dead A1 should mention her empty seat');
});

test('D30 settlement lines reuse the settlement income formula', () => {
  const day30 = runtime.DAYS_DATA[30];
  assert.equal(day30.cargos.length, 9);
  const okLog = Array.from({ length: 8 }, (_, i) => ({ visitor: 'v' + i, action: '통과', expected: '적법', ok: true }));
  const full = {
    dayProcessed: 8, dayRedactedCount: 0, dayReviewLog: okLog, queueIndex: 8,
    rating: 85, T: 20, prevResPassed: 0, dayBonus: 5, dayFines: 0,
    credits: 100, seoyeonHealth: '보통', medExempt: false, coldMedDue: false
  };
  const res = logic.computeD30Settlement(full, day30);
  assert.equal(res.allCorrectBonus, 5, 'Full non-final queue processed should pay the bonus');
  assert.equal(res.diligence, 10, 'Rating 85 with 8/9 processed should pay diligence');
  assert.equal(res.income, 70, '10 base + 40 proc + 5 bonus + 5 all-correct + 10 diligence');
  assert.equal(res.costs.rentCost, 30);
  assert.equal(res.paidTotal, 75, '30 rent + 15 food + 10 heat + 20 med');
  assert.equal(res.net, -5);

  const partial = {
    ...full, dayProcessed: 5, dayReviewLog: okLog.slice(0, 5), queueIndex: 5, dayBonus: 0
  };
  const res2 = logic.computeD30Settlement(partial, day30);
  assert.equal(res2.allCorrectBonus, 0, '5/8 processable is under the 90% all-correct quota');
  assert.equal(res2.diligence, 10, '5/8 processable clears the 50% diligence gate');
  assert.equal(res2.income, 45, '10 base + 25 proc + 10 diligence');
});

test('Mercy headline rotates across 3 variants by day', async () => {
  const dayCycle = await import('../js/day-cycle.js');
  const seen = new Set();
  for (const dayNum of [2, 3, 4]) {
    runtime.state = createFreshState(dayNum);
    runtime.state.prevDayStats = { day: dayNum - 1, mercyPassed: 2, detected: 0, processed: 8, denied: 0, passed: 8, edited: 0, warnings: 0, allCorrect: true };
    runtime.state.consecutivePerfectDays = 0;
    runtime.state.S = 0;
    runtime.state.driftWords = {};
    seen.add(dayCycle.getMorningHeadline(dayNum));
  }
  assert.equal(seen.size, 3, 'Mercy headline should rotate through 3 variants, got: ' + [...seen].join(' | '));
});

test('Cutscene beats: evening cutscene specs are data-driven and flag-aware', async () => {
  const cutscene = await import('../js/cutscene.js');

  // 화자 → 초상화 매핑
  assert.equal(cutscene.speakerPortraitKey('국장 문태오'), 'director');
  assert.equal(cutscene.speakerPortraitKey('서연'), 'seoyeon');
  assert.equal(cutscene.speakerPortraitKey('모리 (택배 기사)'), 'mori');
  assert.equal(cutscene.speakerPortraitKey('독백'), null);
  assert.equal(cutscene.speakerPortraitKey('연출'), null);

  // D10 국장 인터뷰 — 평정에 따라 다른 첫 대사
  runtime.state = applyJumpPreset(createFreshState(10), 10);
  runtime.state.rating = 80;
  const d10hi = cutscene.getEveningCutscene(10, runtime.DAYS_DATA[10]);
  assert(d10hi && d10hi.title.includes('국장의 방문'), 'D10 should stage the director interview');
  assert.equal(d10hi.lines.length, 2, 'High-rating interview should pick 2 lines');
  assert(d10hi.lines[0].t.includes('깔끔하더군'), 'High-rating line should be picked');
  runtime.state.rating = 50;
  const d10lo = cutscene.getEveningCutscene(10, runtime.DAYS_DATA[10]);
  assert(d10lo.lines[0].t.includes('실수가 잦아'), 'Low-rating line should be picked');

  // D28 국장 고백 — #10 수락 분기
  runtime.state = applyJumpPreset(createFreshState(28), 28);
  runtime.state.flags['#10'] = '수락';
  const d28 = cutscene.getEveningCutscene(28, runtime.DAYS_DATA[28]);
  assert(d28 && d28.title.includes('국장의 고백'), 'D28 should stage the director confession');
  assert(d28.lines[0].t.includes('문서준'), 'Confession line should name 문서준');

  // D25 NULL 거래 — 이벤트 텍스트가 컷씬 대사가 된다
  runtime.state = applyJumpPreset(createFreshState(25), 25);
  const d25 = cutscene.getEveningCutscene(25, runtime.DAYS_DATA[25]);
  assert(d25 && d25.title.includes('NULL의 거래'), 'D25 should stage the NULL trade');
  assert.equal(d25.lines[0].s, 'NULL');
  assert(d25.lines[0].t.includes('NULL입니다'), 'NULL trade text should be staged');

  // D1 첫 저녁·D16 초성·D17 그리움 — 인트로 비트
  runtime.state = applyJumpPreset(createFreshState(1), 1);
  const d1 = cutscene.getEveningCutscene(1, runtime.DAYS_DATA[1]);
  assert(d1 && d1.lines.length === 3 && d1.lines[0].s === '윤희', 'D1 first evening should stage 3 family lines');
  const d16 = cutscene.getEveningCutscene(16, runtime.DAYS_DATA[16]);
  assert(d16 && d16.title.includes('초성'), 'D16 should stage the initial-consonant beat');
  const d17 = cutscene.getEveningCutscene(17, runtime.DAYS_DATA[17]);
  assert(d17 && d17.title.includes('그리움'), 'D17 should stage the longing beat');

  // 평범한 날은 컷씬 없음
  runtime.state = applyJumpPreset(createFreshState(5), 5);
  assert.equal(cutscene.getEveningCutscene(5, runtime.DAYS_DATA[5]), null, 'Ordinary days should not stage a cutscene');

  // D30 최종 화물 — 화물 데이터 원문 그대로
  const finalCargo = runtime.DAYS_DATA[30].cargos[runtime.DAYS_DATA[30].cargos.length - 1];
  const d30 = cutscene.getD30Cutscene(finalCargo);
  assert(d30 && d30.title.includes('마지막 화물'), 'D30 should stage the final cargo');
  assert(d30.lines[0].t.includes('마지막 배달'), 'Final cargo greeting should be staged');
  assert(d30.lines[1].t.includes('있었던 말'), 'Final cargo body should be staged');
  assert.equal(cutscene.getD30Cutscene(null), null);
});

console.log(`\nALL ${passed} TESTS PASSED!`);
