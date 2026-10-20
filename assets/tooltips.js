(function () {
  'use strict';
  var selector = 'button, a.btn, label.btn, [role="button"]';
  var tooltip, owner, timer, closing, priorDescription, priorTitle;
  var tips = {
    'create-workshop': 'Créer un atelier vide, préparer ses questions par génération ou import JSON, ou créer une démonstration avec des participants fictifs.',
    'create-demo': 'Créer un nouvel atelier avec des participants et des réponses fictifs pour tester seul.',
    'delete-demos': 'Supprimer uniquement les ateliers marqués Démo, après confirmation. Les créations, imports et copies sont conservés.',
    'open-history': 'Retrouver vos ateliers, vos archives et les commandes de démonstration.',
    'open-saved-workshop': 'Ouvrir cet atelier en conservant celui que vous utilisez actuellement.',
    'rename-workshop': 'Changer le nom de cet atelier sans modifier ses questions ni ses réponses.',
    'duplicate-workshop': 'Créer une copie des questions et de la conclusion, sans participants ni réponses.',
    'archive-workshop': 'Ranger cet atelier dans les archives locales en conservant son contenu et ses résultats.',
    'restore-workshop': 'Remettre cet atelier archivé dans les ateliers en cours.',
    'delete-workshop': 'Supprimer cet atelier et ses réponses de ce navigateur, après confirmation.',
    'projection': 'Ouvrir la projection synchronisée dans un nouvel onglet, à déplacer sur l’écran du groupe.',
    'participant': 'Ouvrir un aperçu participant synchronisé et essayer une réponse fictive.',
    'result-gallery': 'Parcourir les douze formes de résultats avec des exemples fictifs.',
    'projection-home': 'Quitter la galerie et revenir à la question en cours.',
    'projection-close': 'Fermer uniquement cet onglet de projection ; l’animation reste ouverte.',
    'projection-fullscreen': 'Activer ou quitter le plein écran pour la projection.',
    'projection-previous': 'Projeter la question précédente et synchroniser l’animateur et l’aperçu participant.',
    'projection-next': 'Projeter la question suivante et synchroniser l’animateur et l’aperçu participant.',
    'previous': 'Revenir à la question précédente et afficher son début.',
    'next': 'Passer à la question suivante et afficher son début.',
    'gallery-prev': 'Afficher la forme de résultat précédente.',
    'gallery-next': 'Afficher la forme de résultat suivante.',
    'go-live': 'Revenir aux questions, aux votes et aux résultats sans changer la question en cours.',
    'go-pilotage': 'Gérer les invitations, les inscriptions et les retours du groupe.',
    'go-prep': 'Ouvrir la préparation des questions de cet atelier.',
    'open-workshop': 'Revenir à l’animation de l’atelier actuel.',
    'open-library': 'Choisir un modèle de séance à essayer et à personnaliser.',
    'load-library': 'Ouvrir ce modèle en conservant votre atelier actuel dans Mes ateliers.',
    'copy-invitation': 'Copier le lien et le code de l’atelier. Dans la simulation, ils fonctionnent dans ce navigateur seulement.',
    'share-invitation': 'Ouvrir le partage de l’appareil ou proposer un texte d’invitation à copier.',
    'zoom-qr': 'Agrandir le QR code pour faciliter sa lecture. Échap ferme la fenêtre.',
    'toggle-registrations': 'Autoriser ou bloquer les nouvelles inscriptions sans retirer les participants déjà inscrits.',
    'simulate-registration': 'Ajouter un participant fictif et son pseudonyme si cette option est activée.',
    'join-session': 'S’inscrire comme participant fictif dans ce navigateur.',
    'toggle-qr': 'Afficher ou masquer le QR code dans la projection.',
    'show-welcome': 'Projeter l’écran d’accueil avec l’invitation, avant de commencer les questions.',
    'toggle-asks': 'Autoriser ou bloquer l’envoi de nouvelles questions anonymes.',
    'project-asks': 'Afficher ou retirer de la projection les questions anonymes déjà publiées.',
    'publish-question': 'Publier ou retirer cette question anonyme après votre relecture.',
    'delete-ask': 'Supprimer cette question anonyme après confirmation.',
    'simulate-ask': 'Ajouter une question anonyme fictive à relire avant publication.',
    'send-signal': 'Ajouter un retour fictif pour tester les signaux du groupe.',
    'acknowledge-help': 'Effacer les signaux après les avoir pris en compte.',
    'toggle-pseudos': 'Afficher ou masquer la liste des pseudonymes fictifs des inscrits.',
    'toggle-podium': 'Afficher ou retirer le podium fictif dans la projection.',
    'reset-question': 'Effacer les réponses de cette question après confirmation pour pouvoir la reposer.',
    'add-question': 'Ajouter une question et définir son type, ses choix et sa correction éventuelle.',
    'edit-question': 'Modifier l’intitulé, les choix ou la correction de cette question.',
    'delete-question': 'Supprimer cette question et ses réponses après confirmation.',
    'move-up': 'Déplacer cette question d’une place vers le début de l’atelier.',
    'move-down': 'Déplacer cette question d’une place vers la fin de l’atelier.',
    'select-question': 'Afficher cette question dans l’animation et la projection.',
    'quick-insert': 'Ajouter la proposition sélectionnée au début ou à la fin de l’atelier.',
    'save-conclusion': 'Enregistrer le texte présenté lorsque vous terminez la session.',
    'export-csv': 'Télécharger les résultats de cet essai au format CSV.',
    'export-memo': 'Télécharger le mémo de cet atelier.',
    'prep-copy-prompt': 'Copier une consigne adaptée au public, au niveau et au nombre de questions ou à la durée. Aucun appel à une IA n’est effectué.',
    'prep-pick-file': 'Choisir un fichier JSON ou texte à vérifier avant de créer l’atelier.',
    'prep-example': 'Charger un exemple d’import dans la zone de texte pour essayer sa vérification.',
    'prep-verify': 'Contrôler le JSON et afficher les questions à relire et à sélectionner avant création.',
    'prep-select-all': 'Sélectionner ou désélectionner les éléments valides de l’aperçu.',
    'prep-commit': 'Après vérification et sélection dans l’aperçu, créer l’atelier avec les questions et la conclusion retenues.',
    'prep-cancel': 'Fermer la préparation JSON sans créer l’atelier.',
    'close-dialog': 'Fermer cette fenêtre et revenir à l’écran précédent.',
    'help': 'Consulter le parcours conseillé pour tester cette simulation.'
  };
  var navigation = { overview: 'Consulter la vue d’ensemble de votre essai.', workshop: 'Revenir à l’atelier actuellement ouvert.', library: 'Parcourir les modèles de séances.', history: 'Créer, ouvrir, renommer, dupliquer, archiver ou supprimer vos ateliers et gérer les démos.' };
  var tabs = { prep: 'Préparer et organiser les questions et la conclusion.', control: 'Gérer les invitations, les inscriptions et les échanges avec le groupe.', live: 'Piloter les questions, les votes et la visibilité des résultats.', recap: 'Consulter le bilan et télécharger les résultats.', settings: 'Consulter les informations de conservation et le statut de purge de la simulation.' };
  var forms = { 'workshop-form': 'Continuer la création avec un atelier vide ou le parcours JSON choisi.', 'question-form': 'Vérifier et enregistrer cette question.', 'participant-form': 'Envoyer cette réponse fictive à l’animateur.', 'anonymous-question-form': 'Envoyer cette question anonyme à l’animateur pour relecture.', 'rename-workshop-form': 'Enregistrer le nouveau nom sans modifier les questions ni les réponses.', 'create-demo-form': 'Créer une démo sur le thème choisi, avec 12 participants fictifs et des réponses.' };
  var phpTips = {
    'create-btn': 'Créer un atelier vide, préparer ses questions par génération ou import JSON, ou créer une démonstration avec des participants fictifs.',
    'demo-delete': 'Supprimer uniquement les sessions de démonstration, après confirmation. Les autres ateliers sont conservés.',
    'end-control-btn': 'Terminer la session après confirmation, ou la rouvrir pour reprendre les votes.',
    'end-live-btn': 'Terminer la session après confirmation, ou la rouvrir pour reprendre les votes.',
    'end-btn': 'Terminer la session après confirmation, ou la rouvrir pour reprendre les votes.',
    'open-btn': 'Ouvrir ou fermer la réception des réponses à cette question.',
    'show-btn': 'Afficher ou masquer les graphes et réponses sur la projection et les appareils des participants sans les effacer.',
    'p-step': 'Lancer, ouvrir, fermer ou rouvrir le vote de la question projetée.',
    'p-hide': 'Afficher ou masquer les graphes et réponses (publier pour un mur ou un post-it) sur la projection et les appareils, sans les effacer.',
    'ed-preview': 'Ouvrir un écran participant synchronisé pour tester le parcours réel.',
    'ed-open-screen': 'Ouvrir la projection synchronisée dans un nouvel onglet.',
    'gen-copy': 'Copier la consigne adaptée au public, au niveau et à la durée dans une IA de votre choix.',
    'gen-check': 'Vérifier le JSON et afficher les questions à relire avant de les ajouter.',
    'gen-review': 'Copier une consigne pour une autre IA afin de relire les questions et obtenir une version corrigée.',
    'rename-btn': 'Changer le titre de la session sans modifier les questions ni les réponses.',
    'rename-save': 'Enregistrer le nouveau titre de cet atelier.',
    'rename-cancel': 'Fermer sans changer le titre.',
    'full-btn': 'Activer ou quitter le plein écran de la projection.',
    'theme-btn': 'Alterner entre les thèmes clair et sombre de la projection.',
    'go-live': 'Revenir aux questions, aux votes et aux résultats.',
    'go-control': 'Ouvrir Pilotage pour gérer le groupe et les invitations.',
    'logout-btn': 'Fermer votre session animateur sur cet appareil.'
  };
  function explanation(node) {
    if (phpTips[node.id]) return phpTips[node.id];
    var action = node.dataset.action;
    var label = (node.getAttribute('aria-label') || node.textContent || '').replace(/\s+/g, ' ').trim();
    if (node.dataset.tooltip) return node.dataset.tooltip;
    if (node.dataset.nav) return navigation[node.dataset.nav];
    if (action === 'tab') return tabs[node.dataset.tab];
    if (action === 'end-session') return label.indexOf('Rouvrir') === 0 ? 'Rouvrir la session pour reprendre l’animation. Ouvrez ensuite le vote souhaité.' : 'Terminer la session après confirmation : les votes sont fermés et la conclusion est projetée.';
    if (action === 'toggle-vote') return label.indexOf('Fermer') === 0 ? 'Arrêter la réception des réponses à cette question.' : 'Autoriser les participants à répondre à cette question.';
    if (action === 'toggle-results' || action === 'projection-toggle-results') return label.indexOf('Masquer') === 0 ? 'Masquer les graphes et réponses sur la projection et dans l’aperçu participant sans les effacer.' : 'Rendre visibles les graphes et réponses sur la projection et dans l’aperçu participant.';
    if (action === 'simulate') return 'Ajouter une réponse fictive si le vote est ouvert et la session en cours.';
    if (tips[action]) return tips[action];
    if (node.id === 'reset-demo') return 'Repartir de la démonstration initiale en conservant votre atelier actuel dans Mes ateliers.';
    if (node.id === 'help-demo') return tips.help;
    if (node.id === 'menu-toggle') return 'Ouvrir ou replier le menu de navigation.';
    if (node.id === 'nav-overlay') return 'Fermer le menu de navigation.';
    var form = node.closest('form');
    if (form && node.type === 'submit' && forms[form.id]) return forms[form.id];
    if (node.matches('a.btn') && /index\.html/.test(node.getAttribute('href') || '')) return 'Ouvrir la galerie des formes de graphes et de résultats.';
    return node.getAttribute('title') || label;
  }
  function dismissVisible() {
    clearTimeout(closing);
    if (owner) {
      if (priorDescription === null) owner.removeAttribute('aria-describedby'); else owner.setAttribute('aria-describedby', priorDescription);
      if (priorTitle !== null) owner.setAttribute('title', priorTitle);
      owner = null;
    }
    if (tooltip) { if (typeof tooltip.hidePopover === 'function' && tooltip.matches(':popover-open')) tooltip.hidePopover(); tooltip.hidden = true; }
  }
  function hide() { clearTimeout(timer); dismissVisible(); }
  function show(node) {
    hide();
    var content = explanation(node);
    if (!content || !node.isConnected) return;
    tooltip = document.getElementById('action-tooltip') || document.createElement('div');
    tooltip.id = 'action-tooltip'; tooltip.setAttribute('role', 'tooltip'); tooltip.textContent = content;
    var parent = node.closest('dialog[open]') || document.body;
    parent.appendChild(tooltip); tooltip.hidden = false;
    if (typeof tooltip.showPopover === 'function') { tooltip.setAttribute('popover', 'manual'); tooltip.showPopover(); }
    owner = node; priorDescription = node.getAttribute('aria-describedby'); priorTitle = node.getAttribute('title');
    if (priorTitle !== null) node.removeAttribute('title');
    node.setAttribute('aria-describedby', (priorDescription ? priorDescription + ' ' : '') + tooltip.id);
    var r = node.getBoundingClientRect(), t = tooltip.getBoundingClientRect();
    tooltip.style.left = Math.max(12, Math.min(innerWidth - t.width - 12, r.left + (r.width - t.width) / 2)) + 'px';
    tooltip.style.top = Math.max(12, r.bottom + t.height + 12 <= innerHeight ? r.bottom + 8 : r.top - t.height - 8) + 'px';
  }
  function target(event) { return event.target && event.target.closest ? event.target.closest(selector) : null; }
  document.addEventListener('pointerover', function (event) {
    if (event.pointerType === 'touch') return;
    if (tooltip && tooltip.contains(event.target)) { clearTimeout(closing); return; }
    var node = target(event); if (!node || (event.relatedTarget && node.contains(event.relatedTarget))) return;
    clearTimeout(closing);
    clearTimeout(timer); timer = setTimeout(function () { show(node); }, 250);
  });
  document.addEventListener('pointerout', function (event) {
    var node = target(event);
    if (!node && !(tooltip && tooltip.contains(event.target))) return;
    if (event.relatedTarget && ((node && node.contains(event.relatedTarget)) || (tooltip && tooltip.contains(event.relatedTarget)))) return;
    clearTimeout(timer); closing = setTimeout(hide, 150);
  });
  document.addEventListener('focusin', function (event) { var node = target(event); if (node) show(node); });
  document.addEventListener('focusout', hide);
  document.addEventListener('click', hide);
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    var visible = tooltip && !tooltip.hidden;
    hide();
    if (visible) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  document.addEventListener('scroll', function (event) { if (!tooltip || !tooltip.contains(event.target)) dismissVisible(); }, true);
  window.addEventListener('resize', hide);
  new MutationObserver(function () { if (owner && !owner.isConnected) hide(); }).observe(document.body, { childList: true, subtree: true });
}());
