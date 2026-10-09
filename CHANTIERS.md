# CHANTIERS — WoocLight

État au **09/10/2026** — commit de référence : voir `git log -1 main`.

## En cours

1. Back-end (`lib.php`, `api.php`, `config.sample.php`).
2. Interfaces (participant, animateur, projection).
3. Tests (`tests/`), CI et déploiement Alwaysdata.

## Décisions à trancher

- **Hook `SessionStart`** : `scripts/check-chantiers.sh` est copié, mais la
  création de `.claude/settings.json` + `.claude/hooks/session-start.sh` a été
  refusée à Claude par le garde-fou de la plateforme (modification de sa
  propre configuration, 09/10/2026). À créer par l'utilisateur (contenu dans
  le README de NEWGEN : même `settings.json`, hook réduit à l'appel du script).

## Points à ne pas défaire

- Bleu CD47 `#4389BD` avec texte blanc : contraste 3,78:1, **refusé en AA**
  pour le texte courant (mesuré le 09/10/2026, formule WCAG). Variante pour
  boutons et texte : `#2F6A96` (5,80:1 sur blanc). Bleu ciel `#5EB3D2` (2,37)
  et vert `#B6C932` (1,84) : jamais de texte blanc dessus, texte foncé
  seulement. Sarcelle `#197D89` (4,84) et gris `#6F6F6E` (5,03) passent sur
  blanc.

## Pistes d'amélioration

*Proposées, en attente :* aucune.
*Écartées :* aucune.
