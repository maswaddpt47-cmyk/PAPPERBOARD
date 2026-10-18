/* Graphiques de WoocLight : anneau Oui/Non, jauge d'échelle, compteur de
 * réponses, glissement des lignes réordonnées. À charger après common.js.
 * Aucun style écrit dans le HTML : tout passe par des classes ou par la CSSOM
 * (element.style.x = …), autorisée par la politique de sécurité. Chaque forme
 * est mise à jour sur place : la transition CSS ne joue qu'au changement réel
 * d'une valeur, jamais à chaque rafraîchissement de 2 s. */
'use strict';

(function () {
  var el = WL.el, SVGNS = 'http://www.w3.org/2000/svg';

  function calm() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }

  function svg(tag, attrs) {
    var n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }

  /** Applique après deux images : l'élément neuf part de sa valeur de départ
   *  (transition jouée) ; un élément existant reçoit la valeur tout de suite. */
  function later(fresh, fn) {
    if (fresh) requestAnimationFrame(function () { requestAnimationFrame(fn); }); else fn();
  }

  // --- Anneau (Oui / Non, Vrai / Faux), projection ---------------------------

  var R = 44, C = 2 * Math.PI * R;

  /** res.counts = [premier choix, second choix] ; q.options = leurs libellés. */
  WL.donut = function (container, q, res) {
    var key = q.id + 'd';
    var box = container.querySelector('.donut');
    var fresh = !box || box.getAttribute('data-q') !== key;
    var names = q.options;
    if (fresh) {
      var s = svg('svg', { viewBox: '0 0 120 120', class: 'donut-svg', 'aria-hidden': 'true', focusable: 'false' });
      s.appendChild(svg('circle', { cx: 60, cy: 60, r: R, class: 'donut-piste' }));
      names.forEach(function (n, i) {
        s.appendChild(svg('circle', { cx: 60, cy: 60, r: R, class: 'donut-arc donut-arc-' + i, transform: 'rotate(-90 60 60)' }));
      });
      s.appendChild(svg('text', { x: 60, y: 62, class: 'donut-total' }));
      s.appendChild(svg('text', { x: 60, y: 76, class: 'donut-unit' }));
      var legend = el('ul', { class: 'donut-legend' });
      names.forEach(function (n, i) {
        legend.appendChild(el('li', null, el('span', { class: 'donut-sw donut-sw-' + i, 'aria-hidden': 'true' }),
          el('span', { class: 'donut-name' }), el('span', { class: 'donut-count' })));
      });
      box = el('div', { class: 'donut', 'data-q': key }, s, legend);
    }
    var total = res.total || 0, offset = 0;
    var arcs = box.querySelectorAll('.donut-arc');
    names.forEach(function (n, i) {
      var count = res.counts[i] || 0;
      var pct = total ? Math.round(100 * count / total) : 0;
      var good = q.correct && q.correct.indexOf(i) !== -1;
      var len = total ? C * count / total : 0, off = offset;
      offset += len;
      later(fresh, function () {
        arcs[i].style.strokeDasharray = len.toFixed(1) + ' ' + C.toFixed(1);
        arcs[i].style.strokeDashoffset = (-off).toFixed(1);
      });
      var li = box.querySelector('.donut-legend').children[i];
      li.className = good ? 'is-good' : '';
      li.children[1].textContent = (good ? '✓ ' : '') + n + ' · ' + pct + ' %' + (good ? ' · Bonne réponse' : '');
      li.children[2].textContent = String(count);
    });
    box.querySelector('.donut-total').textContent = String(total);
    box.querySelector('.donut-unit').textContent = total > 1 ? 'réponses' : 'réponse';
    return box;
  };

  // --- Jauge d'échelle (moyenne) + colonnes, projection ----------------------

  /** list = le <ul class="bars bars-scale"> rendu par bars(). Retourne le
   *  bloc .scale-view (jauge + colonnes), réutilisé d'un rafraîchissement à l'autre. */
  WL.scaleView = function (container, list, q, res) {
    var view = container.querySelector('.scale-view');
    var fresh = !view || list.parentNode !== view;
    if (fresh) {
      var s = svg('svg', { viewBox: '0 0 120 70', class: 'gauge-svg', 'aria-hidden': 'true', focusable: 'false' });
      var d = 'M10 62 A50 50 0 0 1 110 62';
      s.appendChild(svg('path', { d: d, class: 'gauge-track', pathLength: '100' }));
      s.appendChild(svg('path', { d: d, class: 'gauge-fill', pathLength: '100' }));
      var gauge = el('div', { class: 'gauge' }, s, el('p', { class: 'gauge-value' }, el('strong'), el('span')));
      view = el('div', { class: 'scale-view' }, gauge);
      view.appendChild(list);
    }
    var avg = res.average;
    var pct = avg === null || avg === undefined ? 0 : Math.max(0, Math.min(100, 100 * avg / q.scaleMax));
    var fill = view.querySelector('.gauge-fill');
    // Un tiret de longueur zéro à bouts arrondis dessine un point : à 0 on masque le remplissage (point orange en début et en fin de jauge, vu le 18/10/2026).
    later(fresh, function () { fill.style.strokeDasharray = pct.toFixed(1) + ' 200'; fill.style.opacity = pct > 0 ? '' : '0'; });
    var value = view.querySelector('.gauge-value');
    value.firstChild.textContent = avg === null || avg === undefined ? '–' : String(avg).replace('.', ',');
    value.lastChild.textContent = ' / ' + q.scaleMax;
    return view;
  };

  // --- Compteur « 3 / 5 ont répondu » ----------------------------------------

  /** Remplace le bloc d'attente de screen.js : barre de progression qui avance,
   *  anneau moutarde joué une fois quand tout le monde a répondu. */
  WL.counter = function (container, qid, text, done, total, all, msg) {
    var box = container.firstChild;
    var fresh = !box || !box.getAttribute || box.getAttribute('data-q') !== qid;
    if (fresh) {
      box = el('div', { class: 's-waiting', 'data-q': qid },
        el('p', { class: 's-answered' }),
        el('span', { class: 's-progress', role: 'progressbar', 'aria-label': 'Réponses reçues', 'aria-valuemin': '0' },
          el('span', { class: 's-progress-fill' })),
        el('p', { class: 's-msg' }));
      WL.clear(container).appendChild(box);
    }
    var p = box.firstChild, bar = box.children[1];
    p.className = 's-answered' + (all ? ' s-all' : '');
    p.textContent = text;
    box.lastChild.textContent = msg;
    bar.setAttribute('aria-valuemax', String(total));
    bar.setAttribute('aria-valuenow', String(done));
    var w = total ? Math.min(100, Math.round(100 * done / total)) + '%' : '0%';
    later(fresh, function () { bar.firstChild.style.width = w; });
    box.classList.toggle('is-complete', !!all); // l'anneau ne rejoue que si « all » repasse de faux à vrai
  };

  // --- Glissement des lignes réordonnées (classement) ------------------------

  /** À appeler AVANT de reconstruire la liste : position de chaque élément
   *  portant data-key (posé par WL.keep). */
  WL.measure = function (container) {
    var map = new Map();
    Array.prototype.forEach.call(container.querySelectorAll('[data-key]'), function (n) {
      var r = n.getBoundingClientRect();
      map.set(n.getAttribute('data-key'), { x: r.left, y: r.top });
    });
    return map;
  };

  /** À appeler APRÈS : chaque élément qui a changé de place glisse de son
   *  ancienne position à la nouvelle (0,6 s). Aucun mouvement si l'ordre est stable. */
  WL.playFlip = function (container, before) {
    if (!before || !before.size || calm()) return;
    Array.prototype.forEach.call(container.querySelectorAll('[data-key]'), function (n) {
      var old = before.get(n.getAttribute('data-key'));
      if (!old) return;
      var r = n.getBoundingClientRect();
      var dx = old.x - r.left, dy = old.y - r.top;
      if (Math.abs(dx) + Math.abs(dy) < 2) return;
      n.style.transition = 'none';
      n.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      void n.offsetWidth;
      n.style.transition = 'transform .6s ease';
      n.style.transform = '';
      n.addEventListener('transitionend', function done() {
        n.style.transition = '';
        n.removeEventListener('transitionend', done);
      });
    });
  };
}());
