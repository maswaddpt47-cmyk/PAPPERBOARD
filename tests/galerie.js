// Galerie des résultats (docs/galerie-resultats) : 12 formes × 4 états × 4 modes × 4 tailles
// avec les vraies fonctions de rendu. Échec si erreur JavaScript, débordement horizontal,
// résultat vide, ou résultat hors de l'écran en projection (768 px et plus).
// Lancé par tests/run.sh si Playwright est installé.
'use strict';
const { chromium } = require('playwright');
const path = require('path'); const FILE = 'file://' + path.resolve(__dirname, '..', 'docs', 'galerie-resultats', 'index.html');
const TYPES = ['yesno','poll','mcq','mcqm','scale','wordcloud','text','steps','points','wall','postit','dots'];
const STATES = ['vide','reponses','corrige','masque'];
const MODES = ['screen-dark','screen-light','participant','admin'];
const SIZES = [[1440,900],[1024,768],[768,1024],[390,844]];
(async () => {
  const b = await chromium.launch(); const page = await b.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(FILE);
  let n = 0, bad = [];
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h });
    for (const t of TYPES) for (const s of STATES) for (const m of MODES) {
      await page.evaluate(([t, s, m]) => { location.hash = `type=${t}&etat=${s}&mode=${m}`; }, [t, s, m]);
      await page.waitForTimeout(40);
      const r = await page.evaluate(() => {
        const out = document.getElementById('g-out');
        const de = document.documentElement;
        const items = out.querySelectorAll('li, .note, .donut, .gauge, .cloud-word, .s-answered');
        return { ov: de.scrollWidth - de.clientWidth, kids: out.children.length, txt: out.textContent.trim().length, bottom: Math.round(out.getBoundingClientRect().bottom), vh: innerHeight, items: items.length };
      });
      n++;
      const screenMode = m.startsWith('screen');
      if (r.ov > 0) bad.push(`DÉBORDEMENT ${t}/${s}/${m} ${w}px : +${r.ov}`);
      if (r.kids === 0 || r.txt === 0) bad.push(`VIDE ${t}/${s}/${m} ${w}px`);
      if (screenMode && w >= 768 && r.bottom > r.vh) bad.push(`HORS ÉCRAN ${t}/${s}/${m} ${w}x${h} : bas à ${r.bottom} > ${r.vh}`);
    }
  }
  bad.slice(0, 20).forEach(x => console.error('ÉCHEC : ' + x)); errs.slice(0, 5).forEach(x => console.error('ÉCHEC : erreur JS ' + x));
  console.log('galerie : ' + n + ' cas, ' + (bad.length + errs.length) + ' échec(s)');
  await b.close();
  process.exit(bad.length + errs.length ? 1 : 0);
})();
