<?php
// Test de bout en bout : 1 animateur, 3 participants, chaque type de question.
// Lancé par tests/run.sh contre `php -S` ; variables WL_BASE, WL_DATA, WL_PASSWORD.

declare(strict_types=1);

require __DIR__ . '/http.php';

$base = getenv('WL_BASE');
$data = getenv('WL_DATA');
$admin = new Client($base);
$p = [new Client($base), new Client($base), new Client($base)];

// --- Pages et en-têtes -------------------------------------------------------
foreach (['index.php', 'admin.php', 'screen.php?s=AAAAA'] as $page) {
    $r = $admin->get($page);
    expect_status($r, 200, "page $page");
    check(str_contains($r['headers']['content-security-policy'] ?? '', "script-src 'self'"), "CSP sur $page");
    check(!preg_match('/<script(?![^>]*\bsrc=)/i', $r['body']), "aucun script en ligne dans $page");
}
foreach (['lib.php', 'config.sample.php'] as $f) {
    check(trim($admin->get($f)['body']) === '', "$f n'affiche rien");
}

// --- Connexion animateur -----------------------------------------------------
expect_status($admin->get('api.php?action=sessions'), 401, 'liste des sessions sans connexion');
expect_status($admin->request('POST', 'api.php?action=login', ['password' => getenv('WL_PASSWORD')]), 403, 'connexion sans en-tête X-WL');
expect_status($admin->post('login', ['password' => 'faux']), 401, 'mauvais mot de passe');
$r = $admin->post('login', ['password' => getenv('WL_PASSWORD')]);
expect_status($r, 200, 'connexion');
$admin->csrf = $r['json']['csrf'] ?? '';
check(str_contains(file_get_contents($admin->jar), 'WLADMIN'), 'cookie de session animateur');

// --- CSRF ------------------------------------------------------------------
expect_status($admin->post('session_create', ['title' => 'Sans CSRF'], false), 403, 'création sans CSRF refusée');
$saved = $admin->csrf;
$admin->csrf = str_repeat('0', 64);
expect_status($admin->post('session_create', ['title' => 'Mauvais CSRF']), 403, 'création avec mauvais CSRF refusée');
$admin->csrf = $saved;

// --- Session et questions ----------------------------------------------------
$r = $admin->post('session_create', ['title' => 'Atelier test <b>']);
expect_status($r, 200, 'création de session');
$code = $r['json']['code'];
check(preg_match('/^[A-Z2-9]{5}$/', $code) === 1, 'code de 5 caractères');

$questions = [
    'yesno' => ['type' => 'yesno', 'text' => 'Avez-vous un smartphone ?', 'correct' => [0], 'allowChange' => false],
    'truefalse' => ['type' => 'truefalse', 'text' => 'Un mot de passe se partage ?', 'correct' => [1]],
    'mcq' => ['type' => 'mcq', 'text' => 'Quels navigateurs ?', 'options' => ['Firefox', 'Chrome', 'Edge'], 'multi' => true, 'correct' => [0, 1]],
    'poll' => ['type' => 'poll', 'text' => 'Votre usage ?', 'options' => ['Peu', 'Moyen', 'Beaucoup']],
    'wordcloud' => ['type' => 'wordcloud', 'text' => 'Un mot pour le numérique ?'],
    'text' => ['type' => 'text', 'text' => 'Une remarque ?'],
    'scale' => ['type' => 'scale', 'text' => 'Note sur 10 ?', 'scaleMax' => 10],
    'points' => ['type' => 'points', 'text' => 'Répartissez 10 points', 'options' => ['Mails', 'Démarches', 'Photos'], 'budget' => 10],
];
$qid = [];
foreach ($questions as $k => $q) {
    $r = $admin->post('question_save', ['s' => $code, 'question' => $q]);
    expect_status($r, 200, "création question $k");
    $qid[$k] = $r['json']['id'] ?? '';
}
expect_status($admin->post('question_save', ['s' => $code, 'question' => ['type' => 'poll', 'text' => 'Un seul choix', 'options' => ['A']]]), 400, 'sondage à un seul choix refusé');
expect_status($admin->post('question_save', ['s' => $code, 'question' => ['type' => 'inconnu', 'text' => 'x']]), 400, 'type inconnu refusé');

// --- Participants --------------------------------------------------------------
expect_status($p[0]->join('ZZZZZ'), 404, 'code inconnu');
expect_status($p[0]->request('POST', 'api.php?action=join', ['s' => $code]), 403, 'rejoindre sans en-tête X-WL');
foreach ($p as $i => $c) {
    expect_status($c->join(strtolower($code)), 200, "participant $i rejoint (code en minuscules)");
}
check($p[0]->token !== $p[1]->token, 'jetons différents par participant');
$again = $p[0]->join($code);
check(($again['json']['token'] ?? '') === $p[0]->token, 'même jeton en rejoignant à nouveau');
$st = $p[0]->get("api.php?action=state&s=$code")['json'];
check($st['joined'] === true && $st['question']['id'] === $qid['yesno'], 'état participant : première question');
check($st['question']['correct'] === [], 'bonne réponse cachée avant affichage');

/** Ouvre une question, fait voter, ferme, affiche ; renvoie les résultats. */
function play(Client $admin, array $p, string $code, string $qid, array $votes): array
{
    expect_status($admin->post('control', ['s' => $code, 'op' => 'goto', 'qid' => $qid]), 200, 'aller à la question');
    expect_status($p[0]->vote($code, $qid, $votes[0]), 409, 'vote avant ouverture refusé');
    expect_status($admin->post('control', ['s' => $code, 'op' => 'open']), 200, 'ouvrir le vote');
    foreach ($votes as $i => $v) {
        expect_status($p[$i]->vote($code, $qid, $v), 200, "vote du participant $i");
    }
    expect_status($admin->post('control', ['s' => $code, 'op' => 'close']), 200, 'fermer le vote');
    expect_status($p[0]->vote($code, $qid, $votes[0]), 409, 'vote après fermeture refusé');
    expect_status($admin->post('control', ['s' => $code, 'op' => 'show']), 200, 'afficher les résultats');
    return $admin->get("api.php?action=screen&s=$code")['json']['results'] ?? [];
}

// Oui / Non, modification interdite.
expect_status($admin->post('control', ['s' => $code, 'op' => 'open']), 200, 'ouvrir oui/non');
expect_status($p[0]->vote($code, $qid['yesno'], 0), 200, 'vote oui');
expect_status($p[0]->vote($code, $qid['yesno'], 0), 200, 'même vote renvoyé (reprise réseau) accepté');
expect_status($p[0]->vote($code, $qid['yesno'], 1), 409, 'double vote différent refusé');
expect_status($p[1]->request('POST', 'api.php?action=vote', ['s' => $code, 'qid' => $qid['yesno'], 'value' => 1]), 403, 'vote sans CSRF refusé');
expect_status($p[1]->vote($code, $qid['yesno'], 5), 400, 'réponse hors liste refusée');
$admin->post('control', ['s' => $code, 'op' => 'close']);
$res = play($admin, $p, $code, $qid['yesno'], [0, 1, 0]);
check($res['counts'] === [2, 1] && $res['total'] === 3, 'résultats oui/non');
$st = $p[0]->get("api.php?action=state&s=$code")['json'];
check($st['question']['correct'] === [0] && $st['mine'] === 0, 'correction et réponse visibles après affichage');

// Vrai / Faux, modification autorisée.
$admin->post('control', ['s' => $code, 'op' => 'goto', 'qid' => $qid['truefalse']]);
$admin->post('control', ['s' => $code, 'op' => 'open']);
$p[2]->vote($code, $qid['truefalse'], 0);
$admin->post('control', ['s' => $code, 'op' => 'close']);
$res = play($admin, $p, $code, $qid['truefalse'], [1, 1, 1]);
check($res['counts'] === [0, 3], 'vrai/faux : réponse modifiée prise en compte');

$res = play($admin, $p, $code, $qid['mcq'], [[0, 1], [1], [2, 0, 0]]);
check($res['counts'] === [2, 2, 1] && $res['total'] === 3, 'QCM multiple');
expect_status($p[0]->vote($code, $qid['mcq'], []), 409, 'QCM vide (fermé) refusé');

$res = play($admin, $p, $code, $qid['poll'], [2, 2, 0]);
check($res['counts'] === [1, 0, 2], 'sondage');

$res = play($admin, $p, $code, $qid['wordcloud'], ['Écran', 'ecran', ' ÉCRAN  ']);
check(count($res['words']) === 1 && $res['words'][0]['n'] === 3, 'nuage : regroupement sans casse ni accents');
$admin->post('control', ['s' => $code, 'op' => 'open']);
expect_status($p[0]->vote($code, $qid['wordcloud'], 'zut alors'), 400, 'mot interdit refusé');
expect_status($p[0]->vote($code, $qid['wordcloud'], str_repeat('a', 81)), 400, 'réponse de 81 caractères refusée');
expect_status($p[0]->vote($code, $qid['wordcloud'], '   '), 400, 'réponse vide refusée');
expect_status($p[0]->vote($code, $qid['wordcloud'], str_repeat('é', 80)), 200, '80 caractères accentués acceptés');

$res = play($admin, $p, $code, $qid['text'], ['=1+1', '<script>alert(1)</script>', 'Jean Dupont 06 12']);
check(count($res['texts']) === 3, 'mur : 3 réponses');
$adm = $admin->get("api.php?action=admin_state&s=$code")['json'];
$q = array_values(array_filter($adm['questions'], fn($x) => $x['id'] === $qid['text']))[0];
$nominative = array_values(array_filter($q['results']['texts'], fn($t) => str_contains($t['text'], 'Dupont')))[0];
expect_status($admin->post('answer_hide', ['s' => $code, 'qid' => $qid['text'], 'aid' => $nominative['id'], 'hidden' => true]), 200, 'masquer une réponse');
$screen = $admin->get("api.php?action=screen&s=$code");
check(count($screen['json']['results']['texts']) === 2 && !str_contains($screen['body'], 'Dupont'), 'réponse masquée absente de la projection');
check(str_contains($screen['body'], '<script>'), 'texte renvoyé brut en JSON (échappé à l\'affichage)');

$res = play($admin, $p, $code, $qid['scale'], [10, 7, 1]);
check($res['average'] === 6 && $res['counts'][9] === 1, 'échelle : moyenne et répartition');
$admin->post('control', ['s' => $code, 'op' => 'open']);
expect_status($p[0]->vote($code, $qid['scale'], 11), 400, 'note hors échelle refusée');
expect_status($p[0]->vote($code, $qid['scale'], 0), 400, 'note 0 refusée');

$res = play($admin, $p, $code, $qid['points'], [[5, 5, 0], [10, 0, 0], [0, 3, 2]]);
check($res['counts'] === [15, 8, 2], 'classement par points');
$admin->post('control', ['s' => $code, 'op' => 'open']);
expect_status($p[0]->vote($code, $qid['points'], [8, 8, 0]), 400, 'dépassement du budget refusé');
expect_status($p[0]->vote($code, $qid['points'], [0, 0, 0]), 400, 'aucun point refusé');
$admin->post('control', ['s' => $code, 'op' => 'close']);

// --- Durée : vote refusé une fois le temps écoulé ----------------------------
$admin->post('question_save', ['s' => $code, 'question' => ['id' => $qid['poll'], 'duration' => 30] + $questions['poll']]);
$admin->post('control', ['s' => $code, 'op' => 'goto', 'qid' => $qid['poll']]);
$admin->post('control', ['s' => $code, 'op' => 'reset']);
$admin->post('control', ['s' => $code, 'op' => 'open']);
$st = $p[0]->get("api.php?action=state&s=$code")['json'];
check($st['question']['closesAt'] - $st['now'] === 30, 'compte à rebours de 30 s');
expect_status($p[0]->vote($code, $qid['poll'], 1), 200, 'vote dans le temps');
$file = "$data/sessions/$code.json";
$json = json_decode(file_get_contents($file), true);
$json['questions'][3]['closesAt'] = time() - 1;
file_put_contents($file, json_encode($json));
expect_status($p[1]->vote($code, $qid['poll'], 1), 409, 'vote après la fin du compte à rebours refusé');
$admin->post('control', ['s' => $code, 'op' => 'close']);

// --- Coût : 30 rafraîchissements sans changement = 0 corps renvoyé -----------
$path = "api.php?action=state&s=$code";
$first = $p[0]->poll($path);
check($first['status'] === 200 && isset($first['headers']['etag']), 'premier rafraîchissement : 200 + ETag');
$bodies = 0;
$notModified = 0;
for ($i = 0; $i < 30; $i++) {
    $r = $p[0]->poll($path);
    $notModified += $r['status'] === 304 ? 1 : 0;
    $bodies += strlen($r['body']);
}
check($notModified === 30 && $bodies === 0, "30 rafraîchissements sans changement : $notModified × 304, $bodies octets");
$p[0]->poll("api.php?action=screen&s=$code");
$admin->post('control', ['s' => $code, 'op' => 'goto', 'qid' => $qid['wordcloud']]);
$admin->post('control', ['s' => $code, 'op' => 'hide']);
$admin->post('control', ['s' => $code, 'op' => 'open']);
$p[0]->poll($path);
$p[1]->vote($code, $qid['wordcloud'], 'partage');
check($p[0]->poll($path)['status'] === 304, 'le vote d\'un autre ne réveille pas les téléphones');
check($p[0]->poll("api.php?action=screen&s=$code")['status'] === 200, 'le vote d\'un autre rafraîchit la projection');
$admin->post('control', ['s' => $code, 'op' => 'next']);
check($p[0]->poll($path)['status'] === 200, 'question suivante : les téléphones se mettent à jour');

// --- Limite de taux par participant --------------------------------------------
$admin->post('control', ['s' => $code, 'op' => 'goto', 'qid' => $qid['poll']]);
$admin->post('control', ['s' => $code, 'op' => 'reset']);
$admin->post('control', ['s' => $code, 'op' => 'open']);
$codes = [];
for ($i = 0; $i < 55; $i++) {
    $codes[] = $p[2]->vote($code, $qid['poll'], $i % 3)['status'];
}
check(in_array(429, $codes, true), 'limite de votes par minute pour un participant');

// --- Export -------------------------------------------------------------------
$csv = $admin->get("api.php?action=export&s=$code");
expect_status($csv, 200, 'export CSV');
check(str_starts_with($csv['body'], "\xEF\xBB\xBF") && str_contains($csv['body'], '";"'), 'CSV : BOM UTF-8 et point-virgule');
check(str_contains($csv['body'], "\"'=1+1\""), 'CSV : formule neutralisée');
check(str_contains($csv['body'], 'Firefox (bonne réponse)'), 'CSV : bonne réponse signalée');
$print = $admin->get("api.php?action=export&s=$code&format=print");
check($print['status'] === 200 && str_contains($print['body'], 'Atelier test &lt;b&gt;'), 'version imprimable échappée');
expect_status((new Client($base))->get("api.php?action=export&s=$code"), 401, 'export sans connexion refusé');

// --- Réordonner, dupliquer, terminer, supprimer --------------------------------
$admin->post('question_move', ['s' => $code, 'qid' => $qid['truefalse'], 'dir' => -1]);
$adm = $admin->get("api.php?action=admin_state&s=$code")['json'];
check($adm['questions'][0]['id'] === $qid['truefalse'], 'question remontée');
$r = $admin->post('session_duplicate', ['s' => $code]);
$copy = $r['json']['code'] ?? '';
$dup = $admin->get("api.php?action=admin_state&s=$copy")['json'];
check(count($dup['questions']) === 8 && $dup['questions'][0]['results']['total'] === 0 && $dup['participants'] === 0, 'copie sans votes ni participants');
$admin->post('control', ['s' => $code, 'op' => 'end']);
check($p[0]->get($path)['json']['ended'] === true, 'session terminée visible des participants');
expect_status((new Client($base))->join($code), 409, 'rejoindre une session terminée refusé');
expect_status($p[0]->vote($code, $qid['poll'], 0), 409, 'vote dans une session terminée refusé');
expect_status($admin->post('session_delete', ['s' => $copy]), 200, 'suppression');
expect_status($p[0]->get("api.php?action=state&s=$copy"), 404, 'session supprimée introuvable');

// --- Purge automatique -------------------------------------------------------
$file = "$data/sessions/$code.json";
$json = json_decode(file_get_contents($file), true);
$json['updated'] = time() - 31 * 86400;
file_put_contents($file, json_encode($json));
touch("$data/last-purge", time() - 7200);
$admin->get('api.php?action=me');
check(!is_file($file), 'session inactive depuis 31 jours purgée');
expect_status($p[0]->get($path), 404, 'session purgée : code inconnu');

// --- Stockage : aucun JSON corrompu ----------------------------------------------
foreach (glob("$data/sessions/*.json") as $f) {
    check(is_array(json_decode(file_get_contents($f), true)), 'JSON valide : ' . basename($f));
}
check(glob("$data/sessions/*.tmp") === [], 'aucun fichier temporaire restant');
check(!str_contains(implode('', array_map('file_get_contents', glob("$data/sessions/*.json"))), $p[0]->token), 'jeton jamais stocké en clair');

// --- Déconnexion et blocage après 5 échecs (en dernier : bloque l'IP locale) ---
$admin->post('logout', []);
expect_status($admin->get('api.php?action=sessions'), 401, 'déconnecté');
$intrus = new Client($base);
for ($i = 0; $i < 5; $i++) {
    $intrus->post('login', ['password' => 'essai' . $i]);
}
expect_status($intrus->post('login', ['password' => getenv('WL_PASSWORD')]), 429, 'bon mot de passe refusé après 5 échecs');

finish('e2e');
