# WoocLight

Participation en direct pour les ateliers de médiation numérique du CD47 :
l'animateur projette une question, les participants répondent depuis leur
téléphone, sans compte, avec un QR code ou un code de 5 caractères.

- **Animateur** : `admin.php` (mot de passe) — sessions, questions, pilotage, export.
- **Participant** : `index.php` (ou le QR code) — une question à la fois, réponse en un geste.
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

Mur et post-it : les participants ne voient que leurs propres contributions
tant que l'animateur n'a pas cliqué **Publier** (le temps de relire et de
masquer un nom ou une donnée personnelle).

PHP 8 sans base de données ni bibliothèque à installer : les données sont des
fichiers JSON dans un dossier hors du site.

---

## 1. Installation chez Alwaysdata

À faire une fois. Remplacer `COMPTE` par le nom du compte Alwaysdata.
Les libellés de l'interface Alwaysdata et les noms d'hôtes (`ssh-COMPTE`,
`ftp-COMPTE`) sont repris de l'API des Ateliers ou cités de mémoire
(09/10/2026, hypothèse non vérifiée sur ce compte) : se fier à l'interface en
cas d'écart.
L'application sera servie à l'adresse `https://COMPTE.alwaysdata.net/wooclight/`.

### Étape 1 — Vérifier PHP

Interface Alwaysdata > **Environnement** > **PHP** : version 8.1 ou plus.
Le site par défaut sert le dossier `~/www/` : rien à créer, l'application ira
dans `~/www/wooclight/`.

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

Si le compte est celui de l'API des Ateliers, la clé de déploiement existante
peut servir : il suffit de la recopier dans les secrets de ce dépôt (étape 3).

### Étape 3 — Secrets GitHub

Dépôt GitHub > **Settings** > **Secrets and variables** > **Actions** >
**New repository secret** :

| Nom | Valeur |
|---|---|
| `ALWAYSDATA_COMPTE` | le nom du compte (ex. `ateliers-numeriques`) |
| `ALWAYSDATA_SSH_KEY` | tout le contenu du fichier **privé** `wooclight-deploy` |

Facultatif, onglet **Variables** : `WOOCLIGHT_CHEMIN` (dossier cible, défaut
`www/wooclight/`) et `WOOCLIGHT_URL` (adresse publique, défaut
`https://COMPTE.alwaysdata.net/wooclight`).

Ensuite, chaque push sur `main` lance les tests, puis copie l'application si
tout passe. Le premier déploiement signale « config.php absent » : normal,
c'est l'étape suivante.

### Étape 4 — Dossier des données et `config.php`

En SSH sur le serveur :

```bash
mkdir -p ~/wooclight-data && chmod 700 ~/wooclight-data
cd ~/www/wooclight
cp config.sample.php config.php && chmod 600 config.php
```

Générer le **hash** du mot de passe animateur (taper le mot de passe puis
Entrée : il n'apparaît pas dans l'historique du terminal) :

```bash
php -r 'echo password_hash(trim(fgets(STDIN)), PASSWORD_DEFAULT), "\n";'
```

Générer le **secret** :

```bash
php -r 'echo bin2hex(random_bytes(32)), "\n";'
```

Puis `nano config.php` et renseigner :

- `admin_hash` : le hash obtenu (commence par `$2y$`) ;
- `secret` : la suite de 64 caractères ;
- `data_dir` : `/home/COMPTE/wooclight-data` (chemin complet, `echo $HOME` le donne) ;
- `base_url` : `https://COMPTE.alwaysdata.net/wooclight` (adresse mise dans le QR code).

Le mot de passe, le hash et le secret ne doivent jamais être envoyés à une IA
ni écrits dans le dépôt (charte IA du CD47, §5).

### Étape 5 — Sécuriser (avant la première séance)

1. **Empreinte du serveur SSH** (évite qu'un imposteur reçoive le déploiement) :
   en SSH sur le serveur, `ssh-keyscan ssh-COMPTE.alwaysdata.net 2>/dev/null`.
   Copier les lignes obtenues dans un secret GitHub `ALWAYSDATA_KNOWN_HOSTS`.
2. **Approbation du déploiement** : GitHub > Settings > Environments >
   `production` (créé au premier déploiement) > **Required reviewers** : soi-même.
   Chaque mise en ligne attend alors un clic « Approve » dans l'onglet Actions.
3. **Protéger `main`** : Settings > Branches > Add rule (ou Rulesets) sur `main` :
   interdire la suppression et le force-push.
4. **HTTPS obligatoire** : interface Alwaysdata > Sites > le site > activer la
   redirection HTTP → HTTPS. Le déploiement signale en jaune si ce n'est pas fait.
5. **Purge planifiée** : Alwaysdata > Tâches planifiées > ajouter une commande
   quotidienne `php ~/www/purge.php` (adapter le chemin si l'appli est dans un
   sous-dossier). Sans elle, la purge ne tourne que lorsque l'appli est utilisée.

### Étape 6 — Vérifier

- `https://COMPTE.alwaysdata.net/wooclight/admin.php` : la page de connexion s'affiche.
- Le déploiement suivant vérifie tout seul que `lib.php`, `config.php`, `data/`
  ne sont pas lisibles depuis internet (preuve que `.htaccess` est actif). En cas
  d'échec, l'onglet **Actions** de GitHub l'indique en rouge.

## 2. Plan B : envoi par FTP

Si le déploiement automatique est impossible :

1. GitHub > **Actions** > dernier « Tests et déploiement » réussi sur `main` >
   **Artifacts** > télécharger `wooclight` (zip, gardé 30 jours).
2. Décompresser, puis envoyer le contenu dans `www/wooclight/` avec FileZilla
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
| « Mot de passe incorrect » alors qu'il est juste | hash mal copié (guillemets, espace) | Regénérer le hash, le coller entre apostrophes `'…'` |
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
  pointer l'écran, toucher le lien. Sinon, taper l'adresse et le code.
- Le compteur « 20 participants » en haut de la projection confirme que tout le monde est là.

**Pendant (questions)**
- **Ouvrir le vote** → « Votez sur votre téléphone ! » et le nombre de réponses s'affichent.
- Quand le compteur approche 20 : **Fermer le vote**, puis **Afficher les résultats**.
- Réponses libres : relire avant d'afficher, **Masquer** toute réponse contenant
  un nom ou une donnée personnelle.
- **Suivante →** pour enchaîner.
- Une fois tout le monde connecté : **Fermer les inscriptions** (évite qu'une
  personne extérieure ou un faux participant rejoigne avec le code).

**Variante bilan (15 min)** : Post-it collectif « Points forts / Difficultés /
Envies » → regrouper les doublons depuis l'écran animateur → **Publier** →
Vote par gommettes sur ce post-it pour choisir le thème de la séance suivante.

**Après**
- **Exporter en CSV** ou **Version imprimable** pour le bilan.
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
