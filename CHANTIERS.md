# CHANTIERS — WoocLight

État au **15/10/2026** — commit de référence : voir `git log -1 main`.
**En ligne** sur https://wooclight.alwaysdata.net (déploiement automatique vert
à chaque mise à jour de `main`, vérifications après déploiement comprises).
`config.php` créé (CONFIG OK). Tests verts en CI (e2e, charge, configurer, protect).
Testé par l'utilisateur le 15/10/2026 sur PC (Edge), portable et téléphone,
atelier « Temps d'écran » de bout en bout : pilotage, Envoyer, sondage au
toucher, décomptes, explications, mur et « j'aime », post-it, gommettes.

## Restant, par priorité — tout côté utilisateur

1. **Tâche planifiée horaire** chez Alwaysdata : `php ~/www/purge.php`. Sans
   elle, la purge n'a lieu qu'au fil des visites.
2. **À vérifier après le 15/10/2026** (livré, pas encore vu chez l'utilisateur) :
   récap et conclusion de fin de session, post-its colorés au hasard,
   gommettes limitées à une colonne, page participant élargie sur PC. Puis un
   **atelier réel** à 10 participants ou plus (charge, wifi de la salle).
3. **Régénérer « temps d'écran » avec Gemini** (texte pour l'IA avec les deux
   nouvelles consignes) : vérifier qu'il ne donne plus de mauvaises réponses
   absurdes ni trois échelles.
4. **Appareils de l'atelier** : se connecter une fois à `admin.php` depuis
   chacun (sinon le blocage après échecs se fait par IP).
5. **Routine d'audit trimestriel** (`trig_01J6ZMsLHKbgXAQsRYgQL16q`, invisible
   pour Claude) : coller le bloc de `docs/routine-audit-trimestriel.md` dans ses
   instructions et lui attacher le dépôt. Ancienne routine
   `trig_018SBR4ihGT8Y2ud7sP5kxYm` désactivée le 10/10/2026 (peut être
   supprimée) ; PAPPERBOARD ajouté aux deux rappels d'audit Codex.
6. Facultatif : `contact` dans `config.php` (réactiver un moment le mot de
   passe SSH, `php ~/www/configurer.php`, répondre `N` au mot de passe,
   recouper l'accès par mot de passe). Journaux Apache et sauvegardes
   d'Alwaysdata à regarder une fois.
7. **Hook `SessionStart`** : refusé à Claude par la plateforme (09/10/2026). À
   créer : même `.claude/settings.json` que NEWGEN, hook réduit à
   `bash "$CLAUDE_PROJECT_DIR/scripts/check-chantiers.sh" "$CLAUDE_PROJECT_DIR/CHANTIERS.md"`.

Fait côté hébergement (14/10/2026, déclaré par l'utilisateur) : HTTPS forcé,
accès SSH par mot de passe coupé (clé seule), fichiers de clé supprimés. Secret `ALWAYSDATA_KNOWN_HOSTS` présent (mesuré : pas
d'avertissement `accept-new` au déploiement du 14/10/2026), ruleset sur `main`.

## Décisions à trancher

- **Durée de purge** : 30 jours sans action de l'animateur (défaut,
  `purge_days`). C'est à l'utilisateur, responsable de traitement, de la fixer.

- **Mode « non anonyme »** du cahier des charges : non codé. Il supposerait de
  demander un nom ou un pseudo, contraire à « aucune donnée personnelle ».
  Toutes les réponses sont anonymes. À rouvrir seulement sur besoin réel.
- **Classement par points** : le participant répartit entre 1 point et tout
  le budget (pas d'obligation de tout dépenser), pour ne pas bloquer un senior
  qui s'arrête à 8 sur 10. Changer dans `wl_clean_points()` si besoin.
- **Mur et post-it : affichage différé** (décision prise seule le 09/10/2026) :
  les contributions des autres n'apparaissent qu'après « Publier ». Affichage
  immédiat possible si l'utilisateur le préfère (moins de contrôle des noms).
## Limites connues

- `php -S` ignore `.htaccess` : le refus de `lib.php`, `config.php`, `data/`
  n'est testé que sur le vrai serveur, par l'étape « Vérifier la mise en
  ligne » de `ci-deploy.yml` (verte le 14/10/2026).
- Parcours navigateur (`tests/navigateur.js`) lancé seulement si Playwright
  est installé : en local oui, en CI non.
- Toutes les écritures d'une session passent par un verrou de fichier :
  150 arrivées + 150 votes simultanés en 340-450 ms (mesuré en local avec
  8 processus PHP, 09/10/2026). Non mesuré sur l'hébergement mutualisé.
- Limite par IP large (900 écritures/min) : dans une salle, tous les
  téléphones sortent souvent par la même IP. La vraie limite est par
  participant (30/min).
- IP lue dans `REMOTE_ADDR` : hypothèse non vérifiée que le proxy Alwaysdata
  y met l'IP du visiteur (sinon, limite par IP commune à tous — sans gravité,
  voir ligne précédente).

- Plein écran de la projection : sans effet dans le Chrome du PC de
  l'utilisateur (ni bouton ni Fn+F11), fonctionne dans Edge sur le même PC
  (constaté le 15/10/2026). Cause mesurée le 15/10/2026 : règle
  `FullscreenAllowed = false` imposée à ce Chrome (niveau ordinateur). Le bouton
  affiche un message au lieu de rester muet. Contournement : projeter avec Edge.

- Décompte « 3 / 5 ont répondu » (15/10/2026) : le dénominateur est le nombre
  de participants inscrits ; un téléphone éteint sans « Quitter » compte encore
  (hypothèse non vérifiée sur le terrain). « Tout le monde a répondu » peut donc
  ne jamais s'afficher : fermer le vote quand le compteur ne bouge plus.

- Test instable (15/10/2026) : e2e « direct : nuage sans direct pas projeté
  avant « Afficher » » échoue environ 1 fois sur 10 (2 fois sur 20 lancements
  locaux), sans changement de code. Cause non trouvée ; bloque le passage sur
  `main` quand il tombe. À instrumenter (statut de `goto`, question projetée).
  Même constat le 15/10/2026 sur `tests/navigateur.js` (« mot constructor »,
  délai dépassé 1 fois sur 3, local seulement : le parcours navigateur ne tourne pas en CI).

## Points à ne pas défaire

- **Projet personnel** (décision de l'utilisateur, 14/10/2026) : le CD47 n'est
  pas concerné (ni charte, ni DPD, ni Archives départementales, ni registre du
  Département). Le RGPD s'applique : l'utilisateur est responsable de
  traitement ; ses mentions (`responsable`, `contact`, `base_legale`) sont dans
  `config.php`, hors du dépôt public. Fiche : `docs/registre-traitement.md`.

- Déploiement **automatique** à chaque mise à jour de `main`, sans approbation
  manuelle (choix de l'utilisateur, 14/10/2026) : le garde-fou est le ruleset
  de `main` (tests exigés). GitHub Pages coupé (14/10/2026).

- Clés : aucune à conserver, toutes se recréent (déploiement : README étapes
  2-3 ; secret et sel : `configurer.php`). Pas de sauvegarde chiffrée ici,
  donc aucune clé dont la perte ferait perdre des données (14/10/2026).
- Hébergement (14/10/2026) : compte Alwaysdata `wooclight`, appli à la racine
  `~/www/` (variable GitHub `WOOCLIGHT_CHEMIN` = `www/`, sans elle le
  déploiement part dans `~/www/wooclight/`), données dans `~/wooclight-data`,
  adresse https://wooclight.alwaysdata.net.

- Aucun nom ni adresse de contact dans le dépôt (public) : les mentions de
  confidentialité viennent de `config.php` (14/10/2026).

- Mur et post-it : les contributions des autres ne sont visibles (téléphones
  et projection) qu'après **Publier** — relecture et masquage d'abord, une
  contribution peut contenir un nom. Chaque contribution rafraîchit les
  téléphones (`pversion`), contrairement aux votes : coût accepté, les
  contributions sont bien plus rares que les rafraîchissements.
- Gommettes : elles visent les post-its **principaux** visibles de la question
  source ; un post-it regroupé compte pour son principal. Identifiants de post
  préfixés `n` : jamais de clé numérique en JSON.

- Session = écran d'accueil d'abord (`current = -1`) ; « Suivante » vers une
  question jamais ouverte **ouvre le vote** (choix de l'utilisateur, 09/10/2026).
- Modifier le type, le nombre de choix, l'échelle, le budget ou le choix
  multiple d'une question **efface ses réponses** (`wl_structure_changed()`,
  même règle dans `admin.js`) : sinon les résultats plantent. Tenu par e2e.
  Un vote **ouvert reste ouvert** après cette modification (15/10/2026 : sinon
  les participants ne pouvaient plus voter sans comprendre pourquoi).
- Animations : barres mises à jour sur place (jamais détachées du DOM, sinon
  la transition saute) ; mots et réponses libres réutilisés, seul un élément
  nouveau porte `is-new` et joue l'apparition (sinon tout clignote à chaque vote).

- **Polling** : deux versions par session. `pversion` (ce que voit un
  téléphone) ne bouge pas quand un autre participant vote ; `version`
  (projection, animateur) bouge à chaque vote. Sinon 150 téléphones
  retéléchargent tout à chaque vote. Tenu par `tests/e2e.php` (section
  « Coût ») : 30 rafraîchissements sans changement = 30 × 304, 0 octet.
- Renvoyer **la même réponse** est accepté même si la modification est
  interdite : c'est la reprise après coupure réseau, pas un double vote.
- Jamais d'`innerHTML` ni de script ou style en ligne : la CSP les bloque
  (`default-src 'none'`). Tout texte reçu passe par `textContent`.
- Jeton participant jamais stocké en clair (HMAC) ; IP seulement hachée.
- Déploiement `rsync` **sans `--delete`** : `config.php` (et `data/` s'il est
  dans le site) vivent sur le serveur hors dépôt.
- Palette neutre (14/10/2026) : primaire `#4338CA` (7,9:1 sur blanc), accent
  `#0F766E` (5,5:1), barres `#6366F1` / `#16A34A` (graphiques ≥ 3:1). Mesuré
  avec la formule WCAG ; revérifier tout nouveau couple texte/fond.
- **Audit Codex, points non retenus en l'état** (10/10/2026) : identités
  multiples (point 2) — inhérent à un vote sans compte ; atténué par
  « Fermer les inscriptions » ; pour un vote à enjeu, utiliser un autre outil.
  Secret de projection séparé du code (point 4) — la projection ne montre que
  ce que voient les participants dans la salle ; écarté.
- Session animateur : 2 h sans **écriture** (le rafraîchissement automatique
  ne compte pas), 12 h au plus depuis la connexion. Blocage de connexion par
  appareil connu (cookie signé `wl_dev`), sinon par IP.
- Rétention : seule l'activité de l'animateur (`activity`) repousse la purge ;
  `purge.php` (ligne de commande seulement) la lance chaque heure.
- Les « 2 heures au plus » de traces d'IP annoncées aux participants tiennent
  à la tâche planifiée **horaire** de `purge.php` : ne pas l'espacer.
- Verrous de limitation : 16 fichiers `rl/shard-*.lock` jamais supprimés ; la
  purge n'efface que les compteurs `rl/*.json`.
- Clé participant dérivée du code de session : deux sessions ne se relient pas.
- **Envoyer ou toucher** (15/10/2026, choix de l'utilisateur) : sondage, Oui/Non,
  échelle **sans bonne réponse et modifiables** : un appui envoie tout de suite
  (on en touche un autre pour changer). Quiz (`graded` : une bonne réponse
  existe, le téléphone ne sait pas laquelle), réponse figée ou QCM multiple :
  un appui sélectionne, **Envoyer** vote (14/10/2026 : l'envoi en un geste
  déroutait, d'où ce partage). Le bouton Envoyer est à droite des choix sur
  écran large, sous les choix sur téléphone (barre collée en bas essayée le
  15/10/2026 : elle cachait les choix). Tenu par `tests/navigateur.js`
  (« choisir n'envoie rien avant Envoyer », sur un quiz).
  Pendant une saisie (nuage, réponse libre, mur, post-it), le bouton d'envoi
  est ramené à l'écran (le clavier du téléphone le cachait, hypothèse du
  14/10/2026) ; sur mur et post-it, Entrée publie.
- **Projection en direct** (choix de l'utilisateur, 14/10/2026) : sondage,
  nuage, échelle, points (`WL_LIVE_TYPES`) projetés dès l'ouverture du vote,
  case décochable par question. Quiz, réponse libre, mur, post-it attendent le
  clic (correction, relecture des noms). Les **téléphones** n'affichent toujours
  les résultats qu'après « Afficher » : sinon chaque vote les ferait tous
  recharger. Tenu par `tests/e2e.php` (« Projection en direct »).
- **Génération par une IA** (14/10/2026) : copier-coller, WoocLight n'appelle
  aucune IA. Réponse collée validée **côté serveur** (`wl_import_parse`, mêmes
  règles que le formulaire), tout ou rien ; bonnes réponses données **par leur
  texte** ; gommettes reliées à leur source par sa position ; « \[ », « \] » et
  espaces insécables de l'affichage d'une IA retirés ; `.json` de 60 Ko au plus.
  Consignes du texte pour l'IA (`genPrompt`) tirées des essais du 14/10/2026 sur
  ChatGPT, Gemini, Mistral et Claude : mauvaises réponses crédibles, une seule
  échelle en fin d'atelier, s'adresser au public (tutoiement des jeunes),
  explication sourcée ou « pas de source sûre », conclusion en fin de liste,
  QCM multiple plutôt que sondage quand plusieurs réponses vont ensemble.
  Évaluation croisée anonymisée : ChatGPT > Claude > Mistral > Gemini ; deux IA
  sur quatre se classent premières. **Règle : l'IA qui écrit ne relit pas**
  (décision de l'utilisateur) : relecture par une IA d'un autre éditeur
  (« Copier la consigne de relecture » : public → fond → sources → forme), les
  liens sont ouverts par l'utilisateur, pas de seconde relecture par IA.
  ⚠️ Jamais de question d'âge légal ou de loi sans vérification sur Légifrance
  (trois IA ont cité trois lois différentes). Conseiller 10 à 12 questions.
- Export des questions en `.json` (14/10/2026, `wl_export_questions`) : même
  format que l'import, **sans aucune réponse de participant**, réglages compris
  (durée, correction, modification, direct). Réimporter un export redonne le
  même fichier : tenu par `tests/e2e.php` (« Export des questions »).
  Tenu par `tests/e2e.php` (« Import ») et `tests/navigateur.js`.

- **Pilotage depuis la projection** (15/10/2026) : actif seulement si le
  navigateur a le cookie animateur (`data-pilot`, sinon aucune session PHP
  ouverte pour un visiteur), puis vérifié par `me` et `control` (session +
  CSRF), comme `admin.php`. Aucune nouvelle page ni nouveau droit.
- **Résultats projetés** (15/10/2026) : `WL.fitResults()` réduit les barres qui
  débordent (7 longs choix + explication tiennent en 1280x720) ; nuage : ajuste la taille de
  l'ensemble pour tenir dans l'écran (mesuré en local, Chromium, 3 à 60 mots,
  1280x720 et 1920x1000 : aucun défilement). Mots horizontaux, jamais de
  rotation (lisibilité de loin pour des seniors). Tailles relatives 35-100 %
  selon la fréquence ; au-delà de 60 mots, seuls les 60 plus cités (lib.php).
- Projection, résultats affichés (`.s-live`) : question à 0,95 em et barres plus
  hautes (15/10/2026, demande de l'utilisateur : lisibilité des résultats).
- Ressources appelées par `wl_asset()` (`?v=` date du fichier) : sans lui, un
  navigateur garde l'ancien JS après un déploiement (hypothèse retenue le
  15/10/2026 : pilotage introuvable chez l'utilisateur, alors qu'il marchait
  en local dans Chromium).

- **Explication par question** (`explain`, 15/10/2026, demande de l'utilisateur) :
  400 caractères au plus, envoyée aux téléphones et à la projection **seulement
  avec les résultats** (`wl_public_question`, tenu par e2e « explication cachée
  avant les résultats »). Le texte pour l'IA la demande avec sa source ou
  « pas de source sûre ». Import et export `.json` la reprennent.

- Mur : les « j'aime » ne sont possibles que **publié et vote ouvert**
  (`wl_like`). Le bouton central du pilotage publie donc le mur avant de fermer
  le vote (15/10/2026 : fermé avant publication, tous les cœurs restaient à 0).

- Gommettes sur **une colonne** du post-it source (`column`, 15/10/2026, -1 =
  toutes) : formulaire, import (nom de la colonne), export. Tenu par e2e.
- Post-its colorés **au hasard mais stable** (`noteColor`, d'après l'id), jamais
  par participant : ses idées seraient reliées entre elles (anonymat, choix de
  l'utilisateur du 15/10/2026 après alerte).

- **Récap et conclusion de fin** (15/10/2026) : « Terminer la session » affiche
  sur la projection et les téléphones une ligne par question (`wl_recap`) puis la
  conclusion de la session (600 caractères ; saisie, ou élément
  `{"type": "conclusion"}` de l'IA, repris par l'export). Jamais le texte d'une
  réponse libre ; une idée du mur seulement si publiée. Tenu par e2e.

- **Bilan de l'atelier** (espace animateur, 15/10/2026) : tableau de bord de
  toutes les questions et texte à copier pour une IA (synthèse, conclusion,
  recommandations). Résultats regroupés seulement ; réponses écrites (libres,
  mur, post-it) **décochées par défaut** car elles peuvent contenir un nom, et
  jamais les réponses masquées. Les téléphones écoutent encore après la fin
  (304) : une conclusion ajoutée ensuite leur parvient.

- **Export PowerPoint du bilan** (15/10/2026) : généré dans le navigateur par
  PptxGenJS 4.0.1 copié dans `assets/` (licence MIT, chargé seulement à l'export,
  aucune donnée envoyée ailleurs). Graphiques natifs modifiables, réponses
  masquées exclues. Vérifié en local : fichier ouvert par python-pptx et
  LibreOffice (9 diapositives) ; pas encore ouvert dans PowerPoint.

- **Synthèse de l'IA** (`synthesis`, 15/10/2026) : collée par l'animateur dans
  la carte Bilan, 6000 caractères, retours à la ligne gardés ; jamais envoyée
  aux téléphones (tenu par e2e), reprise dans l'export PowerPoint, effacée avec
  la session par la purge.

- **Archive anonyme au lieu de suppression** (choix de l'utilisateur, 15/10/2026,
  option 1 après alerte RGPD) : la purge (`wl_purge`) et le bouton « Archiver »
  écrivent `archives/<date>-<id>.json` (questions, explications, résultats
  regroupés, récap anonyme, conclusion, synthèse) puis suppriment la session.
  Jamais : jeton, réponse une à une, texte écrit par un participant (nuage,
  réponse libre, mur, post-it, gommettes), IP. Gardée sans limite (plus de donnée
  personnelle). Tenu par e2e. Mentions de confidentialité à jour ; `docs/registre-traitement.md` laissé tel quel (l'utilisateur le tient lui-même, 15/10/2026).

## Pistes d'amélioration

*Proposées, en attente :*
- 14/10/2026 — Génération par API (bouton « Générer » sans copier-coller) :
  reportée par l'utilisateur après essai du copier-coller. Nouveau sous-traitant
  à déclarer, clé dans `config.php`, limite de générations, audit Codex.
- 14/10/2026 — Texte pour l'IA : consigne de forme tirée de Mistral
  (« une affirmation → Vrai/Faux, pas Oui/Non »). À ajouter si l'écart se
  répète. (Le volet « plusieurs réponses → QCM multiple » est ajouté le
  15/10/2026 : l'écart s'est répété sur un sondage d'activités.)
- 09/10/2026 — Classement par points : trier les barres du plus au moins de
  points (un « classement » se lit de haut en bas).
*Écartées :* aucune.
