<?php
// Archive avant suppression : si l'archive échoue, la session reste ; la
// relecture sous verrou voit ce qui s'est passé depuis la lecture de l'appelant.

declare(strict_types=1);

$tmp = sys_get_temp_dir() . '/wlarch-' . bin2hex(random_bytes(3));
mkdir($tmp);
file_put_contents("$tmp/config.php", '<?php return ["admin_hash" => "x", "secret" => "' . str_repeat('a', 40) . '", "data_dir" => "' . $tmp . '/data"];');
putenv("WOOCLIGHT_CONFIG=$tmp/config.php");
require dirname(__DIR__) . '/lib.php';
require __DIR__ . '/http.php';

$s = wl_create_session('Atelier', [wl_clean_question(['type' => 'poll', 'text' => 'Q ?', 'options' => ['A', 'B']])]);
$code = $s['code'];
$file = wl_session_file($code);

// Titre en UTF-8 invalide : json_encode échoue, l'ancien code écrivait une archive vide puis supprimait.
$bad = false;
try {
    wl_delete_session($code, null, function (array $s) { wl_archive_session(['title' => "\xff"] + $s); });
} catch (WlError) {
    $bad = true;
}
check($bad && is_file($file), 'archive impossible : erreur levée et session conservée');
check(glob("$tmp/data/archives/*") === [], 'archive impossible : aucun fichier d\'archive laissé');

$id = '';
check(wl_delete_session($code, null, function (array $s) use (&$id) { $id = wl_archive_session($s); }) && !is_file($file), 'archive réussie : session supprimée');
$a = json_decode((string)file_get_contents(wl_archive_file($id)), true);
check(is_array($a) && $a['title'] === 'Atelier' && count($a['questions']) === 1, 'archive lisible et complète');

// Purge d'une session échue dont l'archive ne peut pas s'écrire : session gardée, échec signalé.
$s2 = wl_create_session('Échue', [wl_clean_question(['type' => 'poll', 'text' => 'Q ?', 'options' => ['A', 'B']])]);
$f2 = wl_session_file($s2['code']);
$j2 = json_decode((string)file_get_contents($f2), true);
$j2['activity'] = time() - 400 * 86400;
file_put_contents($f2, json_encode($j2));
exec('rm -rf ' . escapeshellarg("$tmp/data/archives"));
file_put_contents("$tmp/data/archives", 'un fichier à la place du dossier'); // écriture d'archive impossible
wl_purge();
clearstatcache();
check(is_file($f2) && wl_purge_failures() === 1, 'purge : archive impossible, session échue gardée et échec compté (Réglages)');
unlink("$tmp/data/archives");
mkdir("$tmp/data/archives");
wl_purge();
clearstatcache();
check(!is_file($f2) && wl_purge_failures() === 0, 'purge : archive de nouveau possible, session archivée et alerte retirée');

exec('rm -rf ' . escapeshellarg($tmp));
finish('archivage');
