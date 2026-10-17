<?php
// Bibliothèque commune : configuration, stockage JSON, validation, sécurité.
// Inclus par index.php, admin.php, screen.php et api.php ; jamais appelé seul.

declare(strict_types=1);

const WL_TYPES = ['yesno', 'truefalse', 'mcq', 'poll', 'wordcloud', 'text', 'scale', 'points', 'wall', 'postit', 'dots', 'steps'];
const WL_WRITTEN_TYPES = ['text', 'wall', 'postit']; // texte libre : relu avant d'être montré, jamais en affichage automatique
const WL_COMPARE_TYPES = ['yesno', 'truefalse', 'mcq', 'scale']; // avant / après : une valeur chiffrée par passage
const WL_POST_TYPES = ['wall', 'postit']; // contributions multiples (posts), pas une réponse unique
// Résultats projetés en direct (sans « Afficher ») : ni correction à dévoiler,
// ni texte libre à relire avant projection (choix de l'utilisateur, 14/10/2026).
const WL_LIVE_TYPES = ['poll', 'wordcloud', 'scale', 'points', 'steps'];
const WL_MAX_COLUMNS = 6;
const WL_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sans 0/O, 1/I/L
const WL_MAX_OPTIONS = 10;
const WL_MAX_QUESTIONS = 50;

/** Erreur destinée à l'utilisateur : message en français + statut HTTP. */
final class WlError extends Exception
{
    public function __construct(string $message, public readonly int $status = 400)
    {
        parent::__construct($message);
    }
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Lit config.php une fois. WOOCLIGHT_CONFIG ne sert qu'aux tests (variable
 *  d'environnement du processus, inaccessible à un visiteur). */
function wl_config(): array
{
    static $cfg = null;
    if ($cfg !== null) {
        return $cfg;
    }
    $file = getenv('WOOCLIGHT_CONFIG') ?: __DIR__ . '/config.php';
    $user = is_file($file) ? require $file : null;
    if (!is_array($user) || empty($user['admin_hash']) || strlen((string)($user['secret'] ?? '')) < 32) {
        http_response_code(503);
        header('Content-Type: text/plain; charset=utf-8');
        exit("WoocLight n'est pas encore configuré : créer config.php à partir de config.sample.php (voir README).\n");
    }
    $defaults = [
        'data_dir' => '', 'base_url' => '', 'poll_ms' => 2000, 'max_participants' => 150,
        'purge_days' => 30, 'max_text' => 80, 'max_posts' => 5, 'rate_ip' => 900, 'rate_token' => 30,
        'rate_join' => 60, 'responsable' => '', 'contact' => '', 'base_legale' => '',
        'banned_words' => [],
    ];
    $cfg = array_merge($defaults, $user);
    return $cfg;
}

/** Dossier des données, créé au premier appel. S'il est dans la racine web,
 *  il est fermé par .htaccess + index.php vide. */
function wl_data_dir(): string
{
    static $dir = null;
    if ($dir !== null) {
        return $dir;
    }
    $dir = rtrim((string)wl_config()['data_dir'], '/') ?: __DIR__ . '/data';
    foreach (['', '/sessions', '/rl', '/archives'] as $sub) {
        if (!is_dir($dir . $sub) && !mkdir($dir . $sub, 0700, true) && !is_dir($dir . $sub)) {
            throw new WlError('Stockage indisponible.', 500);
        }
    }
    if (str_starts_with(realpath($dir) ?: $dir, __DIR__)) {
        wl_protect_dir($dir);
    }
    return $dir;
}

function wl_protect_dir(string $dir): void
{
    if (!is_file("$dir/.htaccess")) {
        file_put_contents("$dir/.htaccess", "Require all denied\n");
    }
    if (!is_file("$dir/index.php")) {
        file_put_contents("$dir/index.php", "<?php\n");
    }
}

// ---------------------------------------------------------------------------
// En-têtes et réponses
// ---------------------------------------------------------------------------

function wl_https(): bool
{
    return ($_SERVER['HTTPS'] ?? '') === 'on' || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
}

/** En-têtes de sécurité communs à toutes les réponses. CSP stricte : aucun
 *  script ni style en ligne, aucune ressource externe. */
function wl_security_headers(): void
{
    header("Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; "
        . "img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    header('X-Frame-Options: DENY');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    header('Cross-Origin-Opener-Policy: same-origin');
    if (wl_https()) {
        header('Strict-Transport-Security: max-age=31536000');
    }
}

function wl_json(array $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** Réponse conditionnelle : 304 sans corps si le client a déjà cette version. */
function wl_json_etag(string $etag, callable $build): never
{
    $etag = '"' . $etag . '"';
    header('ETag: ' . $etag);
    if (trim($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) {
        http_response_code(304);
        header('Cache-Control: no-store');
        exit;
    }
    wl_json($build());
}

function wl_h(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Chemin de l'application sur le serveur (ex. /wooclight), sans / final. */
function wl_base_path(): string
{
    return rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
}

/** Chemin d'une ressource de assets/ avec sa date de modification : après un
 *  déploiement, le navigateur recharge le fichier au lieu de garder l'ancien. */
function wl_asset(string $file): string
{
    return 'assets/' . $file . '?v=' . (int)@filemtime(__DIR__ . '/assets/' . $file);
}

/** URL publique de l'application (sans / final). */
function wl_base_url(): string
{
    $base = trim((string)wl_config()['base_url']);
    if ($base !== '') {
        return rtrim($base, '/');
    }
    $host = preg_replace('/[^A-Za-z0-9.:\-\[\]]/', '', $_SERVER['HTTP_HOST'] ?? 'localhost');
    return (wl_https() ? 'https' : 'http') . '://' . $host . wl_base_path();
}

// ---------------------------------------------------------------------------
// Hachage, jetons, limites de taux
// ---------------------------------------------------------------------------

/** HMAC tronqué : IP et jetons ne sont jamais stockés en clair. */
function wl_hash(string $value, int $len = 32): string
{
    return substr(hash_hmac('sha256', $value, (string)wl_config()['secret']), 0, $len);
}

function wl_ip_hash(): string
{
    return wl_hash('ip|' . ($_SERVER['REMOTE_ADDR'] ?? ''));
}

const WL_TOKEN_TTL = 86400; // un jeton participant vaut une journée, vérifié par le serveur

/** Jeton participant : aléa + date d'émission + signature (non falsifiable). */
function wl_new_token(): string
{
    $body = bin2hex(random_bytes(16)) . '.' . time();
    return $body . '.' . wl_hash('tok|' . $body, 16);
}

/** Jeton bien formé, signé par ce serveur et émis il y a moins d'une journée. */
function wl_valid_token(?string $t): bool
{
    if (!is_string($t) || !preg_match('/^([a-f0-9]{32}\.(\d{10}))\.([a-f0-9]{16})$/', $t, $m)) {
        return false;
    }
    return hash_equals(wl_hash('tok|' . $m[1], 16), $m[3]) && (int)$m[2] > time() - WL_TOKEN_TTL;
}

/** Compte les écritures par fenêtre d'une minute ; WlError 429 au-delà. */
function wl_rate(string $bucket, int $limit): void
{
    $key = wl_hash('rl|' . $bucket, 24);
    $file = wl_data_dir() . '/rl/' . $key . '.json';
    // 16 verrous fixes, jamais supprimés : la purge peut effacer un compteur
    // ancien sans retirer un verrou qu'un autre processus tient ouvert.
    $lock = wl_data_dir() . '/rl/shard-' . $key[0] . '.lock';
    $window = intdiv(time(), 60);
    wl_locked_json($file, function (array &$d) use ($window, $limit) {
        if (($d['w'] ?? 0) !== $window) {
            $d = ['w' => $window, 'n' => 0];
        }
        if (++$d['n'] > $limit) {
            throw new WlError('Trop de requêtes, patientez quelques secondes.', 429);
        }
    }, false, $lock);
}

// ---------------------------------------------------------------------------
// Stockage JSON : verrou + écriture atomique
// ---------------------------------------------------------------------------

/** Lit un JSON, le passe à $fn par référence sous verrou exclusif, et
 *  l'écrit atomiquement (fichier temporaire + rename). Retourne ce que
 *  renvoie $fn. Une exception dans $fn annule l'écriture. */
function wl_locked_json(string $file, callable $fn, bool $mustExist = false, ?string $lockFile = null): mixed
{
    if ($mustExist && !is_file($file)) {
        // Avant d'ouvrir le verrou : fopen('c') créerait un fichier par code inventé.
        throw new WlError('Session introuvable ou expirée.', 404);
    }
    $lock = fopen($lockFile ?? $file . '.lock', 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        throw new WlError('Stockage indisponible.', 500);
    }
    try {
        $exists = is_file($file);
        if ($mustExist && !$exists) {
            throw new WlError('Session introuvable ou expirée.', 404);
        }
        $data = $exists ? json_decode((string)file_get_contents($file), true) : [];
        if (!is_array($data)) {
            throw new WlError('Données illisibles.', 500);
        }
        $result = $fn($data);
        wl_write_atomic($file, $data);
        return $result;
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

function wl_write_atomic(string $file, array $data): void
{
    $tmp = $file . '.' . bin2hex(random_bytes(4)) . '.tmp';
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false || file_put_contents($tmp, $json) !== strlen($json) || !rename($tmp, $file)) {
        @unlink($tmp);
        throw new WlError('Écriture impossible.', 500);
    }
}

// ---------------------------------------------------------------------------
// Sessions d'atelier
// ---------------------------------------------------------------------------

function wl_valid_code(?string $code): bool
{
    return is_string($code) && preg_match('/^[' . WL_CODE_CHARS . ']{5}$/', $code) === 1;
}

/** Normalise un code saisi à la main (minuscules, espaces, O→0 impossible). */
function wl_clean_code(mixed $code): string
{
    $code = strtoupper(preg_replace('/\s+/', '', (string)$code));
    if (!wl_valid_code($code)) {
        throw new WlError('Code inconnu. Vérifiez les 5 caractères affichés à l\'écran.', 404);
    }
    return $code;
}

function wl_session_file(string $code): string
{
    return wl_data_dir() . '/sessions/' . $code . '.json';
}

/** Lecture sans verrou : sûre car l'écriture se fait par rename atomique. */
function wl_load(string $code): ?array
{
    $file = wl_session_file($code);
    $data = is_file($file) ? json_decode((string)file_get_contents($file), true) : null;
    return is_array($data) ? $data : null;
}

function wl_load_or_fail(string $code): array
{
    return wl_load($code) ?? throw new WlError('Code inconnu ou session expirée.', 404);
}

/** Modifie une session sous verrou. $public : la modification change ce que
 *  voit le participant (sinon seul l'écran de projection est rafraîchi).
 *  $admin : seule l'activité de l'animateur repousse la purge — un
 *  participant ne peut pas prolonger la conservation des réponses. */
function wl_update(string $code, callable $fn, bool $public = true, bool $admin = true): mixed
{
    $file = wl_session_file($code);
    if (!is_file($file)) {
        // Pas de fichier de verrou créé pour un code qui n'existe pas.
        throw new WlError('Session introuvable ou expirée.', 404);
    }
    return wl_locked_json($file, function (array &$s) use ($fn, $public, $admin) {
        $result = $fn($s);
        $s['version'] = ($s['version'] ?? 0) + 1;
        if ($public) {
            $s['pversion'] = ($s['pversion'] ?? 0) + 1;
        }
        $s['updated'] = time();
        if ($admin) {
            $s['activity'] = time();
        }
        return $result;
    }, true);
}

function wl_new_code(): string
{
    for ($i = 0; $i < 50; $i++) {
        $code = '';
        for ($j = 0; $j < 5; $j++) {
            $code .= WL_CODE_CHARS[random_int(0, strlen(WL_CODE_CHARS) - 1)];
        }
        if (!is_file(wl_session_file($code))) {
            return $code;
        }
    }
    throw new WlError('Impossible de générer un code.', 500);
}

function wl_create_session(string $title, array $questions = []): array
{
    // Réservation exclusive : deux créations simultanées ne prennent pas le même code.
    for ($try = 0; ($reserved = @fopen(wl_session_file($code = wl_new_code()), 'x')) === false; $try++) {
        if ($try >= 5) {
            throw new WlError('Impossible de créer la session.', 500);
        }
    }
    fclose($reserved);
    $now = time();
    $s = [
        'code' => $code, 'title' => $title, 'created' => $now, 'updated' => $now,
        // current = -1 : écran d'accueil (adresse et code projetés en grand).
        'version' => 1, 'pversion' => 1, 'current' => -1, 'ended' => false, 'locked' => false,
        'activity' => $now,
        'participants' => [], 'questions' => $questions,
    ];
    wl_write_atomic(wl_session_file($code), $s);
    return $s;
}

function wl_list_sessions(): array
{
    $list = [];
    foreach (glob(wl_data_dir() . '/sessions/*.json') ?: [] as $file) {
        $s = json_decode((string)file_get_contents($file), true);
        if (is_array($s)) {
            $list[] = [
                'code' => $s['code'], 'title' => $s['title'], 'updated' => $s['updated'],
                'questions' => count($s['questions']), 'participants' => count($s['participants']),
                'ended' => $s['ended'], 'demo' => !empty($s['demo']),
            ];
        }
    }
    usort($list, fn($a, $b) => $b['updated'] <=> $a['updated']);
    return $list;
}

/** Suppression sous le même verrou que les écritures : une écriture en
 *  cours ne peut pas recréer la session après coup (elle trouve le fichier
 *  absent et s'arrête). Le verrou reste ; la purge retire les verrous orphelins. */
function wl_delete_session(string $code, ?int $expiredBefore = null, ?callable $archive = null): bool
{
    $file = wl_session_file($code);
    if (!is_file($file)) {
        return false;
    }
    $lock = fopen($file . '.lock', 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        throw new WlError('Stockage indisponible.', 500);
    }
    try {
        // Relire sous verrou : l'animateur ou un participant a pu agir depuis la lecture de l'appelant.
        $s = json_decode((string)@file_get_contents($file), true);
        if ($expiredBefore !== null && is_array($s) && wl_retention_start($s) >= $expiredBefore) {
            return false;
        }
        if ($archive !== null && is_array($s)) {
            $archive($s); // lève une erreur : la session est alors conservée
        }
        return @unlink($file);
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

/** Date qui fait foi pour la purge : dernière action de l'animateur. */
function wl_retention_start(array $s): int
{
    return (int)($s['activity'] ?? $s['created'] ?? 0);
}

/** Purge au fil des requêtes, au plus une fois par heure. Complétée par
 *  purge.php, lancé chaque heure par une tâche planifiée, pour que la durée
 *  soit tenue même sans visite. */
function wl_maybe_purge(): int
{
    $marker = wl_data_dir() . '/last-purge';
    if (is_file($marker) && filemtime($marker) > time() - 3600) {
        return 0;
    }
    touch($marker);
    return wl_purge();
}

/** Archive anonyme d'une session : questions, explications, résultats
 *  regroupés (nombres, pourcentages, moyenne), récap, conclusion et synthèse.
 *  Rien qui vienne d'un participant pris à part : ni jeton, ni réponse une à
 *  une, ni texte écrit (réponses libres, nuage, mur, post-it), ni IP. Ces
 *  données ne sont plus personnelles : l'archive se garde sans limite. */
function wl_archive_session(array $s): string
{
    $questions = array_map(function ($q) use ($s) {
        $r = wl_results($q, false, $s);
        $kept = ['total' => $r['total']] + array_intersect_key($r, array_flip(['counts', 'average', 'compare']));
        if ($q['type'] === 'postit') {
            $kept['columns'] = $q['options'];
        }
        return array_intersect_key($q, array_flip(['type', 'text', 'options', 'multi', 'correct', 'scaleMax', 'budget', 'explain']))
            + ['results' => $kept];
    }, $s['questions']);
    $id = gmdate('Ymd', $s['created'] ?? time()) . '-' . bin2hex(random_bytes(4));
    $archive = [
        'id' => $id, 'title' => $s['title'], 'created' => $s['created'] ?? null, 'archived' => time(),
        'participants' => count($s['participants']), 'questions' => $questions,
        'recap' => wl_recap($s, true), 'conclusion' => $s['conclusion'] ?? '', 'synthesis' => $s['synthesis'] ?? '',
    ];
    $file = wl_data_dir() . '/archives/' . $id . '.json';
    $tmp = $file . '.tmp';
    // L'appelant supprime la session ensuite : une archive absente, tronquée ou vide doit tout arrêter.
    $json = json_encode($archive, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if ($json === false || @file_put_contents($tmp, $json) !== strlen($json) || !@rename($tmp, $file)) {
        @unlink($tmp);
        throw new WlError('Archivage impossible : la session est conservée.', 500);
    }
    return $id;
}

function wl_archive_file(string $id): string
{
    if (!preg_match('/^\d{8}-[0-9a-f]{8}$/', $id)) {
        throw new WlError('Archive introuvable.', 404);
    }
    return wl_data_dir() . '/archives/' . $id . '.json';
}

function wl_list_archives(): array
{
    $list = [];
    foreach (glob(wl_data_dir() . '/archives/*.json') ?: [] as $file) {
        $a = json_decode((string)file_get_contents($file), true);
        if (is_array($a)) {
            $list[] = ['id' => $a['id'], 'title' => $a['title'], 'created' => $a['created'], 'archived' => $a['archived'],
                'questions' => count($a['questions']), 'participants' => $a['participants']];
        }
    }
    usort($list, fn($a, $b) => $b['archived'] <=> $a['archived']);
    return $list;
}

/** Supprime les sessions sans action de l'animateur depuis purge_days jours.
 *  Durée fixée par le responsable de traitement (config.php). */
function wl_purge(): int
{
    $limit = time() - 86400 * max(1, (int)wl_config()['purge_days']);
    $count = 0;
    foreach (glob(wl_data_dir() . '/sessions/*.json') ?: [] as $file) {
        $s = json_decode((string)file_get_contents($file), true);
        if (!is_array($s) || wl_retention_start($s) < $limit) {
            // Archive anonyme d'abord (résultats regroupés), puis suppression du détail, sous le même verrou.
            // Une démo (participants fictifs) n'est jamais archivée : elle fausserait les bilans.
            try {
                $archive = function (array $s) {
                    if (!empty($s['questions']) && empty($s['demo'])) {
                        wl_archive_session($s);
                    }
                };
                if (wl_delete_session(basename($file, '.json'), $limit, $archive)) {
                    $count++;
                }
            } catch (WlError) {
                // Archive impossible : la session reste, nouvel essai à la prochaine purge.
            }
        }
    }
    foreach (glob(wl_data_dir() . '/sessions/*.lock') ?: [] as $lock) {
        if (!is_file(substr($lock, 0, -5)) && filemtime($lock) < time() - 3600) {
            @unlink($lock); // verrou d'une session supprimée depuis plus d'une heure
        }
    }
    $login = wl_data_dir() . '/login.json';
    if (is_file($login) && filemtime($login) < time() - 900) {
        @unlink($login); // échecs de connexion : utiles 15 minutes seulement
    }
    foreach (glob(wl_data_dir() . '/rl/*.json') ?: [] as $file) {
        if (filemtime($file) < time() - 3600) {
            @unlink($file); // compteurs seulement ; les verrous shard-*.lock restent
        }
    }
    return $count;
}

// ---------------------------------------------------------------------------
// Texte : nettoyage, comparaison sans casse ni accents
// ---------------------------------------------------------------------------

/** Supprime les caractères de contrôle et réduit les espaces. */
function wl_clean_text(mixed $text): string
{
    $text = is_string($text) ? $text : '';
    if (!preg_match('//u', $text)) {
        return '';
    }
    $text = preg_replace('/[\p{Cc}\p{Cf}]+/u', ' ', $text);
    return trim(preg_replace('/\s+/u', ' ', $text));
}

function wl_strlen(string $s): int
{
    return preg_match_all('/./us', $s);
}

/** Minuscules sans accents, pour regrouper « Écran », « ecran », « ÉCRAN ». */
function wl_fold(string $s): string
{
    static $map = null;
    $map ??= array_combine(
        preg_split('//u', 'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖòóôõöÙÚÛÜùúûüÝýÿŸ', -1, PREG_SPLIT_NO_EMPTY),
        str_split('aaaaaaaaaaaacceeeeeeeeiiiiiiiinnoooooooooouuuuuuuuyyyy')
    ) + ['Œ' => 'oe', 'œ' => 'oe', 'Æ' => 'ae', 'æ' => 'ae', 'ß' => 'ss', '’' => "'"];
    return strtolower(strtr($s, $map));
}

/** Vrai si le texte contient un mot de la liste (mot entier, sans casse ni accents). */
function wl_has_banned(string $text): bool
{
    $words = preg_split('/[^a-z0-9]+/', wl_fold($text), -1, PREG_SPLIT_NO_EMPTY);
    foreach (wl_config()['banned_words'] as $bad) {
        if (in_array(wl_fold((string)$bad), $words, true)) {
            return true;
        }
    }
    return false;
}

// ---------------------------------------------------------------------------
// Questions : validation de la saisie animateur
// ---------------------------------------------------------------------------

/** Lien d'un exercice : une adresse https:// complète, sans identifiant, sans espace
 *  ni caractère de contrôle, avec un nom de domaine (jamais une adresse IP). Vide = aucun. */
function wl_clean_link(mixed $v): string
{
    $url = is_string($v) ? trim($v) : '';
    if ($url === '') {
        return '';
    }
    $p = strlen($url) <= 300 && !preg_match('/[\x00-\x20\x7f"<>\\^`{|}]/', $url) ? parse_url($url) : false;
    $host = is_array($p) ? strtolower((string)($p['host'] ?? '')) : '';
    if (!$p || strtolower((string)($p['scheme'] ?? '')) !== 'https' || isset($p['user']) || isset($p['pass'])
        || !preg_match('/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/', $host) || !preg_match('/\.[a-z][a-z0-9-]*$/', $host) || filter_var($host, FILTER_VALIDATE_IP)) {
        throw new WlError('Lien : une adresse https:// complète est attendue (300 caractères au plus, sans espace ni identifiant).');
    }
    return $url;
}

/** Valide une question envoyée par l'animateur et renvoie sa forme stockée. */
function wl_clean_question(array $in, ?array $old = null): array
{
    $type = in_array($in['type'] ?? '', WL_TYPES, true) ? $in['type'] : throw new WlError('Type de question inconnu.');
    $text = wl_clean_text($in['text'] ?? '');
    if ($text === '' || wl_strlen($text) > 200) {
        throw new WlError('L\'intitulé est obligatoire (200 caractères au plus).');
    }
    $q = [
        'id' => $old['id'] ?? bin2hex(random_bytes(4)),
        'type' => $type,
        'text' => $text,
        'options' => wl_clean_options($type, $in['options'] ?? []),
        'multi' => $type === 'mcq' && !empty($in['multi']),
        'correct' => [],
        'scaleMax' => ($in['scaleMax'] ?? 5) == 10 ? 10 : 5,
        'budget' => max(1, min(100, (int)($in['budget'] ?? ($type === 'dots' ? 3 : 10)))),
        'source' => $type === 'dots' ? (string)($in['source'] ?? '') : '',
        // Avant / après : identifiant d'une question précédente de même forme (quiz ou échelle).
        'compare' => in_array($type, WL_COMPARE_TYPES, true) ? preg_replace('/[^0-9a-f]/', '', (string)($in['compare'] ?? '')) : '',
        // Gommettes sur une seule colonne du post-it source (-1 : toutes).
        'column' => $type === 'dots' && is_numeric($in['column'] ?? null) ? max(-1, (int)$in['column']) : -1,
        'duration' => wl_clean_duration($in['duration'] ?? 0),
        'explain' => wl_clean_explain($in['explain'] ?? ''),
        'link' => wl_clean_link($in['link'] ?? ''),
        'allowChange' => !array_key_exists('allowChange', $in) || !empty($in['allowChange']),
        'reveal' => in_array($in['reveal'] ?? '', ['manual', 'end', 'instant'], true) ? $in['reveal'] : 'manual',
        'anonymous' => true,
        'live' => in_array($type, WL_LIVE_TYPES, true) && (!array_key_exists('live', $in) || !empty($in['live'])),
        // L'état de vote est conservé si on modifie une question existante.
        'state' => $old['state'] ?? 'draft',
        'showResults' => $old['showResults'] ?? false,
        'closesAt' => $old['closesAt'] ?? null,
        'answers' => $old['answers'] ?? [],
        'hidden' => $old['hidden'] ?? [],
        'posts' => $old['posts'] ?? [],
    ];
    $q['correct'] = wl_clean_correct($q, $in['correct'] ?? []);
    $q['variants'] = $type === 'steps' ? wl_clean_variants($in['variants'] ?? [], count($q['options'])) : [];
    if ($type === 'steps') {
        [$q['allowChange'], $q['reveal']] = [true, 'manual']; // on coche et décoche tant que le défi est ouvert
    }
    wl_check_reveal($q);
    if ($old && wl_structure_changed($old, $q)) {
        // Les réponses déjà reçues ne correspondent plus aux choix : on repart de
        // zéro. Un vote ouvert le reste (modifier en direct ne doit pas bloquer
        // les participants, constaté le 15/10/2026) ; sinon, retour au brouillon.
        $wasOpen = $old['state'] === 'open';
        wl_reset_question($q);
        if ($wasOpen) {
            $q['state'] = 'open';
            $q['closesAt'] = $q['duration'] ? time() + $q['duration'] : null;
        }
    }
    if ($old && $q['type'] === 'postit' && $old['options'] !== $q['options'] && count(array_unique($q['options'])) === count($q['options'])
        && wl_options_reordered($old['options'], $q['options'])) {
        // Colonnes réordonnées : chaque note suit sa colonne (retrouvée par son nom), pas sa position.
        $to = array_flip($q['options']);
        foreach ($q['posts'] as &$p) {
            $p['col'] = $to[$old['options'][$p['col'] ?? 0] ?? ''] ?? ($p['col'] ?? 0);
        }
        unset($p);
    }
    return $q;
}

/** Explication affichée avec les résultats (projection et téléphones), pour
 *  appuyer l'intervention de l'animateur. 400 caractères : lisible de loin. */
function wl_clean_explain(mixed $text): string
{
    $text = wl_clean_text($text);
    if (wl_strlen($text) > 400) {
        throw new WlError('Explication : 400 caractères au plus.');
    }
    return $text;
}

/** Moment de la correction : manual = bouton « Afficher les résultats » ;
 *  end = automatiquement à la fin du compte à rebours ; instant = chaque
 *  participant voit la correction dès qu'il a répondu (réponse alors figée). */
function wl_check_reveal(array &$q): void
{
    if ($q['reveal'] === 'end' && in_array($q['type'], WL_WRITTEN_TYPES, true)) {
        throw new WlError('Une réponse écrite peut contenir un nom : elle ne s\'affiche pas toute seule, relisez-la puis affichez-la.');
    }
    if ($q['reveal'] === 'end' && !$q['duration']) {
        throw new WlError('Correction à la fin du temps : indiquez une durée.');
    }
    if ($q['reveal'] === 'instant') {
        if (!$q['correct']) {
            throw new WlError('Correction immédiate : cochez la ou les bonnes réponses.');
        }
        $q['allowChange'] = false; // sinon on corrigerait sa réponse après avoir vu la solution
    }
}

/** Résultats visibles du public : affichés par l'animateur, ou temps écoulé
 *  pour une question « correction à la fin du temps ». */
function wl_shown(array $q, ?int $now = null): bool
{
    return $q['showResults'] || (($q['reveal'] ?? 'manual') === 'end' && wl_time_up($q, $now));
}

function wl_time_up(array $q, ?int $now = null): bool
{
    return $q['state'] === 'open' && $q['closesAt'] && ($now ?? time()) >= $q['closesAt'];
}

/** Morceau d'ETag qui change quand le temps de la question courante s'écoule
 *  (sinon un rafraîchissement 304 ne verrait jamais la fin du temps). */
function wl_time_tag(array $s): string
{
    $q = wl_current_question($s);
    return $q && wl_time_up($q) ? '-t' : '';
}

/** Efface les réponses et contributions d'une question, vote fermé. */
function wl_reset_question(array &$q): void
{
    [$q['state'], $q['showResults'], $q['closesAt'], $q['answers'], $q['hidden'], $q['posts']]
        = ['draft', false, null, [], [], []];
}

/** Vrai si une modification rend les réponses existantes incohérentes.
 *  Post-it : ajouter ou retirer une colonne ne casse rien (une note d'une
 *  colonne disparue s'affiche dans la dernière). */
/** Mêmes choix dans un autre ordre : les réponses, rangées par position, changeraient de sens.
 *  Pas pour les post-it : les notes suivent leur colonne (wl_clean_question), décidé le 17/10/2026. */
function wl_options_reordered(array $old, array $new): bool
{
    sort($old);
    sort($new);
    return $old === $new;
}

function wl_structure_changed(array $old, array $new): bool
{
    if ($old['type'] !== $new['type']) {
        return true;
    }
    $relevant = ['mcq' => 'multi', 'scale' => 'scaleMax', 'points' => 'budget', 'dots' => 'budget'][$new['type']] ?? null;
    return ($new['type'] !== 'postit' && count($old['options']) !== count($new['options']))
        || ($new['type'] !== 'postit' && $old['options'] !== $new['options'] && wl_options_reordered($old['options'], $new['options']))
        || ($relevant && $old[$relevant] !== $new[$relevant])
        || ($new['type'] === 'dots' && (($old['source'] ?? '') !== $new['source'] || ($old['column'] ?? -1) !== $new['column']));
}

function wl_clean_options(string $type, mixed $options): array
{
    if ($type === 'yesno') {
        return ['Oui', 'Non'];
    }
    if ($type === 'truefalse') {
        return ['Vrai', 'Faux'];
    }
    if ($type === 'postit') {
        return wl_clean_columns($options);
    }
    if (!in_array($type, ['mcq', 'poll', 'points', 'steps'], true)) {
        return [];
    }
    $word = $type === 'steps' ? 'étapes' : 'choix';
    $clean = [];
    foreach (is_array($options) ? $options : [] as $o) {
        $o = wl_clean_text($o);
        if ($o !== '') {
            $clean[] = wl_strlen($o) <= 80 ? $o : throw new WlError('Un titre d\'étape dépasse 80 caractères.', 400);
        }
    }
    if (count($clean) < 2 || count($clean) > WL_MAX_OPTIONS) {
        throw new WlError('Il faut entre 2 et ' . WL_MAX_OPTIONS . ' ' . $word . '.');
    }
    return $clean;
}

/** Défi à étapes : variantes facultatives (Windows, Mac, iPhone, Android…), chacune
 *  avec le même nombre d'étapes que la liste des titres. Accepte une liste de
 *  {name, steps} (formulaire) ou un objet nom → étapes (réponse d'une IA). */
function wl_clean_variants(mixed $v, int $n): array
{
    if (!is_array($v) || !$v) {
        return [];
    }
    $pairs = [];
    foreach ($v as $k => $x) {
        $pairs[] = is_array($x) && array_key_exists('steps', $x) ? [$x['name'] ?? '', $x['steps']] : [(string)$k, $x];
    }
    if (count($pairs) < 2 || count($pairs) > 4) {
        throw new WlError('Il faut entre 2 et 4 variantes (par exemple Windows, Mac), ou aucune.');
    }
    $out = [];
    $seen = [];
    foreach ($pairs as [$name, $steps]) {
        $name = wl_clean_text($name);
        if ($name === '' || wl_strlen($name) > 20) {
            throw new WlError('Le nom d\'une variante : 1 à 20 caractères.');
        }
        if (isset($seen[wl_fold($name)])) {
            throw new WlError('Deux variantes portent le même nom.');
        }
        $seen[wl_fold($name)] = true;
        $clean = [];
        foreach (is_array($steps) ? $steps : [] as $t) {
            $t = wl_clean_text($t);
            if ($t !== '') {
                $clean[] = wl_strlen($t) <= 160 ? $t : throw new WlError('Une étape dépasse 160 caractères.');
            }
        }
        if (count($clean) !== $n) {
            throw new WlError('La variante « ' . $name . ' » doit avoir ' . $n . ' étapes, comme la liste des titres.');
        }
        $out[] = ['name' => $name, 'steps' => $clean];
    }
    return $out;
}

/** Colonnes d'un post-it collectif (1 à 6) ; aucune saisie = une colonne « Idées ». */
function wl_clean_columns(mixed $options): array
{
    $cols = array_values(array_filter(array_map('wl_clean_text', is_array($options) ? $options : []), 'strlen'));
    foreach ($cols as $c) {
        if (wl_strlen($c) > 40) {
            throw new WlError('Un nom de colonne dépasse 40 caractères.');
        }
    }
    if (count($cols) > WL_MAX_COLUMNS) {
        throw new WlError('6 colonnes au plus.');
    }
    return $cols ?: ['Idées'];
}

function wl_clean_duration(mixed $d): int
{
    $d = (int)$d;
    if ($d !== 0 && ($d < 5 || $d > 3600)) {
        throw new WlError('La durée doit être comprise entre 5 et 3600 secondes (0 = sans limite).');
    }
    return $d;
}

/** Bonne(s) réponse(s) d'un quiz : seulement pour Oui/Non, Vrai/Faux et QCM. */
function wl_clean_correct(array $q, mixed $correct): array
{
    if (!in_array($q['type'], ['yesno', 'truefalse', 'mcq'], true) || !is_array($correct)) {
        return [];
    }
    $idx = array_values(array_unique(array_filter(
        array_map('intval', $correct),
        fn($i) => $i >= 0 && $i < count($q['options'])
    )));
    sort($idx);
    if (!$q['multi'] && count($idx) > 1) {
        throw new WlError('Choix unique : une seule bonne réponse possible.');
    }
    return $idx;
}

// ---------------------------------------------------------------------------
// Import : questions générées par une IA, réponse collée par l'animateur
// ---------------------------------------------------------------------------

/** Lit la liste JSON collée et valide chaque question comme une saisie de
 *  l'animateur. Renvoie, dans l'ordre, ['q' => question] ou ['error' => texte].
 *  Une gommette pointe sa source par sa position dans la liste (« #0 »…). */
/** Liste de questions d'un texte collé, avec le repli pour une copie depuis l'application mobile d'une IA. */
function wl_import_list(string $raw): ?array
{
    $list = wl_import_json($raw);
    if (!is_array($list)) {
        // Copie depuis l'affichage d'une IA (application mobile) : « \[ », « \] »
        // ajoutés par la mise en forme, espaces insécables. Jamais valides en JSON.
        $list = wl_import_json(str_replace("\u{00A0}", ' ', preg_replace('/(?<!\\\\)\\\\([\[\]_*#`>+\-.!()])/', '$1', $raw)));
    }
    return $list;
}

function wl_import_parse(string $raw): array
{
    $list = wl_import_list($raw);
    if (!is_array($list) || !$list || !array_is_list($list)) {
        throw new WlError('Réponse illisible : collez toute la réponse de l\'IA, du « [ » au « ] ».');
    }
    if (count($list) > WL_MAX_QUESTIONS) {
        throw new WlError(WL_MAX_QUESTIONS . ' questions au plus.');
    }
    $items = [];
    foreach ($list as $in) {
        try {
            // Dernier élément possible : la conclusion de l'atelier (pas une question).
            if (is_array($in) && ($in['type'] ?? '') === 'conclusion') {
                $items[] = ['conclusion' => wl_clean_conclusion($in['text'] ?? '')];
                continue;
            }
            $q = wl_clean_question(wl_import_input(is_array($in) ? $in : []));
            if ($q['type'] === 'dots') {
                $q['source'] = '#' . ((int)($in['source'] ?? 0) - 1);
            }
            if (is_array($in) && in_array($q['type'], WL_COMPARE_TYPES, true) && is_numeric($in['compare'] ?? null)) {
                $q['compare'] = '#' . ((int)$in['compare'] - 1);
            }
            $items[] = ['q' => $q, 'column' => is_string($in['column'] ?? null) ? $in['column'] : ''];
        } catch (WlError $e) {
            $items[] = ['error' => $e->getMessage()];
        }
    }
    foreach ($items as $i => $it) {
        if (isset($it['q']) && str_starts_with($it['q']['compare'] ?? '', '#')) {
            $ref = (int)substr($it['q']['compare'], 1);
            if ($ref >= $i || !isset($items[$ref]['q']) || !wl_compare_shape($items[$ref]['q'], $it['q'])) {
                $items[$i] = ['error' => 'Avant / après : la question « avant » doit précéder, avoir le même type et les mêmes choix (quiz avec bonne réponse, ou échelle).'];
                continue;
            }
        }
        $src = isset($it['q']) && $it['q']['type'] === 'dots' ? (int)substr($it['q']['source'], 1) : null;
        if ($src !== null && ($src >= $i || !in_array($items[$src]['q']['type'] ?? '', WL_POST_TYPES, true))) {
            $items[$i] = ['error' => 'Gommettes : la source doit être un mur ou un post-it placé avant dans la liste.'];
            continue;
        }
        if ($src !== null && ($it['column'] ?? '') === '' && ($items[$src]['q']['type'] ?? '') === 'postit') {
            // L'intitulé cite une colonne mais « column » manque : toutes les idées seraient proposées.
            $text = wl_fold($it['q']['text']);
            foreach ($items[$src]['q']['options'] as $name) {
                if (count($items[$src]['q']['options']) > 1 && mb_strlen($name) >= 4 && str_contains($text, wl_fold(wl_clean_text($name)))) {
                    $items[$i]['warning'] = 'l\'intitulé cite la colonne « ' . $name . ' » mais « column » est absent : toutes les idées seront proposées.';
                    break;
                }
            }
        }
        if ($src !== null && ($it['column'] ?? '') !== '') {
            $names = array_map(fn($o) => wl_fold(wl_clean_text($o)), $items[$src]['q']['options']);
            $col = array_search(wl_fold(wl_clean_text($it['column'])), $names, true);
            $items[$i] = $col === false || $items[$src]['q']['type'] !== 'postit'
                ? ['error' => 'Gommettes : colonne « ' . wl_clean_text($it['column']) . ' » absente du post-it source.']
                : ['q' => ['column' => $col] + $items[$i]['q']];
        }
    }
    foreach ($items as $i => $it) {
        // Un lien venu d'un texte collé (IA ou fichier) : montré à l'animateur, à vérifier avant l'atelier.
        if (($it['q']['link'] ?? '') !== '') {
            $note = 'le lien « ' . parse_url($it['q']['link'], PHP_URL_HOST) . ' » est à vérifier avant l\'atelier.';
            $items[$i]['warning'] = isset($it['warning']) ? $it['warning'] . ' Et ' . $note : $note;
        }
    }
    return array_map(fn($it) => array_diff_key($it, ['column' => 1]), $items);
}

// ---------------------------------------------------------------------------
// Thèmes de la bibliothèque ajoutés par l'animateur (seances.json, contenu pédagogique seulement)
// ---------------------------------------------------------------------------

const WL_MAX_THEMES = 30;

function wl_themes_file(): string
{
    return wl_data_dir() . '/seances.json';
}

function wl_themes(): array
{
    $d = is_file(wl_themes_file()) ? json_decode((string)file_get_contents(wl_themes_file()), true) : null;
    return is_array($d) && is_array($d['themes'] ?? null) ? array_values($d['themes']) : [];
}

/** Un thème prêt à stocker : métadonnées nettoyées, questions vérifiées par l'import (une erreur refuse le thème). */
function wl_theme_clean(array $in, array $list): array
{
    $field = function (string $key, int $max, bool $required = false) use ($in): string {
        $v = wl_clean_text($in[$key] ?? '');
        if (($required && $v === '') || wl_strlen($v) > $max) {
            throw new WlError('Thème : « ' . $key . ' » ' . ($v === '' ? 'est obligatoire.' : 'dépasse ' . $max . ' caractères.'));
        }
        return $v;
    };
    $theme = ['id' => bin2hex(random_bytes(4)), 'title' => $field('title', 120, true), 'public' => $field('public', 160),
        'duree' => $field('duree', 60), 'prerequis' => $field('prerequis', 160), 'objectif' => $field('objectif', 200)];
    foreach (wl_import_parse(json_encode($list, JSON_UNESCAPED_UNICODE)) as $i => $it) {
        if (isset($it['error'])) {
            throw new WlError('Question ' . ($i + 1) . ' : ' . $it['error']);
        }
    }
    return $theme + ['items' => $list];
}

/** Liste JSON comprise entre le premier « [ » et le dernier « ] », ou null. */
function wl_import_json(string $raw): ?array
{
    $start = strpos($raw, '[');
    $end = strrpos($raw, ']');
    $list = $start !== false && $end > $start ? json_decode(substr($raw, $start, $end - $start + 1), true) : null;
    return is_array($list) ? $list : null;
}

/** Format de l'IA vers celui du formulaire : bonnes réponses données par leur
 *  texte (l'IA se trompe sur les numéros), retrouvées sans casse ni accents. */
function wl_import_input(array $in): array
{
    $type = (string)($in['type'] ?? '');
    $options = ['yesno' => ['Oui', 'Non'], 'truefalse' => ['Vrai', 'Faux']][$type]
        ?? (is_array($in['options'] ?? null) ? array_values($in['options']) : []);
    $keys = array_map(fn($o) => wl_fold(wl_clean_text($o)), $options);
    $correct = [];
    $wanted = in_array($type, ['yesno', 'truefalse', 'mcq'], true) ? (array)($in['correct'] ?? []) : [];
    foreach ($wanted as $c) {
        $i = array_search(wl_fold(wl_clean_text($c)), $keys, true);
        $correct[] = $i !== false ? $i : throw new WlError('Bonne réponse « ' . wl_clean_text($c) . ' » absente des choix.');
    }
    return [
        'type' => $type,
        'text' => $in['text'] ?? '',
        'options' => $options,
        'correct' => $correct,
        'multi' => !empty($in['multi']) || count($correct) > 1,
        'scaleMax' => $in['scaleMax'] ?? 5,
        'budget' => $in['budget'] ?? null,
        // Réglages présents dans un fichier exporté par WoocLight (absents d'une réponse d'IA).
        'variants' => $in['variants'] ?? [],
    ] + array_intersect_key($in, array_flip(['explain', 'duration', 'reveal', 'allowChange', 'live', 'link']));
}

/** Questions d'une session au format de l'import (wl_import_parse) : réponses
 *  écartées, bonnes réponses par leur texte, source des gommettes par sa position. */
function wl_export_questions(array $s): array
{
    $pos = array_flip(array_column($s['questions'], 'id'));
    $conclusion = ($s['conclusion'] ?? '') !== '' ? [['type' => 'conclusion', 'text' => $s['conclusion']]] : [];
    return [...array_map(function ($q) use ($pos, $s) {
        $out = ['type' => $q['type'], 'text' => $q['text']];
        if (in_array($q['type'], ['mcq', 'poll', 'points', 'postit', 'steps'], true)) {
            $out['options'] = $q['options'];
        }
        if ($q['type'] === 'steps' && !empty($q['variants'])) {
            $out['variants'] = array_column($q['variants'], 'steps', 'name');
        }
        if ($q['correct']) {
            $texts = array_map(fn($i) => $q['options'][$i], $q['correct']);
            $out['correct'] = $q['type'] === 'mcq' ? $texts : $texts[0];
        }
        if ($q['type'] === 'mcq' && $q['multi']) {
            $out['multi'] = true;
        }
        if ($q['type'] === 'scale') {
            $out['scaleMax'] = $q['scaleMax'];
        }
        if (in_array($q['type'], ['points', 'dots'], true)) {
            $out['budget'] = $q['budget'];
        }
        if ($q['type'] === 'dots' && isset($pos[$q['source']])) {
            $out['source'] = $pos[$q['source']] + 1;
            $name = $s['questions'][$pos[$q['source']]]['options'][$q['column'] ?? -1] ?? null;
            if ($name !== null) {
                $out['column'] = $name;
            }
        }
        if (($q['compare'] ?? '') !== '' && isset($pos[$q['compare']]) && $pos[$q['compare']] < $pos[$q['id']]) {
            $out['compare'] = $pos[$q['compare']] + 1;
        }
        if (($q['explain'] ?? '') !== '') {
            $out['explain'] = $q['explain'];
        }
        if (($q['link'] ?? '') !== '') {
            $out['link'] = $q['link'];
        }
        return $out + ['duration' => $q['duration'], 'reveal' => $q['reveal'] ?? 'manual',
            'allowChange' => $q['allowChange'], 'live' => $q['live'] ?? true];
    }, $s['questions']), ...$conclusion];
}

// ---------------------------------------------------------------------------
// Votes : validation de la réponse d'un participant
// ---------------------------------------------------------------------------

/** État réel d'une question : un vote dont le temps est écoulé est fermé. */
function wl_effective_state(array $q, ?int $now = null): string
{
    if ($q['state'] === 'open' && $q['closesAt'] && ($now ?? time()) >= $q['closesAt']) {
        return 'closed';
    }
    return $q['state'];
}

/** Valide une réponse selon le type ; renvoie la valeur à stocker. */
function wl_clean_answer(array $q, mixed $v): mixed
{
    $n = count($q['options']);
    switch ($q['type']) {
        case 'yesno':
        case 'truefalse':
        case 'poll':
            return wl_index($v, $n);
        case 'mcq':
            if (!$q['multi']) {
                return wl_index($v, $n);
            }
            $list = is_array($v) ? array_values(array_unique(array_map(fn($i) => wl_index($i, $n), $v))) : [];
            sort($list);
            return $list ?: throw new WlError('Cochez au moins une réponse.');
        case 'wordcloud':
        case 'text':
            return wl_clean_free_text($v);
        case 'scale':
            return wl_index($v, $q['scaleMax'] + 1, 1);
        case 'points':
            return wl_clean_points($v, $n, $q['budget']);
        case 'steps':
            $list = is_array($v) ? array_values(array_unique(array_map(fn($i) => wl_index($i, $n), $v))) : throw new WlError('Réponse invalide.');
            sort($list);
            return $list; // étapes cochées ; liste vide = tout décoché
    }
    throw new WlError('Type de question inconnu.');
}

function wl_index(mixed $v, int $max, int $min = 0): int
{
    if (!is_int($v) && !(is_string($v) && ctype_digit($v))) {
        throw new WlError('Réponse invalide.');
    }
    $v = (int)$v;
    return ($v >= $min && $v < $max) ? $v : throw new WlError('Réponse invalide.');
}

function wl_clean_free_text(mixed $v): string
{
    $max = (int)wl_config()['max_text'];
    $text = wl_clean_text($v);
    if ($text === '') {
        throw new WlError('Écrivez une réponse avant d\'envoyer.');
    }
    if (wl_strlen($text) > $max) {
        throw new WlError("Réponse trop longue ($max caractères au plus).");
    }
    if (wl_has_banned($text)) {
        throw new WlError('Réponse refusée : elle contient un mot non autorisé.');
    }
    return $text;
}

function wl_clean_points(mixed $v, int $n, int $budget): array
{
    if (!is_array($v) || count($v) !== $n) {
        throw new WlError('Répartition invalide.');
    }
    $pts = array_map(fn($p) => wl_index($p, $budget + 1), array_values($v));
    $sum = array_sum($pts);
    if ($sum < 1 || $sum > $budget) {
        throw new WlError("Répartissez entre 1 et $budget points.");
    }
    return $pts;
}

/** Enregistre un vote. Refusé si la question n'est pas ouverte, ou si le
 *  participant a déjà voté et que la modification n'est pas autorisée
 *  (renvoyer la même réponse est accepté : reprise après coupure réseau). */
function wl_vote(array &$s, string $pkey, string $qid, mixed $value): mixed
{
    if ($s['ended']) {
        throw new WlError('La session est terminée.', 409);
    }
    $i = wl_question_index($s, $qid);
    $q = &$s['questions'][$i];
    if ($i !== $s['current'] || wl_effective_state($q) !== 'open') {
        throw new WlError('Le vote est fermé pour cette question.', 409);
    }
    if (in_array($q['type'], WL_POST_TYPES, true)) {
        throw new WlError('Publiez votre contribution avec le bouton prévu.');
    }
    $clean = $q['type'] === 'dots' ? wl_clean_dots($value, wl_dot_items($s, $q), $q['budget']) : wl_clean_answer($q, $value);
    $prev = $q['answers'][$pkey]['v'] ?? null;
    if ($prev !== null && $prev !== $clean && !$q['allowChange']) {
        throw new WlError('Vous avez déjà répondu à cette question.', 409);
    }
    if ($q['type'] === 'steps' && !$clean) {
        unset($q['answers'][$pkey]); // tout décoché : plus compté comme ayant commencé
    } else {
        $q['answers'][$pkey] = ['v' => $clean, 't' => time()];
    }
    if ($q['showResults']) {
        $s['pversion']++; // résultats affichés : les téléphones doivent suivre
    }
    return $clean;
}

function wl_question_index(array $s, mixed $qid): int
{
    foreach ($s['questions'] as $i => $q) {
        if ($q['id'] === $qid) {
            return $i;
        }
    }
    throw new WlError('Question introuvable.', 404);
}

// ---------------------------------------------------------------------------
// Résultats
// ---------------------------------------------------------------------------

/** Résultats agrégés d'une question. $admin : inclut les réponses masquées.
 *  $s (la session) n'est utile qu'aux gommettes, qui votent sur une autre question. */
function wl_results(array $q, bool $admin = false, ?array $s = null): array
{
    $r = wl_results_base($q, $admin, $s);
    $compare = $s !== null && ($q['compare'] ?? '') !== '' ? wl_compare_results($q, $s) : null;
    return $compare ? $r + ['compare' => $compare] : $r;
}

/** Une question « avant » et une question « après » se comparent si elles ont la
 *  même forme : même type, mêmes choix (ou même échelle), et une bonne réponse
 *  chacune pour un quiz. */
function wl_compare_shape(array $before, array $after): bool
{
    if ($before['type'] !== $after['type'] || !in_array($after['type'], WL_COMPARE_TYPES, true)) {
        return false;
    }
    if ($after['type'] === 'scale') {
        return $before['scaleMax'] === $after['scaleMax'];
    }
    return $before['options'] === $after['options'] && $before['correct'] && $after['correct'];
}

/** Moins de personnes ayant répondu aux deux questions : on ne les isole pas (le changement d'une
 *  personne seule se lirait), la comparaison porte alors sur tous les répondants de chaque passage. */
const WL_COMPARE_MIN = 3;

/** Valeur chiffrée d'un passage : moyenne (échelle) ou part de bonnes réponses en %.
 *  $only : clés des participants retenus (sinon tous les répondants). */
function wl_compare_value(array $q, ?array $only = null): ?array
{
    $answers = array_column($only === null ? $q['answers'] : array_intersect_key($q['answers'], array_flip($only)), 'v');
    if (!$answers) {
        return null;
    }
    if ($q['type'] === 'scale') {
        return ['v' => round(array_sum($answers) / count($answers), 1), 'n' => count($answers)];
    }
    $want = $q['correct'];
    sort($want);
    $right = count(array_filter($answers, function ($a) use ($want) {
        $a = (array)$a;
        sort($a);
        return $a === $want;
    }));
    return ['v' => (int)round(100 * $right / count($answers)), 'n' => count($answers)];
}

/** Agrégats seulement (jamais une réponse isolée) : avant, après, et de quoi les lire. */
function wl_compare_results(array $q, array $s): ?array
{
    foreach ($s['questions'] as $e) {
        if ($e['id'] === $q['id']) {
            return null; // la question « avant » doit venir avant
        }
        if ($e['id'] !== $q['compare']) {
            continue;
        }
        if (!wl_compare_shape($e, $q)) {
            return null;
        }
        $common = array_keys(array_intersect_key($e['answers'], $q['answers']));
        $same = count($common) >= WL_COMPARE_MIN;
        $before = wl_compare_value($e, $same ? $common : null);
        $after = $before ? wl_compare_value($q, $same ? $common : null) : null;
        return $after ? ['kind' => $q['type'] === 'scale' ? 'average' : 'correct', 'max' => $q['scaleMax'],
            'before' => $before['v'], 'after' => $after['v'], 'nBefore' => $before['n'], 'nAfter' => $after['n'],
            'same' => $same, 'nCommon' => $same ? count($common) : 0] : null;
    }
    return null;
}

/** « Avant : 38 % de bonnes réponses — Après : 75 % (+37 points) » (même texte que common.js). */
function wl_compare_text(array $c): string
{
    $fmt = fn($v) => str_replace('.', ',', (string)$v);
    $unit = fn($v) => $c['kind'] === 'average' ? $fmt($v) . ' / ' . $c['max'] : $v . ' %' . ' de bonnes réponses';
    $d = round($c['after'] - $c['before'], 1);
    $delta = $d == 0 ? 'stable' : ($d > 0 ? '+' : '−') . $fmt(abs($d)) . ($c['kind'] === 'average' ? '' : ' points');
    $who = !empty($c['same']) ? 'mêmes ' . $c['nCommon'] . ' personnes' : 'personnes différentes : ' . $c['nBefore'] . ' puis ' . $c['nAfter'] . ' réponses';
    return 'Avant : ' . $unit($c['before']) . ' — Après : ' . $unit($c['after']) . ' (' . $delta . ' ; ' . $who . ')';
}

function wl_results_base(array $q, bool $admin = false, ?array $s = null): array
{
    $answers = array_column($q['answers'], 'v');
    $r = ['total' => count($answers)];
    switch ($q['type']) {
        case 'wall':
            return ['total' => count($q['posts'])] + ['posts' => wl_wall_results($q, $admin)];
        case 'postit':
            return ['total' => count($q['posts']), 'columns' => $q['options'], 'posts' => wl_postit_results($q, $admin)];
        case 'dots':
            return $r + ['items' => wl_dots_results($q, $s ? wl_dot_items($s, $q) : [])];
        case 'wordcloud':
            return $r + ['words' => wl_word_counts($answers)];
        case 'text':
            return $r + ['texts' => wl_text_wall($q, $admin)];
        case 'scale':
            return $r + wl_scale_results($answers, $q['scaleMax']);
        case 'points':
            return $r + wl_points_results($answers, count($q['options']));
        case 'steps':
            $done = array_fill(0, count($q['options']), 0);
            foreach ($answers as $a) {
                foreach ($a as $i) {
                    $done[$i]++;
                }
            }
            return $r + ['counts' => $done, 'finished' => count(array_filter($answers, fn($a) => count($a) === count($q['options'])))];
    }
    $counts = array_fill(0, count($q['options']), 0);
    foreach ($answers as $a) {
        foreach ((array)$a as $i) {
            $counts[$i]++;
        }
    }
    return $r + ['counts' => $counts];
}

/** Récap de fin de session : une ligne par question qui a reçu des réponses.
 *  Jamais le texte d'une réponse libre (elle peut contenir un nom) ; une idée
 *  du mur seulement si le mur a été publié et l'idée non masquée. */
function wl_recap(array $s, bool $anonymous = false): array
{
    $lines = [];
    foreach ($s['questions'] as $q) {
        $r = wl_results($q, false, $s);
        if (!$r['total']) {
            continue;
        }
        $pct = fn(int $n) => round(100 * $n / $r['total']) . ' %';
        $top = function (array $counts) use ($q) {
            arsort($counts);
            return $q['options'][array_key_first($counts)] ?? '';
        };
        $line = match (true) {
            (bool)$q['correct'] => (function () use ($q) {
                $good = 0;
                $want = $q['correct'];
                sort($want);
                foreach ($q['answers'] as $a) {
                    $v = (array)$a['v'];
                    sort($v);
                    $good += $v === $want ? 1 : 0;
                }
                return $good . ' / ' . count($q['answers']) . ' bonnes réponses';
            })(),
            in_array($q['type'], ['yesno', 'truefalse', 'poll', 'mcq'], true)
                => 'Le plus choisi : ' . $top($r['counts']) . ' (' . $pct(max($r['counts'])) . ')',
            // Archive : aucun texte écrit par un participant (mots, idées, post-its).
            $anonymous && in_array($q['type'], ['wordcloud', 'text', 'wall', 'postit', 'dots'], true)
                => wl_plural($r['total'], ['wall' => 'message', 'postit' => 'post-it', 'dots' => 'vote'][$q['type']] ?? 'réponse'),
            $q['type'] === 'wordcloud' => 'Mots les plus cités : ' . implode(', ', array_column(array_slice($r['words'], 0, 3), 'text')),
            $q['type'] === 'scale' => 'Moyenne : ' . str_replace('.', ',', (string)$r['average']) . ' / ' . $q['scaleMax'],
            $q['type'] === 'points' => 'En tête : ' . $top($r['counts']),
            $q['type'] === 'steps' => $r['finished'] . ' / ' . $r['total'] . ' ont terminé toutes les étapes',
            $q['type'] === 'dots' && $r['items'] => 'En tête : « ' . $r['items'][0]['text'] . ' » (' . wl_plural($r['items'][0]['n'], 'gommette') . ')',
            $q['type'] === 'wall' && wl_shown($q) && $r['posts']
                => 'Idée la plus aimée : « ' . $r['posts'][0]['text'] . ' » (♥ ' . $r['posts'][0]['likes'] . ')',
            default => wl_plural($r['total'], ['wall' => 'message', 'postit' => 'post-it'][$q['type']] ?? 'réponse'),
        };
        $lines[] = ['text' => $q['text'], 'summary' => $line];
    }
    return $lines;
}

function wl_plural(int $n, string $word): string
{
    return $n . ' ' . $word . ($n > 1 && !str_ends_with($word, 's') ? 's' : '');
}

/** Synthèse rédigée par une IA à partir du bilan, collée et relue par
 *  l'animateur : visible de lui seul et dans l'export PowerPoint. Les retours
 *  à la ligne sont gardés (paragraphes, listes). 6000 caractères. */
function wl_clean_synthesis(mixed $text): string
{
    $text = is_string($text) && preg_match('//u', $text) ? str_replace(["\r\n", "\r"], "\n", $text) : '';
    $text = preg_replace('/[^\P{Cc}\n\t]+|\p{Cf}+/u', '', $text);
    $text = trim(preg_replace("/\n{3,}/", "\n\n", preg_replace('/[ \t]+/u', ' ', $text)));
    if (wl_strlen($text) > 6000) {
        throw new WlError('Synthèse : 6000 caractères au plus.');
    }
    return $text;
}

/** Conclusion de l'animateur, affichée sous le récap. 600 caractères. */
function wl_clean_conclusion(mixed $text): string
{
    $text = wl_clean_text($text);
    if (wl_strlen($text) > 600) {
        throw new WlError('Conclusion : 600 caractères au plus.');
    }
    return $text;
}

/** Regroupe sans casse ni accents ; affiche la forme la plus fréquente. */
function wl_word_counts(array $answers): array
{
    $groups = [];
    foreach ($answers as $a) {
        $key = wl_fold($a);
        $groups[$key]['n'] = ($groups[$key]['n'] ?? 0) + 1;
        $groups[$key]['forms'][$a] = ($groups[$key]['forms'][$a] ?? 0) + 1;
    }
    $words = [];
    foreach ($groups as $g) {
        arsort($g['forms']);
        $words[] = ['text' => (string)array_key_first($g['forms']), 'n' => $g['n']];
    }
    usort($words, fn($a, $b) => $b['n'] <=> $a['n'] ?: strcmp($a['text'], $b['text']));
    return array_slice($words, 0, 60);
}

/** Mur de réponses libres, plus récentes d'abord. L'identifiant d'une
 *  réponse est dérivé de la clé du participant, jamais la clé elle-même. */
function wl_text_wall(array $q, bool $admin): array
{
    $wall = [];
    foreach ($q['answers'] as $pkey => $a) {
        $id = substr(hash('sha256', $q['id'] . $pkey), 0, 10);
        $hidden = in_array($id, $q['hidden'], true);
        if ($admin || !$hidden) {
            $wall[] = ['id' => $id, 'text' => $a['v'], 't' => $a['t']] + ($admin ? ['hidden' => $hidden] : []);
        }
    }
    usort($wall, fn($a, $b) => $b['t'] <=> $a['t']);
    return array_map(function ($w) {
        unset($w['t']);
        return $w;
    }, $wall);
}

function wl_scale_results(array $answers, int $max): array
{
    $dist = array_fill(1, $max, 0);
    foreach ($answers as $a) {
        $dist[$a]++;
    }
    $avg = $answers ? round(array_sum($answers) / count($answers), 1) : null;
    return ['counts' => array_values($dist), 'average' => $avg];
}

function wl_points_results(array $answers, int $n): array
{
    $sums = array_fill(0, $n, 0);
    foreach ($answers as $a) {
        foreach ($a as $i => $p) {
            $sums[$i] += $p;
        }
    }
    return ['counts' => $sums];
}

// ---------------------------------------------------------------------------
// Vues renvoyées aux écrans
// ---------------------------------------------------------------------------

/** Question telle que la voit un participant : ni réponses des autres, ni
 *  correction tant que l'animateur n'affiche pas les résultats. */
function wl_public_question(array $q): array
{
    $show = wl_shown($q);
    return [
        'id' => $q['id'], 'type' => $q['type'], 'text' => $q['text'], 'options' => $q['options'], 'variants' => $q['variants'] ?? [],
        'multi' => $q['multi'], 'scaleMax' => $q['scaleMax'], 'budget' => $q['budget'],
        'duration' => $q['duration'], 'closesAt' => $q['closesAt'], 'state' => $q['state'],
        'allowChange' => $q['allowChange'], 'showResults' => $show, 'source' => $q['source'] ?? '', 'column' => $q['column'] ?? -1,
        'reveal' => $q['reveal'] ?? 'manual',
        'graded' => !empty($q['correct']), // quiz : le téléphone garde « Envoyer » (pas la bonne réponse)
        'correct' => $show ? $q['correct'] : [],
        'explain' => $show ? ($q['explain'] ?? '') : '', // jamais avant la correction
        'link' => $q['link'] ?? '',
    ];
}

function wl_current_question(array $s): ?array
{
    return $s['questions'][$s['current']] ?? null;
}

/** Écran de projection : question courante + résultats (réponses masquées exclues). */
function wl_screen_view(array $s): array
{
    $q = wl_current_question($s);
    return [
        'code' => $s['code'], 'title' => $s['title'], 'ended' => $s['ended'],
        'participants' => count($s['participants']), 'active' => wl_active_count($s),
        // Bouton « Questions » du pilotage : nombre de questions publiées seulement.
        'asksOpen' => !empty($s['asksOpen']), 'asksCount' => count(wl_asks_view($s, '')),
        'position' => $q ? $s['current'] + 1 : 0, 'count' => count($s['questions']),
        'question' => $q ? wl_public_question($q) : null,
        'results' => $q && (wl_shown($q) || wl_live($q)) ? wl_results($q, false, $s) : null,
        'answered' => $q ? (in_array($q['type'], WL_POST_TYPES, true) ? count($q['posts']) : count($q['answers'])) : 0,
        // Mur et post-it : personnes distinctes ayant publié (décompte « 2 / 3 ont participé »).
        'contributors' => $q ? count(array_unique(array_column($q['posts'], 'p'))) : 0,
        'qrHidden' => !empty($s['qrHidden']), // masqué depuis l'espace animateur (place gagnée)
        'joinUrl' => wl_join_url($s['code']), 'now' => time(),
        'pollMs' => (int)wl_config()['poll_ms'],
    ];
}

/** Questions du tableau de bord projeté : celles qui ont été posées (pas
 *  restées en brouillon), dans l'ordre de la session. */
function wl_board_questions(array $s): array
{
    return array_values(array_filter($s['questions'], fn($q) => $q['state'] !== 'draft'));
}

/** Tableau de bord projeté, une question par diapositive ($s['board'] = rang).
 *  Mêmes règles que la projection de la question en direct : résultats
 *  seulement s'ils ont été affichés (ou projetés en direct), réponses
 *  masquées exclues, correction et explication seulement après affichage. */
function wl_board_view(array $s): array
{
    $list = wl_board_questions($s);
    $i = max(0, min((int)$s['board'], count($list) - 1));
    $q = $list[$i] ?? null;
    return [
        'code' => $s['code'], 'title' => $s['title'], 'ended' => $s['ended'],
        'participants' => count($s['participants']),
        'board' => ['position' => $i + 1, 'count' => count($list)], 'qrHidden' => !empty($s['qrHidden']),
        'question' => $q ? wl_public_question($q) : null,
        'results' => $q && (wl_shown($q) || wl_live($q)) ? wl_results($q, false, $s) : null,
        'joinUrl' => wl_join_url($s['code']), 'now' => time(),
        'pollMs' => (int)wl_config()['poll_ms'],
    ];
}

/** Projection en direct dès l'ouverture du vote. Les téléphones, eux, attendent
 *  « Afficher les résultats » : sinon chaque vote les ferait tous recharger.
 *  Question enregistrée avant l'option : en direct si son type le permet. */
function wl_live(array $q): bool
{
    return in_array($q['type'], WL_LIVE_TYPES, true) && ($q['live'] ?? true) && $q['state'] !== 'draft';
}

function wl_join_url(string $code): string
{
    return wl_base_url() . '/?s=' . $code;
}

// ---------------------------------------------------------------------------
// Animateur : session PHP, CSRF, tentatives de connexion
// ---------------------------------------------------------------------------

function wl_admin_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_name('WLADMIN');
    session_set_cookie_params([
        'lifetime' => 0, 'path' => wl_base_path() . '/', 'secure' => wl_https(),
        'httponly' => true, 'samesite' => 'Strict',
    ]);
    ini_set('session.use_strict_mode', '1');
    session_start();
    $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
}

const WL_ADMIN_IDLE = 2 * 3600;   // sans action de l'animateur (le rafraîchissement automatique ne compte pas)
const WL_ADMIN_MAX = 12 * 3600;   // depuis la connexion, quoi qu'il arrive

/** Connecté depuis moins de 12 h, et dernière action de moins de 2 h. */
function wl_is_admin(): bool
{
    wl_admin_session();
    $now = time();
    return !empty($_SESSION['admin'])
        && ($_SESSION['since'] ?? 0) > $now - WL_ADMIN_MAX
        && ($_SESSION['acted'] ?? 0) > $now - WL_ADMIN_IDLE;
}

/** Une écriture de l'animateur prolonge sa session ; une lecture, non. */
function wl_admin_acted(): void
{
    $_SESSION['acted'] = time();
}

/** Appareil déjà connecté avec succès : cookie signé « wl_dev ». */
function wl_known_device(): ?string
{
    $c = (string)($_COOKIE['wl_dev'] ?? '');
    if (preg_match('/^([a-f0-9]{32})\.([a-f0-9]{32})$/', $c, $m) && hash_equals(wl_hash('dev|' . $m[1]), $m[2])) {
        return $m[1];
    }
    return null;
}

function wl_remember_device(): void
{
    $id = wl_known_device() ?? bin2hex(random_bytes(16));
    setcookie('wl_dev', $id . '.' . wl_hash('dev|' . $id), [
        'expires' => time() + 86400 * 180, 'path' => wl_base_path() . '/',
        'secure' => wl_https(), 'httponly' => true, 'samesite' => 'Strict',
    ]);
}

/** 5 échecs en 15 minutes bloquent 15 minutes. Le compteur est celui de
 *  l'appareil s'il s'est déjà connecté (cookie signé), sinon celui de l'IP :
 *  un participant sur le même wifi ne peut pas bloquer l'animateur. */
function wl_login(string $password): void
{
    $file = wl_data_dir() . '/login.json';
    $device = wl_known_device();
    $ip = $device ? 'dev|' . wl_hash('dev-bucket|' . $device) : wl_ip_hash();
    $ok = wl_locked_json($file, function (array &$d) use ($ip, $password) {
        $now = time();
        $d = array_filter($d, fn($e) => $e['first'] > $now - 900);
        if (($d[$ip]['n'] ?? 0) >= 5) {
            throw new WlError('Trop de tentatives. Réessayez dans 15 minutes.', 429);
        }
        if (password_verify($password, (string)wl_config()['admin_hash'])) {
            unset($d[$ip]);
            return true;
        }
        $d[$ip] = ['n' => ($d[$ip]['n'] ?? 0) + 1, 'first' => $d[$ip]['first'] ?? $now];
        return false;
    });
    if (!$ok) {
        usleep(400000);
        throw new WlError('Mot de passe incorrect.', 401);
    }
    wl_admin_session();
    session_regenerate_id(true);
    $_SESSION['admin'] = true;
    $_SESSION['since'] = $_SESSION['acted'] = time();
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    wl_remember_device();
}

/** CSRF participant : dérivé du jeton, renvoyé en en-tête X-CSRF-Token. */
function wl_participant_csrf(string $token): string
{
    return wl_hash('csrf|' . $token);
}

/** Clé d'un participant dans une session (le jeton n'est jamais stocké).
 *  Dérivée aussi du code : deux sessions ne peuvent pas être reliées. */
function wl_participant_key(string $token, string $code): string
{
    return 'p' . wl_hash('p|' . $code . '|' . $token, 15);
}

// ---------------------------------------------------------------------------
// Mur collaboratif, post-it collectif, vote par gommettes
// ---------------------------------------------------------------------------

/** Question courante, ouverte, du bon type : sinon WlError. */
function &wl_open_question(array &$s, string $qid, array $types): array
{
    if ($s['ended']) {
        throw new WlError('La session est terminée.', 409);
    }
    $i = wl_question_index($s, $qid);
    if (!in_array($s['questions'][$i]['type'], $types, true)) {
        throw new WlError('Action impossible pour cette question.');
    }
    if ($i !== $s['current'] || wl_effective_state($s['questions'][$i]) !== 'open') {
        throw new WlError('Les contributions sont fermées pour cette question.', 409);
    }
    return $s['questions'][$i];
}

function wl_post_index(array $q, string $pid): int
{
    foreach ($q['posts'] as $i => $p) {
        if ($p['id'] === $pid) {
            return $i;
        }
    }
    throw new WlError('Contribution introuvable.', 404);
}

/** Ajoute un message (mur) ou un post-it (colonne $col) d'un participant. */
function wl_post_add(array &$s, string $pkey, string $qid, mixed $text, mixed $col): array
{
    $q = &wl_open_question($s, $qid, WL_POST_TYPES);
    $max = (int)wl_config()['max_posts'];
    if (count(array_filter($q['posts'], fn($p) => $p['p'] === $pkey)) >= $max) {
        throw new WlError("Vous avez déjà publié $max contributions sur cette question.", 409);
    }
    $post = ['id' => 'n' . bin2hex(random_bytes(5)), // préfixe : jamais une clé numérique en JSON
        'p' => $pkey, 'text' => wl_clean_free_text($text),
        'col' => $q['type'] === 'postit' ? wl_index($col, count($q['options'])) : 0,
        't' => time(), 'likes' => [], 'parent' => null];
    $q['posts'][] = $post;
    return $post;
}

/** Un participant retire sa propre contribution tant que c'est ouvert. */
function wl_post_delete(array &$s, string $pkey, string $qid, string $pid): void
{
    $q = &wl_open_question($s, $qid, WL_POST_TYPES);
    $i = wl_post_index($q, $pid);
    if ($q['posts'][$i]['p'] !== $pkey) {
        throw new WlError('Vous ne pouvez retirer que vos propres contributions.', 403);
    }
    wl_post_remove($q, $i);
}

function wl_post_remove(array &$q, int $i): void
{
    $pid = $q['posts'][$i]['id'];
    array_splice($q['posts'], $i, 1);
    foreach ($q['posts'] as &$p) {
        if ($p['parent'] === $pid) {
            $p['parent'] = null;
        }
    }
}

/** « J'aime » sur le mur : un par participant et par message, bascule. */
function wl_like(array &$s, string $pkey, string $qid, string $pid): bool
{
    $q = &wl_open_question($s, $qid, ['wall']);
    $i = wl_post_index($q, $pid);
    if (!wl_shown($q) || in_array($pid, $q['hidden'], true)) {
        throw new WlError('Ce message n\'est pas affiché.', 409);
    }
    $likes = &$q['posts'][$i]['likes'];
    $liked = !in_array($pkey, $likes, true);
    $likes = $liked ? [...$likes, $pkey] : array_values(array_diff($likes, [$pkey]));
    return $liked;
}

/** Animateur : déplacer un post-it de colonne, le regrouper sous un autre, le détacher. */
function wl_post_admin(array &$s, string $qid, string $pid, string $op, mixed $arg): void
{
    $q = &$s['questions'][wl_question_index($s, $qid)];
    $i = wl_post_index($q, $pid);
    switch ($op) {
        case 'move':
            $col = wl_index($arg, max(1, count($q['options'])));
            foreach ($q['posts'] as &$p) {
                if ($p['id'] === $pid || $p['parent'] === $pid) {
                    $p['col'] = $col; // le groupe suit son post-it principal
                }
            }
            return;
        case 'group':
            $target = $q['posts'][wl_post_index($q, (string)$arg)];
            if ($target['id'] === $pid || $target['parent'] !== null) {
                throw new WlError('Regroupez sous un post-it principal.');
            }
            foreach ($q['posts'] as &$p) {
                if ($p['id'] === $pid || $p['parent'] === $pid) {
                    [$p['parent'], $p['col']] = [$target['id'], $target['col']];
                }
            }
            return;
        case 'ungroup':
            $q['posts'][$i]['parent'] = null;
            return;
        case 'delete':
            wl_post_remove($q, $i);
            return;
    }
    throw new WlError('Commande inconnue.');
}

/** Contributions vues par un participant : les siennes toujours, celles des
 *  autres seulement quand l'animateur a affiché les résultats (il a pu relire
 *  et masquer avant : une réponse peut contenir un nom). */
function wl_participant_posts(array $q, string $pkey): array
{
    $out = [];
    foreach ($q['posts'] as $p) {
        $mine = $p['p'] === $pkey;
        // Masquer un post-it principal masque aussi ceux regroupés dessous.
        $hidden = in_array($p['id'], $q['hidden'], true) || in_array($p['parent'], $q['hidden'], true);
        if ($mine || (wl_shown($q) && !$hidden)) {
            $out[] = ['id' => $p['id'], 'text' => $p['text'], 'col' => min($p['col'], max(0, count($q['options']) - 1)),
                'likes' => count($p['likes']), 'liked' => in_array($pkey, $p['likes'], true), 'mine' => $mine];
        }
    }
    return $out;
}

/** Mur : plus aimés d'abord, puis plus récents. */
function wl_wall_results(array $q, bool $admin): array
{
    $out = [];
    foreach ($q['posts'] as $p) {
        $hidden = in_array($p['id'], $q['hidden'], true);
        if ($admin || !$hidden) {
            $out[] = ['id' => $p['id'], 'text' => $p['text'], 'likes' => count($p['likes']), 't' => $p['t']]
                + ($admin ? ['hidden' => $hidden] : []);
        }
    }
    usort($out, fn($a, $b) => $b['likes'] <=> $a['likes'] ?: $b['t'] <=> $a['t']);
    return array_map(function ($p) {
        unset($p['t']);
        return $p;
    }, $out);
}

/** Post-it : ordre d'arrivée ; colonne ramenée dans les bornes si une colonne a été retirée. */
function wl_postit_results(array $q, bool $admin): array
{
    $last = max(0, count($q['options']) - 1);
    $out = [];
    foreach ($q['posts'] as $p) {
        $hidden = in_array($p['id'], $q['hidden'], true) || in_array($p['parent'], $q['hidden'], true);
        if ($admin || !$hidden) {
            $out[] = ['id' => $p['id'], 'text' => $p['text'], 'col' => min($p['col'], $last), 'parent' => $p['parent']]
                + ($admin ? ['hidden' => $hidden] : []);
        }
    }
    return $out;
}

/** Idées soumises aux gommettes : post-its (ou messages) principaux visibles
 *  de la question source, avec le texte des post-its regroupés dessous. */
function wl_dot_items(array $s, array $q): array
{
    $src = null;
    foreach ($s['questions'] as $c) {
        // Source publiée seulement : avant, ses contributions n'ont pas été relues.
        if ($c['id'] === $q['source'] && in_array($c['type'], WL_POST_TYPES, true) && wl_shown($c)) {
            $src = $c;
        }
    }
    if (!$src) {
        return [];
    }
    $items = [];
    foreach ($src['posts'] as $p) {
        $column = $q['column'] ?? -1;
        if ($p['parent'] === null && !in_array($p['id'], $src['hidden'], true) && ($column < 0 || ($p['col'] ?? 0) === $column)) {
            $items[$p['id']] = ['id' => $p['id'], 'text' => $p['text'], 'grouped' => []];
        }
    }
    foreach ($src['posts'] as $p) {
        if ($p['parent'] !== null && isset($items[$p['parent']]) && !in_array($p['id'], $src['hidden'], true)) {
            $items[$p['parent']]['grouped'][] = $p['text'];
        }
    }
    return array_values($items);
}

/** Gommettes : {id d'idée: nombre}, entre 1 et budget au total, plusieurs sur une même idée permises. */
function wl_clean_dots(mixed $v, array $items, int $budget): array
{
    $ids = array_column($items, 'id');
    if (!is_array($v) || !$ids) {
        throw new WlError('Aucune idée à départager.');
    }
    $clean = [];
    foreach ($v as $id => $n) {
        if (!in_array((string)$id, $ids, true)) {
            throw new WlError('Idée inconnue : rechargez la page.');
        }
        $n = wl_index($n, $budget + 1);
        if ($n > 0) {
            $clean[(string)$id] = $n;
        }
    }
    $sum = array_sum($clean);
    if ($sum < 1 || $sum > $budget) {
        throw new WlError("Collez entre 1 et $budget gommettes.");
    }
    ksort($clean);
    return $clean;
}

/** Classement des idées par gommettes reçues. */
function wl_dots_results(array $q, array $items): array
{
    $counts = array_fill_keys(array_column($items, 'id'), 0);
    foreach ($q['answers'] as $a) {
        foreach ($a['v'] as $id => $n) {
            if (isset($counts[$id])) {
                $counts[$id] += $n;
            }
        }
    }
    $out = array_map(fn($it) => $it + ['n' => $counts[$it['id']]], $items);
    usort($out, fn($a, $b) => $b['n'] <=> $a['n']);
    return $out;
}

// ---------------------------------------------------------------------------
// Signaler une difficulté (anonyme, 2 minutes)
// ---------------------------------------------------------------------------

const WL_SIGNALS = ['fast' => 'Trop vite', 'again' => 'À réexpliquer', 'help' => 'Besoin d\'aide'];
const WL_SIGNAL_TTL = 120; // un signal reflète le moment présent, puis s'efface

/** Un signal par participant ; le même signal renvoyé (ou vide) le retire.
 *  « Besoin d'aide » peut viser une étape d'un défi : $step = ['q' => id de la question, 'i' => indice].
 *  Retourne le signal en cours, ou null. */
function wl_signal(array &$s, string $pkey, mixed $kind, mixed $step = null): ?string
{
    $kind = is_string($kind) ? $kind : '';
    if ($kind !== '' && !isset(WL_SIGNALS[$kind])) {
        throw new WlError('Signal inconnu.');
    }
    $at = [];
    if ($step !== null && $step !== []) {
        $qid = is_array($step) ? (string)($step['q'] ?? '') : '';
        $i = is_array($step) ? ($step['i'] ?? null) : null;
        $q = array_values(array_filter($s['questions'], fn($x) => $x['id'] === $qid))[0] ?? null;
        if ($kind !== 'help' || !$q || $q['type'] !== 'steps' || !is_int($i) || $i < 0 || $i >= count($q['options'])) {
            throw new WlError('Étape inconnue.');
        }
        $at = ['q' => $qid, 'i' => $i];
    }
    $now = time();
    // Ménage des signaux expirés à chaque écriture.
    $s['signals'] = array_filter($s['signals'] ?? [], fn($x) => $now - $x['t'] < WL_SIGNAL_TTL);
    $cur = $s['signals'][$pkey] ?? null;
    if ($kind === '' || ($cur && $cur['k'] === $kind && ($cur['q'] ?? null) === ($at['q'] ?? null) && ($cur['i'] ?? null) === ($at['i'] ?? null))) {
        unset($s['signals'][$pkey]);
        return null;
    }
    $s['signals'][$pkey] = ['k' => $kind, 't' => $now] + $at;
    return $kind;
}

/** « Besoin d'aide » par étape : [['q' => id, 'i' => indice, 'n' => nombre], …], le plus demandé d'abord.
 *  Jamais qui l'a envoyé. */
function wl_signal_steps(array $s, ?int $now = null): array
{
    $now ??= time();
    $by = [];
    foreach ($s['signals'] ?? [] as $x) {
        if ($now - $x['t'] < WL_SIGNAL_TTL && isset($x['q'])) {
            $by[$x['q'] . '|' . $x['i']] = ['q' => $x['q'], 'i' => $x['i'], 'n' => ($by[$x['q'] . '|' . $x['i']]['n'] ?? 0) + 1];
        }
    }
    $list = array_values($by);
    usort($list, fn($a, $b) => $b['n'] <=> $a['n'] ?: $a['i'] <=> $b['i']);
    return $list;
}

/** Nombre de signaux en cours, par sorte (jamais qui les a envoyés). */
function wl_signal_counts(array $s, ?int $now = null): array
{
    $now ??= time();
    $counts = array_fill_keys(array_keys(WL_SIGNALS), 0);
    foreach ($s['signals'] ?? [] as $x) {
        if ($now - $x['t'] < WL_SIGNAL_TTL) {
            $counts[$x['k']]++;
        }
    }
    return $counts;
}

// ---------------------------------------------------------------------------
// Oser demander : questions anonymes des participants, votes, modération
// ---------------------------------------------------------------------------

function wl_ask_index(array $s, string $aid): int
{
    foreach ($s['asks'] ?? [] as $i => $a) {
        if ($a['id'] === $aid) {
            return $i;
        }
    }
    throw new WlError('Question introuvable.', 404);
}

/** Question d'un participant : visible des autres seulement une fois publiée
 *  par l'animateur (elle peut contenir un nom). */
function wl_ask_add(array &$s, string $pkey, mixed $text): array
{
    if (empty($s['asksOpen']) || $s['ended']) {
        throw new WlError('« Oser demander » est fermé.', 409);
    }
    $max = (int)wl_config()['max_posts'];
    if (count(array_filter($s['asks'] ?? [], fn($a) => $a['p'] === $pkey)) >= $max) {
        throw new WlError("Vous avez déjà posé $max questions.", 409);
    }
    $ask = ['id' => 'q' . bin2hex(random_bytes(5)), 'p' => $pkey, 'text' => wl_clean_free_text($text),
        't' => time(), 'votes' => [], 'published' => false, 'answered' => false];
    $s['asks'][] = $ask;
    return $ask;
}

/** Vote « moi aussi » sur une question publiée : un par participant, bascule. */
function wl_ask_vote(array &$s, string $pkey, string $aid): bool
{
    if (empty($s['asksOpen']) || $s['ended']) {
        throw new WlError('« Oser demander » est fermé.', 409);
    }
    $a = &$s['asks'][wl_ask_index($s, $aid)];
    if (!$a['published']) {
        throw new WlError('Cette question n\'est pas affichée.', 409);
    }
    if ($a['p'] === $pkey) {
        throw new WlError('Vous ne pouvez pas voter pour votre propre question.', 409);
    }
    $voted = !in_array($pkey, $a['votes'], true);
    $a['votes'] = $voted ? [...$a['votes'], $pkey] : array_values(array_diff($a['votes'], [$pkey]));
    return $voted;
}

/** Animateur : publier, masquer, marquer répondue, supprimer. */
function wl_ask_admin(array &$s, string $aid, string $op): void
{
    $i = wl_ask_index($s, $aid);
    match ($op) {
        'publish', 'unpublish' => $s['asks'][$i]['published'] = $op === 'publish',
        'answered', 'unanswered' => $s['asks'][$i]['answered'] = $op === 'answered',
        'delete' => array_splice($s['asks'], $i, 1),
        default => throw new WlError('Commande inconnue.'),
    };
}

/** Questions triées : non répondues d'abord, puis les plus votées. $pkey :
 *  vue d'un participant (publiées + les siennes en attente) ; null : animateur
 *  (toutes) ; '' : projection (publiées seulement). Jamais l'auteur. */
function wl_asks_view(array $s, ?string $pkey): array
{
    $list = [];
    foreach ($s['asks'] ?? [] as $a) {
        $mine = $pkey !== null && $pkey !== '' && $a['p'] === $pkey;
        if ($pkey !== null && !$a['published'] && !$mine) {
            continue;
        }
        $item = ['id' => $a['id'], 'text' => $a['text'], 'votes' => count($a['votes']),
            'answered' => $a['answered'], 't' => $a['t']];
        if ($pkey === null) {
            $item['published'] = $a['published'];
        } elseif ($pkey !== '') {
            $item += ['mine' => $mine, 'pending' => !$a['published'], 'voted' => in_array($pkey, $a['votes'], true)];
        }
        $list[] = $item;
    }
    usort($list, fn($x, $y) => [$x['answered'], -$x['votes'], $x['t']] <=> [$y['answered'], -$y['votes'], $y['t']]);
    return array_map(function ($x) { unset($x['t']); return $x; }, $list);
}

// ---------------------------------------------------------------------------
// Pseudonymes tirés au hasard et classement des quiz (option par session)
// ---------------------------------------------------------------------------

// Noms masculins et adjectifs accordés : « Panda curieux », jamais saisi par l'élève.
const WL_PSEUDO_ANIMALS = ['Panda', 'Koala', 'Hibou', 'Renard', 'Castor', 'Dauphin', 'Lynx', 'Pingouin',
    'Hérisson', 'Écureuil', 'Faucon', 'Lama', 'Zèbre', 'Tigre', 'Loup', 'Ours', 'Phoque', 'Colibri',
    'Toucan', 'Manchot', 'Chamois', 'Bison', 'Blaireau', 'Chevreuil', 'Flamant', 'Héron', 'Jaguar',
    'Lézard', 'Mouflon', 'Poulpe'];
const WL_PSEUDO_ADJECTIVES = ['agile', 'brillant', 'calme', 'curieux', 'discret', 'futé', 'joyeux', 'malin',
    'rapide', 'rêveur', 'rusé', 'sage', 'souriant', 'tranquille', 'vaillant', 'vif', 'zen', 'audacieux',
    'patient', 'créatif', 'enjoué', 'espiègle', 'inventif', 'serein', 'généreux', 'attentif', 'habile',
    'sportif', 'poétique', 'radieux'];

/** Donne un pseudonyme libre à un participant (si l'option est active). */
function wl_assign_pseudo(array &$s, string $pkey): void
{
    if (empty($s['pseudo']) || isset($s['pseudos'][$pkey])) {
        return;
    }
    $taken = array_flip($s['pseudos'] ?? []);
    for ($try = 0; $try < 200; $try++) {
        $name = WL_PSEUDO_ANIMALS[random_int(0, count(WL_PSEUDO_ANIMALS) - 1)] . ' '
            . WL_PSEUDO_ADJECTIVES[random_int(0, count(WL_PSEUDO_ADJECTIVES) - 1)];
        if (!isset($taken[$name])) {
            break;
        }
    }
    $s['pseudos'][$pkey] = $name;
}

/** Questions qui comptent au classement : quiz à bonne réponse, correction affichée. */
function wl_scored_questions(array $s): array
{
    return array_values(array_filter($s['questions'], fn($q) => !empty($q['correct'])
        && in_array($q['type'], ['yesno', 'truefalse', 'mcq'], true) && wl_shown($q)));
}

/** Bonnes réponses par participant (clé => nombre). */
function wl_scores(array $s): array
{
    $scores = array_fill_keys(array_keys($s['pseudos'] ?? []), 0);
    foreach (wl_scored_questions($s) as $q) {
        $want = $q['correct'];
        sort($want);
        foreach ($q['answers'] as $pkey => $a) {
            $v = (array)$a['v'];
            sort($v);
            if ($v === $want && isset($scores[$pkey])) {
                $scores[$pkey]++;
            }
        }
    }
    return $scores;
}

/** Classement par pseudonyme : rang (ex aequo partagé), pseudonyme, score. */
function wl_ranking(array $s): array
{
    $rows = [];
    foreach (wl_scores($s) as $pkey => $score) {
        $rows[] = ['name' => $s['pseudos'][$pkey], 'score' => $score];
    }
    usort($rows, fn($a, $b) => [-$a['score'], $a['name']] <=> [-$b['score'], $b['name']]);
    foreach ($rows as $i => &$r) {
        $r['rank'] = $i > 0 && $rows[$i - 1]['score'] === $r['score'] ? $rows[$i - 1]['rank'] : $i + 1;
    }
    return $rows;
}

/** Podium projeté : les rangs 1 à 3 seulement (personne n'est montré dernier). */
function wl_podium(array $s): array
{
    return array_values(array_filter(wl_ranking($s), fn($r) => $r['rank'] <= 3 && $r['score'] > 0));
}

/** Projection « Oser demander » ou « Podium » (à la demande de l'animateur). */
function wl_show_view(array $s): array
{
    $base = ['code' => $s['code'], 'title' => $s['title'], 'ended' => $s['ended'],
        'participants' => count($s['participants']), 'qrHidden' => !empty($s['qrHidden']),
        'joinUrl' => wl_join_url($s['code']), 'now' => time(), 'pollMs' => (int)wl_config()['poll_ms'],
        'show' => $s['show'], 'asksOpen' => !empty($s['asksOpen']), 'asksCount' => count(wl_asks_view($s, ''))];
    return $base + ($s['show'] === 'asks'
        ? ['asks' => wl_asks_view($s, '')]
        : ['podium' => wl_podium($s), 'scored' => count(wl_scored_questions($s))]);
}

// ---------------------------------------------------------------------------
// Tâche planifiée : preuve de passage
// ---------------------------------------------------------------------------

/** Réglages de l'animateur communs à tous ses appareils : fonctions en essai
 *  (fichier prefs.json dans les données, jamais effacé par la purge). */
function wl_prefs(): array
{
    $f = wl_data_dir() . '/prefs.json';
    $p = is_file($f) ? json_decode((string)file_get_contents($f), true) : null;
    return ['beta' => is_array($p) && !empty($p['beta'])];
}

function wl_prefs_save(array $in): array
{
    $prefs = ['beta' => !empty($in['beta'])];
    // Verrou + écriture atomique : deux appareils à la fois, ou un dossier non inscriptible, donnent une erreur et non un faux « enregistré ».
    wl_locked_json(wl_data_dir() . '/prefs.json', function (array &$d) use ($prefs) {
        $d = $prefs;
    });
    return $prefs;
}

/** Dernier passage de purge.php lancé par la tâche planifiée (null : jamais).
 *  Distinct de last-purge, que les simples visites mettent aussi à jour. */
function wl_last_cron(): ?int
{
    $f = wl_data_dir() . '/last-cron';
    return is_file($f) ? filemtime($f) : null;
}

// ---------------------------------------------------------------------------
// Téléphones actifs : signe de vie toutes les 60 s, sans réveiller personne
// ---------------------------------------------------------------------------

const WL_ACTIVE_TTL = 180; // sans signe de vie depuis 3 min : téléphone éteint ou parti

/** Note le signe de vie d'un participant. N'avance aucune version : ni les
 *  téléphones ni la projection ne se rafraîchissent pour ça (coût du polling). */
function wl_seen(string $code, string $pkey): void
{
    wl_locked_json(wl_session_file($code), function (array &$s) use ($pkey) {
        if (!isset($s['participants'][$pkey])) {
            throw new WlError('Rejoignez d\'abord la session avec son code.', 403);
        }
        $s['seen'][$pkey] = time();
    }, true);
}

/** Participants actifs : signe de vie, arrivée ou réponse à la question en
 *  cours depuis moins de 3 min. Sert de dénominateur à « x / n ont répondu ». */
function wl_active_count(array $s, ?int $now = null): int
{
    $now ??= time();
    $q = wl_current_question($s);
    $n = 0;
    // Démo : dix des douze participants fictifs restent présents (deux sont « partis »).
    $present = array_flip(array_slice(wl_demo_fake($s), 0, 10));
    foreach ($s['participants'] as $pkey => $joined) {
        $last = max((int)$joined, (int)($s['seen'][$pkey] ?? 0), (int)($q['answers'][$pkey]['t'] ?? 0));
        $n += $now - $last < WL_ACTIVE_TTL || isset($q['answers'][$pkey]) || isset($present[$pkey]) ? 1 : 0;
    }
    return $n;
}

// ---------------------------------------------------------------------------
// Session de démonstration (participants fictifs, pour répéter seul)
// ---------------------------------------------------------------------------

/** Thèmes de démonstration (contenu fictif, tiré au hasard à chaque démo). */
const WL_DEMO_THEMES = [
    ['title' => 'Temps d\'écran',
     'poll' => ['Votre météo du jour ?', ['☀️ Grand soleil', '🌤️ Quelques nuages', '🌧️ Pluie', '⛈️ Orage']],
     'yesno' => ['Votre téléphone dort-il hors de la chambre ?', 'Hors de la chambre, il ne réveille personne la nuit.', 0],
     'mcq' => ['Quels réglages limitent les notifications ?', ['Ne pas déranger', 'Mode concentration', 'Luminosité', 'Fond d\'écran']],
     'tf' => ['La lumière des écrans retarde l\'endormissement.', 0],
     'cloud' => ['Un mot pour « temps d\'écran » ?', ['Fatigue', 'Vidéos', 'Jeux', 'Réseaux', 'Sommeil', 'Musique', 'fatigue', 'vidéos', 'Fatigue', 'Messages', 'Jeux', 'Séries']],
     'scale' => 'Vous sentez-vous capable de faire une pause ?',
     'points' => ['Répartissez 10 points entre vos priorités', ['Sommeil', 'Sport', 'Amis']],
     'wall' => ['Une activité sans écran que vous aimez ?', ['Le foot avec les copains', 'Cuisiner en famille', 'Dessiner', 'Lire des mangas', 'Le vélo']],
     'postit' => ['Ce qui aide / ce qui freine', ['Ce qui aide', 'Ce qui freine'], ['Téléphone au salon', 'Un réveil classique', 'Le sport', 'Les notifications', 'L\'ennui', 'Les séries qui enchaînent']],
     'dots' => 'Lesquelles voulez-vous tester ?',
     'asks' => ['Comment couper les notifications la nuit ?', 'Est-ce que TikTok écoute nos conversations ?', 'Le mode avion abîme-t-il le téléphone ?']],
    ['title' => 'Arnaques en ligne',
     'poll' => ['Avez-vous déjà reçu un message suspect ?', ['📱 Par SMS', '📧 Par mail', '📞 Par téléphone', '🙅 Jamais']],
     'yesno' => ['Votre banque peut-elle vous demander votre code par SMS ?', 'Jamais : une banque ne demande pas de code par SMS ni par mail.', 1],
     'mcq' => ['Quels signes doivent alerter ?', ['Urgence à agir', 'Lien raccourci', 'Logo officiel', 'Message en français']],
     'tf' => ['Un site avec un cadenas est forcément honnête.', 1],
     'cloud' => ['Un mot qui vous fait penser à « arnaque » ?', ['Colis', 'Banque', 'Urgent', 'Piège', 'Lien', 'Faux', 'colis', 'banque', 'Colis', 'Peur', 'Argent', 'Lien']],
     'scale' => 'Vous sentez-vous capable de repérer une arnaque ?',
     'points' => ['Répartissez 10 points : quels réflexes en priorité ?', ['Ne pas cliquer', 'Appeler la banque', 'Signaler']],
     'wall' => ['Une arnaque que vous avez reçue ?', ['Faux colis en attente', 'Faux conseiller bancaire', 'Gain à un concours', 'Amende impayée', 'Compte CAF bloqué']],
     'postit' => ['Avant de cliquer / après un doute', ['Avant de cliquer', 'Après un doute'], ['Vérifier l\'expéditeur', 'Lire l\'adresse du lien', 'Ne pas se presser', 'Appeler la vraie banque', 'Changer le mot de passe', 'Signaler sur 33700']],
     'dots' => 'Lesquels allez-vous appliquer ?',
     'asks' => ['Que faire si j\'ai déjà cliqué sur le lien ?', 'Comment savoir si un SMS vient vraiment de La Poste ?', 'Mon compte peut-il être piraté par un simple appel ?']],
    ['title' => 'Mots de passe',
     'poll' => ['Combien de mots de passe différents utilisez-vous ?', ['1 seul', '2 ou 3', 'Plus de 3', 'Je ne sais pas']],
     'yesno' => ['Notez-vous vos mots de passe sur papier ?', 'Un carnet rangé chez soi est plus sûr qu\'un seul mot de passe pour tout.', null],
     'mcq' => ['Quels mots de passe sont solides ?', ['Trois mots au hasard', 'Une phrase de passe', 'Sa date de naissance', 'azerty123']],
     'tf' => ['Un même mot de passe partout, c\'est sans risque s\'il est long.', 1],
     'cloud' => ['Un mot pour « mot de passe » ?', ['Oubli', 'Galère', 'Sécurité', 'Code', 'Clé', 'oubli', 'Carnet', 'Oubli', 'Stress', 'Code', 'Protection', 'Clé']],
     'scale' => 'Vos mots de passe sont-ils assez sûrs ?',
     'points' => ['Répartissez 10 points : quoi protéger d\'abord ?', ['Messagerie', 'Banque', 'Réseaux sociaux']],
     'wall' => ['Une astuce pour retenir un mot de passe ?', ['Une phrase de chanson', 'Trois mots au hasard', 'Un carnet rangé', 'Un gestionnaire', 'Les initiales d\'une phrase']],
     'postit' => ['Ce que je fais / ce que je ne fais pas', ['Je fais', 'Je ne fais pas'], ['Mots de passe différents', 'Validation en deux étapes', 'Phrase de passe', 'Changer après une fuite', 'Gestionnaire de mots de passe', 'Vérifier haveibeenpwned']],
     'dots' => 'Lesquelles allez-vous essayer ?',
     'asks' => ['C\'est quoi la validation en deux étapes ?', 'Un gestionnaire de mots de passe, c\'est sûr ?', 'Que faire si on a oublié son mot de passe ?']],
    ['title' => 'Réseaux sociaux',
     'poll' => ['Le réseau que vous ouvrez le plus ?', ['WhatsApp', 'Facebook', 'Instagram', 'TikTok']],
     'yesno' => ['Votre profil est-il visible de tout le monde ?', 'Par défaut, beaucoup de profils sont publics : vérifiez vos réglages.', null],
     'mcq' => ['Quelles informations éviter de publier ?', ['Son adresse', 'Ses dates de vacances', 'Une photo de paysage', 'Son plat préféré']],
     'tf' => ['Un message supprimé disparaît forcément pour tout le monde.', 1],
     'cloud' => ['Un mot pour « réseaux sociaux » ?', ['Partage', 'Amis', 'Vidéos', 'Temps', 'Photos', 'partage', 'Infos', 'Amis', 'Pub', 'Vidéos', 'Famille', 'Temps']],
     'scale' => 'Maîtrisez-vous vos réglages de confidentialité ?',
     'points' => ['Répartissez 10 points : à quoi servent les réseaux pour vous ?', ['Garder le contact', 'S\'informer', 'Se divertir']],
     'wall' => ['Un bon usage des réseaux sociaux ?', ['Garder le lien avec la famille', 'Partager ses passions', 'Trouver des infos locales', 'Groupes d\'entraide', 'Suivre des tutos']],
     'postit' => ['Ce que j\'aime / ce qui me dérange', ['J\'aime', 'Me dérange'], ['Les photos de famille', 'Les groupes du quartier', 'Les vidéos drôles', 'Les fausses infos', 'Les publicités', 'Le temps perdu']],
     'dots' => 'Lesquels voulez-vous travailler ensemble ?',
     'asks' => ['Comment rendre mon profil privé ?', 'Comment repérer une fausse information ?', 'Peut-on supprimer un vieux compte ?']],
];

/** Participants fictifs d'une démo. Les démos créées avant ce réglage n'ont pas la
 *  liste : ce sont les douze premiers inscrits (ils précèdent les vrais). */
function wl_demo_fake(array $s): array
{
    return $s['fake'] ?? (!empty($s['demo']) ? array_slice(array_keys($s['participants']), 0, 12) : []);
}

/** Tirage pondéré : renvoie l'indice choisi. */
function wl_demo_pick(array $weights): int
{
    $r = random_int(1, max(1, array_sum($weights)));
    foreach ($weights as $i => $w) {
        if (($r -= $w) <= 0) {
            return (int)$i;
        }
    }
    return 0;
}

/** Démo : les participants fictifs répondent à une question ajoutée après coup,
 *  pour voir une salle pleine. Un « après » (avant / après) progresse. Rien pour
 *  le mur et le post-it (il faudrait inventer des textes). */
function wl_demo_simulate(array $s, array &$q): void
{
    $fake = wl_demo_fake($s);
    if (!$fake || $q['answers'] || $q['posts']) {
        return;
    }
    $now = time();
    $n = count($q['options']);
    $good = ($q['compare'] ?? '') !== '' ? 85 : 55; // part de bonnes réponses
    $words = ['Pause', 'Calme', 'Simple', 'Utile', 'Concret', 'Clair', 'Pratique', 'Rapide'];
    $texts = ['Faire une pause toutes les heures.', 'Couper les notifications le soir.', 'En parler avec mes proches.',
        'Tester le mode sommeil.', 'Ranger mon téléphone la nuit.'];
    $dots = $q['type'] === 'dots' ? wl_dot_items($s, $q) : [];
    foreach ($fake as $k => $pk) {
        $v = match ($q['type']) {
            'yesno', 'truefalse', 'mcq', 'poll' => (function () use ($q, $n, $good) {
                if ($q['correct']) {
                    $right = random_int(1, 100) <= $good;
                    $wrong = array_values(array_diff(range(0, $n - 1), $q['correct']));
                    if ($q['type'] === 'mcq' && $q['multi']) {
                        return $right ? $q['correct'] : [$wrong[array_rand($wrong)]];
                    }
                    return $right ? $q['correct'][0] : $wrong[array_rand($wrong)];
                }
                return wl_demo_pick(array_map(fn() => random_int(1, 5), range(1, $n)));
            })(),
            'scale' => 1 + wl_demo_pick(array_map(function ($i) use ($q, $good) {
                $center = ($good > 60 ? .85 : .55) * $q['scaleMax'];
                return max(1, (int)round(10 - abs($i + 1 - $center) * 2));
            }, range(0, $q['scaleMax'] - 1))),
            'wordcloud' => $words[array_rand($words)],
            'text' => $texts[array_rand($texts)],
            'points' => (function () use ($n, $q) {
                $left = $q['budget'];
                $pts = array_fill(0, $n, 0);
                while ($left-- > 0) {
                    $pts[random_int(0, $n - 1)]++;
                }
                return $pts;
            })(),
            'steps' => (function () use ($n) {
                $m = wl_demo_pick([1, ...array_fill(1, $n - 1, 3), 5]); // étapes faites, dans l'ordre
                return $m ? range(0, $m - 1) : null;
            })(),
            'dots' => (function () use ($dots, $q) {
                $votes = [];
                for ($g = 0; $g < $q['budget'] && $dots; $g++) {
                    $id = $dots[array_rand($dots)]['id'];
                    $votes[$id] = ($votes[$id] ?? 0) + 1;
                }
                ksort($votes);
                return $votes ?: null;
            })(),
            default => null,
        };
        if ($v !== null) {
            if (is_array($v) && $q['type'] === 'mcq') {
                sort($v);
            }
            $q['answers'][$pk] = ['v' => $v, 't' => $now - 120 + $k];
        }
    }
}

/** Remplit une session neuve sur un thème tiré au hasard : une question de
 *  chaque type, résultats affichés, 12 participants fictifs, questions « Oser
 *  demander », pseudonymes, signaux. Retourne le titre du thème. */
function wl_demo_fill(array &$s, ?int $theme = null): string
{
    $t = WL_DEMO_THEMES[$theme ?? random_int(0, count(WL_DEMO_THEMES) - 1)];
    $mk = fn(array $in) => wl_clean_question($in);
    $q = [
        $mk(['type' => 'poll', 'text' => $t['poll'][0], 'options' => $t['poll'][1]]),
        $mk(['type' => 'yesno', 'text' => $t['yesno'][0], 'explain' => $t['yesno'][1],
            'correct' => $t['yesno'][2] === null ? [] : [$t['yesno'][2]]]),
        $mk(['type' => 'mcq', 'text' => $t['mcq'][0], 'multi' => true, 'correct' => [0, 1], 'options' => $t['mcq'][1]]),
        $mk(['type' => 'truefalse', 'text' => $t['tf'][0], 'correct' => [$t['tf'][1]]]),
        $mk(['type' => 'wordcloud', 'text' => $t['cloud'][0]]),
        $mk(['type' => 'scale', 'text' => $t['scale'], 'scaleMax' => 5]),
        $mk(['type' => 'points', 'text' => $t['points'][0], 'options' => $t['points'][1], 'budget' => 10]),
        $mk(['type' => 'wall', 'text' => $t['wall'][0]]),
        $mk(['type' => 'postit', 'text' => $t['postit'][0], 'options' => $t['postit'][1]]),
    ];
    $q[] = $mk(['type' => 'dots', 'text' => $t['dots'], 'source' => $q[8]['id'], 'budget' => 3]);
    $now = time();
    $p = [];
    for ($i = 0; $i < 12; $i++) {
        $p[] = 'p' . substr(bin2hex(random_bytes(8)), 0, 15);
    }
    $pick = fn(array $weights) => wl_demo_pick($weights);
    $words = $t['cloud'][1];
    foreach ($p as $k => $pk) {
        $answer = fn($v) => ['v' => $v, 't' => $now - 600 + $k];
        $q[0]['answers'][$pk] = $answer($pick([5, 4, 2, 1]));
        $q[1]['answers'][$pk] = $answer($pick(($t['yesno'][2] ?? 0) === 0 ? [8, 4] : [4, 8]));
        $q[2]['answers'][$pk] = $answer(array_values(array_unique([$pick([6, 3, 2, 1]), $pick([3, 6, 1, 1])])));
        sort($q[2]['answers'][$pk]['v']);
        $q[3]['answers'][$pk] = $answer($pick($t['tf'][1] === 0 ? [9, 3] : [3, 9]));
        $q[4]['answers'][$pk] = $answer($words[$k]);
        $q[5]['answers'][$pk] = $answer(1 + $pick([1, 2, 4, 4, 2]));
        $a = random_int(2, 6);
        $b = random_int(0, 10 - $a);
        $q[6]['answers'][$pk] = $answer([$a, $b, 10 - $a - $b]);
    }
    $post = fn(int $k, string $text, int $col = 0) => ['id' => 'n' . bin2hex(random_bytes(5)), 'p' => $p[$k],
        'text' => $text, 'col' => $col, 't' => $now - 500 + $k, 'likes' => [], 'parent' => null];
    foreach ($t['wall'][1] as $k => $text) {
        $q[7]['posts'][] = $post($k, $text);
    }
    $q[7]['posts'][0]['likes'] = array_slice($p, 5, 4);
    $q[7]['posts'][1]['likes'] = array_slice($p, 6, 2);
    $q[7]['posts'][2]['likes'] = [$p[9]];
    foreach ($t['postit'][2] as $k => $text) {
        $q[8]['posts'][] = $post($k, $text, $k < 3 ? 0 : 1);
    }
    foreach ($q as &$x) {
        $x['state'] = 'closed';
        $x['showResults'] = true;
    }
    unset($x);
    $ids = array_column($q[8]['posts'], 'id');
    foreach ($p as $k => $pk) {
        $v = [$ids[$k % 3] => 2, $ids[3 + $k % 3] => 1];
        ksort($v);
        $q[9]['answers'][$pk] = ['v' => $v, 't' => $now - 300 + $k];
    }
    $s['questions'] = $q;
    $s['participants'] = array_fill_keys($p, $now - 900);
    $s['fake'] = $p; // pour répondre à leur place aux questions ajoutées ensuite
    $s['seen'] = array_fill_keys(array_slice($p, 0, 10), $now); // 2 téléphones « partis »
    $s['asksOpen'] = true;
    $ask = fn(int $k, string $text, bool $pub, array $votes) => ['id' => 'q' . bin2hex(random_bytes(5)), 'p' => $p[$k],
        'text' => $text, 't' => $now - 200 + $k, 'votes' => $votes, 'published' => $pub, 'answered' => false];
    $s['asks'] = [
        $ask(0, $t['asks'][0], true, array_slice($p, 3, 5)),
        $ask(1, $t['asks'][1], true, array_slice($p, 4, 2)),
        $ask(2, $t['asks'][2], false, []),
    ];
    $s['pseudo'] = true;
    foreach ($p as $pk) {
        wl_assign_pseudo($s, $pk);
    }
    $s['signals'] = [$p[3] => ['k' => 'fast', 't' => $now], $p[4] => ['k' => 'fast', 't' => $now], $p[5] => ['k' => 'help', 't' => $now]];
    $s['demo'] = true;
    $s['title'] = 'Démo — ' . $t['title'];
    return $t['title'];
}
