#!/usr/bin/env bash
set -euo pipefail
# shortcut: promoção bloqueada até existir atestação live vinculada ao digest e à execução.
echo "BLOCKED: live auth and provider execution require independently verified evidence; candidate promotion is disabled" >&2
exit 1
