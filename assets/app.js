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
    ['code', 'token', 'csrf', 'since', 'pending'].forEach(store.del);
  }

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
  }

  // --- Rejoindre --------------------------------------------------------------

  function showJoin(message) {
    if (poller) poller.stop();
    pendingStore.del('pending'); // session introuvable ou quittée : rien ne repartira
    code = null;
    view('join');
    $('join-error').textContent = message || '';
    $('code').focus();
  }

  function join(c) {
    $('join-error').textContent = '';
    banner('Connexion…');
    return WL.api('join', { body: { s: c }, headers: headers() }).then(function (r) {
      banner('');
      if (r.status !== 200) {
        if (r.status === 409 && /terminée/.test(r.data.error)) { view('ended'); return; }
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

  function startPolling() {
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
    if (data.ended) { view('ended'); poller.stop(); pendingStore.del('pending'); return; }
    if (!data.joined) { join(code); return; } // données purgées ou cookie perdu
    if (!data.question) { view('wait'); return; }
    view('question');
    var q = data.question;
    // Les contributions (mur, post-it) n'entrent pas dans la clé : elles
    // s'affichent à part, sans effacer un texte en cours de saisie.
    var key = [q.id, q.state, q.showResults, q.closesAt, JSON.stringify(data.mine), JSON.stringify(data.result),
      JSON.stringify(data.items)].join('|');
    if (key !== renderKey) {
      renderKey = key;
      renderQuestion(q, data.mine);
    }
    renderPosts(q, data.posts);
    flushPending();
  }

  // --- Question et formulaire de réponse ---------------------------------------

  function isOpen(q) {
    return q.state === 'open' && (!q.closesAt || WL.remaining(q.closesAt, offset) > 0);
  }

  function renderQuestion(q, mine) {
    $('q-meta').textContent = WL.TYPES[q.type];
    $('q-text').textContent = q.text;
    var form = WL.clear($('answer-form'));
    var open = isOpen(q);
    var locked = !open || (mine !== null && !q.allowChange);
    var builder = { yesno: choices, truefalse: choices, poll: choices, mcq: q.multi ? checkboxes : choices,
      wordcloud: freeText, text: freeText, scale: scale, points: points,
      wall: composer, postit: composer, dots: dots }[q.type];
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

  /** Un bouton par choix : un appui = un vote. */
  function choices(form, q, mine, locked) {
    var grid = el('div', { class: 'choices' + (q.type === 'yesno' || q.type === 'truefalse' ? ' choices-2' : '') });
    q.options.forEach(function (label, i) {
      grid.appendChild(el('button', {
        type: 'button', class: 'btn btn-choice' + markClass(q, i), 'aria-pressed': String(mine === i),
        disabled: locked, onclick: function () { send(q, i); }
      }, label));
    });
    form.appendChild(grid);
  }

  /** Classe CSS de correction, une fois les résultats affichés. */
  function markClass(q, i) {
    if (!q.showResults || !q.correct.length) return '';
    return q.correct.indexOf(i) !== -1 ? ' is-correct' : '';
  }

  function checkboxes(form, q, mine, locked) {
    var box = el('fieldset', { class: 'checks' }, el('legend', { class: 'sr-only' }, q.text));
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
    submit(form, locked, function () {
      if (!input.value.trim()) return 'Écrivez une réponse avant d\'envoyer.';
      send(q, input.value);
    });
  }

  function scale(form, q, mine, locked) {
    var grid = el('div', { class: 'choices choices-scale', role: 'group', 'aria-label': 'Note de 1 à ' + q.scaleMax });
    for (var i = 1; i <= q.scaleMax; i++) {
      (function (n) {
        grid.appendChild(el('button', { type: 'button', class: 'btn btn-choice', 'aria-pressed': String(mine === n),
          disabled: locked, onclick: function () { send(q, n); } }, String(n)));
      }(i));
    }
    form.appendChild(grid);
    form.appendChild(el('p', { class: 'meta scale-legend' }, el('span', null, '1 = pas du tout'), el('span', null, q.scaleMax + ' = tout à fait')));
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
    form.appendChild(err);
    var button = el('button', { type: 'submit', class: 'btn btn-primary btn-block', disabled: locked },
      q.type === 'postit' ? 'Coller le post-it' : 'Publier');
    form.appendChild(button);
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
        var item = el('li', { class: 'wall-item' + (q.type === 'postit' ? ' note board-c' + (c % 6) : '') }, el('span', { class: 'post-text' }, p.text));
        if (q.type === 'wall' && q.showResults) {
          item.appendChild(el('button', { type: 'button', class: 'btn btn-small btn-like', 'aria-pressed': String(p.liked), disabled: !open,
            'aria-label': (p.liked ? 'Ne plus aimer' : 'Aimer') + ' : ' + p.text,
            onclick: function () { postAction('like', { qid: q.id, pid: p.id }, err); } }, '♥ ' + p.likes));
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
    form.appendChild(err);
    form.appendChild(el('button', { type: 'submit', class: 'btn btn-primary btn-block', disabled: locked }, 'Envoyer'));
    form.onsubmit = function (e) {
      e.preventDefault();
      err.textContent = onSubmit() || '';
    };
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
    if (!q.showResults) return;
    if (q.correct.length && mine !== null) {
      var good = JSON.stringify([].concat(mine).sort()) === JSON.stringify(q.correct);
      box.appendChild(el('p', { class: 'big ' + (good ? 'ok' : 'ko') }, good ? 'Bonne réponse !' : 'Ce n\'était pas la bonne réponse.'));
    }
    if (q.correct.length) {
      box.appendChild(el('p', null, 'Bonne réponse : ' + q.correct.map(function (i) { return q.options[i]; }).join(', ')));
    }
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
    WL.api('leave', { body: {} }).then(function () {}, function () {}).then(function () {
      ['code', 'token', 'csrf', 'since'].forEach(store.del);
      pendingStore.del('pending');
      csrf = null;
      $('session-title').textContent = '';
      if (history.replaceState) history.replaceState(null, '', location.pathname);
      showJoin('Vous avez quitté l\'atelier. Ce téléphone ne garde plus rien de WoocLight.');
    });
  });

  // --- Démarrage ---------------------------------------------------------------

  var fromUrl = new URLSearchParams(location.search).get('s');
  var start = (fromUrl || store.get('code') || '').toUpperCase();
  if (/^[A-Z2-9]{5}$/.test(start)) join(start);
  else showJoin(fromUrl ? 'Ce lien ne contient pas un code valide.' : '');
}());
