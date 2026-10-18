# Consigne d'audit Codex — WoocLight, audit complet (18/10/2026)

Rédigée le 18/10/2026 à partir de MD-LIB `consigne-audit-externe.md`. Audit **complet** du dépôt
(le précédent, du 17/10/2026, portait sur les ajouts récents). Le contexte ne contient que des
faits : ni conclusion d'une autre IA, ni description des protections en place. À coller telle
quelle dans Codex.

**Avant** : accès en lecture seule au seul dépôt `maswaddpt47-cmyk/PAPPERBOARD` ; autorisations
« Lecture seule » ; réflexion au plus haut niveau ; aucune donnée réelle, capture ni identifiant.
Version à examiner : `main`, commit `ddd21ef`. Si `git clone` bloque, passer par le connecteur
GitHub tout de suite (le dire), sans insister.
**Après** : vérifier chaque point dans le code avant de le croire ; ranger le rapport hors de tout
dépôt public ; reporter les corrections dans `CHANTIERS.md` ; l'utilisateur tranche.

```text
Tu es auditeur de sécurité, de conformité RGPD et de qualité logicielle. Audit complet en
LECTURE SEULE : ne modifie aucun fichier, ne crée ni branche ni pull request, n'appelle aucune
URL de production, n'exécute rien qui écrive hors d'un dossier temporaire. Version à examiner :
branche main du dépôt maswaddpt47-cmyk/PAPPERBOARD, commit ddd21ef. Si la récupération Git
échoue, utilise tout de suite le connecteur GitHub et dis-le.

CONTEXTE (faits, pas conclusions)
WoocLight : application web de participation en direct (type Wooclap) pour des ateliers de
médiation numérique, projet personnel d'un animateur unique (il est le responsable de
traitement). Participants : seniors, collégiens (mineurs), travailleurs sociaux, agents, sur
ordinateur ou téléphone, sans compte, avec un code de 5 caractères ou un QR code. L'animateur
se connecte avec un mot de passe unique. PHP 8 sans framework, JavaScript sans build, aucune
dépendance serveur, aucun service externe appelé par l'application (le QR code est dessiné dans
le navigateur ; le PowerPoint du bilan est généré dans le navigateur avec une bibliothèque
embarquée dans assets/). Hébergement mutualisé Alwaysdata. Déploiement automatique depuis main
par GitHub Actions (rsync par SSH). Le dépôt est public.

ARCHITECTURE
- api.php : point d'entrée unique, api.php?action=… ; GET = lecture, POST = écriture (corps JSON
  de 64 Ko au plus, en-tête X-CSRF-Token). Listes d'actions :
  GET public : state, screen. GET animateur : me, sessions, admin_state, export, archives,
  archive, seances. POST public (jeton participant) : join, leave, vote, post, post_delete, like,
  signal, ask, ask_vote, ping. POST animateur : login, logout, session_create,
  session_duplicate, session_delete, session_rename, session_demo, demo_delete,
  session_conclusion, session_synthesis, session_archive, archive_delete, archive_reuse,
  question_save, questions_import, questions_duration, question_delete, question_move, control,
  answer_hide, post_admin, ask_admin, prefs_save, seance_save, seance_delete.
- lib.php : bibliothèque commune (configuration, verrous, sessions, questions, résultats,
  archives, purge, import, thèmes, signaux, démo). index.php (participant), admin.php
  (animateur), screen.php (projection publique, screen.php?s=CODE), purge.php (ligne de
  commande, tâche planifiée), configurer.php (ligne de commande, crée config.php).
- assets/ : app.js (participant), admin.js, screen.js, common.js, charts.js, bilan-pptx.js,
  seances.js (séances livrées), qrcode.js et pptxgen.bundle.js (bibliothèques embarquées),
  style.css, print.js.
- Stockage : fichiers JSON dans un dossier défini par config.php (non versionné) : sessions/*.json
  et leurs .lock, archives/*.json, rl/*.json (compteurs de limite de débit), login.json
  (échecs de connexion), prefs.json, seances.json. Écriture par verrou fichier et remplacement
  atomique. config.php porte le hash du mot de passe, un secret, des quotas et la durée de purge.
- Identité du participant : jeton aléatoire signé, cookie wl_p et copie dans le stockage local du
  navigateur ; jeton CSRF dérivé ; clé de participant dérivée du code de session et du jeton ;
  IP hachée avec sel pour les limites de débit. Aucune donnée personnelle demandée.
- Session animateur : session PHP, jeton CSRF, compteur d'échecs de connexion.
- Types de questions : yesno, truefalse, mcq (choix unique ou multiple), poll, scale, wordcloud,
  text, points, wall, postit, dots (gommettes), steps (défi à étapes avec variantes par appareil).
- Fonctions : réponses libres, nuage de mots, mur et post-it avec « j'aime » et modération,
  pseudonymes et classement des quiz, « Oser demander » (questions anonymes, votes), signaux de
  difficulté (dont « Besoin d'aide » rattaché à une étape d'un défi), questions « avant / après »
  (comparaison calculée sur les personnes ayant répondu aux deux, seuil de 3), lien d'exercice
  par question (https, QR code à la projection), session de démonstration avec participants
  fictifs, archives anonymes (conclusion et synthèse de l'animateur conservées), purge par
  tâche planifiée, exports (CSV, version imprimable, fiche mémo à emporter, questions en JSON,
  PowerPoint côté navigateur), import de questions collées (texte d'une IA ; aucune IA n'est
  appelée par l'application), bibliothèque de séances (livrées dans assets/seances.js, et
  thèmes enregistrés par l'animateur dans seances.json), consigne de relecture à copier vers
  une autre IA (copie dans le presse-papiers seulement).
- Tests : tests/run.sh (syntaxe PHP/JS, e2e PHP contre php -S, charge, configuration guidée,
  archivage, données hors de la racine web, navigateur Playwright). CI : .github/workflows/
  ci-deploy.yml.

RÈGLE DE MÉTHODE
Ne lis PAS les fichiers .md du dépôt (CLAUDE.md, CHANTIERS.md, AGORA.md, README.md, docs/…)
avant d'avoir terminé ton propre relevé : ils contiennent les conclusions d'autres outils, et
on veut ton regard indépendant. Tu peux les lire à la fin, uniquement pour signaler un
désaccord avec eux. Découpe le travail en sous-audits parallèles si tu le souhaites, mais
consolide en un seul rapport.

À EXAMINER (tous les axes, sans en privilégier un)
1. Contrôle d'accès : pour CHAQUE action de api.php (liste ci-dessus), quel rôle peut l'appeler
   et peut-on contourner (jeton d'un autre participant, CSRF, paramètre forcé, session d'un
   autre code, rejeu, méthode HTTP inattendue, actions non listées) ? Fixation ou fuite de
   session animateur, force brute du mot de passe, énumération de codes de session.
2. Données participants : ce que chaque réponse publique (state, screen) expose à un tiers qui
   connaît ou devine un code de 5 caractères ; comparaison entre participants ; ré-identification
   (pseudonymes, avant / après, signaux, questions anonymes, petits effectifs).
3. Injections : XSS (tout texte reçu affiché autrement que par textContent, y compris dans le
   HTML construit en PHP : version imprimable, fiche mémo, pages d'erreur), formules dans les
   exports CSV, injection d'en-têtes, chemins de fichiers dérivés d'une saisie, JSON importé
   (types, tailles, clés inattendues, objets imbriqués, références croisées), texte collé issu
   d'une IA (import, enregistrement de thème).
4. Liens et redirections : champ link (schéma, domaine, caractères, longueur, homographes,
   adresses IP sous des formes inhabituelles), QR code, ouverture dans un nouvel onglet, fuite de
   code de session par Referer ou window.opener.
5. Stockage et concurrence : écritures simultanées sur les fichiers JSON, verrous, remplacement
   atomique, fichiers temporaires, fichiers laissés derrière une requête invalide, épuisement
   disque ou inodes par un participant, archivage puis suppression, purge pendant une activité,
   comportement quand le dossier de données est absent, plein ou non inscriptible.
6. Secrets et configuration : fichiers internes servis par Apache (.htaccess), erreurs trop
   bavardes, en-têtes de sécurité (CSP : que bloque-t-elle, que laisse-t-elle passer ?), cookies
   (attributs), configurer.php et purge.php (accès web, droits de fichiers), relance de la
   configuration (valeurs conservées ou perdues).
7. Déploiement : .github/workflows/ci-deploy.yml (injections, permissions, secrets, actions
   épinglées, vérification d'empreinte SSH, redirection HTTPS, fichiers exclus du déploiement),
   réglages visibles du dépôt GitHub public.
8. RGPD : minimisation, durées de conservation réellement appliquées (sessions, archives,
   rl/, login.json, prefs.json, seances.json, fichiers .lock), données personnelles possibles
   dans les textes libres, le stockage du navigateur, les exports, les archives et le bilan copié
   vers une IA externe ; cas des mineurs ; cohérence entre ce que l'interface promet aux
   participants (mentions, boutons « Quitter », anonymat) et ce que le code fait réellement.
9. Fiabilité et justesse : calculs (pourcentages, avant / après, classements, PowerPoint, CSV),
   cas limites (zéro réponse, un seul participant, options réordonnées ou retirées après des
   réponses, questions supprimées ou déplacées, session terminée), cohérence entre l'application
   et ses sorties (admin, projection, bilan, exports, archives).
10. Abus et disponibilité : limites de débit (par IP, par jeton), coût du polling, capacité par
    session, taille des corps de requête, boucles ou fichiers volumineux, démarrage en grand
    nombre, requêtes qui créent des fichiers.
11. Accessibilité et robustesse du client : parcours au clavier, focus, contrastes, lecteur
    d'écran, usage à 390 px de large et en projection, comportement hors ligne ou réseau
    coupé, double envoi, rechargement de la page.
12. Qualité des tests : ce que la suite ne couvre pas et qui mérite un test, tests dépendants de
    l'heure ou de l'ordre, tests qui passeraient même avec le défaut qu'ils prétendent garder.

FORMAT DE RÉPONSE (en français)
Un tableau, un problème par ligne, du plus grave au moins grave :
| N° | Gravité (critique / haute / moyenne / basse) | fichier:ligne |
| Problème | Scénario concret (qui, comment, résultat) |
| Correction proposée | Confiance (certain / probable / à vérifier) |

Règles :
- Pas de problème sans fichier:ligne et sans scénario concret. Un risque théorique sans chemin
  d'exploitation va dans une liste à part « Remarques ».
- Chaque ligne doit avoir été vérifiée en lisant le code appelant ; « certain » = comportement
  vérifié dans le code avec ses préconditions.
- Pour chaque axe sans défaut notable, dis-le en une ligne et cite ce que tu as regardé.
- Termine par : (a) « Les cinq corrections à faire d'abord », (b) « Ce que je n'ai pas pu
  vérifier » (configuration réelle, données réelles, cron, Apache, HTTPS, secrets, GitHub).
- Aucun compliment, aucune note globale, aucune conclusion juridique.
```
