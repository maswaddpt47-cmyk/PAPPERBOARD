# Intégration « Papier & Terre » (15/10/2026)

Statut : feuille et scripts écrits et affichés sur un jeu de données fictif (`test-style.html`).
Parcours réels (PHP, API, téléphone) : non testés. `bash tests/run.sh` : non lancé.

## Fichiers
- `assets/style.css` : remplace l'existant en entier. Variables `--wl-*` en tête.
- `assets/charts.js` : nouveau. À charger après `common.js` dans `screen.php` et `admin.php` (pas besoin dans `index.php`).
- `assets/common.js`, `assets/screen.js` : copies déjà modifiées (4 points ci-dessous). Reprendre dans les originaux.

## Modifications JS
common.js
1. `keep()` : `node.setAttribute('data-key', String(key));` après `is-new` (pour le glissement).
2. `cloud()` : `span.classList.toggle('cloud-top', w.n === max && words.length > 1);` (mot qui respire).
3. `renderResults()` : au début `before = WL.measure(container)` et `onScreen`; branches `yesno/truefalse` → `WL.donut`, `scale` → `WL.scaleView(container, bars(...), q, res)` (projection seulement, `.s-results`); à la fin `WL.playFlip(container, before)`.
screen.js
4. Bloc d'attente « n / N » : `WL.counter(...)` remplace le `WL.clear(...).appendChild(el('div', {class:'s-waiting'}…))`.

## Classes ajoutées
`donut`, `donut-svg`, `donut-piste`, `donut-arc`, `donut-arc-0/1`, `donut-total`, `donut-unit`, `donut-legend`, `donut-sw`, `donut-sw-0/1`, `donut-name`, `donut-count`, `is-good` (légende) · `scale-view`, `gauge`, `gauge-svg`, `gauge-track`, `gauge-fill`, `gauge-value` · `cloud-top` · `s-progress`, `s-progress-fill`, `s-msg`, `is-complete` · `dots-text`.

## Renommé ou retiré
- Keyframes : `wl-blink` (deux définitions) remplacé par `wl-respire-btn` (bouton Quitter) et `wl-bonne` (bonne réponse). Nouveaux : `wl-pose`, `wl-fade`, `wl-respire`, `wl-anneau`. Conservés : `wl-pop`, `wl-roll`.
- `.s-results .bar-good` : le triple clignotement est supprimé (cadre vert + mention « Bonne réponse », un seul passage). La règle s'applique aussi à `.live-results` côté animateur.
- `.blink` : cycle 3,6 s (était 1,2 s).
- `.bar-fill` : arrondi complet (999px) et transition 0,9 s.
- `.wall-item` : filet bas coloré (était filet gauche); `.explain`, `.s-explain` : bordure gauche conservée, fond carte.
- `.s-all` : coche ajoutée par `::before`.
- Noms d'identifiants et de classes existants : inchangés.

## Écarts avec la maquette validée (à signaler)
- « Gommette posée » (0,3 s) : non faite. Les gommettes sont recréées à chaque rafraîchissement; seule la ligne qui apparaît joue `wl-pose`.
- Nuage qui respire : continu, sans arrêt au changement de données.
- Compteur « n / N » : le chiffre est dans le texte, la barre de progression avance en 0,5 s.
- Réordonnancement : barres de sondage à ordre fixe (pas de glissement); glissement pour mur et gommettes seulement.
- Vérifier à l'œil sur le téléphone et sur la projection : mise en page de l'anneau, de la jauge et du thème clair.
