/* Integration checks for the real import module and application data functions.
 * No DOM emulator: event registration and initial rendering are not executed. */
'use strict';
const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const memory = new Map();
const downloads = [];
const context = {
  console, URL, TextEncoder,
  window: { icon: () => '' },
  document: { getElementById: id => id === 'workspace' ? {} : null },
  localStorage: { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(__dirname + '/preparation-tools.js', 'utf8'), context);
const source = fs.readFileSync(__dirname + '/app.js', 'utf8');
const eventStart = source.indexOf("\n  document.addEventListener('click'");
assert(eventStart > 0, 'Application data functions must precede delegated event handlers.');
context.captureDownload = (name, text, type) => downloads.push({ name, text, type });
vm.runInContext(source.slice(0, eventStart) + `
  download = globalThis.captureDownload;
  toast = function () {};
  globalThis.core = { fixture, validState, readState, save, makeId, answers,
    recordAnswer, endingCopy, participantOptions, quickQuestion, recap,
    exportMemo, exportCSV,
    getState: function () { return state; },
    setState: function (value) { state = value; },
    chooseDevice: function (id, index) { participantDevices[id] = index; }
  };
}());`, context);
const core = context.core;
const tools = context.window.WLPreparation;
const clone = value => JSON.parse(JSON.stringify(value));
let tests = 0;
function test(label, run) { run(); tests++; console.log('OK ' + label); }
function fresh() { core.setState(core.fixture('scams')); return core.getState(); }
function importer(overrides = {}) {
  let saves = 0, renders = 0;
  const hooks = {
    getState: core.getState,
    save: () => { saves++; core.save(); },
    render: () => { renders++; },
    makeId: core.makeId,
    ...overrides,
  };
  return { instance: tools.create(hooks), saves: () => saves, renders: () => renders };
}
const examples = [
  { type: 'mcq', text: 'Quel réflexe ?', options: ['Agir vite', 'Vérifier'], correct: 'Vérifier', explain: 'Prenez le temps de vérifier.' },
  { type: 'yesno', text: 'Peut-on demander conseil ?', correct: 'Oui' },
  { type: 'truefalse', text: 'Un cadenas garantit-il un site honnête ?', correct: 'Faux' },
  { type: 'poll', text: 'Votre préférence ?', options: ['A', 'B'] },
  { type: 'scale', text: 'Votre confiance ?', scaleMax: 10 },
  { type: 'text', text: 'Une idée à retenir ?' },
  { type: 'wordcloud', text: 'Un mot pour votre humeur ?' },
  { type: 'steps', text: 'Vérifier les notifications', options: ['Ouvrir', 'Choisir'], variants: { Windows: ['Ouvrez les paramètres.', 'Choisissez une application.'], Android: ['Ouvrez les réglages.', 'Choisissez les notifications.'] } },
  { type: 'conclusion', text: 'À retenir : vérifier <avant> de cliquer & demander conseil.' },
];
const raw = JSON.stringify(examples);
const multiRaw = JSON.stringify([{ type: 'mcq', text: 'Quels réflexes sont utiles ?', options: ['Faire une pause', 'Vérifier', 'Partager son code'], correct: ['Faire une pause', 'Vérifier'], multi: true }]);

test('L’aperçu des huit types ne modifie pas l’atelier', () => {
  const before = JSON.stringify(fresh());
  const preview = tools.parseImport(raw);
  assert.equal(preview.filter(item => item.q).length, 8);
  assert(preview.every(item => !item.error));
  assert.equal(JSON.stringify(core.getState()), before);
});

test('L’import réel produit un état accepté et persistant pour les huit types', () => {
  fresh(); const imp = importer();
  const result = imp.instance.commitImport(raw);
  assert.equal(result.ok, true);
  assert.equal(result.added, 8);
  assert.equal(imp.saves(), 1);
  assert.equal(imp.renders(), 1);
  const state = core.getState();
  assert.equal(new Set(state.questions.map(q => q.id)).size, state.questions.length);
  assert(core.validState(state));
  assert(core.validState(clone(state)));
  assert.equal(core.readState().conclusion, examples[8].text);
  assert.equal(core.readState().questions.length, 16);
});

test('Une sélection explicite importe uniquement les éléments cochés', () => {
  fresh(); const imp = importer();
  assert.equal(imp.instance.commitImport(raw, [1, 2]).added, 2);
  assert.deepEqual(Array.from(core.getState().questions.slice(-2), q => q.type), ['yesno', 'truefalse']);
  assert.notEqual(core.getState().conclusion, examples[8].text);
});

test('Une sélection invalide ne produit aucune modification partielle', () => {
  const before = JSON.stringify(fresh());
  const imp = importer();
  const invalid = JSON.stringify([examples[0], { type: 'unknown', text: 'Invalide' }, examples[8]]);
  assert.equal(imp.instance.commitImport(invalid, [0, 1, 2]).ok, false);
  assert.equal(JSON.stringify(core.getState()), before);
  assert.equal(imp.saves(), 0);
});

test('Le dépassement de cinquante questions conserve aussi l’ancienne conclusion', () => {
  const state = fresh(), template = clone(state.questions[0]);
  state.questions = Array.from({ length: 49 }, (_, i) => ({ ...clone(template), id: 'existing-' + i }));
  state.current = 0;
  const before = JSON.stringify(state), imp = importer();
  assert.equal(imp.instance.commitImport(JSON.stringify([examples[0], examples[1], examples[8]])).ok, false);
  assert.equal(JSON.stringify(state), before);
  assert.equal(imp.saves(), 0);
});

test('Une conclusion seule peut être enregistrée quand les cinquante places sont occupées', () => {
  const state = fresh(), template = clone(state.questions[0]);
  state.questions = Array.from({ length: 50 }, (_, i) => ({ ...clone(template), id: 'full-' + i }));
  state.current = 0;
  const result = importer().instance.commitImport(JSON.stringify([examples[8]]));
  assert.equal(result.ok, true);
  assert.equal(result.added, 0);
  assert.equal(state.questions.length, 50);
  assert.equal(state.conclusion, examples[8].text);
  assert(core.validState(state));
});

test('Une collision d’identifiants persistante annule tout l’import', () => {
  const before = JSON.stringify(fresh()), imp = importer({ makeId: () => 'q1' });
  assert.equal(imp.instance.commitImport(raw).ok, false);
  assert.equal(JSON.stringify(core.getState()), before);
  assert.equal(imp.saves(), 0);
});

test('Un QCM à plusieurs réponses est importé et compté par participant', () => {
  fresh(); const imp = importer();
  assert.equal(imp.instance.commitImport(multiRaw).ok, true);
  const q = core.getState().questions.at(-1);
  assert.equal(q.multi, true);
  assert.deepEqual(Array.from(q.correct), [0, 1]);
  q.state = 'open';
  assert.equal(core.recordAnswer(q, [0, 1], ''), true);
  assert.deepEqual(Array.from(q.counts), [1, 1, 0]);
  assert(core.answers(q, false).includes('100 %'));
  assert(core.validState(core.getState()));
});

test('Oui/Non et Vrai/Faux conservent leur correction et masquent les résultats publics', () => {
  fresh(); importer().instance.commitImport(raw, [1, 2]);
  for (const q of core.getState().questions.slice(-2)) {
    if (q.type === 'yesno' || q.type === 'truefalse') assert.equal((core.answers(q, false).match(/legend-correct/g) || []).length, 1);
    else assert.equal((core.answers(q, false).match(/is-correct/g) || []).length, 1);
    assert(core.answers(q, true).includes('restent masqués'));
    q.state = 'open';
    assert.equal(core.recordAnswer(q, [q.correct], ''), true);
    assert.equal(q.counts[q.correct], 1);
  }
  assert(core.validState(core.getState()));
});

test('Le nuage agrège les mots, échappe le HTML et refuse une réponse trop longue', () => {
  fresh(); importer().instance.commitImport(raw, [6]);
  const q = core.getState().questions.at(-1); q.state = 'open';
  assert(core.recordAnswer(q, [], 'Calme'));
  assert(core.recordAnswer(q, [], 'calme'));
  assert(core.recordAnswer(q, [], '<img src=x>'));
  assert.equal(core.recordAnswer(q, [], 'x'.repeat(81)), false);
  assert.equal(q.responses, 3);
  const html = core.answers(q, false);
  assert(html.includes('× 2'));
  assert(html.includes('&lt;img src=x&gt;'));
  assert(!html.includes('<img'));
  assert(core.validState(core.getState()));
});

test('Les variantes importées adaptent les consignes sans changer les indices des étapes', () => {
  fresh(); importer().instance.commitImport(raw, [7]);
  const q = core.getState().questions.at(-1);
  const first = core.participantOptions(q);
  assert(first.includes('Ouvrez les paramètres.'));
  assert(!first.includes('Ouvrez les réglages.'));
  core.chooseDevice(q.id, 1);
  const second = core.participantOptions(q);
  assert(second.includes('Ouvrez les réglages.'));
  assert(!second.includes('Ouvrez les paramètres.'));
  q.state = 'open';
  assert(core.recordAnswer(q, [0, 1], ''));
  assert.equal(q.responses, 1);
  assert.deepEqual(Array.from(q.counts), [1, 1]);
  assert(core.validState(core.getState()));
});

test('Tous les modèles rapides donnent un état rechargeable', () => {
  for (const [kind, keys] of [['ice', ['meteo', 'energie', 'mot']], ['closing', ['reflexe', 'question', 'mot', 'pas']], ['challenge', ['notifs', 'temps']]]) {
    for (const key of keys) {
      const state = fresh(); state.questions.push(core.quickQuestion(kind, key));
      assert(core.validState(state), kind + '/' + key);
    }
  }
});

test('La conclusion personnalisée est échappée à l’écran et incluse dans le mémo', () => {
  fresh(); importer().instance.commitImport(raw, [8]);
  const state = core.getState();
  state.questions[5].texts = ['REPONSE_PRIVEE_A_EXCLURE']; state.questions[5].responses = 1;
  assert(core.endingCopy().includes('&lt;avant&gt;'));
  assert(core.recap().includes('&lt;avant&gt;'));
  downloads.length = 0; core.exportMemo();
  assert.equal(downloads.length, 1);
  assert(downloads[0].text.includes(examples[8].text));
  assert(!downloads[0].text.includes('REPONSE_PRIVEE_A_EXCLURE'));
  core.save(); assert.equal(core.readState().conclusion, examples[8].text);
});

test('Un ancien essai sans conclusion reste rechargeable', () => {
  const state = fresh(); delete state.conclusion;
  memory.set('wl_sandbox_v3', JSON.stringify(state));
  const restored = core.readState();
  assert.equal(restored.conclusion, '');
  assert.equal(restored.questions.length, state.questions.length);
  assert.equal(restored.questions[1].title, state.questions[1].title);
});

console.log(tests + ' scénarios d’intégration préparation validés. Aucun réseau ni émulateur DOM.');
