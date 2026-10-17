# AGORA — WoocLight (PAPPERBOARD)

Créée le 17/10/2026. Une décision qui engage le projet est soumise ici à une
**autre session Claude**, qui lit le code et la contredit ou la complète. Ce
fichier et la section 6 de `CLAUDE.md` suffisent pour répondre : `MD-LIB/agora.md`
n'est **pas requis** (il explique le pourquoi). Les questions de **sécurité,
d'authentification ou de données personnelles** ne vont pas ici mais à Codex
(consigne : `docs/consigne-audit-codex-17-10-2026.md`).

## Règles de réponse (celles qui ne se déduisent pas du gabarit)

1. **Ne jamais répondre à un bloc qu'on a ouvert soi-même.** Avant de répondre :
   `git log -1 --format=%B <sha du bloc>` et comparer son `Claude-Session:` à celui
   de la session courante. Identiques : on ne répond pas. Trailer absent : demander
   à l'utilisateur.
2. **Append-only.** On ajoute son bloc ou sa réponse, on n'édite jamais ceux d'une
   autre session. `git pull --rebase origin main` avant de pousser. **Écart
   assumé par rapport à `agora.md` §7** (17/10/2026) : `main` est protégée ici (tests
   exigés), donc pas de push direct : pousser la branche, attendre la CI verte,
   puis `git push origin <sha>:main` en avance rapide (`CLAUDE.md` §1). Compter
   quelques minutes.
3. **Aucune donnée d'usager** dans un bloc (réponses, noms, journaux réels).

## Sincérité (contre la politesse)

1. « **Amendé** » n'est valable que s'il nomme ce qui serait faux, manquant ou
   coûteux si la proposition était appliquée telle quelle. Sinon : « confirmé ».
2. « **Confirmé** » est une réponse pleine et utile. Ne jamais chercher un
   amendement pour justifier sa présence.
3. **Aucune appréciation** de la proposition ni de son auteur (ni compliment, ni
   « bien vu ») : une réponse commence par un constat. Une réponse sans
   `fichier:ligne`, mesure ou log ne compte pas.

Le total des verdicts (tableau « Blocs tranchés ») est **une alerte, pas un
objectif** : le verdict découle de la contrainte 1, jamais du total.

## Cycle de relais

Dépôt du bloc → l'utilisateur colle la phrase de relais dans l'autre session
(« pull, lis AGORA.md, réponds à AG-00N, tu es la session B ») → la réponse arrive
dans le fichier → **l'utilisateur tranche**. Aucune notification ne passe d'un
compte Claude à l'autre : le relais est humain. L'AGORA ne bloque jamais le travail.
*Supposé, pas mesuré (17/10/2026).*

## Gabarit d'un bloc

```markdown
## AG-00N — Titre court — ouvert le JJ/MM/AAAA
**Auteur** : session A — <8 premiers caractères du Claude-Session> — lu sur `<sha court>`
**Proposition** : en 3 lignes maximum.
**Critère déclencheur** : n° et lequel (CLAUDE.md §6).
**Ce que ça engage** : ce qui serait coûteux à défaire.
**Non vérifié par l'auteur** : ...
**Si personne ne répond, je fais quoi ?** : (« je continue pareil » = pas de bloc)
**Où regarder** : fichier:ligne

### Réponse — JJ/MM/AAAA
**Auteur** : session B — <8 caractères> — lu sur `<sha court>`
**Verdict** : confirmé | amendé | contredit
**Constat** : avec fichier:ligne, mesure ou log.
**Amendement** : ...

### Tranché le JJ/MM/AAAA — décision : ...
```

Un bloc tranché sort du fichier : sa conclusion remonte dans `CHANTIERS.md`
(« Points à ne pas défaire »), le récit reste dans `git log`.

## Blocs ouverts

## AG-001 — Format du défi à étapes et de ses variantes — ouvert le 17/10/2026
**Auteur** : session A — 01RfXXkk — lu sur `723f319`. *Bloc soumis après coup : le
code est déjà en ligne (derrière « fonctions en essai »), donc exposé au biais de
statu quo.*
**Proposition** : un type `steps` porte des titres d'étapes communs (`options`, 2 à
10) et, en option, des variantes par appareil (`variants` : 2 à 4 noms, même nombre
d'étapes, 160 caractères). La réponse d'un participant est la liste des indices
cochés ; tout décocher supprime sa réponse. L'export JSON écrit `variants` comme
un objet nom → étapes (le format que l'IA doit produire).
**Critère déclencheur** : 1 (ferme une porte : format de stockage et d'export).
**Ce que ça engage** : toute session stockée, tout fichier exporté ou texte d'IA
suit ce format ; le changer demande une migration des sessions et des consignes.
**Non vérifié par l'auteur** : lecture par le bilan, le PowerPoint et le CSV d'un
défi à 4 variantes très longues ; deux participants qui décochent en même temps ;
le sens de « variantes » si un jour un atelier mélange plus de 4 systèmes.
**Si personne ne répond, je fais quoi ?** : je garde le format tel quel.
**Où regarder** : `lib.php:727` (`wl_clean_variants`), `lib.php:1008`
(`wl_clean_answer`), `lib.php:926` (`wl_export_questions`), `assets/app.js:256`.

## AG-002 — Réglage « fonctions en essai » stocké sur le serveur — ouvert le 17/10/2026
**Auteur** : session A — 01RfXXkk — lu sur `723f319`. *Soumis après coup, même biais.*
**Proposition** : un fichier `prefs.json` dans le dossier de données porte les
réglages de l'animateur (`beta` pour l'instant), lu par l'action `me`, écrit par
`prefs_save` (animateur + CSRF), à la place d'un réglage propre à chaque navigateur.
**Critère déclencheur** : 1 (nouveau fichier de données, nouveau contrat de `me`).
**Ce que ça engage** : un fichier de plus, jamais purgé ; le réglage vaut pour tous
les animateurs (il n'y en a qu'un) ; tout futur réglage prendra cette forme.
**Non vérifié par l'auteur** : écriture simultanée de deux appareils ; dossier de
données absent ou non inscriptible ; effet d'une sauvegarde/restauration du dossier.
**Si personne ne répond, je fais quoi ?** : je garde le fichier tel quel.
**Où regarder** : `lib.php:1989-2003`, `api.php:324-331`, `assets/admin.js` (`setBeta`).

## Blocs tranchés

| Bloc | Date | Verdict | Décision |
|---|---|---|---|

Total des verdicts : 0 confirmé, 0 amendé, 0 contredit.
