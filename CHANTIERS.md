# CHANTIERS — WoocLight

État au **16/10/2026** — commit de référence : voir `git log -1 main`.
**En ligne** sur https://wooclight.alwaysdata.net (déploiement automatique vert
à chaque mise à jour de `main`, vérifications après déploiement comprises).
`config.php` créé (CONFIG OK). Tests verts en CI (e2e, charge, configurer, protect).
Testé de bout en bout par l'utilisateur le 15/10/2026 (atelier « Temps d'écran »).

## Restant, par priorité — tout côté utilisateur

1. **À vérifier sur PC** (téléphone : seul le bouton principal de la projection est
   validé, 15/10/2026) : onglets de l'espace animateur, archive anonyme, synthèse
   enregistrée, post-its colorés, signaux, « Oser demander », pseudonymes et
   podium, brise-glaces, Vrai/Faux au toucher, « Rouvrir le vote », tri des
   barres de points ; ajouts du 16/10/2026 : « x actifs », bouton « ❓ Questions »,
   barre de pilotage allégée et glisser ← → au téléphone, démos à 4 thèmes, avant /
   après, « Clôture… », A− / A+ sur le téléphone, « Supprimer les démos ». Validé le
   16/10/2026 sur téléphone : nuage lisible et fluide, session de démonstration ;
   le reste à tester sur ordinateur. Le plus simple : **Créer une session de
   démonstration**. Puis un **atelier réel** à 10 participants ou plus.
2. **Régénérer « temps d'écran » avec Gemini** (nouvelles consignes) : plus de
   mauvaises réponses absurdes ni de trois échelles ?
3. **Appareils de l'atelier** : se connecter une fois à `admin.php` depuis
   chacun (sinon le blocage après échecs se fait par IP).
4. **Routine d'audit trimestriel** (`trig_01J6ZMsLHKbgXAQsRYgQL16q`, invisible
   pour Claude) : coller le bloc de `docs/routine-audit-trimestriel.md` dans ses
   instructions et lui attacher le dépôt. Ancienne routine
   `trig_018SBR4ihGT8Y2ud7sP5kxYm` désactivée le 10/10/2026 (à supprimer).
5. Facultatif : `contact` dans `config.php` (`php ~/www/configurer.php`, réponse
   `N` au mot de passe, SSH par mot de passe à rouvrir puis recouper). Journaux
   Apache et sauvegardes d'Alwaysdata à regarder une fois.

Fait côté hébergement (14/10/2026, déclaré) : HTTPS forcé, SSH par clé seule,
clés supprimées, secret `ALWAYSDATA_KNOWN_HOSTS` présent, ruleset sur `main`.

## Décisions à trancher

- **Durée de purge** : 30 jours sans action de l'animateur (défaut,
  `purge_days`). C'est à l'utilisateur, responsable de traitement, de la fixer.

- **Mode « non anonyme »** du cahier des charges : non codé. Il supposerait de
  demander un nom ou un pseudo, contraire à « aucune donnée personnelle ».
  Toutes les réponses sont anonymes. À rouvrir seulement sur besoin réel.
- **Classement par points** : le participant répartit entre 1 point et tout
  le budget (pas d'obligation de tout dépenser), pour ne pas bloquer un senior
  qui s'arrête à 8 sur 10. Changer dans `wl_clean_points()` si besoin.

## Limites connues

- `php -S` ignore `.htaccess` : le refus de `lib.php`, `config.php`, `data/`
  n'est testé que sur le vrai serveur, par l'étape « Vérifier la mise en
  ligne » de `ci-deploy.yml` (verte le 14/10/2026).
- Parcours navigateur (`tests/navigateur.js`) lancé seulement si Playwright
  est installé : en local oui, en CI non.
- Toutes les écritures d'une session passent par un verrou de fichier :
  150 arrivées + 150 votes simultanés en 340-450 ms (mesuré en local avec
  8 processus PHP, 09/10/2026). Non mesuré sur l'hébergement mutualisé.
- Limite par IP large (900 écritures/min) : une salle sort souvent par la même
  IP ; la vraie limite est par participant (30/min). IP lue dans `REMOTE_ADDR` :
  hypothèse non vérifiée que le proxy Alwaysdata y met l'IP du visiteur (sinon,
  limite par IP commune à tous, sans gravité).

- Plein écran de la projection : sans effet dans le Chrome du PC de
  l'utilisateur, fonctionne dans Edge (mesuré le 15/10/2026 : règle
  `FullscreenAllowed = false` imposée à ce Chrome). Le bouton affiche un
  message. Contournement : projeter avec Edge.

- Décompte « 3 / 5 ont répondu » (16/10/2026) : un téléphone éteint ou parti
  sort du dénominateur après 3 minutes sans signe de vie, pas immédiatement.
  Un téléphone en veille n'envoie plus de signe de vie (hypothèse non vérifiée
  sur le terrain : un téléphone posé écran éteint peut sortir du décompte).

- Identifiants de question tirés en hexadécimal : 1 fois sur 40 environ, tout en
  chiffres (« 24342264 »). Jamais comme clé de tableau PHP sans le remettre en
  chaîne (sinon entier, comparaison stricte ratée) : cause de l'échec
  intermittent du test « direct » trouvée le 15/10/2026.
## Points à ne pas défaire

Le comment est dans le code ; ici, le pourquoi et ce qu'il ne faut pas casser.
« (e2e) », « (nav) » : tenu par `tests/e2e.php`, `tests/navigateur.js`.

**Décisions de l'utilisateur**
- Projet personnel (14/10/2026) : ni charte, ni DPD, ni Archives du CD47.
  L'utilisateur est responsable de traitement ; mentions dans `config.php`,
  fiche `docs/registre-traitement.md` (V1 validée le 16/10/2026 ; la tenir à jour
  à chaque nouvelle donnée, avec les mentions « Confidentialité » d'`index.php`).
- Déploiement automatique à chaque avance de `main`, garde-fou : ruleset (tests).
- Archive anonyme au lieu de suppression (15/10/2026) : jamais jeton, réponse une
  à une, texte de participant, pseudonyme ni IP (e2e). Démos jamais archivées.
- Fin de session : conclusion seule (« À retenir ») sur projection et téléphones ;
  le détail passe par le bilan (touche B).
- Projection en direct : sondage, nuage, échelle, points dès l'ouverture du vote ;
  quiz et textes attendent le clic. Téléphones : résultats après « Afficher » (e2e).
- Toucher ou Envoyer : sondage, échelle, Oui/Non, Vrai/Faux envoient au toucher et
  restent modifiables ; QCM corrigé, réponse figée, QCM multiple : Envoyer (nav).
- « Suivante » vers une question jamais ouverte ouvre son vote.
- Post-its colorés d'après leur id, jamais par participant (anonymat).
- L'IA qui écrit ne relit pas ; WoocLight n'appelle aucune IA (copier-coller).
  ⚠️ Jamais de question d'âge légal ou de loi sans Légifrance.
- Pseudonymes : option par session, effacés à la désactivation ; podium rangs 1-3.

**Hébergement et outillage**
- Alwaysdata, compte `wooclight`, appli dans `~/www/` (variable GitHub
  `WOOCLIGHT_CHEMIN` = `www/`), données dans `~/wooclight-data`. Aucune clé à
  conserver : tout se recrée (README, `configurer.php`).
- Hook `SessionStart` (`.claude/settings.json`) : écrit par l'utilisateur seul,
  la plateforme l'interdit à Claude.

**Anonymat et sécurité**
- Mur, post-it, « Oser demander » : visibles des autres seulement après
  publication par l'animateur (un nom peut s'y glisser) ; auteur jamais servi (e2e).
- `reveal: end` refusé pour réponse libre, mur et post-it (e2e).
- Bilan pour une IA : réponses écrites décochées par défaut, masquées jamais.
- Signaux : animateur seul, jamais sur la projection (vue de la salle).
- Bilan projeté : ne montre que ce que la projection a déjà montré (e2e).
- Pilotage depuis la projection : cookie animateur puis `me` + `control` (CSRF).
- Jamais d'`innerHTML` ni de script ou style en ligne (CSP `default-src 'none'`).
- Jeton participant en HMAC, IP hachée ; clé participant dérivée du code.
- Audit Codex 10/10/2026, écartés : identités multiples (vote sans compte,
  « Fermer les inscriptions ») ; secret de projection (elle montre la salle).

**Coût et robustesse**
- Deux versions : `pversion` (téléphones) ne bouge pas quand un autre vote ;
  30 rafraîchissements sans changement = 30 × 304 (e2e « Coût »). Contributions
  et questions publiées réveillent les téléphones : coût accepté (rares).
- Signe de vie toutes les 60 s sans avancer de version (e2e) ; « x / n » compte
  les actifs (< 3 min, ou ayant répondu). ETag projection et animateur : + minute.
- Même réponse renvoyée = reprise réseau, acceptée même sans modification.
- Changer type, choix, échelle ou budget efface les réponses ; un vote ouvert
  reste ouvert (e2e).
- Identifiants de question parfois tout en chiffres : toujours en chaîne comme
  clé PHP. Identifiants de post préfixés `n`.
- `wl_asset()` (`?v=`) : sans lui, un navigateur garde l'ancien JS.
- Rsync sans `--delete` (`config.php` vit sur le serveur).
- Purge horaire à ne pas espacer (« 2 h au plus » de traces d'IP annoncées) ;
  `purge.php` note `last-cron`, affiché dans Réglages (passage vérifié le
  16/10/2026 à 21 h 00 : la tâche planifiée tourne). Seule l'activité de
  l'animateur repousse la purge. Verrous `rl/shard-*.lock` jamais supprimés.
- Session animateur : 2 h sans écriture, 12 h au plus ; blocage par appareil.
- Fermer ou afficher un vote sans réponse : confirmation (nav).
- Session : écran d'accueil d'abord (`current = -1`).
- Explication et synthèse : jamais envoyées avant les résultats / jamais aux
  téléphones (e2e). Export `.json` des questions sans aucune réponse (e2e).
- Gommettes : sur les post-its principaux publiés, une colonne possible (e2e).
- Démo (`WL_DEMO_THEMES`) : bonne réponse fixée par thème ; « Supprimer les démos ». Les
  12 participants fictifs répondent aussi aux questions ajoutées (sauf mur et post-it)
  et 10 restent « actifs » (`wl_demo_simulate`, e2e) ; démos anciennes : 12 premiers inscrits.
  Avec « fonctions en essai » cochées, la démo se termine par le défi à étapes (nav).

**Affichage**
- Charte « Papier & Terre » (`INTEGRATION.md`) : bonne réponse en vert avec coche,
  jamais la couleur seule ; contraste AA, y compris cartes en thème sombre.
- `fitResults` : tout tient sans défilement (1280x720). Sous 760 px, pas de
  marge pour le QR (nuage à 251 px sur 449 sinon).
- Glissement des lignes (`playFlip`) : mur et gommettes seulement. Sur le nuage,
  il divisait la police par 2 à chaque mise à jour (16/10/2026, non testé : le
  nuage à 2 mots du test ne reproduit pas). Flottement du nuage : vertical
  seulement, phase d'après l'horloge, `will-change` (fluide, validé 16/10/2026).
- Animations : barres mises à jour sur place ; seul un élément nouveau porte `is-new`.
- Mur : « j'aime » seulement publié et vote ouvert ; le bouton central publie
  donc avant de fermer.
- PowerPoint : barres dessinées en formes, anneau et jauge en graphiques natifs.
- Projection sur écran étroit : rien ne dépasse la largeur (gommettes : grille à 3
  colonnes fixes = 509 px sur 390, corrigé le 16/10/2026 ; nav, 390 px).
- Pilotage au téléphone : glisser ← → (≥ 60 px, horizontal) ; le bouton central est
  caché à l'étape « Question suivante » (le glisser fait pareil), jamais aux autres (nav).
- Défi à étapes (`steps`, 16/10/2026, en essai) : titres d'étapes communs ; variantes
  facultatives par appareil (2 à 4 : Windows, Mac, iPhone, Android…), même nombre
  d'étapes ; l'appareil choisi reste dans le navigateur, jamais envoyé ; décocher
  retire la réponse (tout décoché = plus compté). Visible seulement avec Réglages >
  « fonctions en essai » (réglage serveur `prefs.json`, commun à tous les appareils de
  l'animateur, écrit sous verrou : une écriture qui échoue renvoie une erreur, e2e) ; le serveur accepte le type dans tous
  les cas. Menus des défis prêts à l'emploi : à vérifier sur appareils (e2e, nav).
- Audit Codex à passer sur les ajouts du 15 au 17/10/2026 (lien d'exercice, `prefs_save`,
  défi, avant / après, démo) : consigne prête `docs/consigne-audit-codex-17-10-2026.md`.
- AGORA (`AGORA.md`, `CLAUDE.md` §6, 17/10/2026) : AG-001 (format `steps`/variantes) et
  AG-002 (`prefs.json`) ouverts après coup. L'utilisateur colle « pull, lis AGORA.md,
  réponds à AG-00N, tu es la session B » dans une autre session, puis tranche. Chaque
  « décision à trancher » ci-dessus est candidate à un bloc.
- Lien d'exercice (`link`, 17/10/2026) : https seulement, avec un domaine (jamais une IP
  ni un identifiant dans l'adresse) : `wl_clean_link` (e2e). Le participant voit le site
  avant de partir (nouvel onglet, `noopener`) ; la projection montre un QR dessiné dans le
  navigateur (aucun service externe) ; un lien venu d'un texte collé est signalé « à vérifier ».
  Jamais demandé à l'IA (elle inventerait des adresses). Fiche et mentions à jour.
- Avant / après (`compare`, 16/10/2026) : quiz (bonne réponse) ou échelle posés deux
  fois, même type et mêmes choix, « avant » placé avant (`wl_compare_shape`, e2e).
  **Agrégats seulement** (% de bonnes réponses, moyenne) : jamais relier un
  participant d'un passage à l'autre (anonymat). Visible avec les résultats sur la
  projection, dans le bilan, le PowerPoint et le CSV ; pas sur le téléphone.
- Onglets : les tests cliquent l'onglet avant d'agir (panneau masqué).
- Taille du texte du téléphone (A− / A+, `html[data-size]`, stockage local, effacée
  par « Quitter » : promesse « ne garde plus rien ») ; tout est en `rem` (nav).
- Clôture prête à l'emploi : ajoutée par l'import (validé côté serveur), à la fin (nav).

## Pistes d'amélioration

*Proposées, en attente :*
- 16/10/2026 — Exercices pratiques après un quiz. (1) Défi à étapes : **en ligne
  le 16/10/2026, en essai** (voir « Points à ne pas défaire »). (2) Lien d'exercice avec QR code : **en ligne
  le 17/10/2026**. (3) Fiche mémo à emporter (Word/PDF) : à décider. Limite : tout est déclaratif.
  La plupart des ateliers se font sur ordinateur (dire « appareil », pas « téléphone »).
*Faites le 16/10/2026* : avant / après, clôture prête à l'emploi, taille du texte,
défi à étapes (en essai).
*Écartées :* 15/10/2026 — génération par API (bouton « Générer ») : l'utilisateur
y renonce, le copier-coller suffit.
