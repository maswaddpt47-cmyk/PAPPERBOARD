# CHANTIERS — WoocLight

État au **21/10/2026** — commit de référence : voir `git log -1 main`.
**En ligne** sur https://wooclight.alwaysdata.net (déploiement automatique vert
à chaque mise à jour de `main`, vérifications après déploiement comprises).
`config.php` créé (CONFIG OK). Tests verts en CI (e2e, charge, configurer, archivage, protect).
Testé de bout en bout par l'utilisateur le 15/10/2026 (atelier « Temps d'écran »).

## Animation guidée — essai utilisateur à faire (21/10/2026)

Feu vert de l’utilisateur le 21/10/2026 : même parcours dans **Animer et la projection**.
Branche `codex/animation-guidee-20261021`, partie de `60adf58`.

- Une action principale : démarrer, clore les réponses, afficher les résultats,
  question suivante, terminer après confirmation (y compris au clavier et au glisser).
  Fermer ne publie jamais la correction. Mur et post-it gardent la publication après
  relecture, avant fermeture ; les modes de projection en direct sont conservés.
- État distinct de l’écran du groupe et des appareils, calculé par le même helper.
  La vue privée de l’animateur est explicitement identifiée. Participants est un panneau
  modal (QR, inscriptions, échanges, classement) ; la projection ouvre ce même panneau
  pour la bonne session. Les commandes avancées restent accessibles.
- Aucun changement d’authentification, de CSRF, de stockage des réponses ou de polling.
  Le seul champ public ajouté est le booléen de configuration `live`, pour nommer
  correctement les deux affichages. Un mode direct garde son libellé « Masquer sur les
  appareils » ; un quiz masque aussi la projection.
- Aide intégrée, guide HTML et PDF actualisés. La galerie se teste par le serveur HTTP
  de la suite, sans dépendre du protocole file:// du navigateur. Tous ses contrôles restent actifs.

**Mesuré le 21/10/2026 en local (PHP 8.3, Chromium)** : contrôles PHP verts ; 112 contrôles
navigateur, 307 contrôles d’interface et 768 cas de galerie réussis. Mesures à 1920×1080,
1280×720, 1024×768 et 390×844 : aucun débordement horizontal ; projection sans défilement
ni résultat coupé. Publication / masquage / réouverture synchronisés entre Animer,
projection et participant ; la correction est masquée avant la réouverture.

**À vérifier par l’utilisateur après publication** : Animer → Participants (QR / inscriptions),
parcours d’un quiz depuis chaque écran, puis mur / post-it avec relecture. Les fichiers
anciens de `/workspace/PAPPERBOARD` sont préservés : travail depuis une copie propre.

## Chantier interface fidèle à la simulation — 19/10/2026 (reprise Claude)

**En ligne le 19/10/2026** : `main` = `8c512da`, run Actions 39267984825 vert
(tests, deploy, paquet) ; l’étape « Vérifier la mise en ligne » a relu sur le
serveur le contenu du commit pour les sept ressources de l’interface.
**Reste** : essai par l’utilisateur sur PC et téléphone (Animer, Préparer, Bilan).
Branche de travail : `claude/eloquent-faraday-768r87`, partie de
`codex/interface-simulation-fidele` (`f19df16`).

**Fait le 19/10/2026 (mesuré, `bash tests/run.sh` vert en local : PHP 8.3, Chromium)** :
- Fenêtre de création à 390 px : 352 px comme la référence. Cause : la surcharge
  `max-width: calc(100vw - 28px)` d’`interface-php.css` remplaçait la limite
  native des `dialog` gardée par la référence ; retirée.
- Écarts que le test ne voyait pas, trouvés aux captures : marque « WoocLight »
  en double dans la barre du haut (fil d’Ariane poussé à droite), vide de
  ~230 px sous le titre à 390 px (`.heading-copy` à base flexible de 20rem en
  colonne), titres de panneaux, bandeau d’état, liste des questions (défilement
  interne, métadonnées sur trois lignes), carte « Votre atelier » encadrée,
  boutons d’en-tête réduits, chiffre de participation, lignes de réponse.
- Préparer : carte et liste comme `.preparation-panel` (pleine largeur),
  conclusion comme `.conclusion-card`.
- Bilan : chiffres clés et une carte de résultats par question affichés
  d’emblée, comme le récap de la simulation ; synthèse IA, PowerPoint et exports
  gardés dessous. Le bouton « Voir le tableau de bord » est retiré (doublon).
- `tests/interface.js` compare 8 éléments de plus aux 4 tailles et vérifie la
  marque masquée et la hauteur de l’en-tête mobile (265 contrôles, rouge sur
  l’ancien code).

**Second passage le 19/10/2026, sur la demande de l’utilisateur (« tout à l’identique »)** :
« Mon espace » refait comme la simulation : Vue d’ensemble (atelier modifié en
dernier, « Votre progression », deux idées de séance), Bibliothèque de modèles
(cartes de séance, puis les outils de relecture et d’ajout de thème), Mes
ateliers (ateliers en cours, ateliers archivés, démos) ; menu « Vue d’ensemble /
Mon atelier / Bibliothèque de modèles / Mes ateliers ». Pilotage et Réglages
réordonnés comme la référence. L’API gagne un seul champ, `explored` dans la
liste des sessions. `tests/interface.js` compare aussi les trois vues (312 contrôles).

**Tranché par l’utilisateur le 19/10/2026** (ne pas reproposer) :
1. Textes de la simulation faux dans la vraie application : équivalent vrai,
   même place, même style.
2. Ligne d’atelier archivé : « Voir le bilan », « Réutiliser les questions »,
   « Supprimer » (testé dans `tests/interface.js`).
3. Fonctions réelles sans équivalent dans la simulation (durée de vote,
   classement, signaux réels, carte « Cette session » de Réglages) : gardées.
Ne restent volontairement absents : bandeau « Simulation interactive » et
badge « Bac à sable » (proposé et accepté le 19/10/2026).

### Code sauvegardé et points à ne pas défaire

- Référence visuelle : `PAPPERBOARD-CHATGPT@7a80fc3a81083f3cb8adf4dfc5e79e686e9fb5bb`,
  figée dans `tests/reference/` (exclu du déploiement). Guide :
  `docs/interface-reference.md`.
- Composants : `assets/interface.css` (règles de la référence, préfixées
  `body.admin`), `assets/interface-php.css` (liaison avec le PHP),
  `assets/interface.js`. Une surcharge PHP de même spécificité qu’une règle
  adaptative de la référence l’écrase à toutes les tailles : vérifier aux
  quatre tailles avant d’en ajouter une.
- Projection : screen.php, interface-screen.css et screen.js ; commandes en
  haut, canevas ajusté depuis sa taille naturelle, QR agrandi conservé.
- Info-bulles : tooltips.js et aides.css, survol/focus, dialogues et projection.
- Garder API, authentification, CSRF, CSP, anonymat, modération, purge horaire
  réelle, démos, relecture JSON par une autre IA, exports et coût du polling.
- AG-007 : `#8A6500` refusé par l’utilisateur ; conserver `#B18400` en production.
- Projection dans un nouvel onglet ; aperçu participant dans une fenêtre
  séparée sur la vraie page PHP, synchronisée par le serveur, CSP inchangée.
- Aucun accès au contenu de config.php, aucun secret ni donnée réelle dans les tests.

## Chantier charte graphique (branche `test/nouvelle-charte`, phases 1 à 4 en ligne le 18/10/2026)

Ouvert le 18/10/2026. **AG-006 tranché le 18/10/2026 par l'utilisateur** : évolution de « Papier & Terre », pas un remplacement ; la palette, les variantes et le PowerPoint adaptés sont gardés (ne pas les défaire sans nouveau bloc). Palette de base validée le 18/10/2026 (ivoire `#F7F0E4`, terracotta `#B74322`, pétrole `#10383C`, vert, moutarde, prune) et variantes validées avec leurs contrastes. **Phase 1 faite le 18/10/2026 : `assets/style.css` seulement** (jetons en trois niveaux, thème clair, projection sombre pétrole, projection claire). Aucune classe ni logique modifiée ; `bash tests/run.sh` vert. **Reste** : phase 2 (structure, composants), 3 (rendus, projection), 4 (responsive, accessibilité), 5 (validation) ; `assets/bilan-pptx.js` et l'impression gardent l'ancienne palette jusqu'à la phase 3 ; **phase 1 fusionnée dans `main` et en ligne le 18/10/2026 (`ad7c430`, déploiement vert) à la demande de l'utilisateur, pour la voir sur téléphone** ; les phases suivantes se travaillent sur la branche, à fusionner sur sa demande. Ressources de Codex : `docs/charte-v3/`.
**Phase 2 faite le 18/10/2026** (`style.css` seulement) : en-tête, navigation, titres, cartes, liste de questions, champs, boutons désactivés (pointillés), modale, états (symbole + couleur, état vide en pointillés, point d'attente). Quiz corrigé : les barres autres que la bonne réponse passent en neutre (le vert ne désigne que la bonne réponse). **Non fait, à décider** : le bandeau `banner` sert aux erreurs comme aux confirmations, sans variante ; les distinguer demande un changement JS (`admin.js`, `app.js`).
**Phase 3 faite le 18/10/2026** : anneau Oui/Non aux couleurs des barres (Oui terracotta, Non vert ; quiz corrigé : vert pour la bonne réponse seulement), nuage aux quatre couleurs de la charte, filet d'explication, états vides encadrés (classe `results-none` ajoutée dans `common.js`), liseré d'en-tête par mode (animateur pétrole, participant moutarde), fonds de tracé visibles en projection claire (`--wl-trace`), jauge vide sans points parasites (`charts.js`), PowerPoint à la nouvelle palette claire. **Galerie des résultats** : `docs/galerie-resultats/index.html` (ouvrir le fichier dans un navigateur ; bloquée en ligne par `.htaccess`), 12 formes × 4 états × 4 modes avec les vraies fonctions de rendu, données fictives ; matrice de 768 cas mesurée le 18/10/2026 : 0 erreur JS, 0 débordement, 0 résultat vide, projection dans l'écran à partir de 768 px.
**Phase 4 faite le 18/10/2026** (audit navigateur aux 4 tailles sur animateur, participant, projection sombre et claire, résultats masqués et publiés) : « détails » et lien d'invitation portés à 48 px de haut, textes de la projection jamais sous 15 px (méta de question, code sous le QR), barre de pilotage arrêtée avant le QR code (elle passait dessous à 768 et 1440 px). Mesuré : 0 débordement, 0 cible sous 44 px, 0 chevauchement, 0 texte sous 13,5 px, 0 `tabindex` positif, contour de focus plein sur tous les éléments parcourus au clavier. **Pas fait** : lecteur d'écran réel, simulation du daltonisme, zoom 200 %. **Phases 2 à 4 fusionnées dans `main` et en ligne le 18/10/2026 à la demande de l'utilisateur ; phase 5 (validation finale) faite le 18/10/2026, voir plus bas.**
**Phase 5 faite le 18/10/2026** : `tests/charte.php` (statique : aucune adresse externe, aucune couleur hors des blocs de jetons, jetons définis, palette de base, contrastes des couples essentiels, 15 vérifications) et `tests/galerie.js` (768 cas de la galerie, avec Playwright) ajoutés à `tests/run.sh`. Contrôlés : syntaxe JS de `assets/`, de la galerie et des sources du sandbox ; import de `docs/charte-v3/sources/exemple-import.json` par l'interface réelle (4 questions + la conclusion, qui n'est pas une question) ; export PowerPoint de bout en bout (12 diapositives, nouvelle palette présente, ancienne absente) ; fichier autonome et archive du sandbox v3 (empreintes, `unzip -t`, sources identiques, `qa.cjs` 18 scénarios et `qa-preparation.cjs` 14 scénarios) ; paquet zip de la CI (22 fichiers, ni `docs/` ni `tests/`). **Connu, non causé par la charte** : l'export PowerPoint déclenche une erreur de console « inline style » refusée par la CSP, venue de `pptxgen.bundle.js`, déjà présente à `56d0751` ; le fichier est produit.
Écarts connus (mesurés le 18/10/2026) : moutarde `#B18400` à 3,00:1 sur l'ivoire, sans marge ; moutarde sur la piste claire 2,7:1 (étiquette toujours écrite) ; prune et terracotta proches (ΔE 35), jamais la couleur seule.

## Chantier navigation v3 (branche `test/navigation-v3`, étapes 1 à 3 en ligne le 18/10/2026)

Ouvert le 18/10/2026 : le prototype v3 (`docs/charte-v3/`) est une refonte de la navigation de l\'espace animateur, pas une charte de couleurs ; l\'utilisateur a choisi la **palette A** (ivoire / terracotta, projection bleu pétrole) et les **titres en Georgia**, sur les **trois écrans**. Les points non tranchés reprennent mes propositions du 18/10/2026 : Réglages en 4ᵉ onglet, Vue d\'ensemble = Mes sessions, Bibliothèque = séances prêtes à animer, Historique = archives. **Étape 1 faite sur la branche, pas en ligne : espace animateur** (`admin.php`, `assets/shell.js` nouveau, `assets/style.css`) : menu latéral (complet dès 1200 px, icônes seules de 640 à 1199 px, tiroir avec voile sous 640 px), fil d\'Ariane, carte « Votre atelier », onglets à icônes, actions « Aperçu participant » et « Ouvrir la projection ». Aucun identifiant ni logique de `admin.js` modifié ; les entrées du menu relaient les boutons existants. **Étape 1 fusionnée dans `main` et en ligne le 18/10/2026 (`2a4472a`).** **Étapes 2 et 3 faites et fusionnées dans `main` le 18/10/2026 (`bfa0c93`, déploiement vert)** : participant (`index.php`, `style.css`) en-tête clair avec marque et liseré moutarde, type de question en petites capitales, choix en lignes avec lettre A, B, C… (le choix sélectionné reste brun neutre avec « ✓ », voir « Points à ne pas défaire ») ; case d'une bonne réponse qui garde son texte à côté (défaut ancien corrigé) ; projection (`screen.php`, `style.css`) : chaque réponse dans une carte (lettre, texte, décompte, barre fine), carte teintée pour la bonne réponse, plancher de 14 px sur téléphone. Aucun fichier JavaScript modifié, aucun identifiant renommé. Non repris du v3 : badge « Vote ouvert » sur la projection (contenu nouveau, à décider). Non repris du v3 : badge « Bac à sable », « Galerie des résultats » (hors ligne, `docs/`), carte « À vous de jouer », accroche « Le lien fait l\'atelier ».

## Chantier interface de la simulation (en ligne le 19/10/2026, `1ab7778`)

Ouvert le 19/10/2026 (consigne `PAPPERBOARD-CHATGPT/docs/CONSIGNE-CLAUDE-UI-PHP.md`). Audit,
décisions et suivi : `docs/integration-ui-simulation.md`. Mise en ligne seulement sur le feu vert
de l'utilisateur. AG-007 (moutarde `#8A6500`) refusé par l'utilisateur le 19/10/2026 : `#B18400` gardé.
**Fait sur la branche le 19/10/2026** (tests verts en local) : espace animateur, création vide / JSON
(niveau, durée, public « Autres »), projection (commandes en haut, masquage dédié, QR cliquable).
**En ligne le 19/10/2026** sur le feu vert de l'utilisateur (`main` = `1ab7778`, déploiement vert,
vérifié par `attendre-deploiement.sh`). **Reste** : essai par l'utilisateur sur PC (création JSON, Pilotage,
Animer, projection).

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
   Ajouts des 16 au 18/10/2026, à voir sur PC : lien d'exercice et QR ; défi à étapes et
   « ✋ Bloqué » (Réglages > fonctions en essai) ; avant / après sur les mêmes personnes ;
   fiche mémo (Bilan > Exports) ; bibliothèque de séances et thèmes ajoutés (page Sessions) ;
   rappel à l'archivage ; réordonner des choix efface les réponses ; PowerPoint avec « … et
   N autres ».
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
6. Facultatif : `contact` dans `config.php` (`php ~/www/configurer.php`, réponse
   `N` au mot de passe, SSH par mot de passe à rouvrir puis recouper). Journaux
   Apache et sauvegardes d'Alwaysdata à regarder une fois.

Fait côté hébergement (14/10/2026, déclaré) : HTTPS forcé, SSH par clé seule,
clés supprimées, secret `ALWAYSDATA_KNOWN_HOSTS` présent, ruleset sur `main`.
Faille PHP « PHP2Shell » (21/10/2026, mesuré) : version servie au web
**8.4.27** (corrigée), relevée en SSH par un fichier `v.php` aussitôt supprimé ;
SSH par mot de passe rouvert le temps de la vérification puis refermé
(déclaré par l'utilisateur). Sur Alwaysdata, après un correctif PHP, le site peut
rester sur l'ancienne version (cas d'ATELIERS le même jour) : Web → Sites →
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
- 16/10/2026 — Exercices pratiques après un quiz. (1) Défi à étapes : **en ligne
  le 16/10/2026, en essai** (voir « Points à ne pas défaire »). (2) Lien d'exercice avec QR code : **en ligne
  le 17/10/2026**. (3) Fiche mémo à emporter : **faite le 17/10/2026**, voir « Points à ne pas défaire ». Limite : tout est déclaratif.
  La plupart des ateliers se font sur ordinateur (dire « appareil », pas « téléphone »).
*Faites le 17/10/2026, à valider par l'utilisateur* : avant / après sur les mêmes personnes,
aide « Bloqué » par étape (AG-003 et AG-004 tranchés le 17/10/2026).
*Faites le 16/10/2026* : avant / après, clôture prête à l'emploi, taille du texte,
défi à étapes (en essai).
*Écartées :* 17/10/2026 — notes privées de l'animateur par question (objectif, consigne, indice) :
l'utilisateur anime seul, et un champ privé doit être exclu de la projection, de l'archive et de
l'export (risque de fuite) ; à ne pas reproposer sans fait nouveau. 15/10/2026 — génération par API (bouton « Générer ») : l'utilisateur
y renonce, le copier-coller suffit.
