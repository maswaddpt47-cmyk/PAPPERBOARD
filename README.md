# WoocLight

Participation en direct pour des ateliers de médiation numérique (projet
personnel) :
l'animateur projette une question, les participants répondent depuis leur
téléphone, sans compte, avec un QR code ou un code de 5 caractères.

- **Animateur** : `admin.php` (mot de passe) — sessions, questions, pilotage, export.
- **Participant** : `index.php` (ou le QR code) — une question à la fois : on choisit, puis on appuie sur **Envoyer**.
- **Projection** : `screen.php?s=CODE` — plein écran, résultats en direct, QR code permanent.

Types de questions : Oui/Non, Vrai/Faux (quiz avec correction), QCM (avec
bonne réponse), sondage, nuage de mots, réponse libre, échelle 1-5 ou 1-10,
classement par points, et trois modules d'atelier :

- **Mur collaboratif** : chacun publie jusqu'à 5 messages, puis « aime » ceux
  des autres ; les plus aimés passent en tête.
- **Post-it collectif** : notes de couleur dans des colonnes choisies par
  l'animateur (ex. Points forts / Difficultés / Envies) ; l'animateur déplace
  et regroupe les post-its depuis son écran.
- **Vote par gommettes** : chacun colle ses gommettes (3 par défaut) sur les
  idées d'un post-it collectif ou d'un mur précédent ; le classement s'affiche.

**Générer ou importer (JSON)** (espace animateur) : WoocLight prépare un texte
à coller dans l'IA de votre choix (Claude, ChatGPT, Le Chat…), vous recollez sa
réponse — ou importez un fichier `.json` au même format —, cochez les questions
à garder et les ajoutez à la session. WoocLight
n'appelle aucune IA lui-même : rien ne part sans vous. Le bouton **Questions
(.json)** de chaque session enregistre ses questions (sans les réponses) dans ce
même format, pour les réutiliser dans une autre session. Vérifiez les bonnes
réponses des quiz avant l'atelier. Pour un nouveau thème, **Copier la consigne
de relecture** prépare un texte pour faire relire les questions par une *autre*
IA, sources exigées : ouvrez chaque lien avant de vous y fier.

Mur et post-it : les participants ne voient que leurs propres contributions
tant que l'animateur n'a pas cliqué **Publier** (le temps de relire et de
masquer un nom ou une donnée personnelle).

PHP 8 sans base de données ni bibliothèque à installer : les données sont des
fichiers JSON dans un dossier hors du site.

---

## 1. Installation chez Alwaysdata

À faire une fois. Remplacer `COMPTE` par le nom du compte Alwaysdata.
Les libellés de l'interface Alwaysdata peuvent changer : se fier à l'interface
en cas d'écart. L'application est servie à la racine du site,
`https://COMPTE.alwaysdata.net/` (installation du 14/10/2026 : compte
`wooclight`).

### Étape 1 — Vérifier PHP

Interface Alwaysdata > **Environnement** > **PHP** : version 8.1 ou plus.
Le site par défaut sert le dossier `~/www/` : rien à créer, l'application y
sera copiée (variable `WOOCLIGHT_CHEMIN`, étape 3).

### Étape 2 — Clé SSH de déploiement

Sur votre ordinateur (PowerShell ou Terminal) :

```bash
ssh-keygen -t ed25519 -f wooclight-deploy -N "" -C "deploiement-wooclight"
```

Deux fichiers sont créés : `wooclight-deploy` (privée) et `wooclight-deploy.pub` (publique).

1. Interface Alwaysdata > **Accès distant** > **SSH** : vérifier que l'utilisateur
   SSH `COMPTE` est actif.
2. Se connecter en SSH (`ssh COMPTE@ssh-COMPTE.alwaysdata.net`) et ajouter la
   clé **publique** :
   ```bash
   mkdir -p ~/.ssh && chmod 700 ~/.ssh
   nano ~/.ssh/authorized_keys      # coller le contenu de wooclight-deploy.pub
   chmod 600 ~/.ssh/authorized_keys
   ```

### Étape 3 — Secrets GitHub

Dépôt GitHub > **Settings** > **Secrets and variables** > **Actions** >
**New repository secret** :

| Nom | Valeur |
|---|---|
| `ALWAYSDATA_COMPTE` | le nom du compte (ex. `wooclight`) |
| `ALWAYSDATA_SSH_KEY` | tout le contenu du fichier **privé** `wooclight-deploy` |

Une fois le secret enregistré, **supprimer les deux fichiers de clé** là où
ils ont été créés (`rm wooclight-deploy wooclight-deploy.pub`) et toute copie
dans un Bloc-notes : la clé privée vit dans le secret GitHub, la publique dans
`authorized_keys`. Rien à conserver ; en cas de souci, refaire les étapes 2 et 3
avec une nouvelle clé.

Onglet **Variables** : `WOOCLIGHT_CHEMIN` = `www/` (sans elle, l'appli part
dans `www/wooclight/`). Facultatif : `WOOCLIGHT_URL` (adresse publique, défaut
`https://COMPTE.alwaysdata.net/wooclight`, à mettre à
`https://COMPTE.alwaysdata.net` avec l'installation à la racine).

Ensuite, chaque push sur `main` lance les tests, puis copie l'application si
tout passe. Le premier déploiement signale « config.php absent » : normal,
c'est l'étape suivante.

### Étape 4 — `config.php` (une commande)

Après le premier déploiement, en SSH (ou terminal web d'Alwaysdata) :

```bash
php ~/www/configurer.php
```

La commande demande le mot de passe animateur (deux fois, masqué, 12
caractères au moins), l'adresse publique (Entrée pour accepter celle proposée),
le responsable et l'adresse de contact affichés aux participants. Elle crée
`config.php` (droits 600), le secret et le dossier des données hors du site,
puis affiche **CONFIG OK**. Relançable à tout moment pour changer le mot de
passe ou les mentions : le secret et les sessions sont conservés.

Le mot de passe ne doit jamais être envoyé à une IA ni écrit dans le dépôt.

### Étape 5 — Sécuriser (avant la première séance)

1. **Empreinte du serveur SSH** (évite qu'un imposteur reçoive le déploiement) :
   en SSH sur le serveur, `ssh-keyscan ssh-COMPTE.alwaysdata.net 2>/dev/null`.
   Copier les lignes obtenues dans un secret GitHub `ALWAYSDATA_KNOWN_HOSTS`.
2. **Approbation du déploiement** : GitHub > Settings > Environments >
   `production` (créé au premier déploiement) > **Required reviewers** : soi-même.
   Chaque mise en ligne attend alors un clic « Approve » dans l'onglet Actions.
   Facultatif : sans cette case, la mise en ligne est automatique (choix retenu
   le 14/10/2026).
3. **Protéger `main`** : Settings > Rules > Rulesets > New branch ruleset, cible
   `main` : cocher « Restrict deletions », « Block force pushes » et « Require
   status checks to pass » (contrôle `tests`). Seul sur le dépôt, une revue
   indépendante est impossible : c'est l'approbation de l'étape 2 qui en tient lieu.
4. **HTTPS obligatoire** : interface Alwaysdata > Sites > le site > activer la
   redirection HTTP → HTTPS. Le déploiement signale en jaune si ce n'est pas fait.
5. **Purge planifiée** : Alwaysdata > Tâches planifiées > ajouter la commande
   `php ~/www/purge.php` **toutes les heures**. Elle supprime les sessions expirées et les traces
   d'IP de plus d'une heure : c'est elle qui garantit les « 2 heures au plus »
   annoncées aux participants.
6. **Faire reconnaître ses appareils** : se connecter une fois à `admin.php`
   depuis chaque ordinateur ou téléphone d'animation, **avant** l'atelier. Un
   appareil reconnu ne peut pas être bloqué par les erreurs de mot de passe
   d'un participant sur le même wifi.

### Étape 6 — Vérifier

- `https://COMPTE.alwaysdata.net/admin.php` : la page de connexion s'affiche.
- Le déploiement suivant vérifie tout seul que `lib.php`, `config.php`, `data/`
  ne sont pas lisibles depuis internet (preuve que `.htaccess` est actif). En cas
  d'échec, l'onglet **Actions** de GitHub l'indique en rouge.

## 2. Plan B : envoi par FTP

Si le déploiement automatique est impossible :

1. GitHub > **Actions** > dernier « Tests et déploiement » réussi sur `main` >
   **Artifacts** > télécharger `wooclight` (zip, gardé 30 jours).
2. Décompresser, puis envoyer le contenu dans `www/` avec FileZilla
   (hôte `ftp-COMPTE.alwaysdata.net`, identifiants FTP du compte).
3. Ne jamais écraser `config.php` sur le serveur (le zip n'en contient pas).
4. Étape 4 ci-dessus si c'est la première installation.

## 3. Test rapide (5 minutes)

1. `admin.php` > se connecter > créer une session « Test ».
2. Ajouter une question Oui/Non, cocher « Oui » comme bonne réponse.
3. **Ouvrir la projection** dans un autre onglet, puis **Ouvrir le vote**.
4. Avec un téléphone, scanner le QR code > appuyer sur « Oui » > « Réponse enregistrée ».
5. **Afficher les résultats** : la barre apparaît sur la projection et
   « Bonne réponse ! » sur le téléphone.
6. **Exporter en CSV** : le fichier s'ouvre dans Excel avec les accents.

## 4. Dépannage

| Symptôme | Cause probable | Que faire |
|---|---|---|
| « WoocLight n'est pas encore configuré » | `config.php` absent ou incomplet | Étape 4 |
| « Mot de passe incorrect » alors qu'il est juste | faute de frappe à la configuration | Relancer `php ~/www/configurer.php` et ressaisir le mot de passe |
| « Trop de tentatives » | 5 erreurs en 15 minutes depuis cet appareil (ou cette IP pour un appareil jamais connecté) | Attendre 15 minutes, ou en SSH : `rm ~/wooclight-data/login.json` |
| Reconnexion demandée en pleine séance | 2 h sans action, ou 12 h depuis la connexion | Se reconnecter (sécurité d'un poste partagé) |
| « Les inscriptions sont fermées » | bouton **Fermer les inscriptions** activé | Le rouvrir dans l'espace animateur |
| Le QR code mène à une mauvaise adresse | `base_url` vide ou faux | Renseigner `base_url` dans `config.php` |
| « Connexion perdue » sur les téléphones | wifi de la salle saturé ou coupé | Les téléphones se reconnectent seuls ; les réponses en attente partent au retour du réseau |
| « Trop de requêtes » | plus de 30 envois par minute pour un téléphone | Attendre quelques secondes |
| « La session est complète » | 150 participants (réglable : `max_participants`) | Augmenter la valeur dans `config.php` |
| Déploiement rouge « accessible depuis internet » | `.htaccess` ignoré par le serveur | Ne pas utiliser l'application ; vérifier la configuration Apache du site Alwaysdata |
| Déploiement jaune « Secrets absents » | étape 3 non faite | Créer les deux secrets |

Journal des erreurs PHP : interface Alwaysdata > **Logs**, ou `~/admin/logs/` en SSH.

## 5. Déroulé d'un atelier de 20 personnes

**Avant (la veille, 15 min)**
- Créer la session, saisir 5 à 8 questions, varier les types (un nuage de mots
  pour démarrer, un quiz Vrai/Faux, une échelle pour finir).
- Faire le test rapide avec son propre téléphone, puis **Réinitialiser** les questions.

**Accueil (5 min)**
- Projection en plein écran : la page d'accueil affiche l'adresse et le code en grand.
- Aider ceux qui n'ont jamais scanné de QR code : appareil photo du téléphone,
  pointer l'écran, toucher le lien. Sinon, taper l'adresse et le code, ou
  recevoir le lien par SMS ou mail (**Copier l'adresse** dans l'espace animateur).
- Le compteur « 20 participants » en haut de la projection confirme que tout le monde est là.

**Pendant (questions)**
- **Ouvrir le vote** → « Votez sur votre téléphone ! » et le nombre de réponses s'affichent.
- Sondage, nuage de mots, échelle et points : les réponses s'affichent **en
  direct** sur la projection dès l'ouverture du vote (case « Afficher les
  réponses en direct », cochée par défaut).
- Quiz, réponse libre, mur et post-it : rien n'est projeté avant le clic. Quand
  le compteur approche 20 : **Fermer le vote**, puis **Afficher les résultats**
  (ou **Publier** pour le mur et le post-it).
- Réponses libres : relire avant d'afficher, **Masquer** toute réponse contenant
  un nom ou une donnée personnelle.
- **Suivante →** pour enchaîner.
- Une fois tout le monde connecté : **Fermer les inscriptions** (évite qu'une
  personne extérieure ou un faux participant rejoigne avec le code).

**Variante bilan (15 min)** : Post-it collectif « Points forts / Difficultés /
Envies » → regrouper les doublons depuis l'écran animateur → **Publier** →
Vote par gommettes sur ce post-it pour choisir le thème de la séance suivante.

**Après**
- **Exporter en CSV (tout)** pour le bilan interne, ou **CSV à diffuser** (sans
  les réponses masquées) pour un partage. Les exports ne sont pas effacés par la
  purge : les supprimer une fois le bilan fait.
- **Terminer la session** : les téléphones affichent « Session terminée ».
- Les données sont effacées automatiquement après 30 jours sans activité, ou
  tout de suite avec **Supprimer** dans « Mes sessions ».

## 6. Développement

- Lancer les tests : `bash tests/run.sh` (PHP 8 et l'extension curl de PHP,
  Node pour la vérification de syntaxe ; le parcours navigateur ne tourne que
  si Playwright est installé).
- Essai local : créer un `config.php` (voir étape 4, `data_dir` vide accepté),
  puis `php -S localhost:8000`.
- Règles de travail : `CLAUDE.md` ; état et décisions : `CHANTIERS.md` ;
  fiche RGPD : `docs/registre-traitement.md`.
- `assets/qrcode.js` : qrcode-generator 1.4.4 de Kazuhiko Arase, licence MIT
  (`assets/LICENSE-qrcode.txt`).
