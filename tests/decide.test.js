// Stat Test Picker decision harness.
// Extracts the inline app script, runs it without a DOM, walks every reachable
// answer path through QUESTIONS (honoring showIf), and checks decide() against
// an expected map written independently from the Execution Manifest table.
// Run: node tests/decide.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (blocks.length !== 1) throw new Error('Expected exactly one inline script block, found ' + blocks.length);
const ctx = { window: {}, console };
vm.createContext(ctx);
vm.runInContext(blocks[0] + '\n;globalThis.__app = { decide, TESTS, QUESTIONS, visibleSteps, stepKeys };', ctx);
const { decide, TESTS, QUESTIONS, visibleSteps, stepKeys } = ctx.__app;

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL ' + msg); } }

// ---------- data layer ----------
const IDS = ['oneSampleT', 'welchT', 'studentT', 'pairedT', 'oneWayAnova', 'welchAnova', 'rmAnova',
  'wilcoxonSR', 'mannWhitney', 'kruskalWallis', 'friedman', 'chiGof', 'chiIndep', 'fisherExact',
  'mcnemar', 'cochranQ', 'pearsonRegression', 'spearman'];
check(Object.isFrozen(TESTS), 'TESTS is frozen');
check(Object.keys(TESTS).length === IDS.length, 'TESTS has ' + IDS.length + ' entries');
IDS.forEach(id => {
  const t = TESTS[id];
  check(!!t, 'TESTS.' + id + ' exists');
  if (!t) return;
  check(typeof t.name === 'string' && t.name.length > 0, id + '.name');
  check(typeof t.rationale === 'string' && t.rationale.length > 20, id + '.rationale');
  check(Array.isArray(t.assumptions) && t.assumptions.length >= 2, id + '.assumptions');
  check(t.fallback === null || IDS.includes(t.fallback), id + '.fallback valid');
  check(typeof t.whyNot === 'string' && t.whyNot.length > 20, id + '.whyNot');
});
check(QUESTIONS.length === 5, 'five QUESTIONS');
check(QUESTIONS.map(q => q.id).join() === 'goal,outcome,groups,design,assumptions', 'step order');
QUESTIONS.forEach(q => {
  check(typeof q.showIf === 'function', q.id + '.showIf');
  q.parts({ goal: 'compare', outcome: 'continuous' }).forEach(p => p.options.forEach(o =>
    check(o.label && o.help, q.id + ' option ' + o.value + ' has label and helper text')));
});

// ---------- expected map (from the manifest table) ----------
function expected(a) {
  const ordinal = a.outcome === 'ordinal' || a.outcome === 'ord';
  const np = ordinal || (a.n30 === 'no' && (a.normal === 'no' || a.normal === 'unsure')) || a.outliers === 'yes';
  const small = a.smallExp === 'yes';
  if (a.goal === 'known') {
    if (a.outcome === 'categorical') return ['chiGof', null];
    return np ? ['wilcoxonSR', 'oneSampleT'] : ['oneSampleT', null];
  }
  if (a.goal === 'relate') {
    if (a.outcome === 'cat') return small ? ['fisherExact', 'chiIndep'] : ['chiIndep', null];
    if (a.outcome === 'ord') return ['spearman', null];
    return np ? ['spearman', 'pearsonRegression'] : ['pearsonRegression', null];
  }
  const two = a.groups === 'two', paired = a.design === 'paired';
  if (a.outcome === 'categorical') {
    if (paired) return [two ? 'mcnemar' : 'cochranQ', null];
    if (two && small) return ['fisherExact', 'chiIndep'];
    return ['chiIndep', null];
  }
  const cell = two
    ? (paired ? ['pairedT', 'wilcoxonSR', null] : ['welchT', 'mannWhitney', 'studentT'])
    : (paired ? ['rmAnova', 'friedman', null] : ['oneWayAnova', 'kruskalWallis', 'welchAnova']);
  return np ? [cell[1], cell[0]] : [cell[0], cell[2]];
}

// ---------- enumerate every reachable path ----------
function walk(a, out) {
  const vis = visibleSteps(a);
  const q = vis.find(s => stepKeys(s, a).some(k => a[k] === undefined));
  if (!q) { out.push(a); return; }
  const parts = q.parts(a);
  function rec(i, acc) {
    if (i === parts.length) { walk(acc, out); return; }
    parts[i].options.forEach(o => rec(i + 1, Object.assign({}, acc, { [parts[i].key]: o.value })));
  }
  rec(0, Object.assign({}, a));
}
const paths = [];
walk({}, paths);
const seenPrimary = new Set();
paths.forEach(a => {
  const d = decide(a);
  const [p, alt] = expected(a);
  const label = JSON.stringify(a);
  check(d.primary === p, label + ' primary ' + d.primary + ' expected ' + p);
  check(d.alternative === alt, label + ' alternative ' + d.alternative + ' expected ' + alt);
  check(Array.isArray(d.path) && d.path.length === visibleSteps(a).length, label + ' path covers every shown step');
  check(d.path.every(s => QUESTIONS.some(q => q.id === s.step) && s.label), label + ' path chips point at real steps');
  seenPrimary.add(d.primary);
});
['studentT', 'welchAnova'].forEach(id => check(!seenPrimary.has(id), id + ' is only ever an alternative'));
IDS.filter(id => id !== 'studentT' && id !== 'welchAnova').forEach(id => check(seenPrimary.has(id), id + ' reachable as primary'));

// ---------- showIf sanity ----------
check(!visibleSteps({ goal: 'relate', outcome: 'cc' }).some(q => q.id === 'groups' || q.id === 'design'), 'relate hides groups and design');
check(!visibleSteps({ goal: 'compare', outcome: 'ordinal', groups: 'two', design: 'indep' }).some(q => q.id === 'assumptions'), 'ordinal skips assumptions');
check(!visibleSteps({ goal: 'compare', outcome: 'categorical', groups: 'two', design: 'paired' }).some(q => q.id === 'assumptions'), 'paired categorical skips assumptions');

// ---------- spot checks straight from the manifest ----------
const spot = [
  [{ goal: 'compare', outcome: 'continuous', groups: 'two', design: 'indep', n30: 'yes', normal: 'no', outliers: 'no' }, 'welchT'],
  [{ goal: 'compare', outcome: 'continuous', groups: 'two', design: 'indep', n30: 'no', normal: 'unsure', outliers: 'no' }, 'mannWhitney'],
  [{ goal: 'compare', outcome: 'continuous', groups: 'three', design: 'paired', n30: 'yes', normal: 'yes', outliers: 'yes' }, 'friedman'],
  [{ goal: 'compare', outcome: 'categorical', groups: 'two', design: 'indep', smallExp: 'yes' }, 'fisherExact'],
  [{ goal: 'compare', outcome: 'categorical', groups: 'three', design: 'indep', smallExp: 'yes' }, 'chiIndep'],
  [{ goal: 'relate', outcome: 'cat', smallExp: 'yes' }, 'fisherExact'],
  [{ goal: 'known', outcome: 'ordinal' }, 'wilcoxonSR']
];
spot.forEach(([a, p]) => check(decide(a).primary === p, 'spot ' + JSON.stringify(a) + ' -> ' + p));

console.log(paths.length + ' reachable paths, ' + pass + ' checks passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
