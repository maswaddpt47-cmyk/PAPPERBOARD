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
<link rel="stylesheet" href="assets/style.css">
</head>
<body class="screen">
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
    <div id="s-results" class="s-results" aria-live="polite"></div>
  </section>
  <section id="s-ended" class="s-welcome" hidden><p class="s-join-line">Session terminée. Merci !</p></section>
</main>
<aside class="qr-corner" aria-label="Rejoindre la session">
  <div id="qr" class="qr"></div>
  <p class="qr-code">Code <strong id="s-code"></strong></p>
</aside>
<script src="assets/qrcode.js"></script>
<script src="assets/common.js"></script>
<script src="assets/screen.js"></script>
</body>
</html>
