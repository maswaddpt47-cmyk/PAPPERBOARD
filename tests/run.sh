#!/bin/bash
# Suite complète : syntaxe PHP et JS, bout en bout, charge.
# Usage : bash tests/run.sh   (depuis n'importe où ; port libre 8765)
set -u
cd "$(dirname "$0")/.."

echo "=== Syntaxe ==="
fail=0
for f in *.php tests/*.php; do php -l "$f" >/dev/null || { echo "❌ $f"; fail=1; }; done
for f in assets/*.js; do node --check "$f" || { echo "❌ $f"; fail=1; }; done
[ "$fail" -eq 0 ] && echo "✅ PHP et JS valides" || exit 1

# Configuration de test jetable : données hors du dépôt, mot de passe fictif.
# rate_token relevé à 50 : un participant de test vote ~35 fois en une minute.
TMP=$(mktemp -d)
export WL_DATA="$TMP/data" WL_PASSWORD="mot-de-passe-de-test" WL_BASE="http://127.0.0.1:8765/"
php -r '
$c = ["admin_hash" => password_hash(getenv("WL_PASSWORD"), PASSWORD_DEFAULT),
      "secret" => bin2hex(random_bytes(32)), "data_dir" => getenv("WL_DATA"),
      "banned_words" => ["zut"], "rate_token" => 50];
file_put_contents($argv[1], "<?php return " . var_export($c, true) . ";");' "$TMP/config.php"
export WOOCLIGHT_CONFIG="$TMP/config.php"

# Plusieurs processus PHP, pour que les votes simultanés le soient vraiment.
PHP_CLI_SERVER_WORKERS=8 php -S 127.0.0.1:8765 -t . >"$TMP/server.log" 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null; rm -rf "$TMP"' EXIT
for _ in $(seq 50); do curl -s -o /dev/null "$WL_BASE" && break; sleep 0.1; done

echo "=== Bout en bout ==="
php tests/e2e.php || fail=1
echo "=== Charge ==="
# Nouveau dossier de données : le test e2e a bloqué l'IP locale (5 échecs).
rm -rf "$WL_DATA"
php tests/charge.php || fail=1
echo "=== Données dans la racine web ==="
php tests/protect.php || fail=1

echo "=== Navigateur ==="
export NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}"
if node -e "require('playwright')" 2>/dev/null; then
  node tests/navigateur.js || fail=1
else
  echo "⏭  Playwright absent : parcours navigateur non lancé"
fi

[ "$fail" -eq 0 ] && echo "=== ✅ Tout passe ===" || { echo "=== ❌ Échecs ==="; tail -20 "$TMP/server.log"; }
exit $fail
