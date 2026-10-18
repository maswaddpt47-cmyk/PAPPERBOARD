WOOCLIGHT — PROTOTYPE D’INTERFACE / BAC À SABLE — VERSION 3

Pour essayer : ouvrez wooclight-sandbox-v3.html dans un navigateur récent (Firefox,
Chrome, Edge ou Safari). Un double-clic suffit. Aucun serveur ni installation.

Commencez dans Préparer :
1. « Générer ou importer » propose une consigne pour une IA : thème, public,
   nombre de questions, quiz uniquement et défi pratique facultatif.
2. Copiez cette consigne dans votre IA, puis collez sa réponse ou chargez un
   fichier JSON. Aucun service d’IA n’est appelé par le prototype.
3. « Charger un exemple » permet d’essayer sans quitter le fichier. Vous pouvez
   aussi importer exemple-import.json, inclus dans l’archive.
4. Vérifiez l’aperçu, décochez les éléments inutiles puis ajoutez la sélection.
   Les éléments invalides sont signalés. La limite de 50 questions est contrôlée.
5. Ajoutez un brise-glace en premier, une clôture à la fin ou un défi à étapes.
6. Enregistrez une conclusion : elle est affichée à la fin de l’atelier dans les
   aperçus participant et projection, et reprise dans le bilan et le mémo.

Puis, dans Animer :
1. Cliquez sur « Simuler une réponse » et regardez les compteurs.
2. Ouvrez « Aperçu participant » et envoyez une réponse fictive.
3. Ouvrez la projection : les résultats restent cachés.
4. Fermez l’aperçu, cliquez sur « Afficher les résultats », puis rouvrez la projection.
5. Dans Préparer, ajoutez, modifiez ou réordonnez des questions.
6. Dans Bilan, téléchargez les résultats CSV ou la fiche mémo.
7. Ouvrez « Galerie des résultats » pour parcourir les douze rendus projetés :
   anneau, barres, QCM, échelle, nuage de mots, réponses libres, étapes,
   classement, mur, post-it et gommettes.
8. Réduisez la fenêtre pour tester les dispositions tablette et téléphone.

La bibliothèque propose trois séances fictives. En charger une remplace l’essai
en cours, après confirmation. Le bouton « Recommencer » réinitialise le prototype.

Ce fichier est un prototype indépendant de PAPPERBOARD : aucune connexion à
l’application, aucun participant réel, aucun déploiement ni modification du dépôt.
Les vues participant/projection sont des aperçus dans le même navigateur,
pas des appareils reliés entre eux. Les votes et l’historique sont fictifs.

Les changements sont gardés uniquement dans le stockage de ce navigateur, sous
la clé wl_sandbox_v3, lorsque celui-ci l’autorise. Le fichier fonctionne également
si le stockage local est bloqué, mais les changements seront perdus à sa fermeture.

L’import prend en charge sondage, QCM à une ou plusieurs bonnes réponses,
Oui/Non, Vrai/Faux, échelle de 1 à 5 ou 10, texte, nuage de mots, défis et
conclusion. Les variantes des défis par appareil sont conservées et testables
dans l’aperçu participant. Les réponses binaires sont rendues en anneau ; les
sondages et QCM utilisent des barres avec le nombre et le pourcentage. Pour un
QCM multiple, `multi:true` et `correct` contiennent plusieurs textes exacts.
La galerie de projection propose aussi un aperçu visuel des points, murs, post-it
et gommettes. Ces quatre formats restent des aperçus de présentation : ils ne
sont pas encore importables ni animables comme les questions prises en charge.
Les réglages non repris (comparaison, durée, correction automatique) sont signalés
dans l’aperçu. Les liens sont conservés et affichés pendant la relecture, sans appel.

Le prototype ne contient aucune dépendance externe et n’effectue aucun appel
réseau. Les exports sont générés sur votre appareil. Utilisez des exemples fictifs.

Vérification : contrôle de syntaxe JavaScript, 18 scénarios de logique dans un
environnement DOM simplifié, 14 scénarios d’intégration de la préparation,
contrôle statique de la disposition responsive et
calcul des contrastes principaux. Pas de validation visuelle dans un navigateur
ni de test sur lecteur d’écran réalisés dans cet environnement.

Sources modifiables : index.html, style.css, refinements.css, icons.js,
preparation-tools.js et app.js.
Fichier autonome : wooclight-sandbox-v3.html (regroupe tous les styles et scripts).
