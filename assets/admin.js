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

  $('all-duration-btn').addEventListener('click', function () {
    var n = Math.round(Number($('all-duration').value));
    if (!(n >= 0 && n <= 3600)) { banner('Durée entre 0 et 3600 secondes.'); return; }
    act('questions_duration', { duration: n });
  });

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
    $('ed-questions').href = 'api.php?action=export&format=questions&s=' + d.code;
    $('ed-participants').textContent = WL.plural(d.participants, 'participant') + ' connecté' + (d.participants > 1 ? 's' : '');
    $('end-btn').textContent = d.ended ? 'Rouvrir la session' : 'Terminer la session';
    $('lock-btn').textContent = d.locked ? 'Rouvrir les inscriptions' : 'Fermer les inscriptions';
    if (qrFor !== d.joinUrl) {
      WL.qr($('ed-qr'), d.joinUrl, 4);
      qrFor = d.joinUrl;
    }
    renderLive(d);
    renderList(d);
    tips();
  }

  /** Bulles d'info des boutons dont le libellé change selon l'état. */
  var TIPS = {
    'Ouvrir le vote': 'Les participants peuvent répondre sur leur téléphone',
    'Fermer le vote': 'Plus aucune réponse acceptée pour cette question',
    'Afficher les résultats': 'Montre les résultats (et la bonne réponse) sur la projection et les téléphones',
    'Masquer les résultats': 'Retire les résultats de la projection et des téléphones',
    'Publier (projection et téléphones)': 'Après relecture : rend les contributions visibles de tous',
    'Masquer aux participants': 'Les participants ne voient plus que leurs propres contributions',
    'Fermer les inscriptions': 'Plus personne ne peut rejoindre ; les inscrits continuent',
    'Rouvrir les inscriptions': 'De nouveaux participants peuvent rejoindre avec le code',
    'Terminer la session': 'Les téléphones affichent « Session terminée » ; les résultats restent',
    'Rouvrir la session': 'Les participants peuvent de nouveau répondre'
  };
  function tips() {
    ['open-btn', 'show-btn', 'lock-btn', 'end-btn'].forEach(function (id) {
      $(id).title = TIPS[$(id).textContent] || '';
    });
  }

  function renderLive(d) {
    var q = d.questions[d.current];
    var has = !!q;
    ['open-btn', 'show-btn'].forEach(function (id) { $(id).disabled = !has; });
    document.querySelector('#live [data-op="reset"]').disabled = !has;
    document.querySelector('#live [data-op="prev"]').disabled = d.current < 0;
    document.querySelector('#live [data-op="next"]').disabled = d.current >= d.questions.length - 1;
    if (!has) {
      $('open-btn').textContent = 'Ouvrir le vote';
      $('show-btn').textContent = 'Afficher les résultats';
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
      + ' — ' + (q.type === 'wall' || q.type === 'postit' ? WL.plural(q.results.total, 'contribution')
        : q.results.total + ' / ' + d.participants + ' ont répondu') + (q.showResults ? ' — résultats affichés' : '');
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
          el('button', { type: 'button', class: 'btn', disabled: i === d.current, title: 'Afficher cette question sur la projection et ouvrir son vote',
            onclick: function () { control('goto', { qid: q.id }); } }, 'Projeter'),
          el('button', { type: 'button', class: 'btn btn-small', 'aria-label': 'Monter', title: 'Monter d\'un rang', disabled: i === 0,
            onclick: function () { act('question_move', { qid: q.id, dir: -1 }); } }, '↑'),
          el('button', { type: 'button', class: 'btn btn-small', 'aria-label': 'Descendre', title: 'Descendre d\'un rang', disabled: i === d.questions.length - 1,
            onclick: function () { act('question_move', { qid: q.id, dir: 1 }); } }, '↓'),
          el('button', { type: 'button', class: 'btn', title: 'Changer l\'intitulé, les choix, la durée… (efface les réponses si le type ou les choix changent)', onclick: function () { openDialog(q); } }, 'Modifier'),
          el('button', { type: 'button', class: 'btn btn-danger', title: 'Supprimer la question et ses réponses', onclick: function () {
            if (confirm('Supprimer cette question et ses réponses ?')) act('question_delete', { qid: q.id });
          } }, 'Supprimer'))));
    });
  }

  // --- Formulaire de question -----------------------------------------------------

  var FIXED = { yesno: ['Oui', 'Non'], truefalse: ['Vrai', 'Faux'] };
  var LIVE = ['poll', 'wordcloud', 'scale', 'points']; // même liste que WL_LIVE_TYPES (lib.php)

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
    WL.show($('qf-live-box'), LIVE.indexOf(type) !== -1);
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
    $('qf-live').checked = q ? q.live !== false : true;
    $('qf-reveal').value = q ? (q.reveal || 'manual') : 'manual';
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
      reveal: $('qf-reveal').value, live: $('qf-live').checked,
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

  // --- Génération par une IA (copier-coller) ---------------------------------------
  // WoocLight n'appelle aucune IA : l'animateur colle le texte dans l'outil de son
  // choix, puis recolle la réponse. Le serveur la lit et la valide (questions_import).

  function genPrompt() {
    return [
      'Tu prépares les questions d\'un atelier de médiation numérique animé avec WoocLight (vote en direct sur téléphone).',
      'Thème : ' + $('gen-theme').value.trim(),
      'Public : ' + $('gen-public').value,
      'Nombre de questions : ' + $('gen-count').value,
      '',
      'Règles :',
      '- Langage simple, phrases courtes, adapté au public. Aucun nom de personne réelle.',
      '- Chaque question s\'adresse directement à ce public : tutoiement pour des enfants ou des adolescents, '
        + 'exemples tirés de leur quotidien.',
      '- Varie les types et utilise chacun au moins une fois si le nombre le permet, dans un ordre d\'atelier : '
        + 'un nuage de mots ou un sondage pour démarrer, puis les quiz, puis les échanges (mur, post-it, gommettes), et une échelle pour finir.',
      '- Intitulé : 200 caractères au plus. Choix : 80 caractères au plus, de 2 à 10 choix.',
      '- Quiz : bonnes réponses exactes et vérifiables, recopiées mot pour mot depuis les choix.',
      '- Quiz : mauvaises réponses crédibles, qui font réfléchir, jamais absurdes ni comiques.',
      '- Une seule échelle (« scale »), en toute fin d\'atelier.',
      '',
      'Types possibles :',
      '- "yesno" : question Oui/Non ; "correct" facultatif : "Oui" ou "Non".',
      '- "truefalse" : affirmation ; "correct" : "Vrai" ou "Faux".',
      '- "mcq" : quiz ; "options" : les choix ; "correct" : liste des textes des bonnes réponses ; "multi": true s\'il y en a plusieurs.',
      '- "poll" : sondage d\'opinion, sans bonne réponse ; "options".',
      '- "wordcloud" : réponse en un ou deux mots (nuage de mots).',
      '- "text" : réponse libre courte (80 caractères).',
      '- "scale" : échelle d\'accord ou de satisfaction ; "scaleMax" : 5 ou 10.',
      '- "points" : répartir des points entre des priorités ; "options" ; "budget" (ex. 10).',
      '- "wall" : mur d\'idées, chacun publie de courts messages.',
      '- "postit" : post-it collectif ; "options" : 2 à 4 colonnes (ex. "Points forts", "Difficultés").',
      '- "dots" : vote par gommettes sur les idées d\'un mur ou d\'un post-it placé AVANT ; '
        + '"source" : son numéro dans la liste (1 = première question) ; "budget" : gommettes par personne (ex. 3).',
      '',
      'Réponds UNIQUEMENT par une liste JSON valide, sans texte autour. Exemple de format :',
      '[',
      '  {"type": "wordcloud", "text": "Un mot pour dire ce que vous évoque …"},',
      '  {"type": "mcq", "text": "…", "options": ["…", "…", "…"], "correct": ["…"]},',
      '  {"type": "postit", "text": "…", "options": ["…", "…"]},',
      '  {"type": "dots", "text": "…", "source": 3, "budget": 3}',
      ']'
    ].join('\n');
  }

  var genItems = [];

  function genReset() {
    genItems = [];
    WL.clear($('gen-list'));
    WL.show($('gen-preview'), false);
    $('gen-save').disabled = true;
    $('gen-error').textContent = '';
  }

  function genChecked() {
    return [].map.call($('gen-list').querySelectorAll('input:checked'), function (c) { return Number(c.value); });
  }

  /** Détail d'une question de l'aperçu : choix (bonne réponse marquée ✓), échelle, source. */
  function genDetail(q) {
    if (q.type === 'scale') return 'De 1 à ' + q.scaleMax;
    if (q.type === 'dots') return WL.plural(q.budget, 'gommette') + ' sur les idées de la question ' + (Number(q.source.slice(1)) + 1);
    var opts = q.options.map(function (o, i) { return (q.correct.indexOf(i) !== -1 ? '✓ ' : '') + o; });
    if (q.type === 'points') opts.unshift(q.budget + ' points :');
    if (q.type === 'postit') opts.unshift('Colonnes :');
    return opts.join(' · ');
  }

  function genRender() {
    var list = WL.clear($('gen-list'));
    genItems.forEach(function (it, i) {
      if (it.error) {
        list.appendChild(el('li', { class: 'list-item' }, el('div', { class: 'grow' },
          el('p', { class: 'error' }, 'Question ' + (i + 1) + ' écartée : ' + it.error))));
        return;
      }
      var detail = genDetail(it);
      list.appendChild(el('li', { class: 'list-item' }, el('label', { class: 'check grow' },
        el('input', { type: 'checkbox', value: i, checked: true }),
        el('span', null, el('strong', null, it.text),
          el('span', { class: 'meta' }, ' — ' + WL.TYPES[it.type]),
          detail ? el('span', { class: 'meta gen-detail' }, detail) : null))));
    });
    WL.show($('gen-preview'), true);
    $('gen-save').disabled = !genChecked().length;
  }

  $('gen-btn').addEventListener('click', function () {
    genReset();
    $('gen-copied').textContent = '';
    $('gen-dialog').showModal();
    $('gen-theme').focus();
  });
  $('gen-cancel').addEventListener('click', function () { $('gen-dialog').close(); });
  $('gen-list').addEventListener('change', function () { $('gen-save').disabled = !genChecked().length; });
  $('gen-raw').addEventListener('input', genReset);

  /** Affiche le texte dans la zone dédiée et le copie (sinon le sélectionne). */
  function copyText(text, note) {
    var box = $('gen-prompt');
    box.value = text;
    WL.show(box, true);
    var done = function () { note.textContent = 'Copié : collez-le dans l\'IA.'; };
    var manual = function () { box.select(); note.textContent = 'Texte sélectionné : copiez-le (Ctrl+C).'; };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, manual);
    else manual();
  }

  $('gen-copy').addEventListener('click', function () {
    if (!$('gen-theme').value.trim()) { $('gen-error').textContent = 'Indiquez un thème.'; $('gen-theme').focus(); return; }
    $('gen-error').textContent = '';
    copyText(genPrompt(), $('gen-copied'));
  });

  /** Consigne pour faire relire les questions par une autre IA. Ordre imposé
   *  (public, fond, sources, forme) et sources exigées sans invention : retenu
   *  après l'évaluation croisée de quatre IA du 14/10/2026 (CHANTIERS.md). */
  function reviewPrompt() {
    var theme = $('gen-theme').value.trim() || 'à déduire des questions';
    return [
      'Tu relis des questions écrites par une autre IA pour un atelier de médiation numérique animé avec WoocLight (vote en direct sur téléphone).',
      'Thème : ' + theme,
      'Public : ' + $('gen-public').value,
      '',
      'Méthode, dans cet ordre :',
      '1. Public : chaque question s\'adresse-t-elle vraiment à ce public (ton, vocabulaire, situations de son quotidien) ? Cite les numéros qui ne vont pas.',
      '2. Fond : pour chaque quiz, la bonne réponse est-elle juste ? Une mauvaise réponse pourrait-elle être défendue ? '
        + 'Signale tout chiffre, loi, âge ou affirmation de santé, et toute simplification excessive.',
      '3. Sources : pour chaque point de fond, cite une source précise (organisme, titre, date, lien). '
        + 'Préfère les sources officielles françaises (Légifrance, Service-public.fr, CNIL, Santé publique France, ANSES, HAS, Inserm). '
        + 'Si tu n\'as pas de source sûre, écris « pas de source sûre » : n\'invente jamais une loi, une étude, un chiffre ou un lien.',
      '4. Forme : affirmation posée en Oui/Non au lieu de Vrai/Faux, sondage alors que plusieurs réponses sont vraies, '
        + 'mauvaise réponse absurde ou trop facile, faute de français, gommettes ("dots") dont la "source" n\'est pas un mur ou un post-it placé avant.',
      '5. Termine par la liste des corrections à faire, question par question. Pas de note, pas de compliment. '
        + 'Si une catégorie n\'a aucun défaut, dis-le en une ligne.',
      '',
      'Questions (numérotées à partir de 1, dans l\'ordre de la liste) :',
      $('gen-raw').value.replace(/\\([\[\]])/g, '$1').trim()
    ].join('\n');
  }

  $('gen-review').addEventListener('click', function () { copyText(reviewPrompt(), $('gen-review-copied')); });

  /** Message d'invitation : lien (code compris) et code à taper en secours. */
  function invitation() {
    return 'Rejoignez l\'atelier « ' + data.title + ' » : ' + data.joinUrl + ' (code ' + data.code + ')';
  }

  /** Copie l'invitation pour l'envoyer par SMS ou mail ; sans presse-papiers,
   *  sélectionne l'adresse pour un Ctrl+C. */
  $('ed-url-copy').addEventListener('click', function () {
    var link = $('ed-url'), note = $('ed-url-copied');
    var done = function () { note.textContent = 'Invitation copiée : collez-la dans un SMS ou un mail.'; };
    var manual = function () {
      var range = document.createRange();
      range.selectNodeContents(link);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      note.textContent = 'Adresse sélectionnée : copiez-la (Ctrl+C).';
    };
    if (!data) return;
    if (navigator.clipboard) navigator.clipboard.writeText(invitation()).then(done, manual);
    else manual();
  });

  /** Partage natif (SMS, WhatsApp…), surtout sur téléphone : bouton masqué
   *  si le navigateur ne le propose pas. Annuler le partage n'est pas une erreur. */
  if (navigator.share) {
    $('ed-url-share').hidden = false;
    $('ed-url-share').addEventListener('click', function () {
      if (!data) return;
      navigator.share({ text: invitation() }).catch(function () {});
    });
  }

  // Fichier JSON : lu dans le navigateur, puis vérifié comme une réponse collée.
  $('gen-file').addEventListener('change', function () {
    var file = $('gen-file').files[0];
    $('gen-file').value = ''; // permet de réimporter le même fichier
    if (!file) return;
    if (file.size > 60000) { $('gen-error').textContent = 'Fichier trop gros (60 Ko au plus).'; return; }
    var reader = new FileReader();
    reader.onload = function () { $('gen-raw').value = String(reader.result); genCheck(); };
    reader.onerror = function () { $('gen-error').textContent = 'Fichier illisible.'; };
    reader.readAsText(file, 'utf-8');
  });

  $('gen-check').addEventListener('click', function () { genCheck(); });

  function genCheck() {
    genReset();
    var body = { s: code, raw: $('gen-raw').value, preview: true };
    WL.api('questions_import', { body: body, headers: { 'X-CSRF-Token': csrf } }).then(function (r) {
      if (r.status === 401) return showLogin('Session expirée : reconnectez-vous.');
      if (r.status !== 200) { $('gen-error').textContent = r.data.error; return; }
      genItems = r.data.items;
      genRender();
    }, function () { $('gen-error').textContent = 'Pas de connexion au serveur.'; });
  }

  $('gen-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var body = { s: code, raw: $('gen-raw').value, keep: genChecked() };
    WL.api('questions_import', { body: body, headers: { 'X-CSRF-Token': csrf } }).then(function (r) {
      if (r.status === 401) return showLogin('Session expirée : reconnectez-vous.');
      if (r.status !== 200) { $('gen-error').textContent = r.data.error; return; }
      $('gen-dialog').close();
      $('gen-raw').value = '';
      banner(WL.plural(r.data.added, 'question') + ' ajoutée' + (r.data.added > 1 ? 's' : '') + ' : relisez-les avant l\'atelier.');
      poller.refresh();
    }, function () { $('gen-error').textContent = 'Pas de connexion au serveur.'; });
  });

  // --- Démarrage ------------------------------------------------------------------

  WL.api('me').then(function (r) {
    csrf = r.data.csrf || '';
    if (r.data.admin) showSessions();
    else showLogin('');
  }, function () { showLogin('Pas de connexion au serveur.'); });
}());
