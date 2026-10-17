# WoocLight — règles de travail (dépôt PAPPERBOARD)

**Lire d'abord `CHANTIERS.md`** : état du projet, décisions à trancher, points
à ne pas défaire. Cahier des charges de référence : `docs/prompt-wooclight.md`.

Application de participation en direct (type Wooclap léger) pour des ateliers
de médiation numérique, surtout sur ordinateur : dire « appareil », pas « téléphone ». **Projet personnel** (14/10/2026) : le CD47 n'est pas
concerné, l'utilisateur est responsable de traitement. PHP 8 sans framework, JSON dans `DATA_DIR`,
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
  tout seul (pas d'approbation manuelle, choix du 14/10/2026). Avant d'écrire
  « en ligne », `MD-LIB/outils/attendre-deploiement.sh` doit avoir dit ✅.
- Racine du dépôt = racine de l'application. Pas de changelog dans le code
  (« v1.2 : … ») : l'histoire va dans `git log`, le code porte la décision
  en vigueur et sa raison.

## 2. Collaboration

- Ne rien déclarer « testé », « réparé » ou « en ligne » sans l'avoir exécuté.
  Sinon : « hypothèse non vérifiée ». Toute affirmation technique écrite dans
  un `.md` porte une date (JJ/MM/AAAA) et son statut (mesuré / supposé).
  « Validé » = seulement ce que l'utilisateur a nommé (« c'est bon » ne couvre pas le reste).
- Toute fonction nouvelle se montre là où l'utilisateur teste (démo comprise) ; la
  réponse dit **où cliquer** en premier, jamais une fonction cachée sans le dire.
- Signaler une déviation du cahier des charges ou une décision prise seul
  **au moment où elle est prise**. Question seulement si le choix bloque.
- Dates explicites, jamais « hier » / « demain ».
- `CHANTIERS.md` tenu à jour à chaque étape, pas en fin de session : tâche
  finie = descriptif retiré, l'invariant remonte dans « Points à ne pas
  défaire ». `scripts/check-chantiers.sh` signale un fichier à nettoyer.
- Réponses courtes et non techniques par défaut. Pas de compliment, un constat.
- Avant de décrire un correctif, suivre la valeur sur **tout son chemin**
  (`then`/`catch`, appelants, valeurs par défaut), pas la seule ligne à
  changer : le 23/09/2026 un correctif annoncé comme suffisant était
  inopérant, le `catch` écrasant la décision prise dans le `then`.
- Un nombre annoncé se **compte par une commande**, pas à l'œil sur une liste ;
  sinon le dire comme une estimation.
- Fichier partagé entre sessions (`AGORA.md`, `CHANTIERS.md`, `CLAUDE.md`) :
  refaire un `git fetch` et le relire **juste avant de rédiger**, pas seulement
  à l'ouverture.
- Pistes d'amélioration : au plus 3, en fin de fonctionnalité validée,
  consignées dans la section « Pistes » de `CHANTIERS.md`.

## 3. Tests — dosés

- Une contrainte formulable en test devient un test, pas un paragraphe.
- Suite complète : `bash tests/run.sh` (lint PHP/JS, e2e, coût, charge), une
  fois avant le commit, pas à chaque étape. La CI la relance à chaque push.
- Le test de coût (`tests/e2e.php`, section « coût ») tient le polling : 304
  sans corps quand rien ne change. Ne pas le retirer.
- Rendu (CSS, libellés, mise en page) : pas de test ni de capture par défaut, mais
  mesuré à 390 px (son Android) et à 1280x720 avant de livrer ; lui dire quoi regarder.

## 4. RGPD et sécurité

Alerter sans attendre, au format :
> ⚠️ RGPD/sécurité : <point précis>. <conséquence>. <action ou question>.

- Aucune donnée personnelle collectée ; jeton participant aléatoire ; IP
  seulement hachée avec sel (`config.php`), pour la limite de taux.
- `config.php` (hash du mot de passe, sel, secret) jamais commité, jamais vu
  par Claude : l'utilisateur le crée lui-même en SSH
  (`configurer.php`). Ne jamais demander mot de passe, hash ni clé SSH.
- Réponses libres : un participant peut y taper un nom → modération + purge.
- Durée de purge et mentions de confidentialité : fixées par l'utilisateur
  (`config.php`), fiche dans `docs/registre-traitement.md`.
  Claude peut la modifier quand le code ou les données la rendent inexacte
  (accordé par l'utilisateur le 15/10/2026) ; il signale chaque modification,
  l'utilisateur relit et valide : il reste responsable de traitement.
- Captures envoyées à Claude : données fictives ou recadrées.
- Changement structurant de sécurité (connexion, page publique, hébergement)
  → audit Codex ponctuel (MD-LIB `agora.md` §12, modèle
  `consigne-audit-externe.md`) : Claude prépare la consigne, l'utilisateur
  la colle dans Codex, Codex ne modifie rien.

## 5. Couleurs

Charte « Papier & Terre » (validée le 15/10/2026, `INTEGRATION.md`) : variables
`--wl-*` en tête de `assets/style.css`, Georgia (titres) et Verdana ; le
PowerPoint du bilan (`assets/bilan-pptx.js`) reprend les couleurs du thème clair. Aucune couleur ni logo d'une institution (un
outil personnel ne doit pas passer pour un outil officiel). Tout couple texte/fond
vérifié AA (4,5:1), éléments graphiques 3:1.

## 6. AGORA — faire contredire une décision par une autre session

Créée le 17/10/2026. `AGORA.md` (racine) suffit pour répondre ; `MD-LIB/agora.md`
n'est **pas requis**. Claude **soumet d'office** un bloc dès qu'un critère est
rempli, sans demander, l'annonce en une ligne (« ⚖️ AGORA : critère N — … Bloc
AG-00N commité. À coller dans l'autre session : « pull, lis AGORA.md, réponds à
AG-00N, tu es la session B » ») et **ne bloque jamais** : le travail continue.
L'utilisateur décide de coller la phrase ou non, et tranche. Le bloc se dépose
**au moment du choix**, avant le code (après, la lecture est biaisée vers le
statu quo). `main` étant protégée, il se pousse comme tout (§1) : branche, CI, avance rapide.

**Les six critères** (vérifiables dans le diff) :
1. La décision ferme une porte : schéma de données, format de stockage ou
   d'export, nouvelle dépendance, contrat entre modules (une migration pour défaire).
2. Deux options ont été envisagées, une seule écrite, sans arbitrage extérieur.
3. Trois itérations sans résolution sur le même problème.
4. Proposition de défaire un existant dont la raison d'être n'est pas retrouvée.
5. La proposition contredit une note datée du dépôt (`CLAUDE.md`, `CHANTIERS.md`).
6. Coût irréversible côté usager : suppression de données, migration.

Toute entrée « décision à trancher » de `CHANTIERS.md` est candidate : dire à
l'écriture pourquoi on ouvre un bloc ou non.

**Ne vont pas à l'AGORA** : un changement de rendu pur, un correctif localisé
appuyé sur une preuve (test rouge puis vert), tout ce qui se défait en un commit.
**La sécurité, l'authentification et les données personnelles vont à Codex**
(§4), pas à l'AGORA.

**Répondre** : jamais à son propre bloc (comparer les `Claude-Session:` des
commits, voir `AGORA.md`) ; « confirmé » est une réponse pleine ; aucune
appréciation ; sans `fichier:ligne`, mesure ou log, la réponse ne compte pas.

