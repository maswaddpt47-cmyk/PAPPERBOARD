<?php
// Point d'entrée unique des écrans : api.php?action=…
// GET = lecture, POST (corps JSON + en-tête X-CSRF-Token) = écriture.

declare(strict_types=1);

require __DIR__ . '/lib.php';

wl_security_headers();

const WL_PUBLIC_GET = ['state', 'screen'];
const WL_PUBLIC_POST = ['join', 'leave', 'vote', 'post', 'post_delete', 'like', 'signal', 'ask', 'ask_vote', 'ping'];
const WL_ADMIN_GET = ['me', 'sessions', 'admin_state', 'export', 'archives', 'archive', 'seances'];
const WL_ADMIN_POST = ['login', 'logout', 'session_create', 'session_duplicate', 'session_delete',
    'session_rename', 'session_demo', 'demo_delete', 'session_conclusion', 'session_synthesis', 'session_archive', 'archive_delete', 'archive_reuse', 'question_save', 'questions_import', 'questions_duration', 'question_delete', 'question_move', 'control', 'answer_hide', 'post_admin', 'ask_admin', 'prefs_save', 'seance_save', 'seance_delete'];

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
    if ($checkCsrf) {
        wl_admin_acted();
    }
}

/** Session publique par son code. Les codes inconnus sont comptés par IP :
 *  au-delà de 30 par minute, 429 (essais de codes en série). */
function api_public_session(string $code): array
{
    $s = wl_load($code);
    if ($s === null) {
        wl_rate('miss|' . wl_ip_hash(), 30);
        throw new WlError('Code inconnu ou session expirée.', 404);
    }
    return $s;
}

/** Session terminée : plus aucun contenu servi publiquement, sauf la
 *  conclusion (« à retenir »). Le détail passe par le bilan projeté. */
function api_ended_view(array $s): array
{
    return ['ok' => true, 'title' => $s['title'], 'ended' => true, 'question' => null,
        'conclusion' => $s['conclusion'] ?? '',
        'code' => $s['code'], 'joinUrl' => wl_join_url($s['code']), 'participants' => count($s['participants']),
        'qrHidden' => !empty($s['qrHidden']),
        'pollMs' => (int)wl_config()['poll_ms'], 'now' => time()];
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
        'expires' => time() + 86400, 'path' => wl_base_path() . '/', // une journée d'atelier
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
    api_public_session($code);
    $token = api_token() ?? wl_new_token();
    $pkey = wl_participant_key($token, $code);
    $title = wl_update($code, function (array &$s) use ($pkey) {
        if ($s['ended']) {
            throw new WlError('Cette session est terminée.', 409);
        }
        if (!isset($s['participants'][$pkey])) {
            if (!empty($s['locked'])) {
                throw new WlError('Les inscriptions sont fermées : demandez à l\'animateur.', 409);
            }
            if (count($s['participants']) >= (int)wl_config()['max_participants']) {
                throw new WlError('La session est complète.', 409);
            }
            wl_rate('join|' . wl_ip_hash(), (int)wl_config()['rate_join']);
            $s['participants'][$pkey] = time();
        }
        wl_assign_pseudo($s, $pkey);
        return $s['title'];
    }, false, false);
    api_set_token_cookie($token);
    wl_json(['ok' => true, 'code' => $code, 'title' => $title, 'token' => $token,
        'csrf' => wl_participant_csrf($token)]);
}

/** Quitter : efface le cookie du téléphone (le navigateur efface le reste).
 *  Les réponses déjà envoyées restent dans la session jusqu'à sa suppression. */
function api_leave(array $b): void
{
    if (($_SERVER['HTTP_X_WL'] ?? '') !== '1') {
        throw new WlError('Requête refusée.', 403);
    }
    setcookie('wl_p', '', ['expires' => 1, 'path' => wl_base_path() . '/', 'secure' => wl_https(),
        'httponly' => true, 'samesite' => 'Lax']);
    wl_json(['ok' => true]);
}

/** Ce que voit le participant. 304 tant que rien de visible n'a changé. */
function api_state(): void
{
    $code = api_code($_GET);
    $s = api_public_session($code);
    if ($s['ended']) {
        wl_json_etag('e' . $s['pversion'], fn() => api_ended_view($s));
    }
    $token = api_token();
    $pkey = $token ? wl_participant_key($token, $code) : '';
    $q = wl_current_question($s);
    // La version publique change avec la question ; la réponse du participant
    // n'en fait pas partie (le téléphone la connaît déjà après son vote).
    $mine = $q['answers'][$pkey]['v'] ?? null;
    wl_json_etag('p' . $s['pversion'] . wl_time_tag($s) . '-' . substr($pkey, 0, 6), fn() => [
        'ok' => true, 'title' => $s['title'], 'ended' => $s['ended'],
        'joined' => isset($s['participants'][$pkey]),
        'question' => $q ? api_question_for($q, $mine) : null,
        'mine' => $q['answers'][$pkey]['v'] ?? null,
        'posts' => $q && in_array($q['type'], WL_POST_TYPES, true) ? wl_participant_posts($q, $pkey) : null,
        'items' => $q && $q['type'] === 'dots' ? wl_dot_items($s, $q) : null,
        'maxPosts' => (int)wl_config()['max_posts'],
        'result' => $q && wl_shown($q) && in_array($q['type'], ['yesno', 'truefalse', 'mcq', 'poll', 'scale'], true)
            ? wl_results($q) : null,
        'now' => time(), 'pollMs' => (int)wl_config()['poll_ms'], 'maxText' => (int)wl_config()['max_text'],
        'asksOpen' => !empty($s['asksOpen']), 'asks' => !empty($s['asksOpen']) ? wl_asks_view($s, $pkey) : [],
        'pseudo' => !empty($s['pseudo']) ? ($s['pseudos'][$pkey] ?? null) : null,
        'score' => !empty($s['pseudo']) ? ['n' => wl_scores($s)[$pkey] ?? 0, 'of' => count(wl_scored_questions($s))] : null,
    ]);
}

/** Écriture d'un participant : CSRF, limites de taux, participant inscrit.
 *  $fn reçoit la session et la clé du participant. $public : les autres
 *  téléphones doivent-ils se rafraîchir ? */
function api_participant_write(array $b, callable $fn, bool $public): mixed
{
    $token = api_token();
    if (!$token || !hash_equals(wl_participant_csrf($token), api_csrf_header())) {
        throw new WlError('Jeton de sécurité manquant : rechargez la page.', 403);
    }
    wl_rate('ip|' . wl_ip_hash(), (int)wl_config()['rate_ip']);
    wl_rate('tk|' . $token, (int)wl_config()['rate_token']);
    $code = api_code($b);
    $pkey = wl_participant_key($token, $code);
    return wl_update($code, function (array &$s) use ($pkey, $fn) {
        if (!isset($s['participants'][$pkey])) {
            throw new WlError('Rejoignez d\'abord la session avec son code.', 403);
        }
        return $fn($s, $pkey);
    }, $public, false);
}

/** Question vue par un participant ; correction immédiate : la bonne réponse
 *  n'est donnée qu'à celui qui a déjà répondu. */
function api_question_for(array $q, mixed $mine): array
{
    $pub = wl_public_question($q);
    if (($q['reveal'] ?? 'manual') === 'instant' && $mine !== null) {
        $pub['correct'] = $q['correct'];
        $pub['explain'] = $q['explain'] ?? '';
    }
    return $pub;
}

function api_vote(array $b): void
{
    $correct = [];
    $mine = api_participant_write($b, function (array &$s, string $pkey) use ($b, &$correct) {
        $clean = wl_vote($s, $pkey, (string)($b['qid'] ?? ''), $b['value'] ?? null);
        $q = $s['questions'][wl_question_index($s, (string)($b['qid'] ?? ''))];
        $correct = api_question_for($q, $clean)['correct'];
        return $clean;
    }, false);
    wl_json(['ok' => true, 'mine' => $mine, 'correct' => $correct]);
}

/** Mur et post-it : chaque contribution rafraîchit les téléphones (ils
 *  affichent la leur, et celles des autres une fois publiées). */
function api_post(array $b): void
{
    $post = api_participant_write($b, fn(array &$s, string $pkey) =>
        wl_post_add($s, $pkey, (string)($b['qid'] ?? ''), $b['text'] ?? '', $b['col'] ?? 0), true);
    wl_json(['ok' => true, 'id' => $post['id']]);
}

function api_post_delete(array $b): void
{
    api_participant_write($b, fn(array &$s, string $pkey) =>
        wl_post_delete($s, $pkey, (string)($b['qid'] ?? ''), (string)($b['pid'] ?? '')), true);
    wl_json(['ok' => true]);
}

/** Signe de vie du téléphone (toutes les 60 s) : sert au décompte des
 *  participants actifs ; aucune version n'avance, personne n'est réveillé. */
function api_ping(array $b): void
{
    $token = api_token();
    if (!$token || !hash_equals(wl_participant_csrf($token), api_csrf_header())) {
        throw new WlError('Jeton de sécurité manquant : rechargez la page.', 403);
    }
    wl_rate('tk|' . $token, (int)wl_config()['rate_token']);
    $code = api_code($b);
    wl_seen($code, wl_participant_key($token, $code));
    wl_json(['ok' => true]);
}

/** Signaler une difficulté : seul l'animateur voit les compteurs, les
 *  téléphones ne sont pas réveillés. */
function api_signal(array $b): void
{
    $kind = api_participant_write($b, fn(array &$s, string $pkey) => wl_signal($s, $pkey, $b['kind'] ?? '', $b['step'] ?? null), false);
    wl_json(['ok' => true, 'signal' => $kind, 'ttl' => WL_SIGNAL_TTL]);
}

/** Oser demander : une question publiée réveille les téléphones (comme le mur). */
function api_ask(array $b): void
{
    $ask = api_participant_write($b, fn(array &$s, string $pkey) => wl_ask_add($s, $pkey, $b['text'] ?? ''), true);
    wl_json(['ok' => true, 'id' => $ask['id']]);
}

function api_ask_vote(array $b): void
{
    $voted = api_participant_write($b, fn(array &$s, string $pkey) => wl_ask_vote($s, $pkey, (string)($b['aid'] ?? '')), true);
    wl_json(['ok' => true, 'voted' => $voted]);
}

function api_like(array $b): void
{
    $liked = api_participant_write($b, fn(array &$s, string $pkey) =>
        wl_like($s, $pkey, (string)($b['qid'] ?? ''), (string)($b['pid'] ?? '')), true);
    wl_json(['ok' => true, 'liked' => $liked]);
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

function api_screen(): void
{
    $s = api_public_session(api_code($_GET));
    // Une fois par minute, la projection recompte les téléphones actifs.
    wl_json_etag('s' . $s['version'] . wl_time_tag($s) . '-' . intdiv(time(), 60), fn() => match (true) {
        ($s['board'] ?? -1) >= 0 => ['ok' => true] + wl_board_view($s),
        in_array($s['show'] ?? '', ['asks', 'podium'], true) => ['ok' => true] + wl_show_view($s),
        $s['ended'] => api_ended_view($s),
        default => ['ok' => true] + wl_screen_view($s),
    });
}

// ---------------------------------------------------------------------------
// Animateur
// ---------------------------------------------------------------------------

function api_me(): void
{
    wl_json(['ok' => true, 'admin' => wl_is_admin(), 'csrf' => $_SESSION['csrf'] ?? '', 'prefs' => wl_is_admin() ? wl_prefs() : null]);
}

/** Fonctions en essai : un réglage pour tous les appareils de l'animateur. */
function api_prefs_save(array $b): void
{
    wl_json(['ok' => true, 'prefs' => wl_prefs_save($b)]);
}

function api_login(array $b): void
{
    if (($_SERVER['HTTP_X_WL'] ?? '') !== '1') {
        throw new WlError('Requête refusée.', 403);
    }
    wl_login((string)($b['password'] ?? ''));
    wl_maybe_purge();
    wl_json(['ok' => true, 'csrf' => $_SESSION['csrf'], 'prefs' => wl_prefs()]);
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
    // Signaux en cours : l'ETag change toutes les 10 s pour que les compteurs
    // s'effacent d'eux-mêmes (sinon 304 jusqu'à la prochaine écriture).
    $live = array_filter($s['signals'] ?? [], fn($x) => time() - $x['t'] < WL_SIGNAL_TTL + 15);
    // Participants actifs : recalculés chaque minute même sans écriture.
    wl_json_etag('a' . $s['version'] . wl_time_tag($s) . ($live ? '-' . intdiv(time(), 10) : '') . '-' . intdiv(time(), 60), function () use ($s) {
        $questions = array_map(fn($q) => array_merge(wl_public_question(['showResults' => true] + $q), [
            'showResults' => wl_shown($q), 'results' => wl_results($q, true, $s), 'live' => $q['live'] ?? true, 'compare' => $q['compare'] ?? '',
        ]), $s['questions']);
        return ['ok' => true, 'code' => $s['code'], 'title' => $s['title'], 'conclusion' => $s['conclusion'] ?? '', 'synthesis' => $s['synthesis'] ?? '', 'ended' => $s['ended'], 'locked' => !empty($s['locked']),
            'board' => ($s['board'] ?? -1) >= 0, 'qrHidden' => !empty($s['qrHidden']), 'show' => $s['show'] ?? '',
            'active' => wl_active_count($s), 'lastCron' => wl_last_cron(), 'demo' => !empty($s['demo']),
            'signals' => wl_signal_counts($s), 'helpSteps' => wl_signal_steps($s), 'asksOpen' => !empty($s['asksOpen']), 'asks' => wl_asks_view($s, null),
            'pseudo' => !empty($s['pseudo']), 'ranking' => !empty($s['pseudo']) ? wl_ranking($s) : [], 'current' => $s['current'], 'participants' => count($s['participants']), 'recap' => wl_recap($s),
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

/** Session de démonstration : participants fictifs, pour vérifier les écrans seul. */
function api_session_demo(array $b): void
{
    $s = wl_create_session('Démo'); // titre selon le thème tiré (wl_demo_fill)
    wl_update($s['code'], fn(array &$x) => wl_demo_fill($x));
    wl_json(['ok' => true, 'code' => $s['code']]);
}

/** Supprime toutes les sessions de démonstration (aucune archive). */
function api_demo_delete(array $b): void
{
    $n = 0;
    foreach (wl_list_sessions() as $s) {
        $n += $s['demo'] && wl_delete_session($s['code']) ? 1 : 0;
    }
    wl_json(['ok' => true, 'deleted' => $n]);
}

function api_session_create(array $b): void
{
    $s = wl_create_session(api_title($b));
    wl_json(['ok' => true, 'code' => $s['code']]);
}

/** Copie les questions, sans les votes, contributions ni participants.
 *  Les gommettes suivent leur question source sous son nouvel identifiant. */
function api_session_duplicate(array $b): void
{
    $src = wl_load_or_fail(api_code($b));
    $ids = [];
    foreach ($src['questions'] as $q) {
        $ids[$q['id']] = bin2hex(random_bytes(4));
    }
    $questions = array_map(function ($q) use ($ids) {
        wl_reset_question($q);
        $q['id'] = $ids[$q['id']];
        $q['source'] = $ids[$q['source'] ?? ''] ?? '';
        $q['compare'] = $ids[$q['compare'] ?? ''] ?? '';
        return $q;
    }, $src['questions']);
    $title = preg_replace('/^(.{0,120}).*$/us', '$1', 'Copie de ' . $src['title']);
    $s = wl_create_session($title, $questions);
    wl_json(['ok' => true, 'code' => $s['code']]);
}

/** Archiver tout de suite (anonymiser) une session, sans attendre la purge. */
function api_session_archive(array $b): void
{
    $code = wl_load_or_fail(api_code($b))['code'];
    $id = '';
    if (!wl_delete_session($code, null, function (array $s) use (&$id) {
        $id = wl_archive_session($s);
    })) {
        throw new WlError('Session introuvable ou expirée.', 404);
    }
    wl_json(['ok' => true, 'id' => $id]);
}

/** Thèmes ajoutés par l'animateur (la bibliothèque livrée avec l'application est côté navigateur). */
function api_seances(): void
{
    wl_json(['ok' => true, 'themes' => wl_themes()]);
}

/** Enregistrer un thème : questions d'une session (« s »), ou texte collé (« raw », par exemple relu par une autre IA). */
function api_seance_save(array $b): void
{
    if (!empty($b['s'])) {
        $list = wl_export_questions(wl_load_or_fail(api_code($b)));
    } else {
        $list = wl_import_list((string)($b['raw'] ?? ''));
    }
    if (!is_array($list) || !$list || !array_is_list($list)) {
        throw new WlError('Questions illisibles : collez la liste complète, du « [ » au « ] ».');
    }
    $theme = wl_theme_clean($b, $list);
    wl_locked_json(wl_themes_file(), function (array &$d) use ($theme) {
        $themes = is_array($d['themes'] ?? null) ? $d['themes'] : [];
        if (count($themes) >= WL_MAX_THEMES) {
            throw new WlError(WL_MAX_THEMES . ' thèmes au plus : supprimez-en un.');
        }
        $d['themes'] = [...$themes, $theme];
    });
    wl_json(['ok' => true, 'id' => $theme['id']]);
}

function api_seance_delete(array $b): void
{
    $id = preg_replace('/[^0-9a-f]/', '', (string)($b['id'] ?? ''));
    wl_locked_json(wl_themes_file(), function (array &$d) use ($id) {
        $d['themes'] = array_values(array_filter(is_array($d['themes'] ?? null) ? $d['themes'] : [], fn($t) => ($t['id'] ?? '') !== $id));
    });
    wl_json(['ok' => true]);
}

function api_archives(): void
{
    wl_json(['ok' => true, 'archives' => wl_list_archives()]);
}

function api_archive(): void
{
    $file = wl_archive_file((string)($_GET['id'] ?? ''));
    $a = is_file($file) ? json_decode((string)file_get_contents($file), true) : null;
    is_array($a) ? wl_json(['ok' => true] + $a) : throw new WlError('Archive introuvable.', 404);
}

function api_archive_delete(array $b): void
{
    $file = wl_archive_file((string)($b['id'] ?? ''));
    is_file($file) && unlink($file);
    wl_json(['ok' => true]);
}

/** Nouvelle session avec les questions d'une archive (sans résultats). */
function api_archive_reuse(array $b): void
{
    $file = wl_archive_file((string)($b['id'] ?? ''));
    $a = is_file($file) ? json_decode((string)file_get_contents($file), true) : null;
    if (!is_array($a)) {
        throw new WlError('Archive introuvable.', 404);
    }
    $questions = array_map(function ($q) {
        $q = wl_clean_question(array_diff_key($q, ['results' => 1]));
        // Gommettes : la source n'est pas conservée dans l'archive, à rechoisir.
        return $q;
    }, array_values(array_filter($a['questions'], fn($q) => $q['type'] !== 'dots')));
    $s = wl_create_session(preg_replace('/^(.{0,120}).*$/us', '$1', $a['title']), $questions);
    wl_update($s['code'], function (array &$s) use ($a) {
        $s['conclusion'] = $a['conclusion'] ?? '';
    });
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

function api_session_conclusion(array $b): void
{
    $text = wl_clean_conclusion($b['conclusion'] ?? '');
    wl_update(api_code($b), function (array &$s) use ($text) {
        $s['conclusion'] = $text;
    });
    wl_json(['ok' => true]);
}

function api_session_synthesis(array $b): void
{
    $text = wl_clean_synthesis($b['synthesis'] ?? '');
    // Animateur seulement : les téléphones n'ont pas à se rafraîchir.
    wl_update(api_code($b), function (array &$s) use ($text) {
        $s['synthesis'] = $text;
    }, false);
    wl_json(['ok' => true]);
}

/** Crée (sans qid) ou modifie une question. */
function api_question_save(array $b): void
{
    $in = is_array($b['question'] ?? null) ? $b['question'] : throw new WlError('Question manquante.');
    $id = wl_update(api_code($b), function (array &$s) use ($in, $b) {
        if (($in['type'] ?? '') === 'dots') {
            api_check_source($s, (string)($in['source'] ?? ''), (string)($in['id'] ?? ''), is_numeric($in['column'] ?? null) ? (int)$in['column'] : -1);
        }
        if (!empty($in['id'])) {
            $i = wl_question_index($s, $in['id']);
            $q = wl_clean_question($in, $s['questions'][$i]);
            api_check_compare($s, $q, $i);
            if (!empty($s['demo'])) {
                wl_demo_simulate($s, $q); // démo : une question remise à zéro par la modification se repeuple
            }
            $s['questions'][$i] = $q;
            return $q['id'];
        }
        if (count($s['questions']) >= WL_MAX_QUESTIONS) {
            throw new WlError('50 questions au plus par session.');
        }
        $q = wl_clean_question($in);
        if (!empty($s['demo'])) {
            wl_demo_simulate($s, $q); // démo : la salle fictive répond aussi aux questions ajoutées
        }
        if (!empty($b['first'])) {
            // Brise-glace : en tête de session, la question projetée reste la même.
            $q['compare'] = ''; // rien ne la précède
            array_unshift($s['questions'], $q);
            $s['current'] += $s['current'] >= 0 ? 1 : 0;
        } else {
            api_check_compare($s, $q, count($s['questions']));
            $s['questions'][] = $q;
        }
        return $q['id'];
    });
    wl_json(['ok' => true, 'id' => $id]);
}

/** Avant / après : la question « avant » doit précéder et avoir la même forme. */
function api_check_compare(array $s, array $q, int $pos): void
{
    if (($q['compare'] ?? '') === '') {
        return;
    }
    foreach (array_slice($s['questions'], 0, $pos) as $e) {
        if ($e['id'] === $q['compare']) {
            if (wl_compare_shape($e, $q)) {
                return;
            }
            break;
        }
    }
    throw new WlError('Avant / après : choisissez une question précédente de même type et avec les mêmes choix (quiz avec bonne réponse, ou échelle).');
}

/** Même durée pour toutes les questions de la session (0 = sans limite). Un
 *  vote déjà ouvert garde son compte à rebours ; la durée vaut à la prochaine
 *  ouverture. Sans durée, une correction « à la fin du temps » repasse au clic. */
function api_questions_duration(array $b): void
{
    $duration = wl_clean_duration($b['duration'] ?? 0);
    wl_update(api_code($b), function (array &$s) use ($duration) {
        foreach ($s['questions'] as &$q) {
            $q['duration'] = $duration;
            if (!$duration && ($q['reveal'] ?? 'manual') === 'end') {
                $q['reveal'] = 'manual';
            }
        }
        unset($q);
    });
    wl_json(['ok' => true]);
}

/** Questions générées par une IA : aperçu (preview) ou ajout de celles retenues
 *  (keep = positions dans la liste collée). Tout ou rien. */
function api_questions_import(array $b): void
{
    $items = wl_import_parse((string)($b['raw'] ?? ''));
    if (!empty($b['preview'])) {
        wl_json(['ok' => true, 'items' => array_map(fn($it) => isset($it['q'])
            ? array_intersect_key($it['q'], array_flip(['type', 'text', 'options', 'multi', 'correct', 'scaleMax', 'budget', 'source', 'column', 'explain', 'compare', 'variants', 'link']))
                + (isset($it['warning']) ? ['warning' => $it['warning']] : [])
            : $it, $items)]);
    }
    $keep = array_values(array_unique(array_map('intval', is_array($b['keep'] ?? null) ? $b['keep'] : [])));
    sort($keep);
    foreach ($keep as $i) {
        if (isset($items[$i]['conclusion'])) {
            continue;
        }
        if (!isset($items[$i]['q'])) {
            throw new WlError('Question ' . ($i + 1) . ' : ' . ($items[$i]['error'] ?? 'introuvable.'));
        }
        $src = $items[$i]['q']['type'] === 'dots' ? (int)substr($items[$i]['q']['source'], 1) : null;
        if ($src !== null && !in_array($src, $keep, true)) {
            throw new WlError('Question ' . ($i + 1) . ' (gommettes) : cochez aussi sa source, la question ' . ($src + 1) . '.');
        }
        if (str_starts_with($items[$i]['q']['compare'] ?? '', '#') && !in_array((int)substr($items[$i]['q']['compare'], 1), $keep, true)) {
            throw new WlError('Question ' . ($i + 1) . ' (avant / après) : cochez aussi la question ' . ((int)substr($items[$i]['q']['compare'], 1) + 1) . '.');
        }
    }
    if (!$keep) {
        throw new WlError('Cochez au moins une question.');
    }
    wl_update(api_code($b), function (array &$s) use ($items, $keep) {
        if (count($s['questions']) + count($keep) > WL_MAX_QUESTIONS) {
            throw new WlError(WL_MAX_QUESTIONS . ' questions au plus par session.');
        }
        $ids = [];
        foreach ($keep as $i) {
            if (isset($items[$i]['conclusion'])) {
                $s['conclusion'] = $items[$i]['conclusion'];
                continue;
            }
            $q = $items[$i]['q'];
            if ($q['type'] === 'dots') {
                $q['source'] = $ids[(int)substr($q['source'], 1)];
            }
            if (str_starts_with($q['compare'] ?? '', '#')) {
                $q['compare'] = $ids[(int)substr($q['compare'], 1)];
            }
            if (!empty($s['demo'])) {
                wl_demo_simulate($s, $q);
            }
            $ids[$i] = $q['id'];
            $s['questions'][] = $q;
        }
    });
    wl_json(['ok' => true, 'added' => count(array_filter($keep, fn($i) => isset($items[$i]['q'])))]);
}

/** La question source des gommettes doit être un mur ou un post-it de la session. */
function api_check_source(array $s, string $source, string $self, int $column = -1): void
{
    foreach ($s['questions'] as $q) {
        if ($q['id'] === $source && $q['id'] !== $self && in_array($q['type'], WL_POST_TYPES, true)) {
            if ($column >= 0 && ($q['type'] !== 'postit' || !isset($q['options'][$column]))) {
                throw new WlError('Colonne absente du post-it choisi.');
            }
            return;
        }
    }
    throw new WlError('Choisissez le post-it collectif (ou le mur) dont les idées seront départagées.');
}

/** Animateur : déplacer, regrouper, détacher ou supprimer un post-it. */
function api_post_admin(array $b): void
{
    wl_update(api_code($b), fn(array &$s) => wl_post_admin($s, (string)($b['qid'] ?? ''),
        (string)($b['pid'] ?? ''), (string)($b['op'] ?? ''), $b['arg'] ?? null));
    wl_json(['ok' => true]);
}

function api_question_delete(array $b): void
{
    wl_update(api_code($b), function (array &$s) use ($b) {
        $i = wl_question_index($s, $b['qid'] ?? '');
        array_splice($s['questions'], $i, 1);
        $s['current'] = max(-1, min($s['current'], count($s['questions']) - 1));
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
    // Bilan, QR code, projection d'« Oser demander » ou du podium : seule la
    // projection change, pas les téléphones.
    $board = in_array($op, ['board', 'board_next', 'board_prev', 'board_off'], true);
    $qr = $op === 'qr_hide' || $op === 'qr_show';
    $show = in_array($op, ['show_asks', 'show_podium', 'show_off'], true);
    wl_update(api_code($b), function (array &$s) use ($op, $b, $board, $qr, $show) {
        if ($qr) {
            $s['qrHidden'] = $op === 'qr_hide';
            return;
        }
        if ($show) {
            $s['show'] = ['show_asks' => 'asks', 'show_podium' => 'podium', 'show_off' => ''][$op];
            $s['board'] = -1;
            return;
        }
        if ($op === 'asks_open' || $op === 'asks_close') {
            $s['asksOpen'] = $op === 'asks_open';
            return;
        }
        if ($op === 'pseudo_on' || $op === 'pseudo_off') {
            // Activé en cours de route : chaque inscrit reçoit son pseudonyme.
            // Désactivé : les pseudonymes sont effacés (minimisation).
            $s['pseudo'] = $op === 'pseudo_on';
            if (!$s['pseudo']) {
                $s['pseudos'] = [];
            }
            foreach (array_keys($s['participants']) as $pkey) {
                wl_assign_pseudo($s, $pkey);
            }
            if ($op === 'pseudo_off' && ($s['show'] ?? '') === 'podium') {
                $s['show'] = '';
            }
            return;
        }
        if ($board) {
            $s['show'] = '';
            $n = count(wl_board_questions($s));
            if ($op !== 'board_off' && $n === 0) {
                throw new WlError('Aucune question posée : rien à montrer.', 409);
            }
            $at = $s['board'] ?? -1;
            $s['board'] = match ($op) {
                'board' => 0, 'board_off' => -1,
                'board_next' => min(max($at, 0) + 1, $n - 1), 'board_prev' => max($at - 1, 0),
            };
            return;
        }
        // Piloter une question ou la session reprend la projection normale.
        if ($op !== 'lock' && $op !== 'unlock') {
            $s['board'] = -1;
            $s['show'] = '';
        }
        if (in_array($op, ['next', 'prev', 'goto'], true)) {
            $target = match ($op) {
                'next' => $s['current'] + 1, 'prev' => $s['current'] - 1,
                'goto' => wl_question_index($s, $b['qid'] ?? ''),
            };
            $s['current'] = max(-1, min($target, count($s['questions']) - 1));
            // Arriver sur une question jamais ouverte ouvre le vote (un clic de moins).
            if (($s['questions'][$s['current']]['state'] ?? '') === 'draft') {
                api_apply_op($s['questions'][$s['current']], 'open');
            }
            return;
        }
        if ($op === 'end' || $op === 'reopen') {
            $s['ended'] = $op === 'end';
            return;
        }
        if ($op === 'lock' || $op === 'unlock') {
            $s['locked'] = $op === 'lock'; // fermer les inscriptions (les inscrits continuent)
            return;
        }
        if (!isset($s['questions'][$s['current']])) {
            throw new WlError('Aucune question.', 404);
        }
        api_apply_op($s['questions'][$s['current']], $op);
    }, !$board && !$qr && !$show);
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
            wl_reset_question($q);
            break;
        default:
            throw new WlError('Commande inconnue.');
    }
}

/** Oser demander : publier, masquer, marquer répondue, supprimer. */
function api_ask_admin(array $b): void
{
    wl_update(api_code($b), fn(array &$s) => wl_ask_admin($s, (string)($b['aid'] ?? ''), (string)($b['op'] ?? '')));
    wl_json(['ok' => true]);
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
    // public=1 : version à diffuser, sans les réponses masquées par l'animateur.
    $all = empty($_GET['public']);
    if (($_GET['format'] ?? '') === 'print') {
        api_export_print($s, $all);
    }
    if (($_GET['format'] ?? '') === 'memo') {
        api_export_memo($s);
    }
    if (($_GET['format'] ?? '') === 'questions') {
        header('Content-Type: application/json; charset=utf-8');
        header('Content-Disposition: attachment; filename="wooclight-questions-' . $s['code'] . '-' . date('Y-m-d') . '.json"');
        header('Cache-Control: no-store');
        echo json_encode(wl_export_questions($s), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
    api_export_csv($s, $all);
}

/** Lignes communes au CSV et à la version imprimable. */
function api_export_rows(array $s, bool $all): array
{
    $rows = [];
    foreach ($s['questions'] as $n => $q) {
        $res = wl_results($q, $all, $s);
        foreach (api_result_lines($q, $res) as [$label, $value]) {
            $rows[] = [$n + 1, $q['text'], api_type_label($q['type']), $label, $value, $res['total']];
        }
        if (!empty($res['compare'])) {
            $rows[] = [$n + 1, $q['text'], api_type_label($q['type']), 'Avant / après', wl_compare_text($res['compare']), $res['total']];
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
            return array_map(fn($t) => [$t['text'], ($t['hidden'] ?? false) ? 'masquée' : ''], $res['texts']);
        case 'wall':
            return array_map(fn($p) => [$p['text'] . (($p['hidden'] ?? false) ? ' (masqué)' : ''), $p['likes'] . ' j\'aime'], $res['posts']);
        case 'postit':
            return array_map(fn($p) => [$res['columns'][$p['col']] . ' : ' . $p['text']
                . ($p['parent'] ? ' (regroupé)' : '') . (($p['hidden'] ?? false) ? ' (masqué)' : ''), ''], $res['posts']);
        case 'dots':
            return array_map(fn($it) => [$it['text'] . ($it['grouped'] ? ' (+ ' . implode(' ; ', $it['grouped']) . ')' : ''),
                $it['n']], $res['items']);
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
        'points' => 'Classement par points', 'wall' => 'Mur collaboratif', 'postit' => 'Post-it collectif',
        'dots' => 'Vote par gommettes', 'steps' => 'Défi à étapes'][$type] ?? $type;
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
function api_export_csv(array $s, bool $all): never
{
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="wooclight-' . $s['code'] . ($all ? '' : '-diffusion') . '-' . date('Y-m-d') . '.csv"');
    header('Cache-Control: no-store');
    echo "\xEF\xBB\xBF";
    $head = ['N°', 'Question', 'Type', 'Réponse', 'Nombre', 'Participants ayant répondu'];
    foreach ([$head, ...api_export_rows($s, $all)] as $row) {
        echo implode(';', array_map('api_csv_cell', $row)), "\r\n";
    }
    exit;
}

/** Fiche mémo à emporter : ce que l'animateur a écrit (conclusion, explications, bonnes réponses,
 *  exercices et leurs étapes), jamais une réponse ni un chiffre de participant. À imprimer ou
 *  enregistrer en PDF, puis à remettre ou à envoyer. */
function api_export_memo(array $s): never
{
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    $title = wl_h($s['title']);
    $when = !empty($s['created']) ? ' — atelier du ' . date('d/m/Y', (int)$s['created']) : '';
    echo "<!doctype html><html lang=\"fr\"><head><meta charset=\"utf-8\"><title>Fiche mémo — $title</title>"
        . '<link rel="stylesheet" href="' . wl_asset('style.css') . '"></head><body class="print memo">'
        . "<h1>$title</h1><p>Fiche mémo$when</p>";
    if (trim((string)($s['conclusion'] ?? '')) !== '') {
        echo '<section><h2>À retenir</h2><p>' . nl2br(wl_h($s['conclusion'])) . '</p></section>';
    }
    $seen = '';
    $todo = '';
    foreach ($s['questions'] as $q) {
        $good = $q['correct'] ? implode(' ; ', array_map(fn($i) => $q['options'][$i], $q['correct'])) : '';
        if ($good !== '' || trim((string)($q['explain'] ?? '')) !== '') {
            $seen .= '<li><strong>' . wl_h($q['text']) . '</strong>'
                . ($good !== '' ? '<br>Bonne réponse : ' . wl_h($good) : '')
                . (trim((string)($q['explain'] ?? '')) !== '' ? '<br>' . wl_h($q['explain']) : '') . '</li>';
        }
        if ($q['type'] === 'steps' || ($q['link'] ?? '') !== '') {
            $todo .= '<li><strong>' . wl_h($q['text']) . '</strong>';
            if (($q['link'] ?? '') !== '') {
                $todo .= '<br>Adresse : <a href="' . wl_h($q['link']) . '" rel="noopener noreferrer">' . wl_h($q['link']) . '</a>';
            }
            if ($q['type'] === 'steps') {
                $todo .= '<ol>' . implode('', array_map(fn($o) => '<li>' . wl_h($o) . '</li>', $q['options'])) . '</ol>';
                foreach ($q['variants'] ?? [] as $v) {
                    $todo .= '<p><em>' . wl_h($v['name']) . '</em></p><ol>'
                        . implode('', array_map(fn($t) => '<li>' . wl_h($t) . '</li>', $v['steps'])) . '</ol>';
                }
            }
            $todo .= '</li>';
        }
    }
    if ($seen !== '') {
        echo "<section><h2>Ce qu'on a vu</h2><ul class=\"memo-list\">$seen</ul></section>";
    }
    if ($todo !== '') {
        echo "<section><h2>À refaire chez soi</h2><ul class=\"memo-list\">$todo</ul></section>";
    }
    if ($seen === '' && $todo === '' && trim((string)($s['conclusion'] ?? '')) === '') {
        echo '<p>Rien à reprendre pour l\'instant : ajoutez une conclusion, des explications ou un exercice à vos questions.</p>';
    }
    echo '<p class="no-print"><button type="button" id="print-btn" class="btn">Imprimer ou enregistrer en PDF</button></p>'
        . '<script src="' . wl_asset('print.js') . '"></script></body></html>';
    exit;
}

function api_export_print(array $s, bool $all): never
{
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-store');
    $title = wl_h($s['title']);
    echo "<!doctype html><html lang=\"fr\"><head><meta charset=\"utf-8\"><title>Résultats — $title</title>"
        . '<link rel="stylesheet" href="' . wl_asset('style.css') . '"></head><body class="print">'
        . "<h1>$title</h1><p>Code " . wl_h($s['code']) . ' — exporté le ' . date('d/m/Y à H:i')
        . ' — ' . count($s['participants']) . ' participant(s)</p>';
    $byQuestion = [];
    foreach (api_export_rows($s, $all) as $r) {
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
        . '<script src="' . wl_asset('print.js') . '"></script></body></html>';
    exit;
}
