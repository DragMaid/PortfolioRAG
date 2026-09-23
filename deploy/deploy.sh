#!/usr/bin/env bash
# Rolls the stack at /opt/portfolio forward to the IMAGE_TAG in .env. Run by the deploy
# workflow over SSH, after it has uploaded docker-compose.prod.yml and a fresh .env.
#
#   Usage: deploy.sh <ghcr-user>     (a registry token is read from stdin; empty = no login)
#
# On a failed health check it puts the previous tag back and exits non-zero, so the
# workflow run goes red while the site keeps serving the last good release. Migrations are
# not reversed by that — which is why a database dump is taken before every rollout.

# -e stop upon fail, -u exit if a var is unset, -o pipeline 
# makes exit status the failure code of the first command that fails
set -euo pipefail

# $0 refer to the file, dirname get the parent dir and cd into it
cd "$(dirname "$0")"

# a bash array to avoid quote escaping issues
compose=(docker compose -f docker-compose.prod.yml)
# ${VAR:-default} setting ghcr_user to "" if $1 is not specified instead of failing
ghcr_user="${1:-}"

# search for the pattern that starts with ^ and followed by $1 (param passed into the func)
# tail -n1 take only the last value override
# -d= split the string with '=' delimeter and extract everything from field 2 to the end (-f2-)
env_value() {
    grep -E "^$1=" .env | tail -n1 | cut -d= -f2-
}

new_tag="$(env_value IMAGE_TAG)"
# Get tag, pipe error log to null and || true to return 0 on error so pipeline don't fail
previous_tag="$(cat .current-tag 2>/dev/null || true)"
site_domain="$(env_value SITE_DOMAIN)"

echo "==> Deploying ${new_tag} (previous: ${previous_tag:-none})"

# read data from stdin, due to the outside usage being
# echo "$GITHUB_TOKEN" | ssh host ./deploy.sh user so token is not exposed in log output
token="$(cat)"
# >/dev/null just silent stdout to avoid information leak,
# -password-stdin to read from stdin to avoid printing token
if [[ -n "$token" ]]; then
    echo "$token" | docker login ghcr.io -u "$ghcr_user" --password-stdin >/dev/null
fi

pull_status=0
# run the compose command, return the non-zero if failed
"${compose[@]}" pull --quiet || pull_status=$?
[[ -n "$token" ]] && docker logout ghcr.io >/dev/null
# If pull status is not zero then pull command failed
(( pull_status == 0 )) || { echo "!! pull failed"; exit "$pull_status"; }

# Dump before anything touches the schema. Skipped on the very first deploy, when there is
# no database yet.
if [[ -n "$("${compose[@]}" ps --status running --quiet db)" ]]; then
    ./backup.sh pre-deploy
fi

# Pinging the health endpoint until it succeed. Goes through Traefik on this host, so the
# routing labels are checked too; -k because a certificate may not be issued yet (or is
# self-signed), and it is our own loopback anyway.
probe() {
    curl -fsSk -o /dev/null --resolve "$1:443:127.0.0.1" "https://$1$2"
}

healthy() {
    for _ in $(seq 1 30); do
        if probe "api.${site_domain}" /healthz && probe "$site_domain" /; then
            return 0
        fi
        sleep 2
    done
    return 1
}

# Just remove the current image and ran the one beforehand instead
rollback() {
    echo "!! Release ${new_tag} failed"
    "${compose[@]}" logs --tail 80 migrate api frontend rag || true

    if [[ -z "$previous_tag" || "$previous_tag" == "$new_tag" ]]; then
        echo "!! No previous release to roll back to"
        exit 1
    fi

    echo "==> Rolling back to ${previous_tag}"
    sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=${previous_tag}/" .env
    "${compose[@]}" up -d --remove-orphans
    exit 1
}

"${compose[@]}" up -d --remove-orphans || rollback
healthy || rollback

echo "$new_tag" > .current-tag

# Only this stack's images (labelled at build time) and only ones no container uses, so
# the other sites' images are never touched.
docker image prune --all --force \
    --filter "label=org.opencontainers.image.vendor=portfolio" \
    --filter "until=240h" >/dev/null

echo "==> ${new_tag} is live"
