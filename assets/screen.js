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
  // Retaille les résultats selon la place libre (au-dessus de la barre de pilotage).
  function refit() {
    if (!$('s-ended').hidden) fitRecap();
    else if (document.body.classList.contains('s-live')) WL.fitResults($('s-results')); else fitQuestion();
  }
  window.addEventListener('resize', refit);
  document.addEventListener('fullscreenchange', function () {
    $('full-btn').textContent = document.fullscreenElement ? 'Quitter le plein écran' : 'Plein écran';
  });

  // --- Affichage ----------------------------------------------------------------

  function render(d) {
    // Dénominateur des « x / n » : téléphones actifs (signe de vie < 3 min).
    d.present = d.active === undefined ? d.participants : d.active;
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
    var board = !!d.board; // tableau de bord projeté, une question par diapositive
    document.body.classList.toggle('s-noqr', !!d.qrHidden); // touche Q : le montre quand même en grand
    // Résultats à l'écran : question et QR réduits, la place va aux résultats.
    var show = d.show || ''; // « Oser demander » ou podium, à la demande de l'animateur
    document.body.classList.toggle('s-live', !show && (board || !d.ended) && !!q && !!d.results);
    WL.show($('s-show'), !!show);
    WL.show($('s-ended'), d.ended && !board && !show);
    WL.show($('s-welcome'), !board && !show && !d.ended && !q);
    WL.show($('s-question'), !show && (board || (!d.ended && !!q)));
    if (show) {
      clearInterval(timer);
      renderShow(d);
      return;
    }
    if (board) {
      renderBoard(d);
      return;
    }
    if (d.ended) {
      // Conclusion seule : le détail par question passe par le bilan projeté (B).
      WL.renderRecap($('s-recap'), { conclusion: d.conclusion });
      fitRecap();
      rollIn(d.conclusion);
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
    linkFor(q);
    timerFor(q);
    if (d.results) {
      WL.renderResults($('s-results'), q, d.results, { participants: d.present });
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
      var all = d.present > 0 && (unit === 'réponse' ? d.answered : d.contributors) >= d.present;
      var done = unit === 'réponse' ? d.answered : d.contributors;
      WL.counter($('s-results'), q.id, answeredText(d, unit), done, d.present, all, all ? 'Tout le monde a répondu.' : msg);
      fitQuestion();
    }
  }

  /** Exercice sur un site extérieur : QR code à scanner et nom du site. Dessiné
   *  une seule fois par lien (le rafraîchissement ne le redessine pas). */
  function linkFor(q) {
    var box = $('s-link'), host = q.link ? WL.linkHost(q.link) : null;
    WL.show(box, !!host);
    if (!host || box.getAttribute('data-link') === q.link) return;
    box.setAttribute('data-link', q.link);
    var holder = el('div', { class: 's-link-qr' });
    WL.qr(holder, q.link, 5, 'QR code de l\'exercice : ' + host);
    WL.clear(box).appendChild(holder);
    box.appendChild(el('p', { class: 's-link-text' }, el('strong', null, 'Exercice : ' + host), el('br'),
      'Scannez le QR code ou ouvrez le lien depuis votre appareil.'));
  }

  /** Questions des participants (les plus votées d'abord) ou podium. */
  function renderShow(d) {
    var body = WL.clear($('s-show-body'));
    if (d.show === 'asks') {
      $('s-show-title').textContent = 'Vos questions';
      if (!d.asks.length) body.appendChild(el('p', { class: 's-waiting' }, 'Aucune question publiée pour le moment.'));
      var list = el('ol', { class: 's-asks' });
      d.asks.forEach(function (a) {
        list.appendChild(el('li', { class: 's-ask' + (a.answered ? ' is-answered' : '') },
          el('span', { class: 's-ask-text' }, (a.answered ? '✓ ' : '') + a.text),
          el('span', { class: 's-ask-votes' }, '✋ ' + a.votes)));
      });
      body.appendChild(list);
    } else {
      $('s-show-title').textContent = 'Podium';
      if (!d.podium.length) {
        body.appendChild(el('p', { class: 's-waiting' }, d.scored ? 'Personne n\'a encore marqué de point.' : 'Corrigez un quiz pour lancer le classement.'));
      } else {
        // Ordre des marches : 2e, 1er, 3e (ex aequo : même marche).
        var steps = el('div', { class: 's-podium' });
        [2, 1, 3].forEach(function (rank) {
          var who = d.podium.filter(function (r) { return r.rank === rank; });
          if (!who.length) return;
          steps.appendChild(el('div', { class: 's-step s-step-' + rank },
            // Beaucoup d'ex aequo : trois noms au plus, puis le nombre.
            el('p', { class: 's-step-names' }, who.slice(0, 3).map(function (r) { return r.name; }).join(' · ')
              + (who.length > 3 ? ' et ' + (who.length - 3) + ' autres' : '')),
            el('p', { class: 's-step-score' }, WL.plural(who[0].score, 'point') + ' / ' + d.scored),
            el('p', { class: 's-step-rank' }, rank === 1 ? '1er' : rank + 'e')));
        });
        body.appendChild(steps);
      }
    }
    WL.fitResults(body);
  }

  /** Bilan projeté : une question par diapositive, ses résultats tels qu'ils
   *  ont été montrés pendant l'atelier (rien de plus, voir wl_board_view). */
  function renderBoard(d) {
    var q = d.question;
    clearInterval(timer);
    WL.show($('s-timer'), false);
    $('s-text').style.fontSize = '';
    if (!q) {
      $('s-meta').textContent = 'Bilan';
      $('s-text').textContent = 'Aucune question posée.';
      WL.clear($('s-results'));
      return;
    }
    WL.show($('s-link'), false); // pas de QR d'exercice dans le bilan
    $('s-meta').textContent = 'Bilan — ' + d.board.position + ' / ' + d.board.count + ' — ' + WL.typeLabel(q);
    $('s-text').textContent = q.text;
    if (!d.results) {
      WL.clear($('s-results')).appendChild(el('div', { class: 's-waiting' },
        el('p', null, 'Résultats non affichés pendant l\'atelier.')));
      fitQuestion();
      return;
    }
    WL.renderResults($('s-results'), q, d.results, { participants: d.present });
    if (q.explain) $('s-results').appendChild(el('p', { class: 's-explain' }, q.explain));
    WL.fitResults($('s-results'));
  }

  /** Conclusion qui monte du bas de l'écran, façon générique : une fois par
   *  texte (un rafraîchissement ne la rejoue pas). Après fitRecap(), qui
   *  mesure la position finale. */
  var rolled = null;
  function rollIn(text) {
    if (!text || text === rolled) return;
    rolled = text;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var box = $('s-recap');
    box.classList.remove('s-roll');
    void box.offsetWidth; // relance l'animation
    document.body.classList.add('s-rolling'); // pas de barre de défilement pendant la montée
    box.classList.add('s-roll');
  }
  $('s-recap').addEventListener('animationend', function () { document.body.classList.remove('s-rolling'); });

  /** Récap de fin : réduit pour tenir dans l'écran avec la conclusion. */
  function fitRecap() {
    var box = $('s-recap');
    box.style.fontSize = '';
    // Place de la barre de pilotage réservée dès le départ (cookie animateur) :
    // sinon son apparition, en pleine montée, changerait la taille du texte.
    var limit = $('s-pilot').hidden && document.body.dataset.pilot ? window.innerHeight - 110 : WL.screenLimit();
    // Position finale, montée en cours ou non (décalage de l'animation retiré).
    var bottom = function () {
      var m = getComputedStyle(box).transform.match(/matrix\(([^)]+)\)/);
      return box.getBoundingClientRect().bottom - (m ? parseFloat(m[1].split(',')[5]) : 0);
    };
    if (bottom() <= limit) return;
    var lo = 10, hi = parseFloat(getComputedStyle(box).fontSize);
    for (var i = 0; i < 8; i++) {
      var mid = (lo + hi) / 2;
      box.style.fontSize = mid + 'px';
      if (bottom() <= limit) lo = mid; else hi = mid;
    }
    box.style.fontSize = lo + 'px';
  }

  /** Pendant le vote : une longue question est réduite pour que le décompte
   *  reste visible au-dessus de la barre de pilotage. */
  function fitQuestion() {
    var text = $('s-text');
    text.style.fontSize = '';
    var limit = WL.screenLimit();
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
    return unit === 'réponse' ? d.answered + ' / ' + d.present + ' ont répondu'
      : d.contributors + ' / ' + d.present + ' ont participé (' + WL.plural(d.answered, unit) + ')';
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

  function control(op, after) {
    if (busy) return;
    busy = true;
    WL.api('control', { body: { s: code, op: op }, headers: { 'X-CSRF-Token': csrf } }).then(function (r) {
      busy = false;
      // Message d'abord, sans rafraîchir : l'affichage suivant l'effacerait aussitôt.
      if (r.status === 401 || r.status === 403) error('Reconnectez-vous dans l\'espace animateur pour piloter.');
      else if (!r.data.ok) error(r.data.error || 'Commande refusée.');
      else { poller.now(); if (after) after(); }
    }, function () { busy = false; });
  }

  /** Rouvrir un vote fermé. Les résultats d'un quiz ou d'un sondage sont masqués
   *  d'abord (sinon la correction serait visible pendant le vote) ; un mur ou un
   *  post-it publié le reste. */
  function reopen() {
    var q = last && last.question;
    if (!q) return;
    var post = q.type === 'wall' || q.type === 'postit';
    if (q.showResults && !post) control('hide', function () { control('open'); });
    else control('open');
  }

  /** Espace ou bouton central : ouvrir le vote, le fermer, afficher les
   *  résultats (publier pour mur et post-it), puis passer à la suivante. */
  function stepOp() {
    var q = last && last.question;
    if (last && last.board) return 'board_off';
    if (last && last.show) return 'show_off';
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

  /** Bouton central ou Espace : fermer ou afficher sans aucune réponse demande
   *  un second appui dans les 4 secondes (un vote fermé trop tôt, 15/10/2026). */
  var warnUntil = 0;
  function step() {
    var op = stepOp(), q = last && last.question;
    var post = q && (q.type === 'wall' || q.type === 'postit');
    var none = q && q.state !== 'draft' && !(post ? last.contributors : last.answered);
    if ((op === 'close' || op === 'show') && none && Date.now() >= warnUntil) {
      warnUntil = Date.now() + 4000;
      pilotLabel();
      setTimeout(pilotLabel, 4100);
      return;
    }
    warnUntil = 0;
    control(op);
  }

  function pilotLabel() {
    if (!csrf) return;
    var board = !!(last && last.board), ended = !!(last && last.ended);
    WL.show($('s-pilot'), true);
    // Session terminée : seul le bilan se pilote encore.
    var shown = !!(last && last.show);
    ['p-prev', 'p-next', 'p-step', 'p-count'].forEach(function (id) { WL.show($(id), board || shown || !ended); });
    WL.show($('p-board'), !board);
    WL.show($('p-reopen'), false);
    // « Oser demander » ouvert : bouton pour projeter (ou quitter) les questions.
    WL.show($('p-asks'), !!(last && (last.asksOpen || last.show === 'asks')));
    $('p-asks').textContent = last && last.show === 'asks' ? 'Quitter les questions' : '❓ Questions (' + ((last && last.asksCount) || 0) + ')';
    if (last && last.show) {
      $('p-step').textContent = 'Revenir à la question';
      $('p-step').title = 'Arrête la projection ' + (last.show === 'asks' ? 'des questions' : 'du podium') + ' (Espace)';
      $('p-count').textContent = '';
      WL.show($('p-prev'), false);
      WL.show($('p-next'), false);
      return;
    }
    if (board) {
      $('p-step').title = 'Revient à la projection de la question en cours (B)';
      $('p-count').textContent = '';
      $('p-prev').disabled = last.board.position <= 1;
      $('p-next').disabled = last.board.position >= last.board.count;
      return;
    }
    var q = last && last.question, op = stepOp();
    var post = q && (q.type === 'wall' || q.type === 'postit');
    $('p-step').textContent = op === 'open' ? 'Ouvrir le vote' : op === 'close' ? 'Fermer le vote'
      : op === 'show' ? (post ? 'Publier' : 'Afficher les résultats') : op === 'end' ? 'Récap et conclusion'
      : q ? 'Question suivante' : 'Commencer';
    if (Date.now() < warnUntil) $('p-step').textContent = 'Aucune réponse : confirmer ?';
    // À l'étape « Question suivante », le glisser fait pareil : le bouton se cache sur téléphone.
    $('p-step').classList.toggle('s-swipe-only', !!q && op === 'next');
    $('p-step').title = {
      open: 'Les participants peuvent répondre', close: 'Plus aucune réponse acceptée',
      show: post ? 'Rend les contributions visibles de tous' : 'Montre les résultats et la bonne réponse',
      next: 'Passe à la question suivante',
      end: 'Termine la session : récap et conclusion sur la projection et les téléphones (« Rouvrir la session » dans l\'espace animateur pour revenir)'
    }[op] + ' (Espace)';
    $('p-count').textContent = q && q.state !== 'draft'
      ? (post ? last.contributors : last.answered) + ' / ' + last.present + (post ? ' ont participé' : ' ont répondu') : '';
    $('p-prev').disabled = !last || last.position === 0;
    $('p-next').disabled = !!last && last.position >= last.count;
    var voting = !!q && q.state === 'open' && !(q.closesAt && WL.remaining(q.closesAt, offset) === 0);
    WL.show($('p-reopen'), !!q && !ended && q.state !== 'draft' && !voting);
    // Moins de boutons (demande du 16/10/2026) : « Suivante » seulement quand le
    // bouton central fait autre chose ; décompte déjà projeté en grand ; « Bilan »
    // à la dernière question (touche B toujours active).
    WL.show($('p-next'), op !== 'next' && op !== 'end' && !!last && last.position < last.count);
    WL.show($('p-count'), false);
    WL.show($('p-board'), ended || (!!last && last.count > 0 && last.position >= last.count));
  }

  if (document.body.dataset.pilot) WL.api('me').then(function (r) {
    if (!r.data || !r.data.admin) return;
    csrf = r.data.csrf;
    WL.show($('s-pilot'), true);
    pilotLabel();
    refit(); // la barre vient d'apparaître : elle prend de la place en bas
    var onBoard = function () { return !!(last && last.board); };
    var ended = function () { return !onBoard() && !(last && last.show) && !!(last && last.ended); };
    var prev = function () { if (!ended()) control(onBoard() ? 'board_prev' : 'prev'); };
    var next = function () { if (!ended()) control(onBoard() ? 'board_next' : 'next'); };
    $('p-prev').addEventListener('click', prev);
    $('p-next').addEventListener('click', next);
    $('p-step').addEventListener('click', step);
    $('p-reopen').addEventListener('click', reopen);
    $('p-board').addEventListener('click', function () { control('board'); });
    $('p-asks').addEventListener('click', function () { control(last && last.show === 'asks' ? 'show_off' : 'show_asks'); });
    // Téléphone : glisser vers la gauche = suivante, vers la droite = précédente
    // (remplace les deux boutons). Geste franchement horizontal seulement, pour
    // ne pas confondre avec un défilement vertical.
    var touch = null;
    document.addEventListener('touchstart', function (e) {
      touch = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
    }, { passive: true });
    document.addEventListener('touchend', function (e) {
      if (!touch || !e.changedTouches.length) return;
      var dx = e.changedTouches[0].clientX - touch.x, dy = e.changedTouches[0].clientY - touch.y;
      touch = null;
      if (Math.abs(dx) < 60 || Math.abs(dx) < 2 * Math.abs(dy)) return;
      if (dx < 0) next(); else prev();
    }, { passive: true });
    document.addEventListener('keydown', function (e) {
      if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
      var k = e.key;
      if (k === 'ArrowRight' || k === 'PageDown') next();
      else if (k === 'ArrowLeft' || k === 'PageUp') prev();
      else if (k === ' ' || k === 'Enter') { if (!ended()) step(); }
      else if (k === 'b' || k === 'B') control(onBoard() ? 'board_off' : 'board');
      else if (k === 'q' || k === 'Q') document.body.classList.toggle('s-qr-big');
      else if (k === 'f' || k === 'F') toggleFullscreen();
      else return;
      e.preventDefault();
    });
  });
}());
