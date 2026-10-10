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
    <div id="posts" class="posts" hidden></div>
  </section>
</main>
<footer class="footer">
  <details>
    <summary>Confidentialité</summary>
    <p><strong>En bref.</strong> Pas de nom, pas de compte. N'écrivez pas votre nom ni celui de
    quelqu'un d'autre dans vos réponses : ce que vous écrivez peut être affiché sur le grand écran,
    devant tout le groupe. Tout est effacé automatiquement <?= $days ?> jours après l'atelier.</p>
    <p><strong>Responsable</strong> : Conseil départemental de Lot-et-Garonne.
    <strong>But</strong> : animer l'atelier et en faire le bilan.
    <strong>Base légale</strong> : mission d'intérêt public du Département (médiation numérique).</p>
    <p><strong>Données</strong> : vos réponses ; un identifiant au hasard enregistré sur ce téléphone
    pour une journée, qui évite les votes en double ; votre adresse IP, gardée seulement sous forme
    codée, 2 heures au plus, pour limiter les abus. Ces données ne disent pas qui vous êtes, mais elles
    ne sont pas « anonymes » au sens de la loi : elles sont pseudonymisées.</p>
    <p><strong>Qui les voit</strong> : l'animateur ; les réponses qu'il publie sont projetées et
    visibles des participants ; il peut exporter les résultats pour le bilan du service.
    <strong>Hébergement</strong> : Alwaysdata, en France.
    <strong>Durée</strong> : <?= $days ?> jours après la dernière action de l'animateur, puis suppression.</p>
    <p><strong>Vos droits</strong> (accès, effacement, opposition…) : pendant l'atelier, demandez à
    l'animateur de retirer une réponse ; ensuite, écrivez au délégué à la protection des données :
    contact-dpd@lotetgaronne.fr. Vous pouvez aussi saisir la CNIL (cnil.fr).</p>
  </details>
</footer>
<script src="assets/common.js"></script>
<script src="assets/app.js"></script>
</body>
</html>
