/* Import assisté d'un PDF de questions (Mentimeter, Pix, autres outils). Le PDF et l'OCR restent dans le
 * navigateur ; seul un JSON pédagogique, reconstruit avec des champs autorisés,
 * rejoint ensuite l'import habituel. Jamais de code, lien ou consigne du PDF exécuté. */
(function () {
  'use strict';
  var $ = WL.$, el = WL.el;
  var vendor = new URL('vendor/mentimeter/', document.currentScript.src);
  var pdfLibrary, ocrLibrary, docTask, pdf, ocr, ocrPromise, renderTask;
  var pages = [], pageIndex = 0, generation = 0, loading = false, onReady;

  function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function fold(s) { return clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  function chromeText(s) {
    return /mentimeter|join at|menti\.com|use code|audience.s devices|slide image|^\d{4}\s+\d{4}$/.test(fold(s));
  }
  function resultText(s) {
    return /^[\d\s.,%+−–-]+$/.test(s) || /^\d+\s*(votes?|reponses?|participants?|responses?|points?)\b/i.test(fold(s));
  }

  // Coordonnées normalisées (0..1), identiques pour texte PDF et texte OCR.
  // Un titre de question ne provient jamais des mots placés au centre du graphe.
  function suggest(lines) {
    var mentimeter = lines.some(function (l) { return /mentimeter/i.test(l.text); });
    var usable = lines.filter(function (l) {
      return l.y >= 0.065 && l.y < 0.865 && l.x < 0.94 && !(mentimeter && l.x > 0.80 && l.y > 0.82)
        && !chromeText(l.text) && !resultText(l.text) && /[\p{L}]{2}/u.test(l.text);
    });
    var top = usable.filter(function (l) { return l.y < 0.34; }).sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    var title = top.length ? clean(top[0].text) : '';
    for (var i = 1; i < top.length && i < 4; i++) {
      if (top[i].y - top[i - 1].y > 0.055 || top[i].x > top[0].x + 0.12 || title.indexOf('?') !== -1) break;
      title += ' ' + clean(top[i].text);
    }
    var q = fold(title), isQuestion = /\?|^(quels?|quelles?|combien|comment|pourquoi|possede|as.tu|avez.vous|dis.moi|selon|sur une echelle|en un mot)\b/.test(q);
    if (!isQuestion && !mentimeter) {
      var other = usable.find(function (l) { return l.y < 0.72 && /\?/.test(l.text); });
      if (other) { title = clean(other.text); q = fold(title); isQuestion = true; }
    }
    var multi = /toutes les reponses|plusieurs|tout ce qui|toutes celles|qui s.appliquent/.test(q);
    var type = !isQuestion ? 'skip' : /en (quelques|un|trois|3) mots?|nuage|dis.moi en/.test(q) ? 'wordcloud' : 'text';
    // Les choix sont sous les graphes ou à côté d'une légende, jamais les mots
    // d'un nuage. Les chiffres seuls sont des résultats, pas des choix déduits.
    var candidates = [];
    if (isQuestion && type !== 'wordcloud') {
      var labelled = !mentimeter ? usable.filter(function (l) { return /^(?:[A-J][.)]|[☐□○◯])\s+/.test(clean(l.text)); }) : [];
      var chartChoices = mentimeter && lines.some(function (l) { return /\d\s*%/.test(l.text); });
      // Sans marque de choix ou légende chiffrée, du texte dans le corps peut
      // être une ancienne réponse libre : laisser les choix à saisir après lecture.
      candidates = (labelled.length >= 2 ? labelled : chartChoices ? usable.filter(function (l) { return l.y > 0.40; }) : []).map(function (l) {
        return { text: clean(l.text).replace(/^\s*\d+(?:[.,]\d+)?\s*%\s*/, '').replace(/^(?:[A-J][.)]|[☐□○◯])\s+/, ''), x: l.x, y: l.y, w: l.w, h: l.h };
      }).filter(function (l) { return l.text.length >= 2 && !resultText(l.text) && !chromeText(l.text) && l.text.length <= 160; });
    }
    var groups = [];
    candidates.sort(function (a, b) { return a.y - b.y || a.x - b.x; }).forEach(function (l) {
      var prev = groups.find(function (g) { return Math.abs(g.x - l.x) < 0.045 && l.y - g.end < Math.min(0.055, Math.max(g.h, l.h) * 1.6) && l.y > g.end + 0.005; });
      if (prev) { prev.text += ' ' + l.text; prev.end = l.y; }
      else groups.push({ text: l.text, x: l.x, y: l.y, h: l.h, end: l.y });
    });
    // Barres : même ligne de libellés ; légende : ordre de lecture vertical.
    groups.sort(function (a, b) { return Math.abs(a.y - b.y) < 0.055 ? a.x - b.x : a.y - b.y; });
    var options = groups.map(function (g) { return g.text; }).filter(function (s, n, all) { return all.indexOf(s) === n; });
    if (options.length >= 2 && options.length <= 10 && type !== 'wordcloud') type = multi ? 'mcq' : 'poll';
    if (options.length === 2 && fold(options[0]) === 'oui' && fold(options[1]) === 'non') type = 'yesno';
    if (options.length === 2 && fold(options[0]) === 'vrai' && fold(options[1]) === 'faux') type = 'truefalse';
    // Une question numérique à réponse libre ne devient pas un sondage dont
    // les choix seraient les nombres déjà répondus par l'ancien groupe.
    if (/tape.*(nombre|chiffre)|saisis.*(nombre|chiffre)/.test(q)) { type = 'text'; options = []; }
    return { type: type, text: title, options: options, multi: multi, scaleMax: 5, reviewed: false };
  }

  function question(entry, number) {
    if (!entry || entry.type === 'skip') return null;
    if (!entry.reviewed) throw new Error('Page ' + number + ' : cochez la confirmation après relecture, ou choisissez « Ne pas importer ».');
    var text = clean(entry.text), max = entry.type === 'conclusion' ? 600 : 200;
    if (!text || Array.from(text).length > max) throw new Error('Page ' + number + ' : un intitulé de 1 à ' + max + ' caractères est nécessaire.');
    var q = { type: entry.type, text: text };
    if (['poll', 'mcq'].indexOf(q.type) !== -1) {
      var options = entry.options.map(clean).filter(Boolean);
      if (options.length < 2 || options.length > 10 || options.some(function (s) { return Array.from(s).length > 80; })) {
        throw new Error('Page ' + number + ' : indiquez 2 à 10 choix, de 80 caractères au plus chacun.');
      }
      if (new Set(options.map(fold)).size !== options.length) throw new Error('Page ' + number + ' : deux choix sont identiques.');
      q.options = options;
      if (q.type === 'mcq') q.multi = !!entry.multi;
    }
    if (q.type === 'scale') q.scaleMax = entry.scaleMax === 10 ? 10 : 5;
    // Liste fermée : aucune réponse, statistique, correction, image, URL,
    // instruction ou attribut arbitraire issu du PDF ne peut passer ici.
    if (['poll', 'mcq', 'yesno', 'truefalse', 'wordcloud', 'text', 'scale', 'conclusion'].indexOf(q.type) === -1) throw new Error('Type de question inconnu.');
    return q;
  }

  function rawQuestions() {
    var list = [];
    pages.forEach(function (entry, n) {
      if (entry) entry.questions.forEach(function (q, i) {
        var item = question(q, (n + 1) + ', question ' + (i + 1));
        if (item) list.push(item);
      });
    });
    if (!list.some(function (q) { return q.type !== 'conclusion'; })) throw new Error('Gardez au moins une question relue.');
    if (list.filter(function (q) { return q.type === 'conclusion'; }).length > 1) throw new Error('Gardez une seule conclusion pour l’atelier.');
    if (list.length > 50) throw new Error('Gardez 50 éléments au plus, conclusion comprise.');
    var raw = JSON.stringify(list);
    if (new TextEncoder().encode(raw).length > 60000) throw new Error('Les questions dépassent 60 Ko : gardez moins de pages.');
    return raw;
  }

  function updateSummary() {
    var values = pages.reduce(function (all, p) { return p ? all.concat(p.questions) : all; }, []);
    var kept = values.filter(function (q) { return q.type !== 'skip'; }).length;
    var checked = values.filter(function (q) { return q.type !== 'skip' && q.reviewed; }).length;
    var unseen = pages.filter(function (p) { return !p; }).length;
    $('menti-summary').textContent = kept + ' question(s) retenue(s), dont ' + checked + ' relue(s)' + (unseen ? ' · ' + unseen + ' page(s) non examinée(s), non importée(s).' : '.');
    var valid = false;
    try { rawQuestions(); valid = true; } catch (_) {}
    $('menti-continue').disabled = loading || !valid;
    $('menti-prev').disabled = loading || pageIndex === 0;
    $('menti-next').disabled = loading || pageIndex === pages.length - 1;
    $('menti-page').disabled = loading;
    $('menti-fields').disabled = loading || !pages[pageIndex];
  }

  function syncFields() {
    var type = $('menti-type').value;
    WL.show($('menti-question-fields'), type !== 'skip');
    WL.show($('menti-options-box'), type === 'poll' || type === 'mcq');
    WL.show($('menti-multi-box'), type === 'mcq');
    WL.show($('menti-scale-box'), type === 'scale');
    $('menti-text').maxLength = type === 'conclusion' ? 600 : 200;
    $('menti-text').previousElementSibling.textContent = type === 'conclusion' ? 'Conclusion (600 caractères au plus)' : 'Intitulé de la question (200 caractères au plus)';
  }

  function remember(event) {
    var entry = pages[pageIndex];
    if (!entry || loading) return;
    if (event && event.target.id !== 'menti-reviewed') $('menti-reviewed').checked = false;
    entry.value = {
      type: $('menti-type').value, text: $('menti-text').value,
      options: $('menti-options').value.split('\n').map(clean).filter(Boolean),
      multi: $('menti-multi').checked, scaleMax: Number($('menti-scale').value), reviewed: $('menti-reviewed').checked
    };
    syncFields();
    $('menti-error').textContent = '';
    if ($('menti-reviewed').checked && entry.value.type !== 'skip') {
      try { question(entry.value, pageIndex + 1); } catch (e) { $('menti-error').textContent = e.message; }
    }
    updateSummary();
  }

  function renderFields(entry) {
    WL.clear($('menti-question'));
    entry.questions.forEach(function (q, i) {
      $('menti-question').appendChild(el('option', { value: i }, 'Question ' + (i + 1) + (q.type === 'skip' ? ' — écartée' : '')));
    });
    $('menti-question').value = String(entry.selected);
    $('menti-type').value = entry.value.type;
    $('menti-text').value = entry.value.text;
    $('menti-options').value = entry.value.options.join('\n');
    $('menti-multi').checked = entry.value.multi;
    $('menti-scale').value = String(entry.value.scaleMax);
    $('menti-reviewed').checked = entry.value.reviewed;
    $('menti-recognized').textContent = entry.lines.map(function (l) { return l.text; }).join('\n');
    syncFields();
  }

  function loadPdf() {
    if (!pdfLibrary) pdfLibrary = import(new URL('pdfjs/pdf.mjs', vendor).href).then(function (lib) {
      lib.GlobalWorkerOptions.workerSrc = new URL('../../../import-worker.php?engine=pdf&v=6.4.299', vendor).href;
      return lib;
    }).catch(function (e) { pdfLibrary = null; throw e; });
    return pdfLibrary;
  }

  function loadOcr() {
    if (!ocrLibrary) ocrLibrary = new Promise(function (resolve, reject) {
      var script = el('script', { src: new URL('tesseract/dist/tesseract.min.js', vendor).href });
      script.onload = function () { resolve(window.Tesseract); };
      script.onerror = function () { script.remove(); ocrLibrary = null; reject(new Error('Le module de reconnaissance est indisponible. Rechargez la page.')); };
      document.head.appendChild(script);
    });
    return ocrLibrary;
  }

  async function getOcr(token) {
    if (!ocrPromise) ocrPromise = loadOcr().then(function (lib) {
      if (token !== generation) throw new Error('Import annulé.');
      return lib.createWorker('fra', 1, {
        workerPath: new URL('../../../import-worker.php?engine=ocr&v=7.0.0', vendor).href,
        corePath: new URL('core/tesseract-core-lstm.wasm.js', vendor).href,
        langPath: new URL('lang/', vendor).href.replace(/\/$/, ''),
        workerBlobURL: false, cacheMethod: 'none', gzip: true,
        logger: function (m) {
          if (token === generation && m.status === 'recognizing text') $('menti-status').textContent = 'Reconnaissance de la page ' + (pageIndex + 1) + '… ' + Math.round(m.progress * 100) + ' %';
        }
      }).then(function (w) {
        if (token !== generation) { w.terminate(); throw new Error('Import annulé.'); }
        ocr = w;
        return w;
      });
    });
    return ocrPromise;
  }

  function ocrLines(data, width, height) {
    var lines = [];
    (data.blocks || []).forEach(function (b) { (b.paragraphs || []).forEach(function (p) { (p.lines || []).forEach(function (l) {
      var box = l.bbox;
      if (box) lines.push({ text: clean(l.text || (l.words || []).map(function (w) { return w.text; }).join(' ')), x: box.x0 / width, y: box.y0 / height, w: (box.x1 - box.x0) / width, h: (box.y1 - box.y0) / height });
    }); }); });
    return lines;
  }

  // Des graphes Mentimeter alignent les libellés sous des barres. Une ligne
  // d'OCR peut alors fusionner plusieurs choix : relire chaque colonne séparément,
  // sans jamais utiliser les valeurs du graphe comme choix ou comme correction.
  async function barLabels(data, canvas, worker, token) {
    var anchors = [];
    (data.blocks || []).forEach(function (b) { (b.paragraphs || []).forEach(function (p) { (p.lines || []).forEach(function (l) { (l.words || []).forEach(function (w) {
      if (/^\d+[.,]?\d*%$/.test(w.text.replace(/\s/g, '')) && w.bbox.y0 / canvas.height > 0.22 && w.bbox.y0 / canvas.height < 0.79) {
        anchors.push({ x: w.bbox.x0 / canvas.width, y: w.bbox.y0 / canvas.height });
      }
    }); }); }); });
    anchors.sort(function (a, b) { return a.x - b.x; });
    anchors = anchors.filter(function (a, i, all) { return !i || a.x - all[i - 1].x > 0.05; });
    if (anchors.length < 3 || anchors.length > 10 || anchors.at(-1).x - anchors[0].x < 0.4) return null;
    var gaps = anchors.slice(1).map(function (a, i) { return a.x - anchors[i].x; });
    if (Math.max.apply(null, gaps) / Math.min.apply(null, gaps) > 1.5) return null;
    // La reconnaissance par colonnes n'est proposée que pour cette disposition
    // caractéristique (marges et libellés bas). Les autres PDF restent éditables.
    var result = [], step = gaps.reduce(function (a, b) { return a + b; }, 0) / gaps.length;
    await worker.setParameters({ tessedit_pageseg_mode: '6' });
    for (var i = 0; i < anchors.length; i++) {
      if (token !== generation) return null;
      var left = Math.max(0, anchors[i].x - step * 0.08), right = Math.min(0.95, left + step * 0.98);
      var crop = document.createElement('canvas');
      crop.width = Math.ceil((right - left) * canvas.width * 2);
      crop.height = Math.ceil(canvas.height * 0.11 * 2);
      crop.getContext('2d').drawImage(canvas, left * canvas.width, canvas.height * 0.755,
        (right - left) * canvas.width, canvas.height * 0.11, 0, 0, crop.width, crop.height);
      var found = await worker.recognize(crop, {}, { text: true });
      crop.width = crop.height = 0;
      var label = clean(found.data.text).replace(/^[©®●•\s]+/, '');
      if (label && /[\p{L}]{2}/u.test(label)) result.push({ text: label, x: left, y: 0.80, w: right - left, h: 0.04 });
    }
    return result.length >= 2 ? result : null;
  }

  function textLines(content, viewport) {
    var rows = [];
    content.items.forEach(function (item) {
      if (!clean(item.str)) return;
      var point = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
      var h = Math.abs(item.height) * viewport.scale / viewport.height;
      var line = { text: item.str, x: point[0] / viewport.width, y: point[1] / viewport.height - h, w: item.width * viewport.scale / viewport.width, h: h };
      var row = rows.find(function (r) { return Math.abs(r.y - line.y) < 0.009 && Math.abs(r.x + r.w - line.x) < 0.05; });
      if (row) { row.text += ' ' + item.str; row.w = line.x + line.w - row.x; }
      else rows.push(line);
    });
    return rows.sort(function (a, b) { return a.y - b.y || a.x - b.x; });
  }

  async function showPage(index) {
    var token = generation;
    loading = true; pageIndex = index;
    $('menti-page').value = String(index);
    $('menti-error').textContent = '';
    $('menti-status').textContent = 'Lecture de la page ' + (index + 1) + '…';
    updateSummary();
    try {
      var page = await pdf.getPage(index + 1);
      if (token !== generation) return;
      var normal = page.getViewport({ scale: 1 });
      var viewport = page.getViewport({ scale: Math.min(2.6, 1800 / Math.max(normal.width, normal.height)) });
      var canvas = $('menti-canvas');
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      renderTask = page.render({ canvasContext: canvas.getContext('2d', { willReadFrequently: true }), viewport: viewport });
      await renderTask.promise;
      renderTask = null;
      if (!pages[index]) {
        var content = await page.getTextContent();
        if (token !== generation) return;
        var lines = textLines(content, viewport), method = 'Texte du PDF';
        if (lines.map(function (l) { return l.text; }).join('').length < 30) {
          $('menti-status').textContent = 'Préparation de la reconnaissance de texte… Le premier chargement peut prendre un moment.';
          var worker = await getOcr(token);
          if (token !== generation) return;
          await worker.setParameters({ tessedit_pageseg_mode: '11', user_defined_dpi: '300' });
          var result = await worker.recognize(canvas, {}, { blocks: true, text: true });
          if (token !== generation) return;
          lines = ocrLines(result.data, canvas.width, canvas.height);
          if (lines.some(function (l) { return /mentimeter/i.test(l.text); })) {
            var labels = await barLabels(result.data, canvas, worker, token);
            if (token !== generation) return;
            if (labels) lines = lines.filter(function (l) { return l.y < 0.755; }).concat(labels);
          }
          method = 'Reconnaissance de texte';
        }
        var entry = { lines: lines, questions: [suggest(lines)], selected: 0, method: method };
        Object.defineProperty(entry, 'value', {
          get: function () { return this.questions[this.selected]; },
          set: function (value) { this.questions[this.selected] = value; }
        });
        pages[index] = entry;
      }
      renderFields(pages[index]);
      $('menti-status').textContent = pages[index].method + ' · Page ' + (index + 1) + ' sur ' + pages.length + ' : à comparer avec l’original.';
      page.cleanup();
    } catch (e) {
      if (token === generation) $('menti-error').textContent = 'Cette page n’a pas pu être lue. ' + (e && e.message || 'Essayez un autre export PDF.');
    } finally {
      if (token === generation) { loading = false; updateSummary(); }
    }
  }

  function dispose() {
    generation++;
    if (renderTask) { renderTask.cancel(); renderTask = null; }
    if (docTask) { docTask.destroy().catch(function () {}); docTask = null; }
    if (ocr) { ocr.terminate(); ocr = null; }
    ocrPromise = null; pdf = null; pages = []; loading = false;
    var canvas = $('menti-canvas'); canvas.width = canvas.height = 0;
    $('menti-recognized').textContent = '';
    $('menti-text').value = $('menti-options').value = $('menti-file').value = '';
  }

  $('menti-file').addEventListener('change', async function () {
    var file = this.files[0];
    if (!file) return;
    dispose();
    var token = generation;
    WL.show($('menti-review'), false);
    $('menti-error').textContent = '';
    $('menti-status').textContent = '';
    $('menti-continue').disabled = true;
    if (file.size > 20 * 1024 * 1024 || !/\.pdf$/i.test(file.name)) { $('menti-error').textContent = 'Choisissez un fichier PDF de 20 Mo au plus.'; return; }
    try {
      $('menti-status').textContent = 'Ouverture du PDF sur cet appareil…';
      var bytes = new Uint8Array(await file.arrayBuffer());
      if (new TextDecoder().decode(bytes.slice(0, 1024)).indexOf('%PDF-') === -1) throw new Error('Ce fichier n’est pas un PDF reconnu.');
      var lib = await loadPdf();
      if (token !== generation) return;
      docTask = lib.getDocument({ data: bytes, isEvalSupported: false, disableFontFace: true,
        enableXfa: false, useWasm: false, isOffscreenCanvasSupported: false,
        maxImageSize: 20000000, stopAtErrors: true,
        cMapUrl: new URL('pdfjs/cmaps/', vendor).href, cMapPacked: true,
        standardFontDataUrl: new URL('pdfjs/standard_fonts/', vendor).href });
      // Aucun dialogue de mot de passe et aucune exécution d'action ou pièce jointe du PDF.
      docTask.onPassword = function () { if (token === generation) { $('menti-error').textContent = 'Ce PDF est protégé par un mot de passe. Exportez une copie non protégée.'; $('menti-status').textContent = ''; dispose(); } };
      pdf = await docTask.promise;
      if (token !== generation) return;
      if (pdf.numPages > 50) throw new Error('Ce PDF dépasse 50 pages. Exportez une sélection plus courte.');
      pages = Array.from({ length: pdf.numPages }, function () { return null; });
      WL.clear($('menti-page'));
      pages.forEach(function (_, i) { $('menti-page').appendChild(el('option', { value: i }, (i + 1) + ' / ' + pages.length)); });
      WL.show($('menti-review'), true);
      await showPage(0);
    } catch (e) {
      if (token === generation) { $('menti-error').textContent = e && e.message || 'PDF illisible. Essayez un autre export de votre questionnaire.'; $('menti-status').textContent = ''; }
    }
  });

  $('menti-fields').addEventListener('input', function (event) { if (event.target.id !== 'menti-question') remember(event); });
  $('menti-fields').addEventListener('change', function (event) { if (event.target.id !== 'menti-question') remember(event); });
  $('menti-question').addEventListener('change', function () {
    var entry = pages[pageIndex];
    if (!entry || loading) return;
    entry.selected = Number(this.value); renderFields(entry); updateSummary();
  });
  $('menti-add').addEventListener('click', function () {
    var entry = pages[pageIndex];
    if (!entry || loading) return;
    entry.questions.push({ type: 'text', text: '', options: [], multi: false, scaleMax: 5, reviewed: false });
    entry.selected = entry.questions.length - 1;
    renderFields(entry); updateSummary(); $('menti-text').focus();
  });
  $('menti-prev').addEventListener('click', function () { if (!loading && pageIndex > 0) showPage(pageIndex - 1); });
  $('menti-next').addEventListener('click', function () { if (!loading && pageIndex < pages.length - 1) showPage(pageIndex + 1); });
  $('menti-page').addEventListener('change', function () { if (!loading) showPage(Number(this.value)); });
  $('menti-cancel').addEventListener('click', function () { $('menti-dialog').close(); });
  $('menti-dialog').addEventListener('close', dispose);
  $('menti-form').addEventListener('submit', function (event) {
    event.preventDefault();
    if (loading) return;
    try {
      var raw = rawQuestions(), unseen = pages.filter(function (p) { return !p; }).length;
      if (unseen && !confirm(unseen + ' page(s) n’ont pas été examinée(s) et ne seront pas importée(s). Continuer avec les questions relues ?')) return;
      $('menti-dialog').close();
      onReady(raw);
    } catch (e) { $('menti-error').textContent = e.message; }
  });
  WL.Mentimeter = {
    open: function (title, ready) {
      dispose(); onReady = ready;
      $('menti-for').textContent = 'Nouvel atelier « ' + title + ' » : choisissez le PDF, puis les pages à transformer en questions. Fermer ne crée rien.';
      $('menti-error').textContent = $('menti-status').textContent = '';
      WL.show($('menti-review'), false);
      $('menti-continue').disabled = true;
      $('menti-dialog').showModal(); $('menti-file').focus();
    },
    // Fonctions pures, également utilisées par les contrôles sur des exemples fictifs.
    suggest: suggest, question: question
  };
}());
