/* Export du bilan en PowerPoint (.pptx) : une diapositive de titre, une par
 * question (graphique natif modifiable dans PowerPoint), le récap et la
 * conclusion. Généré dans le navigateur avec PptxGenJS (assets/pptxgen.bundle.js,
 * chargé seulement à l'export) : aucune donnée ne quitte l'ordinateur. */
'use strict';

(function () {
  // Charte « Papier & Terre », thème clair (mêmes valeurs que --wl-* de style.css).
  var C = { texte: '2E2118', doux: '6B5442', primaire: 'A83A1A', ok: '2F6B1F', fond: 'FBF4E8', carte: 'FFFDF8',
    accent: '1F6F6B', bord: 'E4D3BA', entete: 'F6E7CF', postit: 'FFF1A8' };
  var FONT = 'Verdana', TITRE = 'Georgia';
  var W = 13.33; // LAYOUT_WIDE : 13,33 x 7,5 pouces

  /** Charge la bibliothèque une seule fois (src signé par wl_asset). */
  function load(src) {
    if (window.PptxGenJS) return Promise.resolve();
    return new Promise(function (ok, ko) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = ok;
      s.onerror = function () { ko(new Error('Bibliothèque PowerPoint introuvable.')); };
      document.head.appendChild(s);
    });
  }

  function text(slide, value, o) {
    slide.addText(value, Object.assign({ fontFace: FONT, color: C.texte, valign: 'top', margin: 0 }, o));
  }

  // Une couleur par réponse (--wl-b1 à b7), la bonne réponse en vert : comme la projection.
  var PAL = ['A83A1A', '1F6F6B', 'B07A00', '7A2E5E', '55702A', '2F5E9E', '8A6A4A'];
  var NOTES = ['FFF1A8', 'D6EEF6', 'EEF3C9', 'F9DCC8', 'F3DDEB', 'E4EEDB']; // .note.board-c0 à c5
  var CLOUD = [C.primaire, C.accent, C.texte, '7A2E5E'];                   // .cloud-c0 à c3
  var PASTILLE = 'E0A22B', PASTILLE_BORD = '7A4F00';

  /** Même calcul que WL.noteColor / colorOf : couleur stable d'après un texte. */
  function hash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 997;
    return h;
  }
  function good(correct, i) { return (correct || []).indexOf(i) !== -1; }
  function pct(n, total) { return total ? Math.round(100 * n / total) + ' %' : '0 %'; }

  /** Barres horizontales dessinées comme sur la projection : libellé, piste
   *  claire, barre arrondie proportionnelle au plus grand, valeur à droite.
   *  Bonne réponse : barre verte, coche et cadre (pas la couleur seule). */
  function bars(pptx, slide, labels, values, correct, box) {
    var total = values.reduce(function (a, b) { return a + b; }, 0), max = Math.max(1, Math.max.apply(null, values));
    var n = labels.length, row = Math.min(0.75, box.h / n), bh = row * 0.62;
    var lw = 4.4, vw = 1.9, tx = box.x + lw + 0.2, tw = box.w - lw - vw - 0.4;
    labels.forEach(function (l, i) {
      var y = box.y + i * row, ok = good(correct, i), by = y + (row - bh) / 2;
      if (ok) slide.addShape(pptx.ShapeType.roundRect, { x: box.x - 0.1, y: y + 0.02, w: box.w + 0.2, h: row - 0.04, rectRadius: 0.12,
        fill: { color: C.fond }, line: { color: C.ok, width: 2.5 } });
      text(slide, (ok ? '✓ ' : '') + l, { x: box.x, y: y, w: lw, h: row, fontSize: 18, bold: ok, valign: 'middle', fit: 'shrink' });
      slide.addShape(pptx.ShapeType.roundRect, { x: tx, y: by, w: tw, h: bh, rectRadius: bh / 2, fill: { color: 'EADBC2' }, line: { color: 'EADBC2', width: 0 } });
      if (values[i]) {
        var c = ok ? C.ok : PAL[i % PAL.length];
        slide.addShape(pptx.ShapeType.roundRect, { x: tx, y: by, w: Math.max(bh, tw * values[i] / max), h: bh, rectRadius: bh / 2, fill: { color: c }, line: { color: c, width: 0 } });
      }
      text(slide, values[i] + ' (' + pct(values[i], total) + ')', { x: box.x + box.w - vw, y: y, w: vw, h: row, fontSize: 22, bold: true, fontFace: TITRE, align: 'right', valign: 'middle' });
    });
  }

  /** Oui / Non, Vrai / Faux : anneau avec le total au centre, légende à droite. */
  function donut(pptx, slide, q, r, box) {
    var size = Math.min(box.h, 4.2), x = box.x + 0.3, y = box.y + (box.h - size) / 2;
    var colors = q.options.map(function (_, i) { return good(q.correct, i) ? C.ok : [C.accent, C.primaire][i % 2]; });
    slide.addChart(pptx.ChartType.doughnut, [{ name: 'Réponses', labels: q.options, values: r.counts }], {
      x: x, y: y, w: size, h: size, holeSize: 62, chartColors: colors, showLegend: false, showValue: false,
      showPercent: false, showLabel: false, dataBorder: { pt: 2, color: C.fond }
    });
    text(slide, [{ text: String(r.total), options: { fontSize: 40, bold: true, fontFace: TITRE, breakLine: true } },
      { text: r.total > 1 ? 'réponses' : 'réponse', options: { fontSize: 16, color: C.doux } }],
    { x: x, y: y + size / 2 - 0.55, w: size, h: 1.1, align: 'center', valign: 'middle' });
    q.options.forEach(function (name, i) {
      var ly = box.y + box.h / 2 - 0.6 + i * 0.8, ok = good(q.correct, i);
      slide.addShape(pptx.ShapeType.ellipse, { x: x + size + 0.6, y: ly + 0.13, w: 0.3, h: 0.3, fill: { color: colors[i] }, line: { color: colors[i], width: 0 } });
      text(slide, [{ text: (ok ? '✓ ' : '') + name + ' · ' + pct(r.counts[i], r.total) + (ok ? ' · Bonne réponse' : ''), options: { bold: true, fontFace: TITRE } },
        { text: '   ' + r.counts[i], options: { color: C.doux } }],
      { x: x + size + 1.05, y: ly, w: box.w - size - 1.5, h: 0.56, fontSize: 24, valign: 'middle',
        line: ok ? { color: C.ok, width: 2.5 } : undefined, margin: 6 });
    });
  }

  /** Échelle : jauge de la moyenne (demi-anneau) et colonnes de la répartition. */
  function gauge(pptx, slide, q, r, box) {
    var size = Math.min(4.2, box.h * 1.3), x = box.x, y = box.y + 0.1, avg = r.average || 0;
    // Anneau dont la moitié basse prend la couleur du fond : il reste un demi-cercle.
    slide.addChart(pptx.ChartType.doughnut, [{ name: 'Moyenne', labels: ['m', 'r', 'b'], values: [avg, q.scaleMax - avg, q.scaleMax] }], {
      x: x, y: y, w: size, h: size, holeSize: 66, firstSliceAng: 270, chartColors: [PASTILLE, 'EADBC2', C.fond],
      showLegend: false, showValue: false, showPercent: false, showLabel: false, dataBorder: { pt: 0, color: C.fond }
    });
    text(slide, [{ text: r.average === null ? '–' : String(r.average).replace('.', ','), options: { fontSize: 40, bold: true, fontFace: TITRE } },
      { text: ' / ' + q.scaleMax, options: { fontSize: 20, color: C.doux } }],
    { x: x, y: y + size / 2 - 0.85, w: size, h: 0.8, align: 'center', valign: 'bottom' });
    // Colonnes : piste claire, remplissage moutarde depuis le bas, effectif au-dessus.
    var cx = x + size + 0.4, cw = box.w - size - 0.4, n = r.counts.length, gap = 0.12, w = (cw - gap * (n - 1)) / n;
    var top = box.y + 0.45, ch = box.h - 0.95, max = Math.max(1, Math.max.apply(null, r.counts));
    r.counts.forEach(function (v, k) {
      var px = cx + k * (w + gap), fh = ch * v / max;
      text(slide, String(v), { x: px, y: box.y, w: w, h: 0.4, fontSize: 18, bold: true, fontFace: TITRE, align: 'center', valign: 'bottom' });
      slide.addShape(pptx.ShapeType.roundRect, { x: px, y: top, w: w, h: ch, rectRadius: 0.08, fill: { color: 'EADBC2' }, line: { color: 'EADBC2', width: 0 } });
      if (v) slide.addShape(pptx.ShapeType.roundRect, { x: px, y: top + ch - fh, w: w, h: fh, rectRadius: 0.08, fill: { color: PASTILLE }, line: { color: PASTILLE, width: 0 } });
      text(slide, String(k + 1), { x: px, y: top + ch + 0.05, w: w, h: 0.4, fontSize: 18, align: 'center' });
    });
  }

  /** Nuage : mêmes couleurs stables que la projection, taille selon la fréquence. */
  function cloud(slide, words, box) {
    var max = words.reduce(function (m, w) { return Math.max(m, w.n); }, 1);
    text(slide, words.slice(0, 40).map(function (w) {
      return { text: w.text + '    ', options: { fontSize: Math.round(16 + 36 * w.n / max), bold: true, fontFace: TITRE,
        color: CLOUD[hash(w.text.toLowerCase()) % CLOUD.length] } };
    }), Object.assign({ align: 'center', valign: 'middle', fit: 'shrink' }, box));
  }

  /** Mur : cartes claires sur trois colonnes, filet coloré en bas, « ♥ n » à droite. */
  function wall(pptx, slide, posts, box) {
    var cols = 3, gap = 0.2, w = (box.w - gap * (cols - 1)) / cols, h = 1, rows = Math.floor((box.h + gap) / (h + gap));
    var shown = posts.slice(0, cols * rows);
    shown.forEach(function (p, k) {
      var x = box.x + (k % cols) * (w + gap), y = box.y + Math.floor(k / cols) * (h + gap);
      text(slide, [{ text: p.text, options: { fontSize: 16, breakLine: true } },
        { text: '♥ ' + p.likes + ' j\'aime', options: { fontSize: 14, bold: true, color: C.primaire, align: 'right' } }],
      { x: x, y: y, w: w, h: h, shape: pptx.ShapeType.roundRect, rectRadius: 0.1, fill: { color: C.carte },
        line: { color: C.bord, width: 1 }, margin: 8, valign: 'middle', fit: 'shrink' });
      slide.addShape(pptx.ShapeType.rect, { x: x + 0.1, y: y + h - 0.06, w: w - 0.2, h: 0.06, fill: { color: PAL[k % 6] }, line: { color: PAL[k % 6], width: 0 } });
    });
    if (posts.length > shown.length) text(slide, '+ ' + (posts.length - shown.length) + ' autres messages', { x: box.x, y: box.y + box.h - 0.3, w: box.w, h: 0.3, fontSize: 12, color: C.doux, align: 'right' });
  }

  /** Post-it : une colonne par rubrique, post-its colorés comme sur la projection. */
  function postits(pptx, slide, q, posts, box) {
    var n = q.options.length, gap = 0.2, w = (box.w - gap * (n - 1)) / n;
    q.options.forEach(function (name, c) {
      var x = box.x + c * (w + gap);
      slide.addShape(pptx.ShapeType.roundRect, { x: x, y: box.y, w: w, h: box.h, rectRadius: 0.1, fill: { color: 'EADBC2' }, line: { color: 'EADBC2', width: 0 } });
      text(slide, name, { x: x + 0.15, y: box.y + 0.1, w: w - 0.3, h: 0.45, fontSize: 16, bold: true, fontFace: TITRE });
      var notes = posts.filter(function (p) { return p.col === c && !p.parent; });
      var h = Math.min(0.6, (box.h - 0.7) / Math.max(1, notes.length) - 0.1);
      notes.forEach(function (p, k) {
        text(slide, p.text, { x: x + 0.12, y: box.y + 0.65 + k * (h + 0.1), w: w - 0.24, h: h, fontSize: 14, bold: true,
          fill: { color: NOTES[hash(p.id) % 6] }, margin: 6, valign: 'middle', fit: 'shrink',
          shadow: { type: 'outer', color: '503C28', opacity: 0.25, blur: 3, offset: 2, angle: 90 } });
      });
    });
  }

  /** Gommettes : idée sur post-it jaune, pastilles, décompte. */
  function dots(pptx, slide, items, box) {
    var rows = items.slice(0, 8), h = Math.min(0.55, box.h / Math.max(1, rows.length) - 0.1);
    rows.forEach(function (it, k) {
      var y = box.y + k * (h + 0.1);
      text(slide, it.text, { x: box.x, y: y, w: 5.2, h: h, fontSize: 15, bold: true, fill: { color: 'FFF1A8' }, margin: 6, valign: 'middle', fit: 'shrink',
        shadow: { type: 'outer', color: '503C28', opacity: 0.25, blur: 3, offset: 2, angle: 90 } });
      for (var d = 0; d < Math.min(it.n, 20); d++) {
        slide.addShape(pptx.ShapeType.ellipse, { x: box.x + 5.5 + d * 0.27, y: y + h / 2 - 0.11, w: 0.22, h: 0.22,
          fill: { color: PASTILLE }, line: { color: PASTILLE_BORD, width: 1 } });
      }
      text(slide, WL.plural(it.n, 'gommette'), { x: box.x + 10.2, y: y, w: 2.13, h: h, fontSize: 15, bold: true, fontFace: TITRE, valign: 'middle', align: 'right' });
    });
  }

  function bullets(slide, lines, box) {
    if (!lines.length) { text(slide, 'Aucune réponse.', Object.assign({ fontSize: 18, color: C.doux }, box)); return; }
    text(slide, lines.slice(0, 30).map(function (l) { return { text: l, options: { bullet: true, breakLine: true } }; }),
      Object.assign({ fontSize: 16, fit: 'shrink', paraSpaceAfter: 4 }, box));
  }

  /** Une diapositive par question. */
  function questionSlide(pptx, q, i, d) {
    var slide = pptx.addSlide({ masterName: 'WL' });
    var r = q.results, post = q.type === 'wall' || q.type === 'postit';
    text(slide, 'Question ' + (i + 1) + ' / ' + d.questions.length + ' — ' + WL.typeLabel(q), { x: 0.5, y: 0.3, w: W - 1, h: 0.4, fontSize: 14, color: C.doux });
    text(slide, q.text, { x: 0.5, y: 0.7, w: W - 1, h: 1.1, fontSize: 24, bold: true, fit: 'shrink', fontFace: TITRE });
    var h = q.explain ? 3.5 : 4.5, box = { x: 0.5, y: 1.9, w: W - 1, h: h };
    var visible = function (list) { return (list || []).filter(function (x) { return !x.hidden; }); };
    var gone = !r.counts && !r.words && !r.texts && !r.posts && !r.items; // archive : textes non conservés
    if (gone) {
      text(slide, WL.plural(r.total, post ? 'contribution' : 'réponse') + ' — textes des participants non conservés dans l\'archive (anonymat).',
        Object.assign({ fontSize: 18, color: C.doux }, box));
    } else if (q.type === 'yesno' || q.type === 'truefalse') {
      donut(pptx, slide, q, r, box);
    } else if (['poll', 'mcq', 'points'].indexOf(q.type) !== -1) {
      bars(pptx, slide, q.options, r.counts, q.type === 'points' ? [] : (q.correct || []), box);
    } else if (q.type === 'dots') {
      dots(pptx, slide, r.items, box);
    } else if (q.type === 'scale') {
      gauge(pptx, slide, q, r, box);
    } else if (q.type === 'wordcloud') {
      cloud(slide, r.words, box);
    } else if (q.type === 'text') {
      bullets(slide, visible(r.texts).map(function (t) { return t.text; }), box);
    } else if (q.type === 'wall') {
      wall(pptx, slide, visible(r.posts), box);
    } else if (q.type === 'postit') {
      postits(pptx, slide, q, visible(r.posts), box);
    }
    var foot = post ? WL.plural(r.total, q.type === 'wall' ? 'message' : 'post-it')
      : r.total + ' / ' + d.participants + ' ont répondu';
    if (q.type === 'scale' && r.average !== null) foot += ' — moyenne ' + String(r.average).replace('.', ',') + ' / ' + q.scaleMax;
    var line = (d.recap || []).filter(function (x) { return x.text === q.text; })[0];
    if (line && q.correct && q.correct.length) foot += ' — ' + line.summary;
    if (r.compare) foot += ' — ' + WL.compareText(r.compare);
    if (q.explain) {
      // Encadré comme sur la projection : carte claire, filet vert à gauche.
      text(slide, q.explain, { x: 0.5, y: 5.5, w: W - 1, h: 1.2, fontSize: 15, fit: 'shrink', fill: { color: C.carte }, margin: 10,
        line: { color: C.bord, width: 1 } });
      slide.addShape(pptx.ShapeType.rect, { x: 0.5, y: 5.5, w: 0.08, h: 1.2, fill: { color: C.ok }, line: { color: C.ok, width: 0 } });
    }
    text(slide, foot, { x: 0.5, y: 6.85, w: W - 1, h: 0.4, fontSize: 13, color: C.doux });
  }

  function build(d) {
    var pptx = new window.PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.title = 'Bilan — ' + d.title;
    // Fond papier et bandeau terre en haut de chaque diapositive.
    pptx.defineSlideMaster({ title: 'WL', background: { color: C.fond },
      objects: [{ rect: { x: 0, y: 0, w: W, h: 0.12, fill: { color: C.primaire } } }] });
    var day = new Date().toLocaleDateString('fr-FR');

    var s = pptx.addSlide();
    s.background = { color: C.fond };
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.45, h: 7.5, fill: { color: C.primaire }, line: { color: C.primaire, width: 0 } });
    text(s, d.title, { x: 1.1, y: 2.3, w: W - 1.9, h: 1.4, fontSize: 40, bold: true, color: C.primaire, fontFace: TITRE, fit: 'shrink' });
    text(s, 'Bilan de l\'atelier — ' + day, { x: 1.1, y: 3.8, w: W - 1.9, h: 0.6, fontSize: 22 });
    text(s, WL.plural(d.participants, 'participant') + ' — ' + WL.plural(d.questions.length, 'question'), { x: 1.1, y: 4.5, w: W - 1.9, h: 0.5, fontSize: 18, color: C.doux });

    d.questions.forEach(function (q, i) { questionSlide(pptx, q, i, d); });

    if (d.recap && d.recap.length) {
      s = pptx.addSlide({ masterName: 'WL' });
      text(s, 'Ce qu\'on retient de l\'atelier', { x: 0.5, y: 0.3, w: W - 1, h: 0.7, fontSize: 28, bold: true, color: C.primaire, fontFace: TITRE });
      var rows = [[{ text: 'Question', options: { bold: true, fill: { color: C.entete } } }, { text: 'Résultat', options: { bold: true, fill: { color: C.entete } } }]]
        .concat(d.recap.map(function (x) { return [x.text, x.summary]; }));
      s.addTable(rows, { x: 0.5, y: 1.1, w: W - 1, colW: [7.6, 4.73], fontFace: FONT, fontSize: 12, color: C.texte,
        fill: { color: C.carte }, border: { type: 'solid', pt: 1, color: C.bord }, autoPage: true, autoPageRepeatHeader: true });
    }
    if (d.synthesis) {
      // Une diapositive par tranche de ~1200 caractères, coupée entre deux paragraphes.
      var parts = [], cur = '';
      d.synthesis.split(/\n\n+/).forEach(function (para) {
        if (cur && (cur + '\n\n' + para).length > 1200) { parts.push(cur); cur = para; } else { cur = cur ? cur + '\n\n' + para : para; }
      });
      if (cur) parts.push(cur);
      parts.forEach(function (part, k) {
        s = pptx.addSlide({ masterName: 'WL' });
        text(s, 'Synthèse et recommandations' + (parts.length > 1 ? ' (' + (k + 1) + '/' + parts.length + ')' : ''),
          { x: 0.5, y: 0.4, w: W - 1, h: 0.8, fontSize: 28, bold: true, color: C.primaire, fontFace: TITRE });
        text(s, part, { x: 0.5, y: 1.4, w: W - 1, h: 5.7, fontSize: 16, fit: 'shrink' });
      });
    }
    if (d.conclusion) {
      s = pptx.addSlide({ masterName: 'WL' });
      text(s, 'À retenir', { x: 0.5, y: 0.4, w: W - 1, h: 0.8, fontSize: 30, bold: true, color: C.primaire, fontFace: TITRE });
      // Même texte que la projection : « À retenir : » en tête retiré (c'est le titre).
      var concl = d.conclusion.replace(/^\s*(?:[àa]\s+)?retenir\s*:\s*/i, '');
      text(s, concl.charAt(0).toUpperCase() + concl.slice(1), { x: 0.8, y: 1.5, w: W - 1.6, h: 4.8, fontSize: 24, fit: 'shrink', valign: 'middle' });
    }
    var name = 'bilan-' + d.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.pptx';
    return pptx.writeFile({ fileName: name });
  }

  window.WLBilanPptx = function (src, d) { return load(src).then(function () { return build(d); }); };
}());
