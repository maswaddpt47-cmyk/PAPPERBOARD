# CHANTIERS — WoocLight

État au **21/10/2026** — commit de référence : voir `git log -1 main`.
**En ligne** sur https://wooclight.alwaysdata.net (déploiement automatique vert
à chaque mise à jour de `main`, vérifications après déploiement comprises).
`config.php` créé (CONFIG OK). Tests verts en CI (e2e, charge, configurer, archivage, protect).
Testé de bout en bout par l'utilisateur le 15/10/2026 (atelier « Temps d'écran »).
**Ménage du 21/10/2026** : récits des chantiers charte (18/10), navigation v3
(18/10), interface de la simulation et interface fidèle (19/10), animation
guidée (21/10) retirés — `git log -p CHANTIERS.md` ; leurs invariants sont
plus bas.

## Restant, par priorité — tout côté utilisateur

1. **Essayer sur PC** les nouveautés en ligne non encore essayées :
   - animation guidée (21/10, `7ffa824`) : Animer → Participants (QR,
     inscriptions), un quiz piloté depuis Animer puis depuis la projection,
     un mur / post-it avec relecture avant publication ;
   - interface reprise de la simulation (19/10) : création vide et par JSON,
     Mon espace, Pilotage, Réglages, Bilan, projection ;
   - fonctions des 15 au 18/10 jamais vues sur PC (téléphone : seuls le
     bouton principal de la projection, le nuage et la démo sont validés) :
     onglets, archive anonyme, synthèse, post-its colorés, signaux, « Oser
     demander », pseudonymes et podium, brise-glaces, Vrai/Faux au toucher,
     « Rouvrir le vote », « x actifs », « ❓ Questions », démos à 4 thèmes,
     avant / après, « Clôture… », A− / A+, lien d'exercice et QR, défi à
     étapes et « ✋ Bloqué » (Réglages > fonctions en essai), fiche mémo
     (Bilan > Exports), bibliothèque de séances, rappel à l'archivage,
     PowerPoint « … et N autres ».
   Le plus simple : **Créer une session de démonstration**, puis un **atelier
   réel** à 10 participants ou plus.
2. **Régénérer « temps d'écran » avec Gemini** (nouvelles consignes) : plus de
   mauvaises réponses absurdes ni de trois échelles ?
3. **Appareils de l'atelier** : se connecter une fois à `admin.php` depuis
   chacun (sinon le blocage après échecs se fait par IP).
4. **Routine d'audit trimestriel** (`trig_01J6ZMsLHKbgXAQsRYgQL16q`, invisible
   pour Claude) : coller le bloc de `docs/routine-audit-trimestriel.md` dans ses
   instructions et lui attacher le dépôt. Ancienne routine
   `trig_018SBR4ihGT8Y2ud7sP5kxYm` désactivée le 10/10/2026 (à supprimer).
5. **Relire** les 5 séances de la bibliothèque (brouillons : le 33700 et « .gouv.fr » à
   vérifier) et la fiche `docs/registre-traitement.md` (deux lignes ajoutées le 17/10/2026).
6. **Branches** : 56 sur GitHub le 21/10/2026, dont 47 d'avant le 19/10/2026,
   sans ancêtre commun avec `main` (son historique repart du 19/10). Garder
   au moins `codex/interface-simulation-fidele` comme archive ; suppression par
   l'utilisateur seul (refusée à Claude, HTTP 403).
7. Facultatif : `contact` dans `config.php` (`php ~/www/configurer.php`, réponse
   `N` au mot de passe, SSH par mot de passe à rouvrir puis recouper). Journaux
   Apache et sauvegardes d'Alwaysdata à regarder une fois.

Fait côté hébergement (14/10/2026, déclaré) : HTTPS forcé, SSH par clé seule,
clés supprimées, secret `ALWAYSDATA_KNOWN_HOSTS` présent, ruleset sur `main`.
Faille PHP « PHP2Shell » (21/10/2026, mesuré) : version servie au web
**8.4.27** (corrigée) ; SSH par mot de passe rouvert le temps de la
vérification puis refermé (déclaré par l'utilisateur). Sur Alwaysdata, après
un correctif PHP, le site peut rester sur l'ancienne version : Web → Sites →
Redémarrer, puis contrôler la version servie, pas seulement `php -v`.

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
  est installé : en CI aussi depuis le 19/10/2026 (mesuré sur `e152e44`, 103 contrôles réussis).
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
- Coupure d'urgence depuis le téléphone : intégrée à `main` (`4e61580`), CI
  verte ; coupure et réouverture déclarées fonctionnelles par l'utilisateur
  le 21/10/2026. Accès : Actions → Coupure d'urgence. Le `.htaccess` original
  reste conservé hors du site dans `~/.wooclight-coupure` pendant la coupure ;
  les déploiements sont alors bloqués. Ne pas effacer cette sauvegarde.
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
- Menu « Atelier en cours » après « Mes ateliers » (Codex, en ligne le 19/10/2026). Démo créée
  depuis « Créer un atelier » (3ᵉ choix), « Supprimer les démos » dans Mes ateliers : validé
  par l'utilisateur le 19/10/2026 sur téléphone (nav).
- Explication et synthèse : jamais envoyées avant les résultats / jamais aux
  téléphones (e2e). Export `.json` des questions sans aucune réponse (e2e).
- Gommettes : sur les post-its principaux publiés, une colonne possible (e2e).
- Démo (`WL_DEMO_THEMES`) : bonne réponse fixée par thème ; « Supprimer les démos ». Les
  12 participants fictifs répondent aussi aux questions ajoutées (sauf mur et post-it)
  et 10 restent « actifs » (`wl_demo_simulate`, e2e) ; démos anciennes : 12 premiers inscrits.
  Avec « fonctions en essai » cochées, la démo se termine par le défi à étapes (nav).

**Affichage**
- Interface reprise de la simulation (19/10/2026) : référence figée
  `PAPPERBOARD-CHATGPT@7a80fc3a` dans `tests/reference/` (hors déploiement),
  guide `docs/interface-reference.md`, comparée par `tests/interface.js` aux
  4 tailles. Une surcharge d'`interface-php.css` de même spécificité qu'une
  règle adaptative de la référence l'écrase à toutes les tailles : vérifier
  aux quatre tailles avant d'en ajouter une. Tranché par l'utilisateur le
  19/10/2026 (ne pas reproposer) : texte faux de la simulation → équivalent
  vrai, même place ; archive : « Voir le bilan », « Réutiliser les
  questions », « Supprimer » ; fonctions réelles sans équivalent gardées ;
  ni bandeau « Simulation interactive » ni badge « Bac à sable ».
- Animation guidée (21/10/2026) : une action principale par étape, même état
  calculé pour Animer et la projection ; fermer ne publie jamais la
  correction ; mur et post-it publiés après relecture, avant fermeture. Seul
  champ public ajouté : le booléen `live`.
- Charte : évolution de « Papier & Terre » (AG-006, 18/10/2026), palette A
  (ivoire `#F7F0E4`, terracotta `#B74322`, pétrole `#10383C`), titres Georgia ;
  `tests/charte.php` (jetons, contrastes) et `tests/galerie.js` (768 cas).
  Moutarde `#B18400` gardée (AG-007, `#8A6500` refusé) : 3,00:1 sur l'ivoire,
  sans marge ; prune et terracotta proches, jamais la couleur seule. Galerie :
  `docs/galerie-resultats/index.html`, hors ligne. Bandeau de l'animateur
  (21/10/2026, choix de l'utilisateur) : erreur en rouge avec ⚠, confirmation
  en vert avec ✓, information inchangée (`banner(texte, 'erreur' | 'ok')`,
  nav). Badge « Vote ouvert » sur la projection : écarté le 21/10/2026. Connu : l'export PowerPoint provoque une erreur de console CSP
  « inline style » (`pptxgen.bundle.js`), le fichier est produit.
- Choix sélectionné du participant : brun neutre avec « ✓ » ; le vert ne
  désigne que la bonne réponse (quiz corrigé : autres barres en neutre).
  Projection : commandes en haut, canevas ajusté depuis sa taille naturelle,
  QR agrandi conservé.
- Projection dans un nouvel onglet ; aperçu participant dans une fenêtre
  séparée, synchronisée par le serveur, CSP inchangée. Info-bulles
  (`tooltips.js`, `aides.css`) au survol et au focus.
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
- Projection pilotée (20/10/2026, demande de l'utilisateur) : les mêmes commandes que l'onglet Animer,
  libellés courts — Précédente | Lancer / Ouvrir / Fermer / Rouvrir le vote | Afficher / Masquer (Publier) |
  Suivante (« Récap et conclusion » à la dernière question). Espace garde l'étape logique. Au téléphone,
  glisser ← → (≥ 60 px, horizontal) remplace Précédente / Suivante (nav).
- Défi à étapes (`steps`, 16/10/2026, en essai) : titres d'étapes communs ; variantes
  facultatives par appareil (2 à 4 : Windows, Mac, iPhone, Android…), même nombre
  d'étapes ; l'appareil choisi reste dans le navigateur, jamais envoyé ; décocher
  retire la réponse (tout décoché = plus compté). Visible seulement avec Réglages >
  « fonctions en essai » (réglage serveur `prefs.json`, commun à tous les appareils de
  l'animateur, écrit sous verrou : une écriture qui échoue renvoie une erreur, e2e) ; le serveur accepte le type dans tous
  les cas. Menus des défis prêts à l'emploi : à vérifier sur appareils (e2e, nav).
- Audit Codex du 17/10/2026 rendu (rapport hors dépôt public, lu sur `8f0eda2`). Vérifiés dans le
  code puis corrigés (e2e, `tests/archivage.php`, `tests/configurer.php`) : archivage vérifié
  avant suppression et sous le même verrou ; `prefs.json` sous verrou ; `ping` sans fichier de
  verrou pour un code inventé ; relance de `configurer.php` qui garde les réglages ; texte du
  bilan IA (nuage, gommettes) soumis à la case ; QR d'une adresse non ASCII ; pourcentages
  PowerPoint (QCM multiple, étapes) ; « Quitter » hors ligne ne promet plus l'effacement.
  Réordonner les choix d'une question (mêmes choix, autre ordre) efface ses réponses, décidé
  le 17/10/2026 (`wl_options_reordered`, e2e), sauf les colonnes d'un post-it (les notes suivent leur colonne, par son nom) ;
  reformuler un choix garde les réponses.
  Suites décidées le 17/10/2026 : rappel « aucun nom » à l'archivage (la conclusion et la synthèse sont
  gardées sans limite, pas de durée) ; adresses du type `127.1` refusées (`wl_clean_link`, e2e) ;
  PowerPoint : « … et N autres » au-delà de 8 idées / 30 réponses ; tests de durée et de limite
  de votes tolérants au passage de la seconde ou de la minute. Écartés : quota IP sur `ping` (wifi
  partagés) ; déploiement strict (`ALWAYSDATA_KNOWN_HOSTS`, redirection HTTPS) : laissé tel quel
  par l'utilisateur, risque faible (interception de la première connexion).
- AGORA (`AGORA.md`, `CLAUDE.md` §6, 17/10/2026) : AG-001 à AG-005 tranchés le 17/10/2026 par
  l'utilisateur : le format `steps`/`variants`, `prefs.json`, l'aide « Bloqué » éphémère, le seuil de 3 de l'avant/après et le stockage serveur des thèmes sont gardés tels quels (ne pas les
  défaire sans nouveau bloc). Chaque « décision à trancher » est candidate à un bloc.
- Avant / après (17/10/2026) : calculé sur les personnes qui ont répondu aux deux questions
  si elles sont au moins 3 (`WL_COMPARE_MIN`), sinon sur tous les répondants, avec « mêmes N
  personnes » ou « personnes différentes » dans le texte (e2e). Jamais une réponse isolée.
- Aide « Bloqué » par étape (17/10/2026) : un signal « Besoin d'aide » qui porte l'étape
  (`wl_signal`, 2 minutes, un signal par personne), compté par étape sans identité
  (`wl_signal_steps`, `helpSteps`) ; rien de durable (e2e, nav à 390 px). Pas simulé dans la démo :
  se rejoindre soi-même dans une autre fenêtre.
- Fiche mémo à emporter (17/10/2026) : `api.php?action=export&format=memo`, bouton dans l'onglet
  Bilan de la session ; réservée à l'animateur, aucune page publique. Ne contient que ce que
  l'animateur a écrit (conclusion, explications, bonnes réponses, exercices et étapes), jamais une
  réponse ni un chiffre (e2e). Aucun lien « ressources vérifiées » : seulement ceux de l'animateur.
- Bibliothèque de séances (17/10/2026) : `assets/seances.js`, 5 **brouillons à relire** (arnaques,
  démarches initiation, démarches niveau intermédiaire du même jour, pièces jointes, réglages), créés par l'import validé côté serveur ; rien n'est validé
  sur le terrain, aucun site inscrit, aucun menu d'appareil précis. Le test de navigateur
  importe chaque séance. Le 33700 (signalement SMS) et « .gouv.fr » sont à vérifier par
  l'utilisateur.
  Thèmes ajoutés par l'animateur (`seances.json`, 30 au plus, sous verrou, validés par l'import à
  l'enregistrement ; AG-005 tranché le 17/10/2026) : « Copier la consigne de relecture » (même méthode que la
  relecture des questions générées, avec la version corrigée en dernier), puis la réponse collée
  dans « Ajouter un thème » ; ou « Enregistrer comme thème » dans le bilan d'une session. Contenu
  pédagogique seulement, jamais purgé (e2e, nav).
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
- Aucune en attente (les trois pistes du 16/10/2026 sont en ligne). Rappel : la
  plupart des ateliers se font sur ordinateur (dire « appareil », pas « téléphone »).
*Écartées :* 17/10/2026 — notes privées de l'animateur par question (objectif, consigne, indice) :
l'utilisateur anime seul, et un champ privé doit être exclu de la projection, de l'archive et de
l'export (risque de fuite) ; à ne pas reproposer sans fait nouveau. 15/10/2026 — génération par API (bouton « Générer ») : l'utilisateur
y renonce, le copier-coller suffit.
