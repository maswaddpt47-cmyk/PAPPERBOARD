<?php
// Test de charge léger : 150 participants rejoignent puis votent en même
// temps. Attendu : aucun vote perdu, aucun JSON corrompu, 151e refusé.

declare(strict_types=1);

require __DIR__ . '/http.php';

$base = getenv('WL_BASE');
$data = getenv('WL_DATA');
$n = 150;

$admin = new Client($base);
$admin->csrf = $admin->post('login', ['password' => getenv('WL_PASSWORD')])['json']['csrf'] ?? '';
$code = $admin->post('session_create', ['title' => 'Charge'])['json']['code'];
$qid = $admin->post('question_save', ['s' => $code, 'question' => [
    'type' => 'poll', 'text' => 'Charge', 'options' => ['A', 'B', 'C'],
]])['json']['id'];
$admin->post('control', ['s' => $code, 'op' => 'open']);

/** Lance toutes les requêtes en parallèle (curl_multi) et renvoie les réponses. */
function parallel(array $clients, callable $make): array
{
    $mh = curl_multi_init();
    $handles = [];
    foreach ($clients as $i => $c) {
        $handles[$i] = $make($c, $i);
        curl_multi_add_handle($mh, $handles[$i]);
    }
    do {
        curl_multi_exec($mh, $running);
        curl_multi_select($mh, 1.0);
    } while ($running > 0);
    $out = [];
    foreach ($handles as $i => $h) {
        $out[$i] = Client::parse($h, (string)curl_multi_getcontent($h));
        curl_multi_remove_handle($mh, $h);
    }
    return $out;
}

$clients = array_map(fn() => new Client($base), range(1, $n));
$t = microtime(true);
$joins = parallel($clients, fn(Client $c) => $c->handle('POST', 'api.php?action=join', ['s' => $code], ['X-WL: 1']));
foreach ($joins as $i => $r) {
    $clients[$i]->csrf = $r['json']['csrf'] ?? '';
}
check(count(array_filter($joins, fn($r) => $r['status'] === 200)) === $n, "$n participants ont rejoint");
expect_status((new Client($base))->join($code), 409, '151e participant refusé');

$votes = parallel($clients, fn(Client $c, int $i) => $c->handle('POST', 'api.php?action=vote',
    ['s' => $code, 'qid' => $qid, 'value' => $i % 3], ['X-CSRF-Token: ' . $c->csrf]));
$ok = count(array_filter($votes, fn($r) => $r['status'] === 200));
$ms = (int)((microtime(true) - $t) * 1000);
check($ok === $n, "$ok/$n votes acceptés");

$res = $admin->get("api.php?action=admin_state&s=$code")['json']['questions'][0]['results'];
check($res['total'] === $n && $res['counts'] === [50, 50, 50], 'aucun vote perdu : ' . json_encode($res['counts']));
check(is_array(json_decode(file_get_contents("$data/sessions/$code.json"), true)), 'JSON intact après la charge');
check(glob("$data/sessions/*.tmp") === [], 'aucun fichier temporaire restant');
echo "charge : $n arrivées + $n votes simultanés en $ms ms\n";

finish('charge');
