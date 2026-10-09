<?php
// Bibliothèque commune : configuration, stockage JSON, validation, sécurité.
// Inclus par index.php, admin.php, screen.php et api.php ; jamais appelé seul.

declare(strict_types=1);

const WL_TYPES = ['yesno', 'truefalse', 'mcq', 'poll', 'wordcloud', 'text', 'scale', 'points', 'wall', 'postit', 'dots'];
const WL_POST_TYPES = ['wall', 'postit']; // contributions multiples (posts), pas une réponse unique
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
    foreach (['', '/sessions', '/rl'] as $sub) {
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

function wl_new_token(): string
{
    return bin2hex(random_bytes(16));
}

function wl_valid_token(?string $t): bool
{
    return is_string($t) && preg_match('/^[a-f0-9]{32}$/', $t) === 1;
}

/** Compte les écritures par fenêtre d'une minute ; WlError 429 au-delà. */
function wl_rate(string $bucket, int $limit): void
{
    $file = wl_data_dir() . '/rl/' . wl_hash('rl|' . $bucket, 24) . '.json';
    $window = intdiv(time(), 60);
    wl_locked_json($file, function (array &$d) use ($window, $limit) {
        if (($d['w'] ?? 0) !== $window) {
            $d = ['w' => $window, 'n' => 0];
        }
        if (++$d['n'] > $limit) {
            throw new WlError('Trop de requêtes, patientez quelques secondes.', 429);
        }
    });
}

// ---------------------------------------------------------------------------
// Stockage JSON : verrou + écriture atomique
// ---------------------------------------------------------------------------

/** Lit un JSON, le passe à $fn par référence sous verrou exclusif, et
 *  l'écrit atomiquement (fichier temporaire + rename). Retourne ce que
 *  renvoie $fn. Une exception dans $fn annule l'écriture. */
function wl_locked_json(string $file, callable $fn, bool $mustExist = false): mixed
{
    $lock = fopen($file . '.lock', 'c');
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
 *  voit le participant (sinon seul l'écran de projection est rafraîchi). */
function wl_update(string $code, callable $fn, bool $public = true): mixed
{
    return wl_locked_json(wl_session_file($code), function (array &$s) use ($fn, $public) {
        $result = $fn($s);
        $s['version'] = ($s['version'] ?? 0) + 1;
        if ($public) {
            $s['pversion'] = ($s['pversion'] ?? 0) + 1;
        }
        $s['updated'] = time();
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
    $code = wl_new_code();
    $now = time();
    $s = [
        'code' => $code, 'title' => $title, 'created' => $now, 'updated' => $now,
        // current = -1 : écran d'accueil (adresse et code projetés en grand).
        'version' => 1, 'pversion' => 1, 'current' => -1, 'ended' => false,
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
                'ended' => $s['ended'],
            ];
        }
    }
    usort($list, fn($a, $b) => $b['updated'] <=> $a['updated']);
    return $list;
}

function wl_delete_session(string $code): void
{
    $file = wl_session_file($code);
    @unlink($file);
    @unlink($file . '.lock');
}

/** Purge automatique des sessions inactives depuis purge_days jours, au plus
 *  une fois par heure. Élimination d'archives publiques : la durée doit être
 *  validée avec les Archives départementales (voir CHANTIERS.md). */
function wl_maybe_purge(): int
{
    $marker = wl_data_dir() . '/last-purge';
    if (is_file($marker) && filemtime($marker) > time() - 3600) {
        return 0;
    }
    touch($marker);
    $limit = time() - 86400 * max(1, (int)wl_config()['purge_days']);
    $count = 0;
    foreach (glob(wl_data_dir() . '/sessions/*.json') ?: [] as $file) {
        $s = json_decode((string)file_get_contents($file), true);
        if (!is_array($s) || ($s['updated'] ?? 0) < $limit) {
            wl_delete_session(basename($file, '.json'));
            $count++;
        }
    }
    $login = wl_data_dir() . '/login.json';
    if (is_file($login) && filemtime($login) < time() - 900) {
        @unlink($login); // échecs de connexion : utiles 15 minutes seulement
    }
    foreach (glob(wl_data_dir() . '/rl/*') ?: [] as $file) {
        if (filemtime($file) < time() - 3600) {
            @unlink($file);
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
        'duration' => wl_clean_duration($in['duration'] ?? 0),
        'allowChange' => !array_key_exists('allowChange', $in) || !empty($in['allowChange']),
        'anonymous' => true,
        // L'état de vote est conservé si on modifie une question existante.
        'state' => $old['state'] ?? 'draft',
        'showResults' => $old['showResults'] ?? false,
        'closesAt' => $old['closesAt'] ?? null,
        'answers' => $old['answers'] ?? [],
        'hidden' => $old['hidden'] ?? [],
        'posts' => $old['posts'] ?? [],
    ];
    $q['correct'] = wl_clean_correct($q, $in['correct'] ?? []);
    if ($old && wl_structure_changed($old, $q)) {
        // Les réponses déjà reçues ne correspondent plus aux choix : on repart de zéro.
        wl_reset_question($q);
    }
    return $q;
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
function wl_structure_changed(array $old, array $new): bool
{
    if ($old['type'] !== $new['type']) {
        return true;
    }
    $relevant = ['mcq' => 'multi', 'scale' => 'scaleMax', 'points' => 'budget', 'dots' => 'budget'][$new['type']] ?? null;
    return ($new['type'] !== 'postit' && count($old['options']) !== count($new['options']))
        || ($relevant && $old[$relevant] !== $new[$relevant])
        || ($new['type'] === 'dots' && ($old['source'] ?? '') !== $new['source']);
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
    if (!in_array($type, ['mcq', 'poll', 'points'], true)) {
        return [];
    }
    $clean = [];
    foreach (is_array($options) ? $options : [] as $o) {
        $o = wl_clean_text($o);
        if ($o !== '') {
            $clean[] = wl_strlen($o) <= 80 ? $o : throw new WlError('Un choix dépasse 80 caractères.');
        }
    }
    if (count($clean) < 2 || count($clean) > WL_MAX_OPTIONS) {
        throw new WlError('Il faut entre 2 et ' . WL_MAX_OPTIONS . ' choix.');
    }
    return $clean;
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
    $q['answers'][$pkey] = ['v' => $clean, 't' => time()];
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
    }
    $counts = array_fill(0, count($q['options']), 0);
    foreach ($answers as $a) {
        foreach ((array)$a as $i) {
            $counts[$i]++;
        }
    }
    return $r + ['counts' => $counts];
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
    $show = $q['showResults'];
    return [
        'id' => $q['id'], 'type' => $q['type'], 'text' => $q['text'], 'options' => $q['options'],
        'multi' => $q['multi'], 'scaleMax' => $q['scaleMax'], 'budget' => $q['budget'],
        'duration' => $q['duration'], 'closesAt' => $q['closesAt'], 'state' => $q['state'],
        'allowChange' => $q['allowChange'], 'showResults' => $show, 'source' => $q['source'] ?? '',
        'correct' => $show ? $q['correct'] : [],
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
        'participants' => count($s['participants']),
        'position' => $q ? $s['current'] + 1 : 0, 'count' => count($s['questions']),
        'question' => $q ? wl_public_question($q) : null,
        'results' => $q && $q['showResults'] ? wl_results($q, false, $s) : null,
        'answered' => $q ? (in_array($q['type'], WL_POST_TYPES, true) ? count($q['posts']) : count($q['answers'])) : 0,
        'joinUrl' => wl_join_url($s['code']), 'now' => time(),
        'pollMs' => (int)wl_config()['poll_ms'],
    ];
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

/** Connecté, et actif depuis moins de 8 heures. */
function wl_is_admin(): bool
{
    wl_admin_session();
    if (empty($_SESSION['admin']) || ($_SESSION['seen'] ?? 0) < time() - 8 * 3600) {
        return false;
    }
    $_SESSION['seen'] = time();
    return true;
}

/** 5 échecs en 15 minutes depuis une même IP bloquent les tentatives 15 minutes. */
function wl_login(string $password): void
{
    $file = wl_data_dir() . '/login.json';
    $ip = wl_ip_hash();
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
    $_SESSION['seen'] = time();
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
}

/** CSRF participant : dérivé du jeton, renvoyé en en-tête X-CSRF-Token. */
function wl_participant_csrf(string $token): string
{
    return wl_hash('csrf|' . $token);
}

/** Clé d'un participant dans une session (le jeton n'est jamais stocké). */
function wl_participant_key(string $token): string
{
    return 'p' . wl_hash('p|' . $token, 15);
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
    if (!$q['showResults'] || in_array($pid, $q['hidden'], true)) {
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
        if ($mine || ($q['showResults'] && !in_array($p['id'], $q['hidden'], true))) {
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
        $hidden = in_array($p['id'], $q['hidden'], true);
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
        if ($c['id'] === $q['source'] && in_array($c['type'], WL_POST_TYPES, true)) {
            $src = $c;
        }
    }
    if (!$src) {
        return [];
    }
    $items = [];
    foreach ($src['posts'] as $p) {
        if ($p['parent'] === null && !in_array($p['id'], $src['hidden'], true)) {
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
