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
<link rel="stylesheet" href="<?= wl_asset('style.css') ?>">
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
      <button id="rename-btn" class="btn" title="Changer le titre de la session (affiché sur la projection)" type="button">Renommer</button>
    </div>

    <div class="grid2">
      <div class="card">
        <h2>Rejoindre</h2>
        <div id="ed-qr" class="qr qr-admin"></div>
        <p>Code : <strong id="ed-code" class="code-big"></strong></p>
        <p class="break">Adresse : <a id="ed-url" href="#"></a></p>
        <p class="row wrap"><button id="ed-url-copy" class="btn" title="Copie un message avec le lien et le code, à coller dans un SMS ou un mail" type="button">Copier l'invitation</button>
          <button id="ed-url-share" class="btn" title="Envoie l'invitation par SMS, WhatsApp… (menu de partage du téléphone)" type="button" hidden>Partager</button>
          <span id="ed-url-copied" class="meta" aria-live="polite"></span></p>
        <p><a id="ed-screen" class="btn" title="Ouvre l'écran à projeter dans un nouvel onglet ; connecté ici, vous pouvez le piloter" target="_blank" rel="noopener">Ouvrir la projection</a></p>
        <p class="row wrap">
          <a id="ed-csv" class="btn" title="Toutes les réponses, réponses masquées comprises, pour Excel (bilan interne)">Exporter en CSV (tout)</a>
          <a id="ed-csv-public" class="btn" title="Réponses pour Excel, sans celles que vous avez masquées (à partager)">CSV à diffuser (sans réponses masquées)</a>
          <a id="ed-print" class="btn" title="Page des résultats à imprimer ou enregistrer en PDF" target="_blank" rel="noopener">Version imprimable</a>
          <a id="ed-questions" class="btn" title="Enregistre les questions (sans aucune réponse) pour les réutiliser dans une autre session">Questions (.json, sans les réponses)</a>
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
          <button class="btn" data-op="prev" title="Revenir à la question précédente sur la projection" type="button">← Précédente</button>
          <button class="btn" data-op="next" title="Passer à la question suivante (ouvre son vote si elle ne l'a jamais été)" type="button">Suivante →</button>
        </div>
        <div class="row wrap">
          <button class="btn btn-primary" id="open-btn" type="button"></button>
          <button class="btn" id="show-btn" type="button"></button>
          <button class="btn btn-danger" data-op="reset" title="Efface toutes les réponses de cette question pour la reposer" type="button">Réinitialiser</button>
        </div>
        <div id="live-results" class="live-results"></div>
      </div>
    </div>

    <div class="card">
      <h2>Questions</h2>
      <p class="row wrap"><label for="all-duration" title="Chaque question aura cette durée de vote, avec compte à rebours sur la projection">Durée pour toutes les questions, en secondes (0 = sans limite)</label>
        <input id="all-duration" type="number" min="0" max="3600" step="5" value="30">
        <button id="all-duration-btn" class="btn" type="button" title="Donne cette durée à toutes les questions de la session (un vote en cours garde son compte à rebours)">Appliquer à toutes</button></p>
      <ol id="q-list" class="list q-list"></ol>
      <p class="row wrap"><button id="add-q-btn" class="btn btn-primary" title="Créer une question à la main" type="button">+ Ajouter une question</button>
        <button id="gen-btn" class="btn" title="Préparer des questions avec une IA (copier-coller) ou importer un fichier .json" type="button">Générer ou importer (JSON)</button></p>
    </div>

    <div class="card">
      <h2>Conclusion</h2>
      <p class="meta">Affichée avec le récap de l'atelier quand vous cliquez « Terminer la session » (projection et téléphones).</p>
      <label for="conclusion" class="sr-only">Conclusion de l'atelier</label>
      <textarea id="conclusion" rows="3" maxlength="600" placeholder="Ex. : À retenir : couper les écrans 1 h avant de dormir…"></textarea>
      <p class="row wrap"><button id="conclusion-btn" class="btn" type="button" title="Enregistrer la conclusion de cette session">Enregistrer la conclusion</button>
        <span id="conclusion-saved" class="meta" aria-live="polite"></span></p>
    </div>

    <div class="card">
      <h2>Bilan de l'atelier</h2>
      <p class="meta">Tableau de bord de toutes les questions, et texte à coller dans une IA pour obtenir une synthèse,
        une conclusion et des recommandations. Seuls des résultats regroupés partent, jamais l'identité d'un participant.</p>
      <label class="check" title="Réponses libres, mur et post-it : relisez-les et masquez tout nom avant de les envoyer à une IA">
        <input id="bilan-texts" type="checkbox"> Inclure les réponses écrites (réponses libres, mur, post-it ; réponses masquées exclues)</label>
      <p class="row wrap"><button id="bilan-copy" class="btn btn-primary" type="button" title="Copie le bilan chiffré et la consigne de synthèse, à coller dans une IA">Copier le bilan pour une IA</button>
        <button id="bilan-pptx" class="btn btn-primary" type="button" data-src="<?= wl_asset('pptxgen.bundle.js') ?>" title="Une diapositive par question (graphiques modifiables), le récap et la conclusion : à présenter ou imprimer">Exporter en PowerPoint</button>
        <button id="bilan-show" class="btn" type="button" title="Affiche les résultats de toutes les questions">Voir le tableau de bord</button>
        <span id="bilan-copied" class="meta" aria-live="polite"></span></p>
      <textarea id="bilan-prompt" class="gen-prompt" rows="6" readonly hidden aria-label="Bilan à copier"></textarea>
      <div id="bilan-board" class="bilan-board" hidden></div>
      <p class="meta">Collez ensuite la conclusion proposée par l'IA dans la carte « Conclusion » ci-dessus, après l'avoir relue.</p>
    </div>

    <dialog id="gen-dialog" aria-labelledby="gen-title">
      <form id="gen-form" method="dialog" novalidate>
        <h2 id="gen-title">Générer ou importer des questions</h2>
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
        <p><button id="gen-copy" class="btn btn-primary" title="Copie la consigne à coller dans ChatGPT, Le Chat, Claude…" type="button">Copier le texte pour l'IA</button>
          <span id="gen-copied" class="meta" aria-live="polite"></span></p>
        <textarea id="gen-prompt" rows="4" readonly aria-label="Texte à coller dans l'IA" hidden></textarea>
        <p class="meta">2. Collez ici toute la réponse de l'IA, ou importez un fichier JSON au même format
          (étape 1 inutile dans ce cas), puis vérifiez.</p>
        <p><label for="gen-file" class="btn">Importer un fichier .json</label>
          <input id="gen-file" class="sr-only" type="file" accept=".json,.txt,application/json,text/plain"></p>
        <label for="gen-raw" class="sr-only">Réponse de l'IA ou contenu du fichier</label>
        <textarea id="gen-raw" rows="5" maxlength="60000"></textarea>
        <p><button id="gen-check" class="btn" title="Contrôle la réponse de l'IA et affiche l'aperçu des questions" type="button">Vérifier la réponse</button></p>
        <div id="gen-preview" hidden>
          <p class="meta">3. Décochez ce que vous ne gardez pas. <strong>Vérifiez les bonnes réponses des quiz : une IA peut se tromper.</strong></p>
          <ol id="gen-list" class="list gen-list"></ol>
          <p class="meta">Facultatif, pour un nouveau thème ou un public sensible : faites relire par une <strong>autre</strong> IA
            que celle qui a écrit les questions (nouvelle conversation). Elle doit citer ses sources :
            <strong>ouvrez chaque lien avant de vous y fier</strong>, une IA peut en inventer.</p>
          <p><button id="gen-review" class="btn" title="Copie une consigne pour faire relire les questions par une autre IA que celle qui les a générées, sources exigées" type="button">Copier la consigne de relecture</button>
            <span class="meta">À coller dans une <strong>autre IA</strong> que celle qui a généré les questions.</span>
            <span id="gen-review-copied" class="meta" aria-live="polite"></span></p>
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
        <label id="qf-multi-box" class="check" title="Le participant peut cocher plusieurs choix"><input id="qf-multi" type="checkbox"> Plusieurs réponses possibles</label>
        <fieldset id="qf-correct-box"><legend>Bonne(s) réponse(s) (optionnel, pour un quiz)</legend><div id="qf-correct"></div></fieldset>
        <div id="qf-scale-box"><label for="qf-scale">Échelle</label>
          <select id="qf-scale"><option value="5">de 1 à 5</option><option value="10">de 1 à 10</option></select></div>
        <div id="qf-source-box"><label for="qf-source" title="Les gommettes se collent sur les post-its ou messages de cette question">Idées à départager : celles de la question</label>
          <select id="qf-source"></select>
          <div id="qf-column-box" hidden><label for="qf-column" title="Seules les idées de cette colonne reçoivent des gommettes">Colonne</label>
            <select id="qf-column"></select></div>
          <p class="meta">Les idées n'apparaissent qu'une fois cette question publiée.</p></div>
        <div id="qf-budget-box"><label for="qf-budget" id="qf-budget-label" title="Nombre de points à répartir ; pour les gommettes, nombre de gommettes par personne">Points à répartir</label>
          <input id="qf-budget" type="number" min="1" max="100" value="10"></div>
        <label for="qf-explain" title="Encadré affiché sous les résultats, sur la projection et les téléphones, jamais avant">Explication affichée avec les résultats (facultatif, 400 caractères)</label>
        <textarea id="qf-explain" rows="3" maxlength="400" placeholder="Ex. : Vrai — la lumière bleue freine la mélatonine. Source : …"></textarea>
        <label for="qf-duration" title="Compte à rebours du vote ; 0 = pas de limite">Durée en secondes (0 = sans limite)</label>
        <input id="qf-duration" type="number" min="0" max="3600" step="5" value="0">
        <label for="qf-reveal" title="Quand la bonne réponse et les résultats s'affichent">Correction et résultats</label>
        <select id="qf-reveal">
          <option value="manual">Quand je clique sur « Afficher les résultats »</option>
          <option value="end">Automatiquement à la fin du temps (durée obligatoire)</option>
          <option value="instant">Immédiate : chaque participant voit la correction dès qu'il a répondu</option>
        </select>
        <label id="qf-live-box" class="check" title="Sondage, nuage, échelle, points : la projection se met à jour à chaque vote, sans clic"><input id="qf-live" type="checkbox" checked> Afficher les réponses en direct sur la projection, dès l'ouverture du vote</label>
        <label class="check" title="Le participant peut changer son vote avant la fermeture ; ignoré si la correction est immédiate"><input id="qf-change" type="checkbox" checked> Les participants peuvent modifier leur réponse tant que le vote est ouvert</label>
        <p class="meta">Aucun nom n'est demandé, mais une réponse écrite peut en contenir un : relisez avant de publier.</p>
        <p id="qf-error" class="error" role="alert"></p>
        <div class="row">
          <button class="btn btn-primary" id="qf-save" title="Enregistrer la question dans la session" value="save" type="submit">Enregistrer</button>
          <button class="btn" id="qf-cancel" title="Fermer sans enregistrer" value="cancel" type="button">Annuler</button>
        </div>
      </form>
    </dialog>
  </section>
</main>
<script src="<?= wl_asset('qrcode.js') ?>"></script>
<script src="<?= wl_asset('common.js') ?>"></script>
<script src="<?= wl_asset('bilan-pptx.js') ?>"></script>
<script src="<?= wl_asset('admin.js') ?>"></script>
</body>
</html>
