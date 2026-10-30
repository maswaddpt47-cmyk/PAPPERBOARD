/* Mini-éditeur local. Le document enregistré ne contient que du texte et cinq
 * types de blocs ; aucun HTML de presse-papiers ou attribut n'est transmis. */
(function () {
  'use strict';
  var editors = {}, el = WL.el;

  function plain(blocks) { return blocks.map(function (b) { return b.runs.map(function (r) { return r.text; }).join(''); }).join('\n'); }
  function fromText(text) { return String(text || '').split('\n').map(function (s) { return { type: 'p', runs: s ? [{ text: s }] : [] }; }); }

  function read(root) {
    var out = [], current = { type: 'p', runs: [] };
    function flush(force) { if (force || current.runs.length) out.push(current); current = { type: current.type, runs: [] }; }
    function add(text, bold) {
      text.replace(/\r\n?/g, '\n').replace(/\u00a0/g, ' ').split('\n').forEach(function (s, i) {
        if (i) flush(true);
        if (!s) return;
        var last = current.runs[current.runs.length - 1];
        if (last && last.bold === bold) last.text += s;
        else { var run = { text: s }; if (bold !== undefined) run.bold = bold; current.runs.push(run); }
      });
    }
    function walk(node, bold, list) {
      if (node.nodeType === 3) { add(node.nodeValue, bold); return; }
      if (node.nodeType !== 1) return;
      var tag = node.tagName;
      if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'IMG'].indexOf(tag) !== -1) return;
      if (tag === 'BR') { flush(true); return; }
      if (tag === 'UL' || tag === 'OL') list = tag === 'OL' ? 'number' : 'bullet';
      var block = ['P', 'DIV', 'H2', 'H3', 'LI'].indexOf(tag) !== -1;
      var old = current.type, start;
      if (block) { flush(false); start = out.length; current.type = tag === 'LI' ? (list || 'bullet') : tag === 'H2' ? 'title' : tag === 'H3' ? 'subtitle' : (list || 'p'); }
      if (tag === 'B' || tag === 'STRONG') bold = true;
      else if (node.classList.contains('wl-rich-normal') || node.style.fontWeight === 'normal' || node.style.fontWeight === '400') { bold = false; node.classList.add('wl-rich-normal'); }
      Array.prototype.forEach.call(node.childNodes, function (n) { walk(n, bold, list); });
      if (block) { flush(out.length === start); current.type = old; }
    }
    Array.prototype.forEach.call(root.childNodes, function (n) { walk(n, undefined, ''); });
    flush(false);
    while (out.length > 1 && !out[out.length - 1].runs.length) out.pop();
    return out.length ? out : [{ type: 'p', runs: [] }];
  }

  function write(input, blocks) {
    WL.clear(input);
    var list = null, kind = '';
    blocks.forEach(function (block) {
      var tag = block.type === 'title' ? 'h2' : block.type === 'subtitle' ? 'h3' : block.type === 'bullet' || block.type === 'number' ? 'li' : 'p';
      var row = el(tag);
      (block.runs || []).forEach(function (r) { row.appendChild(r.bold ? el('strong', null, r.text) : r.bold === false ? el('span', { class: 'wl-rich-normal' }, r.text) : document.createTextNode(r.text)); });
      if (!row.childNodes.length) row.appendChild(el('br'));
      if (tag === 'li') {
        if (kind !== block.type) { list = el(block.type === 'number' ? 'ol' : 'ul'); input.appendChild(list); kind = block.type; }
        list.appendChild(row);
      } else { input.appendChild(row); kind = ''; }
    });
  }

  function attach(source) {
    var label = document.querySelector('label[for="' + source.id + '"]');
    if (label && !label.id) label.id = source.id + '-label';
    var placeholder = source.getAttribute('placeholder') || '';
    var input = el('div', { class: 'wl-editor-input' + (source.rows <= 3 ? ' wl-editor-short' : ''), contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true', 'data-rich-input': source.id, 'data-placeholder': placeholder, 'data-long-placeholder': placeholder.split('\n').length > 3 ? 'true' : null, 'aria-placeholder': placeholder || null, 'aria-labelledby': label && label.id });
    var toolbar = el('div', { class: 'wl-editor-toolbar', role: 'group', 'aria-label': 'Mise en forme du texte' });
    var error = el('p', { class: 'meta wl-editor-count', 'aria-live': 'polite' });
    var wrapper = el('div', { class: 'wl-editor' }, toolbar, input, error);
    source.after(wrapper); source.classList.add('wl-editor-source');
    var state = { source: source, wrapper: wrapper, input: input, range: null, blocks: fromText(source.value), enabled: true, lockedPlain: null };
    editors[source.id] = state;
    function rememberSelection() {
      var selection = getSelection();
      if (selection.rangeCount && input.contains(selection.anchorNode) && input.contains(selection.focusNode)) state.range = selection.getRangeAt(0).cloneRange();
    }
    function restore() {
      input.focus();
      var selection = getSelection(), range = state.range;
      if (!range || !input.contains(range.commonAncestorContainer)) { range = document.createRange(); range.selectNodeContents(input); range.collapse(false); }
      selection.removeAllRanges(); selection.addRange(range);
    }
    function changed() {
      var before = source.value;
      var blocks = read(input), value = plain(blocks);
      if (state.lockedPlain !== null && value !== state.lockedPlain) { write(input, state.blocks); state.range = null; error.textContent = 'Ces libellés sont fixes ; leur mise en forme reste modifiable.'; return; }
      state.blocks = blocks; source.value = value;
      input.classList.toggle('is-empty', !value.trim());
      var length = Array.from(source.value).length, max = source.maxLength;
      error.textContent = max > 0 && length > max ? length + ' caractères : limitez ce champ à ' + max + '.' : '';
      source.dispatchEvent(new Event(before === source.value ? 'change' : 'input', { bubbles: true })); rememberSelection();
    }
    function command(name, value) { restore(); document.execCommand('styleWithCSS', false, false); document.execCommand(name, false, value); changed(); }
    function button(text, title, action) {
      var b = el('button', { type: 'button', class: 'btn btn-small', title: title, 'aria-label': title }, text);
      b.addEventListener('mousedown', function (e) { e.preventDefault(); rememberSelection(); });
      b.addEventListener('click', action); toolbar.appendChild(b);
    }
    button('G', 'Mettre la sélection en gras', function () { command('bold'); });
    var style = el('select', { 'aria-label': 'Style du paragraphe', title: 'Texte, titre agrandi ou sous-titre' },
      el('option', { value: 'p' }, 'Texte'), el('option', { value: 'h2' }, 'Titre'), el('option', { value: 'h3' }, 'Sous-titre'));
    style.addEventListener('change', function () { command('formatBlock', style.value); }); toolbar.appendChild(style);
    button('•', 'Liste à puces', function () { command('insertUnorderedList'); });
    button('1.', 'Liste numérotée', function () { command('insertOrderedList'); });
    button('Effacer le style', 'Retirer la mise en forme de la sélection', function () { command('removeFormat'); command('formatBlock', 'p'); });
    input.addEventListener('input', changed);
    input.addEventListener('keyup', rememberSelection); input.addEventListener('mouseup', rememberSelection);
    document.addEventListener('selectionchange', rememberSelection);
    input.addEventListener('paste', function (event) { event.preventDefault(); command('insertText', event.clipboardData.getData('text/plain')); });
    input.addEventListener('drop', function (event) { event.preventDefault(); });
    if (label) label.addEventListener('click', function (event) { if (state.enabled) { event.preventDefault(); input.focus(); } });
    function visibility() {
      var fieldset = source.closest('fieldset'), disabled = source.disabled || fieldset && fieldset.disabled;
      wrapper.hidden = source.hidden || !state.enabled;
      input.contentEditable = disabled ? 'false' : 'true';
      input.setAttribute('aria-readonly', String(!!disabled));
    }
    new MutationObserver(visibility).observe(source, { attributes: true, attributeFilter: ['hidden', 'disabled'] });
    if (source.closest('fieldset')) new MutationObserver(visibility).observe(source.closest('fieldset'), { attributes: true, attributeFilter: ['disabled'] });
    visibility();
    write(input, state.blocks);
    input.classList.toggle('is-empty', !source.value.trim());
  }

  WL.Editor = {
    set: function (id, text, blocks) {
      var e = editors[id]; e.source.value = text || ''; e.blocks = blocks && blocks.length ? blocks : fromText(text); e.range = null; write(e.input, e.blocks);
      e.input.classList.toggle('is-empty', !e.source.value.trim());
      e.wrapper.querySelector('select').value = e.blocks[0] && e.blocks[0].type === 'title' ? 'h2' : e.blocks[0] && e.blocks[0].type === 'subtitle' ? 'h3' : 'p';
      e.wrapper.querySelector('.wl-editor-count').textContent = '';
    },
    get: function (id) {
      var e = editors[id]; if (!e.enabled) return [];
      return e.blocks.length > 1 || e.blocks.some(function (b) { return b.type !== 'p' || b.runs.some(function (r) { return r.bold !== undefined; }); }) ? e.blocks : [];
    },
    lines: function (id) {
      return editors[id].blocks.filter(function (b) { return plain([b]).trim(); }).map(function (b) {
        return b.type !== 'p' || b.runs.some(function (r) { return r.bold !== undefined; }) ? [b] : [];
      });
    },
    setLines: function (id, lines, docs) {
      var blocks = lines.map(function (s, i) { return docs && docs[i] && docs[i][0] || { type: 'p', runs: [{ text: s }] }; });
      WL.Editor.set(id, lines.join('\n'), blocks);
    },
    active: function (id) { return editors[id].wrapper.contains(document.activeElement); },
    lock: function (id, text) { editors[id].lockedPlain = text; },
    focus: function (id) { var e = editors[id]; (e && e.enabled ? e.input : document.getElementById(id)).focus(); },
    enable: function (id, enabled) {
      var e = editors[id]; if (e.enabled === enabled) return;
      e.enabled = enabled; e.wrapper.hidden = !enabled; e.source.classList.toggle('wl-editor-source', enabled);
      WL.Editor.set(id, e.source.value, []);
    }
  };
  document.querySelectorAll('[data-rich-editor]').forEach(attach);
}());
