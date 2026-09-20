#!/usr/bin/env bash
# Dumps the portfolio database to /opt/portfolio/backups. Run nightly by cron (installed by
# the Ansible playbook) and by deploy.sh before every rollout.
#
#   Usage: backup.sh [label]    e.g. backup.sh pre-deploy

set -euo pipefail

cd "$(dirname "$0")"

label="${1:-nightly}"
keep_days="${BACKUP_KEEP_DAYS:-14}"
target="backups/portfolio-$(date -u +%Y%m%dT%H%M%SZ)-${label}.dump"

mkdir -p backups

# TODO: upload this to a separate blob storage later
# Custom format: compressed, and pg_restore can pick single tables back out of it.
docker compose -f docker-compose.prod.yml exec -T db \
    pg_dump -U portfolio -d portfolio --format=custom > "${target}.partial"
mv "${target}.partial" "$target"

find backups -name 'portfolio-*.dump' -mtime +"$keep_days" -delete

echo "==> Backup written: $target"
