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

Statut au 19/10/2026 : code en branche ; tests de rendu et déploiement à vérifier.
