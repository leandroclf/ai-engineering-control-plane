#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
command -v openssl >/dev/null || { echo 'openssl not found' >&2; exit 1; }

directory="secrets/remote"
authority="$directory/authority"
server="$directory/server"
client="$directory/host-b"
rotate=false
if test "${1:-}" = "--rotate"; then rotate=true; elif test "$#" -ne 0; then
  echo 'usage: configure-remote.sh [--rotate]' >&2
  exit 2
fi
mkdir -p "$authority" "$server" "$client"
chmod 700 "$directory" "$authority" "$server" "$client"

if test "$rotate" = true || ! test -s "$authority/ca.key" || ! openssl x509 -checkend 2592000 -noout -in "$authority/ca.crt" >/dev/null 2>&1; then
  rotate=true
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out "$authority/ca.key" 2>/dev/null
  openssl req -x509 -new -sha256 -days 365 -key "$authority/ca.key" \
    -subj '/CN=AICP Remote CA' -out "$authority/ca.crt"
fi

issue() {
  local target="$1" name="$2" subject="$3" extensions="$4"
  if test "$rotate" = false && test -s "$target/$name.key" \
      && openssl x509 -checkend 604800 -noout -in "$target/$name.crt" >/dev/null 2>&1; then return; fi
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out "$target/$name.key" 2>/dev/null
  openssl req -new -key "$target/$name.key" -subj "$subject" -out "$target/$name.csr"
  openssl x509 -req -sha256 -days 90 -in "$target/$name.csr" \
    -CA "$authority/ca.crt" -CAkey "$authority/ca.key" -CAcreateserial \
    -extfile <(printf '%s\n' "$extensions") -out "$target/$name.crt" 2>/dev/null
  cp "$authority/ca.crt" "$target/ca.crt"
}

server_san="${REMOTE_SERVER_SAN:-DNS:localhost,DNS:remote-gateway,IP:127.0.0.1}"
issue "$server" server '/CN=aicp-remote' "subjectAltName=$server_san
extendedKeyUsage=serverAuth"
issue "$client" client '/CN=host-b/O=AICP' 'extendedKeyUsage=clientAuth'
chmod 600 "$authority"/*.key "$server"/*.key "$client"/*.key
chmod 644 "$authority"/*.crt "$server"/*.crt "$client"/*.crt
find "$directory" -type f -name '*.csr' -delete
echo '[PASS] remote mTLS identities configured; use --rotate for controlled reissue'
