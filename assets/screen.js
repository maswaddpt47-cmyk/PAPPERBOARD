/* Écran de projection (screen.php?s=CODE) : question courante, résultats en
 * direct, QR code permanent, thèmes sombre / clair, plein écran. */
'use strict';

(function () {
  var el = WL.el, $ = WL.$;
  var code = (new URLSearchParams(location.search).get('s') || '').toUpperCase();
  var qrDone = false, offset = 0, timer = null;

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
  $('full-btn').addEventListener('click', function () {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
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
    WL.show($('s-ended'), d.ended);
    WL.show($('s-welcome'), !d.ended && !q);
    WL.show($('s-question'), !d.ended && !!q);
    if (d.ended || !q) {
      $('s-url').textContent = d.joinUrl.replace(/^https?:\/\//, '').replace(/\/\?s=.*/, '');
      $('s-code-big').textContent = d.code;
      return;
    }
    $('s-meta').textContent = 'Question ' + d.position + ' / ' + d.count + ' — ' + WL.TYPES[q.type];
    $('s-text').textContent = q.text;
    timerFor(q);
    if (d.results) {
      WL.renderResults($('s-results'), q, d.results);
    } else {
      var msg = q.state === 'draft' ? 'Les votes vont bientôt s\'ouvrir.'
        : q.state === 'open' ? 'Votez sur votre téléphone !' : 'Les votes sont fermés.';
      WL.clear($('s-results')).appendChild(el('div', { class: 's-waiting' },
        el('p', null, msg), el('p', { class: 's-answered' }, WL.plural(d.answered, 'réponse'))));
    }
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
}());
