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
    // La coupure réseau provoquée plus bas produit une erreur attendue.
    page.on('console', m => {
      if (m.type() === 'error' && !/ERR_INTERNET_DISCONNECTED/.test(m.text())) errors.push(name + ' : ' + m.text());
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
  await admin.click('#qf-save');
  await admin.waitForSelector('#q-list .list-item');
  await admin.click('#add-q-btn');
  await admin.selectOption('#qf-type', 'wordcloud');
  await admin.fill('#qf-text', 'Un mot ?');
  await admin.click('#qf-save');
  await admin.waitForFunction(() => document.querySelectorAll('#q-list .list-item').length === 2);
  await admin.click('#open-btn');
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
  await phone.click('.btn-choice >> text=Oui');
  await phone.waitForFunction(() => /Réponse enregistrée/.test(document.getElementById('answer-status').textContent));
  check(true, 'vote en un geste');
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
  await screen.waitForSelector('#s-results .bar-good');
  check(/1 \(100 %\)/.test(await screen.textContent('#s-results')), 'résultat projeté');
  await phone.waitForSelector('#my-result:not([hidden])');
  check(/Bonne réponse !/.test(await phone.textContent('#my-result')), 'correction sur le téléphone');

  // Nuage de mots, puis reconnexion après coupure réseau.
  await admin.click('#live [data-op="next"]');
  await admin.waitForFunction(() => /Un mot/.test(document.getElementById('live-text').textContent));
  await admin.click('#open-btn');
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

  // Session terminée.
  admin.once('dialog', d => d.accept());
  await admin.click('#end-btn');
  await phone.waitForSelector('#ended:not([hidden])');
  check(true, 'fin de session sur le téléphone');

  check(errors.length === 0, 'aucune erreur JS ni blocage CSP :\n  ' + errors.join('\n  '));
  await browser.close();
  console.log('navigateur : ' + ok + ' vérifications OK, ' + ko + ' échec(s)');
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
