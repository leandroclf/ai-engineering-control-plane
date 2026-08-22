#!/usr/bin/env bash

verify_backup_integrity() {
  local archive="${1:?archive is required}"
  local passphrase_file="${2:?passphrase file is required}"
  local staging="${3:?staging directory is required}"
  test -f "$archive.sha256" || { echo 'external archive checksum is missing' >&2; return 1; }
  (cd "$(dirname "$archive")" && sha256sum --check "$(basename "$archive").sha256")
  gpg --batch --yes --pinentry-mode loopback --passphrase-file "$passphrase_file" --decrypt "$archive" |
    tar -I zstd -xf - -C "$staging"
  (cd "$staging" && sha256sum --check SHA256SUMS)
}
