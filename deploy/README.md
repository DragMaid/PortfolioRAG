# Deploying to the VPS

```
push to main ─► CI suite ─► build api/frontend/rag ─► GHCR ─► ssh deploy@vps deploy.sh
                                                               │
                        pull ─► pg_dump ─► migrate ─► up -d ─► /healthz ok? ─┬─ yes: done
                                                                             └─ no: previous tag back up, run fails
```

- **`docker-compose.prod.yml`** (repo root) — the whole stack: Postgres/pgvector, a one-shot
  `migrate`, the API, the frontend, the rag worker. Only binds `127.0.0.1`; the host's nginx is
  the public entry point, shared with the other sites on the box.
- **`ansible/`** — one-time (and re-runnable) server setup: Docker, the `deploy` user,
  `/opt/portfolio`, nginx vhost + Let's Encrypt, unattended security upgrades, nightly backups.
- **`deploy.sh` / `backup.sh`** — copied to `/opt/portfolio` on every deploy and run there.
- **`.github/workflows/deploy.yml`** — the pipeline.

## First-time setup

1. **DNS**: point `example.com` and `api.example.com` at the VPS.
2. **Deploy key**: `ssh-keygen -t ed25519 -f ~/.ssh/portfolio-deploy -C portfolio-deploy`
3. **Provision**:
   ```sh
   cd deploy/ansible
   cp inventory.example.ini inventory.ini   # fill in host, domain, email, key path
   ansible-galaxy collection install -r requirements.yml
   ansible-playbook -i inventory.ini playbook.yml
   ```
4. **GitHub** → Settings → Environments → `production`:

   | kind   | name               | value                                                     |
   |--------|--------------------|-----------------------------------------------------------|
   | secret | `VPS_SSH_KEY`      | contents of `~/.ssh/portfolio-deploy`                     |
   | secret | `VPS_KNOWN_HOSTS`  | `ssh-keyscan -p 22 <host>` — compare to the server's own fingerprint |
   | secret | `PROD_ENV_FILE`    | `deploy/.env.example`, filled in                          |
   | var    | `VPS_HOST`         | host or IP                                                |
   | var    | `VPS_PORT`         | optional, default 22                                      |
   | var    | `PUBLIC_API_URL`   | `https://api.example.com`                                 |
   | var    | `GOOGLE_CLIENT_ID` | optional                                                  |

5. Push to `main` (or run **Deploy** by hand). The first run creates the database from scratch.

## Day to day

- **Release**: merge to `main`. Nothing else.
- **Roll back**: Actions → Deploy → Run workflow → `image_tag` = an earlier commit SHA. No
  rebuild; it redeploys what is already in GHCR. Schema migrations are *not* reversed — restore
  a dump if a migration itself was the problem.
- **Change a secret/setting**: edit `PROD_ENV_FILE`, re-run the latest Deploy.
- **Logs**: `ssh deploy@vps 'cd /opt/portfolio && docker compose -f docker-compose.prod.yml logs -f api'`
- **Restore a dump**:
  ```sh
  cd /opt/portfolio
  docker compose -f docker-compose.prod.yml exec -T db \
    pg_restore -U portfolio -d portfolio --clean --if-exists < backups/<file>.dump
  ```

## Not automatic, on purpose

- **Postgres major versions** (`pgvector/pgvector:pg16`): a major bump needs a dump and restore.
- **Backups are local to the VPS.** Copy `/opt/portfolio/backups` off the box (e.g. `rclone` to a
  second B2 bucket) — a dead disk takes the dumps with it.
- **`LLM_ENCRYPTION_KEY`** must never change once authors have saved provider keys.
