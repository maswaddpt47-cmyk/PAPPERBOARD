(function (root) {
  'use strict';

  var MAX_BYTES = 60 * 1024;
  var TYPES = ['poll', 'mcq', 'yesno', 'truefalse', 'scale', 'steps', 'text', 'wordcloud'];
  var TYPE_NAMES = { poll: 'Sondage', mcq: 'QCM', yesno: 'Oui / Non', truefalse: 'Vrai / Faux', scale: 'Échelle', steps: 'Défi à étapes', text: 'Réponse libre', wordcloud: 'Nuage de mots' };
  var has = function (object, key) { return Object.prototype.hasOwnProperty.call(object, key); };

  function bytes(text) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
    try { return encodeURIComponent(text).replace(/%[A-F\d]{2}/gi, 'x').length; } catch (error) { return MAX_BYTES + 1; }
  }
  function string(value, label, max, optional) {
    if (value == null && optional) return '';
    if (typeof value !== 'string') throw new Error(label + ' doit être un texte.');
    var clean = value.trim();
    if (!clean && !optional) throw new Error(label + ' est obligatoire.');
    if (clean.length > max) throw new Error(label + ' : ' + max + ' caractères maximum.');
    return clean;
  }
  function stringList(value, label, min, max) {
    if (!Array.isArray(value) || value.length < min || value.length > max) throw new Error(label + ' : de ' + min + ' à ' + max + ' éléments sont attendus.');
    var list = value.map(function (entry, index) { return string(entry, label + ' n° ' + (index + 1), 160); });
    if (new Set(list.map(function (entry) { return entry.toLocaleLowerCase('fr'); })).size !== list.length) throw new Error(label + ' contient des doublons.');
    return list;
  }
  function balancedJSON(source) {
    var start = source.search(/[\[{]/);
    if (start < 0) throw new Error('Aucune liste JSON trouvée. Collez la réponse de l’IA ou le contenu du fichier.');
    var stack = [], quoted = false, escaped = false;
    for (var index = start; index < source.length; index++) {
      var character = source[index];
      if (quoted) { if (escaped) escaped = false; else if (character === '\\') escaped = true; else if (character === '"') quoted = false; continue; }
      if (character === '"') quoted = true;
      else if (character === '[' || character === '{') stack.push(character);
      else if (character === ']' || character === '}') {
        if (!stack.length || (character === ']' ? '[' : '{') !== stack.pop()) throw new Error('Le JSON est incomplet ou mal formé. Vérifiez les crochets et les virgules.');
        if (!stack.length) return source.slice(start, index + 1);
      }
    }
    throw new Error('Le JSON est incomplet. Il manque une fin de liste ou d’objet.');
  }
  function decode(raw) {
    var clean = raw.replace(/^\uFEFF/, '').trim();
    if (!clean) throw new Error('Collez une réponse ou chargez un fichier avant de vérifier.');
    try { return JSON.parse(clean); } catch (error) { /* An AI answer may have prose or a Markdown fence. */ }
    var fence = clean.match(/```(?:json)?\s*([\s\S]*?)```/i);
    var candidate = balancedJSON(fence ? fence[1] : clean);
    try { return JSON.parse(candidate); } catch (error) { throw new Error('JSON invalide : vérifiez les guillemets et les virgules. Le texte n’est jamais exécuté.'); }
  }
  function safeLink(value) {
    var link = string(value, 'Le lien', 300, true);
    if (!link) return '';
    var parsed;
    try { parsed = new URL(link); } catch (error) { throw new Error('Le lien doit être une adresse HTTPS complète.'); }
    var hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
    var labels = hostname.split('.');
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || /^https:\/\/[^/?#]*@/i.test(link) || hostname.indexOf(':') !== -1 || /^\d+(?:\.\d+){3}$/.test(hostname) || labels.length < 2 || labels.some(function (label) { return !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label); }) || /(?:^|\.)localhost$/.test(hostname)) throw new Error('Le lien doit utiliser HTTPS et un nom de domaine, sans identifiant, mot de passe ni adresse IP.');
    return parsed.href;
  }
  function variants(value, options) {
    if (value == null) return [];
    var list;
    if (Array.isArray(value)) list = value;
    else if (typeof value === 'object') list = Object.keys(value).map(function (name) { return { name: name, steps: value[name] }; });
    else throw new Error('Les variantes doivent être un objet par appareil ou une liste de variantes.');
    if (!list.length) return [];
    if (list.length < 2 || list.length > 4) throw new Error('Un défi comporte de 2 à 4 variantes par appareil.');
    var names = new Set();
    return list.map(function (entry) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Chaque variante doit contenir un nom et une liste d’étapes.');
      var name = string(entry.name, 'Le nom de la variante', 20);
      if (names.has(name.toLocaleLowerCase('fr'))) throw new Error('Les noms des variantes doivent être différents.');
      names.add(name.toLocaleLowerCase('fr'));
      if (!Array.isArray(entry.steps) || entry.steps.length !== options.length) throw new Error('La variante « ' + name + ' » doit contenir exactement ' + options.length + ' étapes.');
      return { name: name, steps: entry.steps.map(function (step, index) { return string(step, 'Étape ' + (index + 1) + ' de « ' + name + ' »', 160); }) };
    });
  }
  function question(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Chaque élément doit être un objet question.');
    var type = typeof entry.type === 'string' ? entry.type.trim().toLowerCase() : '';
    var title = string(has(entry, 'text') ? entry.text : entry.title, type === 'conclusion' ? 'La conclusion' : 'L’intitulé', type === 'conclusion' ? 600 : 240);
    if (type === 'conclusion') return { conclusion: title };
    if (TYPES.indexOf(type) === -1) throw new Error('Type non pris en charge : « ' + (type || 'non renseigné') + ' ».');
    if (entry.multi !== undefined && typeof entry.multi !== 'boolean') throw new Error('Le champ multi doit valoir true ou false.');
    if (entry.multi === true && type !== 'mcq') throw new Error('Le champ multi est réservé aux QCM.');
    var multiple = entry.multi === true;
    var warnings = [], options = [];
    if (type === 'yesno' || type === 'truefalse') {
      options = type === 'yesno' ? ['Oui', 'Non'] : ['Vrai', 'Faux'];
      if (entry.options != null && (!Array.isArray(entry.options) || entry.options.length !== 2 || entry.options.some(function (option, index) { return typeof option !== 'string' || option.trim().toLocaleLowerCase('fr') !== options[index].toLocaleLowerCase('fr'); }))) throw new Error('Les choix de ce type sont ' + options.join(' / ') + ', dans cet ordre.');
    } else if (type === 'scale') {
      if (entry.scaleMax != null && typeof entry.scaleMax !== 'number' && typeof entry.scaleMax !== 'string') throw new Error('Le maximum de l’échelle doit être le nombre 5 ou 10.');
      var maximum = entry.scaleMax == null ? (Array.isArray(entry.options) && entry.options.length === 10 ? 10 : 5) : Number(entry.scaleMax);
      if (maximum !== 5 && maximum !== 10) throw new Error('Seules les échelles de 1 à 5 ou de 1 à 10 sont prises en charge.');
      options = Array.from({ length: maximum }, function (_, index) { return String(index + 1); });
      if (entry.options != null && (!Array.isArray(entry.options) || entry.options.length !== maximum || entry.options.some(function (option, index) { return option !== options[index]; }))) throw new Error('Les choix de l’échelle doivent être les textes « 1 » à « ' + maximum + ' ».');
    } else if (type === 'text' || type === 'wordcloud') {
      if (entry.options != null && (!Array.isArray(entry.options) || entry.options.length)) throw new Error('Une réponse libre ou un nuage de mots ne doit pas contenir de choix.');
    } else options = stringList(type === 'steps' && entry.options == null ? entry.steps : entry.options, type === 'steps' ? 'Les étapes' : 'Les choix', type === 'steps' ? 1 : 2, 10);
    var description = string(entry.description == null ? entry.context : entry.description, 'Le contexte', 400, true);
    var explanations = [];
    ['explain', 'explanation', 'notes'].forEach(function (key) { if (entry[key] != null) { var part = string(entry[key], 'L’explication', 600, true); if (part && explanations.indexOf(part) === -1) explanations.push(part); } });
    var explanation = string(explanations.join('\n'), 'L’explication', 600, true);
    var q = { type: type, title: title, description: description, options: options, counts: options.map(function () { return 0; }), responses: 0, state: 'draft', published: false, texts: [] };
    if (multiple) q.multi = true;
    if (explanation) q.explanation = explanation;
    var correct = entry.correct;
    var hasCorrect = correct !== undefined && correct !== null && correct !== '';
    if (hasCorrect) {
      if (['mcq', 'yesno', 'truefalse'].indexOf(type) === -1) throw new Error('Ce type de question ne prévoit pas de bonne réponse. Utilisez un QCM pour un quiz.');
      var values = multiple ? correct : [correct];
      if (!Array.isArray(values)) values = [values];
      var indexes = values.map(function (value) {
        if (typeof value === 'number' && (has(entry, 'title') || has(entry, 'text'))) return value;
        if (typeof value === 'string') return options.indexOf(value.trim());
        return -1;
      });
      if (!indexes.length || indexes.some(function (index) { return !Number.isInteger(index) || index < 0 || index >= options.length; }) || new Set(indexes).size !== indexes.length || (multiple ? indexes.length < 2 : indexes.length !== 1)) throw new Error(multiple ? 'Indiquez au moins deux bonnes réponses distinctes, par leur texte exact.' : 'La bonne réponse ne correspond à aucun choix. Utilisez son texte exact.');
      q.correct = multiple ? indexes : indexes[0];
    } else if (type === 'mcq') throw new Error('Ce QCM doit indiquer une bonne réponse par son texte. Pour une question sans correction, utilisez le type poll.');
    if (type === 'scale') q.scaleMax = options.length;
    var normalizedVariants = variants(entry.variants, options);
    if (normalizedVariants.length) { if (type !== 'steps') throw new Error('Les variantes par appareil sont réservées aux défis à étapes.'); q.variants = normalizedVariants; }
    if (entry.link != null && entry.link !== '') q.link = safeLink(entry.link);
    if (has(entry, 'compare') && entry.compare !== '' && entry.compare != null) warnings.push('La comparaison avant / après n’est pas reprise : ses agrégats ne sont pas disponibles dans ce prototype.');
    if (['duration', 'reveal', 'allowChange', 'live'].some(function (key) { return has(entry, key); })) warnings.push('Les réglages de durée et de correction automatique ne sont pas repris dans cet essai.');
    if (has(entry, 'responses') || has(entry, 'answers') || has(entry, 'results')) warnings.push('Seule la question est importée ; ses réponses et résultats repartent de zéro.');
    return { q: q, warning: warnings.join(' ') || undefined };
  }

  // Public contract: array of {index, q?, conclusion?, error?, warning?, selected}.
  // Parsed questions have no id; create().commitImport assigns fresh ids atomically.
  function parseImport(raw) {
    try {
      if (typeof raw !== 'string') throw new Error('Le contenu à importer doit être du texte JSON.');
      if (bytes(raw) > MAX_BYTES) throw new Error('Le contenu dépasse 60 Ko. Réduisez le fichier ou la réponse.');
      var decoded = decode(raw), list;
      if (Array.isArray(decoded)) list = decoded;
      else if (decoded && typeof decoded === 'object' && Array.isArray(decoded.questions)) {
        list = decoded.questions.slice();
        if (has(decoded, 'conclusion') && decoded.conclusion !== '') list.push({ type: 'conclusion', text: decoded.conclusion });
      } else if (decoded && typeof decoded === 'object' && has(decoded, 'type')) list = [decoded];
      else throw new Error('Le JSON doit contenir une liste de questions ou un objet avec une liste questions.');
      if (!list.length) throw new Error('La liste est vide : ajoutez au moins une question ou une conclusion.');
      if (list.length > 50) throw new Error('Une importation est limitée à 50 éléments, conclusion comprise.');
      var seenConclusion = false;
      return list.map(function (entry, index) {
        var name = entry && typeof entry === 'object' ? entry.text || entry.title : '';
        var item = { index: index, title: typeof name === 'string' ? name : 'Élément ' + (index + 1), selected: false };
        try {
          var parsed = question(entry);
          if (parsed.conclusion !== undefined) { if (seenConclusion) throw new Error('Une seule conclusion peut être conservée par importation.'); seenConclusion = true; item.conclusion = parsed.conclusion; }
          else item.q = parsed.q;
          if (parsed.warning) item.warning = parsed.warning;
          item.selected = true;
        } catch (error) { item.error = error.message; }
        return item;
      });
    } catch (error) { return [{ index: 0, title: 'Importation impossible', error: error.message, selected: false }]; }
  }

  function buildPrompt(settings) {
    var value = settings || {};
    var theme = typeof value.theme === 'string' && value.theme.trim() ? value.theme.trim().slice(0, 200) : 'Les bons réflexes du numérique';
    var audience = typeof value.audience === 'string' ? value.audience.trim().slice(0, 160) : 'tout public';
    var count = Math.max(1, Math.min(30, Math.round(Number(value.count) || 10)));
    return [
      'Tu aides un animateur à préparer un atelier participatif WoocLight.',
      'Thème : ' + theme + '.', 'Public : ' + (audience || 'tout public') + '.',
      'Rédige exactement ' + count + ' question' + (count > 1 ? 's' : '') + ' progressive' + (count > 1 ? 's' : '') + ', en français clair et adapté au public.',
      value.quizOnly ? 'Les questions demandées sont uniquement des quiz : mcq, yesno ou truefalse. Pour les QCM, ' + (value.multiQuiz ? 'certaines questions peuvent avoir plusieurs bonnes réponses.' : 'chaque question doit avoir UNE seule bonne réponse.') : 'Varie les types adaptés : poll, mcq, yesno, truefalse, scale, text, wordcloud et steps.',
      value.challenge ? 'Ajoute ensuite UN défi pratique de type steps, en plus des questions demandées. Si les gestes diffèrent selon l’appareil, fournis 2 à 4 variantes (Windows, Mac, iPhone, Android), avec le même nombre d’étapes.' : value.quizOnly ? 'N’ajoute pas de défi : conserve uniquement les quiz demandés.' : 'Un défi steps peut être utilisé parmi les questions si cela aide l’apprentissage.',
      'Termine par UN élément {"type":"conclusion","text":"…"} de 600 caractères maximum, directement adressé aux participants.',
      'Réponds UNIQUEMENT par un tableau JSON valide, sans prose ni balises Markdown.',
      'Format compatible PAPPERBOARD : type, text (200 caractères max), options, correct PAR LE TEXTE EXACT du choix, explain (400 caractères max), variants et link facultatifs.',
      'Types autorisés : poll, mcq, yesno, truefalse, scale, steps, text, wordcloud. Aucun type wall, postit, dots ou points.',
      'mcq : 2 à 10 choix, correct contient le texte exact d’une ou plusieurs bonnes réponses ; multi vaut ' + (value.multiQuiz ? 'true si plusieurs choix sont corrects, false sinon' : 'false (une seule bonne réponse)') + '.',
      'yesno : les choix sont Oui / Non ; truefalse : Vrai / Faux. correct reprend exactement un de ces textes. Pas besoin de fournir options pour ces deux types.',
      'poll : 2 à 10 choix, sans correct. scale : scaleMax vaut 5 ou 10, sans correct. text et wordcloud : ni options ni correct.',
      'steps : options contient 1 à 10 titres d’étapes. Si variants est présent, utilise {"Windows":["étape…"],"Mac":["étape…"]}, de 2 à 4 appareils (noms de 20 caractères max), exactement autant d’étapes que dans options.',
      'Chaque choix et chaque étape est une chaîne de 160 caractères maximum. Le contexte facultatif description fait 400 caractères maximum.',
      'Un lien d’exercice link est facultatif : adresse HTTPS complète d’un domaine, sans identifiant ni adresse IP. Ne crée pas de lien inventé.',
      'Explique les bonnes réponses dans explain. Pour toute affirmation factuelle, indique une source officielle identifiable dans ce texte ; si tu n’as pas de source sûre, signale-le. N’invente pas de référence.',
      'Ne demande aucun nom ni donnée personnelle. Ne suppose pas qu’une réponse écrite est anonyme si elle contient un nom.',
      'Exemple de syntaxe : [{"type":"mcq","text":"Quel est le bon réflexe ?","options":["Agir dans l’urgence","Vérifier par un autre moyen"],"correct":"Vérifier par un autre moyen","multi":false,"explain":"Prenez le temps de vérifier l’expéditeur."},{"type":"conclusion","text":"Avant de cliquer, prenez le temps de vérifier."}]',
      'Le contenu sera relu et corrigé par l’animateur avant utilisation.'
    ].join('\n');
  }

  function create(hooks) {
    var doc = root.document;
    var previewItems = null, verifiedRaw = null, revision = 0, opening = 0;
    var esc = hooks.esc, icon = hooks.icon, button = hooks.button;
    function element(id) { return doc && doc.getElementById(id); }
    function announce(message) { var target = element('prep-source-status'); if (target) target.textContent = message; }
    function invalidate(message) {
      revision++; previewItems = null; verifiedRaw = null;
      var preview = element('prep-preview'); if (preview) { preview.innerHTML = ''; preview.hidden = true; }
      var commit = element('prep-commit'); if (commit) commit.disabled = true;
      announce(message || 'Le contenu a changé. Vérifiez-le pour afficher un nouvel aperçu.');
    }
    function open() {
      opening++; previewItems = null; verifiedRaw = null; revision++;
      var state = hooks.getState();
      var body = '<div class="generator-grid"><section class="generator-section"><div class="generator-step"><span class="number-bubble">1</span><div><h3>Préparer une consigne pour une IA</h3><p class="muted">Facultatif si vous avez déjà un fichier à importer.</p></div></div><p class="generator-note">Aucun appel à une IA n’est effectué ici. Copiez la consigne dans l’outil de votre choix, puis revenez avec sa réponse. N’y mettez aucune donnée personnelle.</p><div class="form-field"><label class="field-label" for="prep-theme">Thème de l’atelier</label><input class="input" id="prep-theme" maxlength="200" value="' + esc(state.title) + '"></div><div class="form-grid"><div class="form-field"><label class="field-label" for="prep-audience">Public</label><select class="input" id="prep-audience"><option value="tout public">Tout public</option><option value="seniors débutants">Seniors débutants</option><option value="collégiens">Collégiens</option><option value="agents et professionnels de l’accompagnement">Agents et professionnels</option></select></div><div class="form-field"><label class="field-label" for="prep-count">Nombre de questions</label><input class="input" id="prep-count" type="number" min="1" max="30" value="8"></div></div><label class="check-line"><input id="prep-quiz-only" type="checkbox"> Uniquement des quiz</label><label class="check-line"><input id="prep-multi-quiz" type="checkbox"> Autoriser plusieurs bonnes réponses dans les QCM</label><label class="check-line"><input id="prep-challenge" type="checkbox"> Ajouter un défi pratique à étapes</label><p>' + button('prep-copy-prompt', 'Copier la consigne pour l’IA', 'copy', 'primary') + '</p><p id="prep-prompt-status" class="generator-note" role="status"></p><textarea id="prep-prompt-output" class="textarea prompt-output" rows="7" readonly hidden aria-label="Consigne à copier dans une IA"></textarea></section><section class="generator-section"><div class="generator-step"><span class="number-bubble">2</span><div><h3>Importer et relire les questions</h3><p class="muted">JSON ou réponse d’IA · 60 Ko maximum</p></div></div><div class="import-source"><label class="field-label" for="prep-raw">Collez la réponse de l’IA ou votre liste JSON</label><textarea class="textarea" id="prep-raw" rows="8" placeholder="[{ &quot;type&quot;: &quot;mcq&quot;, &quot;text&quot;: &quot;Votre question…&quot;, … }]" aria-describedby="prep-source-status"></textarea><div class="import-actions"><button class="btn secondary small" type="button" data-action="prep-pick-file">' + icon('download') + ' Importer un fichier</button><input id="prep-file" class="file-input" type="file" accept=".json,.txt,application/json,text/plain" hidden>' + button('prep-example', 'Charger un exemple', 'sparkles', 'ghost small') + '</div><p id="prep-source-status" class="generator-note" role="status">Vos questions existantes seront conservées. La conclusion importée sera proposée à part.</p><p>' + button('prep-verify', 'Vérifier et afficher l’aperçu', 'check-circle', 'secondary') + '</p></div></section></div><div id="prep-preview" class="import-preview" hidden></div>';
      var actions = button('prep-cancel', 'Fermer', '', 'secondary') + '<button id="prep-commit" type="button" class="btn primary" data-action="prep-commit" disabled>' + icon('plus') + ' Ajouter la sélection</button>';
      hooks.showDialog('Générer ou importer des questions', body, actions, 'preparation-import');
    }
    function selectionSummary() {
      if (!previewItems) return;
      var selected = previewItems.filter(function (item) { return item.selected && !item.error; });
      var questions = selected.filter(function (item) { return item.q; }).length;
      var conclusion = selected.some(function (item) { return item.conclusion !== undefined; });
      var remaining = 50 - hooks.getState().questions.length;
      var status = element('prep-selected-count');
      if (status) status.textContent = questions + ' question' + (questions > 1 ? 's' : '') + ' sélectionnée' + (questions > 1 ? 's' : '') + (conclusion ? ' + une conclusion' : '') + ' · ' + remaining + ' place' + (remaining > 1 ? 's' : '') + ' disponible' + (remaining > 1 ? 's' : '');
      var error = element('prep-capacity-error');
      if (error) error.textContent = questions > remaining ? 'Cette sélection dépasse la limite de 50 questions. Décochez ' + (questions - remaining) + ' question(s). Rien ne sera ajouté tant que la sélection dépasse la capacité.' : '';
      var commit = element('prep-commit');
      if (commit) { commit.disabled = !selected.length || questions > remaining; commit.lastChild.textContent = questions ? ' Ajouter ' + questions + ' question' + (questions > 1 ? 's' : '') + (conclusion ? ' et la conclusion' : '') : ' Enregistrer la conclusion'; }
      var selectAll = element('prep-select-all');
      if (selectAll) selectAll.textContent = previewItems.every(function (item) { return item.error || item.selected; }) ? 'Tout désélectionner' : 'Sélectionner tous les éléments valides';
    }
    function renderPreview() {
      var target = element('prep-preview'); if (!target) return;
      var existingConclusion = hooks.getState().conclusion;
      target.hidden = false;
      target.innerHTML = '<div class="section-heading"><div><h3>Relisez avant d’ajouter</h3><p class="muted">Vérifiez les réponses des quiz : une IA peut se tromper. Les éléments invalides restent exclus.</p></div><button id="prep-select-all" class="btn ghost small" type="button" data-action="prep-select-all">Tout sélectionner</button></div>' + previewItems.map(function (item) {
        var q = item.q;
        var name = q ? q.title : item.conclusion !== undefined ? 'Conclusion de l’atelier' : item.title;
        return '<article class="import-item' + (item.error ? ' invalid' : '') + '"><div class="import-item-head"><label class="check-line"><input type="checkbox" data-prep-index="' + item.index + '" ' + (item.selected ? 'checked ' : '') + (item.error ? 'disabled ' : '') + '><span><strong>' + (item.index + 1) + '. ' + esc(name) + '</strong><span class="muted">' + (q ? ' · ' + TYPE_NAMES[q.type] + (q.multi ? ' · réponses multiples' : '') : item.conclusion !== undefined ? ' · 600 caractères maximum' : '') + '</span></span></label></div>' + (item.error ? '<p class="import-error" role="status">' + esc(item.error) + '</p>' : item.conclusion !== undefined ? '<p>' + esc(item.conclusion) + '</p>' + (existingConclusion && existingConclusion !== item.conclusion ? '<p class="generator-note">Si elle reste cochée, cette conclusion remplacera celle de cet essai.</p>' : '') : (q.description ? '<p class="muted">' + esc(q.description) + '</p>' : '') + (q.options.length ? '<ol class="import-options">' + q.options.map(function (option, index) { return '<li>' + esc(option) + ((q.correct === index || Array.isArray(q.correct) && q.correct.indexOf(index) !== -1) ? ' <strong>— Bonne réponse</strong>' : '') + '</li>'; }).join('') + '</ol>' : '<p class="muted">' + (q.type === 'wordcloud' ? 'Les participants proposeront leurs mots.' : 'Les participants écriront leur réponse.') + '</p>') + (q.explanation ? '<p class="generator-note"><strong>Explication :</strong> ' + esc(q.explanation) + '</p>' : '') + (q.variants ? '<p class="muted">Variantes conservées : ' + q.variants.map(function (entry) { return esc(entry.name); }).join(', ') + '.</p>' : '') + (q.link ? '<p class="muted">Lien conservé, sans ouverture : <code>' + esc(q.link) + '</code></p>' : '')) + (item.warning ? '<p class="generator-note">' + esc(item.warning) + '</p>' : '') + '</article>';
      }).join('') + '<div class="import-actions"><p id="prep-selected-count" class="selected-count" role="status"></p><p id="prep-capacity-error" class="import-error" role="alert"></p></div>';
      selectionSummary();
    }
    function commitImport(raw, selectedIndices) {
      var items = parseImport(raw);
      var indices = selectedIndices == null ? items.filter(function (item) { return item.selected; }).map(function (item) { return item.index; }) : selectedIndices;
      if (!Array.isArray(indices) || indices.some(function (index) { return !Number.isInteger(index) || !items[index] || items[index].error; })) return { ok: false, message: 'La sélection contient un élément invalide. Vérifiez de nouveau le contenu.' };
      var selected = Array.from(new Set(indices)).map(function (index) { return items[index]; });
      if (!selected.length) return { ok: false, message: 'Sélectionnez au moins une question valide ou une conclusion.' };
      var state = hooks.getState();
      var additions = selected.filter(function (item) { return item.q; });
      if (state.questions.length + additions.length > 50) return { ok: false, message: 'La limite de 50 questions serait dépassée. Rien n’a été ajouté : réduisez la sélection.' };
      var ids = new Set(state.questions.map(function (q) { return q.id; }));
      var ready = [];
      for (var index = 0; index < additions.length; index++) {
        var id = hooks.makeId(), attempts = 0;
        while (ids.has(id) && attempts++ < 20) id = hooks.makeId();
        if (typeof id !== 'string' || !id || id.length > 100 || ids.has(id)) return { ok: false, message: 'Impossible de créer des identifiants distincts. Rien n’a été ajouté ; réessayez.' };
        ids.add(id); additions[index].q.id = id; ready.push(additions[index].q);
      }
      var conclusion = selected.find(function (item) { return item.conclusion !== undefined; });
      Array.prototype.push.apply(state.questions, ready);
      if (conclusion) state.conclusion = conclusion.conclusion;
      hooks.save(); hooks.render();
      return { ok: true, added: ready.length, conclusion: !!conclusion, message: ready.length + ' question' + (ready.length > 1 ? 's' : '') + ' ajoutée' + (ready.length > 1 ? 's' : '') + (conclusion ? ' ; conclusion enregistrée.' : '.') };
    }
    async function copyPrompt() {
      var theme = element('prep-theme'), count = element('prep-count'), status = element('prep-prompt-status');
      if (!theme || !count) return;
      if (!theme.value.trim()) { status.textContent = 'Indiquez un thème avant de copier la consigne.'; theme.focus(); return; }
      if (!Number.isInteger(Number(count.value)) || Number(count.value) < 1 || Number(count.value) > 30) { status.textContent = 'Choisissez de 1 à 30 questions.'; count.focus(); return; }
      var prompt = buildPrompt({ theme: theme.value, audience: element('prep-audience').value, count: Number(count.value), quizOnly: element('prep-quiz-only').checked, multiQuiz: element('prep-multi-quiz').checked, challenge: element('prep-challenge').checked });
      var output = element('prep-prompt-output'); output.value = prompt; output.hidden = false;
      try {
        if (!root.navigator || !root.navigator.clipboard || !root.navigator.clipboard.writeText) throw new Error('manual');
        await root.navigator.clipboard.writeText(prompt);
        if (status.isConnected) status.textContent = 'Consigne copiée. Collez-la dans votre IA, puis revenez ici avec sa réponse. Aucun appel automatique n’a été effectué.';
      } catch (error) { if (output.isConnected) { output.focus(); output.select(); status.textContent = 'La consigne est sélectionnée : copiez-la avec Ctrl+C ou Cmd+C, puis collez-la dans votre IA.'; } }
    }
    function example() {
      var source = element('prep-raw'); if (!source) return;
      source.value = JSON.stringify([{ type: 'mcq', text: 'Un message vous presse de donner vos coordonnées. Quel est le bon réflexe ?', options: ['Répondre sans attendre', 'Vérifier par un autre moyen', 'Partager mon mot de passe'], correct: 'Vérifier par un autre moyen', multi: false, explain: 'Une demande urgente mérite une vérification auprès de l’organisme, avec un moyen de contact que vous connaissez.' }, { type: 'yesno', text: 'Peut-on prendre le temps de demander conseil avant de cliquer ?', correct: 'Oui', explain: 'Faire une pause et demander conseil aide à éviter une décision sous pression.' }, { type: 'conclusion', text: 'Avant de cliquer, prenez le temps de lire, de vérifier et, en cas de doute, de demander conseil.' }], null, 2);
      invalidate('Exemple chargé : cliquez sur « Vérifier et afficher l’aperçu » pour le relire.');
    }
    function onClick(event) {
      var target = event.target.closest('[data-action]');
      if (!target || target.disabled || target.dataset.action.indexOf('prep-') !== 0) return;
      var action = target.dataset.action;
      if (action === 'prep-import') open();
      else if (action === 'prep-pick-file') { var fileInput = element('prep-file'); if (fileInput) fileInput.click(); }
      else if (action === 'prep-cancel') hooks.closeDialog();
      else if (action === 'prep-copy-prompt') copyPrompt();
      else if (action === 'prep-example') example();
      else if (action === 'prep-verify') {
        var source = element('prep-raw'); if (!source) return;
        verifiedRaw = source.value; previewItems = parseImport(verifiedRaw); renderPreview();
        announce(previewItems.filter(function (item) { return !item.error; }).length + ' élément(s) valide(s). Relisez et gardez les éléments utiles.');
      } else if (action === 'prep-select-all' && previewItems) {
        var all = previewItems.every(function (item) { return item.error || item.selected; });
        previewItems.forEach(function (item) { item.selected = !item.error && !all; }); renderPreview();
      } else if (action === 'prep-commit') {
        var input = element('prep-raw');
        if (!previewItems || !input || verifiedRaw !== input.value) { invalidate('Le contenu a changé. Vérifiez-le de nouveau avant d’ajouter des questions.'); return; }
        var result = commitImport(input.value, previewItems.filter(function (item) { return item.selected && !item.error; }).map(function (item) { return item.index; }));
        if (result.ok) { hooks.closeDialog(); hooks.toast(result.message); previewItems = null; verifiedRaw = null; }
        else { var error = element('prep-capacity-error'); if (error) error.textContent = result.message; hooks.toast(result.message); }
      }
    }
    function onInput(event) { if (event.target.id === 'prep-raw') invalidate(); }
    async function onChange(event) {
      var target = event.target;
      if (target.hasAttribute && target.hasAttribute('data-prep-index') && previewItems) {
        var index = Number(target.dataset.prepIndex); if (previewItems[index] && !previewItems[index].error) { previewItems[index].selected = target.checked; selectionSummary(); }
      }
      if (target.id !== 'prep-file' || !target.files || !target.files[0]) return;
      var file = target.files[0], sequence = opening, changed = revision;
      if (file.size > MAX_BYTES) { invalidate('Fichier trop volumineux : 60 Ko maximum. Choisissez un fichier plus court.'); target.value = ''; return; }
      try {
        var text = await file.text();
        if (sequence !== opening || !element('prep-raw')) return;
        if (changed !== revision) { announce('Le contenu a changé pendant la lecture du fichier. Sélectionnez le fichier à nouveau pour le charger.'); return; }
        element('prep-raw').value = text; invalidate('Fichier « ' + file.name + ' » chargé. Vérifiez-le pour afficher l’aperçu.');
      } catch (error) { announce('Impossible de lire ce fichier. Vous pouvez aussi coller son contenu dans le champ.'); }
      target.value = '';
    }
    if (doc) { doc.addEventListener('click', onClick); doc.addEventListener('input', onInput); doc.addEventListener('change', onChange); }
    return { open: open, commitImport: commitImport, destroy: function () { opening++; if (doc) { doc.removeEventListener('click', onClick); doc.removeEventListener('input', onInput); doc.removeEventListener('change', onChange); } } };
  }

  root.WLPreparation = { create: create, parseImport: parseImport, buildPrompt: buildPrompt };
}(typeof window !== 'undefined' ? window : globalThis));
