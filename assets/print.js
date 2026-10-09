/* Version imprimable des résultats : bouton « Imprimer » (pas de script en
 * ligne, la CSP l'interdit). */
'use strict';
document.getElementById('print-btn').addEventListener('click', function () { window.print(); });
