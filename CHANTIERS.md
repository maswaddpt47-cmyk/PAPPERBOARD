# CHANTIERS — WoocLight

État au **14/10/2026** — commit de référence : voir `git log -1 main`.
Application complète, tests verts en local (`bash tests/run.sh`, 09/10/2026 :
e2e 200 vérifications, charge, données, navigateur 15). Pas encore en ligne.

## Restant, par priorité

1. **Fin de mise en ligne** (14/10/2026 : déployé sur le compte personnel
   `wooclight`, `config.php` créé par `configurer.php`, CONFIG OK) : tâche
   planifiée **horaire** `php ~/www/purge.php` ; couper l'accès SSH par mot de
   passe / « Accessible par le web » ; renseigner `contact` (relancer
   `configurer.php`) ; se connecter à `admin.php` depuis chaque appareil.
3. **Contrôle visuel** sur téléphone et projection (README §3), y compris
   mur, post-it et gommettes (déroulé « variante bilan », README §5).
4. **Après l'audit Codex du 10/10/2026** (14 points, tous vérifiés dans le
   code et confirmés ; rapport complet hors dépôt). Corrigé dans le code :
   2 (fermer les inscriptions), 3, 4 (session terminée + essais de codes),
   5, 6, 7, 8, 9, 10, 12, 13, 14, chemin et SHA du
   workflow. **Reste à l'utilisateur** (README §1, étape 5) : 1 protéger
   `main` (fait) ; 11 secret
   `ALWAYSDATA_KNOWN_HOSTS` ; redirection HTTPS ; tâche planifiée de purge ;
   renseigner `responsable` et `contact` dans `config.php` (texte « Confidentialité »).
4bis. **Second audit Codex (10/10/2026, réflexion maximale)** : aucun point
   critique ni haut ; 8 points vérifiés et confirmés. Corrigés : 1 (purge
   revérifiée sous verrou), 2 (verrous de limitation fixes), 3 (inscriptions
   limitées à 60/min/IP, `rate_join`), 4 (jeton signé et daté, 24 h vérifiées
   par le serveur ; bouton « Quitter et effacer ce téléphone »), 6 (réponse en
   attente valable 1 h, effacée en fin de session), plus les remarques groupe
   masqué, CSV à diffuser, création de session exclusive, texte « Tout est
   effacé ». **Reste à l'utilisateur** : 5 (ruleset sur `main`), 7 (faire
   reconnaître ses appareils avant l'atelier), 8 (tâche planifiée **horaire**),
   journaux Apache et sauvegardes d'Alwaysdata à vérifier.
5. **Routine d'audit trimestriel** (`trig_01J6ZMsLHKbgXAQsRYgQL16q`, créée dans
   l'interface, invisible et non modifiable par Claude) : coller le bloc de
   `docs/routine-audit-trimestriel.md` à la fin de ses instructions et lui
   attacher le dépôt — utilisateur. Fait le 10/10/2026 par Claude : ancienne
   routine `trig_018SBR4ihGT8Y2ud7sP5kxYm` (consigne GAS périmée) **désactivée**,
   PAPPERBOARD ajouté aux deux rappels d'audit Codex.
6. **Hook `SessionStart`** : `scripts/check-chantiers.sh` est en place, mais
   `.claude/settings.json` + `.claude/hooks/session-start.sh` ont été refusés à
   Claude par la plateforme (09/10/2026). À créer par l'utilisateur : même
   `settings.json` que NEWGEN, hook réduit à
   `bash "$CLAUDE_PROJECT_DIR/scripts/check-chantiers.sh" "$CLAUDE_PROJECT_DIR/CHANTIERS.md"`.

## Décisions à trancher

- **Projet personnel** (décision de l'utilisateur, 14/10/2026) : WoocLight sort
  des obligations du CD47 et sera hébergé sur un **profil Alwaysdata personnel**
  (offre Free, compte à la racine `www/`). Les règles CD47 (Archives
  départementales, DPD du Département, charte IA, registre du CD47) ne
  s'appliquent plus telles quelles ; le RGPD, lui, s'applique toujours :
  l'utilisateur devient responsable de traitement. Mentions « Confidentialité »
  désormais réglées dans `config.php` (`responsable`, `contact`,
  `base_legale`), hors du dépôt public. Couleurs : palette neutre (indigo /
  sarcelle), charte CD47 retirée (14/10/2026). **À trancher** : durée de purge
  (30 j par défaut).
  ⚠️ Si l'outil sert un jour à des ateliers **du CD47**, c'est le Département
  qui redevient responsable : repasser alors par son DPD.

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
  ligne » de `ci-deploy.yml` (hypothèse non vérifiée tant qu'aucun
  déploiement n'a tourné).
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
- Premier contact SSH du déploiement en `accept-new` (empreinte du serveur
  acceptée au premier passage), comme l'API des Ateliers.
- `base_url` vide : l'adresse du QR code est déduite de l'en-tête `Host`.
  Renseigner `base_url` en production.

## Points à ne pas défaire

- Déploiement **automatique** à chaque mise à jour de `main`, sans approbation
  manuelle (choix de l'utilisateur, 14/10/2026) : le garde-fou est le ruleset
  de `main` (tests exigés). GitHub Pages coupé (14/10/2026).

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
  `purge.php` (ligne de commande seulement) la lance chaque nuit.
- Les « 2 heures au plus » de traces d'IP annoncées aux participants tiennent
  à la tâche planifiée **horaire** de `purge.php` : ne pas l'espacer.
- Verrous de limitation : 16 fichiers `rl/shard-*.lock` jamais supprimés ; la
  purge n'efface que les compteurs `rl/*.json`.
- Clé participant dérivée du code de session : deux sessions ne se relient pas.

## Pistes d'amélioration

*Proposées, en attente :*
- 09/10/2026 — Classement par points : trier les barres du plus au moins de
  points (un « classement » se lit de haut en bas).
*Écartées :* aucune.
