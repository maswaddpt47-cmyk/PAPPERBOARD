# Transmission à Claude — WooCLight / PAPPERBOARD

Ce dossier transmet les ressources utilisées dans la conversation avec Codex.
Les chemins de l'environnement Codex ne sont pas des chemins accessibles depuis
l'environnement Claude. Il faut joindre cette archive et l'extraire chez Claude.

## Choix de départ

Partir de la v3 fournie. Il n'est pas nécessaire de retrouver ou de recréer les
versions v1 et v2. « v3 » est le numéro du prototype local, sans rapport établi
avec les branches ou versions de PAPPERBOARD.

Contenu :

- `wooclight-sandbox-v3.html` : prototype autonome, CSS et JavaScript intégrés.
- `wooclight-sandbox-v3.zip` : archive v3 fournie précédemment, conservée à l'identique.
- `sources/` : sources modifiables, exemple d'import, vérifications et script
  `package-prototype.py` pour régénérer le fichier autonome et les archives.
- `captures/` : les six images jointes à la conversation d'origine.

## Références visuelles et périmètre

La consigne d'audit déjà transmise décrit une charte ivoire / terracotta, avec
titres en Georgia et projection bleu pétrole sombre. Il faut comparer cette
description aux cinq captures de l'application d'origine. Le prototype v3 est
la base de code existante ; son interface actuelle utilise davantage le bleu-vert
et le gris clair. Le rapport d'audit doit rendre cette différence explicite.

La police retenue dans l'échange est `Georgia, "Times New Roman", serif` pour les
titres concernés, avec une police système sans-serif pour le texte courant.
Aucune police externe n'est nécessaire.

| Capture | Rôle |
| --- | --- |
| `captures/01-original-generer-importer.jpg` | Formulaire de génération et d'import de l'application d'origine. |
| `captures/02-original-preparation-conclusion.jpg` | Ajout de questions, brise-glace, clôture, défi et conclusion. |
| `captures/03-original-resultat-oui-non.jpg` | Anneau Oui / Non, nombres, pourcentages et explication. |
| `captures/04-original-resultat-qcm-multiple.jpg` | QCM à plusieurs réponses et mise en évidence des bonnes réponses. |
| `captures/05-original-resultat-sondage.jpg` | Barres de sondage, nombres et pourcentages. |
| `captures/06-sandbox-ancienne-projection-sans-graphe.jpg` | Ancien défaut signalé dans le sandbox : question sans résultat affiché. C'est un document de diagnostic, pas un rendu final à reproduire. |

Les captures sont des vues mobiles. Elles ne définissent pas à elles seules
l'agencement PC : préserver l'objectif d'une interface responsive utilisable
sur PC, tablette et téléphone.

## Ce que la v3 permet réellement

- Questions animables dans le navigateur : sondage, QCM simple ou multiple,
  Oui / Non, Vrai / Faux, échelle, défi à étapes, texte et nuage de mots.
- Une galerie parcourt douze rendus : anneau, sondage, QCM simple, QCM multiple,
  échelle, nuage, texte, étapes, points, mur, post-it et gommettes.
- Points, mur, post-it et gommettes sont des démonstrations visuelles dans la
  galerie ; ils ne sont pas encore importables ou animables dans la séance.
- Les aperçus participant et projection fonctionnent dans le même navigateur.
  Les participants et les réponses sont fictifs, sans synchronisation réseau.

Ne pas confondre une démonstration visuelle et une fonction complète. L'audit
doit recenser les écarts ; la suite dépend des phases autorisées.

## Exécution demandée à Claude

1. Vérifier que l'archive est extraite et que les images sont lisibles. Si l'outil
   ne permet pas de voir les images dans l'archive, demander les cinq premières
   captures en pièces jointes directes ; ne pas déclarer les avoir vues.
2. Reprendre la PHASE 0 du prompt déjà transmis : audit sans modification.
3. Inspecter PAPPERBOARD en lecture seule. Les modifications ultérieures de
   ce travail concernent la copie locale du sandbox. Aucun déploiement demandé.
4. Identifier les différences entre la charte décrite, les captures et la v3.
5. Fournir le rapport, les priorités et le plan, puis attendre « GO PHASE 1 »
   comme demandé dans le prompt initial.

Après les phases de modification autorisées, les contrôles existants peuvent
être lancés depuis `sources/` :

```bash
node --check app.js
node --check preparation-tools.js
node qa.cjs
node qa-preparation.cjs
python3 package-prototype.py
```

Une validation visuelle dans un navigateur reste à réaliser et à décrire
honnêtement. Les fichiers de vérification existants couvrent de la logique et
de l'intégration ; ils ne constituent pas des captures de tests visuels.
