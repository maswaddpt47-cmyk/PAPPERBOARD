<?php
// Point d'entrée unique des écrans : api.php?action=…
// GET = lecture, POST (corps JSON + en-tête X-CSRF-Token) = écriture.

declare(strict_types=1);

require __DIR__ . '/lib.php';

wl_security_headers();

const WL_PUBLIC_GET = ['state', 'screen'];
const WL_PUBLIC_POST = ['join', 'vote'];
const WL_ADMIN_GET = ['me', 'sessions', 'admin_state', 'export'];
const WL_ADMIN_POST = ['login', 'logout', 'session_create', 'session_duplicate', 'session_delete',
    'session_rename', 'question_save', 'question_delete', 'question_move', 'control', 'answer_hide'];

try {
    wl_maybe_purge();
    $action = (string)($_GET['action'] ?? '');
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if ($method === 'GET' && in_array($action, WL_PUBLIC_GET, true)) {
        ('api_' . $action)();
    } elseif ($method === 'GET' && in_array($action, WL_ADMIN_GET, true)) {
        $action === 'me' || api_require_admin();
        ('api_' . $action)();
    } elseif ($method === 'POST' && in_array($action, [...WL_PUBLIC_POST, ...WL_ADMIN_POST], true)) {
        $body = api_body();
        in_array($action, WL_ADMIN_POST, true) && $action !== 'login' && api_require_admin(true);
        ('api_' . $action)($body);
    } else {
        throw new WlError('Action inconnue.', 404);
    }
} catch (WlError $e) {
    wl_json(['ok' => false, 'error' => $e->getMessage()], $e->status);
} catch (Throwable $e) {
    error_log('WoocLight : ' . $e->getMessage());
    wl_json(['ok' => false, 'error' => 'Erreur interne, réessayez.'], 500);
}

// ---------------------------------------------------------------------------
// Outils
// ---------------------------------------------------------------------------

/** Corps JSON d'une requête POST, limité à 64 Ko. */
function api_body(): array
{
    $raw = file_get_contents('php://input', false, null, 0, 65536);
    $body = json_decode((string)$raw, true);
    if (!is_array($body)) {
        throw new WlError('Requête invalide.');
    }
    return $body;
}

function api_csrf_header(): string
{
    return (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
}

function api_require_admin(bool $checkCsrf = false): void
{
    if (!wl_is_admin()) {
        throw new WlError('Connexion animateur requise.', 401);
    }
    if ($checkCsrf && !hash_equals($_SESSION['csrf'], api_csrf_header())) {
        throw new WlError('Jeton de sécurité manquant ou expiré : rechargez la page.', 403);
    }
}

/** Jeton du participant : cookie, ou en-tête si le cookie a été effacé
 *  (copie gardée dans le localStorage du téléphone). */
function api_token(): ?string
{
    $t = $_COOKIE['wl_p'] ?? $_SERVER['HTTP_X_WL_TOKEN'] ?? null;
    return wl_valid_token($t) ? $t : null;
}

function api_set_token_cookie(string $token): void
{
    setcookie('wl_p', $token, [
        'expires' => time() + 86400 * 30, 'path' => wl_base_path() . '/',
        'secure' => wl_https(), 'httponly' => true, 'samesite' => 'Lax',
    ]);
}

function api_code(array $src): string
{
    return wl_clean_code($src['s'] ?? '');
}

// ---------------------------------------------------------------------------
// Participant
// ---------------------------------------------------------------------------

/** Rejoindre une session. Le jeton est créé côté serveur s'il n'existe pas. */
function api_join(array $b): void
{
    // Pas encore de jeton CSRF à ce stade : l'en-tête personnalisé suffit à
    // bloquer un formulaire d'un autre site (il exigerait un pré-vol CORS).
    if (($_SERVER['HTTP_X_WL'] ?? '') !== '1') {
        throw new WlError('Requête refusée.', 403);
    }
    wl_rate('ip|' . wl_ip_hash(), (int)wl_config()['rate_ip']);
    $code = api_code($b);
    $token = api_token() ?? wl_new_token();
    $pkey = wl_participant_key($token);
    $title = wl_update($code, function (array &$s) use ($pkey) {
        if ($s['ended']) {
            throw new WlError('Cette session est terminée.', 409);
        }
        if (!isset($s['participants'][$pkey])) {
            if (count($s['participants']) >= (int)wl_config()['max_participants']) {
                throw new WlError('La session est complète.', 409);
            }
            $s['participants'][$pkey] = time();
        }
        return $s['title'];
    }, false);
    api_set_token_cookie($token);
    wl_json(['ok' => true, 'code' => $code, 'title' => $title, 'token' => $token,
        'csrf' => wl_participant_csrf($token)]);
}

/** Ce que voit le participant. 304 tant que rien de visible n'a changé. */
function api_state(): void
{
    $code = api_code($_GET);
    $s = wl_load_or_fail($code);
    $token = api_token();
    $pkey = $token ? wl_participant_key($token) : '';
    $q = wl_current_question($s);
    // La version publique change avec la question ; la réponse du participant
    // n'en fait pas partie (le téléphone la connaît déjà après son vote).
    wl_json_etag('p' . $s['pversion'] . '-' . substr($pkey, 0, 6), fn() => [
        'ok' => true, 'title' => $s['title'], 'ended' => $s['ended'],
        'joined' => isset($s['participants'][$pkey]),
        'question' => $q ? wl_public_question($q) : null,
        'mine' => $q['answers'][$pkey]['v'] ?? null,
        'result' => $q && $q['showResults'] && in_array($q['type'], ['yesno', 'truefalse', 'mcq', 'poll', 'scale'], true)
            ? wl_results($q) : null,
        'now' => time(), 'pollMs' => (int)wl_config()['poll_ms'], 'maxText' => (int)wl_config()['max_text'],
    ]);
}

function api_vote(array $b): void
{
    $token = api_token();
    if (!$token || !hash_equals(wl_participant_csrf($token), api_csrf_header())) {
        throw new WlError('Jeton de sécurité manquant : rechargez la page.', 403);
    }
    wl_rate('ip|' . wl_ip_hash(), (int)wl_config()['rate_ip']);
    wl_rate('tk|' . $token, (int)wl_config()['rate_token']);
    $code = api_code($b);
    $pkey = wl_participant_key($token);
    $mine = wl_update($code, function (array &$s) use ($pkey, $b) {
        if (!isset($s['participants'][$pkey])) {
            throw new WlError('Rejoignez d\'abord la session avec son code.', 403);
        }
        return wl_vote($s, $pkey, (string)($b['qid'] ?? ''), $b['value'] ?? null);
    }, false);
    wl_json(['ok' => true, 'mine' => $mine]);
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

function api_screen(): void
{
    $s = wl_load_or_fail(api_code($_GET));
    wl_json_etag('s' . $s['version'], fn() => ['ok' => true] + wl_screen_view($s));
}

// ---------------------------------------------------------------------------
// Animateur
// ---------------------------------------------------------------------------

function api_me(): void
{
    wl_json(['ok' => true, 'admin' => wl_is_admin(), 'csrf' => $_SESSION['csrf'] ?? '']);
}

function api_login(array $b): void
{
    if (($_SERVER['HTTP_X_WL'] ?? '') !== '1') {
        throw new WlError('Requête refusée.', 403);
    }
    wl_login((string)($b['password'] ?? ''));
    wl_maybe_purge();
    wl_json(['ok' => true, 'csrf' => $_SESSION['csrf']]);
}

function api_logout(array $b): void
{
    $_SESSION = [];
    session_destroy();
    wl_json(['ok' => true]);
}

function api_sessions(): void
{
    wl_json(['ok' => true, 'sessions' => wl_list_sessions()]);
}

/** Tout l'état d'une session, résultats compris (réponses masquées signalées). */
function api_admin_state(): void
{
    $s = wl_load_or_fail(api_code($_GET));
    wl_json_etag('a' . $s['version'], function () use ($s) {
        $questions = array_map(fn($q) => array_merge(wl_public_question(['showResults' => true] + $q), [
            'showResults' => $q['showResults'], 'results' => wl_results($q, true),
        ]), $s['questions']);
        return ['ok' => true, 'code' => $s['code'], 'title' => $s['title'], 'ended' => $s['ended'],
            'current' => $s['current'], 'participants' => count($s['participants']),
            'questions' => $questions, 'joinUrl' => wl_join_url($s['code']), 'now' => time(),
            'pollMs' => (int)wl_config()['poll_ms']];
    });
}

function api_title(array $b): string
{
    $title = wl_clean_text($b['title'] ?? '');
    if ($title === '' || wl_strlen($title) > 120) {
        throw new WlError('Le titre est obligatoire (120 caractères au plus).');
    }
    return $title;
}

function api_session_create(array $b): void
{
    $s = wl_create_session(api_title($b));
    wl_json(['ok' => true, 'code' => $s['code']]);
}

/** Copie les questions, sans les votes ni les participants. */
function api_session_duplicate(array $b): void
{
    $src = wl_load_or_fail(api_code($b));
    $questions = array_map(fn($q) => ['id' => bin2hex(random_bytes(4)), 'state' => 'draft',
        'showResults' => false, 'closesAt' => null, 'answers' => [], 'hidden' => []] + $q, $src['questions']);
    $title = preg_replace('/^(.{0,120}).*$/us', '$1', 'Copie de ' . $src['title']);
    $s = wl_create_session($title, $questions);
    wl_json(['ok' => true, 'code' => $s['code']]);
}

function api_session_delete(array $b): void
{
    wl_delete_session(api_code($b));
    wl_json(['ok' => true]);
}

function api_session_rename(array $b): void
{
    $title = api_title($b);
    wl_update(api_code($b), function (array &$s) use ($title) {
        $s['title'] = $title;
    });
    wl_json(['ok' => true]);
}

/** Crée (sans qid) ou modifie une question. */
function api_question_save(array $b): void
{
    $in = is_array($b['question'] ?? null) ? $b['question'] : throw new WlError('Question manquante.');
    $id = wl_update(api_code($b), function (array &$s) use ($in) {
        if (!empty($in['id'])) {
            $i = wl_question_index($s, $in['id']);
            $s['questions'][$i] = wl_clean_question($in, $s['questions'][$i]);
            return $s['questions'][$i]['id'];
        }
        if (count($s['questions']) >= WL_MAX_QUESTIONS) {
            throw new WlError('50 questions au plus par session.');
        }
        $q = wl_clean_question($in);
        $s['questions'][] = $q;
        return $q['id'];
    });
    wl_json(['ok' => true, 'id' => $id]);
}

function api_question_delete(array $b): void
{
    wl_update(api_code($b), function (array &$s) use ($b) {
        $i = wl_question_index($s, $b['qid'] ?? '');
        array_splice($s['questions'], $i, 1);
        $s['current'] = max(0, min($s['current'], count($s['questions']) - 1));
    });
    wl_json(['ok' => true]);
}

/** Monte (dir = -1) ou descend (dir = 1) une question ; la question projetée suit. */
function api_question_move(array $b): void
{
    wl_update(api_code($b), function (array &$s) use ($b) {
        $i = wl_question_index($s, $b['qid'] ?? '');
        $j = $i + ((int)($b['dir'] ?? 0) < 0 ? -1 : 1);
        if ($j < 0 || $j >= count($s['questions'])) {
            return;
        }
        [$s['questions'][$i], $s['questions'][$j]] = [$s['questions'][$j], $s['questions'][$i]];
        $s['current'] = match ($s['current']) { $i => $j, $j => $i, default => $s['current'] };
    });
    wl_json(['ok' => true]);
}

/** Pilotage en direct de la question courante ou de la session. */
function api_control(array $b): void
{
    $op = (string)($b['op'] ?? '');
    wl_update(api_code($b), function (array &$s) use ($op, $b) {
        if (in_array($op, ['next', 'prev', 'goto'], true)) {
            $target = match ($op) {
                'next' => $s['current'] + 1, 'prev' => $s['current'] - 1,
                'goto' => wl_question_index($s, $b['qid'] ?? ''),
            };
            $s['current'] = max(0, min($target, count($s['questions']) - 1));
            return;
        }
        if ($op === 'end' || $op === 'reopen') {
            $s['ended'] = $op === 'end';
            return;
        }
        if (!isset($s['questions'][$s['current']])) {
            throw new WlError('Aucune question.', 404);
        }
        api_apply_op($s['questions'][$s['current']], $op);
    });
    wl_json(['ok' => true]);
}

function api_apply_op(array &$q, string $op): void
{
    switch ($op) {
        case 'open':
            $q['state'] = 'open';
            $q['closesAt'] = $q['duration'] ? time() + $q['duration'] : null;
            break;
        case 'close':
            $q['state'] = 'closed';
            $q['closesAt'] = null;
            break;
        case 'show':
        case 'hide':
            $q['showResults'] = $op === 'show';
            break;
        case 'reset':
            [$q['state'], $q['showResults'], $q['closesAt'], $q['answers'], $q['hidden']]
                = ['draft', false, null, [], []];
            break;
        default:
            throw new WlError('Commande inconnue.');
    }
}

/** Masque ou réaffiche une réponse libre (modération). */
function api_answer_hide(array $b): void
{
    $aid = (string)($b['aid'] ?? '');
    wl_update(api_code($b), function (array &$s) use ($b, $aid) {
        $q = &$s['questions'][wl_question_index($s, $b['qid'] ?? '')];
        $q['hidden'] = array_values(array_diff($q['hidden'], [$aid]));
        if (!empty($b['hidden'])) {
            $q['hidden'][] = $aid;
        }
    });
    wl_json(['ok' => true]);
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

function api_export(): void
{
    $s = wl_load_or_fail(api_code($_GET));
    if (($_GET['format'] ?? '') === 'print') {
        api_export_print($s);
    }
    api_export_csv($s);
}

/** Lignes communes au CSV et à la version imprimable. */
function api_export_rows(array $s): array
{
    $rows = [];
    foreach ($s['questions'] as $n => $q) {
        $res = wl_results($q, true);
        foreach (api_result_lines($q, $res) as [$label, $value]) {
            $rows[] = [$n + 1, $q['text'], api_type_label($q['type']), $label, $value, $res['total']];
        }
    }
    return $rows;
}

function api_result_lines(array $q, array $res): array
{
    switch ($q['type']) {
        case 'wordcloud':
            return array_map(fn($w) => [$w['text'], $w['n']], $res['words']);
        case 'text':
            return array_map(fn($t) => [$t['text'], $t['hidden'] ? 'masquée' : ''], $res['texts']);
        case 'scale':
            $lines = array_map(fn($c, $i) => [(string)($i + 1), $c], $res['counts'], array_keys($res['counts']));
            return [...$lines, ['Moyenne', $res['average'] === null ? '' : str_replace('.', ',', (string)$res['average'])]];
    }
    return array_map(fn($opt, $i) => [$opt . (in_array($i, $q['correct'], true) ? ' (bonne réponse)' : ''),
        $res['counts'][$i]], $q['options'], array_keys($q['options']));
}

function api_type_label(string $type): string
{
    return ['yesno' => 'Oui / Non', 'truefalse' => 'Vrai / Faux', 'mcq' => 'QCM', 'poll' => 'Sondage',
        'wordcloud' => 'Nuage de mots', 'text' => 'Réponse libre', 'scale' => 'Échelle',
        'points' => 'Classement par points'][$type] ?? $type;
}

/** Neutralise les formules dans Excel (cellule commençant par = + - @). */
function api_csv_cell(mixed $v): string
{
    $v = (string)$v;
    if ($v !== '' && strpbrk($v[0], "=+-@\t\r") !== false) {
        $v = "'" . $v;
    }
    return '"' . str_replace('"', '""', $v) . '"';
}

/** CSV lisible dans Excel : UTF-8 avec BOM, séparateur point-virgule. */
function api_export_csv(array $s): never
{
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="wooclight-' . $s['code'] . '-' . date('Y-m-d') . '.csv"');
    header('Cache-Control: no-store');
    echo "\xEF\xBB\xBF";
    $head = ['N°', 'Question', 'Type', 'Réponse', 'Nombre', 'Participants ayant répondu'];
    foreach ([$head, ...api_export_rows($s)] as $row) {
        echo implode(';', array_map('api_csv_cell', $row)), "\r\n";
    }
    exit;
}

function api_export_print(array $s): never
{
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    $title = wl_h($s['title']);
    echo "<!doctype html><html lang=\"fr\"><head><meta charset=\"utf-8\"><title>Résultats — $title</title>"
        . '<link rel="stylesheet" href="assets/style.css"></head><body class="print">'
        . "<h1>$title</h1><p>Code " . wl_h($s['code']) . ' — exporté le ' . date('d/m/Y à H:i')
        . ' — ' . count($s['participants']) . ' participant(s)</p>';
    $byQuestion = [];
    foreach (api_export_rows($s) as $r) {
        $byQuestion[$r[0]][] = $r;
    }
    foreach ($byQuestion as $n => $rows) {
        echo '<section><h2>' . $n . '. ' . wl_h($rows[0][1]) . '</h2><p>' . wl_h($rows[0][2])
            . ' — ' . $rows[0][5] . ' réponse(s)</p><table><tbody>';
        foreach ($rows as $r) {
            echo '<tr><td>' . wl_h((string)$r[3]) . '</td><td>' . wl_h((string)$r[4]) . '</td></tr>';
        }
        echo '</tbody></table></section>';
    }
    echo '<p class="no-print"><button type="button" id="print-btn" class="btn">Imprimer</button></p>'
        . '<script src="assets/print.js"></script></body></html>';
    exit;
}
