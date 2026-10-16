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
   barre de pilotage allégée et glisser ← → au téléphone, démos à 4 thèmes et
   « Supprimer les démos ». Validé le 16/10/2026 : nuage lisible et fluide sur la
   projection au téléphone. Le plus simple : **Créer une session de
   démonstration**. Puis un **atelier réel** à 10 participants ou plus.
2. **Fiche `docs/registre-traitement.md`** : mise à jour V0.4 par Claude le
   15/10/2026 (archive, pseudonymes, signaux, IA externe), **à relire et valider
   par l'utilisateur** (responsable de traitement).
3. **Régénérer « temps d'écran » avec Gemini** (nouvelles consignes) : plus de
   mauvaises réponses absurdes ni de trois échelles ?
4. **Appareils de l'atelier** : se connecter une fois à `admin.php` depuis
   chacun (sinon le blocage après échecs se fait par IP).
5. **Routine d'audit trimestriel** (`trig_01J6ZMsLHKbgXAQsRYgQL16q`, invisible
   pour Claude) : coller le bloc de `docs/routine-audit-trimestriel.md` dans ses
   instructions et lui attacher le dépôt. Ancienne routine
   `trig_018SBR4ihGT8Y2ud7sP5kxYm` désactivée le 10/10/2026 (à supprimer).
6. Facultatif : `contact` dans `config.php` (`php ~/www/configurer.php`, réponse
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
  fiche `docs/registre-traitement.md`.
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
- Démo (`WL_DEMO_THEMES`) : bonne réponse fixée par thème ; « Supprimer les démos ».

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
- Pilotage au téléphone : glisser ← → (≥ 60 px, horizontal ; nav).
- Onglets : les tests cliquent l'onglet avant d'agir (panneau masqué).

## Pistes d'amélioration

*Proposées, en attente :* aucune.
*Écartées :* 15/10/2026 — génération par API (bouton « Générer ») : l'utilisateur
y renonce, le copier-coller suffit.
