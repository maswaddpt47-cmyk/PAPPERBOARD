# Consigne d'audit Codex — WoocLight (dépôt PAPPERBOARD)

Rédigée le 10/10/2026 à partir de MD-LIB `consigne-audit-externe.md`, mise à
jour le même jour après les corrections du premier audit (contexte seulement,
sans dire ce qui a été corrigé), pour l'audit ponctuel avant mise en production (`agora.md` §12, règle 4 : nouvelle
page publique et mot de passe). Le contexte ne contient que des faits, aucune
conclusion. À coller telle quelle dans Codex.

**Avant** : accès en lecture seule au seul dépôt `maswaddpt47-cmyk/PAPPERBOARD` ;
autorisations « Lecture seule » ; réflexion au plus haut niveau ; aucune donnée
réelle, capture ni identifiant.
**Après** : vérifier chaque point dans le code avant de le croire ; ranger le
rapport vérifié hors de tout dépôt public ; reporter les corrections dans
`CHANTIERS.md`.

```text
Tu es auditeur de sécurité et de conformité RGPD. Audit en LECTURE SEULE :
ne modifie aucun fichier, ne crée ni branche ni pull request, n'appelle aucune
URL de production.

CONTEXTE (faits, pas conclusions)
WoocLight : application web de participation en direct (type Wooclap) pour
des ateliers de médiation numérique d'un Conseil départemental. Participants :
seniors, collégiens (mineurs), travailleurs sociaux, agents. Ils rejoignent
depuis leur téléphone, sans compte, avec un code de 5 caractères ou un QR code.
Architecture : PHP 8 sans framework ni Composer ; un seul point d'entrée pour
les actions (api.php), bibliothèque commune (lib.php), pages index.php
(participant), admin.php (animateur), screen.php (projection publique,
screen.php?s=CODE) ; JavaScript sans build dans assets/ (qrcode.js est une
bibliothèque tierce embarquée). Stockage : fichiers JSON (un par session)
dans un dossier défini par config.php, verrou flock et écriture par fichier
temporaire + rename. Pas de base de données.
Types de questions : oui/non, vrai/faux, QCM, sondage, nuage de mots, réponse
libre, échelle, points, mur collaboratif (messages + « j'aime »), post-it
collectif (colonnes, déplacement et regroupement par l'animateur), vote par
gommettes (sur les post-its d'une autre question). L'animateur peut fermer
les inscriptions et terminer une session.
Authentification : un seul rôle connecté, l'animateur, par mot de passe
(hash dans config.php, password_verify, session PHP, cookie d'appareil
signé pour le blocage après échecs). Les participants reçoivent un jeton
aléatoire (cookie + localStorage) sans identité.
config.php (hash, secret servant de sel) n'est pas dans le dépôt :
config.sample.php en donne le modèle.
Hébergement prévu : Alwaysdata (mutualisé, Apache, .htaccess), compte dédié.
Déploiement : .github/workflows/ci-deploy.yml, tests puis rsync par SSH
(clé et empreinte du serveur dans les Secrets GitHub) sur push de main,
via un environnement GitHub « production ». Pas encore en ligne.
Données personnelles : aucune demandée ; IP hachée pour les limites de taux ;
les réponses libres, messages et post-its peuvent contenir un nom tapé par un
participant. Purge automatique des sessions après N jours (config.php), au
fil des requêtes et par purge.php lancé en tâche planifiée.

RÈGLE DE MÉTHODE
Ne lis PAS les fichiers .md du dépôt (CLAUDE.md, CHANTIERS.md, README.md,
docs/…) avant d'avoir terminé ton propre relevé : ils contiennent les
conclusions d'une autre IA, et on veut ton regard indépendant. Tu peux les
lire à la fin, uniquement pour signaler un désaccord avec eux.

À EXAMINER
1. Contrôle d'accès : pour CHAQUE action d'api.php, quel rôle peut l'appeler,
   et peut-on contourner (jeton d'un autre participant, paramètre forcé,
   contribution d'un autre participant, question d'une autre session) ?
2. Sessions et mot de passe animateur : création, durée, déconnexion,
   blocage après échecs, cookies.
3. Injections : XSS (HTML construit côté PHP, DOM construit côté JS), CSRF,
   formules dans l'export CSV, chemins de fichiers dérivés d'une saisie.
4. Pages publiques (index.php, screen.php, actions participant) : abus
   possibles, données exposées (réponses masquées par l'animateur, bonne
   réponse d'un quiz avant affichage, contributions non publiées, jetons).
5. Secrets et configuration : secret en clair, fichiers internes servis par
   Apache (.htaccess, purge.php), erreurs trop bavardes, en-têtes de sécurité.
6. Workflow de déploiement et réglages du dépôt GitHub : injections,
   permissions, secrets, protection de main, approbation de l'environnement.
7. Bibliothèque embarquée assets/qrcode.js : version et failles connues.
8. RGPD : minimisation, purge réellement appliquée, données personnelles
   dans les journaux, le stockage (serveur et navigateur) et les exports ;
   information affichée aux participants ; cas des mineurs.
9. Concurrence : écritures, suppressions et purge simultanées sur les
   fichiers JSON.

FORMAT DE RÉPONSE (en français)
Un tableau, un problème par ligne, du plus grave au moins grave :
| N° | Gravité (critique / haute / moyenne / basse) | fichier:ligne |
| Problème | Scénario d'attaque concret (qui, comment, résultat) |
| Correction proposée | Confiance (certain / probable / à vérifier) |

Règles :
- Pas de problème sans fichier:ligne et sans scénario concret. Un risque
  théorique sans chemin d'exploitation va dans une liste à part
  « Remarques ».
- Chaque ligne doit avoir été vérifiée en lisant le code appelant.
- Termine par « Ce que je n'ai pas pu vérifier ».
- Si tu ne trouves rien de grave dans une catégorie, dis-le en une ligne.
```
