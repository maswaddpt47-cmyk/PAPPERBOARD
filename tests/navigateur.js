// Parcours réel dans Chromium (Playwright) : animateur, participant sur
// téléphone, projection. Vérifie aussi l'absence d'erreur JS et de blocage
// CSP, et compte les requêtes émises par un téléphone pendant une question.
// Lancé par tests/run.sh si Playwright est installé (sinon ignoré).
'use strict';

const { chromium } = require('playwright');

const BASE = process.env.WL_BASE;
let ok = 0, ko = 0;
function check(cond, label) {
  if (cond) ok++; else { ko++; console.error('ÉCHEC : ' + label); }
}

(async () => {
  const browser = await chromium.launch(process.env.WL_CHROMIUM ? { executablePath: process.env.WL_CHROMIUM } : {});
  const errors = [];
  const watch = (page, name) => {
    page.on('pageerror', e => errors.push(name + ' : ' + e.message));
    // Erreurs attendues : la coupure réseau provoquée plus bas, et le refus
    // (409) de rejoindre une session terminée quand la page est rouverte.
    page.on('console', m => {
      if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED|status of 409/.test(m.text())) errors.push(name + ' : ' + m.text());
    });
  };

  // --- Animateur : connexion, session, question --------------------------------
  const admin = await (await browser.newContext()).newPage();
  watch(admin, 'animateur');
  await admin.goto(BASE + 'admin.php');
  await admin.fill('#password', process.env.WL_PASSWORD);
  await admin.click('#login-form button');
  await admin.fill('#new-title', 'Atelier navigateur');
  await admin.click('#create-form button');
  await admin.waitForSelector('#editor:not([hidden])');
  const code = (await admin.textContent('#ed-code')).trim();
  check(/^[A-Z2-9]{5}$/.test(code), 'code affiché dans l\'éditeur');
  check(await admin.locator('#ed-qr img').count() === 1, 'QR code animateur');

  await admin.click('#add-q-btn');
  await admin.fill('#qf-text', 'Utilisez-vous internet ?');
  await admin.check('#qf-correct input[value="0"]');
  await admin.uncheck('#qf-change'); // réponse figée : un appui ne vote pas, « Envoyer » vote
  await admin.click('#qf-save');
  await admin.waitForSelector('#q-list .list-item');
  await admin.click('#add-q-btn');
  await admin.selectOption('#qf-type', 'truefalse');
  await admin.fill('#qf-text', 'Vrai ou faux ?');
  await admin.check('#qf-correct input[value="0"]');
  await admin.click('#qf-save');
  await admin.waitForFunction(() => document.querySelectorAll('#q-list .list-item').length === 2);
  await admin.click('#add-q-btn');
  await admin.selectOption('#qf-type', 'wordcloud');
  await admin.fill('#qf-text', 'Un mot ?');
  await admin.click('#qf-save');
  await admin.waitForFunction(() => document.querySelectorAll('#q-list .list-item').length === 3);
  check(await admin.locator('#tab-live').isHidden(), 'onglets : un seul panneau visible');
  await admin.click('#t-live');
  await admin.click('#live [data-op="next"]'); // quitte l'accueil et ouvre le vote
  await admin.waitForFunction(() => document.getElementById('open-btn').textContent === 'Fermer le vote');

  // --- Projection ------------------------------------------------------------------
  const screen = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  watch(screen, 'projection');
  await screen.goto(BASE + 'screen.php?s=' + code);
  await screen.waitForSelector('#s-question:not([hidden])');
  check(await screen.locator('#qr img').count() === 1, 'QR code sur la projection');
  check((await screen.textContent('#s-text')) === 'Utilisez-vous internet ?', 'question projetée');

  // --- Participant sur téléphone -------------------------------------------------
  const phoneCtx = await browser.newContext({ viewport: { width: 375, height: 700 }, isMobile: true, hasTouch: true });
  const phone = await phoneCtx.newPage();
  watch(phone, 'participant');
  await phone.goto(BASE);
  await phone.fill('#code', code.toLowerCase());
  await phone.click('#join-form button');
  await phone.waitForSelector('#question:not([hidden]) .btn-choice');
  const votes = [];
  phone.on('request', r => { if (r.url().includes('action=vote')) votes.push(r.url()); });
  await phone.click('.btn-choice >> text=Oui');
  await phone.waitForTimeout(300);
  check(votes.length === 0, 'choisir n\'envoie rien avant « Envoyer »');
  await phone.click('#answer-form button[type="submit"]');
  await phone.waitForFunction(() => /Réponse enregistrée/.test(document.getElementById('answer-status').textContent));
  check(votes.length === 1, 'vote envoyé par le bouton « Envoyer »');
  check(await phone.getAttribute('.btn-choice >> text=Oui', 'aria-pressed') === 'true', 'choix marqué');

  // Coût : requêtes du téléphone pendant 10 s sans changement.
  const requests = [];
  phone.on('response', r => { if (r.url().includes('action=state')) requests.push(r.status()); });
  await phone.waitForTimeout(10000);
  const bodies = requests.filter(s => s === 200).length;
  console.log('coût : ' + requests.length + ' requêtes en 10 s (' + bodies + ' avec corps)');
  check(requests.length >= 4 && requests.length <= 6, 'environ une requête toutes les 2 s (' + requests.length + ')');
  check(bodies === 0, 'aucun corps renvoyé sans changement');

  // Résultats et correction.
  await admin.click('#open-btn');
  await admin.click('#show-btn');
  // Oui / Non projeté en anneau (charts.js) : bonne réponse cochée dans la légende.
  await screen.waitForSelector('#s-results .donut-legend .is-good');
  check(/100 % · Bonne réponse/.test(await screen.textContent('#s-results .donut-legend .is-good')), 'résultat projeté');
  await phone.waitForSelector('#my-result:not([hidden])');
  check(/Bonne réponse !/.test(await phone.textContent('#my-result')), 'correction sur le téléphone');

  // Vrai/Faux corrigé et modifiable : un appui envoie tout de suite, sans « Envoyer ».
  await admin.click('#live [data-op="next"]');
  await phone.waitForSelector('.btn-choice >> text=Vrai');
  await admin.waitForFunction(() => /Vrai ou faux/.test(document.getElementById('live-text').textContent));
  // Fermer un vote sans aucune réponse demande confirmation (espace animateur et projection).
  let warned = '';
  admin.once('dialog', d => { warned = d.message(); d.dismiss(); });
  await admin.click('#open-btn');
  check(/Personne n'a encore répondu/.test(warned), 'animateur : confirmation avant de fermer un vote sans réponse');
  check((await admin.textContent('#open-btn')) === 'Fermer le vote', 'animateur : vote resté ouvert après refus');
  const early = await admin.context().newPage();
  await early.goto(BASE + 'screen.php?s=' + code);
  await early.waitForFunction(() => document.getElementById('p-step') && document.getElementById('p-step').textContent === 'Fermer le vote');
  await early.click('#p-step');
  check(/confirmer/.test(await early.textContent('#p-step')), 'projection : un second appui demandé pour fermer sans réponse');
  await early.close();
  votes.length = 0;
  await phone.click('.btn-choice >> text=Vrai');
  await phone.waitForFunction(() => /Réponse enregistrée/.test(document.getElementById('answer-status').textContent));
  check(votes.length === 1, 'Vrai/Faux corrigé : un appui envoie tout de suite');

  // Nuage de mots, puis reconnexion après coupure réseau.
  await admin.click('#live [data-op="next"]');
  await admin.waitForFunction(() => /Un mot/.test(document.getElementById('live-text').textContent));
  await phone.waitForSelector('#free:not([disabled])');
  await phoneCtx.setOffline(true);
  await phone.fill('#free', 'Écran');
  await phone.click('#answer-form button[type=submit]');
  await phone.waitForSelector('#banner:not([hidden])');
  check(/Connexion perdue/.test(await phone.textContent('#banner')), 'message de connexion perdue');
  await phoneCtx.setOffline(false);
  await phone.waitForFunction(() => /Réponse enregistrée/.test(document.getElementById('answer-status').textContent), null, { timeout: 20000 });
  check(true, 'réponse envoyée au retour du réseau');
  await admin.click('#show-btn');
  await screen.waitForSelector('.cloud-word');
  check((await screen.textContent('.cloud-word')) === 'Écran', 'mot affiché dans le nuage');
  // Un mot qui porte le nom d'une propriété JS ne doit pas casser l'affichage.
  await phone.fill('#free', 'constructor');
  await phone.click('#answer-form button[type=submit]');
  await screen.waitForFunction(() => /constructor/.test(document.getElementById('s-results').textContent), null, { timeout: 10000 });
  check(true, 'mot « constructor » affiché sans erreur');

  // Session terminée, avec une conclusion.
  await admin.click('#t-prep');
  await admin.fill('#conclusion', 'Conclusion de test');
  await admin.click('#conclusion-btn');
  await admin.waitForFunction(() => document.getElementById('conclusion-saved').textContent !== '');
  admin.once('dialog', d => d.accept());
  await admin.click('#t-settings');
  await admin.click('#end-btn');
  await phone.waitForSelector('#ended:not([hidden])');
  check(true, 'fin de session sur le téléphone');
  await phone.reload();
  await phone.waitForSelector('#ended:not([hidden])');
  await phone.waitForFunction(() => /Conclusion de test/.test(document.getElementById('recap').textContent));
  check(true, 'page rouverte après la fin : conclusion affichée sur le téléphone');

  // Bilan projeté depuis une projection pilotée (cookie animateur), après la fin.
  const pilot = await admin.context().newPage();
  watch(pilot, 'projection pilotée');
  await pilot.setViewportSize({ width: 1280, height: 720 });
  await pilot.goto(BASE + 'screen.php?s=' + code);
  await pilot.waitForSelector('#s-pilot:not([hidden])');
  check(await pilot.locator('#p-reopen').isHidden(), 'session terminée : pas de « Rouvrir le vote »');
  await pilot.click('#p-board');
  await pilot.waitForFunction(() => /^Bilan — 1 \//.test(document.getElementById('s-meta').textContent));
  await pilot.keyboard.press('ArrowRight');
  await pilot.waitForFunction(() => /^Bilan — 2 \//.test(document.getElementById('s-meta').textContent));
  check(true, 'bilan projeté : diapositive suivante à la flèche');
  await pilot.click('#p-step');
  await pilot.waitForSelector('#s-ended:not([hidden])');
  check(await pilot.locator('#p-step').isHidden(), 'bilan quitté : retour au récap de fin');
  await pilot.close();

  // --- Génération par une IA : texte copié, réponse collée, aperçu, ajout ----------
  await admin.click('#t-prep');
  await admin.click('#gen-btn');
  await admin.fill('#gen-theme', 'Les arnaques en ligne');
  await admin.click('#gen-copy');
  check((await admin.inputValue('#gen-prompt')).includes('Thème : Les arnaques en ligne'), 'génération : texte pour l\'IA');
  await admin.fill('#gen-raw', '[{"type":"poll","text":"Déjà reçu un faux SMS ?","options":["Oui","Non"]},'
    + '{"type":"truefalse","text":"La banque demande le code par SMS.","correct":"Faux"}]');
  await admin.click('#gen-check');
  await admin.waitForSelector('#gen-list input');
  check(await admin.locator('#gen-list input:checked').count() === 2, 'génération : aperçu, tout coché');
  await admin.click('#gen-review');
  const review = await admin.inputValue('#gen-prompt');
  check(review.includes('n\'invente jamais') && review.includes('Déjà reçu un faux SMS'), 'relecture : consigne avec sources et questions');
  await admin.uncheck('#gen-list input[value="0"]');
  await admin.click('#gen-save');
  await admin.waitForFunction(() => document.querySelectorAll('#q-list .list-item').length === 4);
  check(!(await admin.locator('#gen-dialog').evaluate(d => d.open)), 'génération : question cochée ajoutée, fenêtre fermée');
  await admin.click('#gen-btn');
  await admin.setInputFiles('#gen-file', { name: 'questions.json', mimeType: 'application/json',
    buffer: Buffer.from('[{"type":"wordcloud","text":"Un mot importé ?"}]') });
  await admin.waitForSelector('#gen-list input');
  await admin.click('#gen-save');
  await admin.waitForFunction(() => document.querySelectorAll('#q-list .list-item').length === 5);
  check(true, 'import d\'un fichier JSON : lu, vérifié, ajouté');

  check(errors.length === 0, 'aucune erreur JS ni blocage CSP :\n  ' + errors.join('\n  '));
  await browser.close();
  console.log('navigateur : ' + ok + ' vérifications OK, ' + ko + ' échec(s)');
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
