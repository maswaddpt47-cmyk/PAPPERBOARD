<?php
// DATA_DIR laissé vide : le dossier data/ de l'application doit être créé
// fermé (.htaccess « Require all denied » + index.php vide). Le refus réel
// par Apache est vérifié après chaque déploiement (deploy.yml).

declare(strict_types=1);

require __DIR__ . '/http.php';

$root = dirname(__DIR__);
if (is_dir("$root/data")) {
    fwrite(STDERR, "data/ existe déjà dans le dépôt : test ignoré pour ne rien effacer.\n");
    exit(0);
}
$cfg = tempnam(sys_get_temp_dir(), 'wlcfg');
file_put_contents($cfg, '<?php return ' . var_export(['admin_hash' => 'x', 'secret' => str_repeat('a', 64), 'data_dir' => ''], true) . ';');
$cmd = 'WOOCLIGHT_CONFIG=' . escapeshellarg($cfg) . ' php -r ' . escapeshellarg('require "lib.php"; wl_data_dir();');
exec('cd ' . escapeshellarg($root) . ' && ' . $cmd, $out, $rc);
check($rc === 0, 'création de data/');
check(trim((string)@file_get_contents("$root/data/.htaccess")) === 'Require all denied', 'data/.htaccess ferme le dossier');
check(trim((string)@file_get_contents("$root/data/index.php")) === '<?php', 'data/index.php vide');
check(is_dir("$root/data/sessions") && (fileperms("$root/data") & 0777) === 0700, 'droits 700');
exec('rm -rf ' . escapeshellarg("$root/data"));
@unlink($cfg);
$ht = file_get_contents("$root/.htaccess");
check(str_contains($ht, 'data|') && str_contains($ht, 'config\.php'), '.htaccess racine : data/ et config.php refusés');

finish('protect');
