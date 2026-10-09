Construis « WoocLight », application web de participation en direct (type Wooclap, version légère) pour mes ateliers de médiation numérique au CD47. Projet complet, testé, déployé sur Alwaysdata depuis GitHub.

## 0. AVANT DE COMMENCER (dans cet ordre)
- Dépôt : `maswaddpt47-cmyk/PAPPERBOARD` (le nom du dépôt reste PAPPERBOARD, l'application s'appelle WoocLight). MD-LIB attaché en lecture.
- `git pull origin main` avant de lire ou d'écrire quoi que ce soit (si `main` n'existe pas encore, partir de la branche de session).
- Ce prompt est rangé dans `docs/prompt-wooclight.md` : c'est le cahier des charges de référence.
- Lis dans MD-LIB : `hygiene-instructions.md`, `collaboration.md`, `git-workflow.md`, `rgpd-securite.md`, `charte-graphique-cd47.md`, `charte-ia-cd47.md`, `archivage-cd47.md`, `agora.md` §12.
- Crée à la racine :
  - `CLAUDE.md` du projet : règles **copiées** (pas référencées) de MD-LIB, adaptées à ce projet, budget serré ; renvoi vers `CHANTIERS.md` en tête.
  - `CHANTIERS.md` (règle 8ter), tenu à jour à chaque étape, pas en fin de session.
  - `scripts/check-chantiers.sh` + hook `SessionStart` (copié depuis ATELIERS_NEWGEN, rappel de ménage seul).
- Puis ajoute PAPPERBOARD (WoocLight) à la liste des projets consommateurs dans le `CLAUDE.md` de MD-LIB (commit séparé sur MD-LIB).

## 1. GIT
- Branche de session imposée par la plateforme → merge `--no-ff` dans `main` en fin de session (le déploiement ne part que de `main`).
- Un commit par modification logique, message conventionnel (`feat:`, `fix:`, `refactor:`, `style:`, `docs:`, `chore:`), en français.
- Pas d'historique dans le code (pas de « v1.2 : … ») : ça va dans `git log`.
- Racine du dépôt = racine de l'application (pas de sous-dossier `wooclight/`).

## 2. HÉBERGEMENT : ALWAYSDATA
- PHP 8.x, Apache (`.htaccess` actif — à vérifier sur le compte, pas à supposer), SSH disponible, pas de MySQL.
- Déploiement : workflow GitHub Actions sur push `main`, `rsync` en SSH par clé, clé et hôte dans les **Secrets GitHub** (même schéma que l'API des Ateliers). `permissions:` minimales dans le workflow. Exclure du rsync : `data/`, `config.php`, `.git*`, `tests/`, `scripts/`, `*.md`.
- `config.php` jamais commité : créé une fois sur le serveur à partir de `config.sample.php`. **Je génère moi-même le hash du mot de passe** en SSH (`php -r 'echo password_hash("…", PASSWORD_DEFAULT);'`) : ne me demande jamais le mot de passe ni le hash (charte IA §5).
- `data/` **hors de la racine web** par défaut (chemin `DATA_DIR` dans config.php, ex. `~/wooclight-data/`), créé automatiquement ; si placé dans la racine web, `.htaccess` « Require all denied » + `index.php` vide.
- Plan B documenté dans le README : envoi FTP d'un zip produit par la CI (artefact, pas commité).

## 3. CONTRAINTES TECHNIQUES (inchangées)
- PHP 8.x sans Composer, sans framework, sans extension particulière. Stockage JSON dans `DATA_DIR` (flock + écriture atomique via fichier temporaire + rename).
- HTML/CSS/JS vanilla, sans build, sans npm. Aucune ressource externe (CDN, polices, scripts) : qrcode-generator embarqué en local avec sa licence.
- Polling 2 s (configurable), ETag ou numéro de version → 304 si rien n'a changé.

## 4. RÔLES, ÉCRANS, TYPES DE QUESTIONS, RÈGLES DE FONCTIONNEMENT
Participants : seniors, collégiens, travailleurs sociaux, agents. Ils rejoignent depuis leur téléphone, sans compte, via un QR code ou un code court (5 caractères). Interface entièrement en français.

### Rôles et écrans
1. **Animateur (admin.php)** : protégé par mot de passe (hash dans config.php, `password_verify`, session PHP).
   - Créer / dupliquer / supprimer une session (titre, code généré automatiquement).
   - Ajouter, éditer, réordonner, supprimer des questions.
   - Piloter en direct : question suivante / précédente, ouvrir / fermer les votes, afficher / masquer les résultats, réinitialiser une question.
   - Afficher le QR code et le code de la session, avec l'URL de participation.
   - Exporter les résultats en CSV (UTF-8 avec BOM, séparateur point-virgule, lisible dans Excel) et en version imprimable.
2. **Participant (index.php)** : saisit le code ou arrive par QR code, voit uniquement la question active, répond en un geste, reçoit une confirmation. Peut modifier sa réponse tant que le vote est ouvert (si l'animateur l'autorise).
3. **Projection (screen.php?s=CODE)** : plein écran, grande typographie lisible de loin, résultats animés en direct, QR code visible en permanence dans un coin. Thèmes sombre et clair.

### Types de questions
- Oui / Non (deux gros boutons, résultat en pourcentage et en nombre)
- Vrai / Faux
- QCM à choix unique ou multiple, avec option « bonne réponse » pour un quiz (affichage de la correction)
- Sondage (choix unique, résultat en barres)
- Nuage de mots (saisie libre courte, regroupement sans tenir compte de la casse ni des accents, taille proportionnelle à la fréquence)
- Réponse libre (mur de réponses courtes, l'animateur peut masquer une réponse)
- Échelle de 1 à 5 ou de 1 à 10 (moyenne et répartition)
- Classement par points (ex. répartir un budget de 10 points)

Chaque question a : intitulé, type, options, durée optionnelle avec compte à rebours, mode anonyme (par défaut).

### Règles de fonctionnement
- Un participant = un jeton aléatoire généré côté serveur, stocké en cookie + localStorage. Un seul vote par question et par jeton (sauf modification autorisée).
- Limite de taux par IP et par jeton, réponses libres limitées à 80 caractères, nombre maximal de participants configurable (défaut 150).
- Filtre simple de mots interdits configurable pour les réponses libres.
- Sessions expirées et purgées automatiquement après N jours (défaut 30, configurable — voir §5).
- Messages d'erreur clairs (code inconnu, vote fermé, session terminée, connexion perdue avec reconnexion automatique). Connexion lente : états de chargement, aucune réponse perdue.

### Structure
`index.php`, `admin.php`, `screen.php`, `api.php` (toutes les actions), `lib.php` (stockage, validation, sécurité), `config.sample.php`, `assets/` (style.css, app.js, admin.js, screen.js, qrcode.js), `.htaccess`, `.gitignore` (exclut `data/` et `config.php`), `README.md`, plus `tests/`, `scripts/`, `docs/`, `.github/workflows/`. Code commenté en français, fonctions courtes, pas de duplication.

## 5. SÉCURITÉ ET RGPD
- Tout le cahier des charges initial (XSS, CSRF, en-têtes, CSP stricte, aucune donnée personnelle, IP hachée salée, mentions de confidentialité).
- Sel du hachage IP et clé de session dans `config.php`, jamais dans le dépôt.
- Session PHP animateur : cookie `HttpOnly`, `SameSite=Strict`, `Secure` si HTTPS ; régénération de l'ID à la connexion ; limite de tentatives de connexion.
- Réponses libres : même anonymes, elles peuvent contenir un nom ou une donnée sensible tapée par un participant → modération + purge.
- **Purge automatique** (défaut 30 j) : c'est une élimination d'archives publiques (`archivage-cd47.md`). Code-la, mais signale-moi en ⚠️ que la durée doit être validée avec les Archives départementales.
- Rédige une fiche de traitement courte (`docs/registre-traitement.md`) pour le registre RGPD : finalité, données, durée, hébergeur (Alwaysdata, France), sous-traitants (GitHub pour le code seul).
- Signalements au format ⚠️ de `rgpd-securite.md`, au moment où tu les constates.

## 6. EXPÉRIENCE UTILISATEUR ET CHARTE
- Cahier des charges initial (mobile first, 48 px, AA, clavier, ARIA, grands textes pour les seniors).
- Variables CSS en tête de `style.css` **préremplies avec la charte CD47** : bleu `#4389BD` (principal), sarcelle `#197D89`, bleu ciel `#5EB3D2`, vert `#B6C932`, gris `#6F6F6E`. Police Verdana (système), pas de Capriola embarquée. Vérifie les contrastes AA de chaque couple texte/fond : si une couleur de la charte ne passe pas (ex. blanc sur vert), dis-le et propose la variante.
- Pas de logo CD47 dans le code tant que je ne te l'ai pas fourni.

## 7. TESTS (dosés, règles 14 à 17 de collaboration.md)
- `php -l` sur tous les PHP, `node --check` sur tous les JS.
- Un script de bout en bout réutilisable (`tests/e2e.sh` ou `tests/e2e.php`, curl contre `php -S localhost:8000`) : 1 animateur + plusieurs participants, chaque type de question (création, vote, double vote refusé, vote fermé refusé, résultats, export CSV, purge), CSRF manquant refusé, `data/` inaccessible.
- **Test de coût** (`hygiene-instructions.md` §2) : sur 30 polls sans changement, 0 corps renvoyé (304) ; compter les requêtes émises par un participant pendant une question.
- Test de charge léger : 150 participants simulés votant en même temps → aucun vote perdu, aucun JSON corrompu.
- CI GitHub Actions : lint + e2e à chaque push ; le déploiement n'a lieu que si la CI passe.
- Rendu visuel : pas de capture par défaut, dis-moi quoi regarder sur mon téléphone et l'écran de projection.
- Ne dis « testé » que pour ce qui a réellement été exécuté ; le reste marqué « hypothèse non vérifiée ».

## 8. AVANT LA MISE EN PRODUCTION
- `/security-review` sur la branche.
- Audit Codex ponctuel (`agora.md` §12, règle 4 : nouvelle page publique + mot de passe) : prépare-moi la consigne à partir de `consigne-audit-externe.md`, je la colle dans Codex.
- Proposer d'ajouter WoocLight à la routine d'audit trimestriel (`trig_01J6ZMsLHKbgXAQsRYgQL16q`, modifiable par moi seul : prépare le texte).

## 9. LIVRABLES
1. Le dépôt complet, mergé dans `main`, déployé par la CI (ou bloqué en attente de mes secrets : dis-moi lesquels créer et où).
2. `README.md` en français : installation Alwaysdata pas à pas (site PHP, SSH, dossier data, `config.php`, hash), Secrets GitHub à créer, plan B FTP, test rapide, dépannage, déroulé d'un atelier de 20 personnes.
3. `CHANTIERS.md` à jour : limites connues, décisions à trancher, points à ne pas défaire.

## 10. STYLE
- Français, direct, court (règle 18). Avance par étapes (back-end, interfaces, tests, déploiement), un commit par étape.
- Ne pose une question que si le choix est bloquant ; sinon décide et signale la décision **au moment où tu la prends** (règle 4).
- Pas de compliment, un constat. En fin de livraison : au plus 3 pistes d'amélioration, consignées dans `CHANTIERS.md` (règle 22).
