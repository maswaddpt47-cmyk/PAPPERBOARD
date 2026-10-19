# Audit de la charte — 19/10/2026

Mesuré dans les sources : production `9ed82b6`, référence PAPPERBOARD-CHATGPT
`65693f9` ; référence visuelle figée `7a80fc3` dans `tests/reference/`.
La copie de référence reste en lecture seule.

- Même palette de base et mêmes polices Georgia/Verdana :
  `assets/style.css` et `PAPPERBOARD-CHATGPT/assets/style.css`, blocs `:root`.
  La coque est transposée dans `assets/interface.css` et reliée au PHP par
  `assets/interface-php.css` ; voir `docs/interface-reference.md`.
- Écart de contraste connu, conservé conformément à la décision utilisateur
  AG-007 : `--wl-b3` vaut `#B18400` en production, contre `#8A6500` dans la
  copie. La moutarde sur la piste ne satisfait pas 3:1 (environ 2,7:1,
  valeur documentée dans `assets/style.css:11`). Cet audit ne la corrige pas.
- Autres écarts de jetons mesurés : `--wl-b7` utilise le brun de bord en
  production, le brun doux dans la copie ; `--wl-pastille` vaut `#E0A22B`
  en production, contre `var(--wl-b3)` dans la copie (`style.css:47-49`
  et référence `style.css:49-50`). Ne pas annoncer une identité des couleurs.
- Les mentions de simulation et le badge Bac à sable sont absents du PHP,
  conformément aux décisions consignées dans CHANTIERS.md.

Mesuré le 19/10/2026 : le contrôle statique de charte passe (15 contrôles).
Le menu modifié place « Atelier en cours » immédiatement après « Mes ateliers ».
Il affiche le nom via `ed-title` et le statut via `ed-badge`, sans second bloc
« Votre atelier ». À 390 et 1280 px, aucun débordement horizontal du menu ni
de la page dans le contrôle navigateur local sur une démo.
Le changement de menu demandé constitue une nouvelle différence volontaire
avec la référence figée ; celle-ci reste intacte.

Mesuré le 19/10/2026 : 319 contrôles de fidélité de l’interface et 104 contrôles
navigateur réussis. Le contrôle natif de galerie est bloqué sur file:// par
la politique Chromium ; exécution équivalente en HTTP : 768 cas, zéro échec.
Le serveur de contrôle répond 204 au favicon absent ; les assertions du harnais
sont conservées.

La comparaison automatisée n'est pas une validation visuelle exhaustive ;
le contrôle utilisateur reste nécessaire.
