#!/usr/bin/env bash
# Le serveur de développement PHP ignore .htaccess : vérifier ici la préservation.
set -euo pipefail
cd "$(dirname "$0")/.."
zone=$(mktemp -d)
trap 'rm -rf -- "$zone"' EXIT
mkdir "$zone/www"
printf 'Options -Indexes\n<Files config.php>\n Require all denied\n</Files>\n' > "$zone/www/.htaccess"
cp "$zone/www/.htaccess" "$zone/attendu"
executer() { WL_SWITCH_HOME="$zone" CHEMIN=www/ ACTION="$1" bash scripts/coupure-urgence.sh; }
executer couper
[[ "$(cat "$zone/www/.htaccess")" = 'Require all denied' ]]
cmp "$zone/attendu" "$zone/.wooclight-coupure/original"
executer couper
executer rouvrir
cmp "$zone/attendu" "$zone/www/.htaccess"
executer rouvrir
executer couper
printf 'contenu concurrent\n' > "$zone/www/.htaccess"
if executer rouvrir; then echo 'ÉCHEC : contenu concurrent écrasé'; exit 1; fi
[[ "$(cat "$zone/www/.htaccess")" = 'contenu concurrent' ]]
cmp "$zone/attendu" "$zone/.wooclight-coupure/original"
rm "$zone/www/.htaccess"
ln -s "$zone/attendu" "$zone/www/.htaccess"
if executer couper; then echo 'ÉCHEC : lien symbolique accepté'; exit 1; fi
cmp "$zone/attendu" "$zone/.wooclight-coupure/original"
echo 'Coupure : répétition, restauration exacte, concurrence et liens vérifiés'
