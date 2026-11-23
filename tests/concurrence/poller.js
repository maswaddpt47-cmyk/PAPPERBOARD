'use strict';

module.exports = async function pollerConcurrency(ctx) {
  const {login, workshop, check, assert, deferred} = ctx;
  const admin = await login(), page = admin.page;
  const phase = name => console.log('Poller : '+name);
  const bounded = (promise,label,ms=10000) => {
    let timer;
    return Promise.race([promise,new Promise((_,reject) => { timer=setTimeout(() => reject(new Error('Attente bornée : '+label)),ms); })]).finally(() => clearTimeout(timer));
  };
  phase('connexion et atelier fictif');
  const title = 'Poller — atelier fictif de concurrence';
  const made = await workshop(admin, title, [
    {type:'poll',text:'Ancienne question fictive A',options:['Oui','Non']},
    {type:'poll',text:'Nouvelle question fictive B',options:['Oui','Non']}
  ]);
  const [a,b] = made.questions;
  await admin.post('control',{s:made.code,op:'goto',qid:a.id});
  await page.reload();
  await page.locator('#sessions:not([hidden])').waitFor();
  await page.evaluate(() => {
    window.__pollerTest = {data:[],status:[],schedules:[]};
    const tick = WL.Poller.prototype.tick, schedule = WL.Poller.prototype.schedule;
    WL.Poller.prototype.schedule = function (ms) {
      if (this.action === 'admin_state') window.__pollerTest.schedules.push(ms);
      return schedule.apply(this,arguments);
    };
    WL.Poller.prototype.tick = function () {
      if (this.action === 'admin_state') {
        window.__testedPoller = this;
        if (!this.__watched) {
          this.__watched = true;
          const data = this.onData, status = this.onStatus;
          this.onData = function (d) { window.__pollerTest.data.push(d.current); return data(d); };
          this.onStatus = function (kind,r) { window.__pollerTest.status.push(kind); return status(kind,r); };
        }
      }
      return tick.apply(this,arguments);
    };
  });
  let held = null, capture = null, rejectNext = false, requests = 0, routeError = null;
  const pattern = '**/api.php?action=admin_state*';
  await page.route(pattern, async route => {
    requests++;
    if (rejectNext) { rejectNext = false; await route.abort('failed'); return; }
    const take = capture; capture = null;
    try {
      const response = await route.fetch({timeout:15000}), body = await response.body();
      if (take) {
        const data = response.status() === 200 ? JSON.parse(body.toString()) : null;
        if (take.kind !== '304') {
          assert.equal(response.status(),200,'Précondition : état HTTP complet retenu');
          assert(Array.isArray(data.questions) && Array.isArray(data.asks) && typeof data.current === 'number','Précondition : admin_state complet');
        } else assert.equal(response.status(),304,'Précondition : ancien 304 conditionnel');
        take.response = {status:response.status(),etag:response.headers().etag,current:data && data.current};
        take.ready.resolve();
        await bounded(take.release.promise,'libération de la réponse retenue',20000);
        if (take.kind === 'reject') { await route.abort('failed'); return; }
      }
      await route.fulfill({response,body});
    } catch (error) {
      routeError = error;
      if (take) take.ready.reject(error);
      await route.abort('failed').catch(() => {});
    }
  });
  const settle = async () => {
    await bounded(page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))),'traitement des réponses dans le navigateur');
    if (routeError) throw routeError;
  };
  const snapshot = () => page.evaluate(() => {
    const p = window.__testedPoller, t = window.__pollerTest;
    return {etag:p.etag,failures:p.failures,delay:p.delay,stopped:p.stopped,timer:!!p.timer,
      dom:document.getElementById('live-text').textContent,data:t.data.slice(),status:t.status.slice(),schedules:t.schedules.slice()};
  });
  const clearTimer = () => page.evaluate(() => clearTimeout(window.__testedPoller.timer));
  const refreshTo = async question => {
    await admin.post('control',{s:made.code,op:'goto',qid:question.id});
    const before = (await snapshot()).data.length;
    const response = page.waitForResponse(r => r.url().includes('api.php?action=admin_state') && r.status() === 200);
    await page.evaluate(() => window.__testedPoller.refresh());
    await response;
    await page.waitForFunction(n => window.__pollerTest.data.length > n,before);
    await settle(); await clearTimer();
    assert.equal((await snapshot()).dom,question.text,'Précondition : état récent rendu');
  };
  const hold = async (kind='200') => {
    held = {kind,ready:deferred(),release:deferred()}; capture = held;
    await page.evaluate(conditional => window.__testedPoller[conditional ? 'now' : 'refresh'](),kind === '304');
    await bounded(held.ready.promise,'réponse ancienne capturée ('+kind+')');
    return held;
  };
  const release = async () => {
    const response = held.kind === 'reject' ? null : page.waitForResponse(r => r.url().includes('api.php?action=admin_state') && r.status() === held.response.status);
    const failed = held.kind === 'reject' ? page.waitForEvent('requestfailed',r => r.url().includes('api.php?action=admin_state')) : null;
    held.release.resolve();
    if (response) await response;
    if (failed) await failed;
    await settle(); held = null;
  };
  try {
    await page.evaluate(() => WL.spaceView('history'));
    await page.locator('#session-list .workshop-row').filter({hasText:title}).getByRole('button',{name:'Ouvrir',exact:true}).click();
    await page.locator('#editor:not([hidden])').waitFor(); await page.locator('#t-live').click();
    await page.waitForFunction(text => document.getElementById('live-text').textContent === text,a.text);
    await clearTimer();
    phase('contrôle séquentiel 304');
    const baseline = await snapshot();
    const response304 = page.waitForResponse(r => r.url().includes('api.php?action=admin_state') && r.status() === 304);
    await page.evaluate(() => window.__testedPoller.now()); await response304; await settle(); await clearTimer();
    const conditional = await snapshot();
    check(conditional.etag === baseline.etag && conditional.data.length === baseline.data.length && conditional.schedules.at(-1) === conditional.delay,
      'Poller : un 304 séquentiel conserve ETag et affichage, puis programme la suite');

    // Vrai clic Suivante : l’ancien état complet arrive après celui rendu par refresh().
    phase('ancien 200 après refresh');
    await hold();
    await page.locator('#tab-live [data-op="next"]').click();
    await page.waitForFunction(text => document.getElementById('live-text').textContent === text,b.text); await clearTimer();
    let recent = await snapshot(); await release(); let late = await snapshot();
    check(late.dom === b.text && late.etag === recent.etag && JSON.stringify(late.data) === JSON.stringify(recent.data)
      && JSON.stringify(late.status) === JSON.stringify(recent.status) && JSON.stringify(late.schedules) === JSON.stringify(recent.schedules),
      'Poller : ancien 200 ignoré avant ETag, callback, statut et programmation');

    // Visibilité simulée explicitement : le navigateur de CI garde les deux onglets visibles.
    phase('retour de visibilité simulé');
    await refreshTo(a); await hold();
    await page.evaluate(() => { Object.defineProperty(document,'hidden',{configurable:true,get:() => true}); document.dispatchEvent(new Event('visibilitychange')); });
    const beforeHidden = requests;
    await page.evaluate(() => window.__testedPoller.now()); await settle();
    check(requests === beforeHidden,'Poller : aucune requête pendant le masquage simulé');
    await admin.post('control',{s:made.code,op:'goto',qid:b.id});
    await page.evaluate(() => { Object.defineProperty(document,'hidden',{configurable:true,get:() => false}); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction(text => document.getElementById('live-text').textContent === text,b.text); await clearTimer();
    recent = await snapshot(); await release(); late = await snapshot();
    check(late.dom === b.text && late.etag === recent.etag && JSON.stringify(late.data) === JSON.stringify(recent.data),
      'Poller : retour de visibilité simulé, ancien état écarté après now()');
    await page.evaluate(() => delete document.hidden);

    // Un ancien échec réseau ne remet pas un état plus récent hors ligne.
    phase('ancien échec réseau');
    await refreshTo(a); await hold('reject');
    await refreshTo(b); recent = await snapshot(); await release(); late = await snapshot();
    check(late.failures === recent.failures && JSON.stringify(late.status) === JSON.stringify(recent.status)
      && JSON.stringify(late.schedules) === JSON.stringify(recent.schedules), 'Poller : ancien échec réseau ignoré avant statut, backoff et programmation');

    // Un ancien 304 ne remet pas à zéro l’échec de la requête récente.
    phase('ancien 304 après échec récent');
    await refreshTo(a); await hold('304');
    rejectNext = true;
    const failed = page.waitForEvent('requestfailed',r => r.url().includes('api.php?action=admin_state'));
    await page.evaluate(() => window.__testedPoller.refresh()); await failed; await settle(); await clearTimer();
    recent = await snapshot(); assert.equal(recent.failures,1,'Précondition : échec récent enregistré');
    await release(); late = await snapshot();
    check(late.failures === 1 && JSON.stringify(late.status) === JSON.stringify(recent.status)
      && JSON.stringify(late.schedules) === JSON.stringify(recent.schedules), 'Poller : ancien 304 ne rétablit pas la connexion après un échec récent');
    await refreshTo(b); late = await snapshot();
    check(late.failures === 0 && late.status.at(-1) === 'online' && late.delay >= 1000 && late.schedules.at(-1) === late.delay,
      'Poller : la réponse récente rétablit la connexion et conserve pollMs');

    // stop invalide la réponse retenue et interdit les appels ultérieurs, y compris refresh().
    phase('arrêt pendant une requête');
    await hold(); await page.evaluate(() => window.__testedPoller.stop()); recent = await snapshot();
    const beforeStoppedCalls = requests;
    await page.evaluate(() => { window.__testedPoller.now(); window.__testedPoller.refresh(); window.__testedPoller.tick(); });
    await settle();
    check(requests === beforeStoppedCalls,'Poller : aucun appel après stop');
    recent = await snapshot(); // refresh explicite peut vider l’ETag sans requête ni rendu.
    await release(); late = await snapshot();
    check(late.etag === recent.etag && late.failures === recent.failures && JSON.stringify(late.data) === JSON.stringify(recent.data)
      && JSON.stringify(late.status) === JSON.stringify(recent.status) && JSON.stringify(late.schedules) === JSON.stringify(recent.schedules),
      'Poller : réponse en attente ignorée après stop');
  } finally {
    if (held) held.release.resolve();
    await page.evaluate(() => { delete document.hidden; if (window.__testedPoller) window.__testedPoller.stop(); }).catch(() => {});
    await page.close(); await admin.context.close();
  }
};
