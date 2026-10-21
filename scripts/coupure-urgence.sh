#!/usr/bin/env bash
# Exécuté par SSH, jamais exposé sur le web. L'original reste hors de www.
set -euo pipefail
case "${ACTION:-}" in couper|rouvrir) ;; *) echo 'Action refusée'; exit 1;; esac
: "${CHEMIN:?Chemin manquant}"
[[ "$CHEMIN" =~ ^www/([A-Za-z0-9_-]+/)*$ ]] || { echo 'Chemin refusé'; exit 1; }
base="${WL_SWITCH_HOME:-$HOME}"
racine="$base/${CHEMIN%/}"
etat="$base/.wooclight-coupure"
f="$racine/.htaccess"
[[ -d "$racine" && "$(realpath "$racine")" = "$racine" && ! -L "$f" && ! -L "$etat" ]] || { echo 'Dossier ou lien symbolique refusé'; exit 1; }
exec 9>"$base/.wooclight-coupure.lock"
flock -w 15 9 || exit 1
tmp=''
trap '[[ -z "$tmp" ]] || rm -f -- "$tmp"' EXIT
refuser() { echo "REFUS : $*"; exit 1; }
coupe() { [[ -f "$f" && "$(cat "$f")" = 'Require all denied' ]]; }
if [[ -e "$etat" ]]; then
  [[ -d "$etat" && -f "$etat/original" && ! -L "$etat/original" && -f "$etat/cible" && ! -L "$etat/cible" ]] || refuser 'sauvegarde incomplète : intervention SSH nécessaire'
  [[ "$(cat "$etat/cible")" = "$racine" ]] || refuser 'la cible ne correspond pas à la sauvegarde'
fi
if [[ "$ACTION" = couper ]]; then
  if [[ -d "$etat" ]]; then
    if coupe; then echo 'Déjà coupé'; exit 0; fi
    cmp -s "$f" "$etat/original" || refuser '.htaccess modifié depuis la sauvegarde'
  else
    [[ -f "$f" ]] || refuser '.htaccess original absent'
    coupe && refuser 'coupure préexistante sans sauvegarde : ne pas inventer une restauration'
    mkdir -m 700 "$etat"
    cp -p -- "$f" "$etat/original"
    printf '%s\n' "$racine" > "$etat/cible"
  fi
  tmp=$(mktemp "$racine/.coupure.XXXXXXXX")
  printf 'Require all denied\n' > "$tmp"
  chmod 644 "$tmp"
  [[ ! -L "$f" ]] && cmp -s "$f" "$etat/original" || refuser '.htaccess changé pendant la pose'
  mv -T -- "$tmp" "$f"; tmp=''
  echo 'Coupure posée ; protections originales conservées hors du site'
else
  if [[ ! -d "$etat" ]]; then
    [[ -f "$f" ]] && ! coupe || refuser 'état inconnu sans sauvegarde'
    echo 'Déjà ouvert ; aucune modification'; exit 0
  fi
  coupe || cmp -s "$f" "$etat/original" || refuser '.htaccess inattendu : restauration manuelle nécessaire'
  tmp=$(mktemp "$racine/.coupure.XXXXXXXX")
  cp -p -- "$etat/original" "$tmp"
  [[ ! -L "$f" ]] || refuser 'lien symbolique apparu'
  coupe || cmp -s "$f" "$etat/original" || refuser '.htaccess changé pendant le retrait'
  mv -T -- "$tmp" "$f"; tmp=''
  rm -- "$etat/original" "$etat/cible"
  rmdir "$etat"
  echo 'Coupure retirée ; .htaccess original restauré'
fi
