# WoocLight — règles de travail (dépôt PAPPERBOARD)

**Lire d'abord `CHANTIERS.md`** : état du projet, décisions à trancher, points
à ne pas défaire. Cahier des charges de référence : `docs/prompt-wooclight.md`.

Application de participation en direct (type Wooclap léger) pour des ateliers
de médiation numérique (projet personnel depuis le 14/10/2026). PHP 8 sans framework, JSON dans `DATA_DIR`,
JS vanilla sans build, hébergée chez Alwaysdata. Règles copiées de MD-LIB
(`maswaddpt47-cmyk/MD-LIB`) et adaptées le 09/10/2026 ; MD-LIB reste la source.

## 1. Git

- `git pull origin main` avant de lire ou d'écrire quoi que ce soit.
- Un commit par modification logique, message conventionnel en français
  (`feat:`, `fix:`, `refactor:`, `style:`, `docs:`, `chore:`).
- Branche de session imposée par la plateforme. `main` est protégée par un
  ruleset (contrôle `tests` exigé, 14/10/2026) : un merge local poussé est
  refusé. Méthode : partir de `origin/main`, pousser la branche, attendre la
  CI verte sur son dernier commit, puis avancer `main` dessus
  (`git push origin <sha>:main`, avance rapide). Le déploiement part alors
  tout seul (pas d'approbation manuelle, choix du 14/10/2026).
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
- Projet personnel (14/10/2026) : l'utilisateur est responsable de traitement.
  Si l'outil sert un jour des ateliers du CD47, la purge redevient une
  élimination d'archives publiques (Archives départementales, DPD du
  Département) — MD-LIB `archivage-cd47.md`.
- Captures envoyées à Claude : données fictives ou recadrées.
- Changement structurant de sécurité (connexion, page publique, hébergement)
  → audit Codex ponctuel (MD-LIB `agora.md` §12, modèle
  `consigne-audit-externe.md`) : Claude prépare la consigne, l'utilisateur
  la colle dans Codex, Codex ne modifie rien.

## 5. Couleurs

Palette neutre (projet personnel, 14/10/2026) : variables `--wl-*` en tête de
`assets/style.css`, Verdana. Plus de couleurs ni de logo du CD47 (un outil
personnel ne doit pas passer pour un outil officiel). Tout couple texte/fond
vérifié AA (4,5:1), éléments graphiques 3:1.
