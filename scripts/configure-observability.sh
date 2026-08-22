#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"
target=".env.observability"
test ! -e "$target" || { echo '[PASS] existing observability configuration preserved'; exit 0; }
umask 077
{
  printf 'LANGFUSE_WEB_IMAGE=%s\n' "$(awk -F= '$1=="LANGFUSE_WEB_IMAGE" {print $2}' versions.env)"
  printf 'LANGFUSE_WORKER_IMAGE=%s\n' "$(awk -F= '$1=="LANGFUSE_WORKER_IMAGE" {print $2}' versions.env)"
  printf 'LANGFUSE_POSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 32)"
  printf 'LANGFUSE_CLICKHOUSE_PASSWORD=%s\n' "$(openssl rand -hex 32)"
  printf 'LANGFUSE_REDIS_PASSWORD=%s\n' "$(openssl rand -hex 32)"
  printf 'LANGFUSE_MINIO_PASSWORD=%s\n' "$(openssl rand -hex 32)"
  printf 'LANGFUSE_SALT=%s\n' "$(openssl rand -hex 32)"
  printf 'LANGFUSE_ENCRYPTION_KEY=%s\n' "$(openssl rand -hex 32)"
  printf 'LANGFUSE_NEXTAUTH_SECRET=%s\n' "$(openssl rand -hex 32)"
  printf 'LANGFUSE_PUBLIC_KEY=pk-lf-%s\n' "$(openssl rand -hex 16)"
  printf 'LANGFUSE_SECRET_KEY=sk-lf-%s\n' "$(openssl rand -hex 32)"
  printf 'LANGFUSE_ADMIN_EMAIL=admin@aicp.local\n'
  printf 'LANGFUSE_ADMIN_PASSWORD=%s\n' "$(openssl rand -base64 32 | tr -d '\n')"
  printf 'LANGFUSE_PORT=3000\n'
} > "$target"
echo '[PASS] isolated observability configuration generated'
