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
    <div class="tabs" role="tablist" aria-label="Mes sessions">
      <button class="tab" role="tab" type="button" id="t-sessions" aria-controls="tab-sessions" data-tab="sessions">Sessions</button>
      <button class="tab" role="tab" type="button" id="t-archives" aria-controls="tab-archives" data-tab="archives">Archives</button>
    </div>
    <div id="tab-sessions" class="tab-panel" role="tabpanel" aria-labelledby="t-sessions">
    <form id="create-form" class="row">
      <label for="new-title" class="sr-only">Titre de la nouvelle session</label>
      <input id="new-title" placeholder="Titre de la nouvelle session" maxlength="120" required>
      <button class="btn btn-primary" type="submit">Créer</button>
    </form>
    <p class="row wrap"><button id="demo-btn" class="btn" type="button" title="Session remplie de participants fictifs (une question de chaque type, Oser demander, pseudonymes, signaux) pour vérifier tous les écrans seul ; à supprimer ensuite">Créer une session de démonstration</button>
      <button id="demo-delete" class="btn btn-danger" type="button" title="Efface toutes les sessions de démonstration (aucune archive)" hidden>Supprimer toutes les démos</button></p>
    <div class="card">
      <h2>Bibliothèque de séances</h2>
      <p class="meta">Des séances prêtes à animer, créées d'un clic (questions, avant / après, défi, conclusion). Ce sont des
        <strong>brouillons à relire</strong> : rien n'a encore été validé sur le terrain, ajustez-les avant l'atelier.</p>
      <p class="row wrap"><label for="seance-select" class="sr-only">Séance à créer</label>
        <select id="seance-select"><option value="">Choisir une séance…</option></select>
        <button id="seance-btn" class="btn" type="button">Créer cette séance</button>
        <button id="seance-review" class="btn" type="button" title="Copie une consigne et la séance, à coller dans une autre IA qui la relit et renvoie une version corrigée">Copier la consigne de relecture</button>
        <button id="seance-del" class="btn btn-danger" type="button" hidden>Supprimer ce thème</button></p>
      <p id="seance-info" class="meta" aria-live="polite"></p>
      <p id="seance-copied" class="meta" aria-live="polite"></p>
      <textarea id="seance-prompt" rows="6" readonly hidden aria-label="Consigne de relecture"></textarea>
      <details id="seance-add">
        <summary>Ajouter un thème (version relue par une IA, ou le vôtre)</summary>
        <p class="meta">Collez la réponse de l'IA : seule la liste de questions, du « [ » au « ] », est lue ; le thème est vérifié avant d'être gardé.
          Pour garder une session que vous avez construite, utilisez « Enregistrer comme thème » dans son bilan.</p>
        <div class="form-grid">
          <label for="seance-new-title">Titre</label><input id="seance-new-title" maxlength="120">
          <label for="seance-new-public">Public</label><input id="seance-new-public" maxlength="160">
          <label for="seance-new-duree">Durée</label><input id="seance-new-duree" maxlength="60">
          <label for="seance-new-prerequis">Prérequis</label><input id="seance-new-prerequis" maxlength="160">
          <label for="seance-new-objectif">Objectif</label><input id="seance-new-objectif" maxlength="200">
        </div>
        <label for="seance-new-raw" class="sr-only">Questions du thème</label>
        <textarea id="seance-new-raw" rows="6" placeholder="Collez ici la réponse de l'IA (la liste commençant par « [ »)"></textarea>
        <p class="row wrap"><button id="seance-new-save" class="btn btn-primary" type="button">Enregistrer le thème</button>
          <span id="seance-new-msg" class="meta" aria-live="polite"></span></p>
      </details>
    </div>
    <ul id="session-list" class="list"></ul>
    </div>
    <div id="tab-archives" class="tab-panel" role="tabpanel" aria-labelledby="t-archives" hidden>
    <p class="meta">Après 30 jours sans activité (ou sur « Archiver »), une session devient une archive anonyme :
      questions, résultats chiffrés, récap, conclusion et synthèse sont gardés ; les réponses une à une, les textes
      écrits par les participants et les jetons des appareils sont effacés. Les archives se gardent sans limite.</p>
    <ul id="archive-list" class="list"></ul>
    </div>
  </section>

  <section id="archive-view" hidden>
    <p><button id="archive-back" class="btn btn-ghost" type="button">← Mes sessions</button></p>
    <h1 id="ar-title"></h1>
    <p id="ar-meta" class="meta"></p>
    <p class="row wrap">
      <button id="ar-pptx" class="btn btn-primary" type="button" data-src="<?= wl_asset('pptxgen.bundle.js') ?>" title="Bilan en diapositives : questions, résultats, récap, synthèse, conclusion">Exporter en PowerPoint</button>
      <button id="ar-reuse" class="btn" type="button" title="Nouvelle session avec les mêmes questions et la même conclusion, sans résultats">Réutiliser les questions</button>
      <button id="ar-delete" class="btn btn-danger" type="button">Supprimer l'archive</button>
      <span id="ar-status" class="meta" aria-live="polite"></span></p>
    <div id="ar-recap" class="card"></div>
    <div id="ar-synthesis-box" class="card" hidden><h2>Synthèse et recommandations</h2><p id="ar-synthesis" class="pre-wrap"></p></div>
    <div id="ar-board" class="bilan-board"></div>
  </section>

  <section id="editor" hidden>
    <p><button id="back-btn" class="btn btn-ghost" type="button">← Mes sessions</button></p>
    <div class="row wrap">
      <h1 id="ed-title" class="grow"></h1>
      <span id="ed-participants" class="meta"></span>
    </div>

    <div class="tabs" role="tablist" aria-label="Session">
      <button class="tab" role="tab" type="button" id="t-prep" aria-controls="tab-prep" data-tab="prep" title="Questions, génération par IA, conclusion">Préparer</button>
      <button class="tab" role="tab" type="button" id="t-live" aria-controls="tab-live" data-tab="live" title="Inviter les participants, piloter le vote">Animer</button>
      <button class="tab" role="tab" type="button" id="t-bilan" aria-controls="tab-bilan" data-tab="bilan" title="Tableau de bord, synthèse par une IA, PowerPoint, exports">Bilan</button>
      <button class="tab" role="tab" type="button" id="t-settings" aria-controls="tab-settings" data-tab="settings" title="Renommer, terminer, archiver, supprimer">Réglages</button>
    </div>

    <div id="tab-prep" class="tab-panel" role="tabpanel" aria-labelledby="t-prep">
    <div class="card">
      <h2>Questions</h2>
      <p class="row wrap"><label for="all-duration" title="Chaque question aura cette durée de vote, avec compte à rebours sur la projection">Durée pour toutes les questions, en secondes (0 = sans limite)</label>
        <input id="all-duration" type="number" min="0" max="3600" step="5" value="30">
        <button id="all-duration-btn" class="btn" type="button" title="Donne cette durée à toutes les questions de la session (un vote en cours garde son compte à rebours)">Appliquer à toutes</button></p>
      <ol id="q-list" class="list q-list"></ol>
      <p class="row wrap"><button id="add-q-btn" class="btn btn-primary" title="Créer une question à la main" type="button">+ Ajouter une question</button>
        <button id="gen-btn" class="btn" title="Préparer des questions avec une IA (copier-coller) ou importer un fichier .json" type="button">Générer ou importer (JSON)</button></p>
      <p class="row wrap"><label for="ice-select" class="sr-only">Brise-glace</label>
        <select id="ice-select" title="Une question d'échauffement prête à l'emploi, modifiable ensuite">
          <option value="">Brise-glace…</option>
          <option value="meteo">☀️ Votre météo du jour</option>
          <option value="energie">🔋 Votre niveau d'énergie (1 à 5)</option>
          <option value="mot">💬 Un mot pour vous décrire aujourd'hui</option>
          <option value="appli">📱 L'appli que vous ouvrez le plus</option>
          <option value="sms">📞 Plutôt SMS ou appel ?</option>
          <option value="photo">📷 Plutôt photo ou vidéo ?</option>
          <option value="papier">📖 Plutôt papier ou écran ?</option>
        </select>
        <button id="ice-btn" class="btn" type="button" title="Ajoute le brise-glace en tête de la session">Ajouter en premier</button></p>
      <p class="row wrap"><label for="end-select" class="sr-only">Clôture</label>
        <select id="end-select" title="Des questions de fin d'atelier prêtes à l'emploi, modifiables ensuite">
          <option value="">Clôture…</option>
          <option value="tout">🏁 Les trois questions de clôture</option>
          <option value="utile">⭐ Utilité de l'atelier (1 à 5)</option>
          <option value="retenu">💬 Un mot pour ce que vous retenez</option>
          <option value="pas">👣 Le prochain pas que vous voulez essayer</option>
        </select>
        <button id="end-btn-add" class="btn" type="button" title="Ajoute la clôture à la fin de la session">Ajouter à la fin</button></p>
      <p id="challenge-row" class="row wrap" hidden><label for="challenge-select" class="sr-only">Défi</label>
        <select id="challenge-select" title="Un défi pratique à étapes prêt à l'emploi, modifiable ensuite (essai)">
          <option value="">Défi à étapes (essai)…</option>
          <option value="notifs">🔕 Couper les notifications inutiles (Windows, Mac, iPhone, Android)</option>
          <option value="temps">⏱️ Regarder son temps d'écran (iPhone, Android)</option>
        </select>
        <button id="challenge-btn" class="btn" type="button" title="Ajoute le défi à la fin de la session">Ajouter à la fin</button></p>
    </div>

    <div class="card">
      <h2>Conclusion</h2>
      <p class="meta">Affichée avec le récap de l'atelier quand vous cliquez « Terminer la session » (projection et téléphones).</p>
      <label for="conclusion" class="sr-only">Conclusion de l'atelier</label>
      <textarea id="conclusion" rows="3" maxlength="600" placeholder="Ex. : À retenir : couper les écrans 1 h avant de dormir…"></textarea>
      <p class="row wrap"><button id="conclusion-btn" class="btn" type="button" title="Enregistrer la conclusion de cette session">Enregistrer la conclusion</button>
        <span id="conclusion-saved" class="meta" aria-live="polite"></span></p>
    </div>
    </div>

    <div id="tab-live" class="tab-panel" role="tabpanel" aria-labelledby="t-live" hidden>
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
        <p class="row wrap"><button id="lock-btn" class="btn" type="button"></button>
          <button id="qr-btn" class="btn" type="button"></button></p>
      </div>

      <div class="card" id="live">
        <h2>Pilotage en direct</h2>
        <p class="row wrap"><button id="asks-chip" class="btn btn-small" type="button" title="Aller à la carte « Oser demander », plus bas dans cet onglet"></button></p>
        <p id="signals" class="signals" aria-live="polite" title="Signaux anonymes envoyés depuis les téléphones ; chacun s'efface après 2 minutes"></p>
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

      <div class="grid2">
      <div class="card" id="asks-card">
        <h2>Oser demander</h2>
        <p class="meta">Questions anonymes des participants, à tout moment. Vous les lisez avant de les publier (un nom peut s'y glisser).</p>
        <p class="row wrap"><button id="asks-btn" class="btn" type="button"></button>
          <button id="asks-screen" class="btn" type="button" title="Projette les questions publiées, les plus votées d'abord"></button></p>
        <ul id="asks-admin" class="ask-list"></ul>
      </div>

      <div class="card" id="pseudo-card">
        <h2>Pseudonymes et classement</h2>
        <p class="meta">Option de cette session : chaque participant reçoit un pseudonyme au hasard (« Panda curieux ») ;
          les quiz corrigés comptent un point par bonne réponse. Seul le podium (rangs 1 à 3) est projeté.
          Les pseudonymes sont effacés si vous désactivez l'option, et jamais archivés.</p>
        <p class="row wrap"><button id="pseudo-btn" class="btn" type="button"></button>
          <button id="podium-btn" class="btn" type="button" title="Projette le podium (rangs 1 à 3)"></button></p>
        <ol id="ranking" class="ranking"></ol>
      </div>
      </div>
    </div>

    <div id="tab-bilan" class="tab-panel" role="tabpanel" aria-labelledby="t-bilan" hidden>
    <div class="card">
      <h2>Bilan de l'atelier</h2>
      <p class="meta">Tableau de bord de toutes les questions, et texte à coller dans une IA pour obtenir une synthèse,
        une conclusion et des recommandations. Sans la case ci-dessous, seuls des résultats regroupés partent : aucun texte écrit par un participant.</p>
      <label class="check" title="Textes des participants : relisez-les et masquez tout nom avant de les envoyer à une IA">
        <input id="bilan-texts" type="checkbox"> Inclure les textes des participants (réponses libres, mur, post-it, nuage de mots, idées des gommettes ; réponses masquées exclues)</label>
      <p class="row wrap"><button id="bilan-copy" class="btn btn-primary" type="button" title="Copie le bilan chiffré et la consigne de synthèse, à coller dans une IA">Copier le bilan pour une IA</button>
        <button id="bilan-pptx" class="btn btn-primary" type="button" data-src="<?= wl_asset('pptxgen.bundle.js') ?>" title="Une diapositive par question (graphiques modifiables), le récap et la conclusion : à présenter ou imprimer">Exporter en PowerPoint</button>
        <button id="bilan-show" class="btn" type="button" title="Affiche les résultats de toutes les questions">Voir le tableau de bord</button>
        <button id="bilan-screen" class="btn" type="button" title="Sur la projection, une question par diapositive avec ses résultats tels qu'ils ont été montrés ; flèches pour avancer"></button>
        <span id="bilan-copied" class="meta" aria-live="polite"></span></p>
      <textarea id="bilan-prompt" class="gen-prompt" rows="6" readonly hidden aria-label="Bilan à copier"></textarea>
      <div id="bilan-board" class="bilan-board" hidden></div>
      <label for="synthesis">Synthèse et recommandations de l'IA (relues ; visibles de vous seul et dans l'export PowerPoint)</label>
      <textarea id="synthesis" rows="8" maxlength="6000" placeholder="Collez ici la réponse de l'IA, après relecture."></textarea>
      <p class="row wrap"><button id="synthesis-btn" class="btn" type="button" title="Enregistrer la synthèse avec la session (effacée avec elle par la purge)">Enregistrer la synthèse</button>
        <span id="synthesis-saved" class="meta" aria-live="polite"></span></p>
      <p class="meta">Collez la conclusion proposée par l'IA dans la carte « Conclusion » de l'onglet Préparer, après l'avoir relue.</p>
    </div>

    <div class="card">
      <h2>Exports</h2>
        <p class="row wrap">
          <a id="ed-csv" class="btn" title="Toutes les réponses, réponses masquées comprises, pour Excel (bilan interne)">Exporter en CSV (tout)</a>
          <a id="ed-csv-public" class="btn" title="Réponses pour Excel, sans celles que vous avez masquées (à partager)">CSV à diffuser (sans réponses masquées)</a>
          <a id="ed-print" class="btn" title="Page des résultats à imprimer ou enregistrer en PDF" target="_blank" rel="noopener">Version imprimable</a>
          <a id="ed-memo" class="btn" title="Page à remettre aux participants : conclusion, explications, bonnes réponses et exercices, sans aucune réponse ni chiffre" target="_blank" rel="noopener">Fiche mémo à emporter</a>
          <button id="ed-theme" class="btn" type="button" title="Garde les questions de cette session comme thème de la bibliothèque (sans aucune réponse)">Enregistrer comme thème</button>
          <a id="ed-questions" class="btn" title="Enregistre les questions (sans aucune réponse) pour les réutiliser dans une autre session">Questions (.json, sans les réponses)</a>
        </p>
    </div>
    </div>

    <div id="tab-settings" class="tab-panel" role="tabpanel" aria-labelledby="t-settings" hidden>
    <div class="card">
      <h2>Réglages de la session</h2>
      <p class="row wrap"><button id="rename-btn" class="btn" title="Changer le titre de la session (affiché sur la projection)" type="button">Renommer</button>
        <button id="end-btn" class="btn" type="button"></button></p>
      <p class="row wrap"><button id="ed-archive" class="btn" type="button" title="Garde les questions et les résultats chiffrés, efface le détail des réponses (anonyme, sans limite de durée)">Archiver la session</button>
        <button id="ed-delete" class="btn btn-danger" type="button" title="Efface la session et toutes ses réponses">Supprimer la session</button></p>
      <label class="check" title="Montre le défi à étapes, encore en essai : le réglage vaut pour tous tes appareils, il n'apparaît nulle part ailleurs"><input id="beta-steps" type="checkbox"> Afficher les fonctions en essai (défi à étapes), sur tous mes appareils</label>
      <p id="cron-state" class="cron-state" role="status" title="Efface chaque heure les sessions trop anciennes et les traces d'IP de plus de 2 heures"></p>
    </div>
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
        <label class="check"><input id="gen-qcm" type="checkbox"> Que des quiz (QCM, Vrai/Faux, Oui/Non avec bonne réponse)</label>
        <label id="gen-defi-box" class="check" hidden><input id="gen-defi" type="checkbox"> Ajouter un défi pratique à étapes après les quiz (essai)</label>
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
          <option value="steps" id="qf-type-steps" hidden disabled>Défi à étapes (essai)</option>
        </select>
        <label for="qf-text">Intitulé</label>
        <textarea id="qf-text" rows="2" maxlength="200" required></textarea>
        <div id="qf-variants-box" hidden><label for="qf-variants" title="Les mêmes étapes, détaillées pour chaque système : le participant choisit le sien une fois">Variantes par appareil (facultatif)</label>
          <textarea id="qf-variants" rows="8" placeholder="[Windows]&#10;Ouvre les Paramètres.&#10;Va dans Système puis Notifications.&#10;&#10;[Mac]&#10;Ouvre Réglages Système.&#10;Va dans Notifications."></textarea>
          <p class="meta">Une ligne « [Nom] » ouvre une variante (2 à 4 : Windows, Mac, iPhone, Android…), suivie d'une ligne par étape. Même nombre d'étapes que la liste des titres, 160 caractères au plus par étape.</p></div>
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
        <div id="qf-compare-box" hidden><label for="qf-compare" title="Même question posée plus tôt : l'écart (bonnes réponses ou moyenne) s'affiche avec les résultats, dans le bilan et le PowerPoint">Comparer avec une question précédente (avant / après)</label>
          <select id="qf-compare"></select></div>
        <label for="qf-explain" title="Encadré affiché sous les résultats, sur la projection et les téléphones, jamais avant">Explication affichée avec les résultats (facultatif, 400 caractères)</label>
        <textarea id="qf-explain" rows="3" maxlength="400" placeholder="Ex. : Vrai — la lumière bleue freine la mélatonine. Source : …"></textarea>
        <label for="qf-link" title="Les participants ouvrent le lien depuis la question ; la projection affiche un QR code pour le scanner. Vérifie l'adresse avant l'atelier.">Lien d'un exercice (facultatif, https://…)</label>
        <input id="qf-link" type="text" inputmode="url" maxlength="300" autocomplete="off" placeholder="https://…">
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
<script src="<?= wl_asset('charts.js') ?>"></script>
<script src="<?= wl_asset('bilan-pptx.js') ?>"></script>
<script src="<?= wl_asset('seances.js') ?>"></script>
<script src="<?= wl_asset('admin.js') ?>"></script>
</body>
</html>
