/* Outils partagés par les trois écrans : construction du DOM (jamais
 * d'innerHTML : tout texte reçu passe par textContent), appels à l'API,
 * rafraîchissement conditionnel (ETag), QR code et affichage des résultats. */
'use strict';

var WL = (function () {
  /** Crée un élément : el('p', {class: 'x'}, 'texte', autreElement). */
  function el(tag, attrs) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k.indexOf('on') === 0) node.addEventListener(k.slice(2), v);
      else if (k === 'text') node.textContent = v;
      else node.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined || c === false) continue;
      node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    }
    return node;
  }

  function $(id) { return document.getElementById(id); }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  function show(node, visible) { node.hidden = !visible; }

  /** Appel à api.php. Résout {status, data} ; rejette seulement si le réseau
   *  est coupé (status 0). opts : method, body, query, headers, etag. */
  function api(action, opts) {
    opts = opts || {};
    var url = 'api.php?action=' + encodeURIComponent(action) + (opts.query ? '&' + opts.query : '');
    var headers = Object.assign({ 'X-WL': '1' }, opts.headers || {});
    if (opts.etag) headers['If-None-Match'] = opts.etag;
    var init = { method: opts.method || 'GET', headers: headers, credentials: 'same-origin', cache: 'no-store' };
    if (opts.body) {
      init.method = 'POST';
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(opts.body);
    }
    return fetch(url, init).then(function (res) {
      if (res.status === 304) return { status: 304, data: null, etag: opts.etag };
      return res.json().catch(function () { return { ok: false, error: 'Réponse illisible du serveur.' }; })
        .then(function (data) { return { status: res.status, data: data, etag: res.headers.get('ETag') }; });
    });
  }

  /** Rafraîchit une ressource toutes les pollMs (2 s par défaut) avec ETag :
   *  le serveur répond 304 sans corps tant que rien n'a changé. Pause quand
   *  l'onglet est masqué ; reprise espacée (jusqu'à 15 s) si le réseau tombe. */
  function Poller(action, query, onData, onStatus) {
    this.action = action;
    this.query = query;
    this.onData = onData;
    this.onStatus = onStatus || function () {};
    this.etag = null;
    this.delay = 2000;
    this.failures = 0;
    this.timer = null;
    this.stopped = false;
    var self = this;
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && !self.stopped) self.now();
    });
  }
  Poller.prototype.now = function () {
    clearTimeout(this.timer);
    this.tick();
  };
  Poller.prototype.refresh = function () {
    this.etag = null;
    this.now();
  };
  Poller.prototype.stop = function () {
    this.stopped = true;
    clearTimeout(this.timer);
  };
  Poller.prototype.schedule = function (ms) {
    var self = this;
    clearTimeout(this.timer);
    if (!this.stopped) this.timer = setTimeout(function () { self.tick(); }, ms);
  };
  Poller.prototype.tick = function () {
    var self = this;
    if (document.hidden) return; // reprise au retour sur l'onglet
    api(this.action, { query: this.query, etag: this.etag }).then(function (r) {
      if (self.failures) self.onStatus('online');
      self.failures = 0;
      if (r.status === 200) {
        self.etag = r.etag;
        if (r.data.pollMs) self.delay = Math.max(1000, r.data.pollMs);
        self.onData(r.data);
      } else if (r.status !== 304) {
        self.onStatus('error', r);
      }
      self.schedule(self.delay);
    }, function () {
      self.failures++;
      self.onStatus('offline');
      self.schedule(Math.min(15000, self.delay * Math.pow(2, self.failures - 1)));
    });
  };

  /** QR code en image (data:), sans dépendance externe. */
  function qr(container, text, cell) {
    var q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    clear(container).appendChild(el('img', {
      src: q.createDataURL(cell || 6, 2), alt: 'QR code pour rejoindre : ' + text, class: 'qr-img'
    }));
  }

  var TYPES = {
    yesno: 'Oui / Non', truefalse: 'Vrai / Faux', mcq: 'QCM', poll: 'Sondage',
    wordcloud: 'Nuage de mots', text: 'Réponse libre', scale: 'Échelle', points: 'Classement par points'
  };

  function plural(n, word) { return n + ' ' + word + (n > 1 ? 's' : ''); }

  /** Libellés des barres : choix, ou notes 1..N pour une échelle. */
  function labels(q) {
    if (q.type !== 'scale') return q.options;
    var out = [];
    for (var i = 1; i <= q.scaleMax; i++) out.push(String(i));
    return out;
  }

  /** Barres (choix, sondage, points) ou colonnes (échelle, pour que 10 notes
   *  tiennent sur la projection). Si les barres de la même question sont déjà
   *  affichées, elles sont mises à jour sur place : la longueur s'anime
   *  (transition CSS) au lieu de repartir de zéro. */
  function bars(container, q, res) {
    var max = Math.max.apply(null, res.counts.concat([1]));
    var sum = res.counts.reduce(function (a, b) { return a + b; }, 0);
    var names = labels(q);
    var columns = q.type === 'scale';
    var list = container.querySelector('ul.bars');
    var fresh = !list || list.getAttribute('data-q') !== q.id + names.length;
    if (fresh) {
      list = el('ul', { class: 'bars' + (columns ? ' bars-scale' : ''), 'data-q': q.id + names.length });
      names.forEach(function () {
        list.appendChild(el('li', { class: 'bar' }, el('span', { class: 'bar-label' }),
          el('span', { class: 'bar-track' }, el('span', { class: 'bar-fill' })), el('span', { class: 'bar-value' })));
      });
    }
    names.forEach(function (label, i) {
      var n = res.counts[i] || 0;
      var good = q.correct && q.correct.indexOf(i) !== -1;
      var pct = q.type === 'points' ? (sum ? Math.round(100 * n / sum) : 0)
        : (res.total ? Math.round(100 * n / res.total) : 0);
      var li = list.children[i];
      li.className = 'bar' + (good ? ' bar-good' : '');
      li.children[0].textContent = (good ? '✓ ' : '') + label;
      li.children[2].textContent = columns ? String(n) : q.type === 'points' ? plural(n, 'point') : n + ' (' + pct + ' %)';
      var fill = li.children[1].firstChild;
      var size = Math.round(100 * n / max) + '%';
      var apply = function () { fill.style[columns ? 'height' : 'width'] = size; };
      if (fresh) requestAnimationFrame(function () { requestAnimationFrame(apply); });
      else apply();
    });
    return list;
  }

  /** Mémoire des éléments déjà affichés pour une question : seuls les
   *  nouveaux mots ou nouvelles réponses jouent l'animation d'apparition. */
  function memory(container, q) {
    if (!container.wlMemory || container.wlMemory.q !== q.id) container.wlMemory = { q: q.id, nodes: {} };
    return container.wlMemory.nodes;
  }

  function keep(nodes, key, make) {
    if (nodes[key]) return nodes[key];
    var node = make();
    node.classList.add('is-new');
    node.addEventListener('animationend', function () { node.classList.remove('is-new'); });
    nodes[key] = node;
    return node;
  }

  /** Couleur stable d'un mot (elle ne change pas quand l'ordre change). */
  function colorOf(text) {
    var h = 0;
    for (var i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 997;
    return 'cloud-c' + (h % 4);
  }

  /** Nuage : taille de police proportionnelle à la fréquence (1 à 4 em). */
  function cloud(container, q, words) {
    var nodes = memory(container, q);
    var max = words.reduce(function (m, w) { return Math.max(m, w.n); }, 1);
    var box = el('p', { class: 'cloud' });
    words.forEach(function (w) {
      var span = keep(nodes, w.text.toLowerCase(), function () {
        return el('span', { class: 'cloud-word ' + colorOf(w.text.toLowerCase()) }, w.text);
      });
      span.textContent = w.text;
      span.title = w.n + ' fois';
      span.style.fontSize = (1 + 3 * w.n / max).toFixed(2) + 'em';
      box.appendChild(span);
      box.appendChild(document.createTextNode(' '));
    });
    return box;
  }

  /** Mur de réponses libres. onHide(id, hidden) : boutons de modération (animateur). */
  function wall(container, q, texts, onHide) {
    var nodes = memory(container, q);
    var list = el('ul', { class: 'wall' });
    texts.forEach(function (t) {
      var item = keep(nodes, t.id, function () { return el('li', { class: 'wall-item' }, el('span')); });
      item.classList.toggle('wall-hidden', !!t.hidden);
      item.firstChild.textContent = t.text;
      if (item.childNodes[1]) item.removeChild(item.childNodes[1]);
      if (onHide) {
        item.appendChild(el('button', {
          type: 'button', class: 'btn btn-small',
          onclick: function () { onHide(t.id, !t.hidden); }
        }, t.hidden ? 'Réafficher' : 'Masquer'));
      }
      list.appendChild(item);
    });
    return list;
  }

  /** Affiche les résultats d'une question dans container. */
  function renderResults(container, q, res, onHide) {
    if (!res) { clear(container); return; }
    var node;
    if (q.type === 'wordcloud') {
      node = res.words.length ? cloud(container, q, res.words) : el('p', { class: 'meta' }, 'Aucun mot pour le moment.');
    } else if (q.type === 'text') {
      node = res.texts.length ? wall(container, q, res.texts, onHide) : el('p', { class: 'meta' }, 'Aucune réponse pour le moment.');
    } else {
      node = bars(container, q, res);
    }
    // Des barres déjà en place restent attachées : retirées puis remises,
    // elles perdraient leur transition.
    if (node.parentNode === container) {
      while (container.lastChild !== node) container.removeChild(container.lastChild);
      while (container.firstChild !== node) container.removeChild(container.firstChild);
    } else {
      clear(container).appendChild(node);
    }
    var foot = plural(res.total, 'réponse');
    if (q.type === 'scale' && res.average !== null) foot += ' — moyenne ' + String(res.average).replace('.', ',') + ' / ' + q.scaleMax;
    container.appendChild(el('p', { class: 'results-foot' }, foot));
  }

  /** Secondes restantes avant closesAt, corrigées du décalage d'horloge. */
  function remaining(closesAt, offset) {
    return Math.max(0, Math.ceil(closesAt - (Date.now() / 1000 + offset)));
  }

  function formatTime(s) {
    var m = Math.floor(s / 60);
    return m + ':' + String(s % 60).padStart(2, '0');
  }

  return {
    el: el, $: $, clear: clear, show: show, api: api, Poller: Poller, qr: qr,
    TYPES: TYPES, plural: plural, renderResults: renderResults,
    remaining: remaining, formatTime: formatTime
  };
}());
