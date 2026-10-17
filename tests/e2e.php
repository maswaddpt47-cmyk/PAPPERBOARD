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
    'yesno' => ['type' => 'yesno', 'text' => 'Avez-vous un smartphone ?', 'correct' => [0], 'allowChange' => false, 'explain' => 'Oui : 9 sur 10.'],
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
check(!file_exists("$data/sessions/ZZZZZ.json.lock"), 'aucun verrou créé pour un code inconnu');
expect_status($p[0]->request('POST', 'api.php?action=join', ['s' => $code]), 403, 'rejoindre sans en-tête X-WL');
foreach ($p as $i => $c) {
    expect_status($c->join(strtolower($code)), 200, "participant $i rejoint (code en minuscules)");
}
check($p[0]->token !== $p[1]->token, 'jetons différents par participant');
$again = $p[0]->join($code);
check(($again['json']['token'] ?? '') === $p[0]->token, 'même jeton en rejoignant à nouveau');
$admin->post('control', ['s' => $code, 'op' => 'lock']);
expect_status((new Client($base))->join($code), 409, 'inscriptions fermées : nouveau participant refusé');
expect_status($p[1]->join($code), 200, 'inscriptions fermées : un inscrit revient');
$admin->post('control', ['s' => $code, 'op' => 'unlock']);
$st = $p[0]->get("api.php?action=state&s=$code")['json'];
check($st['joined'] === true && $st['question'] === null, 'état participant : accueil, aucune question');
check($admin->get("api.php?action=screen&s=$code")['json']['question'] === null, 'projection : accueil');
expect_status($admin->post('control', ['s' => $code, 'op' => 'next']), 200, 'première question');
$st = $p[0]->get("api.php?action=state&s=$code")['json'];
check($st['question']['id'] === $qid['yesno'] && $st['question']['state'] === 'open', 'question suivante jamais ouverte : vote ouvert automatiquement');
check($st['question']['correct'] === [], 'bonne réponse cachée avant affichage');

/** Ouvre une question, fait voter, ferme, affiche ; renvoie les résultats. */
function play(Client $admin, array $p, string $code, string $qid, array $votes): array
{
    expect_status($admin->post('control', ['s' => $code, 'op' => 'goto', 'qid' => $qid]), 200, 'aller à la question');
    $admin->post('control', ['s' => $code, 'op' => 'reset']); // brouillon : vote fermé
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
check(($admin->get("api.php?action=screen&s=$code")['json']['question']['explain'] ?? null) === '', 'explication cachée avant les résultats');
expect_status($admin->post('control', ['s' => $code, 'op' => 'open']), 200, 'rouvrir oui/non (sans effet)');
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
check(($st['question']['explain'] ?? '') === 'Oui : 9 sur 10.', 'explication visible avec les résultats');

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
$graded = array_column($adm['questions'], 'graded', 'id');
check(($graded[$qid['yesno']] ?? null) === true && ($graded[$qid['poll']] ?? null) === false, 'téléphone : seul un quiz (bonne réponse définie) garde « Envoyer »');
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

// --- Modifier une question qui a des votes ---------------------------------
$admin->post('question_save', ['s' => $code, 'question' => ['id' => $qid['poll'], 'text' => 'Votre usage ? (renommé)'] + $questions['poll']]);
$adm = $admin->get("api.php?action=admin_state&s=$code")['json'];
check($adm['questions'][3]['results']['total'] === 3, 'intitulé modifié : votes conservés');
$admin->post('question_save', ['s' => $code, 'question' => ['id' => $qid['poll'], 'options' => ['Peu', 'Beaucoup']] + $questions['poll']]);
$adm = $admin->get("api.php?action=admin_state&s=$code")['json'];
check($adm['questions'][3]['results']['total'] === 0 && $adm['questions'][3]['state'] === 'draft', 'un choix retiré : votes effacés');
expect_status($admin->get("api.php?action=export&s=$code"), 200, 'export après modification');
$admin->post('question_save', ['s' => $code, 'question' => ['id' => $qid['poll']] + $questions['poll']]);
$admin->post('control', ['s' => $code, 'op' => 'goto', 'qid' => $qid['poll']]);
$admin->post('control', ['s' => $code, 'op' => 'open']);
$admin->post('question_save', ['s' => $code, 'question' => ['id' => $qid['poll'], 'options' => ['Peu', 'Moyen', 'Beaucoup', 'Énormément']] + $questions['poll']]);
$adm = $admin->get("api.php?action=admin_state&s=$code")['json'];
check($adm['questions'][3]['state'] === 'open', 'choix modifiés pendant le vote : réponses effacées, vote toujours ouvert');
$admin->post('question_save', ['s' => $code, 'question' => ['id' => $qid['poll']] + $questions['poll']]);
$admin->post('control', ['s' => $code, 'op' => 'close']);

// --- Durée : vote refusé une fois le temps écoulé ----------------------------
$admin->post('question_save', ['s' => $code, 'question' => ['id' => $qid['poll'], 'duration' => 30] + $questions['poll']]);
$admin->post('control', ['s' => $code, 'op' => 'goto', 'qid' => $qid['poll']]);
$admin->post('control', ['s' => $code, 'op' => 'reset']);
$admin->post('control', ['s' => $code, 'op' => 'open']);
$st = $p[0]->get("api.php?action=state&s=$code")['json'];
check(abs($st['question']['closesAt'] - $st['now'] - 30) <= 1, 'compte à rebours de 30 s (à une seconde près : l\'horloge peut changer entre les deux lectures)');
expect_status($p[0]->vote($code, $qid['poll'], 1), 200, 'vote dans le temps');
$file = "$data/sessions/$code.json";
$json = json_decode(file_get_contents($file), true);
$json['questions'][3]['closesAt'] = time() - 1;
file_put_contents($file, json_encode($json));
expect_status($p[1]->vote($code, $qid['poll'], 1), 409, 'vote après la fin du compte à rebours refusé');
$admin->post('control', ['s' => $code, 'op' => 'close']);

// --- Mur collaboratif, post-it collectif, gommettes -----------------------------
$save = fn(array $q) => $admin->post('question_save', ['s' => $code, 'question' => $q])['json']['id'] ?? '';
$wallId = $save(['type' => 'wall', 'text' => 'Ce que vous retenez']);
$postitId = $save(['type' => 'postit', 'text' => 'Bilan', 'options' => ['Points forts', 'Difficultés']]);
expect_status($admin->post('question_save', ['s' => $code, 'question' => ['type' => 'dots', 'text' => 'Priorités', 'source' => $qid['poll']]]), 400, 'gommettes sur une question qui n\'est pas un post-it refusées');
$dotsId = $save(['type' => 'dots', 'text' => 'Vos priorités', 'source' => $postitId, 'budget' => 3]);
$admin->post('control', ['s' => $code, 'op' => 'reopen']);
$post = fn(Client $c, string $q, string $text, int $col = 0) => $c->post('post', ['s' => $code, 'qid' => $q, 'text' => $text, 'col' => $col]);
$wstate = fn(Client $c) => $c->get("api.php?action=state&s=$code")['json'];

$admin->post('control', ['s' => $code, 'op' => 'goto', 'qid' => $wallId]);
$r = $post($p[0], $wallId, 'Les mots de passe');
expect_status($r, 200, 'mur : message publié');
$mineId = $r['json']['id'] ?? '';
$otherId = $post($p[1], $wallId, 'Le QR code')['json']['id'] ?? '';
for ($i = 0; $i < 4; $i++) {
    $post($p[0], $wallId, "Idée $i");
}
expect_status($post($p[0], $wallId, 'Une de trop'), 409, 'mur : 6e message refusé (5 au plus)');
$sc = $admin->get("api.php?action=screen&s=$code")['json'];
check(($sc['answered'] ?? 0) === 6 && ($sc['contributors'] ?? 0) === 2, 'mur : 6 messages de 2 personnes (décompte « ont participé »)');
expect_status($p[0]->vote($code, $wallId, 0), 400, 'mur : pas de vote simple');
check(count($wstate($p[1])['posts']) === 1, 'mur non publié : chacun ne voit que ses messages');
expect_status($p[1]->post('like', ['s' => $code, 'qid' => $wallId, 'pid' => $mineId]), 409, 'aimer avant publication refusé');
$admin->post('control', ['s' => $code, 'op' => 'show']);
check(count($wstate($p[1])['posts']) === 6, 'mur publié : tous les messages visibles');
check(($p[1]->post('like', ['s' => $code, 'qid' => $wallId, 'pid' => $mineId])['json']['liked'] ?? null) === true, 'j\'aime');
check(($p[1]->post('like', ['s' => $code, 'qid' => $wallId, 'pid' => $mineId])['json']['liked'] ?? null) === false, 'j\'aime retiré');
$p[1]->post('like', ['s' => $code, 'qid' => $wallId, 'pid' => $mineId]);
$p[2]->post('like', ['s' => $code, 'qid' => $wallId, 'pid' => $mineId]);
$res = $admin->get("api.php?action=screen&s=$code")['json']['results'];
check($res['posts'][0]['id'] === $mineId && $res['posts'][0]['likes'] === 2, 'mur : le plus aimé en tête');
expect_status($p[0]->post('post_delete', ['s' => $code, 'qid' => $wallId, 'pid' => $otherId]), 403, 'retirer le message d\'un autre refusé');
expect_status($p[1]->post('post_delete', ['s' => $code, 'qid' => $wallId, 'pid' => $otherId]), 200, 'retirer son message');
$admin->post('answer_hide', ['s' => $code, 'qid' => $wallId, 'aid' => $mineId, 'hidden' => true]);
check(!in_array($mineId, array_column($wstate($p[1])['posts'], 'id'), true), 'message masqué invisible des autres');
check(in_array($mineId, array_column($wstate($p[0])['posts'], 'id'), true), 'son auteur le voit encore');
check(count($admin->get("api.php?action=screen&s=$code")['json']['results']['posts']) === 4, 'message masqué absent de la projection');

$admin->post('control', ['s' => $code, 'op' => 'goto', 'qid' => $postitId]);
$a = $post($p[0], $postitId, 'Accès internet', 0)['json']['id'] ?? '';
$b = $post($p[1], $postitId, 'Mots de passe', 1)['json']['id'] ?? '';
$c = $post($p[2], $postitId, 'Identifiants oubliés', 1)['json']['id'] ?? '';
expect_status($post($p[2], $postitId, 'Colonne inconnue', 5), 400, 'post-it : colonne inconnue refusée');
expect_status($admin->post('post_admin', ['s' => $code, 'qid' => $postitId, 'pid' => $c, 'op' => 'group', 'arg' => $b]), 200, 'regrouper deux post-its');
expect_status($admin->post('post_admin', ['s' => $code, 'qid' => $postitId, 'pid' => $a, 'op' => 'group', 'arg' => $c]), 400, 'regrouper sous un post-it déjà regroupé refusé');
expect_status($admin->post('post_admin', ['s' => $code, 'qid' => $postitId, 'pid' => $b, 'op' => 'move', 'arg' => 0]), 200, 'déplacer un post-it');
$res = $admin->get("api.php?action=admin_state&s=$code")['json']['questions'][9]['results'];
$byId = array_column($res['posts'], null, 'id');
check($byId[$c]['parent'] === $b && $byId[$c]['col'] === 0 && $byId[$b]['col'] === 0, 'le groupe suit son post-it principal');
expect_status($p[0]->post('post', ['s' => $code, 'qid' => $postitId, 'text' => 'x'], false), 403, 'post-it sans CSRF refusé');

$admin->post('control', ['s' => $code, 'op' => 'goto', 'qid' => $dotsId]);
check($wstate($p[0])['items'] === [], 'gommettes : idées d\'un post-it non publié invisibles');
$admin->post('control', ['s' => $code, 'op' => 'goto', 'qid' => $postitId]);
$admin->post('control', ['s' => $code, 'op' => 'show']); // publier la source
$admin->post('control', ['s' => $code, 'op' => 'goto', 'qid' => $dotsId]);
$st = $wstate($p[0]);
check(count($st['items']) === 2 && in_array('Identifiants oubliés', array_merge(...array_column($st['items'], 'grouped')), true), 'gommettes : idées principales, regroupées dessous');
expect_status($admin->post('question_save', ['s' => $code, 'question' => ['type' => 'dots', 'text' => 'X', 'source' => $postitId, 'column' => 5]]), 400, 'gommettes : colonne inconnue refusée');
$dotsCol = $save(['type' => 'dots', 'text' => 'Difficultés seulement', 'source' => $postitId, 'column' => 1]);
$admin->post('control', ['s' => $code, 'op' => 'goto', 'qid' => $dotsCol]);
check($wstate($p[0])['items'] === [], 'gommettes : seules les idées de la colonne choisie (toutes déplacées en colonne 1)');
$admin->post('question_delete', ['s' => $code, 'qid' => $dotsCol]);
$admin->post('control', ['s' => $code, 'op' => 'goto', 'qid' => $dotsId]);
expect_status($p[0]->vote($code, $dotsId, [$b => 2, $a => 1]), 200, 'coller 3 gommettes');
expect_status($p[1]->vote($code, $dotsId, [$b => 4]), 400, 'plus de gommettes que permis refusé');
expect_status($p[1]->vote($code, $dotsId, ['nzzzz' => 1]), 400, 'idée inconnue refusée');
expect_status($p[1]->vote($code, $dotsId, [$b => 1]), 200, 'une seule gommette acceptée');
$admin->post('control', ['s' => $code, 'op' => 'show']);
$res = $admin->get("api.php?action=screen&s=$code")['json']['results'];
check($res['items'][0]['id'] === $b && $res['items'][0]['n'] === 3 && $res['total'] === 2, 'gommettes : classement');

// --- Moment de la correction : immédiate, ou à la fin du temps ----------------
expect_status($admin->post('question_save', ['s' => $code, 'question' => ['type' => 'truefalse', 'text' => 'Sans bonne réponse', 'reveal' => 'instant']]), 400, 'correction immédiate sans bonne réponse refusée');
expect_status($admin->post('question_save', ['s' => $code, 'question' => ['type' => 'yesno', 'text' => 'Sans durée', 'correct' => [0], 'reveal' => 'end']]), 400, 'correction en fin de temps sans durée refusée');
foreach (['text', 'wall', 'postit'] as $written) {
    expect_status($admin->post('question_save', ['s' => $code, 'question' => ['type' => $written, 'text' => 'Écrite', 'reveal' => 'end', 'duration' => 30]]), 400, "affichage automatique refusé pour $written");
}
$instant = $admin->post('question_save', ['s' => $code, 'question' => ['type' => 'truefalse', 'text' => 'Quiz immédiat', 'correct' => [0], 'reveal' => 'instant']])['json']['id'] ?? '';
$admin->post('control', ['s' => $code, 'op' => 'goto', 'qid' => $instant]);
check($p[0]->get("api.php?action=state&s=$code")['json']['question']['correct'] === [], 'immédiate : pas de correction avant de répondre');
$r = $p[0]->vote($code, $instant, 1);
check(($r['json']['correct'] ?? null) === [0], 'immédiate : correction renvoyée avec le vote');
check($p[0]->get("api.php?action=state&s=$code")['json']['question']['correct'] === [0], 'immédiate : correction visible ensuite');
check($p[1]->get("api.php?action=state&s=$code")['json']['question']['correct'] === [], 'immédiate : invisible pour qui n\'a pas répondu');
expect_status($p[0]->vote($code, $instant, 0), 409, 'immédiate : réponse figée après la correction');
$atEnd = $admin->post('question_save', ['s' => $code, 'question' => ['type' => 'yesno', 'text' => 'Quiz fin du temps', 'correct' => [0], 'reveal' => 'end', 'duration' => 30]])['json']['id'] ?? '';
$admin->post('control', ['s' => $code, 'op' => 'goto', 'qid' => $atEnd]);
$p[1]->vote($code, $atEnd, 0);
$endPath = "api.php?action=state&s=$code";
$p[2]->poll($endPath);
check($p[2]->poll($endPath)['status'] === 304, 'fin du temps : rien avant l\'échéance');
check($admin->get("api.php?action=screen&s=$code")['json']['results'] === null, 'fin du temps : pas de résultats projetés avant');
$file = "$data/sessions/$code.json";
$json = json_decode(file_get_contents($file), true);
foreach ($json['questions'] as &$jq) {
    if ($jq['id'] === $atEnd) {
        $jq['closesAt'] = time() - 1;
    }
}
unset($jq);
file_put_contents($file, json_encode($json));
$after = $p[2]->poll($endPath);
check($after['status'] === 200 && $after['json']['question']['correct'] === [0] && $after['json']['question']['showResults'] === true, 'fin du temps : correction envoyée sans action de l\'animateur');
check(($admin->get("api.php?action=screen&s=$code")['json']['results']['counts'] ?? null) === [1, 0], 'fin du temps : résultats projetés');

// --- Coût : 30 rafraîchissements sans changement = 0 corps renvoyé -----------
$path = "api.php?action=state&s=$code";
$first = $p[0]->poll($path);
check($first['status'] === 200 && isset($first['headers']['etag']), 'premier rafraîchissement : 200 + ETag');
$bodies = 0;
$notModified = 0;
for ($i = 0; $i < 30; $i++) { // 2 thèmes déjà là : le 29e ajout est le dernier accepté
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
// 110 votes : la fenêtre est d'une minute, un changement de minute en cours de route en coupe deux, dont une dépasse 50.
for ($i = 0; $i < 110; $i++) {
    $codes[] = $p[2]->vote($code, $qid['poll'], $i % 3)['status'];
}
check(in_array(429, $codes, true), 'limite de votes par minute pour un participant');

// --- Export -------------------------------------------------------------------
$csv = $admin->get("api.php?action=export&s=$code");
expect_status($csv, 200, 'export CSV');
check(str_starts_with($csv['body'], "\xEF\xBB\xBF") && str_contains($csv['body'], '";"'), 'CSV : BOM UTF-8 et point-virgule');
check(str_contains($csv['body'], "\"'=1+1\""), 'CSV : formule neutralisée');
check(str_contains($csv['body'], 'Firefox (bonne réponse)'), 'CSV : bonne réponse signalée');
check(str_contains($csv['body'], 'Points forts : Mots de passe') && str_contains($csv['body'], 'Vote par gommettes'), 'CSV : post-its et gommettes');
$print = $admin->get("api.php?action=export&s=$code&format=print");
check($print['status'] === 200 && str_contains($print['body'], 'Atelier test &lt;b&gt;'), 'version imprimable échappée');
$admin->post('answer_hide', ['s' => $code, 'qid' => $postitId, 'aid' => $b, 'hidden' => true]);
$public = $admin->get("api.php?action=export&public=1&s=$code")['body'];
check(str_contains($csv['body'], 'Dupont') && !str_contains($public, 'Dupont'), 'CSV à diffuser : réponse masquée absente');
check(!str_contains($public, 'Identifiants oubliés'), 'CSV à diffuser : post-it regroupé sous un post-it masqué absent');

// --- Jeton participant : signé, daté, une journée --------------------------------
$cfg = require getenv('WOOCLIGHT_CONFIG');
$sign = fn(string $body) => substr(hash_hmac('sha256', 'tok|' . $body, $cfg['secret']), 0, 16);
$oldBody = str_repeat('a', 32) . '.' . (time() - 2 * 86400);
$oldTok = new Client($base);
$r = $oldTok->request('POST', 'api.php?action=join', ['s' => $code], ['X-WL: 1', 'X-WL-Token: ' . $oldBody . '.' . $sign($oldBody)]);
check(($r['json']['token'] ?? '') !== '' && !str_starts_with($r['json']['token'], str_repeat('a', 32)), 'jeton de plus d\'une journée remplacé');
$fake = new Client($base);
$r = $fake->request('POST', 'api.php?action=join', ['s' => $code], ['X-WL: 1', 'X-WL-Token: ' . str_repeat('b', 32) . '.' . time() . '.' . str_repeat('0', 16)]);
check(!str_starts_with($r['json']['token'] ?? 'bbbb', str_repeat('b', 32)), 'jeton à signature fausse refusé');
$r = $fake->post('leave', []);
check(str_contains($r['headers']['set-cookie'] ?? '', 'wl_p=deleted') || str_contains($r['headers']['set-cookie'] ?? '', 'wl_p=;'), 'quitter : cookie du téléphone effacé');
expect_status((new Client($base))->get("api.php?action=export&s=$code"), 401, 'export sans connexion refusé');

// --- Réordonner, dupliquer, terminer, supprimer --------------------------------
$admin->post('question_move', ['s' => $code, 'qid' => $qid['truefalse'], 'dir' => -1]);
$adm = $admin->get("api.php?action=admin_state&s=$code")['json'];
check($adm['questions'][0]['id'] === $qid['truefalse'], 'question remontée');
$r = $admin->post('session_duplicate', ['s' => $code]);
$copy = $r['json']['code'] ?? '';
$dup = $admin->get("api.php?action=admin_state&s=$copy")['json'];
check(count($dup['questions']) === 13 && $dup['questions'][10]['source'] === $dup['questions'][9]['id'] && $dup['questions'][0]['results']['total'] === 0 && $dup['participants'] === 0, 'copie sans votes ni participants');
expect_status($admin->post('session_conclusion', ['s' => $code, 'conclusion' => str_repeat('a', 601)]), 400, 'conclusion trop longue refusée');
$admin->post('session_conclusion', ['s' => $code, 'conclusion' => 'À retenir : un mot de passe ne se partage pas.']);
$admin->post('session_synthesis', ['s' => $code, 'synthesis' => "Synthèse :\r\n\r\n\r\n1. Point un\n2. Point deux"]);
check(($admin->get("api.php?action=admin_state&s=$code")['json']['synthesis'] ?? '') === "Synthèse :\n\n1. Point un\n2. Point deux", 'synthèse enregistrée, retours à la ligne gardés');
check(!str_contains(json_encode($p[0]->get("api.php?action=state&s=$code")['json']), 'Point un'), 'synthèse jamais envoyée aux téléphones');
$admin->post('control', ['s' => $code, 'op' => 'end']);
$end = $admin->get("api.php?action=screen&s=$code")['json'];
check(!isset($end['recap']) && ($end['conclusion'] ?? '') === 'À retenir : un mot de passe ne se partage pas.', 'fin : conclusion seule projetée (pas de récap public)');
$adminRecap = $admin->get("api.php?action=admin_state&s=$code")['json']['recap'] ?? [];
$recap = array_column($adminRecap, 'summary', 'text');
check(str_ends_with($recap['Avez-vous un smartphone ?'] ?? '', 'bonnes réponses'), 'fin : récap (quiz) gardé pour l\'animateur (PowerPoint)');
check(!str_contains(json_encode($adminRecap, JSON_UNESCAPED_UNICODE), 'Dupont'), 'fin : jamais le texte d\'une réponse libre dans le récap');
check(($p[0]->get("api.php?action=state&s=$code")['json']['conclusion'] ?? '') !== '', 'fin : conclusion envoyée aux téléphones');
$cc = $admin->post('session_create', ['title' => 'Conclusion'])['json']['code'] ?? '';
$rawc = json_encode([['type' => 'wordcloud', 'text' => 'Un mot ?'], ['type' => 'conclusion', 'text' => 'Bravo à tous.']]);
$imp = $admin->post('questions_import', ['s' => $cc, 'raw' => $rawc, 'keep' => [0, 1]]);
check(($imp['json']['added'] ?? 0) === 1 && ($admin->get("api.php?action=admin_state&s=$cc")['json']['conclusion'] ?? '') === 'Bravo à tous.', 'import : conclusion de l\'IA enregistrée, pas comptée comme question');
check($p[0]->get($path)['json']['ended'] === true, 'session terminée visible des participants');
expect_status((new Client($base))->join($code), 409, 'rejoindre une session terminée refusé');
check($p[0]->get("api.php?action=state&s=$code")['json']['question'] === null, 'session terminée : plus de question servie');
check(!isset($admin->get("api.php?action=screen&s=$code")['json']['results']), 'session terminée : projection vide');
expect_status($p[0]->vote($code, $qid['poll'], 0), 409, 'vote dans une session terminée refusé');
expect_status($admin->post('session_delete', ['s' => $copy]), 200, 'suppression');
expect_status($p[0]->get("api.php?action=state&s=$copy"), 404, 'session supprimée introuvable');

// --- Purge automatique -------------------------------------------------------
$file = "$data/sessions/$code.json";
$json = json_decode(file_get_contents($file), true);
$json['activity'] = time() - 31 * 86400; // dernière action de l'animateur
$json['updated'] = time();                // un participant est encore passé : ne compte pas
file_put_contents($file, json_encode($json));
touch("$data/last-purge", time() - 7200);
$admin->get('api.php?action=me');
check(!is_file($file), 'sans action de l\'animateur depuis 31 jours : purgée, même avec un passage récent');
expect_status($p[0]->get($path), 404, 'session purgée : code inconnu');
$arch = $admin->get('api.php?action=archives')['json']['archives'] ?? [];
$aid = array_values(array_filter($arch, fn($a) => $a['title'] === $json['title']))[0]['id'] ?? '';
$ar = $admin->get('api.php?action=archive&id=' . $aid)['json'] ?? [];
$raw = file_get_contents("$data/archives/$aid.json");
check(count($ar['questions'] ?? []) === count($json['questions']) && ($ar['conclusion'] ?? '') !== '', 'purge : archive anonyme créée (questions, conclusion)');
check(!str_contains($raw, $p[0]->token) && !str_contains($raw, 'Dupont') && !str_contains($raw, '"answers"') && str_contains($raw, 'Point un'),
    'archive : ni jeton, ni réponse une à une, ni texte d\'un participant (synthèse de l\'animateur gardée)');
$yes = array_values(array_filter($ar['questions'], fn($q) => $q['text'] === 'Avez-vous un smartphone ?'))[0] ?? [];
check(isset($yes['results']['counts']) && !isset($yes['results']['texts']), 'archive : résultats chiffrés gardés');
expect_status($p[0]->get('api.php?action=archives'), 401, 'archives réservées à l\'animateur');
$reuse = $admin->post('archive_reuse', ['id' => $aid]);
check(count($admin->get('api.php?action=admin_state&s=' . ($reuse['json']['code'] ?? ''))['json']['questions'] ?? []) > 0, 'archive : questions réutilisées dans une nouvelle session');
expect_status($admin->post('archive_delete', ['id' => '../sessions/x']), 404, 'archive : identifiant invalide refusé');
expect_status($admin->post('archive_delete', ['id' => $aid]), 200, 'archive supprimée');

// --- Projection en direct (sondage, nuage, échelle, points) ---------------------
$dir = $admin->post('session_create', ['title' => 'Direct'])['json']['code'] ?? '';
$live = $admin->post('question_save', ['s' => $dir, 'question' => ['type' => 'poll', 'text' => 'En direct', 'options' => ['A', 'B']]])['json']['id'] ?? '';
$off = $admin->post('question_save', ['s' => $dir, 'question' => ['type' => 'wordcloud', 'text' => 'Sans direct', 'live' => false]])['json']['id'] ?? '';
$quiz = $admin->post('question_save', ['s' => $dir, 'question' => ['type' => 'truefalse', 'text' => 'Quiz', 'correct' => [1], 'live' => true]])['json']['id'] ?? '';
$screenRes = fn() => $admin->get("api.php?action=screen&s=$dir")['json']['results'] ?? null;
$admin->post('control', ['s' => $dir, 'op' => 'goto', 'qid' => $live]);
$viewer = new Client($base); // participant neuf : les autres ont épuisé leur limite de taux
$viewer->join($dir);
$viewer->vote($dir, $live, 1);
check(($screenRes()['counts'] ?? null) === [0, 1], 'direct : sondage projeté pendant le vote, sans « Afficher »');
$st = $viewer->get("api.php?action=state&s=$dir")['json'];
check(empty($st['question']['showResults']) && !isset($st['results']) && empty($st['result']), 'direct : les téléphones n\'affichent pas les résultats (coût du polling)');
// Liste de paires, pas de clés : un identifiant tout en chiffres (« 24342264 »,
// 1 fois sur 40 environ) deviendrait un entier comme clé PHP (cause de l'échec
// intermittent, trouvée le 15/10/2026).
foreach ([[$off, 'nuage sans direct'], [$quiz, 'quiz (correction)']] as [$id, $label]) {
    $admin->post('control', ['s' => $dir, 'op' => 'goto', 'qid' => $id]);
    $admin->post('control', ['s' => $dir, 'op' => 'open']);
    check($screenRes() === null, "direct : $label pas projeté avant « Afficher »");
}

// --- Bilan projeté, une question par diapositive ---------------------------------
$phone = "api.php?action=state&s=$dir";
$viewer->poll($phone);
$admin->post('control', ['s' => $dir, 'op' => 'board']);
check($viewer->poll($phone)['status'] === 304, 'bilan projeté : les téléphones ne se rafraîchissent pas');
$slide = fn() => $admin->get("api.php?action=screen&s=$dir")['json'];
$b = $slide();
check(($b['board']['count'] ?? 0) === 3 && ($b['results']['counts'] ?? null) === [0, 1], 'bilan projeté : diapositive 1 / 3, résultats du sondage');
$admin->post('control', ['s' => $dir, 'op' => 'board_next']);
$admin->post('control', ['s' => $dir, 'op' => 'board_next']);
$admin->post('control', ['s' => $dir, 'op' => 'board_next']);
$b = $slide();
check(($b['board']['position'] ?? 0) === 3 && $b['results'] === null && ($b['question']['correct'] ?? null) === [],
    'bilan projeté : rien de plus que pendant l\'atelier (quiz non affiché : ni résultats ni correction)');
$admin->post('control', ['s' => $dir, 'op' => 'show']);
check(!isset($slide()['board']), 'bilan projeté : piloter une question reprend la projection normale');
$viewer->poll($phone);
$admin->post('control', ['s' => $dir, 'op' => 'qr_hide']);
check(($slide()['qrHidden'] ?? false) === true && $viewer->poll($phone)['status'] === 304, 'QR code masqué sur la projection, téléphones non réveillés');
$admin->post('control', ['s' => $dir, 'op' => 'qr_show']);
check(($slide()['qrHidden'] ?? true) === false, 'QR code réaffiché');

// --- Import de questions générées par une IA (copier-coller) -------------------
$gen = $admin->post('session_create', ['title' => 'Générée'])['json']['code'] ?? '';
$raw = "Voici vos questions :\n```json\n" . json_encode([
    ['type' => 'wordcloud', 'text' => 'Un mot sur les arnaques ?'],
    ['type' => 'truefalse', 'text' => 'Une banque demande votre code par SMS.', 'correct' => 'faux'],
    ['type' => 'mcq', 'text' => 'Signes d\'alerte ?', 'options' => ['Urgence', 'Fautes', 'Logo'], 'correct' => ['urgence', 'Fautes']],
    ['type' => 'mcq', 'text' => 'Bonne réponse inventée', 'options' => ['A', 'B'], 'correct' => ['C']],
    ['type' => 'postit', 'text' => 'Vos réflexes', 'options' => ['Je fais', 'Je ne fais pas']],
    ['type' => 'dots', 'text' => 'Le plus utile ?', 'source' => 5, 'budget' => 3, 'column' => 'je fais'],
    ['type' => 'dots', 'text' => 'Source invalide', 'source' => 2],
    ['type' => 'scale', 'text' => 'À l\'aise ?', 'scaleMax' => 10],
], JSON_UNESCAPED_UNICODE) . "\n```\nBon atelier !";
$prev = $admin->post('questions_import', ['s' => $gen, 'raw' => $raw, 'preview' => true]);
$items = $prev['json']['items'] ?? [];
expect_status($prev, 200, 'import : aperçu');
check(count($items) === 8 && isset($items[3]['error'], $items[6]['error']), 'import : bonne réponse absente des choix et gommettes sans source valide écartées');
check(($items[1]['correct'] ?? null) === [1] && ($items[2]['correct'] ?? null) === [0, 1] && ($items[2]['multi'] ?? false), 'import : bonnes réponses retrouvées par leur texte (sans casse ni accents)');
check(count($admin->get("api.php?action=admin_state&s=$gen")['json']['questions'] ?? [1]) === 0, 'import : l\'aperçu n\'ajoute rien');
expect_status($admin->post('questions_import', ['s' => $gen, 'raw' => $raw, 'keep' => [0, 3]]), 400, 'import : question écartée refusée');
expect_status($admin->post('questions_import', ['s' => $gen, 'raw' => $raw, 'keep' => [5]]), 400, 'import : gommettes sans leur source refusées');
expect_status($admin->post('questions_import', ['s' => $gen, 'raw' => 'pas de JSON', 'preview' => true]), 400, 'import : réponse illisible refusée');
$copied = '\\[ { "type": "poll", "text": "Copié depuis l\'appli", "options": \\[ "A", "B" \\] } \\]';
check(($admin->post('questions_import', ['s' => $gen, 'raw' => $copied, 'preview' => true])['json']['items'][0]['text'] ?? '') === 'Copié depuis l\'appli',
    'import : « \\[ » ajoutés par l\'affichage d\'une IA retirés');
check(count($admin->get("api.php?action=admin_state&s=$gen")['json']['questions'] ?? [1]) === 0, 'import : tout ou rien');
$colRaw = fn(array $dots) => json_encode([['type' => 'postit', 'text' => 'Idées', 'options' => ['Ce qui aide', 'Ce qui freine']], $dots + ['type' => 'dots', 'source' => 1, 'budget' => 3]], JSON_UNESCAPED_UNICODE);
$warn = fn(array $dots) => $admin->post('questions_import', ['s' => $gen, 'raw' => $colRaw($dots), 'preview' => true])['json']['items'][1]['warning'] ?? '';
check(str_contains($warn(['text' => 'Parmi les idées de la colonne « Ce qui aide », lesquelles tester ?']), 'Ce qui aide'), 'import : intitulé qui cite une colonne sans « column » signalé');
check($warn(['text' => 'Parmi les idées de la colonne « Ce qui aide » ?', 'column' => 'Ce qui aide']) === '' && $warn(['text' => 'Lesquelles tester ?']) === '', 'import : pas d\'avertissement si la colonne est précisée ou non citée');
$r = $admin->post('questions_import', ['s' => $gen, 'raw' => $raw, 'keep' => [0, 1, 2, 4, 5, 7]]);
expect_status($r, 200, 'import : ajout');
$gq = $admin->get("api.php?action=admin_state&s=$gen")['json']['questions'] ?? [];
check(count($gq) === 6 && ($gq[4]['source'] ?? '') === ($gq[3]['id'] ?? '-') && ($gq[5]['scaleMax'] ?? 0) === 10, 'import : 6 questions, gommettes reliées au post-it importé');

// --- Export des questions en JSON, réimporté à l'identique -----------------------
$admin->post('question_save', ['s' => $gen, 'question' => ['type' => 'yesno', 'text' => 'Réglée', 'correct' => [1], 'reveal' => 'end', 'duration' => 30, 'allowChange' => false]]);
$exp = $admin->get("api.php?action=export&format=questions&s=$gen");
$json = json_decode($exp['body'], true);
check(str_contains($exp['headers']['content-disposition'] ?? '', '.json') && count($json ?? []) === 7, 'export questions : fichier JSON, 7 questions');
check(!str_contains($exp['body'], '"answers"') && ($json[4]['source'] ?? 0) === 4 && ($json[2]['correct'] ?? null) === ['Urgence', 'Fautes'], 'export questions : sans réponses, gommettes et bonnes réponses lisibles');
$copy = $admin->post('session_create', ['title' => 'Copie'])['json']['code'] ?? '';
expect_status($admin->post('questions_import', ['s' => $copy, 'raw' => $exp['body'], 'keep' => range(0, 6)]), 200, 'export questions : réimport');
check($admin->get("api.php?action=export&format=questions&s=$copy")['body'] === $exp['body'], 'export questions : réimport identique (réglages compris)');

// --- Même durée pour toutes les questions ------------------------------------------
$admin->post('questions_duration', ['s' => $copy, 'duration' => 45]);
$all = json_decode($admin->get("api.php?action=export&format=questions&s=$copy")['body'], true);
check(array_unique(array_column($all, 'duration')) === [45], 'durée appliquée à toutes les questions');
$admin->post('questions_duration', ['s' => $copy, 'duration' => 0]);
$all = json_decode($admin->get("api.php?action=export&format=questions&s=$copy")['body'], true);
check(!in_array('end', array_column($all, 'reveal'), true), 'sans durée, plus de correction « à la fin du temps »');

// --- Avant / après : un quiz et une échelle posés deux fois ----------------------
$cmp = $admin->post('session_create', ['title' => 'Progression'])['json']['code'] ?? '';
$sv = fn(array $q) => $admin->post('question_save', ['s' => $cmp, 'question' => $q]);
$mcq = ['type' => 'mcq', 'options' => ['Urgence', 'Logo', 'Orthographe'], 'correct' => [0]];
$beforeId = $sv($mcq + ['text' => 'Avant : un faux SMS se repère à…'])['json']['id'] ?? '';
expect_status($sv(array_merge($mcq, ['text' => 'Autres choix', 'options' => ['A', 'B'], 'compare' => $beforeId])), 400, 'avant/après : choix différents refusés');
expect_status($sv(array_merge($mcq, ['text' => 'Inconnue', 'compare' => 'aaaaaaaa'])), 400, 'avant/après : question inconnue refusée');
expect_status($sv(array_merge($mcq, ['text' => 'Sans bonne réponse', 'correct' => [], 'compare' => $beforeId])), 400, 'avant/après : quiz sans bonne réponse refusé');
$afterId = $sv(array_merge($mcq, ['text' => 'Après : un faux SMS se repère à…', 'compare' => $beforeId]))['json']['id'] ?? '';
$sc = fn(array $q) => $sv(array_merge(['type' => 'scale', 'scaleMax' => 5], $q));
$sc1 = $sc(['text' => 'Avant : à l\'aise avec le numérique ?'])['json']['id'] ?? '';
expect_status($sc(['text' => 'Échelle plus longue', 'scaleMax' => 10, 'compare' => $sc1]), 400, 'avant/après : échelles de tailles différentes refusées');
$sc2 = $sc(['text' => 'Après : à l\'aise avec le numérique ?', 'compare' => $sc1])['json']['id'] ?? '';
$cl = [new Client($base), new Client($base)];
foreach ($cl as $c) { $c->join($cmp); }
$cmpGo = fn(string $qid) => $admin->post('control', ['s' => $cmp, 'op' => 'goto', 'qid' => $qid]);
$cmpGo($beforeId);
$cl[0]->vote($cmp, $beforeId, 1);
$cl[1]->vote($cmp, $beforeId, 0);
$admin->post('control', ['s' => $cmp, 'op' => 'close']);
$cmpGo($afterId);
foreach ($cl as $c) { expect_status($c->vote($cmp, $afterId, 0), 200, 'avant/après : vote'); }
$admin->post('control', ['s' => $cmp, 'op' => 'show']);
$cq = $admin->get("api.php?action=admin_state&s=$cmp")['json']['questions'] ?? [];
$cr = $cq[1]['results']['compare'] ?? [];
check(($cr['kind'] ?? '') === 'correct' && ($cr['before'] ?? -1) === 50 && ($cr['after'] ?? -1) === 100, 'avant/après : 50 % puis 100 % de bonnes réponses');
check(!isset($cq[0]['results']['compare']), 'avant/après : la question « avant » n\'affiche aucune comparaison');
check(($cl[0]->get("api.php?action=screen&s=$cmp")['json']['results']['compare']['after'] ?? 0) === 100, 'avant/après : visible sur la projection avec les résultats');
$cmpGo($sc1);
$cl[0]->vote($cmp, $sc1, 2);
$cl[1]->vote($cmp, $sc1, 4);
$admin->post('control', ['s' => $cmp, 'op' => 'close']);
$cmpGo($sc2);
$cl[0]->vote($cmp, $sc2, 4);
$cl[1]->vote($cmp, $sc2, 5);
$cr = $admin->get("api.php?action=admin_state&s=$cmp")['json']['questions'][3]['results']['compare'] ?? [];
check(($cr['kind'] ?? '') === 'average' && ($cr['before'] ?? 0) == 3 && ($cr['after'] ?? 0) == 4.5, 'avant/après : moyennes 3 puis 4,5 sur une échelle');
// Mêmes personnes : trois ont répondu aux deux questions, un arrivé en retard seulement à la seconde.
$b2 = $sv($mcq + ['text' => 'Avant bis'])['json']['id'] ?? '';
$a2 = $sv(array_merge($mcq, ['text' => 'Après bis', 'compare' => $b2]))['json']['id'] ?? '';
$g = [new Client($base), new Client($base), new Client($base), new Client($base)];
foreach ($g as $c) { $c->join($cmp); }
$cmpGo($b2);
$g[0]->vote($cmp, $b2, 1); $g[1]->vote($cmp, $b2, 1); $g[2]->vote($cmp, $b2, 0);
$admin->post('control', ['s' => $cmp, 'op' => 'close']);
$cmpGo($a2);
$g[0]->vote($cmp, $a2, 0); $g[1]->vote($cmp, $a2, 0); $g[2]->vote($cmp, $a2, 0); $g[3]->vote($cmp, $a2, 1);
$cr = $admin->get("api.php?action=admin_state&s=$cmp")['json']['questions'][5]['results']['compare'] ?? [];
check(($cr['same'] ?? false) === true && ($cr['nCommon'] ?? 0) === 3 && ($cr['before'] ?? -1) === 33 && ($cr['after'] ?? -1) === 100,
    'avant/après : calculé sur les trois personnes qui ont répondu aux deux (33 % puis 100 %, pas 75 % avec le retardataire)');
$cr = $admin->get("api.php?action=admin_state&s=$cmp")['json']['questions'][1]['results']['compare'] ?? [];
check(($cr['same'] ?? true) === false && ($cr['nCommon'] ?? -1) === 0, 'avant/après : deux personnes seulement en commun = comparaison de tous les répondants, jamais isolées');
$dup = $admin->post('session_duplicate', ['s' => $cmp])['json']['code'] ?? '';
$dq = $admin->get("api.php?action=admin_state&s=$dup")['json']['questions'] ?? [];
check(($dq[1]['compare'] ?? '') === ($dq[0]['id'] ?? '-') && ($dq[3]['compare'] ?? '') === ($dq[2]['id'] ?? '-'), 'avant/après : la copie de session garde le lien, vers ses propres questions');
$expc = $admin->get("api.php?action=export&format=questions&s=$cmp");
check((json_decode($expc['body'], true)[1]['compare'] ?? 0) === 1, 'avant/après : exporté par position');
$cc = $admin->post('session_create', ['title' => 'Progression copie'])['json']['code'] ?? '';
expect_status($admin->post('questions_import', ['s' => $cc, 'raw' => $expc['body'], 'keep' => range(0, 5)]), 200, 'avant/après : réimport');
check($admin->get("api.php?action=export&format=questions&s=$cc")['body'] === $expc['body'], 'avant/après : réimport identique');
expect_status($admin->post('questions_import', ['s' => $cc, 'raw' => $expc['body'], 'keep' => [1]]), 400, 'avant/après : import sans la question « avant » refusé');

// --- Défi à étapes : étapes cochées, variantes par système ------------------------
$df = $admin->post('session_create', ['title' => 'Défi'])['json']['code'] ?? '';
$ds = fn(array $q) => $admin->post('question_save', ['s' => $df, 'question' => $q]);
expect_status($ds(['type' => 'steps', 'text' => 'Une étape', 'options' => ['A']]), 400, 'défi : deux étapes au moins');
$three = fn(string $os) => ["$os : ouvre", "$os : coupe", "$os : vérifie"];
expect_status($ds(['type' => 'steps', 'text' => 'Inégal', 'options' => ['A', 'B'], 'variants' => [['name' => 'Windows', 'steps' => ['a', 'b']], ['name' => 'Mac', 'steps' => ['a']]]]), 400, 'défi : variantes de longueurs différentes refusées');
expect_status($ds(['type' => 'steps', 'text' => 'Une variante', 'options' => ['A', 'B'], 'variants' => ['Windows' => ['a', 'b']]]), 400, 'défi : une seule variante refusée');
$did = $ds(['type' => 'steps', 'text' => 'Coupe les notifications', 'options' => ['Ouvrir', 'Couper', 'Vérifier'],
    'variants' => ['Windows' => $three('Windows'), 'Mac' => $three('Mac')]])['json']['id'] ?? '';
$dc = [new Client($base), new Client($base)];
foreach ($dc as $c) { $c->join($df); }
$admin->post('control', ['s' => $df, 'op' => 'goto', 'qid' => $did]);
expect_status($dc[0]->vote($df, $did, [0, 1]), 200, 'défi : deux étapes cochées');
expect_status($dc[1]->vote($df, $did, [2, 1, 0]), 200, 'défi : trois étapes cochées');
expect_status($dc[1]->vote($df, $did, [7]), 400, 'défi : étape inconnue refusée');
expect_status($dc[1]->vote($df, $did, 1), 400, 'défi : réponse qui n\'est pas une liste refusée');
$dr = fn() => $admin->get("api.php?action=admin_state&s=$df")['json']['questions'][0]['results'] ?? [];
check(($dr()['counts'] ?? []) === [2, 2, 1] && ($dr()['finished'] ?? -1) === 1 && ($dr()['total'] ?? -1) === 2, 'défi : compteurs par étape et nombre de personnes ayant fini');
check(($dc[0]->get("api.php?action=screen&s=$df")['json']['results']['counts'] ?? []) === [2, 2, 1], 'défi : progression visible sur la projection sans clic (direct)');
check(count($dc[0]->get("api.php?action=state&s=$df")['json']['question']['variants'] ?? []) === 2, 'défi : variantes envoyées au téléphone');
expect_status($dc[0]->vote($df, $did, []), 200, 'défi : tout décoché');
check(($dr()['counts'] ?? []) === [1, 1, 1] && ($dr()['total'] ?? -1) === 1, 'défi : tout décoché = plus compté comme ayant commencé');
$dx = $admin->get("api.php?action=export&format=questions&s=$df");
check(array_keys(json_decode($dx['body'], true)[0]['variants'] ?? []) === ['Windows', 'Mac'], 'défi : variantes exportées par nom');
$dcopy = $admin->post('session_create', ['title' => 'Défi copie'])['json']['code'] ?? '';
expect_status($admin->post('questions_import', ['s' => $dcopy, 'raw' => $dx['body'], 'keep' => [0]]), 200, 'défi : réimport');
check($admin->get("api.php?action=export&format=questions&s=$dcopy")['body'] === $dx['body'], 'défi : réimport identique');
check(count($admin->get("api.php?action=admin_state&s=" . ($admin->post('session_duplicate', ['s' => $df])['json']['code'] ?? ''))['json']['questions'][0]['variants'] ?? []) === 2, 'défi : la copie de session garde les variantes');

// Retirer une étape après des réponses : les réponses sont des indices, elles n'ont plus de sens.
$dq = fn(array $o) => $ds(['id' => $did, 'type' => 'steps', 'text' => 'Coupe les notifications', 'options' => $o]);
expect_status($dc[1]->vote($df, $did, [0, 1, 2]), 200, 'défi : réponse avant retrait d\'une étape');
expect_status($dq(['Ouvrir', 'Couper']), 200, 'défi : retrait d\'une étape accepté');
check(($dr()['counts'] ?? null) === [0, 0] && ($dr()['total'] ?? -1) === 0, 'défi : étape retirée = réponses effacées, compteurs à la bonne taille');

// Réordonner les choix sans changer leur nombre : les réponses (par position) changeraient de sens, on repart de zéro.
expect_status($dc[1]->vote($df, $did, [0]), 200, 'défi : réponse avant réordonnancement');
expect_status($dq(['Couper', 'Ouvrir']), 200, 'défi : réordonnancement accepté');
check(($dr()['total'] ?? -1) === 0, 'choix réordonnés = réponses effacées');
expect_status($dc[1]->vote($df, $did, [0]), 200, 'défi : réponse avant correction de texte');
expect_status($dq(['Couper', 'Ouvrir le menu']), 200, 'défi : un texte corrigé est accepté');
check(($dr()['total'] ?? -1) === 1, 'choix reformulé (pas réordonné) = réponses gardées');

// Post-it : réordonner les colonnes garde les notes.
$pi = $admin->post('session_create', ['title' => 'Post-it'])['json']['code'] ?? '';
$pq = fn(array $o, array $extra = []) => $admin->post('question_save', ['s' => $pi, 'question' => $extra + ['type' => 'postit', 'text' => 'Idées', 'options' => $o]]);
$pid = $pq(['Pour', 'Contre'])['json']['id'] ?? '';
$admin->post('control', ['s' => $pi, 'op' => 'goto', 'qid' => $pid]);
$pc = new Client($base);
$pc->join($pi);
expect_status($pc->post('post', ['s' => $pi, 'qid' => $pid, 'text' => 'Une note', 'col' => 0]), 200, 'post-it : note déposée');
$pn = fn() => $admin->get("api.php?action=admin_state&s=$pi")['json']['questions'][0]['results']['posts'] ?? [];
check(($pn()[0]['col'] ?? -1) === 0, 'post-it : note déposée dans la colonne Pour');
$pq(['Contre', 'Pour'], ['id' => $pid]);
check(count($pn()) === 1 && ($pn()[0]['col'] ?? -1) === 1, 'post-it : colonnes réordonnées, la note suit sa colonne (Pour est passée en 2e)');

// Aide par étape : le signal « besoin d'aide » vise une étape, jamais plus d'un signal par personne.
$sg = fn(Client $c, array $step) => $c->post('signal', ['s' => $df, 'kind' => 'help', 'step' => $step]);
expect_status($sg($dc[1], ['q' => $did, 'i' => 9]), 400, 'aide par étape : étape inconnue refusée');
expect_status($sg($dc[1], ['q' => 'zzzzzzzz', 'i' => 0]), 400, 'aide par étape : question inconnue refusée');
expect_status($dc[1]->post('signal', ['s' => $df, 'kind' => 'fast', 'step' => ['q' => $did, 'i' => 0]]), 400, 'aide par étape : seul « besoin d\'aide » vise une étape');
expect_status($sg($dc[0], ['q' => $did, 'i' => 1]), 200, 'aide par étape : bloqué à l\'étape 2');
expect_status($sg($dc[1], ['q' => $did, 'i' => 1]), 200, 'aide par étape : un deuxième bloqué à l\'étape 2');
$hs = fn() => $admin->get("api.php?action=admin_state&s=$df")['json'];
check(($hs()['helpSteps'] ?? []) === [['q' => $did, 'i' => 1, 'n' => 2]] && ($hs()['signals']['help'] ?? 0) === 2, 'aide par étape : deux personnes à l\'étape 2, comptées aussi dans « Besoin d\'aide »');
$sg($dc[1], ['q' => $did, 'i' => 1]);
check(($hs()['helpSteps'][0]['n'] ?? 0) === 1, 'aide par étape : le même appui retire le signal');
$dc[1]->post('signal', ['s' => $df, 'kind' => 'help']);
check(($hs()['signals']['help'] ?? 0) === 2 && ($hs()['helpSteps'][0]['n'] ?? 0) === 1, 'aide par étape : un signal général compte sans étape');
check(!str_contains(json_encode($hs()['helpSteps'] ?? []), 'token'), 'aide par étape : aucune identité dans le résultat');

// Fiche mémo : ce que l'animateur a écrit, jamais un chiffre ni une réponse ; réservée à l'animateur.
$ds(['type' => 'steps', 'text' => 'Exercice mémo', 'options' => ['Ouvrir', 'Couper', 'Vérifier'], 'link' => 'https://exemple.org/exo',
    'variants' => ['Windows' => $three('Windows'), 'Mac' => $three('Mac')]]);
$memo = $admin->get("api.php?action=export&format=memo&s=$df")['body'];
check(str_contains($memo, 'À refaire chez soi') && str_contains($memo, 'Exercice mémo') && str_contains($memo, 'https://exemple.org/exo') && str_contains($memo, 'Windows : ouvre'),
    'fiche mémo : le défi, ses étapes et ses variantes');
check(!str_contains($memo, 'participant') && !str_contains($memo, 'réponse(s)'), 'fiche mémo : aucun chiffre ni réponse de participant');
check(str_contains($admin->get("api.php?action=export&format=memo&s=$cmp")['body'], 'Bonne réponse : Urgence'), 'fiche mémo : les bonnes réponses des quiz');
expect_status((new Client($base))->get("api.php?action=export&format=memo&s=$df"), 401, 'fiche mémo : réservée à l\'animateur');

// Thèmes de la bibliothèque ajoutés par l'animateur.
$raw = json_encode([['type' => 'poll', 'text' => 'Votre météo ?', 'options' => ['Soleil', 'Pluie']], ['type' => 'conclusion', 'text' => 'À retenir : un point.']]);
$tp = fn(array $x) => $admin->post('seance_save', $x);
expect_status($tp(['title' => '', 'raw' => $raw]), 400, 'thème : titre obligatoire');
expect_status($tp(['title' => 'Cassé', 'raw' => json_encode([['type' => 'mcq', 'text' => 'Sans choix']])]), 400, 'thème : une question invalide refuse le thème');
expect_status($tp(['title' => 'Vide', 'raw' => 'rien du tout']), 400, 'thème : texte illisible refusé');
expect_status((new Client($base))->post('seance_save', ['title' => 'X', 'raw' => $raw]), 401, 'thème : réservé à l\'animateur');
$t1 = $tp(['title' => 'Relu par une IA', 'public' => 'Seniors', 'duree' => '30 min', 'raw' => 'Voici ma version corrigée : ' . $raw . ' Fin.']);
expect_status($t1, 200, 'thème : texte collé avec du texte autour accepté');
$tid = $t1['json']['id'] ?? '';
$tl = $admin->get('api.php?action=seances')['json']['themes'] ?? [];
check(count($tl) === 1 && $tl[0]['title'] === 'Relu par une IA' && count($tl[0]['items']) === 2, 'thème : listé avec ses questions');
expect_status($tp(['title' => 'Copié depuis une appli mobile', 'raw' => str_replace(['[', ']'], ['\\[', '\\]'], $raw)]), 200, 'thème : texte copié depuis l\'application mobile d\'une IA (\\[ \\]) accepté');
$ts = $tp(['title' => 'Depuis une session', 's' => $cmp]);
expect_status($ts, 200, 'thème : enregistré depuis une session');
check(count($admin->get('api.php?action=seances')['json']['themes'] ?? []) === 3, 'thème : trois thèmes');
$admin->post('seance_delete', ['id' => $tid]);
$tl = $admin->get('api.php?action=seances')['json']['themes'] ?? [];
check(count($tl) === 2 && $tl[1]['title'] === 'Depuis une session', 'thème : supprimé');
for ($i = 0; $i < 30; $i++) {
    $last = $tp(['title' => "Thème $i", 'raw' => $raw]);
}
expect_status($last, 400, 'thème : 30 au plus');
foreach ($admin->get('api.php?action=seances')['json']['themes'] ?? [] as $t) {
    $admin->post('seance_delete', ['id' => $t['id']]);
}
check(($admin->get('api.php?action=seances')['json']['themes'] ?? [1]) === [], 'thème : bibliothèque vidée');

// --- Lien d'un exercice : https seulement, validé côté serveur -------------------------
$lk = $admin->post('session_create', ['title' => 'Liens'])['json']['code'] ?? '';
$ls = fn(string $link) => $admin->post('question_save', ['s' => $lk, 'question' => ['type' => 'poll', 'text' => 'Exercice', 'options' => ['Réussi', 'Bloqué'], 'link' => $link]]);
foreach (['http://exemple.org/exo', 'javascript:alert(1)', 'https://user:mdp@exemple.org/', 'https://exemple.org/un espace', 'https://192.168.0.1/exo', 'https://127.1/exo', 'https://10.1/exo',
    'https://localhost/exo', 'exemple.org', 'https://exemple.org/' . str_repeat('a', 300)] as $bad) {
    expect_status($ls($bad), 400, 'lien refusé : ' . substr($bad, 0, 40));
}
$url = 'https://exemple.org/exercice?a=1&b=2';
$lok = $ls($url);
expect_status($lok, 200, 'lien https accepté');
$lc = new Client($base);
$lc->join($lk);
$admin->post('control', ['s' => $lk, 'op' => 'goto', 'qid' => $lok['json']['id'] ?? '']);
check(($lc->get("api.php?action=state&s=$lk")['json']['question']['link'] ?? '') === $url, 'lien : envoyé au participant');
check(($lc->get("api.php?action=screen&s=$lk")['json']['question']['link'] ?? '') === $url, 'lien : envoyé à la projection');
$lx = $admin->get("api.php?action=export&format=questions&s=$lk");
check((json_decode($lx['body'], true)[0]['link'] ?? '') === $url, 'lien : exporté');
$lw = $admin->post('questions_import', ['s' => $lk, 'raw' => $lx['body'], 'preview' => true])['json']['items'][0] ?? [];
check(str_contains($lw['warning'] ?? '', 'exemple.org') && ($lw['link'] ?? '') === $url, 'lien : signalé « à vérifier » à l\'import');
$lcopy = $admin->post('session_create', ['title' => 'Liens copie'])['json']['code'] ?? '';
expect_status($admin->post('questions_import', ['s' => $lcopy, 'raw' => $lx['body'], 'keep' => [0]]), 200, 'lien : réimport');
check($admin->get("api.php?action=export&format=questions&s=$lcopy")['body'] === $lx['body'], 'lien : réimport identique');
check(($admin->get("api.php?action=admin_state&s=" . ($admin->post('session_duplicate', ['s' => $lk])['json']['code'] ?? ''))['json']['questions'][0]['link'] ?? '') === $url, 'lien : gardé par la copie de session');

// --- Fonctions en essai : un réglage commun à tous les appareils de l'animateur ---------
check(($admin->get('api.php?action=me')['json']['prefs']['beta'] ?? null) === false, 'essai : éteint par défaut');
expect_status($admin->post('prefs_save', ['beta' => true], false), 403, 'essai : réglage sans CSRF refusé');
check(in_array($dc[0]->post('prefs_save', ['beta' => true])['status'], [401, 403], true), 'essai : réglage refusé à un participant');
expect_status($admin->post('prefs_save', ['beta' => true]), 200, 'essai : allumé');
$other = new Client($base);
$ol = $other->post('login', ['password' => getenv('WL_PASSWORD')]);
check(($ol['json']['prefs']['beta'] ?? null) === true && ($other->get('api.php?action=me')['json']['prefs']['beta'] ?? null) === true, 'essai : vu par un autre appareil (réglage serveur)');
$admin->post('prefs_save', ['beta' => false]);

// --- Signaler une difficulté, Oser demander, pseudonymes et classement -----------
$ws = $admin->post('session_create', ['title' => 'Atelier élèves'])['json']['code'] ?? '';
$el = [new Client($base), new Client($base), new Client($base)];
foreach ($el as $c) { $c->join($ws); }
$st = fn(Client $c) => $c->get("api.php?action=state&s=$ws")['json'];
$adm = fn() => $admin->get("api.php?action=admin_state&s=$ws")['json'];
$scr = fn() => $admin->get("api.php?action=screen&s=$ws")['json'];
// Signaux : comptés pour l'animateur, sans réveiller les téléphones.
$phonePath = "api.php?action=state&s=$ws";
$el[1]->poll($phonePath);
expect_status($el[0]->post('signal', ['s' => $ws, 'kind' => 'fast']), 200, 'signal « trop vite »');
$el[2]->post('signal', ['s' => $ws, 'kind' => 'help']);
check(($adm()['signals'] ?? []) === ['fast' => 1, 'again' => 0, 'help' => 1], 'signaux comptés par sorte');
check($el[1]->poll($phonePath)['status'] === 304, 'un signal ne réveille pas les téléphones');
check(!str_contains(json_encode($scr()), 'signal'), 'signaux jamais servis à la projection');
$el[0]->post('signal', ['s' => $ws, 'kind' => 'fast']);
check(($adm()['signals']['fast'] ?? 1) === 0, 'même signal renvoyé : retiré');
expect_status($el[0]->post('signal', ['s' => $ws, 'kind' => 'pirate']), 400, 'signal inconnu refusé');
// Oser demander : anonyme, publié par l'animateur avant d'être vu des autres.
expect_status($el[0]->post('ask', ['s' => $ws, 'text' => 'Question ?']), 409, 'oser demander fermé : refusé');
$admin->post('control', ['s' => $ws, 'op' => 'asks_open']);
$aid = $el[0]->post('ask', ['s' => $ws, 'text' => 'Est-ce que TikTok écoute ?'])['json']['id'] ?? '';
check(($st($el[0])['asks'][0]['pending'] ?? false) === true, 'oser demander : son auteur voit sa question en attente');
check($st($el[1])['asks'] === [], 'oser demander : invisible des autres avant publication');
expect_status($el[1]->post('ask_vote', ['s' => $ws, 'aid' => $aid]), 409, 'vote sur une question non publiée refusé');
$admin->post('ask_admin', ['s' => $ws, 'aid' => $aid, 'op' => 'publish']);
check(($scr()['asksOpen'] ?? false) === true && ($scr()['asksCount'] ?? 0) === 1, 'projection : bouton « Questions » avec le nombre de questions publiées');
check(($el[1]->post('ask_vote', ['s' => $ws, 'aid' => $aid])['json']['voted'] ?? false) === true, 'vote « moi aussi »');
expect_status($el[0]->post('ask_vote', ['s' => $ws, 'aid' => $aid]), 409, 'vote pour sa propre question refusé');
check(($adm()['asks'][0]['votes'] ?? 0) === 1 && !isset($st($el[1])['asks'][0]['p']), 'oser demander : votes comptés, auteur jamais servi');
$admin->post('control', ['s' => $ws, 'op' => 'show_asks']);
check(($scr()['asks'][0]['text'] ?? '') === 'Est-ce que TikTok écoute ?' && !isset($scr()['asks'][0]['mine']), 'oser demander projeté à la demande');
// Pseudonymes et classement des quiz (option de session).
$quiz = $admin->post('question_save', ['s' => $ws, 'question' => ['type' => 'truefalse', 'text' => 'Quiz élèves', 'correct' => [0]]])['json']['id'] ?? '';
check($st($el[0])['pseudo'] === null, 'pas de pseudonyme sans l\'option');
$admin->post('control', ['s' => $ws, 'op' => 'pseudo_on']);
$names = array_map(fn($c) => $st($c)['pseudo'] ?? '', $el);
check(count(array_unique($names)) === 3 && preg_match('/^\S+ \S+$/u', $names[0]) === 1, 'pseudonymes donnés à chaque inscrit, tous différents');
$admin->post('control', ['s' => $ws, 'op' => 'goto', 'qid' => $quiz]);
check(!isset($scr()['asks']), 'piloter une question quitte la projection d\'« Oser demander »');
$el[0]->vote($ws, $quiz, 0);
$el[1]->vote($ws, $quiz, 1);
check(($st($el[0])['score']['n'] ?? -1) === 0, 'score : rien avant la correction');
$admin->post('control', ['s' => $ws, 'op' => 'close']);
$admin->post('control', ['s' => $ws, 'op' => 'show']);
check(($st($el[0])['score'] ?? null) === ['n' => 1, 'of' => 1], 'score du participant après la correction');
$admin->post('control', ['s' => $ws, 'op' => 'show_podium']);
$pod = $scr()['podium'] ?? [];
check(count($pod) === 1 && $pod[0]['name'] === $names[0] && $pod[0]['rank'] === 1, 'podium : seuls les rangs 1 à 3 qui ont marqué');
check(count($adm()['ranking'] ?? []) === 3, 'classement complet pour l\'animateur seul');
$ice = $admin->post('question_save', ['s' => $ws, 'first' => true, 'question' => ['type' => 'poll', 'text' => 'Votre météo du jour ?', 'options' => ['☀️ Soleil', '🌧️ Pluie']]])['json']['id'] ?? '';
$wsq = $adm()['questions'] ?? [];
check(($wsq[0]['id'] ?? '') === $ice && ($wsq[$adm()['current']]['id'] ?? '') === $quiz, 'brise-glace ajouté en tête, la question projetée ne change pas');
$admin->post('session_archive', ['s' => $ws]);
$rawWs = implode('', array_map('file_get_contents', glob("$data/archives/*.json")));
check(!str_contains($rawWs, $names[0]) && !str_contains($rawWs, 'TikTok'), 'archive : ni pseudonyme, ni question d\'un participant');

// --- Démo, téléphones actifs, preuve de passage de la purge horaire --------------
$demo = $admin->post('session_demo', [])['json']['code'] ?? '';
$dm = $admin->get("api.php?action=admin_state&s=$demo")['json'];
check(str_starts_with($dm['title'] ?? '', 'Démo — '), 'démo : titre du thème tiré au hasard');
check(count($dm['questions'] ?? []) === 10 && ($dm['participants'] ?? 0) === 12 && ($dm['active'] ?? 0) === 10,
    'démo : 10 questions, 12 participants fictifs dont 10 actifs');
check(count($dm['asks'] ?? []) === 3 && count($dm['ranking'] ?? []) === 12 && ($dm['questions'][9]['results']['total'] ?? 0) === 12,
    'démo : Oser demander, classement et gommettes remplis');
$admin->post('control', ['s' => $demo, 'op' => 'goto', 'qid' => $dm['questions'][7]['id']]); // mur : aucune réponse « vote »
check(($admin->get("api.php?action=screen&s=$demo")['json']['active'] ?? 0) === 10, 'projection : dénominateur = téléphones actifs');
// Questions ajoutées à une démo : la salle fictive y répond aussi ; les fictifs restent « actifs » dans le temps.
$dsave = fn(array $q) => $admin->post('question_save', ['s' => $demo, 'question' => $q])['json']['id'] ?? '';
$dsave(['type' => 'poll', 'text' => 'Ajout : sondage', 'options' => ['A', 'B', 'C']]);
$dsave(['type' => 'mcq', 'text' => 'Ajout : quiz', 'options' => ['Bon', 'Mauvais'], 'correct' => [0]]);
$dsave(['type' => 'steps', 'text' => 'Ajout : défi', 'options' => ['Un', 'Deux', 'Trois']]);
$dsave(['type' => 'scale', 'text' => 'Ajout : échelle', 'scaleMax' => 5]);
$dq = $admin->get("api.php?action=admin_state&s=$demo")['json']['questions'];
check(($dq[10]['results']['total'] ?? 0) === 12 && ($dq[11]['results']['total'] ?? 0) === 12 && ($dq[13]['results']['total'] ?? 0) === 12,
    'démo : les douze participants fictifs répondent au sondage, au quiz et à l\'échelle ajoutés');
check(($dq[12]['results']['total'] ?? 0) >= 1 && count($dq[12]['results']['counts'] ?? []) === 3, 'démo : le défi ajouté a des étapes cochées');
$dfile = "$data/sessions/$demo.json";
$dj = json_decode(file_get_contents($dfile), true);
$dj['participants'] = array_map(fn($t) => time() - 3600, $dj['participants']);
$dj['seen'] = [];
file_put_contents($dfile, json_encode($dj));
check(($admin->get("api.php?action=admin_state&s=$demo")['json']['active'] ?? 0) === 10, 'démo : les participants fictifs restent actifs avec le temps (10 sur 12)');
$pinger = new Client($base);
expect_status($pinger->post('ping', ['s' => $demo]), 403, 'signe de vie sans jeton refusé');
$pinger->join($demo);
$pingPath = "api.php?action=state&s=$demo";
$pinger->poll($pingPath);
expect_status($pinger->post('ping', ['s' => $demo]), 200, 'signe de vie');
check($pinger->poll($pingPath)['status'] === 304, 'un signe de vie ne réveille aucun téléphone');
check(($admin->get("api.php?action=admin_state&s=$demo")['json']['active'] ?? 0) === 11, 'le nouveau téléphone compte parmi les actifs');
expect_status($pinger->post('ping', ['s' => 'ZZZZZ']), 404, 'signe de vie sur un code inexistant : 404');
check(!file_exists("$data/sessions/ZZZZZ.json.lock"), 'un code inventé ne laisse aucun fichier de verrou');
shell_exec('php ' . escapeshellarg(dirname(__DIR__) . '/purge.php'));
$cron = $admin->get("api.php?action=admin_state&s=$demo")['json']['lastCron'] ?? 0;
check($cron >= time() - 30, 'purge horaire : passage noté pour l\'onglet Réglages');
$keep = $admin->post('session_create', ['title' => 'Vraie session'])['json']['code'] ?? '';
check(($admin->post('demo_delete', [])['json']['deleted'] ?? 0) === 1, 'supprimer toutes les démos');
check($admin->get("api.php?action=admin_state&s=$demo")['status'] === 404 && $admin->get("api.php?action=admin_state&s=$keep")['status'] === 200,
    'démos supprimées, vraies sessions gardées');
$admin->post('session_delete', ['s' => $keep]);

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
expect_status($admin->post('login', ['password' => getenv('WL_PASSWORD')]), 200, 'appareil déjà connu : pas bloqué par les échecs d\'un autre sur la même IP');

// --- Essais de codes en série (en dernier : bloque l'IP locale) -------------------
// 61 essais : la fenêtre est la minute civile ; si elle change en cours de boucle,
// l'une des deux reçoit au moins 31 essais (limite : 30). Avec 32, échec rare (15/10/2026).
$codes = [];
for ($i = 0; $i < 61; $i++) {
    $codes[] = $intrus->get('api.php?action=state&s=' . substr(str_shuffle('ABCDEFGHJKMNPQRSTUVWXYZ'), 0, 5))['status'];
}
check(in_array(429, $codes, true), 'plus de 30 codes inconnus par minute : 429');

finish('e2e');
