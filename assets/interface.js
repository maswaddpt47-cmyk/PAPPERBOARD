/* Associe les composants de la référence aux contrôles PHP sans modifier leurs opérations. */
(function () {
  'use strict';
  var queued = false;
  function set(node, name, enabled) { if (node.classList.contains(name) !== enabled) node.classList.toggle(name, enabled); }
  function decorate() {
    queued = false;
    document.querySelectorAll('.btn').forEach(function (node) {
      set(node, 'primary', node.classList.contains('btn-primary'));
      set(node, 'danger', node.classList.contains('btn-danger'));
      set(node, 'ghost', node.classList.contains('btn-ghost'));
      set(node, 'secondary', !node.classList.contains('btn-primary') && !node.classList.contains('btn-danger') && !node.classList.contains('btn-ghost'));
      set(node, 'small', node.classList.contains('btn-small'));
    });
    document.querySelectorAll('.card').forEach(function (node) {
      if (!node.classList.contains('panel')) node.classList.add('panel');
      if (!node.matches('.current-panel,.question-rail,.metric-card,.help-card,.inbox-card') && !node.classList.contains('content-card')) node.classList.add('content-card');
    });
    document.querySelectorAll('dialog').forEach(function (node) { if (!node.classList.contains('modal')) node.classList.add('modal'); });
    document.querySelectorAll('input:not([type="checkbox"]):not([type="radio"]),select').forEach(function (node) { if (!node.classList.contains('input')) node.classList.add('input'); });
    document.querySelectorAll('textarea').forEach(function (node) { if (!node.classList.contains('textarea')) node.classList.add('textarea'); });
    document.querySelectorAll('dialog label:not(.check):not(.choice-card),dialog legend').forEach(function (node) { if (!node.classList.contains('field-label')) node.classList.add('field-label'); });
    [['open-btn', 'play'], ['show-btn', 'eye']].forEach(function (item) {
      var button = document.getElementById(item[0]);
      if (!button || button.querySelector('svg')) return;
      var icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('class', 'icon'); icon.setAttribute('aria-hidden', 'true');
      var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', '#i-' + item[1]); icon.appendChild(use); button.prepend(icon);
    });
  }
  function schedule() { if (!queued) { queued = true; requestAnimationFrame(decorate); } }
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  decorate();
  document.querySelectorAll('[data-dialog-cancel]').forEach(function (button) {
    button.addEventListener('click', function () { document.getElementById(button.dataset.dialogCancel).click(); });
  });
  document.getElementById('help-open').addEventListener('click', function () { document.getElementById('help-dialog').showModal(); });
  document.getElementById('help-close').addEventListener('click', function () { document.getElementById('help-dialog').close(); });
  document.getElementById('ed-preview').addEventListener('click', function (event) {
    var preview = window.open(this.href, 'wooclight-participant-preview', 'popup,width=480,height=820,resizable=yes,scrollbars=yes');
    if (preview) { preview.opener = null; event.preventDefault(); preview.focus(); }
  });
}());
