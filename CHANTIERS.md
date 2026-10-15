# CHANTIERS — WoocLight

État au **14/10/2026** — commit de référence : voir `git log -1 main`.
**En ligne** sur https://wooclight.alwaysdata.net (déploiement automatique vert
le 14/10/2026, vérifications après déploiement comprises : fichiers sensibles
refusés, HTTP redirigé vers HTTPS). `config.php` créé par `configurer.php`
(CONFIG OK). Tests verts en CI (e2e, charge, configurer, protect).

## Restant, par priorité — tout côté utilisateur

1. **Tâche planifiée horaire** chez Alwaysdata : `php ~/www/purge.php`. Sans
   elle, la purge n'a lieu qu'au fil des visites.
2. **Tester avec `docs/mode-emploi-test.pdf`** sur téléphone et projection,
   dont mur, post-it, gommettes et les trois modes de correction. Vérifier en
   particulier les changements du 14/10/2026, non vus sur un vrai téléphone :
   bouton **Envoyer** après le choix (Oui/Non, sondage, échelle…), bouton
   d'envoi visible au-dessus du clavier, Entrée qui publie sur le mur,
   projection **en direct** du nuage de mots et du sondage sans clic.
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

- Gommettes : elles portent sur **tous** les post-its de la question source,
  pas sur une colonne (constaté le 14/10/2026 : vote « solutions » sur un
  post-it « freins / solutions »). Contournement : post-it à une seule colonne
  quand il est suivi d'un vote.
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
- Toutes les questions ont un bouton **Envoyer** (14/10/2026, demande de
  l'utilisateur) : sur Oui/Non, Vrai/Faux, sondage, QCM et échelle, un appui
  sélectionne seulement ; l'envoi en un geste déroutait. Tenu par
  `tests/navigateur.js` (« choisir n'envoie rien avant Envoyer »).
  Pendant une saisie (nuage, réponse libre, mur, post-it), le bouton d'envoi
  est ramené à l'écran (le clavier du téléphone le cachait, hypothèse du
  14/10/2026) ; sur mur et post-it, Entrée publie.
- **Projection en direct** (choix de l'utilisateur, 14/10/2026) : sondage,
  nuage, échelle, points (`WL_LIVE_TYPES`) projetés dès l'ouverture du vote,
  case décochable par question. Quiz, réponse libre, mur, post-it attendent le
  clic (correction, relecture des noms). Les **téléphones** n'affichent toujours
  les résultats qu'après « Afficher » : sinon chaque vote les ferait tous
  recharger. Tenu par `tests/e2e.php` (« Projection en direct »).
- Génération par une IA (14/10/2026) : copier-coller, WoocLight n'appelle aucune
  IA. La réponse collée est lue et validée **côté serveur** (`wl_import_parse`,
  mêmes règles que le formulaire) ; bonnes réponses données **par leur texte**
  (une IA se trompe sur les numéros), refusées si absentes des choix ; gommettes
  reliées à leur source par sa position dans la liste. Ajout tout ou rien.
  Les « \[ », « \] » et espaces insécables ajoutés par l'affichage d'une IA
  (copie depuis l'application ChatGPT, constaté le 14/10/2026) sont retirés.
  Un fichier `.json` importé suit le même chemin (lu dans le navigateur, 60 Ko
  au plus, puis vérifié par le serveur).
  Mesuré le 14/10/2026 sur de vraies réponses : ChatGPT (mails frauduleux,
  10 puis 20 questions ; temps d'écran, 20) et Gemini (temps d'écran, 20),
  toutes acceptées. Comparaison sur le même thème : ChatGPT donne des mauvaises
  réponses crédibles et un ton nuancé ; Gemini des mauvaises réponses absurdes
  (« rétrécissement des bras »), des chiffres à nuancer et 3 échelles finales.
  D'où deux consignes dans le texte pour l'IA (`genPrompt`, `admin.js`) :
  « mauvaises réponses crédibles, jamais absurdes » et « une seule échelle, en
  fin d'atelier ». Gemini a ensuite ignoré « Public : collégiens » (vouvoiement,
  exemples d'adultes) : 3e consigne « chaque question s'adresse directement à ce
  public : tutoiement pour des enfants ou des adolescents ». Exemple corrigé de
  12 questions : `docs/exemples/temps-ecran-collegiens.json`.
  Mistral et Claude (même texte, 20/20 acceptées). Évaluation croisée
  anonymisée (versions A-D, consigne imposant public → fond → forme →
  classement, 14/10/2026) par les quatre IA : **ChatGPT > Claude > Mistral >
  Gemini**, unanime sauf Claude qui s'était classé premier. Mesuré : 2 IA sur 4
  se classent premières (ChatGPT, Claude) ; Gemini et Mistral, qui se classent
  dernière et troisième, sont les juges neutres et tranchent. Constats communs :
  Gemini ignore le public, Mistral a deux erreurs de fond, les distracteurs
  restent le point faible de toutes, la règle 20-20-20 est toujours incomplète.
  ⚠️ Âge légal des réseaux sociaux : trois IA citent trois lois différentes
  (2023, juillet 2026, 24/08/2026 censurée) — non vérifié par Claude (après
  juin 2026) : aucune question d'âge légal sans vérification sur Légifrance.
  Leçon : une IA ne relit jamais sa propre version ; aucune ne dispense de
  relire les corrections des quiz. D'où le bouton **Copier la consigne de
  relecture** (aperçu de l'import, `reviewPrompt`, `admin.js`) : ordre public →
  fond → sources → forme, sources officielles exigées, « pas de source sûre »
  plutôt qu'une référence inventée. Méthode conseillée : générer (ChatGPT),
  « Vérifier », relire l'aperçu ; relecture par une autre IA pour un nouveau
  thème ; jamais de question d'âge légal ou de loi sans Légifrance.
  **Règle : l'IA qui écrit ne relit pas** (décision de l'utilisateur,
  14/10/2026). Une nouvelle conversation avec la même IA ne suffit pas : même
  anonymisées, ChatGPT et Claude ont classé leur version première. Questions de
  ChatGPT → relecture par Gemini ou Mistral (juges neutres du test) ou Claude.
  L'utilisateur ouvre les liens des sources et tranche.
  Cycle complet essayé le 14/10/2026 (numérique responsable, seniors, 15 q.) :
  relecture par une autre IA de bonne qualité (sources précises, « pas de
  source sûre » assumé, corrections prêtes) ; corrections renvoyées **en un seul
  collage** à l'IA auteure avec « Applique exactement les corrections… redonne
  la liste JSON complète » ; 15/15 acceptées. Reste une relecture humaine
  rapide : l'IA auteure a changé la colonne d'un post-it sans adapter son
  intitulé, et trois questions demandaient presque la même chose. Pas de
  seconde relecture par IA (tourne en rond). Série validée → **Questions (.json)**.
  Les quatre IA ont produit 20 questions, trop pour une séance :
  conseiller 10 à 12 (décocher dans l'aperçu).
- Export des questions en `.json` (14/10/2026, `wl_export_questions`) : même
  format que l'import, **sans aucune réponse de participant**, réglages compris
  (durée, correction, modification, direct). Réimporter un export redonne le
  même fichier : tenu par `tests/e2e.php` (« Export des questions »).
  Tenu par `tests/e2e.php` (« Import ») et `tests/navigateur.js`.

## Pistes d'amélioration

*Proposées, en attente :*
- 15/10/2026 — « Copier l'adresse » (validé sur le terrain le 15/10/2026) :
  copier un message prêt à envoyer (« Rejoignez l'atelier : <lien> — code
  XXXXX ») plutôt que le lien seul ; sur téléphone, bouton **Partager** natif
  (SMS, WhatsApp) en plus.
- 14/10/2026 — Génération par API (bouton « Générer » sans copier-coller) :
  reportée par l'utilisateur après essai du copier-coller. Nouveau sous-traitant
  à déclarer, clé dans `config.php`, limite de générations, audit Codex.
- 14/10/2026 — Texte pour l'IA : consigne de forme tirée de Mistral
  (« une affirmation → Vrai/Faux, pas Oui/Non ; plusieurs bonnes réponses
  possibles → QCM multiple, pas sondage »). À ajouter si l'écart se répète.
- 09/10/2026 — Classement par points : trier les barres du plus au moins de
  points (un « classement » se lit de haut en bas).
*Écartées :* aucune.
