<?php
// Purge planifiée : supprime les sessions sans action de l'animateur depuis
// purge_days jours, même si personne n'ouvre l'application. À lancer chaque
// heure (les traces d'IP ne tiennent pas plus de 2 h) par une tâche planifiée
// Alwaysdata : php ~/www/purge.php
// Refusé depuis le web (ligne de commande seulement).

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require __DIR__ . '/lib.php';
$count = wl_purge();
touch(wl_data_dir() . '/last-cron'); // preuve de passage, affichée dans l'onglet Réglages
echo 'WoocLight : ', $count, " session(s) supprimée(s)\n";
