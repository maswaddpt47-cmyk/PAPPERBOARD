// File participant : vrais formulaires, réponses HTTP retenues, données fictives.
'use strict';
module.exports = async function (ctx) {
  const {login, workshop, participant, check, assert, delay, deferred} = ctx;
  const admin = await login();
  const voteUrl = /\/api\.php\?action=vote(?:&|$)/;
  const pending = page => page.evaluate(() => JSON.parse(sessionStorage.getItem('wl_pending') || 'null'));
  const send = async (page, value) => {
    await page.locator('#free').fill(value);
    await page.locator('#answer-form button[type=submit]').click();
  };
  const within = (promise, label) => {
    let timer;
    return Promise.race([promise, new Promise((_, reject) => { timer=setTimeout(() => reject(Error(label)),10000); })]).finally(() => clearTimeout(timer));
  };
  const eventually = async (predicate, ms = 2200) => {
    const end = Date.now() + ms;
    do { if (await predicate()) return true; await delay(50); } while (Date.now() < end);
    return false;
  };
  async function make(title, type = 'wordcloud', count = 1) {
    const questions = Array.from({length: count}, (_, i) => ({
      type, text: title + ' question ' + i + ' fictive', allowChange: true,
      ...(type === 'poll' ? {options: ['Premier fictif', 'Dernier fictif']} : {})
    }));
    const w = await workshop(admin, title, questions);
    await admin.post('control', {s: w.code, op: 'goto', qid: w.questions[0].id});
    const p = await participant(w.code, type === 'poll' ? '.btn-choice' : '#free');
    assert.equal((await p.read()).question.allowChange, true, 'parcours de réponses modifiables');
    return {...w, ...p};
  }
  try {
    // Même horodatage/question : l'identité doit distinguer les deux saisies.
    // Les variantes 400 et 403 ne sont pas des pannes réelles du serveur :
    // leurs réponses HTTP sont injectées, le dernier vote atteint bien l'API.
    for (const status of [200, 400, 403]) {
      const p = await make('Acquittement ' + status);
      const held = deferred(), release = deferred();
      const votes = [];
      try {
        await p.page.evaluate(() => { window.__pendingClock = Date.now; const fixed = Date.now(); Date.now = () => fixed; });
        await p.page.route(voteUrl, async route => {
          votes.push(route.request().postDataJSON());
          if (votes.length !== 1) return route.continue();
          const response = status === 200 ? await route.fetch() : null;
          held.resolve();
          await release.promise;
          if (response) await route.fulfill({response});
          else await route.fulfill({status, contentType: 'application/json', body: JSON.stringify({
            ok: false, error: status === 403 ? 'Rejoignez cet atelier fictif.' : 'Refus fictif.'
          })});
        });
        await send(p.page, 'premier fictif');
        await within(held.promise, 'ancien HTTP non retenu');
        const first = await pending(p.page);
        await send(p.page, 'dernier fictif');
        const latest = await pending(p.page);
        assert.equal(latest.value, 'dernier fictif', 'seconde saisie réellement mise en attente');
        assert.equal(votes.length, 1, 'un seul vote en vol');
        assert.equal(first.at, latest.at, 'horodatage réellement identique');
        check(first.seq !== latest.seq, status + ' : réponses distinguées malgré même date et question');
        await p.page.evaluate(() => { Date.now = window.__pendingClock; });
        release.resolve();
        const saved = await eventually(async () => (await p.read()).mine === 'dernier fictif', status === 403 ? 6500 : 2200);
        check(saved, status + ' : dernière réponse conservée et enregistrée');
        if (saved) await p.page.waitForFunction(() => sessionStorage.getItem('wl_pending') === null);
        check(votes.length === 2 && votes[1].value === 'dernier fictif', status + ' : exactement deux votes, sans restauration ancienne');
      } finally { release.resolve(); await p.context.close(); }
    }

    // Une réponse de A en vol ne doit jamais devenir mine sur B.
    const other = await make('Changement de question', 'wordcloud', 2);
    const held = deferred(), release = deferred();
    const otherVotes = [];
    try {
      await other.page.route(voteUrl, async route => {
        otherVotes.push(route.request().postDataJSON());
        if (otherVotes.length !== 1) return route.continue();
        const response = await route.fetch(); held.resolve(); await release.promise; await route.fulfill({response});
      });
      await send(other.page, 'ancienne question fictive');
      await within(held.promise, 'réponse A non retenue');
      await admin.post('control', {s: other.code, op: 'goto', qid: other.questions[1].id});
      await other.page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      await other.page.waitForFunction(text => document.getElementById('q-text').textContent === text, other.questions[1].text);
      await send(other.page, 'nouvelle question fictive');
      assert.equal((await pending(other.page)).qid, other.questions[1].id);
      // Capturer aussi les données remises au rendu : une poll ultérieure peut
      // masquer une mauvaise affectation transitoire de state.mine.
      await other.page.evaluate(() => {
        window.__pendingOtherMines = [];
        const original = WL.clear;
        WL.clear = function (node) {
          if (node.id === 'answer-form') setTimeout(() => {
            const input = document.getElementById('free');
            window.__pendingOtherMines.push(input && input.value);
          }, 0);
          return original(node);
        };
      });
      release.resolve();
      check(await eventually(async () => (await other.read()).mine === 'nouvelle question fictive'), 'autre question : réponse B enregistrée après acquittement de A');
      await delay(100);
      check(!(await other.page.evaluate(() => window.__pendingOtherMines)).includes('ancienne question fictive'), 'autre question : mine de A jamais affiché sur B');
      check(otherVotes.length === 2 && otherVotes[1].qid === other.questions[1].id, 'autre question : deux votes vers leurs questions respectives');
    } finally { release.resolve(); await other.context.close(); }

    // Vraie coupure : la réponse courante et son identité restent en session,
    // puis un acquittement perdu peut être repris sans doubler le participant.
    const network = await make('Reprise réseau');
    try {
      await network.context.setOffline(true);
      await send(network.page, 'réponse réseau fictive');
      await network.page.waitForFunction(() => /Connexion perdue/.test(document.getElementById('banner').textContent));
      const queued = await pending(network.page);
      check(queued.value === 'réponse réseau fictive', 'réseau : réponse conservée avant la reprise');
      const identities = [], attempts = [];
      await network.page.route(voteUrl, async route => {
        identities.push(JSON.stringify(await pending(network.page)));
        attempts.push(route.request().postDataJSON());
        if (attempts.length === 1) { await route.fetch(); return route.abort('failed'); }
        return route.continue();
      });
      await network.context.setOffline(false);
      const sent = await eventually(async () => (await pending(network.page)) === null, 10000);
      check(sent && (await network.read()).mine === 'réponse réseau fictive', 'réseau : réponse reprise après coupure et acquittement perdu');
      check(attempts.length === 2 && identities.every(entry => entry === JSON.stringify(queued)), 'réseau : même réponse conservée lors des reprises, pas de boucle');
      const state = await admin.read('admin_state', 's=' + network.code);
      check(state.participants === 1 && state.questions[0].results.total === 1, 'réseau : un seul participant et une seule réponse après reprises');
    } finally { await network.context.close(); }

    // Entrée antérieure au correctif (sans id) : la page rechargée la reprend.
    const legacy = await make('Ancienne file');
    try {
      let legacySent;
      await legacy.page.route(voteUrl, async route => {
        legacySent = (await pending(legacy.page)).value;
        await route.continue();
      });
      await legacy.page.evaluate(p => sessionStorage.setItem('wl_pending', JSON.stringify(p)), {
        code: legacy.code, qid: legacy.questions[0].id, value: 'ancienne file fictive', at: Date.now()
      });
      await legacy.page.reload();
      check(await eventually(async () => (await legacy.read()).mine === 'ancienne file fictive', 5000), 'compatibilité : ancienne entrée sans identité transmise');
      check(legacySent === 'ancienne file fictive', 'compatibilité : ancienne entrée conservée jusqu’à son envoi');
      check(await eventually(async () => (await pending(legacy.page)) === null), 'compatibilité : ancienne entrée acquittée sans boucle');
    } finally { await legacy.context.close(); }

    // 403 permanent : borner la route limite le coût du test rouge lui-même.
    const denied = await make('Refus permanent');
    const times = [];
    try {
      await denied.page.route(voteUrl, async route => {
        times.push(Date.now());
        if (times.length > 4) return route.abort('failed');
        await route.fulfill({status: 403, contentType: 'application/json', body: JSON.stringify({ok: false, error: 'Rejoignez cet atelier fictif.'})});
      });
      await send(denied.page, 'refus permanent fictif');
      await eventually(() => times.length >= 2, 5500);
      console.log('403 permanent : '+times.length+' tentatives ; écarts ms = '+times.slice(1).map((t,i)=>t-times[i]).join(', '));
      check(times.length >= 2 && times.length <= 4 && times[1] - times[0] >= 500, '403 permanent : reprises espacées, sans boucle join/vote');
      check((await pending(denied.page))?.value === 'refus permanent fictif', '403 permanent : réponse conservée en attente');
    } finally { await denied.context.close(); }

    // Contrôle : un deuxième appui instantané pendant l'envoi est ignoré
    // avant de créer une nouvelle entrée ; ce comportement reste inchangé.
    const poll = await make('Sondage protégé', 'poll');
    const pollHeld = deferred(), pollRelease = deferred(); let pollVotes = 0;
    try {
      await poll.page.route(voteUrl, async route => {
        pollVotes++; const response = await route.fetch(); pollHeld.resolve(); await pollRelease.promise; await route.fulfill({response});
      });
      await poll.page.locator('#answer-form .btn-choice').nth(0).click();
      await within(pollHeld.promise, 'vote instantané non retenu');
      await poll.page.locator('#answer-form .btn-choice').nth(1).click();
      const queued = await pending(poll.page);
      check(queued.value === 0 && pollVotes === 1, 'contrôle : second appui instantané ignoré pendant sending');
      pollRelease.resolve();
      await poll.page.waitForFunction(() => sessionStorage.getItem('wl_pending') === null);
      check((await poll.read()).mine === 0, 'contrôle : choix instantané initial conservé');
    } finally { pollRelease.resolve(); await poll.context.close(); }
  } finally { await admin.context.close(); }
};
