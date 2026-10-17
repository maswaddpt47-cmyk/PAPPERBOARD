<?php
// Page participant : saisie du code (ou arrivée par QR code), question active,
// réponse en un geste. Toute la logique est dans assets/app.js.
declare(strict_types=1);
require __DIR__ . '/lib.php';
wl_config();
wl_security_headers();
$days = (int)wl_config()['purge_days'];
// Mentions de confidentialité : dans config.php, pas dans le dépôt public.
$org = trim((string)wl_config()['responsable']) ?: 'l\'organisateur de l\'atelier';
$contact = trim((string)wl_config()['contact']) ?: 'l\'animateur de l\'atelier';
$legal = trim((string)wl_config()['base_legale']) ?: 'intérêt légitime de l\'organisateur à animer l\'atelier';
?>
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WoocLight — Participer</title>
<link rel="stylesheet" href="<?= wl_asset('style.css') ?>">
</head>
<body class="participant">
<header class="topbar"><span class="brand">WoocLight</span><span id="session-title" class="topbar-title"></span>
  <span class="size-tools"><button id="size-down" class="btn btn-ghost btn-size" type="button" aria-label="Texte plus petit" title="Texte plus petit">A−</button>
  <button id="size-up" class="btn btn-ghost btn-size" type="button" aria-label="Texte plus grand" title="Texte plus grand">A+</button></span></header>
<main id="main" tabindex="-1">
  <div id="banner" class="banner" role="status" aria-live="polite" hidden></div>

  <section id="join" class="card" hidden>
    <h1>Rejoindre l'atelier</h1>
    <form id="join-form" novalidate>
      <p id="join-info" class="join-info" role="status" hidden></p>
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
    <div id="recap" class="recap-box"></div>
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

  <section id="me-card" class="card me-card" hidden>
    <p id="pseudo-line" class="pseudo-line"></p>
    <p id="score-line" class="meta"></p>
  </section>

  <section id="asks" class="card" hidden aria-labelledby="asks-title">
    <h2 id="asks-title">Oser demander</h2>
    <p class="meta">Posez votre question sans votre nom. L'animateur la lit avant de l'afficher à tous.</p>
    <form id="ask-form" class="ask-form" novalidate>
      <label for="ask-text" class="sr-only">Votre question</label>
      <input id="ask-text" maxlength="80" autocomplete="off" placeholder="Votre question…">
      <button class="btn btn-primary" type="submit">Envoyer</button>
    </form>
    <p id="ask-error" class="error" role="alert"></p>
    <ul id="ask-list" class="ask-list"></ul>
  </section>

  <section id="signal" class="card signal-card" hidden aria-labelledby="signal-title">
    <h2 id="signal-title" class="signal-title">Un souci ? Dites-le à l'animateur</h2>
    <div class="signal-btns">
      <button type="button" class="btn btn-signal" data-kind="fast" aria-pressed="false">🐢 Trop vite</button>
      <button type="button" class="btn btn-signal" data-kind="again" aria-pressed="false">🔁 À réexpliquer</button>
      <button type="button" class="btn btn-signal" data-kind="help" aria-pressed="false">✋ Besoin d'aide</button>
    </div>
    <p id="signal-status" class="meta" role="status" aria-live="polite">Anonyme : l'animateur voit seulement combien de personnes l'ont signalé.</p>
  </section>
</main>
<footer class="footer">
  <details>
    <summary>Confidentialité</summary>
    <p><strong>En bref.</strong> Pas de nom, pas de compte. N'écrivez pas votre nom ni celui de
    quelqu'un d'autre dans vos réponses : ce que vous écrivez peut être affiché sur le grand écran,
    devant tout le groupe. Ce qui vient de vous est effacé du serveur <?= $days ?> jours après l'atelier (on ne garde que les résultats
    de groupe, comme « 2 personnes sur 3 ») ; les résultats
    que l'animateur a exportés pour le bilan restent sous sa responsabilité.</p>
    <p><strong>Responsable</strong> : <?= wl_h($org) ?>.
    <strong>But</strong> : animer l'atelier et en faire le bilan.
    <strong>Base légale</strong> : <?= wl_h($legal) ?>.</p>
    <p><strong>Données</strong> : vos réponses (et vos questions « Oser demander », publiées seulement après relecture par l'animateur) ;
    si l'animateur l'active, un pseudonyme tiré au hasard (ex. « Panda curieux ») et votre nombre de bonnes réponses aux quiz,
    effacés avec la session ; un identifiant au hasard enregistré sur cet appareil (téléphone, tablette ou ordinateur)
    pour une journée, qui évite les votes en double et permet de compter les appareils encore présents ; votre adresse IP, gardée seulement sous forme
    codée, 2 heures au plus, pour limiter les abus. Ces données ne disent pas qui vous êtes, mais elles
    ne sont pas « anonymes » au sens de la loi : elles sont pseudonymisées. Des réglages de confort (taille du texte,
    appareil choisi pour un défi) restent sur cet appareil, sans être envoyés au serveur.</p>
    <p><strong>Qui les voit</strong> : l'animateur ; les réponses qu'il publie sont projetées et
    visibles des participants ; il peut exporter les résultats pour le bilan de l'atelier.
    <strong>Liens</strong> : certaines questions proposent un lien vers un site extérieur choisi par l'animateur ; en l'ouvrant,
    vous quittez WoocLight et ce site applique ses propres règles.
    <strong>Hébergement</strong> : Alwaysdata, en France.
    <strong>Durée</strong> : <?= $days ?> jours après la dernière action de l'animateur, puis suppression de vos
    réponses et de l'identifiant de l'appareil ; seuls des résultats regroupés et anonymes sont archivés.</p>
    <p><strong>Vos droits</strong> (accès, effacement, opposition…) : pendant l'atelier, demandez à
    l'animateur de retirer une réponse ; ensuite, écrivez à : <?= wl_h($contact) ?>.
    Vous pouvez aussi saisir la CNIL (cnil.fr).</p>
  </details>
  <p><button id="leave-btn" class="btn btn-ghost" type="button" title="Quitter l'atelier : cet appareil ne garde plus rien de WoocLight">Quitter</button></p>
</footer>
<script src="<?= wl_asset('common.js') ?>"></script>
<script src="<?= wl_asset('app.js') ?>"></script>
</body>
</html>
