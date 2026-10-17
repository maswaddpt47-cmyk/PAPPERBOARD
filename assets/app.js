/* Écran participant (index.php) : rejoindre, voir la question active,
 * répondre en un geste. Une réponse qui n'a pas pu partir (réseau coupé)
 * reste en attente dans le téléphone et repart dès le retour du réseau. */
'use strict';

(function () {
  var el = WL.el, $ = WL.$;
  function storage(area) {
    return {
      get: function (k) { try { return area().getItem('wl_' + k); } catch (e) { return null; } },
      set: function (k, v) { try { area().setItem('wl_' + k, v); } catch (e) { /* navigation privée */ } },
      del: function (k) { try { area().removeItem('wl_' + k); } catch (e) { /* idem */ } }
    };
  }
  // Code et jeton : localStorage, une journée au plus (téléphone partagé).
  // Réponse en attente : sessionStorage, oubliée à la fermeture de l'onglet.
  var store = storage(function () { return localStorage; });
  var pendingStore = storage(function () { return sessionStorage; });
  if (Date.now() - Number(store.get('since') || 0) > 86400000) {
    ['code', 'token', 'csrf', 'since', 'pending', 'variant'].forEach(store.del);
  }

  // Taille du texte (A− / A+) : 0 = normal, 1 et 2 = plus grand ; gardée sur le téléphone seulement.
  var size = Math.min(2, Math.max(0, Number(store.get('size')) || 0));
  function applySize() {
    if (size) document.documentElement.setAttribute('data-size', String(size));
    else document.documentElement.removeAttribute('data-size');
    $('size-down').disabled = size === 0;
    $('size-up').disabled = size === 2;
  }
  $('size-down').addEventListener('click', function () { size = Math.max(0, size - 1); store.set('size', String(size)); applySize(); });
  $('size-up').addEventListener('click', function () { size = Math.min(2, size + 1); store.set('size', String(size)); applySize(); });
  applySize();

  var code = null, csrf = store.get('csrf'), poller = null;
  var state = null, renderKey = '', offset = 0, timer = null, sending = false;

  function headers() {
    var h = {};
    if (csrf) h['X-CSRF-Token'] = csrf;
    if (store.get('token')) h['X-WL-Token'] = store.get('token');
    return h;
  }

  function banner(text) {
    $('banner').textContent = text || '';
    WL.show($('banner'), !!text);
  }

  function view(id) {
    ['join', 'wait', 'ended', 'question'].forEach(function (v) { WL.show($(v), v === id); });
    // Pendant l'atelier seulement : signaler, oser demander, pseudonyme.
    var live = id === 'wait' || id === 'question';
    WL.show($('signal'), live);
    if (!live) { WL.show($('asks'), false); WL.show($('me-card'), false); }
    WL.show($('leave-btn'), id !== 'join'); // rien à quitter tant qu'on n'a pas rejoint
  }

  // --- Rejoindre --------------------------------------------------------------

  /** info : message de confirmation (en vert, en haut), sinon message d'erreur. */
  function showJoin(message, info) {
    if (poller) poller.stop();
    pendingStore.del('pending'); // session introuvable ou quittée : rien ne repartira
    code = null;
    view('join');
    $('join-error').textContent = info ? '' : message || '';
    $('join-info').textContent = info ? message : '';
    WL.show($('join-info'), !!info);
    $('code').focus();
  }

  function join(c) {
    $('join-error').textContent = '';
    WL.show($('join-info'), false);
    banner('Connexion…');
    return WL.api('join', { body: { s: c }, headers: headers() }).then(function (r) {
      banner('');
      if (r.status !== 200) {
        // Session terminée (page rouverte après la fin) : on écoute quand même,
        // pour afficher le récap et la conclusion.
        if (r.status === 409 && /terminée/.test(r.data.error)) { code = c; startPolling(); return; }
        store.del('code');
        showJoin(r.data.error);
        return;
      }
      code = r.data.code;
      csrf = r.data.csrf;
      store.set('code', code);
      if (store.get('token') !== r.data.token) store.set('since', String(Date.now()));
      store.set('token', r.data.token);
      store.set('csrf', csrf);
      $('session-title').textContent = r.data.title;
      if (history.replaceState) history.replaceState(null, '', '?s=' + code);
      startPolling();
    }, function () {
      banner('Pas de connexion. Nouvel essai dans quelques secondes…');
      setTimeout(function () { join(c); }, 4000);
    });
  }

  $('join-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var c = $('code').value.replace(/\s+/g, '').toUpperCase();
    if (c.length !== 5) { $('join-error').textContent = 'Le code compte 5 caractères.'; return; }
    join(c);
  });

  // --- Rafraîchissement -------------------------------------------------------

  // Signe de vie toutes les 60 s : l'animateur et la projection comptent les
  // téléphones encore là (« x / n ont répondu »). Aucun rafraîchissement déclenché.
  var pingTimer = null;
  function startPing() {
    clearInterval(pingTimer);
    pingTimer = setInterval(function () {
      if (code && state && !state.ended) WL.api('ping', { body: { s: code }, headers: headers() }).then(function () {}, function () {});
    }, 60000);
  }

  function startPolling() {
    startPing();
    if (poller) poller.stop();
    view('wait');
    poller = new WL.Poller('state', 's=' + code, onState, onStatus);
    poller.now();
  }

  function onStatus(kind, r) {
    if (kind === 'offline') banner('Connexion perdue. Reconnexion automatique…');
    else if (kind === 'online') { banner(''); flushPending(); }
    else if (kind === 'error' && r.status === 404) { store.del('code'); showJoin(r.data.error); }
  }

  function onState(data) {
    state = data;
    offset = data.now - Date.now() / 1000;
    $('session-title').textContent = data.title;
    // Session terminée : on continue d'écouter (304 sans corps), pour qu'une
    // conclusion ajoutée ou corrigée après la fin arrive sur les téléphones.
    // Fin : « Quitter » clignote pour inviter à effacer l'appareil de l'atelier.
    $('leave-btn').classList.toggle('blink', !!data.ended);
    if (data.ended) { view('ended'); WL.renderRecap($('recap'), data); pendingStore.del('pending'); return; }
    if (!data.joined) { join(code); return; } // données purgées ou cookie perdu
    if (!data.question) { view('wait'); renderExtras(data); return; }
    view('question');
    var q = data.question;
    // Les contributions (mur, post-it) n'entrent pas dans la clé : elles
    // s'affichent à part, sans effacer un texte en cours de saisie.
    var key = [q.id, q.state, q.showResults, q.closesAt, JSON.stringify(q.correct), JSON.stringify(data.mine), JSON.stringify(data.result),
      JSON.stringify(data.items)].join('|');
    if (key !== renderKey) {
      renderKey = key;
      renderQuestion(q, data.mine);
    }
    renderPosts(q, data.posts);
    renderExtras(data);
    flushPending();
  }

  // --- Pseudonyme, Oser demander, signaler une difficulté ----------------------

  function renderExtras(data) {
    WL.show($('me-card'), !!data.pseudo);
    if (data.pseudo) {
      $('pseudo-line').textContent = 'Votre pseudo : ' + data.pseudo;
      $('score-line').textContent = data.score && data.score.of
        ? 'Bonnes réponses : ' + data.score.n + ' / ' + data.score.of : 'Le score compte les quiz corrigés.';
    }
    WL.show($('asks'), !!data.asksOpen);
    if (!data.asksOpen) return;
    var list = WL.clear($('ask-list'));
    if (!data.asks.length) list.appendChild(el('li', { class: 'meta' }, 'Aucune question affichée pour le moment.'));
    data.asks.forEach(function (a) {
      var item = el('li', { class: 'ask-item' + (a.answered ? ' is-answered' : '') }, el('span', { class: 'ask-text' }, a.text));
      if (a.pending) {
        item.appendChild(el('span', { class: 'meta' }, 'En attente de l\'animateur'));
      } else if (a.mine) {
        item.appendChild(el('span', { class: 'meta' }, 'Votre question · ' + WL.plural(a.votes, 'vote')));
      } else {
        item.appendChild(el('button', { type: 'button', class: 'btn btn-small btn-like', 'aria-pressed': String(a.voted),
          'aria-label': (a.voted ? 'Retirer mon vote' : 'Moi aussi') + ' : ' + a.text,
          onclick: function () { postAction('ask_vote', { aid: a.id }, $('ask-error')); } }, '✋ ' + a.votes + ' moi aussi'));
      }
      if (a.answered) item.appendChild(el('span', { class: 'ask-done' }, '✓ Répondu'));
      list.appendChild(item);
    });
  }

  $('ask-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = $('ask-text');
    if (!input.value.trim()) { $('ask-error').textContent = 'Écrivez votre question.'; return; }
    postAction('ask', { text: input.value }, $('ask-error')).then(function (ok) { if (ok) input.value = ''; });
  });

  // Un signal à la fois ; le même bouton le retire ; il s'efface seul après 2 min.
  var signalTimer = null;
  var stuck = null;          // {q, i} : étape où je me suis déclaré bloqué (un défi, anonyme, 2 min)
  var redrawSteps = null;
  function askHelp(q, i) {
    WL.api('signal', { body: { s: code, kind: 'help', step: { q: q.id, i: i } }, headers: headers() }).then(function (r) {
      if (r.status !== 200) { $('signal-status').textContent = r.data.error || 'Refusé.'; return; }
      stuck = r.data.signal ? { q: q.id, i: i } : null;
      showSignal(r.data.signal);
      clearTimeout(signalTimer);
      if (r.data.signal) signalTimer = setTimeout(function () { stuck = null; showSignal(null); if (redrawSteps) redrawSteps(); }, r.data.ttl * 1000);
      if (redrawSteps) redrawSteps();
    }, function () { $('signal-status').textContent = 'Pas de connexion : réessayez dans un instant.'; });
  }
  function showSignal(kind) {
    document.querySelectorAll('.btn-signal').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.kind === kind)); });
    $('signal-status').textContent = kind
      ? '✓ Signalé (anonyme). Touchez à nouveau pour annuler.'
      : 'Anonyme : l\'animateur voit seulement combien de personnes l\'ont signalé.';
  }
  document.querySelectorAll('.btn-signal').forEach(function (b) {
    b.addEventListener('click', function () {
      WL.api('signal', { body: { s: code, kind: b.dataset.kind }, headers: headers() }).then(function (r) {
        if (r.status !== 200) { $('signal-status').textContent = r.data.error || 'Refusé.'; return; }
        var hadStep = !!stuck;
        stuck = null;
        showSignal(r.data.signal);
        clearTimeout(signalTimer);
        if (r.data.signal) signalTimer = setTimeout(function () { showSignal(null); }, r.data.ttl * 1000);
        if (hadStep && redrawSteps) redrawSteps();
      }, function () { $('signal-status').textContent = 'Pas de connexion : réessayez dans un instant.'; });
    });
  });

  // --- Question et formulaire de réponse ---------------------------------------

  function isOpen(q) {
    return q.state === 'open' && (!q.closesAt || WL.remaining(q.closesAt, offset) > 0);
  }

  function renderQuestion(q, mine) {
    $('q-meta').textContent = WL.typeLabel(q);
    $('q-text').textContent = q.text;
    var form = WL.clear($('answer-form'));
    var open = isOpen(q);
    var locked = !open || (mine !== null && !q.allowChange);
    var builder = { yesno: choices, truefalse: choices, poll: choices, mcq: q.multi ? checkboxes : choices,
      wordcloud: freeText, text: freeText, scale: scale, points: points,
      wall: composer, postit: composer, dots: dots, steps: steps }[q.type];
    var host = q.link ? WL.linkHost(q.link) : null;
    if (host) {
      // Exercice sur un site extérieur : le participant voit où il va avant de partir.
      form.appendChild(el('p', { class: 'exo-link' },
        el('a', { class: 'btn btn-primary', href: q.link, target: '_blank', rel: 'noopener noreferrer' }, 'Ouvrir l\'exercice'),
        el('span', { class: 'meta' }, ' S\'ouvre dans un nouvel onglet (' + host + '). Reviens ensuite sur cette page.')));
    }
    builder(form, q, mine, locked);
    status(q, mine);
    renderMyResult(q, mine);
    startTimer(q);
  }

  function status(q, mine) {
    var s = $('answer-status');
    if (q.type === 'wall' || q.type === 'postit') s.textContent = postStatus(q);
    else if (pendingFor(q)) s.textContent = 'Réponse en attente d\'envoi (réseau)…';
    else if (q.state === 'draft') s.textContent = 'Le vote n\'est pas encore ouvert.';
    else if (!isOpen(q)) s.textContent = mine !== null ? '✓ Votre réponse a été enregistrée. Le vote est fermé.' : 'Le vote est fermé.';
    else if (mine !== null) s.textContent = '✓ Réponse enregistrée.' + (q.allowChange ? ' Vous pouvez la modifier tant que le vote est ouvert.' : '');
    else s.textContent = '';
  }

  /** Défi à étapes : un bouton « Fait » par étape, qu'on peut décocher. L'appareil
   *  (Windows, Mac, iPhone…) est choisi une fois et gardé sur l'appareil, jamais envoyé. */
  function steps(form, q, mine, locked) {
    var done = Array.isArray(mine) ? mine : [];
    // Ne redessine que si ce défi est encore la question affichée (un minuteur ou un signal général peut arriver après un changement de question).
    redrawSteps = function () {
      if (state && state.question && state.question.id === q.id) renderQuestion(state.question, state.mine === undefined ? null : state.mine);
    };
    var variants = q.variants || [];
    var name = store.get('variant');
    var chosen = variants.filter(function (v) { return v.name === name; })[0] || null;
    var redraw = function () { renderQuestion(q, state.mine === undefined ? null : state.mine); };
    if (variants.length && !chosen) {
      form.appendChild(el('p', { class: 'meta' }, 'Sur quel appareil fais-tu le défi ?'));
      var picker = el('div', { class: 'choices' });
      variants.forEach(function (v) {
        picker.appendChild(el('button', { type: 'button', class: 'btn btn-choice',
          onclick: function () { store.set('variant', v.name); redraw(); } }, v.name));
      });
      form.appendChild(picker);
      return;
    }
    if (chosen) {
      form.appendChild(el('p', { class: 'meta device-line' }, 'Appareil : ' + chosen.name + ' ',
        el('button', { type: 'button', class: 'btn btn-small', onclick: function () { store.del('variant'); redraw(); } }, 'Changer')));
    }
    var list = el('ol', { class: 'steps' });
    q.options.forEach(function (title, i) {
      var on = done.indexOf(i) !== -1;
      list.appendChild(el('li', { class: 'step' + (on ? ' is-done' : '') },
        el('span', { class: 'step-text' }, el('strong', null, title),
          chosen ? el('span', { class: 'step-detail' }, chosen.steps[i]) : null),
        el('span', { class: 'step-actions' },
          el('button', { type: 'button', class: 'btn btn-fait', 'aria-pressed': String(on), disabled: locked,
            onclick: function () {
              if (sending) return;
              send(q, on ? done.filter(function (x) { return x !== i; }) : done.concat([i]));
            } }, on ? 'Fait ✓' : 'Fait'),
          locked ? null : el('button', { type: 'button', class: 'btn btn-small btn-stuck', 'aria-pressed': String(!!stuck && stuck.q === q.id && stuck.i === i),
            title: 'Signaler anonymement que tu es bloqué à cette étape : l\'animateur voit seulement combien de personnes et laquelle',
            onclick: function () { askHelp(q, i); } }, '✋ Bloqué'))));
    });
    form.appendChild(list);
    if (!locked) form.appendChild(el('p', { class: 'meta' }, 'Touche « Fait » à chaque étape terminée. Tu peux décocher.'));
  }

  /** Un bouton par choix : un appui sélectionne, « Envoyer » vote (un appui
   *  direct envoyait sans confirmation et déroutait les participants). */
  function choices(form, q, mine, locked) {
    var grid = el('div', { class: 'choices' + (q.type === 'yesno' || q.type === 'truefalse' ? ' choices-2' : '') });
    pickOne(form, grid, q, mine, locked, q.options.map(function (label, i) { return { value: i, label: label, mark: markClass(q, i) }; }));
  }

  /** Boutons à choix unique. Sondage, Oui/Non ou Vrai/Faux, même corrigés, tant
   *  que la réponse est modifiable : un appui envoie tout de suite, on peut en
   *  toucher un autre pour changer. QCM corrigé ou réponse figée (correction
   *  immédiate) : un appui sélectionne, « Envoyer » vote (une erreur y compterait). */
  function pickOne(form, grid, q, mine, locked, items) {
    var picked = mine;
    var instant = q.allowChange && (!q.graded || q.type === 'yesno' || q.type === 'truefalse');
    var button = null;
    var buttons = items.map(function (it) {
      return el('button', {
        type: 'button', class: 'btn btn-choice' + (it.mark || ''), 'aria-pressed': String(mine === it.value),
        disabled: locked, onclick: function () {
          if (instant && sending) return;
          picked = it.value;
          buttons.forEach(function (b, j) { b.setAttribute('aria-pressed', String(items[j].value === picked)); });
          if (picked === mine) return;
          if (instant) { send(q, picked); return; }
          $('answer-status').textContent = ''; // la consigne est déjà au-dessus du bouton Envoyer
          // Sur téléphone le bouton peut être sous le pli : on l'amène à l'écran.
          if (button) button.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }, it.label);
    });
    buttons.forEach(function (b) { grid.appendChild(b); });
    form.appendChild(grid);
    if (instant) {
      if (!locked) form.appendChild(el('p', { class: 'meta' }, 'Touchez votre réponse : elle est envoyée tout de suite.'));
      return null;
    }
    button = submit(form, locked, function () {
      if (picked === null || picked === undefined) return 'Choisissez une réponse avant d\'envoyer.';
      send(q, picked);
    });
    return button;
  }

  /** Classe CSS de correction, une fois les résultats affichés. */
  function markClass(q, i) {
    if (!q.correct.length) return ''; // le serveur n'envoie la correction que lorsqu'elle est visible
    return q.correct.indexOf(i) !== -1 ? ' is-correct' : '';
  }

  function checkboxes(form, q, mine, locked) {
    var box = el('fieldset', { class: 'checks' }, el('legend', { class: 'sr-only' }, q.text));
    form.appendChild(el('p', { class: 'meta' }, 'Plusieurs réponses possibles : cochez toutes celles qui conviennent.'));
    q.options.forEach(function (label, i) {
      var input = el('input', { type: 'checkbox', value: i, disabled: locked, checked: Array.isArray(mine) && mine.indexOf(i) !== -1 });
      box.appendChild(el('label', { class: 'check-big' + markClass(q, i) }, input, el('span', null, label)));
    });
    form.appendChild(box);
    submit(form, locked, function () {
      var v = [].map.call(box.querySelectorAll('input:checked'), function (c) { return Number(c.value); });
      if (!v.length) return 'Cochez au moins une réponse.';
      send(q, v);
    });
  }

  function freeText(form, q, mine, locked) {
    var max = state.maxText || 80;
    var input = el('input', { id: 'free', type: 'text', maxlength: max, autocomplete: 'off', disabled: locked,
      'aria-describedby': 'free-count', placeholder: q.type === 'wordcloud' ? 'Un mot ou une courte expression' : 'Votre réponse' });
    if (typeof mine === 'string') input.value = mine;
    var count = el('p', { id: 'free-count', class: 'meta' });
    var update = function () { count.textContent = input.value.length + ' / ' + max + ' caractères'; };
    input.addEventListener('input', update);
    update();
    form.appendChild(el('label', { for: 'free', class: 'sr-only' }, q.text));
    form.appendChild(input);
    form.appendChild(count);
    form.appendChild(el('p', { class: 'meta' }, 'N\'écrivez pas de nom ni d\'information personnelle.'));
    keepVisible(input, submit(form, locked, function () {
      if (!input.value.trim()) return 'Écrivez une réponse avant d\'envoyer.';
      send(q, input.value);
    }));
  }

  /** Sur téléphone, le clavier recouvre le bouton d'envoi : on le ramène à
   *  l'écran pendant la saisie (les participants ne le trouvaient pas). */
  function keepVisible(input, button) {
    var show = function () { setTimeout(function () { button.scrollIntoView({ block: 'nearest' }); }, 350); };
    input.addEventListener('focus', show);
    input.addEventListener('input', function () { if (input.value.length === 1) show(); });
  }

  function scale(form, q, mine, locked) {
    var grid = el('div', { class: 'choices choices-scale', role: 'group', 'aria-label': 'Note de 1 à ' + q.scaleMax });
    var items = [];
    for (var n = 1; n <= q.scaleMax; n++) items.push({ value: n, label: String(n) });
    var legend = el('p', { class: 'meta scale-legend' }, el('span', null, '1 = pas du tout'), el('span', null, q.scaleMax + ' = tout à fait'));
    pickOne(form, grid, q, mine, locked, items);
    form.insertBefore(legend, grid.nextSibling);
  }

  /** Classement par points : répartir le budget entre les choix. */
  function points(form, q, mine, locked) {
    var values = Array.isArray(mine) ? mine.slice() : q.options.map(function () { return 0; });
    stepper(form, q.options, values, q.budget, locked, 'point', function () { send(q, values); });
  }

  /** Gommettes : coller N gommettes sur les idées (plusieurs sur une même idée possible). */
  function dots(form, q, mine, locked) {
    var items = state.items || [];
    if (!items.length) {
      form.appendChild(el('p', { class: 'meta' }, 'Les idées apparaîtront quand l\'animateur aura publié le post-it.'));
      return;
    }
    var values = items.map(function (it) { return (mine && mine[it.id]) || 0; });
    var labels = items.map(function (it) {
      return it.grouped.length ? it.text + ' (+ ' + it.grouped.join(' ; ') + ')' : it.text;
    });
    stepper(form, labels, values, q.budget, locked, 'gommette', function () {
      var v = {};
      items.forEach(function (it, i) { if (values[i]) v[it.id] = values[i]; });
      send(q, v);
    });
  }

  /** Boutons − / + pour répartir un budget ; values est modifié sur place. */
  function stepper(form, labels, values, budget, locked, unit, onSend) {
    var left = el('p', { class: 'points-left', 'aria-live': 'polite' });
    var rows = [];
    function refresh() {
      var rest = budget - values.reduce(function (a, b) { return a + b; }, 0);
      left.textContent = WL.plural(rest, unit) + ' à placer sur ' + budget;
      rows.forEach(function (r, i) {
        r.value.textContent = values[i];
        r.minus.disabled = locked || values[i] === 0;
        r.plus.disabled = locked || rest === 0;
        WL.clear(r.pills);
        for (var k = 0; k < values[i] && unit === 'gommette'; k++) r.pills.appendChild(el('span', { class: 'dot' }));
      });
    }
    form.appendChild(left);
    labels.forEach(function (label, i) {
      var row = {
        value: el('output', { class: 'points-value', 'aria-label': unit + 's pour ' + label }),
        pills: el('span', { class: 'dots', 'aria-hidden': 'true' }),
        minus: el('button', { type: 'button', class: 'btn btn-step', 'aria-label': 'Retirer une ' + unit + ' à ' + label,
          onclick: function () { values[i]--; refresh(); } }, '−'),
        plus: el('button', { type: 'button', class: 'btn btn-step', 'aria-label': 'Ajouter une ' + unit + ' à ' + label,
          onclick: function () { values[i]++; refresh(); } }, '+')
      };
      rows.push(row);
      form.appendChild(el('div', { class: 'points-row' },
        el('span', { class: 'points-label' }, label, row.pills), row.minus, row.value, row.plus));
    });
    refresh();
    submit(form, locked, function () {
      if (!values.some(Boolean)) return 'Placez au moins une ' + unit + '.';
      onSend();
    });
  }

  // --- Mur collaboratif et post-it collectif -------------------------------------

  function myPosts() {
    return (state.posts || []).filter(function (p) { return p.mine; }).length;
  }

  function postStatus(q) {
    if (q.state === 'draft') return 'Les contributions ne sont pas encore ouvertes.';
    if (!isOpen(q)) return 'Les contributions sont fermées.';
    var rest = state.maxPosts - myPosts();
    return rest > 0 ? 'Vous pouvez encore publier ' + WL.plural(rest, 'contribution') + '.' : 'Vous avez publié le maximum de contributions.';
  }

  /** Saisie d'un message (mur) ou d'un post-it (choix de la colonne). */
  function composer(form, q, mine, locked) {
    var max = state.maxText || 80;
    var cols = q.type === 'postit' && q.options.length > 1 ? el('fieldset', { class: 'checks' }, el('legend', null, 'Colonne')) : null;
    if (cols) {
      q.options.forEach(function (name, c) {
        cols.appendChild(el('label', { class: 'check-big' },
          el('input', { type: 'radio', name: 'col', value: c, checked: c === 0, disabled: locked }), el('span', null, name)));
      });
      form.appendChild(cols);
    }
    var input = el('textarea', { id: 'free', rows: 2, maxlength: max, disabled: locked, 'aria-label': q.text,
      placeholder: q.type === 'postit' ? 'Écrivez votre post-it' : 'Écrivez votre message' });
    var count = el('p', { class: 'meta' });
    var update = function () { count.textContent = input.value.length + ' / ' + max + ' caractères'; };
    input.addEventListener('input', update);
    update();
    form.appendChild(input);
    form.appendChild(count);
    form.appendChild(el('p', { class: 'meta' }, 'N\'écrivez pas de nom ni d\'information personnelle.'));
    var err = el('p', { class: 'error', role: 'alert' });
    var button = el('button', { type: 'submit', class: 'btn btn-primary btn-block', disabled: locked },
      q.type === 'postit' ? 'Coller le post-it' : 'Publier');
    form.appendChild(el('div', { class: 'send-bar' }, err, button));
    keepVisible(input, button);
    // Message court sur une ligne : Entrée publie, comme dans une messagerie.
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(button); }
    });
    form.onsubmit = function (e) {
      e.preventDefault();
      if (!input.value.trim()) { err.textContent = 'Écrivez quelque chose avant de publier.'; return; }
      var picked = cols ? cols.querySelector('input:checked') : null;
      button.disabled = true;
      postAction('post', { qid: q.id, text: input.value, col: picked ? Number(picked.value) : 0 }, err).then(function (ok) {
        button.disabled = false;
        if (ok) { input.value = ''; update(); }
      });
    };
  }

  /** Envoi direct (pas de file d'attente : le texte reste dans le champ si le réseau manque). */
  function postAction(action, body, errBox) {
    return WL.api(action, { body: Object.assign({ s: code }, body), headers: headers() }).then(function (r) {
      if (r.status !== 200) { errBox.textContent = r.data.error || 'Refusé.'; return false; }
      errBox.textContent = '';
      poller.refresh();
      return true;
    }, function () {
      errBox.textContent = 'Pas de connexion : votre texte est gardé, réessayez dans un instant.';
      return false;
    });
  }

  /** Contributions sous le formulaire : les siennes, et celles des autres
   *  une fois publiées par l'animateur. */
  function renderPosts(q, posts) {
    var box = WL.clear($('posts'));
    if (!posts) { WL.show(box, false); return; }
    WL.show(box, true);
    $('answer-status').textContent = postStatus(q);
    var open = isOpen(q);
    var err = el('p', { class: 'error', role: 'alert' });
    box.appendChild(el('h2', null, q.showResults ? 'Contributions de tous' : 'Vos contributions'));
    if (!posts.length) box.appendChild(el('p', { class: 'meta' }, 'Rien pour le moment.'));
    var columns = q.type === 'postit' ? q.options : [null];
    columns.forEach(function (name, c) {
      var mineHere = posts.filter(function (p) { return q.type !== 'postit' || p.col === c; });
      if (!mineHere.length) return;
      if (name && columns.length > 1) box.appendChild(el('h3', { class: 'board-title' }, name));
      var list = el('ul', { class: 'wall' });
      mineHere.forEach(function (p) {
        var item = el('li', { class: 'wall-item' + (q.type === 'postit' ? ' note ' + WL.noteColor(p.id) : '') }, el('span', { class: 'post-text' }, p.text));
        if (q.type === 'wall' && q.showResults) {
          item.appendChild(el('button', { type: 'button', class: 'btn btn-small btn-like', 'aria-pressed': String(p.liked), disabled: !open,
            'aria-label': (p.liked ? 'Ne plus aimer' : 'Aimer') + ' : ' + p.text,
            onclick: function () { postAction('like', { qid: q.id, pid: p.id }, err); } }, '♥ ' + p.likes + ' j\'aime'));
        }
        if (p.mine && open) {
          item.appendChild(el('button', { type: 'button', class: 'btn btn-small btn-danger', 'aria-label': 'Retirer : ' + p.text,
            onclick: function () { postAction('post_delete', { qid: q.id, pid: p.id }, err); } }, 'Retirer'));
        }
        list.appendChild(item);
      });
      box.appendChild(list);
    });
    box.appendChild(err);
  }

  function submit(form, locked, onSubmit) {
    var err = el('p', { class: 'error', role: 'alert' });
    var button = el('button', { type: 'submit', class: 'btn btn-primary btn-block', disabled: locked }, 'Envoyer');
    // Barre collée en bas de l'écran : le bouton reste visible même quand la
    // liste de choix dépasse (constaté sur téléphone le 15/10/2026).
    form.appendChild(el('div', { class: 'send-bar' },
      locked ? null : el('p', { class: 'send-hint' }, 'Appuyez sur « Envoyer » pour valider.'),
      err, button));
    form.onsubmit = function (e) {
      e.preventDefault();
      err.textContent = onSubmit() || '';
    };
    return button;
  }

  // --- Envoi, avec reprise si le réseau tombe ----------------------------------

  /** Réponse en attente : valable une heure, pour la session en cours seulement. */
  function readPending() {
    var p = JSON.parse(pendingStore.get('pending') || 'null');
    if (p && Date.now() - (p.at || 0) > 3600000) { pendingStore.del('pending'); return null; }
    return p;
  }

  function pendingFor(q) {
    var p = readPending();
    return p && p.code === code && p.qid === q.id ? p : null;
  }

  function send(q, value) {
    pendingStore.set('pending', JSON.stringify({ code: code, qid: q.id, value: value, at: Date.now() }));
    $('answer-status').textContent = 'Envoi…';
    flushPending();
  }

  function flushPending() {
    var p = readPending();
    if (!p || sending || p.code !== code) return;
    sending = true;
    WL.api('vote', { body: { s: p.code, qid: p.qid, value: p.value }, headers: headers() }).then(function (r) {
      sending = false;
      pendingStore.del('pending');
      if (r.status === 200) {
        state.mine = r.data.mine;
        if (state.question && state.question.id === p.qid && r.data.correct && r.data.correct.length) {
          state.question.correct = r.data.correct; // correction immédiate
        }
        renderKey = '';
        if (state.question && state.question.id === p.qid) onState(state);
      } else if (r.status === 403 && /Rejoignez/.test(r.data.error)) {
        pendingStore.set('pending', JSON.stringify(p));
        join(code);
      } else {
        $('answer-status').textContent = r.data.error || 'Réponse refusée.';
      }
    }, function () {
      sending = false;
      banner('Connexion perdue. Votre réponse partira dès le retour du réseau.');
      setTimeout(flushPending, 3000);
    });
  }

  // --- Correction et compte à rebours -----------------------------------------

  function renderMyResult(q, mine) {
    var box = $('my-result');
    WL.clear(box);
    WL.show(box, false);
    if (!q.showResults && !q.correct.length && !q.explain) return;
    if (q.correct.length && mine !== null) {
      var good = JSON.stringify([].concat(mine).sort()) === JSON.stringify(q.correct);
      box.appendChild(el('p', { class: 'big ' + (good ? 'ok' : 'ko') }, good ? 'Bonne réponse !' : 'Ce n\'était pas la bonne réponse.'));
    }
    if (q.correct.length) {
      box.appendChild(el('p', null, 'Bonne réponse : ' + q.correct.map(function (i) { return q.options[i]; }).join(', ')));
    }
    if (q.explain) box.appendChild(el('p', { class: 'explain' }, q.explain));
    if (state.result) {
      var res = el('div');
      WL.renderResults(res, q, state.result);
      box.appendChild(res);
    }
    WL.show(box, box.childNodes.length > 0);
  }

  function startTimer(q) {
    clearInterval(timer);
    var t = $('q-timer');
    WL.show(t, !!(q.closesAt && q.state === 'open'));
    if (!q.closesAt || q.state !== 'open') return;
    var tick = function () {
      var s = WL.remaining(q.closesAt, offset);
      t.textContent = s > 0 ? 'Temps restant : ' + WL.formatTime(s) : 'Temps écoulé';
      return s;
    };
    if (tick() === 0) return;
    timer = setInterval(function () {
      // Fin du temps : on verrouille le formulaire sans attendre le serveur.
      if (tick() === 0) { clearInterval(timer); renderKey = ''; onState(state); }
    }, 1000);
  }

  // --- Quitter : effacer ce que le téléphone garde -------------------------------

  $('leave-btn').addEventListener('click', function () {
    var cleared = true;
    WL.api('leave', { body: {} }).then(function () {}, function () { cleared = false; }).then(function () {
      ['code', 'token', 'csrf', 'since', 'size', 'variant'].forEach(store.del);
      pendingStore.del('pending');
      csrf = null;
      size = 0;
      applySize();
      $('session-title').textContent = '';
      if (history.replaceState) history.replaceState(null, '', location.pathname);
      showJoin(cleared
        ? '✓ Vous avez quitté l\'atelier. Cet appareil ne garde plus rien de WoocLight.'
        : 'Vous avez quitté l\'atelier, mais la déconnexion n\'a pas pu être confirmée (pas de réseau ?). Sur un appareil partagé, effacez les cookies du site.', true);
    });
  });

  // --- Démarrage ---------------------------------------------------------------

  var fromUrl = new URLSearchParams(location.search).get('s');
  var start = (fromUrl || store.get('code') || '').toUpperCase();
  if (/^[A-Z2-9]{5}$/.test(start)) join(start);
  else showJoin(fromUrl ? 'Ce lien ne contient pas un code valide.' : '');
}());
