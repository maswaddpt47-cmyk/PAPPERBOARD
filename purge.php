<?php
// Purge planifiée : supprime les sessions sans action de l'animateur depuis
// purge_days jours, même si personne n'ouvre l'application. À lancer chaque
// nuit par une tâche planifiée Alwaysdata : php ~/www/purge.php
// Refusé depuis le web (ligne de commande seulement).

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require __DIR__ . '/lib.php';
echo 'WoocLight : ', wl_purge(), " session(s) supprimée(s)\n";
