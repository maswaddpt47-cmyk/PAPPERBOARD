# CHANTIERS — WoocLight

État au **10/10/2026** — commit de référence : voir `git log -1 main`.
Application complète, tests verts en local (`bash tests/run.sh`, 09/10/2026 :
e2e 200 vérifications, charge, données, navigateur 15). Pas encore en ligne.

## Restant, par priorité

1. **Mise en ligne** (utilisateur, procédure README §1) : clé SSH, secrets
   `ALWAYSDATA_COMPTE` et `ALWAYSDATA_SSH_KEY`, puis `config.php` sur le
   serveur. Sans les secrets, le déploiement est sauté (avertissement jaune).
2. **Couper GitHub Pages** sur le dépôt (Settings > Pages > Source : None) :
   une publication Pages a tourné sur `main` le 09/10/2026, elle expose une
   copie statique inutile du code.
3. **Contrôle visuel** sur téléphone et projection (README §3), y compris
   mur, post-it et gommettes (déroulé « variante bilan », README §5).
4. **Audit Codex ponctuel**, à faire **avant la mise en ligne** (choix de
   l'utilisateur, 10/10/2026 ; `agora.md` §12, règle 4). Consigne prête :
   `docs/consigne-audit-codex.md`. Le rapport vérifié se range hors du dépôt ;
   chaque point est vérifié dans le code avant correction.
5. **Routine d'audit trimestriel** (`trig_01J6ZMsLHKbgXAQsRYgQL16q`) : ajouter
   PAPPERBOARD — modifiable par l'utilisateur seul, texte à préparer.
6. **Hook `SessionStart`** : `scripts/check-chantiers.sh` est en place, mais
   `.claude/settings.json` + `.claude/hooks/session-start.sh` ont été refusés à
   Claude par la plateforme (09/10/2026). À créer par l'utilisateur : même
   `settings.json` que NEWGEN, hook réduit à
   `bash "$CLAUDE_PROJECT_DIR/scripts/check-chantiers.sh" "$CLAUDE_PROJECT_DIR/CHANTIERS.md"`.

## Décisions à trancher

- ⚠️ **Durée de purge (30 jours)** : élimination d'archives publiques. À
  valider avec les Archives départementales et le DPD (tableau de gestion).
  Réglable dans `config.php` (`purge_days`).
- **Mode « non anonyme »** du cahier des charges : non codé. Il supposerait de
  demander un nom ou un pseudo, contraire à « aucune donnée personnelle ».
  Toutes les réponses sont anonymes. À rouvrir seulement sur besoin réel.
- **Classement par points** : le participant répartit entre 1 point et tout
  le budget (pas d'obligation de tout dépenser), pour ne pas bloquer un senior
  qui s'arrête à 8 sur 10. Changer dans `wl_clean_points()` si besoin.
- **Emplacement** : `www/wooclight/` du compte Alwaysdata (défaut du workflow,
  variable `WOOCLIGHT_CHEMIN`). Même compte que l'API des Ateliers ou compte
  séparé : à décider par l'utilisateur.
- **Mur et post-it : affichage différé** (décision prise seule le 09/10/2026) :
  les contributions des autres n'apparaissent qu'après « Publier ». Affichage
  immédiat possible si l'utilisateur le préfère (moins de contrôle des noms).
- **Questions de la charte IA** encore ouvertes (06/10/2026) : Claude
  figure-t-il parmi les outils autorisés (§8) ?

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
- Bleu CD47 `#4389BD` avec texte blanc : 3,78:1, refusé en AA pour le texte
  courant (mesuré le 09/10/2026, formule WCAG). Boutons et liens :
  `#2F6A96` (5,80:1). Bleu ciel (2,37) et vert (1,84) : jamais de texte blanc
  dessus. Sarcelle (4,84) et gris (5,03) passent sur blanc ; sarcelle sur
  fond `#F3F6F9` : 4,47, à éviter pour du texte courant.

## Pistes d'amélioration

*Proposées, en attente :*
- 09/10/2026 — Classement par points : trier les barres du plus au moins de
  points (un « classement » se lit de haut en bas).
*Écartées :* aucune.
