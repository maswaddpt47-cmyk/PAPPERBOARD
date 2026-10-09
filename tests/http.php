<?php
// Petit client HTTP pour les tests (extension curl de PHP, côté tests
// seulement : l'application n'en dépend pas).

declare(strict_types=1);

/** Un client = un navigateur : son propre fichier de cookies. */
final class Client
{
    public string $jar;
    public string $csrf = '';
    public string $token = '';
    public array $etags = [];

    public function __construct(public string $base)
    {
        $this->jar = tempnam(sys_get_temp_dir(), 'wljar');
    }

    public function handle(string $method, string $path, ?array $body = null, array $headers = []): CurlHandle
    {
        $h = curl_init($this->base . $path);
        $hdr = $headers;
        if ($body !== null) {
            $hdr[] = 'Content-Type: application/json';
            curl_setopt($h, CURLOPT_POSTFIELDS, json_encode($body));
        }
        curl_setopt_array($h, [
            CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_HEADER => true,
            CURLOPT_COOKIEJAR => $this->jar, CURLOPT_COOKIEFILE => $this->jar, CURLOPT_HTTPHEADER => $hdr,
            CURLOPT_TIMEOUT => 30,
        ]);
        return $h;
    }

    public function request(string $method, string $path, ?array $body = null, array $headers = []): array
    {
        $h = $this->handle($method, $path, $body, $headers);
        $raw = (string)curl_exec($h);
        return self::parse($h, $raw);
    }

    public static function parse(CurlHandle $h, string $raw): array
    {
        $size = curl_getinfo($h, CURLINFO_HEADER_SIZE);
        $head = substr($raw, 0, $size);
        $body = substr($raw, $size);
        preg_match_all('/^([A-Za-z-]+):\s*(.*)$/m', $head, $m, PREG_SET_ORDER);
        $hdrs = [];
        foreach ($m as $x) {
            $hdrs[strtolower($x[1])] = trim($x[2]);
        }
        return ['status' => curl_getinfo($h, CURLINFO_RESPONSE_CODE), 'headers' => $hdrs,
            'body' => $body, 'json' => json_decode($body, true)];
    }

    public function get(string $path, array $headers = []): array
    {
        return $this->request('GET', $path, null, $headers);
    }

    public function post(string $action, array $body, bool $withCsrf = true): array
    {
        $h = ['X-WL: 1'];
        if ($withCsrf && $this->csrf !== '') {
            $h[] = 'X-CSRF-Token: ' . $this->csrf;
        }
        return $this->request('POST', 'api.php?action=' . $action, $body, $h);
    }

    /** GET conditionnel : renvoie la réponse, mémorise l'ETag par chemin. */
    public function poll(string $path): array
    {
        $h = isset($this->etags[$path]) ? ['If-None-Match: ' . $this->etags[$path]] : [];
        $r = $this->get($path, $h);
        if (isset($r['headers']['etag'])) {
            $this->etags[$path] = $r['headers']['etag'];
        }
        return $r;
    }

    public function join(string $code): array
    {
        $r = $this->post('join', ['s' => $code], false);
        if ($r['status'] === 200) {
            $this->csrf = $r['json']['csrf'];
            $this->token = $r['json']['token'];
        }
        return $r;
    }

    public function vote(string $code, string $qid, mixed $value): array
    {
        return $this->post('vote', ['s' => $code, 'qid' => $qid, 'value' => $value]);
    }
}

$GLOBALS['wl_ok'] = 0;
$GLOBALS['wl_ko'] = 0;

function check(bool $cond, string $label): void
{
    if ($cond) {
        $GLOBALS['wl_ok']++;
    } else {
        $GLOBALS['wl_ko']++;
        fwrite(STDERR, "ÉCHEC : $label\n");
    }
}

function expect_status(array $r, int $status, string $label): void
{
    check($r['status'] === $status, "$label (attendu $status, reçu {$r['status']} : " . substr($r['body'], 0, 160) . ')');
}

function finish(string $name): never
{
    echo "$name : {$GLOBALS['wl_ok']} vérifications OK, {$GLOBALS['wl_ko']} échec(s)\n";
    exit($GLOBALS['wl_ko'] ? 1 : 0);
}
