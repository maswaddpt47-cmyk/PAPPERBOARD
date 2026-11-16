<?php
// configurer.php : réponses envoyées sur l'entrée standard, dans un faux
// compte (HOME temporaire, appli copiée dans www/).

declare(strict_types=1);

require __DIR__ . '/http.php';

$root = dirname(__DIR__);
$home = sys_get_temp_dir() . '/wlcompte-' . bin2hex(random_bytes(3)) . '/wooclight';
mkdir("$home/www", 0700, true);
copy("$root/configurer.php", "$home/www/configurer.php");
copy("$root/config.sample.php", "$home/www/config.sample.php");

$run = function (string $answers) use ($home): array {
    $cmd = 'cd ' . escapeshellarg("$home/www") . ' && HOME=' . escapeshellarg($home) . ' php configurer.php';
    $p = proc_open($cmd, [['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']], $pipes);
    fwrite($pipes[0], $answers);
    fclose($pipes[0]);
    $out = stream_get_contents($pipes[1]);
    return [proc_close($p), $out];
};

// Saisies différentes, puis mot de passe valable ; Entrée pour l'adresse.
[$rc, $out] = $run("un-premier-essai\nautre-chose-xxx\nmot-de-passe-solide\nmot-de-passe-solide\n\n\nAsso Test\nasso@example.org\n");
check($rc === 0 && str_contains($out, 'CONFIG OK'), 'configuration guidée : CONFIG OK');
check(str_contains($out, 'diffèrent'), 'saisies différentes redemandées');
$cfg = require "$home/www/config.php";
check(password_verify('mot-de-passe-solide', $cfg['admin_hash']), 'hash du bon mot de passe');
check(strlen($cfg['secret']) === 64 && is_dir("$home/wooclight-data"), 'secret généré et dossier des données créé');
check($cfg['base_url'] === 'https://wooclight.alwaysdata.net', 'adresse déduite du compte');
check($cfg['short_url'] === '', 'adresse courte : aucune par défaut');
check($cfg['responsable'] === 'Asso Test' && $cfg['contact'] === 'asso@example.org', 'mentions de confidentialité');
check(str_contains(file_get_contents("$home/www/config.php"), '// intervalle de rafraîchissement'), 'commentaires du modèle conservés');
check((fileperms("$home/www/config.php") & 0777) === 0600, 'config.php en 600');

// Relance sans changer le mot de passe : hash et secret conservés.
$secret = $cfg['secret'];
$custom = str_replace(["'purge_days' => 30,", "'banned_words' => [],", "'rate_join' => 60,"],
    ["'purge_days' => 7,", "'banned_words' => ['zut', 'flûte'],", "'rate_join' => 5,"], file_get_contents("$home/www/config.php"));
file_put_contents("$home/www/config.php", str_replace("'base_url' => 'https://wooclight.alwaysdata.net',", "'base_url' => 'https://exemple.org/wl',", $custom));
[$rc] = $run("n\n\nrepondsici.fr/\n\n\n");
$cfg2 = require "$home/www/config.php";
check($rc === 0 && $cfg2['admin_hash'] === $cfg['admin_hash'] && $cfg2['secret'] === $secret && $cfg2['responsable'] === 'Asso Test', 'relance : rien de perdu');
check($cfg2['purge_days'] === 7 && $cfg2['rate_join'] === 5 && $cfg2['banned_words'] === ['zut', 'flûte'] && $cfg2['base_url'] === 'https://exemple.org/wl',
    'relance : durée de purge, quotas, mots interdits et adresse personnalisés conservés');
check($cfg2['short_url'] === 'https://repondsici.fr', 'adresse courte : https ajouté, / final retiré');
[$rc] = $run("n\n\n\n\n\n");
check($rc === 0 && (require "$home/www/config.php")['short_url'] === 'https://repondsici.fr', 'relance : adresse courte gardée');
$shown = shell_exec('WOOCLIGHT_CONFIG=' . escapeshellarg("$home/www/config.php") . ' php -r ' . escapeshellarg('require "' . dirname(__DIR__) . '/lib.php"; echo wl_short_url("K7M3P"), "|", wl_join_url("K7M3P");'));
check($shown === 'https://repondsici.fr/K7M3P|https://exemple.org/wl/?s=K7M3P', 'projection : adresse courte du domaine court, QR sur l\'adresse publique');
[$rc] = $run("n\n\n-\n\n\n");
check($rc === 0 && (require "$home/www/config.php")['short_url'] === '', 'adresse courte retirée par « - »');

exec('rm -rf ' . escapeshellarg(dirname($home)));
finish('configurer');
