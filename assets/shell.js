/* Coque de l'espace animateur (admin.php) : menu latéral, fil d'Ariane, tiroir sur téléphone.
 * Ne gère aucune donnée : elle observe les sections que admin.js affiche ou masque
 * (login, sessions et ses trois vues, editor, archive-view) ; le menu appelle WL.spaceView (admin.js). */
'use strict';

(function () {
  var $ = function (id) { return document.getElementById(id); };
  var body = document.body, side = $('sidebar'), overlay = $('nav-overlay'), toggle = $('menu-toggle');
  if (!side || !toggle) return;
  var items = [].slice.call(side.querySelectorAll('.nav-item'));
  var byNav = {};
  items.forEach(function (b) { byNav[b.getAttribute('data-nav')] = b; });

  function shown(id) { var e = $(id); return !!e && !e.hidden; }
  function selected(id) { var e = $(id); return !!e && e.getAttribute('aria-selected') === 'true'; }

  /** Met le menu, le fil d'Ariane et les liens de l'éditeur d'accord avec la vue affichée. */
  function sync() {
    var login = shown('login'), editor = shown('editor'), sessions = shown('sessions'), archive = shown('archive-view');
    var history = archive || (sessions && shown('space-history'));
    var library = sessions && shown('space-library');
    body.classList.toggle('is-login', login);
    var current = { overview: sessions && shown('space-overview'), workshop: editor, history: history, library: library };
    items.forEach(function (b) {
      var on = !!current[b.getAttribute('data-nav')];
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      b.classList.toggle('active', on);
    });
    byNav.workshop.setAttribute('aria-disabled', editor ? 'false' : 'true');
    byNav.workshop.title = editor ? 'L\'atelier ouvert' : 'Ouvrez d\'abord un atelier';
    var title = ($('ed-title') && $('ed-title').textContent.trim()) || '';
    $('sidebar-session').hidden = !(editor && title);
    $('sidebar-session-title').textContent = title;
    $('sidebar-session-status').textContent = editor ? $('ed-badge').textContent : '';
    $('crumb-current').textContent = login ? 'Connexion' : editor ? (title || 'Atelier') : history ? 'Mes ateliers' : library ? 'Bibliothèque de modèles' : 'Vue d’ensemble';
    var dot = byNav.workshop.querySelector('.nav-dot');
    if (dot) dot.hidden = !editor;
    var code = ($('ed-code') && $('ed-code').textContent.trim()) || '';
    if (code) {
      $('ed-preview').href = 'index.php?s=' + encodeURIComponent(code);
      $('ed-open-screen').href = 'screen.php?s=' + encodeURIComponent(code);
    }
  }
  var queued = false;
  function later() { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; sync(); }); }
  new MutationObserver(later).observe($('main'), {
    attributes: true, attributeFilter: ['hidden', 'aria-selected'], subtree: true, childList: true, characterData: true
  });

  // --- Tiroir (téléphone) ---------------------------------------------------------
  function closeNav(back) {
    if (!side.classList.contains('is-open')) return;
    side.classList.remove('is-open');
    overlay.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    if (back) toggle.focus();
  }
  function openNav() {
    side.classList.add('is-open');
    overlay.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    var first = side.querySelector('.nav-item[aria-current]') || items[0];
    if (first) first.focus();
  }
  toggle.addEventListener('click', function () { if (side.classList.contains('is-open')) closeNav(true); else openNav(); });
  overlay.addEventListener('click', function () { closeNav(true); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeNav(true); });
  window.addEventListener('resize', function () { if (window.innerWidth >= 640) closeNav(false); });

  // --- Navigation : Mon espace (admin.js) ou l'atelier ouvert -----------------------
  side.addEventListener('click', function (e) {
    var b = e.target.closest('.nav-item');
    if (!b) return;
    var nav = b.getAttribute('data-nav');
    if (nav === 'workshop') {
      if (!shown('editor')) return;
      $('main').focus();
    } else if (window.WL && WL.spaceView) WL.spaceView(nav);
    closeNav(false);
  });
  sync();
}());
