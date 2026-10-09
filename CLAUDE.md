# WoocLight — règles de travail (dépôt PAPPERBOARD)

**Lire d'abord `CHANTIERS.md`** : état du projet, décisions à trancher, points
à ne pas défaire. Cahier des charges de référence : `docs/prompt-wooclight.md`.

Application de participation en direct (type Wooclap léger) pour les ateliers
de médiation numérique du CD47. PHP 8 sans framework, JSON dans `DATA_DIR`,
JS vanilla sans build, hébergée chez Alwaysdata. Règles copiées de MD-LIB
(`maswaddpt47-cmyk/MD-LIB`) et adaptées le 09/10/2026 ; MD-LIB reste la source.

## 1. Git

- `git pull origin main` avant de lire ou d'écrire quoi que ce soit.
- Un commit par modification logique, message conventionnel en français
  (`feat:`, `fix:`, `refactor:`, `style:`, `docs:`, `chore:`).
- Branche de session imposée par la plateforme → en fin de session
  `git checkout main && git merge <branche> --no-ff && git push origin main`.
  Le déploiement ne part que de `main`, et seulement si la CI passe.
- Racine du dépôt = racine de l'application. Pas de changelog dans le code
  (« v1.2 : … ») : l'histoire va dans `git log`, le code porte la décision
  en vigueur et sa raison.

## 2. Collaboration

- Ne rien déclarer « testé », « réparé » ou « en ligne » sans l'avoir exécuté.
  Sinon : « hypothèse non vérifiée ». Toute affirmation technique écrite dans
  un `.md` porte une date (JJ/MM/AAAA) et son statut (mesuré / supposé).
- Signaler une déviation du cahier des charges ou une décision prise seul
  **au moment où elle est prise**. Question seulement si le choix bloque.
- Dates explicites, jamais « hier » / « demain ».
- `CHANTIERS.md` tenu à jour à chaque étape, pas en fin de session : tâche
  finie = descriptif retiré, l'invariant remonte dans « Points à ne pas
  défaire ». `scripts/check-chantiers.sh` signale un fichier à nettoyer.
- Réponses courtes et non techniques par défaut. Pas de compliment, un constat.
- Pistes d'amélioration : au plus 3, en fin de fonctionnalité validée,
  consignées dans la section « Pistes » de `CHANTIERS.md`.

## 3. Tests — dosés

- Une contrainte formulable en test devient un test, pas un paragraphe.
- Suite complète : `bash tests/run.sh` (lint PHP/JS, e2e, coût, charge), une
  fois avant le commit, pas à chaque étape. La CI la relance à chaque push.
- Le test de coût (`tests/e2e.php`, section « coût ») tient le polling : 304
  sans corps quand rien ne change. Ne pas le retirer.
- Rendu (CSS, libellés, mise en page) : pas de test ni de capture par défaut,
  dire à l'utilisateur quoi regarder sur son téléphone et sur la projection.

## 4. RGPD et sécurité

Alerter sans attendre, au format :
> ⚠️ RGPD/sécurité : <point précis>. <conséquence>. <action ou question>.

- Aucune donnée personnelle collectée ; jeton participant aléatoire ; IP
  seulement hachée avec sel (`config.php`), pour la limite de taux.
- `config.php` (hash du mot de passe, sel, secret) jamais commité, jamais vu
  par Claude : l'utilisateur génère le hash lui-même en SSH (charte IA CD47
  §5). Ne jamais demander mot de passe, hash ni clé SSH.
- Réponses libres : un participant peut y taper un nom → modération + purge.
- La purge automatique est une élimination d'archives publiques : durée à
  valider avec les Archives départementales et le DPD
  (`contact-dpd@lotetgaronne.fr`) — résumé dans MD-LIB `archivage-cd47.md`.
- Captures envoyées à Claude : données fictives ou recadrées.
- Changement structurant de sécurité (connexion, page publique, hébergement)
  → audit Codex ponctuel (MD-LIB `agora.md` §12, modèle
  `consigne-audit-externe.md`) : Claude prépare la consigne, l'utilisateur
  la colle dans Codex, Codex ne modifie rien.

## 5. Charte CD47

Couleurs dans les variables CSS en tête de `assets/style.css` (bleu `#4389BD`,
sarcelle `#197D89`, bleu ciel `#5EB3D2`, vert `#B6C932`, gris `#6F6F6E`),
Verdana. Tout couple texte/fond vérifié AA (4,5:1). Pas de logo tant que
l'utilisateur ne l'a pas fourni.
