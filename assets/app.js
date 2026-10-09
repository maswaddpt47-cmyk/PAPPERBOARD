/* Écran participant (index.php) : rejoindre, voir la question active,
 * répondre en un geste. Une réponse qui n'a pas pu partir (réseau coupé)
 * reste en attente dans le téléphone et repart dès le retour du réseau. */
'use strict';

(function () {
  var el = WL.el, $ = WL.$;
  var store = {
    get: function (k) { try { return localStorage.getItem('wl_' + k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem('wl_' + k, v); } catch (e) { /* navigation privée */ } },
    del: function (k) { try { localStorage.removeItem('wl_' + k); } catch (e) { /* idem */ } }
  };

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
    if (data.ended) { view('ended'); poller.stop(); return; }
    if (!data.joined) { join(code); return; } // données purgées ou cookie perdu
    if (!data.question) { view('wait'); return; }
    view('question');
    var q = data.question;
    var key = [q.id, q.state, q.showResults, q.closesAt, JSON.stringify(data.mine), JSON.stringify(data.result)].join('|');
    if (key !== renderKey) {
      renderKey = key;
      renderQuestion(q, data.mine);
    }
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
      wordcloud: freeText, text: freeText, scale: scale, points: points }[q.type];
    builder(form, q, mine, locked);
    status(q, mine);
    renderMyResult(q, mine);
    startTimer(q);
  }

  function status(q, mine) {
    var s = $('answer-status');
    if (pendingFor(q)) s.textContent = 'Réponse en attente d\'envoi (réseau)…';
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

  /** Répartition d'un budget de points avec des boutons − / +. */
  function points(form, q, mine, locked) {
    var values = Array.isArray(mine) ? mine.slice() : q.options.map(function () { return 0; });
    var left = el('p', { class: 'points-left', 'aria-live': 'polite' });
    var rows = [];
    function refresh() {
      var rest = q.budget - values.reduce(function (a, b) { return a + b; }, 0);
      left.textContent = 'Points restants : ' + rest + ' / ' + q.budget;
      rows.forEach(function (r, i) {
        r.value.textContent = values[i];
        r.minus.disabled = locked || values[i] === 0;
        r.plus.disabled = locked || rest === 0;
      });
    }
    form.appendChild(left);
    q.options.forEach(function (label, i) {
      var row = {
        value: el('output', { class: 'points-value', 'aria-label': 'Points pour ' + label }),
        minus: el('button', { type: 'button', class: 'btn btn-step', 'aria-label': 'Retirer un point à ' + label,
          onclick: function () { values[i]--; refresh(); } }, '−'),
        plus: el('button', { type: 'button', class: 'btn btn-step', 'aria-label': 'Ajouter un point à ' + label,
          onclick: function () { values[i]++; refresh(); } }, '+')
      };
      rows.push(row);
      form.appendChild(el('div', { class: 'points-row' }, el('span', { class: 'points-label' }, label), row.minus, row.value, row.plus));
    });
    refresh();
    submit(form, locked, function () {
      if (!values.some(Boolean)) return 'Attribuez au moins un point.';
      send(q, values);
    });
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

  function pendingFor(q) {
    var p = JSON.parse(store.get('pending') || 'null');
    return p && p.code === code && p.qid === q.id ? p : null;
  }

  function send(q, value) {
    store.set('pending', JSON.stringify({ code: code, qid: q.id, value: value }));
    $('answer-status').textContent = 'Envoi…';
    flushPending();
  }

  function flushPending() {
    var p = JSON.parse(store.get('pending') || 'null');
    if (!p || sending || p.code !== code) return;
    sending = true;
    WL.api('vote', { body: { s: p.code, qid: p.qid, value: p.value }, headers: headers() }).then(function (r) {
      sending = false;
      store.del('pending');
      if (r.status === 200) {
        state.mine = r.data.mine;
        renderKey = '';
        if (state.question && state.question.id === p.qid) onState(state);
      } else if (r.status === 403 && /Rejoignez/.test(r.data.error)) {
        store.set('pending', JSON.stringify(p));
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

  // --- Démarrage ---------------------------------------------------------------

  var fromUrl = new URLSearchParams(location.search).get('s');
  var start = (fromUrl || store.get('code') || '').toUpperCase();
  if (/^[A-Z2-9]{5}$/.test(start)) join(start);
  else showJoin(fromUrl ? 'Ce lien ne contient pas un code valide.' : '');
}());
