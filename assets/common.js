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
    var headers = Object.assign({ 'X-WL': '1', 'X-WL-Features': 'info-v1, rich-v1' }, opts.headers || {});
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
  function qr(container, text, cell, alt) {
    var q = qrcode(0, 'M');
    // L'encodeur ne garde que 8 bits par caractère : une adresse avec « 中 » deviendrait « - ». URL().href la réduit à de l'ASCII.
    try { text = new URL(text).href; } catch (e) { /* pas une URL : texte brut */ }
    q.addData(text);
    q.make();
    clear(container).appendChild(el('img', {
      src: q.createDataURL(cell || 6, 2), alt: alt || 'QR code pour rejoindre : ' + text, class: 'qr-img'
    }));
  }

  /** Nom de domaine d'un lien https, ou null (lien refusé : rien n'est affiché). */
  function linkHost(url) {
    try {
      var u = new URL(url);
      return u.protocol === 'https:' ? u.hostname : null;
    } catch (e) { return null; }
  }

  var TYPES = {
    yesno: 'Oui / Non', truefalse: 'Vrai / Faux', mcq: 'QCM', poll: 'Sondage',
    wordcloud: 'Nuage de mots', text: 'Réponse libre', scale: 'Échelle', points: 'Classement par points',
    wall: 'Mur collaboratif', postit: 'Post-it collectif', dots: 'Vote par gommettes', steps: 'Défi à étapes', info: 'Diapositive d’information'
  };

  function plural(n, word) { return n + ' ' + word + (n > 1 ? 's' : ''); }

  /** Un seul parcours pour Animer et la projection. Les opérations restent
   * celles du serveur ; la fermeture ne publie jamais une correction. */
  function animationGuide(q, state) {
    state = state || {};
    var open = !!q && q.state === 'open' && !(q.closesAt && q.closesAt <= state.now);
    var post = !!q && (q.type === 'wall' || q.type === 'postit');
    var published = !!q && !!q.showResults;
    var live = !!q && ['poll', 'wordcloud', 'scale', 'points', 'steps'].indexOf(q.type) !== -1
      && q.live !== false && q.state !== 'draft';
    var projected = state.projected === undefined ? published || live : state.projected;
    var information = !!q && q.type === 'info';
    var op, label, hint, stage;
    if (state.board || state.show) {
      op = state.board ? 'board_off' : 'show_off'; label = 'Revenir à la question'; stage = 'Affichage spécial';
      hint = 'Reprend la question en cours, sans modifier ses réponses.';
    } else if (state.ended) {
      op = ''; label = 'Atelier terminé'; stage = 'Atelier terminé';
      hint = 'La conclusion est affichée. Le bilan et les exports restent disponibles.';
    } else if (information) {
      op = state.position >= state.count ? 'end' : 'next';
      label = op === 'end' ? 'Terminer l’atelier' : 'Étape suivante'; stage = 'Diapositive d’information';
      hint = 'Le groupe lit ce contenu. Aucune réponse ni publication de résultat n’est nécessaire.';
    } else if (!q) {
      op = state.count ? 'next' : ''; label = 'Démarrer l’atelier'; stage = 'Accueil du groupe';
      hint = state.count ? 'Affiche la première question et permet aux participants de répondre.' : 'Ajoutez une question dans Préparer pour démarrer.';
    } else if (q.state === 'draft') {
      op = 'open'; label = 'Ouvrir les réponses'; stage = 'Question prête';
      hint = 'Les participants pourront répondre à cette question.';
    } else if (open && post && !published) {
      op = 'show'; label = 'Publier les contributions'; stage = 'Contributions à relire';
      hint = 'Relisez les contributions dans Animer avant de les rendre visibles. La collecte reste ouverte.';
    } else if (open) {
      op = 'close'; label = 'Clore les réponses'; stage = 'Réponses en cours';
      hint = projected ? 'Arrête la collecte. Les résultats déjà affichés restent visibles.' : 'Arrête la collecte. Les résultats restent masqués jusqu’à votre clic.';
    } else if (!published) {
      op = 'show'; label = post ? 'Publier les contributions' : 'Afficher les résultats'; stage = 'Réponses closes';
      hint = post ? 'Après relecture dans Animer, rend les contributions visibles du groupe.'
        : 'Montre les résultats sur l’écran du groupe et les appareils des participants' + (q.graded ? ', avec la correction du quiz.' : '.');
    } else {
      op = state.position >= state.count ? 'end' : 'next';
      label = op === 'end' ? 'Terminer l’atelier' : 'Question suivante'; stage = 'Échange autour des résultats';
      hint = op === 'end' ? 'Après confirmation, clôt l’atelier et affiche sa conclusion.' : 'Affiche la question suivante et ouvre ses réponses si elle n’a pas encore été posée.';
    }
    var projection = state.board ? 'Bilan' : state.show === 'asks' ? 'Questions publiées' : state.show === 'podium' ? 'Podium'
      : state.ended ? 'Conclusion' : !q ? 'Accueil et code' : projected ? 'Résultats visibles' : 'Résultats masqués';
    var participant = state.ended ? 'Atelier terminé' : !q ? 'Accueil' : published ? 'Résultats visibles'
      : open ? 'Répondre · résultats masqués' : 'En attente des résultats';
    if (information && !state.ended && !state.board && !state.show) { projection = 'Information affichée'; participant = 'Lecture · aucune réponse demandée'; }
    return { op: op, label: label, hint: hint, stage: stage, open: open, post: post, published: published,
      projection: projection, participant: participant,
      visibility: published ? (live && state.projected !== false ? 'Masquer sur les appareils' : 'Masquer les résultats')
        : post ? 'Publier les contributions' : 'Afficher les résultats',
      canToggle: !!q && !information && !state.ended && (published || (op !== 'show' && !q.graded)),
      canReopen: !!q && !information && !state.ended && !open && q.state !== 'draft' };
  }

  /** État visible dans les deux écrans, sans reconstruire le DOM au polling. */
  function renderAnimationGuide(node, guide) {
    var signature = [guide.stage, guide.projection, guide.participant, guide.hint].join('|');
    if (node.dataset.guide === signature) return;
    node.dataset.guide = signature;
    clear(node).appendChild(el('strong', { class: 'animation-stage' }, guide.stage));
    node.appendChild(el('div', { class: 'animation-visibility' },
      el('span', null, el('strong', null, 'Écran du groupe : '), guide.projection),
      el('span', null, el('strong', null, 'Appareils des participants : '), guide.participant)));
    node.appendChild(el('p', { class: 'animation-hint' }, guide.hint));
  }

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
      names.forEach(function (_, i) {
        list.appendChild(el('li', { class: 'bar', 'data-i': String(i) }, el('span', { class: 'bar-label' }),
          el('span', { class: 'bar-track' }, el('span', { class: 'bar-fill' })), el('span', { class: 'bar-value' })));
      });
    }
    var items = Array.prototype.slice.call(list.children).sort(function (a, b) {
      return a.getAttribute('data-i') - b.getAttribute('data-i');
    });
    names.forEach(function (label, i) {
      var n = res.counts[i] || 0;
      var good = q.correct && q.correct.indexOf(i) !== -1;
      var pct = q.type === 'points' ? (sum ? Math.round(100 * n / sum) : 0)
        : (res.total ? Math.round(100 * n / res.total) : 0);
      var li = items[i];
      li.className = 'bar' + (good ? ' bar-good' : '');
      renderText(li.children[0], label, q.rich && q.rich.options && q.rich.options[i], richOffset(q.rich && q.rich.options, i));
      if (good) li.children[0].insertBefore(document.createTextNode('✓ '), li.children[0].firstChild);
      li.children[2].textContent = columns ? String(n) : q.type === 'points' ? plural(n, 'point') : n + ' (' + pct + ' %)';
      var fill = li.children[1].firstChild;
      var size = Math.round(100 * n / max) + '%';
      var apply = function () { fill.style[columns ? 'height' : 'width'] = size; };
      if (fresh) requestAnimationFrame(function () { requestAnimationFrame(apply); });
      else apply();
    });
    if (q.type === 'points') sortByPoints(list, items, res.counts);
    return list;
  }

  /** Classement par points : du plus au moins de points, à égalité l'ordre des
   *  choix. Les barres gardent leur élément (la longueur s'anime) ; on ne les
   *  déplace que si l'ordre change, sinon la transition repartirait. */
  function sortByPoints(list, items, counts) {
    var order = items.map(function (_, i) { return i; }).sort(function (a, b) {
      return (counts[b] || 0) - (counts[a] || 0) || a - b;
    });
    var moved = order.some(function (i, k) { return list.children[k] !== items[i]; });
    if (moved) order.forEach(function (i) { list.appendChild(items[i]); });
  }

  /** Mémoire des éléments déjà affichés pour une question : seuls les
   *  nouveaux mots ou nouvelles réponses jouent l'animation d'apparition. */
  function memory(container, q) {
    // Map et non objet : un mot saisi comme « constructor » ou « __proto__ »
    // ne doit pas tomber sur une propriété héritée.
    if (!container.wlMemory || container.wlMemory.q !== q.id) container.wlMemory = { q: q.id, nodes: new Map() };
    return container.wlMemory.nodes;
  }

  function keep(nodes, key, make) {
    if (nodes.has(key)) return nodes.get(key);
    var node = make();
    node.classList.add('is-new');
    node.setAttribute('data-key', String(key));
    node.addEventListener('animationend', function () { node.classList.remove('is-new'); });
    nodes.set(key, node);
    return node;
  }

  /** Libellé du type ; un QCM précise s'il attend une ou plusieurs réponses. */
  function typeLabel(q) {
    if (q.type !== 'mcq') return TYPES[q.type];
    return TYPES.mcq + (q.multi ? ' — plusieurs réponses possibles' : ' — une seule réponse');
  }

  /** Couleur d'un post-it : au hasard mais stable (tirée de son identifiant).
   *  Jamais par participant : ses idées seraient reliées entre elles (anonymat). */
  function noteColor(id) {
    var h = 0;
    for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
    return 'board-c' + (h % 6);
  }

  /** Fin de session : récap (une ligne par question) puis conclusion. */
  function renderRecap(container, d) {
    clear(container);
    if (d.recap && d.recap.length) {
      container.appendChild(el('h2', { class: 'recap-title' }, 'Ce qu\'on retient de l\'atelier'));
      var list = el('ol', { class: 'recap' });
      d.recap.forEach(function (r) {
        list.appendChild(el('li', null, el('span', { class: 'recap-q' }, r.text), el('strong', { class: 'recap-a' }, r.summary)));
      });
      container.appendChild(list);
    }
    if (d.conclusion) {
      // Titre « À retenir » ; le même début dans le texte est retiré (pas de doublon).
      container.appendChild(el('h2', { class: 'recap-title' }, 'À retenir'));
      var text = d.conclusion.replace(/^\s*(?:[àa]\s+)?retenir\s*:\s*/i, '');
      container.appendChild(el('p', { class: 'explain recap-conclusion' }, d.conclusionRich && d.conclusionRich.length
        ? richText(d.conclusion, d.conclusionRich) : text.charAt(0).toUpperCase() + text.slice(1)));
    }
  }

  /** Couleur stable d'un mot (elle ne change pas quand l'ordre change). */
  function colorOf(text) {
    var h = 0;
    for (var i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 997;
    return 'cloud-c' + (h % 4);
  }

  /** Nuage : taille de police proportionnelle à la fréquence (1 à 4 em). Sur la
   *  projection (.s-results), les tailles sont relatives et fitResults() ajuste
   *  l'ensemble pour qu'il tienne dans l'écran, quel que soit le nombre de mots. */
  function cloud(container, q, words) {
    var nodes = memory(container, q);
    var fit = container.classList.contains('s-results');
    var max = words.reduce(function (m, w) { return Math.max(m, w.n); }, 1);
    var box = el('p', { class: 'cloud' + (fit ? ' cloud-fit' : '') });
    words.forEach(function (w) {
      var span = keep(nodes, w.text.toLowerCase(), function () {
        return el('span', { class: 'cloud-word ' + colorOf(w.text.toLowerCase()) }, w.text);
      });
      span.textContent = w.text;
      span.title = w.n + ' fois';
      span.classList.toggle('cloud-top', w.n === max && words.length > 1);
      span.style.fontSize = (fit ? 0.35 + 0.65 * w.n / max : 1 + 3 * w.n / max).toFixed(2) + 'em';
      // Flottement : phase calculée d'après l'horloge, propre à chaque mot. Une
      // mise à jour recrée l'animation sans saut (elle reprend où elle en était).
      if (fit) {
        var h = 0, key = w.text.toLowerCase();
        for (var i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 997;
        span.style.animationDelay = -((Date.now() + 1000 * (h % 6)) % 6000) + 'ms';
      }
      box.appendChild(span);
      box.appendChild(document.createTextNode(' '));
    });
    return box;
  }

  /** Projection : le bloc de résultats (barres ou nuage, total, explication)
   *  doit finir au-dessus de la barre de pilotage, sans défilement. Nuage :
   *  agrandi au plus grand corps qui tient. Autres résultats : corps réduit
   *  seulement s'ils débordent (longs choix sur deux lignes, nombreux choix).
   *  À rappeler après chaque affichage et quand la fenêtre change de taille. */
  /** Bas utilisable de la projection : au-dessus de la barre de pilotage
   *  quand elle est affichée (sa hauteur dépend de la feuille de style). */
  function screenLimit() {
    var pilot = document.getElementById('s-pilot');
    // Barre de pilotage en haut (projection) : la place va jusqu'au bas de l'écran ; en bas, jusqu'à elle.
    var top = pilot && !pilot.hidden ? pilot.getBoundingClientRect().top : -1;
    return top > window.innerHeight / 2 ? top - 12 : window.innerHeight - 40;
  }

  function fitResults(container) {
    var limit = screenLimit();
    var cloudBox = container.querySelector('.cloud-fit');
    var box = cloudBox || container;
    var fits = function () {
      return container.getBoundingClientRect().bottom <= limit && (!cloudBox || box.scrollWidth <= box.clientWidth);
    };
    box.style.fontSize = '';
    var lo = 12, hi = cloudBox ? 160 : parseFloat(getComputedStyle(box).fontSize);
    if (!cloudBox && fits()) return;
    for (var i = 0; i < 9; i++) {
      var mid = (lo + hi) / 2;
      box.style.fontSize = mid + 'px';
      if (fits()) lo = mid; else hi = mid;
    }
    box.style.fontSize = lo + 'px';
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

  /** Mur collaboratif : cartes, les plus aimées d'abord. */
  function wallCards(container, q, posts, opts) {
    var nodes = memory(container, q);
    var list = el('ul', { class: 'wall wall-collab' });
    posts.forEach(function (p) {
      var item = keep(nodes, p.id, function () { return el('li', { class: 'wall-item' }); });
      clear(item).appendChild(el('span', { class: 'post-text' }, p.text));
      item.classList.toggle('wall-hidden', !!p.hidden);
      item.appendChild(el('span', { class: 'likes' }, '♥ ' + p.likes + ' j\'aime'));
      if (opts.onHide) item.appendChild(hideButton(p, opts.onHide));
      list.appendChild(item);
    });
    return list;
  }

  function hideButton(p, onHide) {
    return el('button', { type: 'button', class: 'btn btn-small', onclick: function () { onHide(p.id, !p.hidden); } },
      p.hidden ? 'Réafficher' : 'Masquer');
  }

  /** Post-it collectif : une colonne par catégorie, post-its regroupés empilés
   *  sous leur post-it principal. opts.onAdmin(pid, op, arg) : outils animateur. */
  function board(container, q, res, opts) {
    var nodes = memory(container, q);
    var top = res.posts.filter(function (p) { return !p.parent; });
    var grid = el('div', { class: 'board' });
    grid.style.gridTemplateColumns = 'repeat(' + res.columns.length + ', minmax(10rem, 1fr))';
    res.columns.forEach(function (name, c) {
      var col = el('section', { class: 'board-col' }, el('h3', { class: 'board-title' }, richText(name, q.rich && q.rich.options && q.rich.options[c], richOffset(q.rich && q.rich.options, c))));
      top.filter(function (p) { return p.col === c; }).forEach(function (p) {
        var note = keep(nodes, p.id, function () { return el('div', { class: 'note ' + noteColor(p.id) }); });
        clear(note).appendChild(el('p', { class: 'note-text' }, p.text));
        note.classList.toggle('wall-hidden', !!p.hidden);
        if (opts.onAdmin) note.appendChild(noteTools(p, top, res.columns, opts));
        res.posts.filter(function (ch) { return ch.parent === p.id; }).forEach(function (ch) {
          var sub = el('p', { class: 'note-sub' + (ch.hidden ? ' wall-hidden' : '') }, '+ ' + ch.text);
          if (opts.onAdmin) {
            sub.appendChild(el('button', { type: 'button', class: 'btn btn-small', onclick: function () { opts.onAdmin(ch.id, 'ungroup'); } }, 'Détacher'));
            sub.appendChild(hideButton(ch, opts.onHide));
          }
          note.appendChild(sub);
        });
        col.appendChild(note);
      });
      grid.appendChild(col);
    });
    return grid;
  }

  /** Outils animateur d'un post-it : masquer, changer de colonne, regrouper. */
  function noteTools(p, top, columns, opts) {
    var tools = el('div', { class: 'note-tools' }, hideButton(p, opts.onHide));
    if (columns.length > 1) {
      var move = el('select', { 'aria-label': 'Déplacer vers la colonne', onchange: function () { opts.onAdmin(p.id, 'move', Number(move.value)); } },
        el('option', { value: '' }, 'Déplacer…'));
      columns.forEach(function (name, c) { if (c !== p.col) move.appendChild(el('option', { value: c }, name)); });
      tools.appendChild(move);
    }
    var others = top.filter(function (o) { return o.id !== p.id; });
    if (others.length) {
      var group = el('select', { 'aria-label': 'Regrouper sous un autre post-it', onchange: function () { opts.onAdmin(p.id, 'group', group.value); } },
        el('option', { value: '' }, 'Regrouper sous…'));
      others.forEach(function (o) { group.appendChild(el('option', { value: o.id }, o.text.slice(0, 40))); });
      tools.appendChild(group);
    }
    return tools;
  }

  /** Gommettes : classement des idées, une pastille par gommette reçue. */
  function dotsRanking(container, q, items) {
    var nodes = memory(container, q);
    var list = el('ol', { class: 'dots-rank' });
    items.forEach(function (it) {
      var row = keep(nodes, it.id, function () { return el('li', { class: 'dots-row' }); });
      var pills = el('span', { class: 'dots', 'aria-hidden': 'true' });
      for (var i = 0; i < Math.min(it.n, 40); i++) pills.appendChild(el('span', { class: 'dot' }));
      clear(row).appendChild(el('span', { class: 'dots-text' }, it.text,
        it.grouped.length ? el('small', { class: 'dots-grouped' }, ' (+ ' + it.grouped.join(' ; ') + ')') : null));
      row.appendChild(pills);
      row.appendChild(el('span', { class: 'bar-value' }, plural(it.n, 'gommette')));
      list.appendChild(row);
    });
    return list;
  }

  /** Affiche les résultats d'une question dans container. opts : onHide
   *  (modération, animateur), onAdmin (outils post-it, animateur),
   *  participants (projection : décompte « 3 / 5 »). Une
   *  fonction seule vaut onHide. */
  function renderResults(container, q, res, opts) {
    if (q.type === 'info') { renderInformation(container, q); return; }
    opts = typeof opts === 'function' ? { onHide: opts } : (opts || {});
    var onHide = opts.onHide;
    if (!res) { clear(container); return; }
    // Glissement des lignes réordonnées : mur et gommettes seulement. Sur le nuage,
    // les mots encore décalés faussaient fitResults (police divisée par 2 à chaque
    // mise à jour, mesuré le 16/10/2026).
    var before = WL.measure && (q.type === 'wall' || q.type === 'dots') ? WL.measure(container) : null;
    var onScreen = container.classList.contains('s-results');
    var node;
    var none = function (text) { return el('p', { class: 'meta results-none' }, text); };
    if (q.type === 'wall') {
      node = res.posts.length ? wallCards(container, q, res.posts, opts) : none('Aucun message pour le moment.');
    } else if (q.type === 'postit') {
      node = board(container, q, res, opts);
    } else if (q.type === 'dots') {
      node = res.items.length ? dotsRanking(container, q, res.items) : none('Aucune idée à départager : publiez d\'abord le post-it (ou le mur) source.');
    } else if (q.type === 'wordcloud') {
      node = res.words.length ? cloud(container, q, res.words) : none('Aucun mot pour le moment.');
    } else if (q.type === 'text') {
      node = res.texts.length ? wall(container, q, res.texts, onHide) : none('Aucune réponse pour le moment.');
    } else if (onScreen && WL.donut && (q.type === 'yesno' || q.type === 'truefalse')) {
      node = WL.donut(container, q, res);
    } else if (onScreen && WL.scaleView && q.type === 'scale') {
      node = WL.scaleView(container, bars(container, q, res), q, res);
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
    var post = q.type === 'wall' || q.type === 'postit';
    // Projection : « 3 / 5 ont répondu » (opts.participants), ailleurs le total seul.
    var foot = !post && opts.participants ? res.total + ' / ' + opts.participants + (q.type === 'steps' ? ' ont commencé' : ' ont répondu')
      : plural(res.total, q.type === 'wall' ? 'message' : q.type === 'postit' ? 'post-it' : 'réponse');
    if (q.type === 'scale' && res.average !== null) foot += ' — moyenne ' + String(res.average).replace('.', ',') + ' / ' + q.scaleMax;
    if (q.type === 'steps') foot += ' — ' + res.finished + (res.finished > 1 ? ' ont' : ' a') + ' terminé toutes les étapes';
    container.appendChild(el('p', { class: 'results-foot' }, foot));
    if (res.compare) container.appendChild(el('p', { class: 'results-compare' }, compareText(res.compare)));
    if (before && WL.playFlip) WL.playFlip(container, before);
  }

  /** Contenu de l'animateur : texte sans HTML, sans compteur de votes. */
  function renderText(container, plain, blocks, start) {
    if (!blocks || !blocks.length) { container.textContent = plain || ''; return; }
    var key = JSON.stringify([blocks, start || 0]);
    if (container.wlRichKey === key && container.firstChild && container.firstChild.nodeType === 1 && container.firstChild.classList.contains('wl-rich-text')) return;
    container.wlRichKey = key;
    var box = el('span', { class: 'wl-rich-text' }), number = start || 0;
    blocks.forEach(function (block) {
      var type = ['title', 'subtitle', 'bullet', 'number'].indexOf(block.type) !== -1 ? block.type : 'p';
      number = type === 'number' ? number + 1 : 0;
      var line = el('span', { class: 'wl-rich-block wl-rich-' + type });
      if (type === 'bullet' || type === 'number') line.appendChild(document.createTextNode(type === 'bullet' ? '• ' : number + '. '));
      (block.runs || []).forEach(function (run) { line.appendChild(run.bold ? el('strong', null, run.text) : run.bold === false ? el('span', { class: 'wl-rich-normal' }, run.text) : document.createTextNode(run.text)); });
      box.appendChild(line);
    });
    clear(container).appendChild(box);
  }

  function richText(plain, blocks, start) { var node = el('span'); renderText(node, plain, blocks, start); return node; }

  function richOffset(docs, index) {
    if (!docs || !docs[index] || !docs[index][0] || docs[index][0].type !== 'number') return 0;
    var offset = 0;
    for (var i = index - 1; i >= 0 && docs[i] && docs[i][0] && docs[i][0].type === 'number'; i--) offset++;
    return offset;
  }

  function variantDocs(q) {
    var out = Object.create(null), name = '';
    ((q.rich && q.rich.variants) || []).forEach(function (block) {
      var line = block.runs.map(function (r) { return r.text; }).join('').trim(), match = /^\[(.+)\]$/.exec(line);
      if (match) {
        name = match[1].trim().replace(/\s+/g, ' ');
        var full = block.runs.map(function (r) { return r.text; }).join(''), start = full.indexOf('[') + 1, end = full.lastIndexOf(']'), offset = 0, parts = [];
        block.runs.forEach(function (r) {
          var text = r.text.slice(Math.max(0, start - offset), Math.max(0, Math.min(r.text.length, end - offset)));
          if (text) parts.push(Object.assign({}, r, { text: text }));
          offset += r.text.length;
        });
        out[name] = { title: [{ type: block.type, runs: parts }], steps: [] };
      } else if (line && name) out[name].steps.push([block]);
    });
    return out;
  }

  function renderInformation(container, q) {
    var previous = container.wlInformation;
    var richKey = JSON.stringify(q.rich || {});
    if (previous && previous.id === q.id && previous.content === q.content && previous.image === q.illustration
      && previous.rich === richKey
      && container.firstElementChild && container.firstElementChild.classList.contains('information-slide')) return;
    container.wlInformation = { id: q.id, content: q.content, image: q.illustration, rich: richKey };
    var box = el('section', { class: 'information-slide' + (q.illustration ? ' has-illustration' : '') });
    if (q.content) { var body = el('div', { class: 'info-content' }); renderText(body, q.content, q.rich && q.rich.content); box.appendChild(body); }
    if (q.illustration) box.appendChild(el('img', { class: 'info-illustration', src: q.illustration, alt: 'Illustration de la diapositive « ' + q.text + ' »', width: 640, height: 480 }));
    clear(container).appendChild(box);
  }

  /** Avant / après, en une ligne (même texte que `wl_compare_text` côté PHP). */
  function compareText(c) {
    var fmt = function (v) { return String(v).replace('.', ','); };
    var unit = function (v) { return c.kind === 'average' ? fmt(v) + ' / ' + c.max : v + ' % de bonnes réponses'; };
    var d = Math.round((c.after - c.before) * 10) / 10;
    var delta = d === 0 ? 'stable' : (d > 0 ? '+' : '−') + fmt(Math.abs(d)) + (c.kind === 'average' ? '' : ' points');
    var who = c.same ? 'mêmes ' + c.nCommon + ' personnes' : 'personnes différentes : ' + c.nBefore + ' puis ' + c.nAfter + ' réponses';
    return 'Avant : ' + unit(c.before) + ' — Après : ' + unit(c.after) + ' (' + delta + ' ; ' + who + ')';
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
    el: el, $: $, clear: clear, memory: memory, keep: keep, show: show, api: api, Poller: Poller, qr: qr, fitResults: fitResults, screenLimit: screenLimit, typeLabel: typeLabel, noteColor: noteColor, renderRecap: renderRecap,
    TYPES: TYPES, plural: plural, renderResults: renderResults, renderInformation: renderInformation, renderText: renderText, richText: richText, richOffset: richOffset, variantDocs: variantDocs, compareText: compareText, linkHost: linkHost,
    remaining: remaining, formatTime: formatTime, animationGuide: animationGuide, renderAnimationGuide: renderAnimationGuide
  };
}());
