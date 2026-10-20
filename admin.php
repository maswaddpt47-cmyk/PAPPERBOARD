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
<link rel="icon" type="image/svg+xml" href="<?= wl_asset('favicon.svg') ?>">
<meta name="robots" content="noindex">
<title>WoocLight — Animateur</title>
<link rel="stylesheet" href="<?= wl_asset('style.css') ?>">
<link rel="stylesheet" href="<?= wl_asset('interface.css') ?>">
<link rel="stylesheet" href="<?= wl_asset('interface-php.css') ?>">
</head>
<body class="admin is-login">
<a class="skip-link" href="#main">Aller au contenu</a>
<svg class="sprite" aria-hidden="true" focusable="false" width="0" height="0">
  <symbol id="i-grid" viewBox="0 0 24 24"><path d="M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7"/></symbol>
  <symbol id="i-list" viewBox="0 0 24 24"><path d="M9 5h12M9 12h12M9 19h12M3 5h.01M3 12h.01M3 19h.01"/></symbol>
  <symbol id="i-book" viewBox="0 0 24 24"><path d="M12 6c-3-3-7-3-10-2v15c3-1 7-1 10 2m0-15c3-3 7-3 10-2v15c-3-1-7-1-10 2V6Z"/></symbol>
  <symbol id="i-clock" viewBox="0 0 24 24"><path d="M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0"/></symbol>
  <symbol id="i-play" viewBox="0 0 24 24"><path d="m8 5 11 7-11 7V5Z"/></symbol>
  <symbol id="i-pause" viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></symbol>
  <symbol id="i-chart" viewBox="0 0 24 24"><path d="M3 3v18h18M7 16v-4m5 4V7m5 9v-7"/></symbol>
  <symbol id="i-settings" viewBox="0 0 24 24"><path d="m9 3-1 3-3 1-2 3 2 2v3l3 1 2 3h4l1-3 3-1 2-3-2-2V7l-3-1-2-3H9Zm6 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0"/></symbol>
  <symbol id="i-phone" viewBox="0 0 24 24"><path d="M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm4 16h2"/></symbol>
  <symbol id="i-screen" viewBox="0 0 24 24"><path d="M3 3h18v14H3V3Zm5 18h8m-4-4v4"/></symbol>
  <symbol id="i-menu" viewBox="0 0 24 24"><path d="M3 6h18M3 12h18M3 18h18"/></symbol>
  <symbol id="i-arrow-left" viewBox="0 0 24 24"><path d="M19 12H5m6-6-6 6 6 6"/></symbol>
  <symbol id="i-arrow-right" viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6"/></symbol>
  <symbol id="i-chevron-right" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></symbol>
  <symbol id="i-arrow-up" viewBox="0 0 24 24"><path d="M12 19V5m-6 6 6-6 6 6"/></symbol>
  <symbol id="i-arrow-down" viewBox="0 0 24 24"><path d="M12 5v14m-6-6 6 6 6-6"/></symbol>
  <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
  <symbol id="i-check" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></symbol>
  <symbol id="i-check-circle" viewBox="0 0 24 24"><path d="M22 11.1V12a10 10 0 1 1-5.9-9.1 M22 4 12 14l-3-3"/></symbol>
  <symbol id="i-eye" viewBox="0 0 24 24"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm13 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0"/></symbol>
  <symbol id="i-eye-off" viewBox="0 0 24 24"><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A12 12 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.5 4.4M6.1 6.1A18 18 0 0 0 2 12s3.5 7 10 7a12 12 0 0 0 5.1-1.1"/></symbol>
  <symbol id="i-users" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.9M15 3.1a4 4 0 0 1 0 7.8M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0"/></symbol>
  <symbol id="i-edit" viewBox="0 0 24 24"><path d="m16 3 5 5M4 16 16.5 3.5a3.5 3.5 0 0 1 5 5L9 21H3l1-5Z"/></symbol>
  <symbol id="i-trash" viewBox="0 0 24 24"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></symbol>
  <symbol id="i-copy" viewBox="0 0 24 24"><path d="M9 9h12v12H9V9Zm6-4V3H3v12h2"/></symbol>
  <symbol id="i-download" viewBox="0 0 24 24"><path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"/></symbol>
  <symbol id="i-external" viewBox="0 0 24 24"><path d="M15 3h6v6m0-6L10 14M10 3H3v18h18v-7"/></symbol>
  <symbol id="i-refresh" viewBox="0 0 24 24"><path d="M3 11a9 9 0 0 1 15.5-6.2L21 7M21 2v5h-5m5 6a9 9 0 0 1-15.5 6.2L3 17m0 5v-5h5"/></symbol>
  <symbol id="i-hand" viewBox="0 0 24 24"><path d="M8 13V5a2 2 0 0 1 4 0v6-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v9a7 7 0 0 1-7 7h-1a7 7 0 0 1-5-2l-5-5a2 2 0 0 1 3-3l3 1V8"/></symbol>
  <symbol id="i-help" viewBox="0 0 24 24"><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3m.1 4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0"/></symbol>
  <symbol id="i-sparkles" viewBox="0 0 24 24"><path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7L12 3ZM20 2v4m-2-2h4"/></symbol>
  <symbol id="i-close" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></symbol>
  <symbol id="i-sliders" viewBox="0 0 24 24"><path d="M3 6h9M16 6h5M3 12h3M10 12h11M3 18h13M20 18h1"/><circle cx="14" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></symbol>
  <symbol id="i-logout" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></symbol>
</svg>
<button class="nav-overlay" id="nav-overlay" type="button" aria-label="Fermer la navigation" tabindex="-1" hidden></button>
<div class="app-shell">
<aside class="sidebar" id="sidebar" aria-label="Navigation principale">
  <p class="sidebar-brand brand"><span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span><span class="brand-word">Wooc<span>Light</span><small>LE LIEN FAIT L’ATELIER</small></span></p>
  <p class="nav-label">Mon espace</p>
  <nav class="main-nav" aria-label="Espace animateur">
    <button type="button" class="nav-item" data-nav="overview" title="Vue d’ensemble"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-grid"/></svg><span class="nav-copy">Vue d’ensemble</span></button>
    <button type="button" class="nav-item" data-nav="library" title="Bibliothèque de modèles"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-book"/></svg><span class="nav-copy">Bibliothèque de modèles</span></button>
    <button type="button" class="nav-item" data-nav="history" title="Mes ateliers"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-clock"/></svg><span class="nav-copy">Mes ateliers</span></button>
    <button type="button" class="nav-item" data-nav="workshop" title="L'atelier ouvert" aria-disabled="true"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-list"/></svg><span class="nav-copy">Atelier en cours<span class="sidebar-session" id="sidebar-session" hidden><strong id="sidebar-session-title"></strong><span class="sidebar-session-meta" id="sidebar-session-status"></span></span></span><span class="nav-dot" aria-hidden="true" hidden></span></button>
  </nav>
  <div class="sidebar-bottom">
    <div class="sidebar-tip"><svg class="icon" aria-hidden="true"><use href="#i-sparkles"/></svg><strong>À vous de jouer.</strong><p>Préparez, invitez et animez. Un espace pour apprendre ensemble.</p><button id="help-open" class="btn btn-small" type="button" title="Consulter le parcours d’animation">Comment animer ? <svg class="icon" aria-hidden="true" focusable="false"><use href="#i-arrow-right"/></svg></button></div>

    <span class="profile-avatar avatar" aria-hidden="true">A</span>
    <span class="profile-copy"><strong>Espace animateur</strong></span>
    <button id="logout-btn" class="btn btn-ghost btn-small" type="button" aria-label="Se déconnecter" title="Se déconnecter" hidden><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-logout"/></svg><span class="nav-copy">Se déconnecter</span></button>
  </div>
</aside>
<div class="main-shell">
<header class="shell-topbar topbar">
  <button class="btn btn-ghost mobile-menu" id="menu-toggle" type="button" aria-label="Ouvrir la navigation" aria-expanded="false" aria-controls="sidebar"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-menu"/></svg></button>
  <span class="brand shell-brand">WoocLight</span>
  <nav class="breadcrumb" aria-label="Fil d'Ariane"><span class="breadcrumb-root">Mon espace</span><span class="breadcrumb-chevron" aria-hidden="true"><svg class="icon" focusable="false"><use href="#i-chevron-right"/></svg></span><strong id="crumb-current">Animateur</strong></nav>
</header>
<main id="main" class="workspace" tabindex="-1">
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
    <div id="space-overview" class="space-view">
      <div class="page-heading">
        <div class="heading-copy">
          <p class="eyebrow">Votre espace</p>
          <h1 class="page-title" id="ov-title">Un atelier, des échanges.</h1>
          <p class="page-subtitle" id="ov-subtitle">Préparez simplement. Gardez le contact avec votre groupe.</p>
        </div>
        <div class="heading-actions">
          <button id="create-btn" class="btn btn-primary" type="button"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-plus"/></svg>Créer un atelier</button>
          <button id="ov-resume" class="btn" type="button" hidden><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-arrow-right"/></svg>Reprendre l’atelier</button>
        </div>
      </div>
      <div id="ov-current" class="card-grid" hidden>
        <section class="card content-card session-summary">
          <div class="question-topline"><span id="ov-state" class="badge"></span><span id="ov-demo" class="badge neutral" hidden>Démonstration</span></div>
          <h2 id="ov-name"></h2>
          <p id="ov-meta" class="muted"></p>
          <div class="library-meta"><span><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-users"/></svg><span id="ov-participants"></span></span><span><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-list"/></svg><span id="ov-questions"></span></span></div>
          <button id="ov-open" class="btn btn-primary" type="button"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-play"/></svg>Revenir à l’animation</button>
        </section>
        <section class="card content-card">
          <p class="eyebrow">Votre progression</p>
          <div class="metric-number"><span id="ov-explored">0</span><span id="ov-total"> / 0</span></div>
          <h2>questions explorées</h2>
          <p class="muted">Lancez les votes, regardez l’écran participant et retrouvez les résultats dans le bilan.</p>
          <button id="ov-help" class="btn btn-ghost" type="button"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-help"/></svg>Comment animer ?</button>
        </section>
      </div>
      <section id="ov-empty" class="card empty-state" hidden>
        <h2>À vous de préparer le prochain atelier</h2>
        <p>Vos futurs ateliers et leurs archives apparaîtront dans « Mes ateliers ».</p>
        <button class="btn" type="button" data-space="library"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-book"/></svg>Voir les modèles</button>
      </section>
      <div class="section-heading">
        <div><h2 class="panel-title">Une idée pour le prochain atelier ?</h2><p class="muted">Des séances prêtes à personnaliser.</p></div>
        <button class="btn btn-ghost" type="button" data-space="library"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-arrow-right"/></svg>Explorer la bibliothèque</button>
      </div>
      <div id="ov-ideas" class="card-grid"></div>
    </div>

    <div id="space-library" class="space-view" hidden>
      <div class="page-heading">
        <div class="heading-copy">
          <p class="eyebrow">Pour vous inspirer</p>
          <h1 class="page-title">Bibliothèque de modèles</h1>
          <p class="page-subtitle">Des modèles pour démarrer un nouvel atelier. Vos créations et leurs archives restent dans Mes ateliers.</p>
        </div>
        <div class="heading-actions"></div>
      </div>
      <div id="library-grid" class="card-grid library-grid"></div>
      <p class="info-note"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-sparkles"/></svg><span>Toutes les séances sont des brouillons à relire : rien n’a encore été validé sur le terrain. Relisez et adaptez les contenus avant un véritable atelier.</span></p>
    <div class="card" id="library-card">
      <h2>Gérer les séances</h2>
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
    </div>

    <div id="space-history" class="space-view" hidden>
      <div class="page-heading">
        <div class="heading-copy">
          <p class="eyebrow">Vos ateliers</p>
          <h1 class="page-title">Mes ateliers</h1>
          <p class="page-subtitle">Vos créations, leurs résultats et leurs archives.</p>
        </div>
        <div class="heading-actions">
          <button id="create-btn-history" class="btn btn-primary" type="button"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-plus"/></svg>Créer un atelier</button>
        </div>
      </div>
      <section class="card panel workshop-group">
        <div class="panel-head"><h2 class="panel-title">Ateliers en cours</h2><span id="session-count" class="muted"></span></div>
        <div id="session-list" class="history-list"></div>
      </section>
      <section class="card panel workshop-group">
        <div class="panel-head"><h2 class="panel-title">Ateliers archivés</h2><span id="archive-count" class="muted"></span></div>
        <div id="archive-list" class="history-list"></div>
      </section>
      <section class="card content-card demo-controls">
        <h2>Tester avec des participants fictifs</h2>
        <p>Pour créer une démonstration (12 participants fictifs, des réponses, des signaux et une question anonyme), utilisez « Créer un atelier ». Les démos sont repérées par le badge « Démo ».</p>
        <div class="session-actions">
          <button id="demo-delete" class="btn btn-danger" type="button" title="Efface toutes les sessions de démonstration (aucune archive)" hidden><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-trash"/></svg>Supprimer toutes les démos</button>
        </div>
        <p class="muted">La suppression groupée concerne uniquement les ateliers marqués « Démo ». Vos créations, imports et copies sont conservés.</p>
      </section>
      <p class="info-note">Archiver conserve les questions et les résultats chiffrés ; les réponses une à une, les textes des participants et les jetons des appareils sont effacés. Une session devient aussi une archive après 30 jours sans activité. Les archives se gardent sans limite.</p>
    </div>
  </section>

  <section id="archive-view" hidden>
    <p><button id="archive-back" class="btn btn-ghost" type="button"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-arrow-left"/></svg>Mes ateliers</button></p>
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
    <div class="page-heading">
      <div class="heading-copy">
        <p class="eyebrow">Votre atelier</p>
        <h1 id="ed-title" class="page-title"></h1>
        <p class="page-subtitle"><span id="ed-badge" class="badge"></span> <span id="ed-participants" class="meta"></span></p>
      </div>
      <div class="heading-actions">
        <button id="back-btn" class="btn btn-ghost" type="button"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-arrow-left"/></svg>Mes ateliers</button>
        <a id="ed-preview" class="btn" target="_blank" rel="noopener" title="Ouvre l'écran d'un participant dans un nouvel onglet"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-phone"/></svg>Aperçu participant</a>
        <a id="ed-open-screen" class="btn btn-primary" target="_blank" rel="noopener" title="Ouvre l'écran à projeter dans un nouvel onglet"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-screen"/></svg>Ouvrir la projection<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-external"/></svg></a>
      </div>
    </div>

    <div class="tabs view-tabs" id="workshop-tabs" role="tablist" aria-label="Étapes de l'atelier">
      <button class="tab" role="tab" type="button" id="t-prep" aria-controls="tab-prep" data-tab="prep" title="Questions, séquences prêtes, conclusion"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-list"/></svg>Préparer</button>
      <button class="tab" role="tab" type="button" id="t-control" aria-controls="tab-control" data-tab="control" title="Inviter les participants, accueil, signaux, Oser demander, pseudonymes"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-users"/></svg>Pilotage</button>
      <button class="tab" role="tab" type="button" id="t-live" aria-controls="tab-live" data-tab="live" title="Questions, vote et résultats"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-play"/></svg>Animer</button>
      <button class="tab" role="tab" type="button" id="t-bilan" aria-controls="tab-bilan" data-tab="bilan" title="Tableau de bord, synthèse par une IA, PowerPoint, exports"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-chart"/></svg>Bilan</button>
      <button class="tab" role="tab" type="button" id="t-settings" aria-controls="tab-settings" data-tab="settings" title="Renommer, terminer, archiver, supprimer"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-sliders"/></svg>Réglages</button>
    </div>

    <div id="tab-prep" class="tab-panel" role="tabpanel" aria-labelledby="t-prep">
    <section class="card prep-panel preparation-panel">
      <div class="section-heading">
        <div><h2>Le déroulé de votre atelier</h2>
          <p class="meta">Préparez vos questions ici. Le vote se lance depuis Animer.</p></div>
        <div class="row wrap">
          <button id="gen-btn" class="btn" title="Ajouter à cet atelier des questions générées par une IA (copier-coller) ou un fichier .json" type="button"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-download"/></svg>Ajouter depuis un JSON</button>
          <button id="add-q-btn" class="btn btn-primary" title="Créer une question à la main" type="button"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-plus"/></svg>Ajouter une question</button>
        </div>
      </div>
      <ol id="q-list" class="list q-list prep-list"></ol>
      <div class="duration-row">
        <label for="all-duration" title="Chaque question aura cette durée de vote, avec compte à rebours sur la projection">Durée de vote pour toutes les questions, en secondes (0 = sans limite)</label>
        <div class="row">
          <input id="all-duration" type="number" min="0" max="3600" step="5" value="30">
          <button id="all-duration-btn" class="btn" type="button" title="Donne cette durée à toutes les questions de la session (un vote en cours garde son compte à rebours)">Appliquer à toutes</button>
        </div>
      </div>
    </section>

    <div class="section-heading">
      <div><h2>Des séquences prêtes à ajouter</h2>
        <p class="meta">Un accueil, un geste pratique, une dernière parole : composez le rythme de votre atelier.</p></div>
    </div>
    <div class="quick-grid">
      <section class="quick-card">
        <div class="quick-card-title"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-sparkles"/></svg><h3>Brise-glace</h3></div>
        <p class="meta">Pour accueillir le groupe. La question est ajoutée en premier.</p>
        <label for="ice-select" class="sr-only">Brise-glace</label>
        <select id="ice-select" title="Une question d'échauffement prête à l'emploi, modifiable ensuite">
          <option value="">Choisir…</option>
          <option value="meteo">☀️ Votre météo du jour</option>
          <option value="energie">🔋 Votre niveau d'énergie (1 à 5)</option>
          <option value="mot">💬 Un mot pour vous décrire aujourd'hui</option>
          <option value="appli">📱 L'appli que vous ouvrez le plus</option>
          <option value="sms">📞 Plutôt SMS ou appel ?</option>
          <option value="photo">📷 Plutôt photo ou vidéo ?</option>
          <option value="papier">📖 Plutôt papier ou écran ?</option>
        </select>
        <button id="ice-btn" class="btn" type="button" title="Ajoute le brise-glace en tête de la session"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-plus"/></svg>Ajouter en premier</button>
      </section>
      <section class="quick-card">
        <div class="quick-card-title"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-check-circle"/></svg><h3>Clôture</h3></div>
        <p class="meta">Pour faire le point ensemble. Les questions sont ajoutées à la fin.</p>
        <label for="end-select" class="sr-only">Clôture</label>
        <select id="end-select" title="Des questions de fin d'atelier prêtes à l'emploi, modifiables ensuite">
          <option value="">Choisir…</option>
          <option value="tout">🏁 Les trois questions de clôture</option>
          <option value="utile">⭐ Utilité de l'atelier (1 à 5)</option>
          <option value="retenu">💬 Un mot pour ce que vous retenez</option>
          <option value="pas">👣 Le prochain pas que vous voulez essayer</option>
        </select>
        <button id="end-btn-add" class="btn" type="button" title="Ajoute la clôture à la fin de la session"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-plus"/></svg>Ajouter à la fin</button>
      </section>
      <section class="quick-card" id="challenge-row" hidden>
        <div class="quick-card-title"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-hand"/></svg><h3>Défi à étapes <span class="badge">essai</span></h3></div>
        <p class="meta">Un exercice pratique avec des consignes adaptées à l'appareil.</p>
        <label for="challenge-select" class="sr-only">Défi</label>
        <select id="challenge-select" title="Un défi pratique à étapes prêt à l'emploi, modifiable ensuite (essai)">
          <option value="">Choisir…</option>
          <option value="notifs">🔕 Couper les notifications inutiles (Windows, Mac, iPhone, Android)</option>
          <option value="temps">⏱️ Regarder son temps d'écran (iPhone, Android)</option>
        </select>
        <button id="challenge-btn" class="btn" type="button" title="Ajoute le défi à la fin de la session"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-plus"/></svg>Ajouter à la fin</button>
      </section>
    </div>

    <section class="card conclusion-card">
      <div class="section-heading"><div><p class="eyebrow">Le message à emporter</p>
      <h2>Conclusion de l'atelier</h2>
      <p class="meta muted">Affichée avec le récap de l'atelier quand vous cliquez « Terminer la session » (projection et appareils des participants). Également reprise dans la fiche mémo.</p></div>
      <svg class="icon" aria-hidden="true" focusable="false"><use href="#i-book"/></svg></div>
      <label for="conclusion" class="field-label">À retenir</label>
      <textarea id="conclusion" rows="4" maxlength="600" placeholder="Ex. : À retenir : couper les écrans 1 h avant de dormir…"></textarea>
      <p class="conclusion-actions"><button id="conclusion-btn" class="btn btn-primary" type="button" title="Enregistrer la conclusion de cette session"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-check"/></svg>Enregistrer la conclusion</button>
        <span class="meta">600 caractères au plus</span>
        <span id="conclusion-saved" class="meta" aria-live="polite"></span></p>
    </section>
    </div>

    <div id="tab-control" class="tab-panel" role="tabpanel" aria-labelledby="t-control" hidden>
      <div class="pilotage-toolbar">
        <p class="meta">Gérez l'accueil, les inscriptions et les échanges du groupe. Les questions et les votes se pilotent depuis Animer.</p>
        <button id="go-live" class="btn btn-primary" type="button"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-play"/></svg>Aller aux questions</button>
      </div>
      <div class="grid2 session-controls">
      <section class="card" id="join-card">
        <h2>Rejoindre l'atelier</h2>
        <div class="join-overview">
          <button id="ed-qr-zoom" class="qr-zoom" type="button" title="Agrandir le QR code" aria-label="Agrandir le QR code"><span id="ed-qr" class="qr qr-admin"></span></button>
          <div class="join-copy">
            <p>Code : <strong id="ed-code" class="code-big"></strong></p>
            <p id="ed-join-state" class="meta"></p>
            <p class="break"><a id="ed-url" href="#"></a></p>
          </div>
        </div>
        <p class="row wrap session-actions">
          <button id="ed-url-copy" class="btn btn-small" title="Copie un message avec le lien et le code, à coller dans un SMS ou un mail" type="button"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-copy"/></svg>Copier l'invitation</button>
          <button id="ed-url-share" class="btn btn-small" title="Envoie l'invitation par SMS, WhatsApp… (menu de partage de l'appareil)" type="button" hidden><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-external"/></svg>Partager</button>
          <a id="ed-screen" class="btn btn-primary btn-small" title="Ouvre l'écran à projeter dans un nouvel onglet ; connecté ici, vous pouvez le piloter" target="_blank" rel="noopener"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-screen"/></svg>Ouvrir la projection<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-external"/></svg></a>
          <button id="lock-btn" class="btn btn-small" type="button"></button>
          <button id="qr-btn" class="btn btn-small" type="button"></button></p>
        <p id="ed-url-copied" class="meta" aria-live="polite"></p>
      </section>

      <section class="card" id="direct-card">
        <h2>Pilotage en direct</h2>
        <p class="row wrap session-actions">
          <button id="welcome-btn" class="btn btn-small" type="button" title="La projection revient à l'accueil : adresse, code et QR code"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-screen"/></svg>Afficher l'accueil</button>
          <button id="asks-chip" class="btn btn-small" type="button" title="Les participants peuvent, ou non, poser une question anonyme depuis leur appareil"></button>
          <button id="end-control-btn" class="btn btn-danger btn-small" type="button" title="Terminer après confirmation, ou rouvrir la session pour reprendre les votes">Terminer la session</button></p>
        <p class="meta">Retours anonymes envoyés depuis les appareils ; chacun s'efface seul après 2 minutes.</p>
        <p id="signals" class="signals" aria-live="polite" title="Signaux anonymes envoyés depuis les appareils ; chacun s'efface après 2 minutes"></p>
        <p><button id="signals-clear" class="btn btn-ghost btn-small" type="button" title="Vous avez pris en compte les signaux : ils sont effacés tout de suite"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-check"/></svg>Effacer les signaux</button></p>
      <div class="pseudo-section" id="pseudo-card">
        <h3>Pseudonymes et classement</h3>
        <p class="row wrap session-actions"><button id="pseudo-btn" class="btn btn-small" type="button"></button>
          <button id="podium-btn" class="btn btn-small" type="button" title="Projette le podium (rangs 1 à 3)"></button></p>
        <p class="meta muted">Chaque participant reçoit un pseudonyme au hasard (« Panda curieux ») ;
          les quiz corrigés comptent un point par bonne réponse. Seul le podium (rangs 1 à 3) est projeté.
          Les pseudonymes sont effacés si vous désactivez l'option, et jamais archivés.</p>
        <ol id="ranking" class="ranking"></ol>
      </div>
      </section>
      </div>

      <div class="pilotage-questions">
      <section class="card" id="asks-card">
        <h2>Oser demander</h2>
        <p class="meta muted">Questions anonymes : relisez-les avant de les publier.</p>
        <p class="row wrap session-actions"><button id="asks-btn" class="btn btn-small" type="button"></button>
          <button id="asks-screen" class="btn btn-small" type="button" title="Projette les questions publiées, les plus votées d'abord"></button></p>
        <ul id="asks-admin" class="ask-list"></ul>
      </section>


      </div>
    </div>

    <div id="tab-live" class="tab-panel" role="tabpanel" aria-labelledby="t-live" hidden>
      <section class="live-summary live-session-summary" aria-label="État de la session">
        <div id="live-summary" class="live-summary-text"></div>
        <button id="go-control" class="btn btn-small" type="button"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-users"/></svg>Ouvrir Pilotage</button>
      </section>
      <div class="workbench">
        <aside class="card question-rail" aria-label="Questions de l'atelier">
          <div class="panel-head"><h2 class="panel-title">Les questions</h2><span id="rail-count" class="meta"></span></div>
          <ol id="rail-list" class="rail-list question-list"></ol>
          <p class="rail-footer"><button id="go-prep" class="btn btn-ghost btn-small" type="button"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-edit"/></svg>Gérer les questions</button></p>
        </aside>
        <section class="card current-panel" id="live">
          <nav class="question-nav" aria-label="Navigation entre les questions">
            <button class="btn btn-ghost btn-small" data-op="prev" title="Revenir à la question précédente sur la projection" type="button" aria-label="Précédente"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-arrow-left"/></svg><span class="nav-label">Précédente</span></button>
            <span id="live-pos" class="meta"></span>
            <div class="live-toolbar"><div class="toolbar-main">
              <button class="btn btn-primary" id="open-btn" type="button"></button>
              <button class="btn" id="show-btn" type="button"></button>
            </div></div>
            <button class="btn btn-small" data-op="next" title="Passer à la question suivante (ouvre son vote si elle ne l'a jamais été)" type="button" aria-label="Suivante"><span class="nav-label">Suivante</span><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-arrow-right"/></svg></button>
          </nav>
          <p id="live-badges" class="question-topline"></p>
          <h2 id="live-text" class="live-text question-title"></h2>
          <p id="live-state" class="live-state result-explainer" aria-live="polite"></p>
          <div id="live-results" class="live-results"></div>

        </section>
        <aside class="insights">
          <section class="card metric-card">
            <div class="panel-head"><h2 class="panel-title">Participation</h2><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-users"/></svg></div>
            <p class="metric-number"><span id="metric-answered">0</span><span id="metric-total" class="metric-of"></span></p>
            <p id="metric-caption" class="meta metric-caption"></p>
            <div class="progress-track" aria-hidden="true"><span id="metric-fill" class="progress-fill"></span></div>
            <p id="metric-wait" class="meta"></p>
          </section>
          <section class="card help-card"><h2 class="panel-title">Besoin d'un coup de main</h2><div id="live-signals"></div><p class="muted">Des signaux anonymes pour adapter votre rythme.</p><button id="live-clear-signals" class="btn btn-ghost btn-small" type="button" title="Effacer les signaux après les avoir pris en compte">C’est pris en compte</button></section>
          <section class="card inbox-card"><h2 class="panel-title">Une question pour vous</h2><span class="badge">Anonyme</span><p id="live-ask-text" class="inbox-question"></p><p id="live-ask-note" class="muted"></p><button id="live-ask-publish" class="btn btn-small" type="button" title="Publier cette question après relecture, ou la retirer de la projection"></button></section>
        </aside>
      </div>
      <div class="session-footer">
        <button class="btn btn-danger btn-small" data-op="reset" title="Efface toutes les réponses de cette question pour la reposer" type="button"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-refresh"/></svg>Réinitialiser la question</button>
        <button id="end-live-btn" class="btn btn-ghost btn-small" type="button"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-check-circle"/></svg><span id="end-live-label"></span></button>
      </div>
    </div>

    <div id="tab-bilan" class="tab-panel" role="tabpanel" aria-labelledby="t-bilan" hidden>
    <div class="section-heading recap-heading">
      <div><h2>Ce que l’atelier nous apprend</h2>
        <p class="meta muted">Les résultats de chaque question, tels que reçus. Synthèse et exports plus bas.</p></div>
      <div class="row wrap">
        <a id="recap-csv" class="btn" title="Toutes les réponses, réponses masquées comprises, pour Excel (bilan interne)"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-download"/></svg>Exporter les résultats</a>
        <a id="recap-memo" class="btn btn-primary" target="_blank" rel="noopener" title="Page à remettre aux participants : conclusion, explications, bonnes réponses et exercices, sans aucune réponse ni chiffre"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-book"/></svg>Fiche mémo</a>
      </div>
    </div>
    <div class="card-grid recap-metrics">
      <section class="card metric-card"><p id="recap-participants" class="metric-number">0</p><p class="metric-caption">participants inscrits</p></section>
      <section class="card metric-card"><p id="recap-questions" class="metric-number">0</p><p class="metric-caption">questions préparées</p></section>
      <section class="card metric-card"><p id="recap-total" class="metric-number">0</p><p class="metric-caption">réponses au total</p></section>
    </div>
    <div id="recap-board" class="recap-grid"></div>
    <div class="card">
      <h2>Bilan de l'atelier</h2>
      <p class="meta">Tableau de bord de toutes les questions, et texte à coller dans une IA pour obtenir une synthèse,
        une conclusion et des recommandations. Sans la case ci-dessous, seuls des résultats regroupés partent : aucun texte écrit par un participant.</p>
      <label class="check" title="Textes des participants : relisez-les et masquez tout nom avant de les envoyer à une IA">
        <input id="bilan-texts" type="checkbox"> Inclure les textes des participants (réponses libres, mur, post-it, nuage de mots, idées des gommettes ; réponses masquées exclues)</label>
      <p class="row wrap"><button id="bilan-copy" class="btn btn-primary" type="button" title="Copie le bilan chiffré et la consigne de synthèse, à coller dans une IA">Copier le bilan pour une IA</button>
        <button id="bilan-pptx" class="btn btn-primary" type="button" data-src="<?= wl_asset('pptxgen.bundle.js') ?>" title="Une diapositive par question (graphiques modifiables), le récap et la conclusion : à présenter ou imprimer">Exporter en PowerPoint</button>
        <button id="bilan-screen" class="btn" type="button" title="Sur la projection, une question par diapositive avec ses résultats tels qu'ils ont été montrés ; flèches pour avancer"></button>
        <span id="bilan-copied" class="meta" aria-live="polite"></span></p>
      <textarea id="bilan-prompt" class="gen-prompt" rows="6" readonly hidden aria-label="Bilan à copier"></textarea>
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
    <section class="card content-card settings-card">
      <h2>Entretien et conservation</h2>
      <p class="info-note" title="Efface chaque heure les sessions trop anciennes et les traces d'IP de plus de 2 heures"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-clock"/></svg><span><strong>Dernier passage de la purge horaire :</strong> <span id="cron-state" class="cron-state" role="status"></span></span></p>
      <p>Chaque heure, la purge archive puis efface les sessions restées sans activité au-delà de la durée de conservation (les démos sont effacées sans archive), et les traces d’adresse IP de plus de 2 heures.</p>
      <p class="muted">Cet indicateur affiche le passage réel de la tâche planifiée sur Alwaysdata.</p>
      <button class="btn" type="button" data-space="history"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-list"/></svg>Gérer mes ateliers et mes démos</button>
    </section>
    <section class="card content-card settings-card">
      <h2>Cette session</h2>
      <div class="session-actions"><button id="rename-btn" class="btn btn-small" title="Changer le titre de la session (affiché sur la projection)" type="button"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-edit"/></svg>Renommer</button>
        <button id="end-btn" class="btn btn-small" type="button"></button>
        <button id="ed-archive" class="btn btn-small" type="button" title="Garde les questions et les résultats chiffrés, efface le détail des réponses (anonyme, sans limite de durée)"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-book"/></svg>Archiver la session</button>
        <button id="ed-delete" class="btn btn-danger btn-small" type="button" title="Efface la session et toutes ses réponses"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-trash"/></svg>Supprimer la session</button></div>
      <label class="check-line" title="Montre le défi à étapes, encore en essai : le réglage vaut pour tous tes appareils, il n'apparaît nulle part ailleurs"><input id="beta-steps" type="checkbox"> Afficher les fonctions en essai (défi à étapes), sur tous mes appareils</label>
    </section>
    </div>
  </section>

  <dialog id="create-dialog" aria-labelledby="create-title">
    <form id="create-form" method="dialog" novalidate>
<header class="modal-head"><div><p class="eyebrow">Votre espace animateur</p><h2 id="create-title">Créer un atelier</h2></div><button class="btn btn-ghost icon-btn" type="button" data-dialog-cancel="create-cancel" aria-label="Fermer la fenêtre">×</button></header>
<div class="modal-body">
      <p class="meta">Donnez un nom à votre atelier et choisissez comment le préparer.</p>
      <label for="new-title">Nom de l'atelier</label>
      <input id="new-title" maxlength="120" required placeholder="ex. Repérer les arnaques en ligne">
      <fieldset class="choice-cards">
        <legend>Comment le préparer ?</legend>
        <label class="choice-card"><input type="radio" name="create-mode" id="create-empty" value="empty" checked>
          <span><strong>Partir d'un atelier vide</strong><span class="meta">Vous ajoutez les questions à la main dans Préparer.</span></span></label>
        <label class="choice-card"><input type="radio" name="create-mode" id="create-json" value="json">
          <span><strong>Générer ou importer un JSON</strong><span class="meta">Consigne pour une IA, réponse collée ou fichier ; rien n'est créé avant votre validation.</span></span></label>
        <label class="choice-card"><input type="radio" name="create-mode" id="create-demo" value="demo">
          <span><strong>Démonstration avec participants fictifs</strong><span class="meta">12 participants fictifs, une question de chaque type et des réponses pour tout essayer seul ; le nom ci-dessus n'est pas utilisé. À supprimer ensuite.</span></span></label>
      </fieldset>
      <p id="create-error" class="error" role="alert"></p>
      </div>
<div class="row wrap modal-actions">
        <button class="btn btn-primary" id="create-ok" type="submit">Créer l'atelier</button>
        <button class="btn" id="create-cancel" type="button">Annuler</button>
      </div>
</form>
</dialog>

  <dialog id="help-dialog" aria-labelledby="help-title"><h2 id="help-title">Préparer et animer votre atelier</h2><ol><li>Créez un atelier ou importez un JSON, puis relisez les questions.</li><li>Dans Pilotage, partagez le code et ouvrez les inscriptions.</li><li>Ouvrez la projection dans un nouvel onglet et placez-la sur l’écran du groupe.</li><li>Dans Animer, pilotez le vote et la visibilité des graphes et réponses.</li><li>Terminez la session, puis retrouvez la synthèse et les exports dans Bilan.</li></ol><p>Pour tester seul, choisissez « Démonstration » dans Créer un atelier.</p><button id="help-close" class="btn btn-primary" type="button">Fermer</button></dialog>
  <dialog id="rename-dialog" aria-labelledby="rename-title">
    <form id="rename-form" novalidate>
<header class="modal-head"><div><p class="eyebrow">Votre espace animateur</p><h2 id="rename-title">Renommer un atelier</h2></div><button class="btn btn-ghost icon-btn" type="button" data-dialog-cancel="rename-cancel" aria-label="Fermer la fenêtre">×</button></header>
<div class="modal-body">
      <p>Le nom sera actualisé sur les écrans de cet atelier. Les questions et les réponses sont conservées.</p>
      <label for="rename-title-input">Nom de l'atelier</label>
      <input id="rename-title-input" maxlength="120" required>
      <p id="rename-error" class="error" role="alert"></p>
      </div>
<div class="modal-actions"><button id="rename-cancel" class="btn" type="button">Annuler</button><button id="rename-save" class="btn btn-primary" type="submit">Enregistrer le nom</button></div>
</form>
</dialog>

  <dialog id="qr-dialog" class="qr-dialog" aria-labelledby="qr-dialog-title">
    <h2 id="qr-dialog-title">Rejoindre l'atelier</h2>
    <div id="qr-big" class="qr qr-big"></div>
    <p class="qr-dialog-code">Code <strong id="qr-big-code"></strong></p>
    <p class="break meta" id="qr-big-url"></p>
    <p><button id="qr-close" class="btn" type="button"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-close"/></svg>Fermer</button></p>
  </dialog>

  <dialog id="gen-dialog" class="gen-dialog" aria-labelledby="gen-title">
    <form id="gen-form" method="dialog" novalidate>
<header class="modal-head"><div><p class="eyebrow">Votre espace animateur</p><h2 id="gen-title">Générer ou importer des questions</h2></div><button class="btn btn-ghost icon-btn" type="button" data-dialog-cancel="gen-cancel" aria-label="Fermer la fenêtre">×</button></header>
<div class="modal-body generator-body">
      <p id="gen-for" class="meta"></p>
      <section class="gen-step">
        <h3><span class="number-bubble">1</span>Préparer une consigne pour une IA</h3>
        <p class="meta">Facultatif si vous avez déjà un fichier. Copiez le texte et collez-le dans Claude, ChatGPT ou Le Chat.
          N'y mettez aucun nom ni donnée personnelle.</p>
        <label for="gen-theme">Thème</label>
        <input id="gen-theme" maxlength="200" placeholder="ex. Reconnaître un message frauduleux">
        <div class="form-grid2">
          <div><label for="gen-public">Public</label>
            <select id="gen-public">
              <option>tout public</option>
              <option>seniors</option>
              <option>collégiens</option>
              <option>professionnels de l'accompagnement</option>
              <option value="autres">Autres</option>
            </select></div>
          <div><label for="gen-level">Niveau du public</label>
            <select id="gen-level">
              <option value="mixed">Groupe hétérogène</option>
              <option value="discovery">Découverte</option>
              <option value="beginner">Débutant</option>
              <option value="intermediate">Intermédiaire</option>
              <option value="advanced">Avancé</option>
            </select></div>
        </div>
        <div id="gen-public-other-box" hidden>
          <label for="gen-public-other">Précisez le public</label>
          <input id="gen-public-other" maxlength="160" placeholder="ex. demandeurs d'emploi accompagnés par une association">
        </div>
        <fieldset class="gen-size">
          <legend>Dimensionner l'atelier</legend>
          <label class="check"><input type="radio" name="gen-mode" id="gen-mode-count" value="count" checked> Fixer le nombre de questions</label>
          <label class="check"><input type="radio" name="gen-mode" id="gen-mode-duration" value="duration"> Fixer la durée de l'atelier</label>
          <div id="gen-count-box"><label for="gen-count">Nombre de questions (1 à 30)</label>
            <input id="gen-count" type="number" min="1" max="30" value="10"></div>
          <div id="gen-duration-box" hidden><label for="gen-duration">Durée de l'atelier, en minutes (15 à 180)</label>
            <input id="gen-duration" type="number" min="15" max="180" step="5" value="60"></div>
          <p id="gen-estimate" class="meta" aria-live="polite"></p>
        </fieldset>
        <label class="check"><input id="gen-qcm" type="checkbox"> Que des quiz (QCM, Vrai/Faux, Oui/Non avec bonne réponse)</label>
        <label id="gen-defi-box" class="check" hidden><input id="gen-defi" type="checkbox"> Ajouter un défi pratique à étapes après les quiz (essai)</label>
        <p class="row wrap"><button id="gen-copy" class="btn btn-primary" title="Copie la consigne à coller dans ChatGPT, Le Chat, Claude…" type="button"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-copy"/></svg>Copier le texte pour l'IA</button>
          <span id="gen-copied" class="meta" aria-live="polite"></span></p>
        <textarea id="gen-prompt" rows="4" readonly aria-label="Texte à coller dans l'IA" hidden></textarea>
      </section>
      <section class="gen-step">
        <h3><span class="number-bubble">2</span>Coller la réponse ou importer un fichier</h3>
        <p class="meta">Collez toute la réponse de l'IA, ou importez un fichier JSON au même format, puis vérifiez.</p>
        <p><label for="gen-file" class="btn"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-download"/></svg>Importer un fichier .json</label>
          <input id="gen-file" class="sr-only" type="file" accept=".json,.txt,application/json,text/plain"></p>
        <label for="gen-raw" class="sr-only">Réponse de l'IA ou contenu du fichier</label>
        <textarea id="gen-raw" rows="5" maxlength="60000"></textarea>
        <p><button id="gen-check" class="btn" title="Contrôle la réponse de l'IA et affiche l'aperçu des questions" type="button"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-check"/></svg>Vérifier la réponse</button></p>
      </section>
      <section id="gen-preview" class="gen-step" hidden>
        <h3><span class="number-bubble">3</span>Relire avant d'ajouter</h3>
        <p class="meta">Décochez ce que vous ne gardez pas. <strong>Vérifiez les bonnes réponses des quiz : une IA peut se tromper.</strong>
          L'aperçu ne prouve pas que le contenu est juste.</p>
        <ol id="gen-list" class="list gen-list"></ol>
        <div class="info-note">
          <p>Facultatif, pour un nouveau thème ou un public sensible : faites relire par une <strong>autre</strong> IA
            que celle qui a écrit les questions (nouvelle conversation). Elle doit citer ses sources :
            <strong>ouvrez chaque lien avant de vous y fier</strong>, une IA peut en inventer.
            Elle rend une liste de corrections puis la version JSON corrigée : collez cette version à la place
            de la réponse ci-dessus, puis cliquez de nouveau « Vérifier la réponse ».</p>
          <p><button id="gen-review" class="btn" title="Copie une consigne pour faire relire les questions par une autre IA que celle qui les a générées, sources exigées" type="button"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-copy"/></svg>Copier la consigne de relecture</button>
            <span class="meta">À coller dans une <strong>autre IA</strong> que celle qui a généré les questions.</span>
            <span id="gen-review-copied" class="meta" aria-live="polite"></span></p>
        </div>
      </section>
      <p id="gen-error" class="error" role="alert"></p>
      </div>
<div class="row wrap modal-actions">
        <button class="btn btn-primary" id="gen-save" type="submit" disabled>Ajouter les questions cochées</button>
        <button class="btn" id="gen-cancel" type="button">Fermer</button>
      </div>
</form>
</dialog>

    <dialog id="q-dialog" aria-labelledby="qd-title">
      <form id="q-form" method="dialog" novalidate>
<header class="modal-head"><div><p class="eyebrow">Votre espace animateur</p><h2 id="qd-title">Question</h2></div><button class="btn btn-ghost icon-btn" type="button" data-dialog-cancel="qf-cancel" aria-label="Fermer la fenêtre">×</button></header>
<div class="modal-body">
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
        </div>
<div class="row modal-actions">
          <button class="btn btn-primary" id="qf-save" title="Enregistrer la question dans la session" value="save" type="submit">Enregistrer</button>
          <button class="btn" id="qf-cancel" title="Fermer sans enregistrer" value="cancel" type="button">Annuler</button>
        </div>
</form>
</dialog>
</main>
<footer class="app-footer"><span>WoocLight · Un espace pour apprendre ensemble</span><span>Votre espace animateur</span></footer>
</div>
</div>
<script src="<?= wl_asset('qrcode.js') ?>"></script>
<script src="<?= wl_asset('common.js') ?>"></script>
<script src="<?= wl_asset('charts.js') ?>"></script>
<script src="<?= wl_asset('bilan-pptx.js') ?>"></script>
<script src="<?= wl_asset('seances.js') ?>"></script>
<script src="<?= wl_asset('admin.js') ?>"></script>
<script src="<?= wl_asset('shell.js') ?>"></script>
<script src="<?= wl_asset('interface.js') ?>"></script>
<script src="<?= wl_asset('tooltips.js') ?>"></script>
</body>
</html>
