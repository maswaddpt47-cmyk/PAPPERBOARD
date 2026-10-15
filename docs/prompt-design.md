# Prompt pour Claude Design — refonte visuelle de WoocLight

Préparé le 15/10/2026. À coller tel quel dans Claude Design. Il demande des
**propositions d'abord** (pistes, puis maquettes), le code ensuite seulement,
et après validation par l'utilisateur. Le code final est intégré par Claude
Code dans le dépôt : Claude Design livre des maquettes et une feuille de style,
pas une nouvelle application.

```text
Tu es directeur artistique et designer d'interface. Je veux refondre
l'apparence de WoocLight, mon application de participation en direct (type
Wooclap, version légère) pour mes ateliers de médiation numérique.
NE CODE RIEN AVANT QUE J'AIE CHOISI UNE PISTE : on avance par étapes, et tu
attends ma réponse à la fin de chaque étape.

LE CONSTAT
L'apparence actuelle fonctionne mais elle est froide : peu de profondeur,
peu de couleur, peu de vie. Les graphiques sont trop statiques. Je veux une
interface chaleureuse, vivante et joyeuse, qui donne envie de participer,
sans devenir enfantine ni bruyante.

LE PUBLIC
- Participants : seniors (parfois peu à l'aise avec un téléphone), collégiens,
  travailleurs sociaux, agents. Ils rejoignent depuis leur téléphone, sans
  compte, avec un code de 5 caractères ou un QR code.
- Animateur : moi, sur un PC portable, souvent en même temps que je parle.
- Projection : un vidéoprojecteur dans une salle, lue de loin (5 à 10 m),
  parfois dans une salle claire qui délave les couleurs.
Outil personnel : aucune couleur ni logo d'une institution, il ne doit pas
passer pour un outil officiel.

LES TROIS INTERFACES ET LEURS ÉCRANS
1. Participant (téléphone d'abord, aussi PC et tablette)
   - Rejoindre : saisie du code ; attente (« la question va apparaître ») ;
     question en cours ; réponse envoyée (confirmation) ; résultats quand
     l'animateur les affiche, avec la bonne réponse et une explication pour
     un quiz ; fin de session : « À retenir » (conclusion de l'animateur) et
     un bouton « Quitter » qui clignote doucement.
   - Types de questions : Oui/Non, Vrai/Faux, QCM (choix unique ou multiple,
     avec ou sans bonne réponse), sondage, nuage de mots, réponse libre
     courte, échelle 1-5 ou 1-10, répartition de points (ex. 10 points entre
     3 choix), mur d'idées avec « j'aime », post-it collectif en colonnes,
     vote par gommettes sur les post-its.
   - Sondage et Oui/Non : un appui envoie. Quiz et QCM multiple : on
     sélectionne puis « Envoyer ». Compte à rebours possible.
2. Projection (16:9, plein écran, thèmes sombre et clair)
   - Accueil : adresse et code en très grand, QR code.
   - Question en cours : intitulé, compteur « 3 / 5 ont répondu », compte à
     rebours ; QR code dans un coin (masquable).
   - Résultats en direct pour chaque type : barres, nuage de mots, moyenne
     d'échelle, points, mur, post-its en colonnes, classement des gommettes ;
     bonne réponse mise en évidence ; explication sous les résultats.
   - Bilan « façon diaporama » : une question par diapositive.
   - Fin : « Session terminée », titre « À retenir » et la conclusion qui
     monte du bas de l'écran comme un générique.
   - Barre de pilotage en bas à gauche (visible de l'animateur connecté) :
     Précédente, bouton central (Ouvrir / Fermer / Afficher / Suivante),
     Suivante, Bilan.
3. Animateur (PC)
   - Connexion ; accueil en onglets « Sessions » / « Archives ».
   - Une session en quatre onglets : Préparer (liste des questions, ajout,
     génération par une IA par copier-coller, conclusion), Animer (code, QR,
     lien d'invitation, pilotage, résultats en direct avec modération),
     Bilan (tableau de bord de toutes les questions, texte pour une IA,
     export PowerPoint, synthèse), Réglages (renommer, terminer, archiver,
     supprimer).
   - Fenêtres : édition d'une question, génération par IA.
Le code est public : https://github.com/maswaddpt47-cmyk/PAPPERBOARD (pages
index.php, screen.php, admin.php ; styles dans assets/style.css). Regarde-le
pour connaître les écrans réels ; ne change ni les parcours, ni les textes,
ni les fonctions : seulement l'apparence et les animations.

CE QUE J'ATTENDS DES GRAPHIQUES
Des résultats vivants : apparition et croissance animées, réordonnancement
fluide quand le classement change, mise en valeur de la bonne réponse,
petite célébration discrète quand tout le monde a répondu, nuage de mots qui
« respire »… Propose une forme adaptée à chaque type (donut pour Oui/Non ?
jauge pour l'échelle ? barres qui font la course pour le sondage ?), en
restant lisible de loin pour des seniors : jamais de texte tourné, jamais
d'animation qui empêche de lire un chiffre.

CONTRAINTES TECHNIQUES (non négociables)
- HTML, CSS et JavaScript « vanilla », sans framework, sans build, sans npm,
  sans bibliothèque de graphiques : graphiques en CSS ou en SVG dessinés par
  du JavaScript simple.
- Aucune ressource externe (pas de CDN, pas de Google Fonts, pas d'image
  distante). Une police web n'est possible que si son fichier .woff2 est
  livré avec l'application, sous licence libre (OFL) ; sinon police système.
  Icônes en SVG livrés en fichiers.
- Politique de sécurité stricte : aucun script ni style écrit dans le HTML
  (pas de <style>, pas d'attribut style="", pas de onclick) ; une seule
  feuille de style, des classes CSS.
- Couleurs en variables CSS --wl-* en tête de la feuille de style.
- Accessibilité : contraste AA (4,5:1) pour tout texte, 3:1 pour les éléments
  graphiques ; cibles tactiles de 48 px au moins ; texte de base 18 px ;
  navigation au clavier et focus visible ; ne jamais coder une information
  par la couleur seule (la bonne réponse porte aussi une coche, par exemple).
- Animations : courtes, douces, jamais plus de 3 éclats par seconde, toutes
  coupées si le système demande moins de mouvement
  (prefers-reduced-motion).
- Les écrans se rafraîchissent toutes les 2 secondes : une animation ne doit
  se jouer qu'au changement réel d'une donnée, pas à chaque rafraîchissement.

LES ÉTAPES
Étape 1 — Trois pistes, sans code. Pour chacune : un nom, l'intention en
deux phrases, la palette (avec les contrastes mesurés), la typographie, le
style des formes (rayons, ombres, profondeur), le style d'animation, et une
maquette de trois écrans clés : téléphone pendant un vote, projection avec
des résultats de sondage, tableau de bord animateur (onglet Animer). Les
trois pistes doivent être vraiment différentes. Dis laquelle tu
recommandes et pourquoi. Puis attends mon choix.
Étape 2 — Sur la piste choisie, les maquettes de tous les écrans listés
plus haut, y compris chaque type de résultat sur la projection, les thèmes
sombre et clair, et une page qui décrit chaque animation (déclencheur,
durée, mouvement). Puis attends ma validation.
Étape 3 — Seulement après validation : la feuille de style complète et les
petits morceaux de JavaScript des graphiques, en gardant les noms de classes
et d'identifiants existants quand c'est possible (liste ceux que tu dois
ajouter ou renommer), prêts à être intégrés par un développeur.

Réponds en français, de façon concise.
```
