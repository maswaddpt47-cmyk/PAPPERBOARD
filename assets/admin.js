/* Espace animateur (admin.php) : connexion, liste des sessions, édition des
 * questions, pilotage en direct. Toutes les écritures portent le jeton CSRF. */
'use strict';

(function () {
  var el = WL.el, $ = WL.$;
  var csrf = '', code = null, poller = null, data = null, editing = null, qrFor = null, conclusionFor = null, synthesisFor = null;

  function banner(text) {
    $('banner').textContent = text || '';
    WL.show($('banner'), !!text);
  }

  function view(id) {
    ['login', 'sessions', 'editor', 'archive-view'].forEach(function (v) { WL.show($(v), v === id); });
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
      setBeta(r.data.prefs);
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
    showArchives();
    loadThemes();
    WL.api('sessions').then(function (r) {
      if (r.status === 401) return showLogin('');
      var list = WL.clear($('session-list'));
      if (!r.data.sessions.length) list.appendChild(el('li', { class: 'meta' }, 'Aucune session. Créez-en une ci-dessus.'));
      var demos = r.data.sessions.filter(function (s) { return s.demo; }).length;
      WL.show($('demo-delete'), demos > 0);
      $('demo-delete').textContent = 'Supprimer ' + (demos > 1 ? 'les ' + demos + ' démos' : 'la démo');
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
            el('button', { type: 'button', class: 'btn', title: 'Garde les questions et les résultats chiffrés, efface le détail des réponses (anonyme, sans limite de durée)', onclick: function () {
              if (confirm('Archiver « ' + s.title + ' » ? Les réponses une à une et les textes des participants seront effacés ; les résultats chiffrés, le récap, la conclusion et la synthèse sont gardés SANS LIMITE DE DURÉE : relisez la conclusion et la synthèse, aucun nom ne doit y figurer.')) {
                post('session_archive', { s: s.code }).then(showSessions);
              }
            } }, 'Archiver'),
            el('button', { type: 'button', class: 'btn btn-danger', onclick: function () {
              if (confirm('Supprimer définitivement « ' + s.title + ' » et toutes ses réponses ?')) {
                post('session_delete', { s: s.code }).then(showSessions);
              }
            } }, 'Supprimer'))));
      });
    });
  }

  // --- Archives (anonymes) ------------------------------------------------------

  var archive = null;

  function showArchives() {
    WL.api('archives').then(function (r) {
      var list = WL.clear($('archive-list'));
      if (r.status !== 200) return;
      if (!r.data.archives.length) list.appendChild(el('li', { class: 'meta' }, 'Aucune archive pour le moment.'));
      r.data.archives.forEach(function (a) {
        list.appendChild(el('li', { class: 'list-item' },
          el('div', { class: 'grow' }, el('strong', null, a.title),
            el('p', { class: 'meta' }, WL.plural(a.questions, 'question') + ' — ' + WL.plural(a.participants, 'participant')
              + ' — archivée le ' + new Date(a.archived * 1000).toLocaleDateString('fr-FR'))),
          el('button', { type: 'button', class: 'btn', onclick: function () { openArchive(a.id); } }, 'Ouvrir')));
      });
    });
  }

  function openArchive(id) {
    WL.api('archive', { query: 'id=' + encodeURIComponent(id) }).then(function (r) {
      if (r.status !== 200) { banner(r.data.error); return; }
      archive = r.data;
      view('archive-view');
      $('ar-title').textContent = archive.title;
      $('ar-meta').textContent = WL.plural(archive.participants, 'participant') + ' — ' + WL.plural(archive.questions.length, 'question')
        + (archive.created ? ' — atelier du ' + new Date(archive.created * 1000).toLocaleDateString('fr-FR') : '')
        + ' — archivée le ' + new Date(archive.archived * 1000).toLocaleDateString('fr-FR');
      $('ar-status').textContent = '';
      WL.renderRecap($('ar-recap'), archive);
      $('ar-synthesis').textContent = archive.synthesis || '';
      WL.show($('ar-synthesis-box'), !!archive.synthesis);
      var board = WL.clear($('ar-board'));
      archive.questions.forEach(function (q, i) {
        var res = el('div');
        board.appendChild(el('section', { class: 'bilan-q' }, el('h3', null, (i + 1) + '. ' + q.text), el('p', { class: 'meta' }, WL.typeLabel(q)), res));
        if (q.results.counts) WL.renderResults(res, Object.assign({ showResults: true, options: [] }, q), q.results);
        else res.appendChild(el('p', { class: 'meta' }, WL.plural(q.results.total, 'réponse') + ' (textes non conservés dans l\'archive)'));
      });
    });
  }

  $('archive-back').addEventListener('click', showSessions);
  $('ed-archive').addEventListener('click', function () {
    if (confirm('Archiver « ' + data.title + ' » ? Les réponses une à une et les textes des participants seront effacés ; les résultats chiffrés, le récap, la conclusion et la synthèse sont gardés SANS LIMITE DE DURÉE : relisez la conclusion et la synthèse, aucun nom ne doit y figurer.')) {
      post('session_archive', { s: code }).then(showSessions);
    }
  });
  $('ed-delete').addEventListener('click', function () {
    if (confirm('Supprimer définitivement « ' + data.title + ' » et toutes ses réponses ?')) post('session_delete', { s: code }).then(showSessions);
  });
  $('ar-pptx').addEventListener('click', function () {
    $('ar-status').textContent = 'Préparation du fichier PowerPoint…';
    window.WLBilanPptx($('ar-pptx').dataset.src, archive).then(function () { $('ar-status').textContent = 'Fichier PowerPoint téléchargé.'; },
      function (e) { $('ar-status').textContent = 'Export impossible : ' + (e && e.message || 'erreur inconnue') + '.'; });
  });
  $('ar-reuse').addEventListener('click', function () {
    post('archive_reuse', { id: archive.id }).then(function (d) { openSession(d.code); });
  });
  $('ar-delete').addEventListener('click', function () {
    if (confirm('Supprimer définitivement l\'archive « ' + archive.title + ' » ?')) post('archive_delete', { id: archive.id }).then(showSessions);
  });

  $('create-form').addEventListener('submit', function (e) {
    e.preventDefault();
    post('session_create', { title: $('new-title').value }).then(function (d) {
      $('new-title').value = '';
      openSession(d.code);
    });
  });

  $('demo-delete').addEventListener('click', function () {
    if (confirm('Supprimer toutes les sessions de démonstration ? Vos vraies sessions ne sont pas touchées.')) post('demo_delete', {}).then(showSessions);
  });

  // Bibliothèque de séances : celles livrées (assets/seances.js) et les thèmes ajoutés (seances.json, serveur).
  // Une séance devient une session par l'import validé côté serveur.
  var customThemes = [];
  function allThemes() { return (window.WL_SEANCES || []).concat(customThemes); }
  function seanceOf(id) { return allThemes().filter(function (t) { return t.id === id; })[0]; }
  function isCustom(id) { return customThemes.some(function (t) { return t.id === id; }); }
  function renderSeances() {
    var keep = $('seance-select').value, sel = WL.clear($('seance-select'));
    sel.appendChild(el('option', { value: '' }, 'Choisir une séance…'));
    (window.WL_SEANCES || []).forEach(function (t) { sel.appendChild(el('option', { value: t.id }, t.title)); });
    if (customThemes.length) {
      var group = el('optgroup', { label: 'Mes thèmes' });
      customThemes.forEach(function (t) { group.appendChild(el('option', { value: t.id }, t.title)); });
      sel.appendChild(group);
    }
    sel.value = seanceOf(keep) ? keep : '';
    showSeance();
  }
  function showSeance() {
    var t = seanceOf($('seance-select').value);
    $('seance-info').textContent = t ? 'Public : ' + (t.public || 'non précisé') + ' — Durée : ' + (t.duree || 'non précisée') + ' — Prérequis : ' + (t.prerequis || 'aucun')
      + ' — Objectif : ' + (t.objectif || 'non précisé') + ' (' + t.items.filter(function (it) { return it.type !== 'conclusion'; }).length + ' questions)' : '';
    WL.show($('seance-del'), !!t && isCustom(t.id));
  }
  function loadThemes() {
    WL.api('seances').then(function (r) {
      if (r.status === 200) { customThemes = r.data.themes || []; renderSeances(); }
    });
  }
  renderSeances();
  $('seance-select').addEventListener('change', function () { $('seance-copied').textContent = ''; showSeance(); });
  $('seance-btn').addEventListener('click', function () {
    var t = seanceOf($('seance-select').value);
    if (!t) { banner('Choisissez une séance dans la liste.'); return; }
    post('session_create', { title: t.title }).then(function (d) {
      post('questions_import', { s: d.code, raw: JSON.stringify(t.items), keep: t.items.map(function (_, i) { return i; }) })
        .then(function () { $('seance-select').value = ''; showSeance(); openSession(d.code); });
    });
  });
  $('seance-del').addEventListener('click', function () {
    var t = seanceOf($('seance-select').value);
    if (t && isCustom(t.id) && confirm('Supprimer le thème « ' + t.title + ' » de la bibliothèque ? Les sessions déjà créées ne sont pas touchées.')) {
      post('seance_delete', { id: t.id }).then(loadThemes);
    }
  });
  $('seance-review').addEventListener('click', function () {
    var t = seanceOf($('seance-select').value), box = $('seance-prompt'), note = $('seance-copied');
    if (!t) { banner('Choisissez une séance dans la liste.'); return; }
    var text = reviewText(t.title + ' — objectif : ' + (t.objectif || 'non précisé') + ' ; durée : ' + (t.duree || 'non précisée') + ' ; prérequis : ' + (t.prerequis || 'aucun'),
      t.public || 'non précisé', JSON.stringify(t.items, null, 1), true);
    box.value = text;
    WL.show(box, true);
    var done = function () { note.textContent = 'Copié : collez-le dans une autre IA que celle qui a écrit la séance, puis collez sa réponse dans « Ajouter un thème ».'; };
    var manual = function () { box.select(); note.textContent = 'Texte sélectionné : copiez-le (Ctrl+C).'; };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, manual);
    else manual();
  });
  $('seance-new-save').addEventListener('click', function () {
    var msg = $('seance-new-msg');
    msg.textContent = '';
    post('seance_save', { title: $('seance-new-title').value, public: $('seance-new-public').value, duree: $('seance-new-duree').value,
      prerequis: $('seance-new-prerequis').value, objectif: $('seance-new-objectif').value, raw: $('seance-new-raw').value }).then(function () {
      ['title', 'public', 'duree', 'prerequis', 'objectif', 'raw'].forEach(function (k) { $('seance-new-' + k).value = ''; });
      msg.textContent = 'Thème enregistré : il est dans la liste, sous « Mes thèmes ».';
      loadThemes();
    }).catch(function () { /* message déjà affiché dans la bannière */ });
  });

  $('demo-btn').addEventListener('click', function () {
    post('session_demo', {}).then(function (d) {
      // Fonctions en essai activées : le défi à étapes ferme la démo (la salle fictive y a déjà coché des étapes).
      var more = beta ? post('question_save', { s: d.code, question: CHALLENGES.notifs }) : Promise.resolve();
      more.then(function () { openSession(d.code); });
    });
  });

  // --- Éditeur et pilotage ---------------------------------------------------------

  // --- Onglets ------------------------------------------------------------------
  // Un groupe .tabs commande les panneaux nommés par aria-controls. L'onglet de
  // session choisi est retenu (confort, pas indispensable : stockage facultatif).

  function selectTab(group, name) {
    [].forEach.call(group.querySelectorAll('.tab'), function (b) {
      var on = b.dataset.tab === name;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
      WL.show($(b.getAttribute('aria-controls')), on);
    });
    if (group.closest('#editor')) { try { localStorage.setItem('wl_tab', name); } catch (e) { /* sans stockage */ } }
  }

  [].forEach.call(document.querySelectorAll('.tabs'), function (group) {
    var tabs = [].slice.call(group.querySelectorAll('.tab'));
    group.addEventListener('click', function (e) {
      var b = e.target.closest('.tab');
      if (b) selectTab(group, b.dataset.tab);
    });
    group.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(document.activeElement);
      if (i < 0 || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
      var next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      selectTab(group, next.dataset.tab);
      next.focus();
    });
    selectTab(group, tabs[0].dataset.tab);
  });

  function openSession(c) {
    code = c;
    data = null;
    view('editor');
    var saved = null;
    try { saved = localStorage.getItem('wl_tab'); } catch (e) { /* sans stockage */ }
    selectTab(document.querySelector('#editor .tabs'), saved || 'prep');
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

  /** Gommettes : colonnes du post-it source (« toutes » par défaut). */
  function fillColumns(selected) {
    var src = data.questions.filter(function (o) { return o.id === $('qf-source').value; })[0];
    var cols = WL.clear($('qf-column'));
    var many = !!src && src.type === 'postit' && src.options.length > 1;
    WL.show($('qf-column-box'), many);
    if (!many) return;
    cols.appendChild(el('option', { value: '-1' }, 'Toutes les colonnes'));
    src.options.forEach(function (name, i) { cols.appendChild(el('option', { value: String(i), selected: selected === i }, name)); });
  }
  $('qf-source').addEventListener('change', function () { fillColumns(-1); });

  $('synthesis-btn').addEventListener('click', function () {
    act('session_synthesis', { synthesis: $('synthesis').value }).then(function () {
      $('synthesis-saved').textContent = 'Synthèse enregistrée.';
    });
  });

  $('conclusion-btn').addEventListener('click', function () {
    act('session_conclusion', { conclusion: $('conclusion').value }).then(function () {
      $('conclusion-saved').textContent = 'Conclusion enregistrée.';
    });
  });

  // --- Bilan : tableau de bord et synthèse par une IA ------------------------------

  /** Résultats d'une question en texte, pour l'IA. withTexts : réponses écrites
   *  non masquées (elles peuvent contenir un nom : case décochée par défaut). */
  function bilanLines(q, withTexts) {
    var r = q.results, out = [], pct = function (n) { return r.total ? Math.round(100 * n / r.total) + ' %' : '0 %'; };
    var good = function (i) { return q.correct && q.correct.indexOf(i) !== -1 ? ' (bonne réponse)' : ''; };
    if (r.counts && q.type !== 'scale' && q.type !== 'points') {
      q.options.forEach(function (o, i) { out.push('  - ' + o + good(i) + ' : ' + r.counts[i] + ' (' + pct(r.counts[i]) + ')'); });
    } else if (q.type === 'scale') {
      out.push('  - Moyenne : ' + String(r.average).replace('.', ',') + ' / ' + q.scaleMax + ' ; répartition de 1 à ' + q.scaleMax + ' : ' + r.counts.join(', '));
    } else if (q.type === 'points') {
      q.options.forEach(function (o, i) { out.push('  - ' + o + ' : ' + r.counts[i] + ' points'); });
    } else if (q.type === 'wordcloud') {
      if (withTexts) out.push('  - Mots : ' + r.words.slice(0, 15).map(function (w) { return w.text + ' (' + w.n + ')'; }).join(', '));
    } else if (q.type === 'dots') {
      if (withTexts) r.items.forEach(function (it) { out.push('  - ' + it.text + ' : ' + WL.plural(it.n, 'gommette')); });
    } else if (withTexts && q.type === 'text') {
      r.texts.filter(function (t) { return !t.hidden; }).forEach(function (t) { out.push('  - « ' + t.text + ' »'); });
    } else if (withTexts && q.type === 'wall') {
      r.posts.filter(function (p) { return !p.hidden; }).forEach(function (p) { out.push('  - « ' + p.text + ' » (' + p.likes + ' j\'aime)'); });
    } else if (withTexts && q.type === 'postit') {
      r.posts.filter(function (p) { return !p.hidden; }).forEach(function (p) { out.push('  - [' + (q.options[p.col] || '') + '] « ' + p.text + ' »'); });
    }
    if (q.type === 'steps') out.push('  - Ont terminé toutes les étapes : ' + r.finished + ' / ' + r.total);
    if (r.compare) out.push('  - Évolution : ' + WL.compareText(r.compare));
    return out;
  }

  function bilanPrompt(withTexts) {
    var lines = [
      'Tu aides un animateur de médiation numérique à faire le bilan d\'un atelier animé avec WoocLight (votes anonymes sur téléphone).',
      'Atelier : ' + data.title + ' — ' + WL.plural(data.participants, 'participant') + '.',
      '',
      'Résultats, question par question :'
    ];
    data.questions.forEach(function (q, i) {
      lines.push('', (i + 1) + '. ' + q.text + ' [' + WL.typeLabel(q) + '] — '
        + (q.type === 'wall' || q.type === 'postit' ? WL.plural(q.results.total, 'contribution') : WL.plural(q.results.total, 'réponse')));
      bilanLines(q, withTexts).forEach(function (l) { lines.push(l); });
    });
    lines.push('',
      'Rédige, en français simple :',
      '1. Une synthèse en 5 points au plus : ce que les réponses montrent, points forts, idées reçues, écarts entre les quiz réussis et ratés.',
      '2. Une conclusion de 600 caractères au plus, adressée directement aux participants, à afficher en fin d\'atelier.',
      '3. Trois à cinq recommandations concrètes pour les participants, et trois pour l\'animateur (prochaine séance, notions à reprendre).',
      'Appuie-toi seulement sur ces résultats. Pour tout chiffre ou conseil de santé ajouté, cite une source précise (organisme officiel) '
        + 'ou écris « pas de source sûre ». Ne cite aucun nom de personne.');
    return lines.join('\n');
  }

  $('bilan-copy').addEventListener('click', function () {
    var text = bilanPrompt($('bilan-texts').checked), box = $('bilan-prompt'), note = $('bilan-copied');
    box.value = text;
    WL.show(box, true);
    var done = function () { note.textContent = 'Copié : collez-le dans l\'IA de votre choix.'; };
    var manual = function () { box.select(); note.textContent = 'Texte sélectionné : copiez-le (Ctrl+C).'; };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, manual);
    else manual();
  });

  $('bilan-pptx').addEventListener('click', function () {
    var btn = $('bilan-pptx'), note = $('bilan-copied');
    btn.disabled = true;
    note.textContent = 'Préparation du fichier PowerPoint…';
    window.WLBilanPptx(btn.dataset.src, data).then(function () {
      note.textContent = 'Fichier PowerPoint téléchargé.';
    }, function (e) {
      note.textContent = 'Export impossible : ' + (e && e.message || 'erreur inconnue') + '.';
    }).then(function () { btn.disabled = false; });
  });

  $('bilan-show').addEventListener('click', function () {
    var board = $('bilan-board');
    if (!board.hidden) { WL.show(board, false); $('bilan-show').textContent = 'Voir le tableau de bord'; return; }
    WL.clear(board);
    data.questions.forEach(function (q, i) {
      var res = el('div');
      board.appendChild(el('section', { class: 'bilan-q' },
        el('h3', null, (i + 1) + '. ' + q.text),
        el('p', { class: 'meta' }, WL.typeLabel(q)), res));
      WL.renderResults(res, Object.assign({}, q, { showResults: true }), q.results);
    });
    WL.show(board, true);
    $('bilan-show').textContent = 'Masquer le tableau de bord';
  });

  $('bilan-screen').addEventListener('click', function () { control(data.board ? 'board_off' : 'board'); });

  function control(op, extra) {
    return act('control', Object.assign({ op: op }, extra));
  }

  function render(d) {
    data = d;
    $('ed-title').textContent = d.title;
    // Ne pas écraser une conclusion en cours de saisie à chaque rafraîchissement.
    if (document.activeElement !== $('conclusion') && conclusionFor !== d.code + '|' + d.conclusion) {
      $('conclusion').value = d.conclusion || '';
      conclusionFor = d.code + '|' + d.conclusion;
    }
    if (document.activeElement !== $('synthesis') && synthesisFor !== d.code + '|' + d.synthesis) {
      $('synthesis').value = d.synthesis || '';
      synthesisFor = d.code + '|' + d.synthesis;
    }
    $('ed-code').textContent = d.code;
    $('ed-url').textContent = d.joinUrl;
    $('ed-url').href = d.joinUrl;
    $('ed-screen').href = 'screen.php?s=' + d.code;
    $('ed-csv').href = 'api.php?action=export&s=' + d.code;
    $('ed-csv-public').href = 'api.php?action=export&public=1&s=' + d.code;
    $('ed-print').href = 'api.php?action=export&format=print&s=' + d.code;
    $('ed-memo').href = 'api.php?action=export&format=memo&s=' + d.code;
    $('ed-questions').href = 'api.php?action=export&format=questions&s=' + d.code;
    $('ed-participants').textContent = WL.plural(d.participants, 'participant') + ' inscrit' + (d.participants > 1 ? 's' : '')
      + ' — ' + d.active + ' actif' + (d.active > 1 ? 's' : '');
    $('ed-participants').title = 'Actif : téléphone ouvert sur l\'atelier depuis moins de 3 minutes';
    renderCron(d.lastCron, d.now);
    $('end-btn').textContent = d.ended ? 'Rouvrir la session' : 'Terminer la session';
    $('bilan-screen').textContent = d.board ? 'Arrêter la projection du bilan' : 'Projeter le bilan';
    $('lock-btn').textContent = d.locked ? 'Rouvrir les inscriptions' : 'Fermer les inscriptions';
    $('qr-btn').textContent = d.qrHidden ? 'Afficher le QR code sur la projection' : 'Masquer le QR code sur la projection';
    if (qrFor !== d.joinUrl) {
      WL.qr($('ed-qr'), d.joinUrl, 4);
      qrFor = d.joinUrl;
    }
    renderLive(d);
    renderList(d);
    renderExtras(d);
    tips();
  }

  /** Purge automatique : la tâche planifiée horaire tourne-t-elle ? */
  function renderCron(t, now) {
    var box = $('cron-state'), min = t ? Math.round((now - t) / 60) : null;
    var ok = min !== null && min <= 120;
    box.className = 'cron-state ' + (ok ? 'is-ok' : 'is-ko');
    box.textContent = min === null
      ? '⚠️ Aucun passage de la purge horaire noté pour l\'instant. Normal dans l\'heure qui suit une mise à jour ; au-delà, '
        + 'vérifiez la tâche planifiée chez Alwaysdata (php ~/www/purge.php, chaque heure).'
      : (ok ? '✓ ' : '⚠️ ') + 'Dernier passage de la purge horaire : il y a '
        + (min < 60 ? WL.plural(min, 'minute') : WL.plural(Math.round(min / 60), 'heure'))
        + (ok ? '.' : ' : la tâche planifiée ne tourne plus, vérifiez-la chez Alwaysdata.');
  }

  // --- Signaux, Oser demander, pseudonymes ---------------------------------------

  var SIGNALS = { fast: '🐢 Trop vite', again: '🔁 À réexpliquer', help: '✋ Besoin d\'aide' };

  function renderExtras(d) {
    var sig = WL.clear($('signals')), any = false;
    Object.keys(SIGNALS).forEach(function (k) {
      var n = (d.signals || {})[k] || 0;
      any = any || n > 0;
      sig.appendChild(el('span', { class: 'signal-count' + (n ? ' is-on' : '') }, SIGNALS[k] + ' : ' + n));
    });
    // « Besoin d'aide » rattaché à une étape d'un défi : combien, et laquelle.
    (d.helpSteps || []).forEach(function (h) {
      var q = (d.questions || []).filter(function (x) { return x.id === h.q; })[0];
      if (!q || !q.options[h.i]) return;
      sig.appendChild(el('span', { class: 'signal-count is-on' }, '✋ ' + WL.plural(h.n, 'personne') + ' bloquée'
        + (h.n > 1 ? 's' : '') + ' à l\'étape ' + (h.i + 1) + ' : ' + q.options[h.i]));
    });
    sig.classList.toggle('is-on', any);

    $('asks-btn').textContent = d.asksOpen ? 'Fermer « Oser demander »' : 'Ouvrir « Oser demander »';
    var pending = d.asks.filter(function (a) { return !a.published; }).length;
    $('asks-chip').textContent = !d.asksOpen ? '❓ Oser demander : fermé (l\'ouvrir)'
      : '❓ Oser demander : ' + WL.plural(d.asks.length, 'question') + (pending ? ' dont ' + pending + ' à relire' : '');
    $('asks-chip').classList.toggle('btn-primary', pending > 0);
    $('asks-screen').textContent = d.show === 'asks' ? 'Arrêter la projection des questions' : 'Projeter les questions';
    var list = WL.clear($('asks-admin'));
    if (!d.asks.length) list.appendChild(el('li', { class: 'meta' }, d.asksOpen ? 'Aucune question pour le moment.' : 'Fermé : les téléphones ne proposent pas de poser une question.'));
    d.asks.forEach(function (a) {
      var op = function (o) { return function () { if (o !== 'delete' || confirm('Supprimer cette question ?')) act('ask_admin', { aid: a.id, op: o }); }; };
      list.appendChild(el('li', { class: 'ask-item' + (a.answered ? ' is-answered' : '') + (a.published ? '' : ' is-pending') },
        el('span', { class: 'ask-text' }, a.text),
        el('span', { class: 'meta' }, (a.published ? 'Publiée' : 'À relire') + ' · ' + WL.plural(a.votes, 'vote') + (a.answered ? ' · répondue' : '')),
        el('span', { class: 'row wrap' },
          el('button', { type: 'button', class: 'btn btn-small' + (a.published ? '' : ' btn-primary'), onclick: op(a.published ? 'unpublish' : 'publish') }, a.published ? 'Masquer' : 'Publier'),
          el('button', { type: 'button', class: 'btn btn-small', onclick: op(a.answered ? 'unanswered' : 'answered') }, a.answered ? 'Pas encore répondue' : 'Répondue'),
          el('button', { type: 'button', class: 'btn btn-small btn-danger', onclick: op('delete') }, 'Supprimer'))));
    });

    $('pseudo-btn').textContent = d.pseudo ? 'Désactiver les pseudonymes' : 'Activer les pseudonymes';
    $('podium-btn').textContent = d.show === 'podium' ? 'Arrêter la projection du podium' : 'Projeter le podium';
    $('podium-btn').disabled = !d.pseudo;
    var rank = WL.clear($('ranking'));
    WL.show(rank, d.pseudo);
    (d.ranking || []).forEach(function (r) {
      rank.appendChild(el('li', null, el('strong', null, r.rank + '. '), r.name + ' — ' + WL.plural(r.score, 'point')));
    });
  }

  $('asks-chip').addEventListener('click', function () { $('asks-card').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('asks-btn').addEventListener('click', function () { control(data.asksOpen ? 'asks_close' : 'asks_open'); });
  $('asks-screen').addEventListener('click', function () { control(data.show === 'asks' ? 'show_off' : 'show_asks'); });
  $('pseudo-btn').addEventListener('click', function () {
    if (data.pseudo && !confirm('Désactiver ? Les pseudonymes et le classement seront effacés.')) return;
    control(data.pseudo ? 'pseudo_off' : 'pseudo_on');
  });
  $('podium-btn').addEventListener('click', function () { control(data.show === 'podium' ? 'show_off' : 'show_podium'); });

  /** Bulles d'info des boutons dont le libellé change selon l'état. */
  var TIPS = {
    'Ouvrir le vote': 'Les participants peuvent répondre sur leur téléphone',
    'Fermer le vote': 'Plus aucune réponse acceptée pour cette question',
    'Afficher les résultats': 'Montre les résultats (et la bonne réponse) sur la projection et les téléphones',
    'Masquer les résultats': 'Retire les résultats de la projection et des téléphones',
    'Publier (projection et téléphones)': 'Après relecture : rend les contributions visibles de tous ; sur le mur, publier avant de fermer le vote pour que chacun puisse aimer',
    'Masquer aux participants': 'Les participants ne voient plus que leurs propres contributions',
    'Fermer les inscriptions': 'Plus personne ne peut rejoindre ; les inscrits continuent',
    'Rouvrir les inscriptions': 'De nouveaux participants peuvent rejoindre avec le code',
    'Terminer la session': 'Les téléphones affichent « Session terminée » ; les résultats restent',
    'Rouvrir la session': 'Les participants peuvent de nouveau répondre',
    'Masquer le QR code sur la projection': 'Plus de place pour les questions et les résultats ; touche Q sur la projection pour le montrer en grand',
    'Afficher le QR code sur la projection': 'QR code et code de session dans le coin de la projection'
  };
  function tips() {
    ['open-btn', 'show-btn', 'lock-btn', 'qr-btn', 'end-btn'].forEach(function (id) {
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
    $('live-pos').textContent = 'Question projetée : ' + (d.current + 1) + ' / ' + d.questions.length + ' — ' + WL.typeLabel(q);
    $('live-text').textContent = q.text;
    $('live-state').textContent = (open ? 'Vote ouvert' : q.state === 'draft' ? 'Vote pas encore ouvert' : 'Vote fermé')
      + ' — ' + (q.type === 'wall' || q.type === 'postit' ? WL.plural(q.results.total, 'contribution')
        : q.results.total + ' / ' + d.active + ' ont répondu') + (q.showResults ? ' — résultats affichés' : '');
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
    $(id).addEventListener('click', function () {
      var op = $(id).dataset.next, q = data.questions[data.current];
      // Fermer ou afficher sans aucune réponse : confirmation (constaté le 15/10/2026).
      if ((op === 'close' || op === 'show') && q && q.state !== 'draft' && q.results.total === 0
        && !confirm('Personne n\'a encore répondu. ' + (op === 'close' ? 'Fermer le vote' : 'Afficher') + ' quand même ?')) return;
      control(op);
    });
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
  $('qr-btn').addEventListener('click', function () { control(data.qrHidden ? 'qr_show' : 'qr_hide'); });
  $('rename-btn').addEventListener('click', function () {
    var title = prompt('Nouveau titre', data.title);
    if (title) act('session_rename', { title: title });
  });

  function renderList(d) {
    var list = WL.clear($('q-list'));
    d.questions.forEach(function (q, i) {
      list.appendChild(el('li', { class: 'list-item' + (i === d.current ? ' is-current' : '') },
        el('div', { class: 'grow' }, el('strong', null, q.text),
          el('p', { class: 'meta' }, WL.typeLabel(q) + ' — ' + WL.plural(q.results.total, 'réponse')
            + (q.duration ? ' — ' + q.duration + ' s' : '') + (i === d.current ? ' — projetée' : ''))),
        el('div', { class: 'row wrap' },
          // Session terminée : la projection reste sur la conclusion, projeter ne ferait rien.
          el('button', { type: 'button', class: 'btn', disabled: i === d.current || d.ended,
            title: d.ended ? 'Session terminée : « Rouvrir la session » (Réglages) pour projeter une question, ou touche B sur la projection pour le bilan'
              : 'Afficher cette question sur la projection et ouvrir son vote',
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
  var LIVE = ['poll', 'wordcloud', 'scale', 'points', 'steps']; // même liste que WL_LIVE_TYPES (lib.php)

  function optionLines() {
    var type = $('qf-type').value;
    return FIXED[type] || $('qf-options').value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  /** Avant / après : les questions précédentes de même forme (quiz avec bonne
   *  réponse et mêmes choix, ou échelle de même taille). */
  var compareWanted = '';
  function fillCompare() {
    var type = $('qf-type').value, keep = $('qf-compare').value || compareWanted;
    compareWanted = '';
    var sel = WL.clear($('qf-compare'));
    var options = JSON.stringify(optionLines()), scale = Number($('qf-scale').value);
    var upTo = editing ? data.questions.findIndex(function (o) { return o.id === editing.id; }) : data.questions.length;
    var list = ['yesno', 'truefalse', 'mcq', 'scale'].indexOf(type) === -1 ? [] : data.questions.slice(0, upTo).filter(function (e) {
      return e.type === type && (type === 'scale' ? e.scaleMax === scale : e.correct.length && JSON.stringify(e.options) === options);
    });
    sel.appendChild(el('option', { value: '' }, 'Aucune'));
    list.forEach(function (e) {
      sel.appendChild(el('option', { value: e.id, selected: e.id === keep }, (data.questions.indexOf(e) + 1) + '. ' + e.text));
    });
    WL.show($('qf-compare-box'), list.length > 0);
  }

  /** Affiche les champs utiles au type choisi, et les cases « bonne réponse ». */
  function syncForm(correct) {
    var type = $('qf-type').value;
    WL.show($('qf-options-box'), ['mcq', 'poll', 'points', 'postit', 'steps'].indexOf(type) !== -1);
    $('qf-options-label').textContent = type === 'postit' ? 'Colonnes (une par ligne, 6 au plus ; vide = une seule colonne « Idées »)'
      : type === 'steps' ? 'Titres des étapes (un par ligne, 2 à 10 ; ils s\'affichent aussi sur la projection)' : 'Choix (un par ligne, 2 à 10)';
    WL.show($('qf-variants-box'), type === 'steps');
    WL.show($('qf-source-box'), type === 'dots');
    $('qf-budget-label').textContent = type === 'dots' ? 'Gommettes par participant' : 'Points à répartir';
    WL.show($('qf-multi-box'), type === 'mcq');
    WL.show($('qf-live-box'), LIVE.indexOf(type) !== -1);
    WL.show($('qf-scale-box'), type === 'scale');
    WL.show($('qf-budget-box'), type === 'points' || type === 'dots');
    // Texte libre : jamais affiché automatiquement (une réponse peut contenir un nom).
    var written = ['text', 'wall', 'postit'].indexOf(type) !== -1;
    $('qf-reveal').querySelector('option[value="end"]').disabled = written;
    if (written && $('qf-reveal').value === 'end') $('qf-reveal').value = 'manual';
    fillCompare();
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
    applyBeta();
    if (q && q.type === 'steps') { $('qf-type-steps').hidden = false; $('qf-type-steps').disabled = false; }
    $('qd-title').textContent = q ? 'Modifier la question' : 'Nouvelle question';
    $('qf-type').value = q ? q.type : 'yesno';
    $('qf-text').value = q ? q.text : '';
    $('qf-explain').value = q ? (q.explain || '') : '';
    $('qf-link').value = q ? (q.link || '') : '';
    $('qf-variants').value = q ? variantsToText(q.variants) : '';
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
    fillColumns(q ? q.column : -1);
    $('qf-duration').value = q ? q.duration : 0;
    $('qf-change').checked = q ? q.allowChange : true;
    $('qf-live').checked = q ? q.live !== false : true;
    $('qf-reveal').value = q ? (q.reveal || 'manual') : 'manual';
    $('qf-error').textContent = '';
    WL.clear($('qf-compare'));
    compareWanted = q ? (q.compare || '') : '';
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
  $('qf-scale').addEventListener('change', fillCompare);
  $('qf-cancel').addEventListener('click', function () { $('q-dialog').close(); });

  $('q-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var question = {
      type: $('qf-type').value, text: $('qf-text').value, explain: $('qf-explain').value, options: optionLines(),
      multi: $('qf-multi').checked, scaleMax: Number($('qf-scale').value), budget: Number($('qf-budget').value),
      source: $('qf-source').value, column: Number($('qf-column').value || -1),
      duration: Number($('qf-duration').value), allowChange: $('qf-change').checked,
      reveal: $('qf-reveal').value, live: $('qf-live').checked, compare: $('qf-compare').value, link: $('qf-link').value.trim(),
      variants: $('qf-type').value === 'steps' ? textToVariants($('qf-variants').value) : [],
      correct: [].map.call($('qf-correct').querySelectorAll('input:checked'), function (c) { return Number(c.value); })
    };
    if (editing) {
      question.id = editing.id;
      // Même règle que wl_structure_changed() côté serveur.
      var relevant = { mcq: 'multi', scale: 'scaleMax', points: 'budget', dots: 'budget' }[question.type];
      var changed = question.type !== editing.type
        || (question.type !== 'postit' && question.options.length !== editing.options.length)
        || (question.type !== 'postit' && question.options.join('\n') !== editing.options.join('\n') && question.options.slice().sort().join('\n') === editing.options.slice().sort().join('\n'))
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

  // Brise-glaces : modifiables ensuite comme toute question ; vouvoiement par défaut.
  var ICE = {
    meteo: { type: 'poll', text: 'Votre météo du jour ?', options: ['☀️ Grand soleil', '🌤️ Quelques nuages', '🌧️ Pluie', '⛈️ Orage'] },
    energie: { type: 'scale', text: 'Votre niveau d\'énergie en ce moment ?', scaleMax: 5 },
    mot: { type: 'wordcloud', text: 'Un mot pour vous décrire aujourd\'hui ?' },
    appli: { type: 'wordcloud', text: 'L\'appli que vous ouvrez le plus souvent ?' },
    sms: { type: 'poll', text: 'Plutôt SMS ou appel ?', options: ['💬 SMS', '📞 Appel'] },
    photo: { type: 'poll', text: 'Plutôt photo ou vidéo ?', options: ['📷 Photo', '🎬 Vidéo'] },
    papier: { type: 'poll', text: 'Pour lire, plutôt papier ou écran ?', options: ['📖 Papier', '📱 Écran'] }
  };
  $('ice-btn').addEventListener('click', function () {
    var tpl = ICE[$('ice-select').value];
    if (!tpl) { banner('Choisissez un brise-glace dans la liste.'); return; }
    act('question_save', { question: tpl, first: true });
    $('ice-select').value = '';
  });

  // --- Fonctions en essai : défi à étapes ----------------------------------------
  // Réglage commun à tous les appareils de l'animateur (prefs.json) ; le serveur accepte le type dans tous les cas.
  var beta = false;
  function setBeta(prefs) { beta = !!(prefs && prefs.beta); applyBeta(); }
  function applyBeta() {
    $('beta-steps').checked = beta;
    $('qf-type-steps').hidden = !beta;
    $('qf-type-steps').disabled = !beta;
    WL.show($('challenge-row'), beta);
    WL.show($('gen-defi-box'), beta);
  }
  $('beta-steps').addEventListener('change', function () {
    post('prefs_save', { beta: $('beta-steps').checked }).then(function (d) { setBeta(d.prefs); });
  });
  applyBeta();

  /** Variantes ↔ texte du formulaire : « [Windows] » puis une ligne par étape. */
  function variantsToText(variants) {
    return (variants || []).map(function (v) { return '[' + v.name + ']\n' + v.steps.join('\n'); }).join('\n\n');
  }
  function textToVariants(text) {
    var out = [], cur = null;
    text.split('\n').forEach(function (line) {
      var l = line.trim(), m = /^\[(.+)\]$/.exec(l);
      if (m) { cur = { name: m[1].trim(), steps: [] }; out.push(cur); }
      else if (l && cur) cur.steps.push(l);
    });
    return out;
  }

  // Défis prêts à l'emploi. Les menus changent selon la marque et la version : à
  // vérifier sur les appareils avant l'atelier (message affiché à l'ajout).
  var CHALLENGES = {
    notifs: { type: 'steps', text: 'Défi : coupe les notifications dont tu n\'as pas besoin',
      options: ['Ouvrir les réglages des notifications', 'Couper les notifications d\'une application', 'Repérer le mode « ne pas déranger » ou sommeil'],
      variants: [
        { name: 'Windows', steps: ['Ouvre « Paramètres », puis « Système » et « Notifications ».', 'Désactive le bouton d\'une application dans la liste.', 'Repère « Ne pas déranger » (Windows 11) ou « Assistant de concentration » (Windows 10).'] },
        { name: 'Mac', steps: ['Ouvre « Réglages Système », puis « Notifications ».', 'Choisis une application et désactive « Autoriser les notifications ».', 'Dans « Réglages Système », ouvre « Concentration » et regarde les modes proposés.'] },
        { name: 'iPhone', steps: ['Ouvre « Réglages », puis « Notifications ».', 'Choisis une application et désactive « Autoriser les notifications ».', 'Dans « Réglages », ouvre « Concentration » puis « Sommeil ».'] },
        { name: 'Android', steps: ['Ouvre « Paramètres », puis « Notifications ».', 'Choisis une application et désactive ses notifications.', 'Cherche « Bien-être numérique » (ou « Ne pas déranger ») et regarde le mode coucher.'] }
      ] },
    temps: { type: 'steps', text: 'Défi : regarde ton temps d\'écran d\'hier',
      options: ['Ouvrir l\'outil de temps d\'écran', 'Repérer l\'application la plus utilisée', 'Regarder le nombre d\'heures de la journée'],
      variants: [
        { name: 'iPhone', steps: ['Ouvre « Réglages », puis « Temps d\'écran », et touche « Afficher toute l\'activité ».', 'Regarde l\'application en tête de la liste « Les plus utilisées ».', 'Regarde le total affiché pour la journée d\'hier.'] },
        { name: 'Android', steps: ['Ouvre « Paramètres », puis « Bien-être numérique et contrôle parental ».', 'Regarde l\'application en tête de la liste, ou touche le graphique de la veille.', 'Regarde le total affiché pour la journée d\'hier.'] }
      ] }
  };
  $('challenge-btn').addEventListener('click', function () {
    var tpl = CHALLENGES[$('challenge-select').value];
    if (!tpl) { banner('Choisissez un défi dans la liste.'); return; }
    act('question_save', { question: tpl }).then(function () {
      banner('Défi ajouté. Vérifiez les menus sur vos appareils : ils changent selon la marque et la version.');
    });
    $('challenge-select').value = '';
  });

  // Clôture : questions de fin d'atelier, ajoutées à la suite par l'import (validé côté serveur).
  var CLOSING = {
    utile: { type: 'scale', text: 'Cet atelier vous a-t-il été utile ?', scaleMax: 5 },
    retenu: { type: 'wordcloud', text: 'Un mot pour ce que vous retenez de cet atelier ?' },
    pas: { type: 'text', text: 'Le prochain pas que vous voulez essayer, après cet atelier ?' }
  };
  $('end-btn-add').addEventListener('click', function () {
    var pick = $('end-select').value;
    var list = pick === 'tout' ? [CLOSING.utile, CLOSING.retenu, CLOSING.pas] : CLOSING[pick] ? [CLOSING[pick]] : null;
    if (!list) { banner('Choisissez une clôture dans la liste.'); return; }
    act('questions_import', { raw: JSON.stringify(list), keep: list.map(function (_, i) { return i; }) });
    $('end-select').value = '';
  });

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
      $('gen-qcm').checked
        ? '- Uniquement des quiz à bonne réponse : "mcq" (avec "correct"), "truefalse" ou "yesno" (avec "correct"), surtout des "mcq". '
          + 'Ni sondage, ni nuage, ni mur, ni post-it, ni gommettes, ni échelle.'
        : '- Varie les types et utilise chacun au moins une fois si le nombre le permet, dans un ordre d\'atelier : '
          + 'un nuage de mots ou un sondage pour démarrer, puis les quiz, puis les échanges (mur, post-it, gommettes), et une échelle pour finir.',
      '- Intitulé : 200 caractères au plus. Choix : 80 caractères au plus, de 2 à 10 choix.',
      '- Quiz : bonnes réponses exactes et vérifiables, recopiées mot pour mot depuis les choix.',
      '- Quiz : mauvaises réponses crédibles, qui font réfléchir, jamais absurdes ni comiques.',
      '- Une affirmation à juger est une question "truefalse" (Vrai/Faux), jamais "yesno" (Oui/Non) ; "yesno" seulement pour une vraie question à laquelle on répond par oui ou par non.',
      $('gen-qcm').checked ? '- Pas d\'échelle.' : '- Une seule échelle (« scale »), en toute fin d\'atelier.',
      '- Chaque question a un champ "explain" : 2 ou 3 phrases (300 caractères au plus) affichées avec les résultats '
        + 'pour lancer l\'échange : la bonne réponse et pourquoi, ou un chiffre de repère pour un sondage, avec sa source '
        + '(organisme officiel, étude nommée). Si tu n\'as pas de source sûre, écris « pas de source sûre » plutôt qu\'en inventer une.',
      '',
      'Types possibles :',
      '- "yesno" : question Oui/Non ; "correct" facultatif : "Oui" ou "Non".',
      '- "truefalse" : affirmation ; "correct" : "Vrai" ou "Faux".',
      '- "mcq" : quiz ; "options" : les choix ; "correct" : liste des textes des bonnes réponses ; "multi": true s\'il y en a plusieurs.',
      '- "poll" : sondage d\'opinion, UNE seule réponse, sans bonne réponse ; "options". '
        + 'Si plusieurs réponses peuvent être vraies en même temps pour une personne, utilise "mcq" avec "multi": true et sans "correct".',
      '- "wordcloud" : réponse en un ou deux mots (nuage de mots).',
      '- "text" : réponse libre courte (80 caractères).',
      '- "scale" : échelle d\'accord ou de satisfaction ; "scaleMax" : 5 ou 10.',
      '- "points" : répartir des points entre des priorités ; "options" ; "budget" (ex. 10).',
      '- "wall" : mur d\'idées, chacun publie de courts messages.',
      '- "postit" : post-it collectif ; "options" : 2 à 4 colonnes (ex. "Points forts", "Difficultés").',
      '- "dots" : vote par gommettes sur les idées d\'un mur ou d\'un post-it placé AVANT ; '
        + '"source" : son numéro dans la liste (1 = première question) ; "budget" : gommettes par personne (ex. 3) ; '
        + '"column" (facultatif) : le nom exact d\'une colonne du post-it source, pour ne voter que sur ses idées ; '
        + 'obligatoire dès que l\'intitulé cite une colonne, sinon toutes les idées sont proposées.',
      $('gen-defi').checked && !$('gen-defi-box').hidden
        ? '- Termine par UN élément "steps" (défi pratique à faire sur l\'appareil, après les quiz) : "options" = 3 à 6 titres courts d\'étapes (80 caractères au plus) ; '
          + '"variants" (facultatif) = un objet nom d\'appareil → liste d\'étapes détaillées (160 caractères au plus), avec EXACTEMENT autant d\'étapes que "options", '
          + 'pour 2 à 4 systèmes parmi "Windows", "Mac", "iPhone", "Android" ; sans "variants" si les étapes ne dépendent pas de l\'appareil. '
          + 'Pour chaque chemin de menu, appuie-toi sur le support officiel du fabricant (Microsoft, Apple, Google) et écris « menu à vérifier » si tu n\'es pas sûr : les menus changent selon la version.'
        : null,
      '- "compare" (facultatif, sur un quiz ou une "scale" posés une seconde fois en fin d\'atelier) : numéro d\'une question précédente '
        + 'de même type et mêmes choix, pour mesurer la progression (avant / après).',
      '',
      '- Termine la liste par un élément {"type": "conclusion", "text": "…"} : 2 à 4 phrases (600 caractères au plus) '
        + 'à retenir de l\'atelier, concrètes et adaptées au public, affichées à la fin avec le récap des réponses.',
      '',
      'Réponds UNIQUEMENT par une liste JSON valide, sans texte autour. Exemple de format :',
      '[',
      '  {"type": "wordcloud", "text": "Un mot pour dire ce que vous évoque …"},',
      '  {"type": "mcq", "text": "…", "options": ["…", "…", "…"], "correct": ["…"], "explain": "… Source : …"},',
      '  {"type": "postit", "text": "…", "options": ["…", "…"]},',
      '  {"type": "dots", "text": "…", "source": 3, "budget": 3},',
      '  {"type": "conclusion", "text": "À retenir : …"}',
      ']'
    ].filter(function (line) { return line !== null; }).join('\n');
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
    if (q.type === 'steps' && q.variants && q.variants.length) opts.push('— variantes : ' + q.variants.map(function (v) { return v.name; }).join(', '));
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
      if (it.conclusion !== undefined) {
        list.appendChild(el('li', { class: 'list-item' }, el('label', { class: 'check grow' },
          el('input', { type: 'checkbox', value: i, checked: true }),
          el('span', null, el('strong', null, 'Conclusion de l\'atelier'), el('span', { class: 'meta gen-detail' }, it.conclusion)))));
        return;
      }
      var detail = genDetail(it);
      list.appendChild(el('li', { class: 'list-item' }, el('label', { class: 'check grow' },
        el('input', { type: 'checkbox', value: i, checked: true }),
        el('span', null, el('strong', null, it.text),
          el('span', { class: 'meta' }, ' — ' + WL.TYPES[it.type]),
          detail ? el('span', { class: 'meta gen-detail' }, detail) : null,
          it.warning ? el('span', { class: 'error gen-detail' }, '⚠️ Attention : ' + it.warning) : null))));
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
  function copyText(text, note, where) {
    var box = $('gen-prompt');
    box.value = text;
    WL.show(box, true);
    var done = function () { note.textContent = 'Copié : collez-le dans ' + (where || 'l\'IA') + '.'; };
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
  function reviewText(theme, publicLabel, questions, withReply) {
    return [
      'Tu relis des questions écrites par une autre IA pour un atelier de médiation numérique animé avec WoocLight (vote en direct sur téléphone).',
      'Thème : ' + theme,
      'Public : ' + publicLabel,
      '',
      'Méthode, dans cet ordre :',
      '1. Public : chaque question s\'adresse-t-elle vraiment à ce public (ton, vocabulaire, situations de son quotidien) ? Cite les numéros qui ne vont pas.',
      '2. Fond : pour chaque quiz, la bonne réponse est-elle juste ? Une mauvaise réponse pourrait-elle être défendue ? '
        + 'Signale tout chiffre, loi, âge ou affirmation de santé, et toute simplification excessive. '
        + 'Vérifie aussi chaque explication ("explain") : juste, cohérente avec la bonne réponse, source réelle.',
      '3. Sources : pour chaque point de fond, cite une source précise (organisme, titre, date, lien). '
        + 'Préfère les sources officielles françaises (Légifrance, Service-public.fr, CNIL, Santé publique France, ANSES, HAS, Inserm). '
        + 'Si tu n\'as pas de source sûre, écris « pas de source sûre » : n\'invente jamais une loi, une étude, un chiffre ou un lien.',
      '4. Forme : affirmation posée en Oui/Non au lieu de Vrai/Faux, sondage alors que plusieurs réponses sont vraies, '
        + 'mauvaise réponse absurde ou trop facile, faute de français, gommettes ("dots") dont la "source" n\'est pas un mur ou un post-it placé avant.',
      withReply
        ? '5. Termine par la liste des corrections à faire, question par question (n\'écris aucun crochet carré dans les points 1 à 5), '
          + 'puis, tout à la fin, la VERSION CORRIGÉE : la liste complète, du « [ » au « ] », au même format que ci-dessous, mêmes types et même ordre, '
          + 'sans adresse de site inventée. Pas de note, pas de compliment. Si une catégorie n\'a aucun défaut, dis-le en une ligne.'
        : '5. Termine par la liste des corrections à faire, question par question. Pas de note, pas de compliment. '
          + 'Si une catégorie n\'a aucun défaut, dis-le en une ligne.',
      '',
      'Questions (numérotées à partir de 1, dans l\'ordre de la liste) :',
      questions
    ].join('\n');
  }

  function reviewPrompt() {
    return reviewText($('gen-theme').value.trim() || 'à déduire des questions', $('gen-public').value, $('gen-raw').value.replace(/\\([\[\]])/g, '$1').trim(), false);
  }

  // Garder les questions de la session comme thème de la bibliothèque (sans aucune réponse).
  $('ed-theme').addEventListener('click', function () {
    var title = window.prompt('Titre du thème dans la bibliothèque :', data.title);
    if (!title) return;
    post('seance_save', { s: code, title: title }).then(function () { banner('Thème enregistré : il est dans la bibliothèque, page Sessions, sous « Mes thèmes ».'); });
  });

  $('gen-review').addEventListener('click', function () { copyText(reviewPrompt(), $('gen-review-copied'), 'une autre IA que celle qui a généré les questions'); });

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
    setBeta(r.data.prefs);
    if (r.data.admin) showSessions();
    else showLogin('');
  }, function () { showLogin('Pas de connexion au serveur.'); });
}());
