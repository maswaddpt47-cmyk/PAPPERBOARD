<?php
// Écran de projection : grande typographie, résultats en direct, QR code
// permanent. screen.php?s=CODE. Logique dans assets/screen.js.
declare(strict_types=1);
require __DIR__ . '/lib.php';
wl_config();
wl_security_headers();
?>
<!doctype html>
<html lang="fr" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" type="image/svg+xml" href="<?= wl_asset('favicon.svg') ?>">
<title>WoocLight — Projection</title>
<link rel="stylesheet" href="<?= wl_asset('style.css') ?>">
<link rel="stylesheet" href="<?= wl_asset('interface-screen.css') ?>">
<link rel="stylesheet" href="<?= wl_asset('aides.css') ?>">
</head>
<?php // Cookie animateur présent : la page tentera le pilotage (vérifié par api.php). ?>
<body class="screen"<?= isset($_COOKIE['WLADMIN']) ? ' data-pilot="1"' : '' ?>>
<div id="screen-error" class="banner" role="alert" hidden></div>
<header class="screen-head">
  <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
  <h1 id="s-title" class="s-title"></h1>
  <div class="screen-tools">
    <span id="s-count" class="s-count" aria-live="polite"></span>
    <button id="theme-btn" class="btn btn-ghost" type="button">Thème clair</button>
    <button id="full-btn" class="btn btn-ghost" type="button">Plein écran</button>
  </div>
</header>
<!-- Commandes en haut (consigne du 19/10/2026) : la place libre pour les résultats se mesure jusqu'au bas de l'écran. -->
<div class="screen-command-area">
<nav id="s-pilot" class="s-pilot" aria-label="Animation guidée" hidden>
  <button id="p-prev" class="btn" type="button" title="Question précédente (flèche gauche)">◀ Précédente</button>
  <button id="p-step" class="btn btn-primary" type="button" aria-describedby="s-guide"></button>
  <button id="p-hide" class="btn" type="button" hidden>Afficher</button>
  <strong id="p-count" class="s-pcount" aria-live="polite"></strong>
  <button id="p-next" class="btn" type="button" title="Question suivante, son vote s'ouvre (flèche droite)">Suivante ▶</button>
  <details id="p-options" class="animation-options">
  <summary>Autres actions</summary>
  <div class="animation-options-body">
  <button id="p-reopen" class="btn" type="button" hidden>Rouvrir les réponses</button>
  <button id="p-welcome" class="btn" type="button">Revenir à l’accueil</button>
  <a id="p-participants" class="btn" target="_blank" rel="noopener">Participants et accueil ↗</a>
  <button id="p-asks" class="btn" type="button" title="Projette les questions « Oser demander » publiées, les plus votées d'abord" hidden></button>
  <button id="p-board" class="btn" type="button" title="Affiche le bilan : une question par diapositive, ses résultats tels qu'ils ont été montrés (B)">Afficher le bilan</button>
  <button id="p-end" class="btn btn-danger" type="button">Terminer l’atelier</button>
  </div>
  </details>
  <span class="s-swipe">Glissez ← → pour changer de question</span>
  <span class="s-keys">Clavier : ← → · Espace · B (bilan) · Q (QR code) · F (plein écran)</span>
</nav>
<aside class="qr-corner" aria-label="Rejoindre la session">
  <button id="qr-zoom" class="qr-zoom-btn" type="button" title="Agrandir le QR code (Q)" aria-label="Agrandir le QR code" aria-expanded="false"><span id="qr" class="qr"></span></button>
  <p class="qr-code">Code <strong id="s-code"></strong></p>
  <button id="qr-close" class="btn qr-close" type="button">Fermer</button>
</aside>
</div>
<section id="s-guide" class="animation-guide" aria-label="Étape de l’animation" aria-live="polite"></section>
<main class="screen-main">
<div id="projection-canvas" class="projection-fit-canvas">
  <section id="s-welcome" class="s-welcome" hidden>
    <p class="s-join-line">Rejoignez sur <strong id="s-url"></strong></p>
    <p class="s-join-line">avec le code <strong id="s-code-big" class="code-big"></strong></p>
  </section>
  <section id="s-question" hidden>
    <p id="s-meta" class="s-meta"></p>
    <h2 id="s-text" class="s-text"></h2>
    <p id="s-timer" class="s-timer" hidden></p>
    <div id="s-link" class="s-link" hidden></div>
    <div id="s-results" class="s-results" aria-live="polite"></div>
  </section>
  <section id="s-show" class="s-show" hidden>
    <h2 id="s-show-title" class="s-show-title"></h2>
    <div id="s-show-body" class="s-results"></div>
  </section>
  <section id="s-ended" hidden><p class="s-join-line s-thanks">Session terminée. Merci !</p><div id="s-recap"></div></section>
</div>
</main>

<script src="<?= wl_asset('qrcode.js') ?>"></script>
<script src="<?= wl_asset('common.js') ?>"></script>
<script src="<?= wl_asset('charts.js') ?>"></script>
<script src="<?= wl_asset('screen.js') ?>"></script>
<script src="<?= wl_asset('tooltips.js') ?>"></script>
</body>
</html>
