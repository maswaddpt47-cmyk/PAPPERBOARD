# CHANTIERS — WoocLight

État au **14/10/2026** — commit de référence : voir `git log -1 main`.
**En ligne** sur https://wooclight.alwaysdata.net (déploiement automatique vert
le 14/10/2026, vérifications après déploiement comprises : fichiers sensibles
refusés, HTTP redirigé vers HTTPS). `config.php` créé par `configurer.php`
(CONFIG OK). Tests verts en CI (e2e, charge, configurer, protect).

## Restant, par priorité — tout côté utilisateur

1. **Tâche planifiée horaire** chez Alwaysdata : `php ~/www/purge.php`. Sans
   elle, la purge n'a lieu qu'au fil des visites.
2. **Ménage des clés** : `rm ~/wooclight-deploy ~/wooclight-deploy.pub` dans
   le terminal Alwaysdata et suppression de la copie Bloc-notes. Rien à
   conserver (README, étape 3) sauf le mot de passe admin.
3. **Tester avec `docs/mode-emploi-test.pdf`** sur téléphone et projection,
   dont mur, post-it, gommettes et les trois modes de correction.
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
accès SSH par mot de passe coupé (clé seule). Secret `ALWAYSDATA_KNOWN_HOSTS` présent (mesuré : pas
d'avertissement `accept-new` au déploiement du 14/10/2026), ruleset sur `main`.

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

## Points à ne pas défaire

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

## Pistes d'amélioration

*Proposées, en attente :*
- 09/10/2026 — Classement par points : trier les barres du plus au moins de
  points (un « classement » se lit de haut en bas).
*Écartées :* aucune.
