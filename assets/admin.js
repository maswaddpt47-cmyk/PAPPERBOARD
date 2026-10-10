/* Espace animateur (admin.php) : connexion, liste des sessions, édition des
 * questions, pilotage en direct. Toutes les écritures portent le jeton CSRF. */
'use strict';

(function () {
  var el = WL.el, $ = WL.$;
  var csrf = '', code = null, poller = null, data = null, editing = null, qrFor = null;

  function banner(text) {
    $('banner').textContent = text || '';
    WL.show($('banner'), !!text);
  }

  function view(id) {
    ['login', 'sessions', 'editor'].forEach(function (v) { WL.show($(v), v === id); });
    WL.show($('logout-btn'), id !== 'login');
  }

  /** Écriture : POST avec CSRF. Résout les données, ou affiche l'erreur. */
  function post(action, body) {
    return WL.api(action, { body: body || {}, headers: { 'X-CSRF-Token': csrf } }).then(function (r) {
      if (r.status === 401) { showLogin('Session expirée : reconnectez-vous.'); throw r; }
      if (r.status !== 200) { banner(r.data.error); throw r; }
      banner('');
      return r.data;
    }, function (e) {
      banner('Pas de connexion au serveur. Réessayez.');
      throw e;
    });
  }

  // --- Connexion ----------------------------------------------------------------

  function showLogin(message) {
    if (poller) poller.stop();
    view('login');
    $('login-error').textContent = message || '';
    $('password').focus();
  }

  $('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    WL.api('login', { body: { password: $('password').value } }).then(function (r) {
      if (r.status !== 200) { $('login-error').textContent = r.data.error; return; }
      $('password').value = '';
      csrf = r.data.csrf;
      showSessions();
    }, function () { $('login-error').textContent = 'Pas de connexion au serveur.'; });
  });

  $('logout-btn').addEventListener('click', function () {
    post('logout').then(function () { showLogin(''); });
  });

  // --- Sessions -----------------------------------------------------------------

  function showSessions() {
    if (poller) poller.stop();
    code = null;
    view('sessions');
    WL.api('sessions').then(function (r) {
      if (r.status === 401) return showLogin('');
      var list = WL.clear($('session-list'));
      if (!r.data.sessions.length) list.appendChild(el('li', { class: 'meta' }, 'Aucune session. Créez-en une ci-dessus.'));
      r.data.sessions.forEach(function (s) {
        list.appendChild(el('li', { class: 'list-item' },
          el('div', { class: 'grow' }, el('strong', null, s.title),
            el('p', { class: 'meta' }, 'Code ' + s.code + ' — ' + WL.plural(s.questions, 'question') + ' — '
              + WL.plural(s.participants, 'participant') + ' — modifiée le ' + new Date(s.updated * 1000).toLocaleString('fr-FR')
              + (s.ended ? ' — terminée' : ''))),
          el('div', { class: 'row wrap' },
            el('button', { type: 'button', class: 'btn btn-primary', onclick: function () { openSession(s.code); } }, 'Ouvrir'),
            el('button', { type: 'button', class: 'btn', onclick: function () {
              post('session_duplicate', { s: s.code }).then(showSessions);
            } }, 'Dupliquer'),
            el('button', { type: 'button', class: 'btn btn-danger', onclick: function () {
              if (confirm('Supprimer définitivement « ' + s.title + ' » et toutes ses réponses ?')) {
                post('session_delete', { s: s.code }).then(showSessions);
              }
            } }, 'Supprimer'))));
      });
    });
  }

  $('create-form').addEventListener('submit', function (e) {
    e.preventDefault();
    post('session_create', { title: $('new-title').value }).then(function (d) {
      $('new-title').value = '';
      openSession(d.code);
    });
  });

  // --- Éditeur et pilotage ---------------------------------------------------------

  function openSession(c) {
    code = c;
    data = null;
    view('editor');
    if (poller) poller.stop();
    poller = new WL.Poller('admin_state', 's=' + code, render, function (kind, r) {
      if (kind === 'offline') banner('Connexion perdue. Reconnexion automatique…');
      else if (kind === 'online') banner('');
      else if (r.status === 401) showLogin('Session expirée : reconnectez-vous.');
      else if (r.status === 404) { banner(r.data.error); showSessions(); }
    });
    poller.now();
  }

  $('back-btn').addEventListener('click', showSessions);

  /** Envoie une commande puis rafraîchit tout de suite (sans attendre 2 s). */
  function act(action, body) {
    return post(action, Object.assign({ s: code }, body)).then(function () { poller.refresh(); });
  }

  function control(op, extra) {
    return act('control', Object.assign({ op: op }, extra));
  }

  function render(d) {
    data = d;
    $('ed-title').textContent = d.title;
    $('ed-code').textContent = d.code;
    $('ed-url').textContent = d.joinUrl;
    $('ed-url').href = d.joinUrl;
    $('ed-screen').href = 'screen.php?s=' + d.code;
    $('ed-csv').href = 'api.php?action=export&s=' + d.code;
    $('ed-csv-public').href = 'api.php?action=export&public=1&s=' + d.code;
    $('ed-print').href = 'api.php?action=export&format=print&s=' + d.code;
    $('ed-participants').textContent = WL.plural(d.participants, 'participant') + ' connecté' + (d.participants > 1 ? 's' : '');
    $('end-btn').textContent = d.ended ? 'Rouvrir la session' : 'Terminer la session';
    $('lock-btn').textContent = d.locked ? 'Rouvrir les inscriptions' : 'Fermer les inscriptions';
    if (qrFor !== d.joinUrl) {
      WL.qr($('ed-qr'), d.joinUrl, 4);
      qrFor = d.joinUrl;
    }
    renderLive(d);
    renderList(d);
  }

  function renderLive(d) {
    var q = d.questions[d.current];
    var has = !!q;
    ['open-btn', 'show-btn'].forEach(function (id) { $(id).disabled = !has; });
    document.querySelector('#live [data-op="reset"]').disabled = !has;
    document.querySelector('#live [data-op="prev"]').disabled = d.current < 0;
    document.querySelector('#live [data-op="next"]').disabled = d.current >= d.questions.length - 1;
    if (!has) {
      $('live-pos').textContent = d.questions.length ? 'Accueil : la projection affiche l\'adresse et le code.'
        : 'Aucune question : ajoutez-en une ci-dessous.';
      $('live-text').textContent = d.questions.length ? '« Suivante » lance la première question et ouvre le vote.' : '';
      $('live-state').textContent = '';
      WL.clear($('live-results'));
      return;
    }
    var open = q.state === 'open' && !(q.closesAt && WL.remaining(q.closesAt, d.now - Date.now() / 1000) === 0);
    $('live-pos').textContent = 'Question projetée : ' + (d.current + 1) + ' / ' + d.questions.length + ' — ' + WL.TYPES[q.type];
    $('live-text').textContent = q.text;
    $('live-state').textContent = (open ? 'Vote ouvert' : q.state === 'draft' ? 'Vote pas encore ouvert' : 'Vote fermé')
      + ' — ' + WL.plural(q.results.total, 'réponse') + (q.showResults ? ' — résultats affichés' : '');
    $('open-btn').textContent = open ? 'Fermer le vote' : 'Ouvrir le vote';
    $('open-btn').dataset.next = open ? 'close' : 'open';
    $('show-btn').textContent = q.showResults ? 'Masquer les résultats' : 'Afficher les résultats';
    $('show-btn').dataset.next = q.showResults ? 'hide' : 'show';
    // Modération (masquer) pour les textes libres ; outils post-it en plus.
    var moderated = ['text', 'wall', 'postit'].indexOf(q.type) !== -1;
    WL.renderResults($('live-results'), q, q.results, {
      onHide: moderated ? function (aid, hidden) { act('answer_hide', { qid: q.id, aid: aid, hidden: hidden }); } : null,
      onAdmin: q.type === 'postit' ? function (pid, op, arg) { act('post_admin', { qid: q.id, pid: pid, op: op, arg: arg }); } : null
    });
    if (q.type === 'wall' || q.type === 'postit') {
      $('show-btn').textContent = q.showResults ? 'Masquer aux participants' : 'Publier (projection et téléphones)';
    }
  }

  ['open-btn', 'show-btn'].forEach(function (id) {
    $(id).addEventListener('click', function () { control($(id).dataset.next); });
  });
  document.querySelectorAll('#live [data-op]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.dataset.op === 'reset' && !confirm('Effacer toutes les réponses de cette question ?')) return;
      control(b.dataset.op);
    });
  });
  $('end-btn').addEventListener('click', function () {
    if (!data.ended && !confirm('Terminer la session ? Les participants ne pourront plus répondre.')) return;
    control(data.ended ? 'reopen' : 'end');
  });
  $('lock-btn').addEventListener('click', function () { control(data.locked ? 'unlock' : 'lock'); });
  $('rename-btn').addEventListener('click', function () {
    var title = prompt('Nouveau titre', data.title);
    if (title) act('session_rename', { title: title });
  });

  function renderList(d) {
    var list = WL.clear($('q-list'));
    d.questions.forEach(function (q, i) {
      list.appendChild(el('li', { class: 'list-item' + (i === d.current ? ' is-current' : '') },
        el('div', { class: 'grow' }, el('strong', null, q.text),
          el('p', { class: 'meta' }, WL.TYPES[q.type] + ' — ' + WL.plural(q.results.total, 'réponse')
            + (q.duration ? ' — ' + q.duration + ' s' : '') + (i === d.current ? ' — projetée' : ''))),
        el('div', { class: 'row wrap' },
          el('button', { type: 'button', class: 'btn', disabled: i === d.current,
            onclick: function () { control('goto', { qid: q.id }); } }, 'Projeter'),
          el('button', { type: 'button', class: 'btn btn-small', 'aria-label': 'Monter', disabled: i === 0,
            onclick: function () { act('question_move', { qid: q.id, dir: -1 }); } }, '↑'),
          el('button', { type: 'button', class: 'btn btn-small', 'aria-label': 'Descendre', disabled: i === d.questions.length - 1,
            onclick: function () { act('question_move', { qid: q.id, dir: 1 }); } }, '↓'),
          el('button', { type: 'button', class: 'btn', onclick: function () { openDialog(q); } }, 'Modifier'),
          el('button', { type: 'button', class: 'btn btn-danger', onclick: function () {
            if (confirm('Supprimer cette question et ses réponses ?')) act('question_delete', { qid: q.id });
          } }, 'Supprimer'))));
    });
  }

  // --- Formulaire de question -----------------------------------------------------

  var FIXED = { yesno: ['Oui', 'Non'], truefalse: ['Vrai', 'Faux'] };

  function optionLines() {
    var type = $('qf-type').value;
    return FIXED[type] || $('qf-options').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  /** Affiche les champs utiles au type choisi, et les cases « bonne réponse ». */
  function syncForm(correct) {
    var type = $('qf-type').value;
    WL.show($('qf-options-box'), ['mcq', 'poll', 'points', 'postit'].indexOf(type) !== -1);
    $('qf-options-label').textContent = type === 'postit' ? 'Colonnes (une par ligne, 6 au plus ; vide = une seule colonne « Idées »)'
      : 'Choix (un par ligne, 2 à 10)';
    WL.show($('qf-source-box'), type === 'dots');
    $('qf-budget-label').textContent = type === 'dots' ? 'Gommettes par participant' : 'Points à répartir';
    WL.show($('qf-multi-box'), type === 'mcq');
    WL.show($('qf-scale-box'), type === 'scale');
    WL.show($('qf-budget-box'), type === 'points' || type === 'dots');
    var quiz = ['yesno', 'truefalse', 'mcq'].indexOf(type) !== -1;
    WL.show($('qf-correct-box'), quiz);
    if (!quiz) return;
    var kept = correct || [].map.call($('qf-correct').querySelectorAll('input:checked'), function (c) { return Number(c.value); });
    var box = WL.clear($('qf-correct'));
    optionLines().forEach(function (label, i) {
      box.appendChild(el('label', { class: 'check' },
        el('input', { type: 'checkbox', value: i, checked: kept.indexOf(i) !== -1 }), ' ' + label));
    });
  }

  function openDialog(q) {
    editing = q || null;
    $('qd-title').textContent = q ? 'Modifier la question' : 'Nouvelle question';
    $('qf-type').value = q ? q.type : 'yesno';
    $('qf-text').value = q ? q.text : '';
    $('qf-options').value = q && !FIXED[q.type] ? q.options.join('\n') : '';
    $('qf-multi').checked = !!(q && q.multi);
    $('qf-scale').value = q ? String(q.scaleMax) : '5';
    $('qf-budget').value = q ? q.budget : 10;
    var sources = WL.clear($('qf-source'));
    data.questions.forEach(function (o, i) {
      if ((o.type === 'wall' || o.type === 'postit') && (!q || o.id !== q.id)) {
        sources.appendChild(el('option', { value: o.id, selected: q && q.source === o.id }, (i + 1) + '. ' + o.text));
      }
    });
    if (!sources.options.length) sources.appendChild(el('option', { value: '' }, 'Créez d\'abord un post-it collectif ou un mur'));
    $('qf-duration').value = q ? q.duration : 0;
    $('qf-change').checked = q ? q.allowChange : true;
    $('qf-error').textContent = '';
    syncForm(q ? q.correct : []);
    $('q-dialog').showModal();
    $('qf-text').focus();
  }

  $('add-q-btn').addEventListener('click', function () { openDialog(null); });
  $('qf-type').addEventListener('change', function () {
    if ($('qf-type').value === 'dots' && !editing) $('qf-budget').value = 3;
    syncForm([]);
  });
  $('qf-options').addEventListener('input', function () { syncForm(); });
  $('qf-cancel').addEventListener('click', function () { $('q-dialog').close(); });

  $('q-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var question = {
      type: $('qf-type').value, text: $('qf-text').value, options: optionLines(),
      multi: $('qf-multi').checked, scaleMax: Number($('qf-scale').value), budget: Number($('qf-budget').value),
      source: $('qf-source').value,
      duration: Number($('qf-duration').value), allowChange: $('qf-change').checked,
      correct: [].map.call($('qf-correct').querySelectorAll('input:checked'), function (c) { return Number(c.value); })
    };
    if (editing) {
      question.id = editing.id;
      // Même règle que wl_structure_changed() côté serveur.
      var relevant = { mcq: 'multi', scale: 'scaleMax', points: 'budget', dots: 'budget' }[question.type];
      var changed = question.type !== editing.type
        || (question.type !== 'postit' && question.options.length !== editing.options.length)
        || (relevant && question[relevant] !== editing[relevant])
        || (question.type === 'dots' && question.source !== editing.source);
      if (changed && editing.results.total && !confirm('Cette modification efface les '
        + WL.plural(editing.results.total, 'réponse') + ' déjà reçues. Continuer ?')) return;
    }
    WL.api('question_save', { body: { s: code, question: question }, headers: { 'X-CSRF-Token': csrf } }).then(function (r) {
      if (r.status !== 200) { $('qf-error').textContent = r.data.error; return; }
      $('q-dialog').close();
      poller.refresh();
    }, function () { $('qf-error').textContent = 'Pas de connexion au serveur.'; });
  });

  // --- Démarrage ------------------------------------------------------------------

  WL.api('me').then(function (r) {
    csrf = r.data.csrf || '';
    if (r.data.admin) showSessions();
    else showLogin('');
  }, function () { showLogin('Pas de connexion au serveur.'); });
}());
