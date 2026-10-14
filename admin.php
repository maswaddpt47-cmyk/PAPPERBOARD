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
          <a id="ed-csv" class="btn">Exporter en CSV (tout)</a>
          <a id="ed-csv-public" class="btn">CSV à diffuser (sans réponses masquées)</a>
          <a id="ed-print" class="btn" target="_blank" rel="noopener">Version imprimable</a>
        </p>
        <p><span id="ed-participants"></span></p>
        <p class="row wrap"><button id="lock-btn" class="btn" type="button"></button>
          <button id="end-btn" class="btn" type="button"></button></p>
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
      <p class="row wrap"><button id="add-q-btn" class="btn btn-primary" type="button">+ Ajouter une question</button>
        <button id="gen-btn" class="btn" type="button">Générer à partir d'un thème</button></p>
    </div>

    <dialog id="gen-dialog" aria-labelledby="gen-title">
      <form id="gen-form" method="dialog" novalidate>
        <h2 id="gen-title">Générer des questions avec une IA</h2>
        <p class="meta">1. Décrivez l'atelier, copiez le texte et collez-le dans Claude, ChatGPT ou Le Chat.
          N'y mettez aucun nom ni donnée personnelle.</p>
        <label for="gen-theme">Thème</label>
        <input id="gen-theme" maxlength="200" placeholder="ex. Reconnaître un message frauduleux">
        <div class="row wrap">
          <div class="grow"><label for="gen-public">Public</label>
            <select id="gen-public">
              <option>tout public</option>
              <option>seniors débutants</option>
              <option>collégiens</option>
              <option>professionnels de l'accompagnement</option>
            </select></div>
          <div><label for="gen-count">Nombre de questions</label>
            <input id="gen-count" type="number" min="3" max="20" value="10"></div>
        </div>
        <p><button id="gen-copy" class="btn btn-primary" type="button">Copier le texte pour l'IA</button>
          <span id="gen-copied" class="meta" aria-live="polite"></span></p>
        <textarea id="gen-prompt" rows="4" readonly aria-label="Texte à coller dans l'IA" hidden></textarea>
        <p class="meta">2. Collez ici toute la réponse de l'IA, puis vérifiez.</p>
        <label for="gen-raw" class="sr-only">Réponse de l'IA</label>
        <textarea id="gen-raw" rows="5" maxlength="60000"></textarea>
        <p><button id="gen-check" class="btn" type="button">Vérifier la réponse</button></p>
        <div id="gen-preview" hidden>
          <p class="meta">3. Décochez ce que vous ne gardez pas. <strong>Vérifiez les bonnes réponses des quiz : une IA peut se tromper.</strong></p>
          <ol id="gen-list" class="list gen-list"></ol>
        </div>
        <p id="gen-error" class="error" role="alert"></p>
        <div class="row">
          <button class="btn btn-primary" id="gen-save" type="submit" disabled>Ajouter les questions cochées</button>
          <button class="btn" id="gen-cancel" type="button">Fermer</button>
        </div>
      </form>
    </dialog>

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
          <option value="wall">Mur collaboratif</option>
          <option value="postit">Post-it collectif</option>
          <option value="dots">Vote par gommettes</option>
        </select>
        <label for="qf-text">Intitulé</label>
        <textarea id="qf-text" rows="2" maxlength="200" required></textarea>
        <div id="qf-options-box">
          <label for="qf-options" id="qf-options-label">Choix (un par ligne, 2 à 10)</label>
          <textarea id="qf-options" rows="4"></textarea>
        </div>
        <label id="qf-multi-box" class="check"><input id="qf-multi" type="checkbox"> Plusieurs réponses possibles</label>
        <fieldset id="qf-correct-box"><legend>Bonne(s) réponse(s) (optionnel, pour un quiz)</legend><div id="qf-correct"></div></fieldset>
        <div id="qf-scale-box"><label for="qf-scale">Échelle</label>
          <select id="qf-scale"><option value="5">de 1 à 5</option><option value="10">de 1 à 10</option></select></div>
        <div id="qf-source-box"><label for="qf-source">Idées à départager : celles de la question</label>
          <select id="qf-source"></select>
          <p class="meta">Les idées n'apparaissent qu'une fois cette question publiée.</p></div>
        <div id="qf-budget-box"><label for="qf-budget" id="qf-budget-label">Points à répartir</label>
          <input id="qf-budget" type="number" min="1" max="100" value="10"></div>
        <label for="qf-duration">Durée en secondes (0 = sans limite)</label>
        <input id="qf-duration" type="number" min="0" max="3600" step="5" value="0">
        <label for="qf-reveal">Correction et résultats</label>
        <select id="qf-reveal">
          <option value="manual">Quand je clique sur « Afficher les résultats »</option>
          <option value="end">Automatiquement à la fin du temps (durée obligatoire)</option>
          <option value="instant">Immédiate : chaque participant voit la correction dès qu'il a répondu</option>
        </select>
        <label class="check"><input id="qf-change" type="checkbox" checked> Les participants peuvent modifier leur réponse tant que le vote est ouvert</label>
        <p class="meta">Aucun nom n'est demandé, mais une réponse écrite peut en contenir un : relisez avant de publier.</p>
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
