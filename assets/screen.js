/* Écran de projection (screen.php?s=CODE) : question courante, résultats en
 * direct, QR code permanent, thèmes sombre / clair, plein écran. */
'use strict';

(function () {
  var el = WL.el, $ = WL.$;
  var code = (new URLSearchParams(location.search).get('s') || '').toUpperCase();
  var qrDone = false, offset = 0, timer = null, last = null;

  function error(text) {
    $('screen-error').textContent = text || '';
    WL.show($('screen-error'), !!text);
  }

  // --- Thème et plein écran -----------------------------------------------------

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    $('theme-btn').textContent = theme === 'dark' ? 'Thème clair' : 'Thème sombre';
    try { localStorage.setItem('wl_theme', theme); } catch (e) { /* sans stockage */ }
  }
  var saved = null;
  try { saved = localStorage.getItem('wl_theme'); } catch (e) { /* idem */ }
  setTheme(saved === 'light' ? 'light' : 'dark');
  $('theme-btn').addEventListener('click', function () {
    setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });
  function toggleFullscreen() {
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    if (!document.documentElement.requestFullscreen) { error('Plein écran non disponible sur ce navigateur : touche F11.'); return; }
    // Refus du navigateur : on le dit au lieu de ne rien faire.
    document.documentElement.requestFullscreen().catch(function (e) {
      error('Plein écran refusé par le navigateur (' + (e && e.message || 'raison inconnue') + ') : essayez la touche F11.');
    });
    // Ni accepté ni refusé (poste verrouillé, extension…) : ne jamais rester muet.
    setTimeout(function () {
      if (!document.fullscreenElement) error('Le navigateur n\'a pas activé le plein écran : essayez la touche F11.');
    }, 800);
  }
  $('full-btn').addEventListener('click', toggleFullscreen);
  window.addEventListener('resize', function () {
    if (document.body.classList.contains('s-live')) WL.fitResults($('s-results')); else fitQuestion();
  });
  document.addEventListener('fullscreenchange', function () {
    $('full-btn').textContent = document.fullscreenElement ? 'Quitter le plein écran' : 'Plein écran';
  });

  // --- Affichage ----------------------------------------------------------------

  function render(d) {
    offset = d.now - Date.now() / 1000;
    error('');
    document.title = d.title + ' — WoocLight';
    $('s-title').textContent = d.title;
    $('s-count').textContent = WL.plural(d.participants, 'participant');
    $('s-code').textContent = d.code;
    if (!qrDone) {
      WL.qr($('qr'), d.joinUrl, 5);
      qrDone = true;
    }
    var q = d.question;
    last = d;
    pilotLabel();
    // Résultats à l'écran : question et QR réduits, la place va aux résultats.
    document.body.classList.toggle('s-live', !d.ended && !!q && !!d.results);
    WL.show($('s-ended'), d.ended);
    WL.show($('s-welcome'), !d.ended && !q);
    WL.show($('s-question'), !d.ended && !!q);
    if (d.ended) {
      WL.renderRecap($('s-recap'), d);
      fitRecap();
      return;
    }
    if (!q) {
      $('s-url').textContent = d.joinUrl.replace(/^https?:\/\//, '').replace(/\/\?s=.*/, '');
      $('s-code-big').textContent = d.code;
      return;
    }
    $('s-meta').textContent = 'Question ' + d.position + ' / ' + d.count + ' — ' + WL.typeLabel(q);
    $('s-text').textContent = q.text;
    $('s-text').style.fontSize = '';
    timerFor(q);
    if (d.results) {
      WL.renderResults($('s-results'), q, d.results, { participants: d.participants });
      if (q.type === 'wall' && q.state === 'open') {
        $('s-results').appendChild(el('p', { class: 's-hint' }, 'Aimez les idées des autres sur votre appareil : touchez ♥.'));
      }
      if (q.explain) $('s-results').appendChild(el('p', { class: 's-explain' }, q.explain));
      WL.fitResults($('s-results'));
    } else {
      var msg = q.state === 'draft' ? 'Les votes vont bientôt s\'ouvrir.'
        : q.state === 'open' ? 'Répondez sur votre appareil !' : 'Les votes sont fermés.';
      var unit = { wall: 'message', postit: 'post-it' }[q.type] || 'réponse';
      // Décompte « 3 / 5 » pour savoir quand fermer le vote (mur et post-it :
      // nombre de contributions, une personne peut en publier plusieurs).
      var all = d.participants > 0 && (unit === 'réponse' ? d.answered : d.contributors) >= d.participants;
      WL.clear($('s-results')).appendChild(el('div', { class: 's-waiting' },
        el('p', { class: 's-answered' + (all ? ' s-all' : '') }, answeredText(d, unit)),
        el('p', null, all ? 'Tout le monde a répondu.' : msg)));
      fitQuestion();
    }
  }

  /** Récap de fin : réduit pour tenir dans l'écran avec la conclusion. */
  function fitRecap() {
    var box = $('s-recap');
    box.style.fontSize = '';
    var limit = window.innerHeight - 40;
    if (box.getBoundingClientRect().bottom <= limit) return;
    var lo = 10, hi = parseFloat(getComputedStyle(box).fontSize);
    for (var i = 0; i < 8; i++) {
      var mid = (lo + hi) / 2;
      box.style.fontSize = mid + 'px';
      if (box.getBoundingClientRect().bottom <= limit) lo = mid; else hi = mid;
    }
    box.style.fontSize = lo + 'px';
  }

  /** Pendant le vote : une longue question est réduite pour que le décompte
   *  reste visible au-dessus de la barre de pilotage. */
  function fitQuestion() {
    var text = $('s-text');
    text.style.fontSize = '';
    var limit = window.innerHeight - 90;
    var fits = function () { return $('s-results').getBoundingClientRect().bottom <= limit; };
    if (document.body.classList.contains('s-live') || fits()) return;
    var lo = 12, hi = parseFloat(getComputedStyle(text).fontSize);
    for (var i = 0; i < 8; i++) {
      var mid = (lo + hi) / 2;
      text.style.fontSize = mid + 'px';
      if (fits()) lo = mid; else hi = mid;
    }
    text.style.fontSize = lo + 'px';
  }

  function answeredText(d, unit) {
    return unit === 'réponse' ? d.answered + ' / ' + d.participants + ' ont répondu'
      : d.contributors + ' / ' + d.participants + ' ont participé (' + WL.plural(d.answered, unit) + ')';
  }

  function timerFor(q) {
    clearInterval(timer);
    var t = $('s-timer');
    var on = q.state === 'open' && q.closesAt;
    WL.show(t, !!on);
    if (!on) return;
    var tick = function () {
      var s = WL.remaining(q.closesAt, offset);
      t.textContent = s > 0 ? WL.formatTime(s) : 'Temps écoulé';
      t.classList.toggle('s-timer-low', s <= 10);
      if (s === 0) clearInterval(timer);
    };
    tick();
    timer = setInterval(tick, 1000);
  }

  // --- Démarrage ------------------------------------------------------------------

  if (!/^[A-Z2-9]{5}$/.test(code)) {
    error('Adresse incomplète : ouvrez la projection depuis l\'espace animateur.');
    return;
  }
  var poller = new WL.Poller('screen', 's=' + code, render, function (kind, r) {
    if (kind === 'offline') error('Connexion perdue. Reconnexion automatique…');
    else if (kind === 'online') error('');
    else if (kind === 'error') error(r.data.error || 'Erreur du serveur.');
  });
  poller.now();

  // --- Pilotage (animateur connecté dans ce navigateur) -------------------------
  // Mêmes commandes et même contrôle que admin.php (session animateur + CSRF) :
  // un participant qui ouvre cette page n'a pas de session, rien ne s'active
  // (et sans cookie animateur, aucune session PHP n'est ouverte pour lui).
  // Une télécommande de présentation envoie flèches / Page préc.-suiv.

  var csrf = '', busy = false;

  function control(op) {
    if (busy) return;
    busy = true;
    WL.api('control', { body: { s: code, op: op }, headers: { 'X-CSRF-Token': csrf } }).then(function (r) {
      busy = false;
      // Message d'abord, sans rafraîchir : l'affichage suivant l'effacerait aussitôt.
      if (r.status === 401 || r.status === 403) error('Reconnectez-vous dans l\'espace animateur pour piloter.');
      else if (!r.data.ok) error(r.data.error || 'Commande refusée.');
      else poller.now();
    }, function () { busy = false; });
  }

  /** Espace ou bouton central : ouvrir le vote, le fermer, afficher les
   *  résultats (publier pour mur et post-it), puis passer à la suivante. */
  function stepOp() {
    var q = last && last.question;
    if (!q) return 'next';
    var open = q.state === 'open' && !(q.closesAt && WL.remaining(q.closesAt, offset) === 0);
    if (q.state === 'draft') return 'open';
    // Mur : publier AVANT de fermer, sinon personne ne peut plus aimer.
    if (open && q.type === 'wall' && !q.showResults) return 'show';
    if (open) return 'close';
    if (!q.showResults) return 'show';
    // Dernière question terminée : la suite est le récap et la conclusion.
    return last.position >= last.count ? 'end' : 'next';
  }

  function pilotLabel() {
    if (!csrf) return;
    WL.show($('s-pilot'), !(last && last.ended)); // session terminée : rien à piloter
    var q = last && last.question, op = stepOp();
    var post = q && (q.type === 'wall' || q.type === 'postit');
    $('p-step').textContent = op === 'open' ? 'Ouvrir le vote' : op === 'close' ? 'Fermer le vote'
      : op === 'show' ? (post ? 'Publier' : 'Afficher les résultats') : op === 'end' ? 'Récap et conclusion'
      : q ? 'Question suivante' : 'Commencer';
    $('p-step').title = {
      open: 'Les participants peuvent répondre', close: 'Plus aucune réponse acceptée',
      show: post ? 'Rend les contributions visibles de tous' : 'Montre les résultats et la bonne réponse',
      next: 'Passe à la question suivante',
      end: 'Termine la session : récap et conclusion sur la projection et les téléphones (« Rouvrir la session » dans l\'espace animateur pour revenir)'
    }[op] + ' (Espace)';
    $('p-count').textContent = q && q.state !== 'draft'
      ? (post ? last.contributors : last.answered) + ' / ' + last.participants + (post ? ' ont participé' : ' ont répondu') : '';
    $('p-prev').disabled = !last || last.position === 0;
    $('p-next').disabled = !!last && last.position >= last.count;
  }

  if (document.body.dataset.pilot) WL.api('me').then(function (r) {
    if (!r.data || !r.data.admin) return;
    csrf = r.data.csrf;
    WL.show($('s-pilot'), true);
    pilotLabel();
    $('p-prev').addEventListener('click', function () { control('prev'); });
    $('p-next').addEventListener('click', function () { control('next'); });
    $('p-step').addEventListener('click', function () { control(stepOp()); });
    document.addEventListener('keydown', function (e) {
      if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
      var k = e.key;
      if (k === 'ArrowRight' || k === 'PageDown') control('next');
      else if (k === 'ArrowLeft' || k === 'PageUp') control('prev');
      else if (k === ' ' || k === 'Enter') control(stepOp());
      else if (k === 'q' || k === 'Q') document.body.classList.toggle('s-qr-big');
      else if (k === 'f' || k === 'F') toggleFullscreen();
      else return;
      e.preventDefault();
    });
  });
}());
