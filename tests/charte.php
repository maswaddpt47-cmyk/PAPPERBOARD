<?php
// Contrôles statiques de la charte graphique : aucune dépendance réseau, aucune couleur écrite
// hors des blocs de jetons, tous les jetons définis, palette de base validée le 18/10/2026.
// Sans serveur ni navigateur.

declare(strict_types=1);

require __DIR__ . '/http.php';

$root = dirname(__DIR__);
$css = (string)file_get_contents("$root/assets/style.css");

// 1. Aucune adresse externe dans nos fichiers (l'espace de noms XML des SVG est la seule exception).
$own = array_merge(
    glob("$root/assets/{common,charts,app,admin,screen,seances,bilan-pptx,print}.js", GLOB_BRACE) ?: [],
    ["$root/assets/style.css"],
    glob("$root/docs/galerie-resultats/*") ?: []
);
$ext = [];
foreach ($own as $f) {
    $t = (string)file_get_contents($f);
    if (preg_match_all('~https?://[^\s"\'<>)]+~', $t, $m)) {
        foreach ($m[0] as $u) {
            if ($u !== 'http://www.w3.org/2000/svg') $ext[] = basename($f) . ' : ' . $u;
        }
    }
}
check(!$ext, 'aucune adresse externe dans les scripts, la feuille et la galerie' . ($ext ? ' : ' . implode(' | ', array_slice($ext, 0, 3)) : ''));
$pages = [];
foreach (['index.php', 'admin.php', 'screen.php'] as $p) {
    if (preg_match('~(?:src|href)="https?://~', (string)file_get_contents("$root/$p"))) $pages[] = $p;
}
check(!$pages, 'aucune ressource externe chargée par les pages' . ($pages ? ' : ' . implode(', ', $pages) : ''));

// 2. Couleurs : seulement dans :root et dans le thème sombre de la projection.
function block(string $css, string $sel): string
{
    $i = strpos($css, $sel . ' {');
    if ($i === false) return '';
    $j = strpos($css, "\n}", $i);
    return substr($css, $i, $j - $i + 2);
}
$root_b = block($css, ':root');
$dark_b = block($css, '[data-theme="dark"] .screen');
check($root_b !== '' && $dark_b !== '', 'blocs de jetons :root et projection sombre présents');
$rest = str_replace([$root_b, $dark_b], '', $css);
$rest = preg_replace('~/\*.*?\*/~s', '', $rest);
preg_match_all('~#[0-9A-Fa-f]{3,8}\b|rgba?\(~', $rest, $m);
check(!$m[0], 'aucune couleur écrite hors des blocs de jetons (' . count($m[0]) . ' trouvée(s))');

// 3. Tous les jetons utilisés sont définis.
preg_match_all('~(--wl-[a-z0-9-]+)\s*:~', $css, $d);
preg_match_all('~var\((--wl-[a-z0-9-]+)~', $css, $u);
$undef = array_diff(array_unique($u[1]), array_unique($d[1]));
check(!$undef, 'jetons utilisés et définis' . ($undef ? ' : manquent ' . implode(', ', $undef) : ''));

// 4. Palette de base validée le 18/10/2026.
$base = ['--wl-c-ivoire' => '#F7F0E4', '--wl-c-carte' => '#FFFDF8', '--wl-c-brun' => '#28221E', '--wl-c-terracotta' => '#B74322',
    '--wl-c-petrole' => '#10383C', '--wl-c-vert' => '#3D7D3D', '--wl-c-prune' => '#943D78'];
foreach ($base as $k => $v) check(str_contains($root_b, "$k: $v"), "palette de base : $k = $v");
check(str_contains($root_b, '--wl-c-moutarde: #C99600'), 'palette de base : --wl-c-moutarde = #C99600');

// 5. Contrastes WCAG des couples essentiels, calculés sur les jetons réels.
function lum(string $h): float
{
    $h = ltrim($h, '#');
    $c = array_map(fn($i) => hexdec(substr($h, $i, 2)) / 255, [0, 2, 4]);
    $c = array_map(fn($x) => $x <= 0.03928 ? $x / 12.92 : (($x + 0.055) / 1.055) ** 2.4, $c);
    return 0.2126 * $c[0] + 0.7152 * $c[1] + 0.0722 * $c[2];
}
function ratio(string $a, string $b): float
{
    [$x, $y] = [lum($a), lum($b)];
    if ($x < $y) [$x, $y] = [$y, $x];
    return ($x + 0.05) / ($y + 0.05);
}
function tokens(string $b): array
{
    preg_match_all('~(--wl-[a-z0-9-]+):\s*([^;]+);~', $b, $m);
    return array_combine($m[1], array_map('trim', $m[2]));
}
function resolve(array $t, string $k): string
{
    $v = $t[$k] ?? '';
    while (preg_match('~^var\((--[a-z0-9-]+)\)$~', $v, $x)) $v = $t[$x[1]] ?? '';
    return $v;
}
$light = tokens($root_b);
$dark = array_merge($light, tokens($dark_b));
$pairs = [
    ['texte', 'fond', 4.5], ['texte', 'carte', 4.5], ['texte-doux', 'fond', 4.5], ['texte-doux', 'carte', 4.5],
    ['primaire', 'fond', 4.5], ['ok', 'fond', 4.5], ['ko', 'fond', 4.5], ['accent', 'fond', 4.5],
    ['sur-primaire', 'primaire', 4.5], ['focus', 'fond', 3], ['champ', 'carte', 3],
    ['b1', 'carte', 3], ['b2', 'carte', 3], ['b3', 'carte', 3], ['b4', 'carte', 3], ['b5', 'carte', 3], ['b6', 'carte', 3], ['b7', 'carte', 3],
];
foreach (['clair' => $light, 'projection sombre' => $dark] as $nom => $t) {
    $bad = [];
    foreach ($pairs as [$a, $b, $min]) {
        $r = ratio(resolve($t, "--wl-$a"), resolve($t, "--wl-$b"));
        if ($r < $min) $bad[] = sprintf('%s/%s %.2f<%s', $a, $b, $r, $min);
    }
    check(!$bad, "contrastes essentiels, thème $nom" . ($bad ? ' : ' . implode(', ', $bad) : ''));
}

finish('charte');
