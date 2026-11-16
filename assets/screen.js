/* Écran de projection (screen.php?s=CODE) : question courante, résultats en
 * direct, QR code permanent, thèmes sombre / clair, plein écran. */
'use strict';

(function () {
  var el = WL.el, $ = WL.$;
  var code = (new URLSearchParams(location.search).get('s') || '').toUpperCase();
  var apercu = new URLSearchParams(location.search).get('apercu'), preview = apercu !== null;
  var qrDone = false, offset = 0, timer = null, last = null;

  // Même calcul que la simulation : mesurer le contenu naturel avant chaque
  // mise à l'échelle, pour ne jamais rétrécir à nouveau une vue déjà ajustée.
  var canvas = $('projection-canvas'), viewport = canvas.parentElement, fitPending = false;
  function resetCanvas() {
    canvas.style.transform = 'none';
    canvas.style.left = '0px';
    canvas.style.width = viewport.clientWidth + 'px';
  }
  function fitProjection() {
    resetCanvas();
    // Prévisualiser : taille réelle, la page défile (lisibilité du contrôle, 15/11/2026).
    if (preview) { canvas.dataset.fitScale = '1'; return; }
    var width = Math.max(canvas.scrollWidth, canvas.offsetWidth);
    var height = Math.max(canvas.scrollHeight, canvas.offsetHeight);
    if (!width || !height || !viewport.clientHeight) return;
    var scale = Math.min(1, (viewport.clientWidth - 2) / width, (viewport.clientHeight - 2) / height);
    canvas.style.transform = 'scale(' + scale + ')';
    canvas.style.left = Math.max(0, (viewport.clientWidth - width * scale) / 2) + 'px';
    canvas.dataset.fitScale = String(scale);
  }
  function scheduleFit() {
    if (fitPending) return;
    fitPending = true;
    requestAnimationFrame(function () { fitPending = false; fitProjection(); });
  }
  if (typeof ResizeObserver === 'function') new ResizeObserver(scheduleFit).observe(viewport);
  canvas.addEventListener('load', scheduleFit, true);


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
  // Le canevas réserve les commandes et adapte toute la diapositive.
  function refit() { scheduleFit(); }
  window.addEventListener('resize', refit);
  document.addEventListener('fullscreenchange', function () {
    $('full-btn').textContent = document.fullscreenElement ? 'Quitter le plein écran' : 'Plein écran';
  });

  // --- Affichage ----------------------------------------------------------------

  function render(d) {
    resetCanvas();
    renderData(d);
    scheduleFit();
  }

  function renderData(d) {
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
    WL.renderAnimationGuide($('s-guide'), currentGuide());
    pilotLabel();
    var board = !!d.board; // tableau de bord projeté, une question par diapositive
    // QR masqué depuis l'espace animateur : un QR agrandi se ferme (la touche Q peut ensuite le montrer quand même).
    if (d.qrHidden && !document.body.classList.contains('s-noqr') && document.body.classList.contains('s-qr-big')) qrBig(false);
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
      WL.renderRecap($('s-recap'), { conclusion: d.conclusion, conclusionRich: d.conclusionRich });
      fitRecap();
      rollIn(d.conclusion);
      return;
    }
    if (!q) {
      // Coupures permises après « . » et « / » seulement (écran étroit) : jamais au milieu d'un mot.
      var url = $('s-url');
      url.textContent = '';
      d.shortUrl.replace(/^https?:\/\//, '').replace(/([./])/g, '$1\n').split('\n').forEach(function (part, i) {
        if (i) url.appendChild(document.createElement('wbr'));
        url.appendChild(document.createTextNode(part));
      });
      $('s-code-big').textContent = d.code;
      return;
    }
    $('s-meta').textContent = (d.hasInfo ? 'Étape ' : 'Question ') + d.position + ' / ' + d.count + ' — ' + WL.typeLabel(q);
    WL.renderText($('s-text'), q.text, q.rich && q.rich.text);
    $('s-text').style.fontSize = '';
    linkFor(q);
    timerFor(q);
    if (q.type === 'info') { WL.renderInformation($('s-results'), q); scheduleFit(); return; }
    if (d.results) {
      WL.renderResults($('s-results'), q, d.results, { participants: d.present });
      if (q.type === 'wall' && q.state === 'open') {
        $('s-results').appendChild(el('p', { class: 's-hint' }, 'Aimez les idées des autres sur votre appareil : touchez ♥.'));
      }
      if (q.explain) $('s-results').appendChild(el('p', { class: 's-explain' }, WL.richText(q.explain, q.rich && q.rich.explain)));
      scheduleFit();
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
    scheduleFit();
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
    WL.renderText($('s-text'), q.text, q.rich && q.rich.text);
    if (q.type === 'info') { WL.renderInformation($('s-results'), q); scheduleFit(); return; }
    if (!d.results) {
      WL.clear($('s-results')).appendChild(el('div', { class: 's-waiting' },
        el('p', null, 'Résultats non affichés pendant l\'atelier.')));
      fitQuestion();
      return;
    }
    WL.renderResults($('s-results'), q, d.results, { participants: d.present });
    if (q.explain) $('s-results').appendChild(el('p', { class: 's-explain' }, WL.richText(q.explain, q.rich && q.rich.explain)));
    scheduleFit();
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

  function fitRecap() { scheduleFit(); }
  function fitQuestion() { scheduleFit(); }

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
  var poller = null;
  if (preview) startPreview();
  else {
    poller = new WL.Poller('screen', 's=' + code, render, function (kind, r) {
      if (kind === 'offline') error('Connexion perdue. Reconnexion automatique…');
      else if (kind === 'online') error('');
      else if (kind === 'error') error(r.data.error || 'Erreur du serveur.');
    });
    poller.now();
  }

  // --- Prévisualiser (screen.php?s=CODE&apercu=I) --------------------------------
  // L'animateur parcourt les questions pour les contrôler : chacune est calculée
  // par api.php?action=preview sur une copie de la session (ouverte, sans
  // réponse). Aucune commande n'est envoyée : l'atelier réel ne bouge pas. La vue
  // participant (index.php?s=CODE&apercu=I) suit par BroadcastChannel.

  function answerText(d) {
    var q = d.screen && d.screen.question;
    if (!q || !d.correct || !d.correct.length) return '';
    var labels = d.correct.map(function (i) { return q.options && q.options[i] !== undefined ? q.options[i] : String(i); });
    return 'Bonne réponse : ' + labels.join(' · ') + (d.explain ? ' — ' + d.explain : '');
  }

  function startPreview() {
    var index = Math.max(0, parseInt(apercu, 10) || 0), count = 0;
    var channel = 'BroadcastChannel' in window ? new BroadcastChannel('wooclight-apercu-' + code) : null;
    document.body.classList.add('is-preview');
    WL.show($('s-preview'), true);
    function participantUrl() { return 'index.php?s=' + encodeURIComponent(code) + '&apercu=' + index; }
    function load(i) {
      WL.api('preview', { query: 's=' + code + '&i=' + i }).then(function (r) {
        if (r.status !== 200) {
          error(r.status === 401 ? 'Prévisualiser : connectez-vous d’abord à l’espace animateur dans ce navigateur, puis rechargez.' : (r.data.error || 'Erreur du serveur.'));
          return;
        }
        index = Math.max(0, r.data.index); count = r.data.count;
        $('pv-count').textContent = count ? 'Question ' + (index + 1) + ' / ' + count : 'Aucune question dans cet atelier.';
        $('pv-prev').disabled = index <= 0;
        $('pv-next').disabled = index >= count - 1;
        $('pv-answer').textContent = answerText(r.data);
        $('pv-participant').href = participantUrl();
        var shownQ = r.data.screen.question;
        WL.show($('pv-edit'), !!shownQ);
        if (shownQ) $('pv-edit').href = 'admin.php?s=' + encodeURIComponent(code) + '&q=' + encodeURIComponent(shownQ.id);
        render(r.data.screen);
        history.replaceState(null, '', '?s=' + encodeURIComponent(code) + '&apercu=' + index);
        if (channel) channel.postMessage({ i: index });
      }, function () { error('Pas de connexion au serveur.'); });
    }
    function go(delta) {
      var target = index + delta;
      if (target >= 0 && target < count) load(target);
    }
    $('pv-prev').addEventListener('click', function () { go(-1); });
    $('pv-next').addEventListener('click', function () { go(1); });
    $('pv-participant').addEventListener('click', function (event) {
      var win = window.open(participantUrl(), 'wooclight-participant-apercu', 'popup,width=480,height=820,resizable=yes,scrollbars=yes');
      if (win) { win.opener = null; event.preventDefault(); win.focus(); }
    });
    // Une vue participant ouverte après coup demande où en est la prévisualisation.
    if (channel) channel.onmessage = function (e) { if (e.data && e.data.hello) channel.postMessage({ i: index }); };
    document.addEventListener('keydown', function (e) {
      if (e.repeat || e.ctrlKey || e.altKey || e.metaKey || e.target.closest('input,textarea,select')) return;
      var k = e.key;
      if (k === 'ArrowRight' || k === 'PageDown') go(1);
      else if (k === 'ArrowLeft' || k === 'PageUp') go(-1);
      else if (k === 'f' || k === 'F') toggleFullscreen();
      else return;
      e.preventDefault();
    });
    // Retour depuis l'éditeur : la question modifiée se recharge.
    document.addEventListener('visibilitychange', function () { if (!document.hidden && count) load(index); });
    load(index);
  }

  // --- Pilotage (animateur connecté dans ce navigateur) -------------------------
  // Mêmes commandes et même contrôle que admin.php (session animateur + CSRF) :
  // un participant qui ouvre cette page n'a pas de session, rien ne s'active
  // (et sans cookie animateur, aucune session PHP n'est ouverte pour lui).
  // Une télécommande de présentation envoie flèches / Page préc.-suiv.

  var csrf = '', busy = false;

  function control(op, after) {
    if (busy) return;
    $('p-options').open = false;
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

  function currentGuide() {
    return WL.animationGuide(last && last.question, { ended: !!(last && last.ended),
      position: last && last.position, count: last && last.count, now: last && last.now,
      board: last && last.board, show: last && last.show, projected: !!(last && last.results) });
  }

  /** Bouton principal et Espace : la même étape que dans Animer. */
  function stepOp() { return currentGuide().op; }

  /** Fermer ou afficher sans aucune réponse demande un second appui dans les
   *  4 secondes (un vote fermé trop tôt, 15/10/2026). Vaut pour Espace et pour
   *  les boutons « Fermer le vote » / « Afficher ». */
  var warnUntil = 0, warnBtn = '';
  function noAnswer() {
    var q = last && last.question;
    var post = q && (q.type === 'wall' || q.type === 'postit');
    return !!q && q.state !== 'draft' && !(post ? last.contributors : last.answered);
  }
  function guarded(btn, op, run) {
    if (!op) return;
    if (op === 'end' && !confirm('Terminer l’atelier ? Les participants ne pourront plus répondre.')) return;
    if ((op === 'close' || op === 'show') && noAnswer() && !(Date.now() < warnUntil && warnBtn === btn)) {
      warnUntil = Date.now() + 4000; warnBtn = btn;
      pilotLabel();
      setTimeout(pilotLabel, 4100);
      return;
    }
    warnUntil = 0; warnBtn = '';
    if (run) run(); else control(op);
  }
  /** Espace : l'étape suivante logique (ouvrir, fermer, afficher, suivante). */
  function step() { var op = stepOp(); guarded('p-step', op === 'show' ? 'show' : op); }

  function pilotLabel() {
    if (!csrf) return;
    var guide = currentGuide(), q = last && last.question;
    var board = !!(last && last.board), shown = !!(last && last.show), ended = !!(last && last.ended);
    WL.show($('s-pilot'), true);
    WL.show($('p-step'), !ended || board || shown);
    $('p-step').disabled = !guide.op;
    $('p-step').textContent = Date.now() < warnUntil && warnBtn === 'p-step' ? 'Aucune réponse : confirmer ?' : guide.label;
    $('p-step').title = guide.hint + ' (Espace : même action)';
    WL.show($('p-hide'), guide.canToggle);
    $('p-hide').textContent = Date.now() < warnUntil && warnBtn === 'p-hide' ? 'Aucune réponse : confirmer ?' : guide.visibility;
    $('p-hide').title = guide.published ? 'Masque les résultats sur les appareils. Un affichage en direct de la projection reste actif.'
      : 'Rend les résultats visibles sur les appareils et l’écran du groupe.';
    WL.show($('p-reopen'), guide.canReopen && !board && !shown);
    $('p-reopen').title = guide.post ? 'Rouvre la collecte ; les contributions publiées restent visibles.'
      : 'Masque les résultats avant de rouvrir les réponses.';
    WL.show($('p-count'), false);
    WL.show($('p-prev'), board || (!shown && !ended));
    WL.show($('p-next'), board || (!shown && !ended));
    $('p-prev').disabled = board ? last.board.position <= 1 : !last || last.position === 0;
    $('p-next').disabled = board ? last.board.position >= last.board.count : !last || last.position >= last.count;
    $('p-next').textContent = 'Suivante ▶';
    $('p-next').title = 'Passe à la question suivante sans publier les résultats de celle-ci.';
    WL.show($('p-board'), !board);
    WL.show($('p-end'), !ended);
    WL.show($('p-welcome'), !ended && !!q);
    WL.show($('p-asks'), !!(last && (last.asksOpen || last.show === 'asks')));
    $('p-asks').textContent = shown && last.show === 'asks' ? 'Revenir à la question' : 'Afficher les questions publiées (' + ((last && last.asksCount) || 0) + ')';
    $('p-participants').href = 'admin.php?s=' + encodeURIComponent(code) + '&participants=1';
  }

  /** QR agrandi au centre : clic sur le QR ou touche Q ; fermé par « Fermer », Échap ou un clic à côté. */
  function qrBig(on) {
    var was = document.body.classList.contains('s-qr-big');
    document.body.classList.toggle('s-qr-big', on);
    $('qr-zoom').setAttribute('aria-expanded', String(on));
    if (on && !was) $('qr-close').focus();
    if (!on && was) $('qr-zoom').focus();
    refit();
  }
  $('qr-zoom').addEventListener('click', function () { qrBig(!document.body.classList.contains('s-qr-big')); });
  $('qr-close').addEventListener('click', function () { qrBig(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.classList.contains('s-qr-big')) qrBig(false);
  });
  document.addEventListener('click', function (e) {
    if (document.body.classList.contains('s-qr-big') && !e.target.closest('.qr-corner')) qrBig(false);
  });

  if (document.body.dataset.pilot && !preview) WL.api('me').then(function (r) {
    if (!r.data || !r.data.admin) return;
    csrf = r.data.csrf;
    WL.show($('s-pilot'), true);
    pilotLabel();
    refit(); // la barre vient d'apparaître : elle prend de la place en bas
    var onBoard = function () { return !!(last && last.board); };
    var ended = function () { return !onBoard() && !(last && last.show) && !!(last && last.ended); };
    var prev = function () { if (!ended()) control(onBoard() ? 'board_prev' : 'prev'); };
    var next = function () {
      if (ended()) return;
      var endHere = !onBoard() && !(last && last.show) && !!last && last.count > 0 && last.position >= last.count;
      if (endHere) { guarded('p-step', 'end'); return; }
      control(onBoard() ? 'board_next' : 'next');
    };
    $('p-prev').addEventListener('click', prev);
    $('p-next').addEventListener('click', next);
    $('p-step').addEventListener('click', step);
    $('p-reopen').addEventListener('click', reopen);
    $('p-hide').addEventListener('click', function () {
      var q = last && last.question;
      if (q) guarded('p-hide', q.showResults ? 'hide' : 'show');
    });
    $('p-board').addEventListener('click', function () { control('board'); });
    $('p-welcome').addEventListener('click', function () { control('welcome'); });
    $('p-end').addEventListener('click', function () { guarded('p-end', 'end'); });
    $('p-participants').addEventListener('click', function () { $('p-options').open = false; });
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
      if (e.repeat || e.ctrlKey || e.altKey || e.metaKey || e.target.closest('input,textarea,select,[contenteditable="true"]')) return;
      var k = e.key;
      if ((k === ' ' || k === 'Enter') && e.target.closest('button,a,summary')) return;
      if (k === 'ArrowRight' || k === 'PageDown') next();
      else if (k === 'ArrowLeft' || k === 'PageUp') prev();
      else if (k === ' ' || k === 'Enter') { if (!ended()) step(); }
      else if (k === 'b' || k === 'B') control(onBoard() ? 'board_off' : 'board');
      else if (k === 'q' || k === 'Q') qrBig(!document.body.classList.contains('s-qr-big'));
      else if (k === 'f' || k === 'F') toggleFullscreen();
      else return;
      e.preventDefault();
    });
  });
}());
