<?php
// Page participant : saisie du code (ou arrivée par QR code), question active,
// réponse en un geste. Toute la logique est dans assets/app.js.
declare(strict_types=1);
require __DIR__ . '/lib.php';
wl_config();
wl_security_headers();
$days = (int)wl_config()['purge_days'];
?>
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WoocLight — Participer</title>
<link rel="stylesheet" href="assets/style.css">
</head>
<body class="participant">
<header class="topbar"><span class="brand">WoocLight</span><span id="session-title" class="topbar-title"></span></header>
<main id="main" tabindex="-1">
  <div id="banner" class="banner" role="status" aria-live="polite" hidden></div>

  <section id="join" class="card" hidden>
    <h1>Rejoindre l'atelier</h1>
    <form id="join-form" novalidate>
      <label for="code">Code affiché à l'écran (5 caractères)</label>
      <input id="code" name="code" class="input-code" autocomplete="off" autocapitalize="characters"
             spellcheck="false" maxlength="5" inputmode="text" required aria-describedby="join-error">
      <p id="join-error" class="error" role="alert"></p>
      <button class="btn btn-primary btn-block" type="submit">Rejoindre</button>
    </form>
  </section>

  <section id="wait" class="card center" hidden>
    <p class="big">Vous avez rejoint l'atelier.</p>
    <p>La question apparaîtra ici dès que l'animateur la lancera.</p>
  </section>

  <section id="ended" class="card center" hidden>
    <p class="big">La session est terminée.</p>
    <p>Merci pour votre participation !</p>
  </section>

  <section id="question" class="card" hidden aria-labelledby="q-text">
    <p id="q-meta" class="meta"></p>
    <h1 id="q-text" class="q-text"></h1>
    <p id="q-timer" class="timer" aria-live="off" hidden></p>
    <form id="answer-form" novalidate></form>
    <p id="answer-status" class="answer-status" role="status" aria-live="polite"></p>
    <div id="my-result" class="my-result" hidden></div>
  </section>
</main>
<footer class="footer">
  <details>
    <summary>Confidentialité</summary>
    <p>WoocLight ne demande ni nom, ni adresse e-mail, ni compte. Votre téléphone reçoit un
    identifiant aléatoire qui sert seulement à éviter les votes en double. Votre adresse IP
    n'est pas enregistrée en clair : elle est transformée de façon irréversible pour limiter
    les abus. N'écrivez pas de nom ni d'information personnelle dans les réponses libres.
    Les réponses sont supprimées automatiquement <?= $days ?> jours après la dernière activité de la session.
    Responsable : Conseil départemental de Lot-et-Garonne — délégué à la protection des données :
    contact-dpd@lotetgaronne.fr.</p>
  </details>
</footer>
<script src="assets/common.js"></script>
<script src="assets/app.js"></script>
</body>
</html>
