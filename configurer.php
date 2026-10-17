<?php
// Configuration guidée, en une commande sur le serveur : php ~/www/configurer.php
// Pose les questions (mot de passe masqué), crée config.php à partir de
// config.sample.php, génère le secret et le dossier des données, puis vérifie.
// Ligne de commande seulement : refusé depuis le web (et par .htaccess).

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$dir = __DIR__;
$file = "$dir/config.php";
$old = is_file($file) ? (require $file) : [];
$old = is_array($old) ? $old : [];
$home = rtrim((string)getenv('HOME'), '/') ?: dirname($dir);

/** Lit une ligne ; $hidden masque la saisie (mot de passe). */
function ask(string $question, bool $hidden = false): string
{
    echo $question;
    $tty = stream_isatty(STDIN);
    if ($hidden && $tty) {
        shell_exec('stty -echo');
    }
    $line = fgets(STDIN);
    if ($hidden && $tty) {
        shell_exec('stty echo');
        echo "\n";
    }
    return trim((string)$line);
}

// Adresse publique par défaut : <compte>.alwaysdata.net + sous-dossier éventuel de www/.
$sub = preg_match('#/www(/.*)?$#', $dir, $m) ? ($m[1] ?? '') : '';
$defaultUrl = 'https://' . basename($home) . '.alwaysdata.net' . $sub;

echo "=== Configuration de WoocLight ===\n";
$hash = (string)($old['admin_hash'] ?? '');
if ($hash === '' || strtolower(ask("Un mot de passe existe déjà. Le changer ? (o/N) ")) === 'o') {
    do {
        $p1 = ask('Mot de passe animateur (12 caractères au moins, ne s\'affiche pas) : ', true);
        $p2 = ask('Le retaper : ', true);
        $ok = $p1 === $p2 && strlen($p1) >= 12;
        if (!$ok) {
            echo "Les deux saisies diffèrent ou le mot de passe est trop court. Recommencez.\n";
        }
    } while (!$ok);
    $hash = password_hash($p1, PASSWORD_DEFAULT);
    unset($p1, $p2);
}
$defaultUrl = (string)($old['base_url'] ?? '') !== '' ? (string)$old['base_url'] : $defaultUrl;
$url = ask("Adresse publique [Entrée = $defaultUrl] : ") ?: $defaultUrl;
$resp = ask('Responsable affiché aux participants [Entrée = ' . (($old['responsable'] ?? '') ?: 'formule générique') . '] : ')
    ?: (string)($old['responsable'] ?? '');
$contact = ask('Adresse de contact affichée [Entrée = ' . (($old['contact'] ?? '') ?: 'formule générique') . '] : ')
    ?: (string)($old['contact'] ?? '');

$values = [
    'admin_hash' => $hash,
    'secret' => strlen((string)($old['secret'] ?? '')) >= 32 ? $old['secret'] : bin2hex(random_bytes(32)),
    'data_dir' => (string)($old['data_dir'] ?? '') !== '' && !str_contains((string)$old['data_dir'], 'COMPTE')
        ? $old['data_dir'] : "$home/wooclight-data",
    'base_url' => rtrim($url, '/'),
    'responsable' => $resp,
    'contact' => $contact,
];
// Les autres réglages déjà personnalisés (durée de purge, quotas, mots interdits…) survivent à la relance.
foreach (array_diff_key($old, $values) as $key => $value) {
    if (is_scalar($value) || is_array($value)) {
        $values[$key] = $value;
    }
}
if (!is_dir($values['data_dir'])) {
    mkdir($values['data_dir'], 0700, true);
}

// Réécrit les lignes concernées du modèle, en gardant ses commentaires.
$text = (string)file_get_contents("$dir/config.sample.php");
foreach ($values as $key => $value) {
    $text = preg_replace_callback("/^(\\s*'$key' => ).*?,/m",
        fn($m) => $m[1] . var_export($value, true) . ',', $text, 1);
}
umask(077);
file_put_contents($file, $text);
chmod($file, 0600);

$check = require $file;
$good = is_array($check) && strlen($check['admin_hash']) >= 60 && strlen($check['secret']) >= 32
    && is_dir($check['data_dir']) && $check['base_url'] !== '';
echo $good ? "CONFIG OK — ouvrez {$values['base_url']}/admin.php\n" : "PROBLEME : config.php incomplet, relancez la commande.\n";
exit($good ? 0 : 1);
