/* Export du bilan en PowerPoint (.pptx) : une diapositive de titre, une par
 * question (graphique natif modifiable dans PowerPoint), le récap et la
 * conclusion. Généré dans le navigateur avec PptxGenJS (assets/pptxgen.bundle.js,
 * chargé seulement à l'export) : aucune donnée ne quitte l'ordinateur. */
'use strict';

(function () {
  var C = { texte: '1F2937', doux: '4B5563', primaire: '4338CA', ok: '16A34A', fond: 'F4F5F7', accent: '0F766E' };
  var FONT = 'Verdana';
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

  /** Barres horizontales : bonnes réponses en vert, les autres en indigo. */
  function bars(pptx, slide, labels, values, correct, box) {
    var good = values.map(function (v, i) { return correct.indexOf(i) !== -1 ? v : 0; });
    var other = values.map(function (v, i) { return correct.indexOf(i) !== -1 ? 0 : v; });
    var series = correct.length
      ? [{ name: 'Bonne réponse', labels: labels, values: good }, { name: 'Autres réponses', labels: labels, values: other }]
      : [{ name: 'Réponses', labels: labels, values: values }];
    slide.addChart(pptx.ChartType.bar, series, Object.assign({
      barDir: 'bar', barGrouping: correct.length ? 'stacked' : 'clustered', catAxisOrientation: 'maxMin',
      chartColors: correct.length ? [C.ok, C.primaire] : [C.primaire],
      showValue: true, dataLabelFormatCode: '#;;', dataLabelColor: 'FFFFFF', dataLabelFontSize: 14, dataLabelFontFace: FONT,
      catAxisLabelFontSize: 16, catAxisLabelFontFace: FONT, catAxisLabelColor: C.texte,
      valAxisHidden: true, valGridLine: { style: 'none' }, showLegend: correct.length > 0, legendPos: 'b', legendFontFace: FONT,
      valAxisMinVal: 0, valAxisMaxVal: Math.max(1, Math.max.apply(null, values))
    }, box));
  }

  function columnsChart(pptx, slide, labels, values, box) {
    slide.addChart(pptx.ChartType.bar, [{ name: 'Réponses', labels: labels, values: values }], Object.assign({
      barDir: 'col', chartColors: [C.primaire], showValue: true, dataLabelFormatCode: '#;;', dataLabelFontFace: FONT,
      catAxisLabelFontSize: 18, catAxisLabelFontFace: FONT, valAxisHidden: true, valGridLine: { style: 'none' },
      valAxisMinVal: 0, valAxisMaxVal: Math.max(1, Math.max.apply(null, values))
    }, box));
  }

  function bullets(slide, lines, box) {
    if (!lines.length) { text(slide, 'Aucune réponse.', Object.assign({ fontSize: 18, color: C.doux }, box)); return; }
    text(slide, lines.slice(0, 30).map(function (l) { return { text: l, options: { bullet: true, breakLine: true } }; }),
      Object.assign({ fontSize: 16, fit: 'shrink', paraSpaceAfter: 4 }, box));
  }

  /** Une diapositive par question. */
  function questionSlide(pptx, q, i, d) {
    var slide = pptx.addSlide();
    var r = q.results, post = q.type === 'wall' || q.type === 'postit';
    text(slide, 'Question ' + (i + 1) + ' / ' + d.questions.length + ' — ' + WL.typeLabel(q), { x: 0.5, y: 0.3, w: W - 1, h: 0.4, fontSize: 14, color: C.doux });
    text(slide, q.text, { x: 0.5, y: 0.7, w: W - 1, h: 1.1, fontSize: 24, bold: true, fit: 'shrink' });
    var h = q.explain ? 3.5 : 4.5, box = { x: 0.5, y: 1.9, w: W - 1, h: h };
    var visible = function (list) { return (list || []).filter(function (x) { return !x.hidden; }); };
    if (['yesno', 'truefalse', 'poll', 'mcq', 'points'].indexOf(q.type) !== -1) {
      bars(pptx, slide, q.options, r.counts, q.type === 'points' ? [] : (q.correct || []), box);
    } else if (q.type === 'dots') {
      bars(pptx, slide, r.items.map(function (it) { return it.text; }), r.items.map(function (it) { return it.n; }), [], box);
    } else if (q.type === 'scale') {
      columnsChart(pptx, slide, r.counts.map(function (_, n) { return String(n + 1); }), r.counts, box);
    } else if (q.type === 'wordcloud') {
      var max = r.words.reduce(function (m, w) { return Math.max(m, w.n); }, 1);
      text(slide, r.words.slice(0, 40).map(function (w) {
        return { text: w.text + '   ', options: { fontSize: Math.round(16 + 32 * w.n / max), bold: w.n === max, color: w.n === max ? C.primaire : C.texte } };
      }), Object.assign({ align: 'center', valign: 'middle', fit: 'shrink' }, box));
    } else if (q.type === 'text') {
      bullets(slide, visible(r.texts).map(function (t) { return t.text; }), box);
    } else if (q.type === 'wall') {
      bullets(slide, visible(r.posts).map(function (p) { return p.text + '  —  ♥ ' + p.likes; }), box);
    } else if (q.type === 'postit') {
      var cols = q.options.map(function (name, c) {
        var notes = visible(r.posts).filter(function (p) { return p.col === c && !p.parent; }).map(function (p) { return '• ' + p.text; });
        return { text: notes.join('\n') || '—', options: { fontSize: 14, valign: 'top', fill: { color: 'FFF7CC' } } };
      });
      slide.addTable([q.options.map(function (n) { return { text: n, options: { bold: true, fontSize: 16, fill: { color: 'E9EEF3' } } }; }), cols],
        Object.assign({ fontFace: FONT, color: C.texte, border: { type: 'solid', pt: 1, color: 'D1D5DB' }, autoPage: false, rowH: [0.5, box.h - 0.5] }, box));
    }
    var foot = post ? WL.plural(r.total, q.type === 'wall' ? 'message' : 'post-it')
      : r.total + ' / ' + d.participants + ' ont répondu';
    if (q.type === 'scale' && r.average !== null) foot += ' — moyenne ' + String(r.average).replace('.', ',') + ' / ' + q.scaleMax;
    var line = (d.recap || []).filter(function (x) { return x.text === q.text; })[0];
    if (line && q.correct && q.correct.length) foot += ' — ' + line.summary;
    if (q.explain) {
      text(slide, q.explain, { x: 0.5, y: 5.5, w: W - 1, h: 1.2, fontSize: 15, fit: 'shrink', fill: { color: C.fond }, margin: 8,
        line: { color: C.ok, width: 0 } });
    }
    text(slide, foot, { x: 0.5, y: 6.85, w: W - 1, h: 0.4, fontSize: 13, color: C.doux });
  }

  function build(d) {
    var pptx = new window.PptxGenJS();
    pptx.layout = 'LAYOUT_WIDE';
    pptx.title = 'Bilan — ' + d.title;
    var day = new Date().toLocaleDateString('fr-FR');

    var s = pptx.addSlide();
    s.background = { color: C.primaire };
    text(s, d.title, { x: 0.8, y: 2.3, w: W - 1.6, h: 1.4, fontSize: 40, bold: true, color: 'FFFFFF', fit: 'shrink' });
    text(s, 'Bilan de l\'atelier — ' + day, { x: 0.8, y: 3.8, w: W - 1.6, h: 0.6, fontSize: 22, color: 'FFFFFF' });
    text(s, WL.plural(d.participants, 'participant') + ' — ' + WL.plural(d.questions.length, 'question'), { x: 0.8, y: 4.5, w: W - 1.6, h: 0.5, fontSize: 18, color: 'E0E7FF' });

    d.questions.forEach(function (q, i) { questionSlide(pptx, q, i, d); });

    if (d.recap && d.recap.length) {
      s = pptx.addSlide();
      text(s, 'Ce qu\'on retient de l\'atelier', { x: 0.5, y: 0.3, w: W - 1, h: 0.7, fontSize: 28, bold: true });
      var rows = [[{ text: 'Question', options: { bold: true, fill: { color: 'E9EEF3' } } }, { text: 'Résultat', options: { bold: true, fill: { color: 'E9EEF3' } } }]]
        .concat(d.recap.map(function (x) { return [x.text, x.summary]; }));
      s.addTable(rows, { x: 0.5, y: 1.1, w: W - 1, colW: [7.6, 4.73], fontFace: FONT, fontSize: 12, color: C.texte,
        border: { type: 'solid', pt: 1, color: 'D1D5DB' }, autoPage: true, autoPageRepeatHeader: true });
    }
    if (d.conclusion) {
      s = pptx.addSlide();
      text(s, 'Conclusion', { x: 0.5, y: 0.4, w: W - 1, h: 0.8, fontSize: 30, bold: true, color: C.primaire });
      text(s, d.conclusion, { x: 0.8, y: 1.5, w: W - 1.6, h: 4.8, fontSize: 24, fit: 'shrink', valign: 'middle' });
    }
    var name = 'bilan-' + d.title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.pptx';
    return pptx.writeFile({ fileName: name });
  }

  window.WLBilanPptx = function (src, d) { return load(src).then(function () { return build(d); }); };
}());
