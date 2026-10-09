<?php
// Espace animateur : connexion, sessions, questions, pilotage en direct.
// Logique dans assets/admin.js ; toutes les actions passent par api.php.
declare(strict_types=1);
require __DIR__ . '/lib.php';
wl_config();
wl_security_headers();
header('Cache-Control: no-store');
?>
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>WoocLight — Animateur</title>
<link rel="stylesheet" href="assets/style.css">
</head>
<body class="admin">
<header class="topbar"><span class="brand">WoocLight</span><span class="topbar-title">Animateur</span>
  <button id="logout-btn" class="btn btn-ghost" type="button" hidden>Se déconnecter</button></header>
<main id="main" tabindex="-1">
  <div id="banner" class="banner" role="status" aria-live="polite" hidden></div>

  <section id="login" class="card narrow" hidden>
    <h1>Connexion animateur</h1>
    <form id="login-form">
      <label for="password">Mot de passe</label>
      <input id="password" type="password" autocomplete="current-password" required>
      <p id="login-error" class="error" role="alert"></p>
      <button class="btn btn-primary btn-block" type="submit">Se connecter</button>
    </form>
  </section>

  <section id="sessions" hidden>
    <h1>Mes sessions</h1>
    <form id="create-form" class="row">
      <label for="new-title" class="sr-only">Titre de la nouvelle session</label>
      <input id="new-title" placeholder="Titre de la nouvelle session" maxlength="120" required>
      <button class="btn btn-primary" type="submit">Créer</button>
    </form>
    <ul id="session-list" class="list"></ul>
  </section>

  <section id="editor" hidden>
    <p><button id="back-btn" class="btn btn-ghost" type="button">← Mes sessions</button></p>
    <div class="row wrap">
      <h1 id="ed-title" class="grow"></h1>
      <button id="rename-btn" class="btn" type="button">Renommer</button>
    </div>

    <div class="grid2">
      <div class="card">
        <h2>Rejoindre</h2>
        <div id="ed-qr" class="qr qr-admin"></div>
        <p>Code : <strong id="ed-code" class="code-big"></strong></p>
        <p class="break">Adresse : <a id="ed-url" href="#"></a></p>
        <p><a id="ed-screen" class="btn" target="_blank" rel="noopener">Ouvrir la projection</a></p>
        <p class="row wrap">
          <a id="ed-csv" class="btn">Exporter en CSV</a>
          <a id="ed-print" class="btn" target="_blank" rel="noopener">Version imprimable</a>
        </p>
        <p><span id="ed-participants"></span></p>
        <p><button id="end-btn" class="btn" type="button"></button></p>
      </div>

      <div class="card" id="live">
        <h2>Pilotage en direct</h2>
        <p id="live-pos" class="meta"></p>
        <p id="live-text" class="live-text"></p>
        <p id="live-state" class="live-state" aria-live="polite"></p>
        <div class="row wrap">
          <button class="btn" data-op="prev" type="button">← Précédente</button>
          <button class="btn" data-op="next" type="button">Suivante →</button>
        </div>
        <div class="row wrap">
          <button class="btn btn-primary" id="open-btn" type="button"></button>
          <button class="btn" id="show-btn" type="button"></button>
          <button class="btn btn-danger" data-op="reset" type="button">Réinitialiser</button>
        </div>
        <div id="live-results" class="live-results"></div>
      </div>
    </div>

    <div class="card">
      <h2>Questions</h2>
      <ol id="q-list" class="list q-list"></ol>
      <p><button id="add-q-btn" class="btn btn-primary" type="button">+ Ajouter une question</button></p>
    </div>

    <dialog id="q-dialog" aria-labelledby="qd-title">
      <form id="q-form" method="dialog" novalidate>
        <h2 id="qd-title">Question</h2>
        <label for="qf-type">Type</label>
        <select id="qf-type">
          <option value="yesno">Oui / Non</option>
          <option value="truefalse">Vrai / Faux</option>
          <option value="mcq">QCM (quiz)</option>
          <option value="poll">Sondage</option>
          <option value="wordcloud">Nuage de mots</option>
          <option value="text">Réponse libre</option>
          <option value="scale">Échelle</option>
          <option value="points">Classement par points</option>
        </select>
        <label for="qf-text">Intitulé</label>
        <textarea id="qf-text" rows="2" maxlength="200" required></textarea>
        <div id="qf-options-box">
          <label for="qf-options">Choix (un par ligne, 2 à 10)</label>
          <textarea id="qf-options" rows="4"></textarea>
        </div>
        <label id="qf-multi-box" class="check"><input id="qf-multi" type="checkbox"> Plusieurs réponses possibles</label>
        <fieldset id="qf-correct-box"><legend>Bonne(s) réponse(s) (optionnel, pour un quiz)</legend><div id="qf-correct"></div></fieldset>
        <div id="qf-scale-box"><label for="qf-scale">Échelle</label>
          <select id="qf-scale"><option value="5">de 1 à 5</option><option value="10">de 1 à 10</option></select></div>
        <div id="qf-budget-box"><label for="qf-budget">Points à répartir</label>
          <input id="qf-budget" type="number" min="1" max="100" value="10"></div>
        <label for="qf-duration">Durée en secondes (0 = sans limite)</label>
        <input id="qf-duration" type="number" min="0" max="3600" step="5" value="0">
        <label class="check"><input id="qf-change" type="checkbox" checked> Les participants peuvent modifier leur réponse tant que le vote est ouvert</label>
        <p class="meta">Réponses toujours anonymes.</p>
        <p id="qf-error" class="error" role="alert"></p>
        <div class="row">
          <button class="btn btn-primary" id="qf-save" value="save" type="submit">Enregistrer</button>
          <button class="btn" id="qf-cancel" value="cancel" type="button">Annuler</button>
        </div>
      </form>
    </dialog>
  </section>
</main>
<script src="assets/qrcode.js"></script>
<script src="assets/common.js"></script>
<script src="assets/admin.js"></script>
</body>
</html>
