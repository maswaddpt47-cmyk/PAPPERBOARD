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
<title>WoocLight — Projection</title>
<link rel="stylesheet" href="<?= wl_asset('style.css') ?>">
</head>
<?php // Cookie animateur présent : la page tentera le pilotage (vérifié par api.php). ?>
<body class="screen"<?= isset($_COOKIE['WLADMIN']) ? ' data-pilot="1"' : '' ?>>
<div id="screen-error" class="banner" role="alert" hidden></div>
<header class="screen-head">
  <h1 id="s-title" class="s-title"></h1>
  <div class="screen-tools">
    <span id="s-count" class="s-count" aria-live="polite"></span>
    <button id="theme-btn" class="btn btn-ghost" type="button">Thème clair</button>
    <button id="full-btn" class="btn btn-ghost" type="button">Plein écran</button>
  </div>
</header>
<main class="screen-main">
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
</main>
<nav id="s-pilot" class="s-pilot" aria-label="Pilotage" hidden>
  <button id="p-prev" class="btn" type="button" title="Question précédente (flèche gauche)">◀ Précédente</button>
  <button id="p-step" class="btn btn-primary" type="button"></button>
  <button id="p-reopen" class="btn" type="button" title="Rouvre le vote de cette question (les résultats sont masqués avant, sauf pour un mur ou un post-it)" hidden>Rouvrir le vote</button>
  <strong id="p-count" class="s-pcount" aria-live="polite"></strong>
  <button id="p-next" class="btn" type="button" title="Question suivante, son vote s'ouvre (flèche droite)">Suivante ▶</button>
  <button id="p-asks" class="btn" type="button" title="Projette les questions « Oser demander » publiées, les plus votées d'abord" hidden></button>
  <button id="p-board" class="btn" type="button" title="Projette le bilan : une question par diapositive, ses résultats tels qu'ils ont été montrés (B)">Bilan</button>
  <span class="s-swipe">Glissez ← → pour changer de question</span>
  <span class="s-keys">Clavier : ← → · Espace · B (bilan) · Q (QR code) · F (plein écran)</span>
</nav>
<aside class="qr-corner" aria-label="Rejoindre la session">
  <div id="qr" class="qr"></div>
  <p class="qr-code">Code <strong id="s-code"></strong></p>
</aside>
<script src="<?= wl_asset('qrcode.js') ?>"></script>
<script src="<?= wl_asset('common.js') ?>"></script>
<script src="<?= wl_asset('charts.js') ?>"></script>
<script src="<?= wl_asset('screen.js') ?>"></script>
</body>
</html>
