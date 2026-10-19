# Référence de l’interface — 19/10/2026

Exigence utilisateur : le rendu PHP reprend fidèlement la simulation, pas une
simple recoloration. Référence figée : PAPPERBOARD-CHATGPT, commit
`7a80fc3a81083f3cb8adf4dfc5e79e686e9fb5bb`.

Mesuré dans les sources le 19/10/2026 : `assets/interface.css` reprend structure,
dimensions, espacements et composants des trois feuilles de la simulation,
scopés à l’espace animateur. Les rôles de couleur de la production sont gardés.
`assets/interface-php.css` lie les contrôles PHP existants aux composants.
`tests/reference/interface.html` est le fichier autonome figé, exclu du paquet
et du déploiement. `tests/interface.js` compare les dimensions et styles calculés
à 1920×1080, 1280×720, 1024×768 et 390×844 et exerce les actions réelles.

Le PHP conserve son API, ses sessions, inscriptions, votes, publication,
modération, purge, démonstrations et exports. Les mentions de simulation et
les réponses fictives ne sont pas introduites dans les ateliers réels.
Aucune modification de config.php, de la CSP ou du stockage serveur.

Mesuré en CI le 19/10/2026 sur `e152e44` : la suite PHP, 103 contrôles de
parcours navigateur, 79 de comparaison/actions et 768 cas de galerie passent.
Le complément de fenêtres et de projection est encore en vérification en branche.
Le déploiement n’a pas encore eu lieu.

Décisions préservées au 19/10/2026 : la moutarde claire `#B18400` reste celle
validée en production. Le candidat `#8A6500` du prototype a été refusé dans
AG-007 ; il n’est pas réintroduit par ce chantier. L’aperçu participant ouvre la
vraie page PHP dans une fenêtre séparée, synchronisée par le serveur, plutôt
qu’une copie de ses données dans l’espace animateur. Sa CSP reste inchangée.

La comparaison automatisée porte sur les dimensions et styles calculés et sur
le contenu visible dans le viewport. Elle ne constitue pas une comparaison
exhaustive de toutes les captures pixel par pixel.
