// Vraie voie d'entrée : fichier PDF fictif avec page image, texte et ancien
// nuage. Aucun PDF utilisateur ni résultat réel n'est conservé dans les tests.
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.WL_BASE;
let ok = 0;
function check(test, label) { if (!test) throw new Error(label); ok++; }
(async () => {
  const browser = await chromium.launch(process.env.WL_CHROMIUM ? { executablePath: process.env.WL_CHROMIUM } : {});
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [], remote = [], writes = [];
    page.on('pageerror', e => errors.push(e.message));
    // Diagnostics du moteur natif OCR, écrits sur stderr, sans être des échecs
    // navigateur. Les erreurs JavaScript, réseau et CSP restent contrôlées.
    page.on('console', m => { if (m.type() === 'error' && !/^(Estimating resolution as \d+|Detected \d+ diacritics)$/.test(m.text())) errors.push(m.text()); });
    page.on('request', r => {
      if (r.url().startsWith('http') && !r.url().startsWith(BASE)) remote.push(r.url());
      if (r.method() === 'POST') writes.push(r.url());
    });
    await page.goto(BASE + 'admin.php');
    for (const engine of ['pdf', 'ocr']) {
      const response = await page.request.get(BASE + 'import-worker.php?engine=' + engine);
      const csp = response.headers()['content-security-policy'];
      check(response.ok() && csp.includes("connect-src 'self'") && csp.includes("worker-src 'none'")
        && !csp.includes("'unsafe-eval'") && (engine === 'ocr') === csp.includes("'wasm-unsafe-eval'"), 'CSP propre au worker ' + engine + ', réseau limité au site');
    }
    check((await page.request.get(BASE + 'import-worker.php?engine=../../config.php')).status() === 404, 'worker : choix fermé, aucun chemin de fichier arbitraire');
    check(!await page.evaluate(() => performance.getEntriesByType('resource').some(r => r.name.includes('/vendor/mentimeter/'))), 'PDF/OCR absents du chargement ordinaire');
    await page.fill('#password', process.env.WL_PASSWORD);
    await page.click('#login-form button');
    await page.waitForSelector('#sessions:not([hidden])');
    const api = page.context().request;
    const sessions = async () => (await (await api.get(BASE + 'api.php?action=sessions')).json()).sessions.length;
    const before = await sessions();
    const open = async () => {
      await page.click('#create-btn'); await page.fill('#new-title', 'Import PDF fictif');
      await page.check('#create-mentimeter'); await page.click('#create-ok');
      await page.waitForSelector('#menti-dialog[open]');
    };
    const waitPage = async n => page.waitForFunction(n =>
      !document.querySelector('#menti-fields').disabled && document.querySelector('#menti-status').textContent.includes('Page ' + n + ' sur'), n, { timeout: 120000 });
    await open();
    await page.setInputFiles('#menti-file', { name: 'pas-un-pdf.pdf', mimeType: 'application/pdf', buffer: Buffer.from('<script>alert(1)</script>') });
    await page.waitForFunction(() => document.querySelector('#menti-error').textContent.length > 0);
    check(await page.isDisabled('#menti-continue') && await sessions() === before, 'faux PDF refusé sans créer de session');
    const fixture = path.join(__dirname, 'fixtures/questionnaire.pdf');
    const writeStart = writes.length;
    await page.setInputFiles('#menti-file', fixture); await waitPage(1);
    check((await page.inputValue('#menti-text')).includes('ordinateur') && (await page.inputValue('#menti-options')).includes('Oui'),
      'page image passée par PDF.js et OCR français : ' + JSON.stringify({ text: await page.inputValue('#menti-text'), type: await page.inputValue('#menti-type'), options: await page.inputValue('#menti-options') }));
    await page.selectOption('#menti-type', 'yesno'); // confirmation humaine du type, l'OCR reste une proposition
    check(await page.isDisabled('#menti-continue'), 'relecture obligatoire avant l’aperçu');
    await page.check('#menti-reviewed');
    check(!await page.isDisabled('#menti-continue'), 'question relue utilisable');
    await page.fill('#menti-text', 'Avez-vous un ordinateur personnel ?');
    check(!await page.isChecked('#menti-reviewed') && await page.isDisabled('#menti-continue'), 'modifier une question invalide sa confirmation');
    await page.check('#menti-reviewed');
    await page.selectOption('#menti-page', '1'); await waitPage(2);
    check((await page.inputValue('#menti-type')) === 'mcq' && await page.isChecked('#menti-multi'), 'PDF texte : plusieurs choix reconnus');
    check((await page.inputValue('#menti-options')).split('\n').length === 3, 'PDF texte : trois libellés conservés, sans résultat');
    await page.check('#menti-reviewed');
    await page.click('#menti-add');
    await page.fill('#menti-text', 'Une seconde question sur la même page ?');
    await page.check('#menti-reviewed');
    await page.selectOption('#menti-question', '0');
    check((await page.inputValue('#menti-text')).includes('activites') && await page.isChecked('#menti-reviewed'), 'plusieurs questions sur une page : brouillons conservés');
    await page.selectOption('#menti-page', '2'); await waitPage(3);
    check((await page.inputValue('#menti-type')) === 'skip', 'diapositive de présentation écartée par défaut');
    await page.selectOption('#menti-page', '3'); await waitPage(4);
    check((await page.inputValue('#menti-type')) === 'wordcloud' && (await page.inputValue('#menti-options')) === '', 'nuage : les anciens mots ne deviennent pas des choix');
    await page.check('#menti-reviewed');
    check(writes.length === writeStart && await sessions() === before, 'fichier et OCR ne déclenchent aucun envoi ni création');
    const privacy = await page.evaluate(() => {
      const q = WL.Mentimeter.question({ type: 'poll', text: 'Question ?', options: ['A', 'B'], reviewed: true,
        answers: ['HISTORIQUE-SECRET'], correct: [0], url: 'https://example.com' }, 1);
      return q;
    });
    check(!('answers' in privacy) && !('correct' in privacy) && !('url' in privacy), 'liste de champs fermée : aucun résultat, correction ou lien repris du PDF');
    for (const size of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      const fit = await page.evaluate(() => {
        const d = document.querySelector('#menti-dialog');
        return d.scrollWidth <= d.clientWidth + 1 && d.getBoundingClientRect().left >= 0 && d.getBoundingClientRect().right <= innerWidth;
      });
      check(fit, 'import sans débordement horizontal à ' + size.width + ' px');
    }
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.click('#menti-continue');
    await page.waitForSelector('#gen-preview:not([hidden])');
    check((await page.locator('#gen-list input:checked').count()) === 4, 'aperçu serveur : quatre questions et aucune diapositive');
    check(await page.isHidden('#gen-generation') && (await page.textContent('#gen-title')).includes('PDF'), 'aperçu dédié au PDF');
    await page.click('#gen-cancel');
    check(await sessions() === before, 'annuler après la relecture ne crée rien');
    // Un second passage par le vrai fichier vérifie la libération puis la reprise.
    await open();
    await page.setInputFiles('#menti-file', fixture); await waitPage(1);
    await page.selectOption('#menti-type', 'yesno');
    await page.check('#menti-reviewed');
    page.once('dialog', dialog => dialog.accept()); // trois pages non examinées explicitement ignorées
    await page.click('#menti-continue');
    await page.waitForSelector('#gen-preview:not([hidden])');
    await page.click('#gen-save');
    await page.waitForSelector('#editor:not([hidden])');
    const code = (await page.textContent('#ed-code')).trim();
    const state = await (await api.get(BASE + 'api.php?action=admin_state&s=' + code)).json();
    check(await sessions() === before + 1 && state.questions.length === 1, 'création finale : une seule session et la sélection relue');
    check(state.participants === 0 && state.questions[0].results.total === 0 && state.questions[0].correct.length === 0, 'atelier créé sans participant, vote ni correction historique');
    const exported = await (await api.get(BASE + 'api.php?action=export&format=questions&s=' + code)).text();
    check(!exported.includes('HISTORIQUE-SECRET') && !exported.includes('70%'), 'export pédagogique sans anciens résultats');
    const csrf = (await (await api.get(BASE + 'api.php?action=me')).json()).csrf;
    await api.post(BASE + 'api.php?action=session_delete', { headers: { 'X-WL': '1', 'X-CSRF-Token': csrf }, data: { s: code } });
    check(remote.length === 0, 'aucune requête à un tiers pendant PDF et OCR');
    check(errors.length === 0, 'aucune erreur navigateur ni violation CSP : ' + errors.join('; '));
    console.log('✅ Import PDF : ' + ok + ' contrôles');
  } finally { await browser.close(); }
})().catch(e => { console.error('ÉCHEC import PDF : ' + e.stack); process.exitCode = 1; });
