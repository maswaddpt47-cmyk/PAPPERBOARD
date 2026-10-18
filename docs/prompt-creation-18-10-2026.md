# Prompt de création — WoocLight, reconstruction depuis zéro (18/10/2026)

Prompt pour **construire l'application dans un dépôt vide**, sans partir du code existant (ce n'est pas un
audit). Il décrit le produit tel qu'il est le 18/10/2026, avec les décisions de produit à garder, les
exigences de sécurité et de robustesse apprises en route, et un ordre de construction par jalons.
À coller tel quel dans Codex, après avoir remplacé `[NOM_DU_DEPOT]`.

```text
Tu es un ingénieur logiciel senior. Tu construis « WoocLight » de zéro, dans le dépôt vide
[NOM_DU_DEPOT]. WoocLight est une application web de participation en direct (type Wooclap, version légère)
pour des ateliers de médiation numérique. Ce n'est PAS une migration : n'ouvre aucun autre dépôt, pars de
cette description. Livre un projet complet, testé, prêt à être déployé sur un hébergement mutualisé PHP.
Tout ce qui est écrit ici est une exigence, sauf ce qui est marqué « libre ».

════════════════════════════════════════
0. FAÇON DE TRAVAILLER
════════════════════════════════════════
- Réponds et écris en français (interface, commentaires, README, messages de commit). Direct, court,
  sans compliment.
- Avance par jalons (section 12). À la fin de chaque jalon : lance les tests, commite (un commit par
  modification logique, message conventionnel : feat:, fix:, refactor:, style:, docs:, chore:), puis passe
  au suivant. Ne dis « testé » que pour ce que tu as réellement exécuté ; le reste est « hypothèse non
  vérifiée ».
- Pose une question seulement si le choix est bloquant. Sinon décide, et consigne la décision dans
  CHANTIERS.md au moment où tu la prends.
- Tiens à jour, à chaque jalon, deux fichiers : README.md (installation pas à pas, test rapide, dépannage)
  et CHANTIERS.md (état, décisions à trancher, limites connues, « points à ne pas défaire » avec le
  pourquoi). Pas de changelog dans le code (« v1.2 : … ») : l'histoire va dans git log.
- Aucune donnée réelle, aucun secret, aucun mot de passe dans le dépôt ni dans tes messages.

════════════════════════════════════════
1. PRODUIT ET PUBLIC
════════════════════════════════════════
- Un animateur unique (propriétaire de l'installation, responsable de traitement RGPD) anime des ateliers
  surtout sur ordinateur, parfois sur téléphone. Vocabulaire : dire « appareil », pas « téléphone ».
- Participants : seniors peu à l'aise, collégiens (mineurs), travailleurs sociaux, agents. Ils rejoignent
  depuis un ordinateur, une tablette ou un téléphone, sans compte, avec un QR code ou un code de 5
  caractères. Interface entièrement en français, lisible par des seniors (texte de base 18 px, cibles
  tactiles ≥ 48 px, grands textes).
- Trois interfaces : participant (index.php), projection en salle (screen.php?s=CODE, vidéoprojecteur lu de
  loin, 16:9, plein écran), animateur (admin.php, protégé par mot de passe).
- Outil personnel : aucune couleur ni logo d'une institution.

════════════════════════════════════════
2. CONTRAINTES TECHNIQUES
════════════════════════════════════════
- PHP 8.x sans Composer, sans framework, sans extension particulière. Pas de base de données : stockage en
  fichiers JSON dans un dossier DATA_DIR défini par config.php (hors de la racine web par défaut ; sinon
  .htaccess « Require all denied » + index.php vide). Écriture : verrou flock exclusif + fichier temporaire à
  nom unique + rename atomique ; toute erreur d'écriture lève une erreur (jamais un faux succès).
- HTML/CSS/JavaScript vanilla, sans build, sans npm côté application, sans CDN ni police externe ni image
  distante. Bibliothèques embarquées dans assets/ avec leur licence : un générateur de QR code (le QR est
  dessiné dans le navigateur) et pptxgenjs (export PowerPoint dans le navigateur).
- Politique de sécurité du contenu stricte : default-src 'none' ; scripts, styles, connexions et images
  limités à 'self' (images aussi data:) ; base-uri 'none', form-action 'self', frame-ancestors 'none'. Donc
  aucun script ni style en ligne, aucun attribut style=, aucun onclick, JAMAIS d'innerHTML : tout texte reçu
  est inséré par textContent ou par des nœuds créés. Une seule feuille de style.
- En-têtes de sécurité complets (CSP, Referrer-Policy: no-referrer, X-Content-Type-Options, COOP
  same-origin, cache désactivé pour les réponses d'API).
- Fichier .htaccess : bloque les fichiers internes (lib.php, purge.php, configurer.php, config*.php, *.md,
  *.sh, *.json, *.lock, *.tmp) ; aucune dépendance à des modules exotiques.
- Versionnement des assets : une fonction wl_asset() ajoute ?v=<empreinte> à chaque script/feuille de style
  (sans elle, un navigateur garde l'ancien JS).
- Polling : les écrans interrogent l'API toutes les 2 s (configurable). Les réponses portent un ETag fondé
  sur un numéro de version : 304 sans corps quand rien n'a changé. Deux versions distinctes : celle des
  appareils des participants ne bouge pas quand un autre participant vote (coût du polling). Un signe de vie
  toutes les 60 s par appareil, qui n'avance aucune version.
- Hébergement visé : Alwaysdata (PHP 8, Apache, SSH, pas de MySQL). Déploiement par GitHub Actions sur push
  de main : tests d'abord, puis rsync par SSH (clé, hôte, chemin dans les Secrets/Variables GitHub, actions
  épinglées par SHA, permissions minimales, vérification de l'empreinte du serveur SSH exigée, rsync SANS
  --delete, exclusion de data/, config.php, .git*, tests/, scripts/, *.md). Plan B documenté : zip produit par
  la CI. Ne demande jamais le mot de passe animateur, son hash ni une clé SSH : l'utilisateur crée lui-même
  config.php en SSH avec la commande guidée (voir configurer.php).

Structure attendue (noms libres sauf indication) : index.php, admin.php, screen.php, api.php (point d'entrée
unique de toutes les actions), lib.php (stockage, validation, sécurité, logique), purge.php (ligne de
commande), configurer.php (ligne de commande), config.sample.php, assets/ (style.css, common.js, app.js,
admin.js, screen.js, charts.js, bilan-pptx.js, seances.js, print.js + bibliothèques), .htaccess, .gitignore
(exclut config.php et data/), README.md, CHANTIERS.md, docs/, tests/, scripts/, .github/workflows/.
Racine du dépôt = racine de l'application. Fonctions courtes, pas de duplication.

════════════════════════════════════════
3. CONFIGURATION (config.php, jamais commité)
════════════════════════════════════════
config.sample.php documenté ligne à ligne. Clés : admin_hash (hash du mot de passe), secret (≥ 32 caractères :
sel du hachage des IP, HMAC des jetons), data_dir, base_url (URL publique pour le QR), poll_ms (2000),
max_participants (150 par session), purge_days (30), max_text (80), max_posts (5 par participant et par
question), rate_ip (900 par minute : les wifi d'atelier partagent une IP), rate_token (30), rate_join (60),
responsable, contact, base_legale (mentions de confidentialité affichées aux participants ; génériques si
vides), banned_words (mots refusés dans les réponses libres et le nuage, comparaison sans casse ni accents,
mot entier).
configurer.php (ligne de commande seulement, refusé depuis le web) : pose les questions (mot de passe masqué,
12 caractères au moins, double saisie), crée config.php à partir de config.sample.php en conservant ses
commentaires, génère le secret, crée le dossier de données (droits 0700), vérifie le résultat. Relancé, il
CONSERVE toutes les valeurs déjà personnalisées (purge, quotas, mots interdits, adresse) ; seul ce qui est
redemandé change.

════════════════════════════════════════
4. RÔLES ET ÉCRANS
════════════════════════════════════════
4.1 PARTICIPANT (index.php) — mobile first, aussi ordinateur
- Rejoindre : saisie du code (5 caractères d'un alphabet sans caractères ambigus) ou lien/QR ?s=CODE. Attente
  (« la question va apparaître »). Voit uniquement la question active. Compte à rebours si la question en a un.
- Réponse : voir 5 (toucher ou « Envoyer » selon le type). Confirmation claire ; modifiable tant que le vote est
  ouvert si l'animateur l'autorise. États de chargement, aucune réponse perdue, reconnexion automatique, message
  clair pour code inconnu, vote fermé, session terminée, connexion perdue (réponse en attente d'envoi).
- Résultats : après « Afficher » par l'animateur (quiz : bonne réponse + explication ; jamais l'explication avant).
- Pseudonyme (si l'option de la session est active) et classement des quiz (podium 1-3).
- « Oser demander » : questions anonymes à l'animateur, votes pour les questions des autres.
- Signaux anonymes : « Trop vite », « À réexpliquer », « Besoin d'aide » (voir 6.3).
- Fin de session : seule la conclusion de l'animateur (« À retenir ») ; bouton « Quitter » qui respire
  doucement et qui efface le cookie côté serveur ET le stockage local (si le réseau échoue, ne PAS promettre
  l'effacement : dire que la déconnexion n'est pas confirmée).
- Taille du texte A− / A+ réglable, gardée dans le navigateur seulement.
- Mentions « Confidentialité » (depuis config.php) accessibles depuis la page.
- Lien d'exercice : si la question en porte un, bouton « Ouvrir l'exercice » (nouvel onglet,
  rel="noopener noreferrer") avec le nom du site affiché avant de partir.
- Défi à étapes : voir 5 (type steps).
- Sur écran étroit (390 px) et en 1280x720 : rien ne dépasse horizontalement.

4.2 PROJECTION (screen.php?s=CODE)
- Accueil (écran d'accueil d'abord) : adresse et code en très grand, QR code. Question en cours : intitulé,
  compteur « x / n ont répondu » (n = participants actifs : signe de vie < 3 min ou a répondu), compte à
  rebours, QR code dans un coin (masquable).
- Résultats en direct pour chaque type (barres, anneau Oui/Non et Vrai/Faux, jauge d'échelle, nuage de mots
  qui respire, mur, post-its en colonnes, gommettes), bonne réponse en vert avec coche et mention (jamais la
  couleur seule), explication sous les résultats. Thèmes sombre et clair. Tout tient sans défilement à 1280x720
  (fonction qui ajuste la taille), et rien ne dépasse sur écran étroit.
- Bilan « façon diaporama » (touche B), une question par diapositive, qui ne montre que ce que la projection a
  déjà montré. Fin : « Session terminée » + conclusion qui monte comme un générique ; le détail passe par le bilan.
- Barre de pilotage (visible seulement si le cookie animateur est présent, via me + control avec CSRF) :
  Précédente, bouton central (Ouvrir / Fermer / Afficher / Suivante), Suivante, Bilan ; glisser ← → (≥ 60 px,
  horizontal) pilote aussi ; le bouton central est caché à l'étape « Question suivante » (le glisser fait la même
  chose). Fermer ou afficher un vote sans aucune réponse demande confirmation.
- Les signaux ne s'affichent JAMAIS ici (c'est la vue de la salle). Les contributions écrites des participants
  ne s'affichent qu'après publication par l'animateur.

4.3 ANIMATEUR (admin.php) — mot de passe unique, session PHP
- Connexion : password_verify, régénération de l'ID de session, cookie HttpOnly + SameSite=Strict + Secure si
  HTTPS, blocage par appareil après 5 échecs (fenêtre de 15 min), jeton CSRF. Session : expire après 2 h sans
  écriture, 12 h au plus.
- Accueil en onglets « Sessions » et « Archives » (voir 8). Sessions : créer (titre, code unique généré),
  dupliquer, renommer, supprimer, archiver, démonstration ; carte « Bibliothèque de séances » (voir 7).
- Une session en quatre onglets : Préparer (liste des questions : ajouter, éditer dans une fenêtre, réordonner,
  supprimer, importer des questions collées, défis prêts à l'emploi, clôtures prêtes à l'emploi, conclusion),
  Animer (code, QR, lien d'invitation à copier/partager, pilotage, résultats en direct avec modération, signaux,
  Oser demander, pseudonymes), Bilan (tableau de bord de toutes les questions, texte à copier pour une IA, export
  PowerPoint, synthèse, exports, fiche mémo), Réglages (renommer, terminer, fermer les inscriptions, archiver,
  supprimer, « fonctions en essai »).
- Édition d'une question : tous les champs de la section 5 ; changer le type, les choix, l'échelle ou le budget
  EFFACE les réponses (avec confirmation indiquant le nombre de réponses effacées) ; réordonner des choix sans en
  changer le nombre (mêmes choix, autre ordre) efface aussi les réponses ; reformuler un choix les garde ; les
  colonnes d'un post-it font exception (les notes suivent leur colonne, retrouvée par son nom). Un vote ouvert
  reste ouvert après une modification.

════════════════════════════════════════
5. TYPES DE QUESTIONS (12) ET RÈGLES DE RÉPONSE
════════════════════════════════════════
Champs communs : identifiant, type, intitulé (≤ 200 caractères), choix, durée optionnelle (compte à rebours),
« réponse modifiable », mode de révélation (manuel / instantané / à la fin du temps), explication (≤ 400
caractères, jamais envoyée avant les résultats), lien d'exercice, question « avant » liée (voir 6.4), anonyme
toujours. Identifiants de question : toujours des chaînes (même tout en chiffres), identifiants de post préfixés.
- yesno : deux gros boutons Oui/Non ; truefalse : Vrai/Faux. Toucher = envoi immédiat, modifiable.
- mcq : choix unique ou multiple, avec « bonne(s) réponse(s) » pour un quiz (correction, explication). Choix
  unique corrigé ou réponse figée : sélectionner puis « Envoyer ». Multiple : « Envoyer ».
- poll : sondage à choix unique, barres. Toucher = envoi immédiat, modifiable.
- scale : échelle 1-5 ou 1-10, moyenne et répartition. Toucher = envoi immédiat, modifiable.
- wordcloud : mot libre court (regroupement sans casse ni accents, taille proportionnelle à la fréquence).
- text : réponse libre courte (≤ max_text) ; l'animateur peut masquer une réponse.
- points : répartir un budget de points entre des choix (défaut 10).
- wall : mur d'idées avec « j'aime » (seulement sur contribution publiée ET vote ouvert).
- postit : post-its collectifs en colonnes ; couleur d'un post-it d'après son identifiant, jamais par participant.
- dots : vote par gommettes sur les post-its principaux publiés d'une question « post-it » source, une colonne
  possible ou toutes ; budget de gommettes par participant.
- steps (défi à étapes) : 2 à 10 titres d'étapes communs ; variantes facultatives par appareil (2 à 4, ex.
  Windows, Mac, iPhone, Android), même nombre d'étapes, 160 caractères par étape ; l'appareil choisi par le
  participant reste dans son navigateur, jamais envoyé ; un bouton « Fait » par étape qu'on peut décocher ;
  réponse = liste des indices cochés ; tout décoché = réponse supprimée (plus comptée) ; résultats = nombre par
  étape et nombre de personnes ayant tout terminé. Chaque étape a aussi un bouton « ✋ Bloqué » (voir 6.3).
  Type visible dans l'éditeur seulement si le réglage « fonctions en essai » est coché (réglage côté serveur,
  commun à tous les appareils de l'animateur) ; le serveur accepte le type dans tous les cas.
Règles : un seul vote par question et par participant (modifiable si autorisé) ; la même réponse renvoyée est
une reprise réseau, acceptée sans modification ; types « écrits » (text, wall, postit) jamais révélés
automatiquement et jamais en mode « à la fin du temps » ; en projection, sondage, nuage, échelle, points et défi
s'affichent dès l'ouverture du vote, quiz et textes attendent le clic de l'animateur, et les téléphones voient
les résultats après « Afficher » ; « Suivante » vers une question jamais ouverte ouvre son vote.

════════════════════════════════════════
6. FONCTIONS TRANSVERSES
════════════════════════════════════════
6.1 Identité et anonymat. Un participant = jeton aléatoire généré côté serveur, signé (HMAC), en cookie
HttpOnly et copie en stockage local ; jeton CSRF dérivé ; clé participant dérivée du code de session et du
jeton (différente d'une session à l'autre). Aucune donnée personnelle demandée. IP hachée avec le sel, utilisée
seulement pour les limites de débit, traces conservées 2 h au plus. Auteur d'une contribution jamais servi.
6.2 Pseudonymes : option par session ; noms tirés au hasard (jamais de vrais noms) ; effacés quand on désactive
l'option ; podium des rangs 1-3 au classement des quiz.
6.3 Signaux et aide. Signaux anonymes « Trop vite », « À réexpliquer », « Besoin d'aide » : un seul à la fois par
participant, le même appui le retire, ils s'effacent seuls après 2 minutes ; seul l'animateur voit les compteurs.
« Besoin d'aide » peut viser une étape d'un défi (question + indice, validés côté serveur : seul « Besoin d'aide »,
question de type steps, indice dans les bornes) ; l'animateur voit « n personnes bloquées à l'étape k : titre »,
jamais qui. Un signal général après un changement de question ne ramène pas l'ancienne question à l'écran.
6.4 Avant / après. Une question quiz ou échelle posée une seconde fois peut désigner la question « avant »
(même type, mêmes choix ou même échelle, « avant » placée avant). Résultat : agrégats seulement. Calcul sur les
personnes qui ont répondu aux DEUX questions si elles sont au moins 3, sinon sur tous les répondants de chaque
passage ; le texte le dit (« mêmes N personnes » / « personnes différentes : x puis y réponses »). Jamais une
réponse isolée. Affiché dans les résultats, le bilan, le PowerPoint et le CSV.
6.5 Lien d'exercice. Champ facultatif sur toute question : https uniquement, nom de domaine avec une extension
alphabétique (refuser toute adresse IP, y compris abrégées comme 127.1 ou 10.1, localhost, identifiants dans
l'adresse, espaces, plus de 300 caractères). Un lien venu d'un texte collé est signalé « à vérifier ». Projection :
QR code dessiné dans le navigateur (adresse normalisée avant l'encodage, y compris pour les caractères non ASCII)
avec le nom du site.
6.6 Oser demander. Questions anonymes des participants, publiées par l'animateur après relecture, votes des
autres, marquage « répondu ». Ouvrable/fermable. Un nom peut s'y glisser : visible des autres seulement après
publication.
6.7 Session de démonstration : session remplie de 12 participants fictifs (10 restent « actifs »), une question de
chaque type avec résultats plausibles, Oser demander, pseudonymes, signaux ; les participants fictifs répondent
aussi aux questions ajoutées ensuite (sauf mur et post-it) ; « Supprimer les démos » ; une démo n'est jamais
archivée. Avec « fonctions en essai », elle se termine par un défi à étapes.
6.8 Import de questions : texte collé (liste JSON du « [ » au « ] », éventuellement entourée de texte, y compris
une copie depuis l'application mobile d'une IA qui échappe les crochets : \[ \]) validé question par question
côté serveur (types, tailles, références croisées « source » et « avant » par numéro, aperçu avec erreurs et
avertissements, case à cocher par question). Un élément {"type":"conclusion","text":"…"} (600 caractères au plus)
fixe la conclusion. Export des questions en JSON, sans aucune réponse, réimportable à l'identique. L'application
n'appelle AUCUNE IA : l'animateur copie-colle une « consigne de génération » et une « consigne de relecture »
(méthode : public, fond, sources officielles sans rien inventer, forme ; jamais de question d'âge légal ou de
loi sans source officielle) vers l'outil de son choix.
6.9 Bilan et exports. Bilan : tableau de bord de toutes les questions + texte à copier pour une IA (résultats
regroupés ; textes de participants, nuage de mots et idées des gommettes compris, UNIQUEMENT si une case,
décochée par défaut, est cochée ; réponses masquées jamais). PowerPoint généré dans le navigateur (une
diapositive par question, graphiques natifs pour l'anneau et la jauge, barres dessinées ; pourcentages calculés
sur le nombre de répondants pour les choix multiples et les étapes ; au-delà de 8 idées ou 30 réponses, une
ligne « … et N autres … » ; réponses masquées exclues). CSV (UTF-8 avec BOM, séparateur point-virgule, protégé
contre l'injection de formules) en deux variantes (tout / sans réponses masquées), version imprimable.
6.10 Fiche mémo à emporter (animateur seul, aucune page publique) : page imprimable ou à enregistrer en PDF avec
la conclusion (« À retenir »), les explications et bonnes réponses des quiz, les exercices à refaire (lien,
étapes, variantes). Jamais une réponse ni un chiffre de participant.

════════════════════════════════════════
7. BIBLIOTHÈQUE DE SÉANCES
════════════════════════════════════════
- Séances livrées dans assets/seances.js (format d'import, conclusion en dernier élément, métadonnées : titre,
  public, durée, prérequis, objectif), créées d'un clic (session + import validé côté serveur). Ce sont des
  BROUILLONS À RELIRE, annoncés comme tels dans l'interface. Aucune adresse de site inscrite, aucun menu précis
  d'un appareil, aucune affirmation de droit sans source officielle. Livre au moins : (1) repérer une arnaque par
  message ; (2) démarches en ligne, initiation ; (3) démarches en ligne, niveau intermédiaire (justificatifs,
  preuves, vérifications, double authentification, ne jamais donner ses codes) ; (4) pièces jointes ; (5)
  réglages du téléphone. Chaque séance : échelle de confiance avant/après liée, quiz avec explications, un défi à
  étapes, une conclusion de 600 caractères au plus.
- Thèmes ajoutés par l'animateur : fichier seances.json dans le dossier de données (30 au plus, écrit sous verrou,
  validé par l'import à l'enregistrement, jamais purgé, contenu pédagogique seulement). Alimenté par « Enregistrer
  comme thème » depuis une session (questions sans réponses) ou par un texte collé (par exemple une version relue
  par une autre IA). Section « Mes thèmes » dans la liste, avec suppression.
- « Copier la consigne de relecture » : copie vers le presse-papiers une consigne et la séance pour une AUTRE IA,
  qui renvoie remarques puis version corrigée complète en dernier ; l'animateur la colle dans « Ajouter un thème ».

════════════════════════════════════════
8. ARCHIVES, PURGE, RGPD
════════════════════════════════════════
- Archive anonyme à la place de la suppression : résultats regroupés, récap, conclusion et synthèse de
  l'animateur ; JAMAIS jeton, réponse une à une, texte de participant, pseudonyme ni IP. Rappel affiché à
  l'archivage : la conclusion et la synthèse sont gardées sans limite, aucun nom ne doit y figurer. L'archive peut
  être réutilisée (ses questions) ; une démo n'est jamais archivée.
- Archivage (manuel ou par la purge) : relire la session SOUS le verrou, écrire l'archive en vérifiant la
  sérialisation, le nombre d'octets écrits et le rename, puis seulement supprimer ; si l'archive échoue, la
  session est conservée (la purge réessaiera). Jamais d'archive vide ou tronquée suivie d'une suppression.
- Purge par tâche planifiée horaire (purge.php, ligne de commande, jamais depuis le web) : supprime les sessions
  sans action de l'animateur depuis purge_days jours (seule l'activité de l'animateur repousse la purge), les
  verrous orphelins de plus d'une heure, les échecs de connexion de plus de 15 min, les compteurs de débit de plus
  d'une heure. Note l'heure du dernier passage, affichée dans Réglages avec une alerte si elle est trop ancienne.
- Données personnelles possibles uniquement dans les textes libres : modération, contributions visibles des
  autres seulement après publication, purge. docs/registre-traitement.md : fiche de traitement à relire par
  l'animateur (finalité, données, base légale intérêt légitime, durée, hébergeur, sous-traitants, droits,
  sécurité) ; à tenir à jour à chaque nouvelle donnée.

════════════════════════════════════════
9. API (api.php?action=…)
════════════════════════════════════════
GET = lecture, POST = écriture (corps JSON de 64 Ko au plus, en-tête X-WL: 1 et X-CSRF-Token). Aucune action
hors de ces listes ; méthode ou rôle inattendu = refus.
- GET public : state, screen. GET animateur : me, sessions, admin_state, export (formats : csv, print, memo,
  questions), archives, archive, seances.
- POST public (jeton participant + CSRF dérivé + quotas) : join, leave, vote, post, post_delete (propriétaire
  seulement), like, signal, ask, ask_vote, ping.
- POST animateur (session + CSRF) : login, logout, session_create, session_duplicate, session_delete,
  session_rename, session_demo, demo_delete, session_conclusion, session_synthesis, session_archive,
  archive_delete, archive_reuse, question_save, questions_import, questions_duration, question_delete,
  question_move, control, answer_hide, post_admin, ask_admin, prefs_save, seance_save, seance_delete.
- Une action qui lit une session absente refuse AVANT d'ouvrir le moindre fichier de verrou (un code inventé ne
  doit laisser aucun fichier). Erreurs inattendues : message public générique, détail dans le journal du serveur.

════════════════════════════════════════
10. DESIGN : « PAPIER & TERRE »
════════════════════════════════════════
Variables CSS --wl-* en tête de la feuille de style. Palette claire : fond #FBF4E8, carte #FFFDF8, texte #2E2118,
texte doux #6B5442, primaire #A83A1A (survol #8C2F14), accent #1F6F6B, ok #2F6B1F, ko #A8231C, bord #E4D3BA,
bord de champ #8A6A4A, piste #EADBC2, pastille #E0A22B, séries --wl-b1..b7 (#A83A1A #1F6F6B #B07A00 #7A2E5E
#55702A #2F5E9E #8A6A4A). Thème sombre assorti (carte #3A271D), contrastes mesurés. Georgia pour les titres,
Verdana (système) pour le reste, rayon 14 px, ombre douce, cible tactile 3 rem. Texte de base 18 px.
- Accessibilité : contraste AA (4,5:1) pour tout texte, 3:1 pour les éléments graphiques, focus visible, parcours
  clavier, ARIA (aria-live pour les confirmations, aria-pressed pour les boutons à bascule), information jamais
  portée par la couleur seule.
- Animations : douces, courtes, jamais plus de 3 éclats par seconde, toutes coupées avec prefers-reduced-motion,
  jouées seulement au changement réel d'une donnée (pas à chaque rafraîchissement) ; barres mises à jour sur
  place ; glissement de lignes seulement pour le mur et les gommettes ; nuage qui flotte verticalement ; bouton
  « Quitter » qui respire.
- Rendu mesuré à 390 px (largeur d'un téléphone) et à 1280x720 (projection) : aucun débordement horizontal.

════════════════════════════════════════
11. TESTS ET CI
════════════════════════════════════════
- tests/run.sh : php -l sur tous les PHP, node --check sur tous les JS, puis les suites ci-dessous, avec un
  serveur php -S multi-processus et un config.php de test dans un dossier temporaire.
- e2e PHP (curl) : 1 animateur + plusieurs participants ; chaque type de question (création, vote, double vote
  refusé, vote fermé refusé, résultats, export), CSRF manquant refusé, rôles refusés, data/ inaccessible, import
  (erreurs, références, texte copié depuis une application mobile d'IA), avant/après (seuil de 3, mêmes personnes),
  aide par étape, liens (refus de http, javascript:, identifiants, adresses IP abrégées…), fiche mémo (aucun
  chiffre ni réponse), thèmes (limite de 30, refus d'un thème invalide), archivage, purge, effacement des
  réponses lors d'un réordonnancement. Tests de durée et de limite de débit tolérants au passage d'une seconde
  ou d'une minute.
- Test de coût : 30 polls sans changement = 30 réponses 304 sans corps ; nombre de requêtes d'un participant
  pendant une question compté.
- Charge : 150 participants simulés arrivent et votent en même temps → aucun vote perdu, aucun JSON corrompu.
- Archivage (CLI) : si l'archive échoue, la session reste ; archive lisible et complète si tout va bien.
- Configuration guidée (CLI) : mot de passe en deux saisies, secret, dossier, relance qui conserve les réglages.
- Données hors de la racine web : data/ fermé quand DATA_DIR est vide.
- Navigateur (Playwright, Chromium) : aucune erreur JS ni blocage CSP ; parcours animateur et participant ;
  défi à étapes à 390 px sans débordement ; chaque séance livrée s'importe sans erreur ; bibliothèque (relecture,
  ajout et suppression d'un thème) ; fiche mémo.
- CI GitHub Actions : tests à chaque push ; le déploiement n'a lieu que si tout passe.
- Une contrainte formulable en test devient un test. Pas de capture ni de test pour un pur changement de rendu :
  dis à l'utilisateur quoi regarder.

════════════════════════════════════════
12. JALONS (dans cet ordre, commit + tests à chacun)
════════════════════════════════════════
J1 Socle : structure, config.sample.php, configurer.php, .htaccess, en-têtes et CSP, stockage JSON sous verrou,
   tests/run.sh minimal, CI. Critère : tests verts, data/ inaccessible, config guidée testée.
J2 Sessions et animateur : connexion (CSRF, blocage), créer/dupliquer/renommer/supprimer, questions (oui/non,
   vrai/faux, qcm, sondage), pilotage (ouvrir/fermer/afficher/suivant), QR, projection de base, page
   participant (rejoindre, voter, confirmation, reconnexion). Critère : e2e animateur + 3 participants.
J3 Types restants : échelle, points, nuage, texte, mur, post-it, gommettes ; masquage ; durée et compte à
   rebours ; réponses modifiables ; réordonnancement et effacement ; filtre de mots interdits. Critère : e2e par type.
J4 Polling économe, signes de vie, actifs, limites de débit, charge à 150 participants, test de coût.
J5 Projection complète (tous les résultats, bilan, pilotage, thèmes sombre/clair, tout tient à 1280x720) et
   design « Papier & Terre ».
J6 Pseudonymes et podium, Oser demander, signaux, démonstration.
J7 Import/export JSON, consignes de génération et de relecture, clôtures et défis prêts à l'emploi, défi à étapes
   avec variantes et aide « Bloqué », avant/après, lien d'exercice et QR.
J8 Bilan, PowerPoint, CSV, version imprimable, fiche mémo.
J9 Archives, purge, rappel d'archivage, réglages (fonctions en essai), registre de traitement.
J10 Bibliothèque : séances livrées, thèmes ajoutés, relecture par une autre IA, test d'import de chaque séance.
J11 Déploiement : workflow GitHub Actions (rsync sans --delete, secrets, empreinte SSH exigée), README complet
   (installation Alwaysdata pas à pas, Secrets à créer, plan B, déroulé d'un atelier de 20 personnes, dépannage),
   CHANTIERS.md à jour. Critère : suite complète verte.

════════════════════════════════════════
13. EXIGENCES DE ROBUSTESSE À TENIR DÈS LE DÉPART
════════════════════════════════════════
- Aucune écriture « sans contrôle » : un fichier écrit est vérifié (octets, rename) ; échec = erreur explicite.
- Toute lecture d'une ressource absente refuse avant de créer un fichier (verrou, temporaire).
- Un archivage suivi d'une suppression se fait sous le même verrou, après relecture.
- Les nombres de participants, de contributions, de questions (50 par session), de thèmes (30) et la taille des
  corps de requête sont bornés ; une requête invalide ne laisse aucun fichier derrière elle.
- Les textes reçus (titres, choix, réponses, liens, thèmes importés) sont nettoyés et bornés côté serveur ; le
  client ne leur fait jamais confiance.
- Les calculs d'affichage (pourcentages, avant/après, classements) sont les mêmes dans l'application, le CSV, la
  version imprimable, le bilan et le PowerPoint.
- Toute promesse faite à l'utilisateur dans l'interface (anonymat, effacement, « rien n'est gardé ») doit être
  exactement vraie dans le code.

════════════════════════════════════════
14. LIVRABLES ET FIN
════════════════════════════════════════
Le dépôt complet sur la branche principale avec la CI verte ; README.md ; CHANTIERS.md (limites connues,
décisions à trancher, points à ne pas défaire avec leur pourquoi) ; docs/registre-traitement.md. En fin de
livraison : dis-moi (1) où cliquer pour voir chaque fonction (démo comprise), (2) ce que tu n'as pas pu vérifier
(configuration réelle, hébergement, HTTPS, secrets), (3) au plus trois pistes d'amélioration, consignées dans
CHANTIERS.md. Termine par la liste des Secrets/Variables GitHub à créer et des commandes SSH à lancer.
```
