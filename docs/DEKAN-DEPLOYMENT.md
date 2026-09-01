# Dekan Co-hosted Deployment

This profile runs the Delivery system on the existing Dekan Ubuntu host without replacing OpenLiteSpeed, MariaDB, or the existing host Redis service.

## What runs

- Delivery API on `127.0.0.1:4000`
- Courier PWA on `127.0.0.1:3001`
- Admin/Dispatcher on `127.0.0.1:3002`
- dedicated PostgreSQL/PostGIS inside Docker only
- dedicated Redis inside Docker only

The Customer PWA and Caddy are intentionally not started. Dekan customers continue to use WooCommerce on `decon.ir`.

## Resource ceiling

Long-running containers are capped at approximately:

- PostgreSQL/PostGIS: 768 MB / 0.60 CPU
- Redis: 128 MB / 0.20 CPU
- API: 512 MB / 0.70 CPU
- Courier: 256 MB / 0.25 CPU
- Admin: 256 MB / 0.25 CPU

Total steady-state ceiling: about 1.9 GB RAM and 2 CPU. The migration container is transient.

## Host preparation

Required: Ubuntu 24.04, Docker Engine, Docker Compose v2, Git, curl. OpenLiteSpeed keeps ports 80/443.

Redis logs may warn when Linux memory overcommit is disabled. Set it deliberately on the host before pilot traffic:

```bash
sysctl -w vm.overcommit_memory=1
printf 'vm.overcommit_memory = 1\n' > /etc/sysctl.d/99-dekan-delivery.conf
sysctl --system
```

Do not publish PostgreSQL or Redis ports.

## Environment

```bash
cp ops/dekan.env.example ops/dekan.env
chmod 600 ops/dekan.env
```

Fill real secrets only on the server. Never commit `ops/dekan.env`.

Generate application/database secrets with, for example:

```bash
openssl rand -hex 32
```

Production API startup requires the real IPPanel settings. Neshan routing can use `ROUTING_PROVIDER=approximate` temporarily, but the Courier web map still requires a valid `NEXT_PUBLIC_NESHAN_MAP_KEY` for map rendering.

## Validate and deploy

```bash
ENV_FILE=ops/dekan.env bash ops/dekan-preflight.sh
ENV_FILE=ops/dekan.env bash ops/dekan-deploy.sh
```

Verify that only loopback application ports are published:

```bash
docker compose --env-file ops/dekan.env -f docker-compose.dekan.yml ps
ss -lntp | grep -E ':(3001|3002|4000)\\b'
```

Expected host bindings are `127.0.0.1`, never `0.0.0.0`.

## OpenLiteSpeed

OpenLiteSpeed remains the public TLS endpoint. Configure two HTTPS virtual hosts/listeners:

- `courier.<chosen-domain>` -> reverse proxy to `http://127.0.0.1:3001`
- `dispatch.<chosen-domain>` -> reverse proxy to `http://127.0.0.1:3002`

Do not expose port 4000 publicly. The future WooCommerce connector calls `http://127.0.0.1:4000/api` locally from the Dekan host.

## First users

After the stack is healthy, provision the first users with the existing script, pointing it at the Dekan compose profile:

```bash
ENV_FILE=ops/dekan.env COMPOSE_FILE=docker-compose.dekan.yml bash ops/provision-user.sh +98911XXXXXXXX COURIER MOTORBIKE
ENV_FILE=ops/dekan.env COMPOSE_FILE=docker-compose.dekan.yml bash ops/provision-user.sh +98911XXXXXXXX ADMIN
```

Use actual authorized phone numbers; do not put them in Git.

## Backups

The existing PostgreSQL backup/restore scripts support `COMPOSE_FILE` and `ENV_FILE`. Use the Dekan profile explicitly:

```bash
ENV_FILE=ops/dekan.env COMPOSE_FILE=docker-compose.dekan.yml bash ops/backup-postgres.sh
```

Keep at least one off-host backup before field pilot.

## Rollback / stop Delivery only

Stopping Delivery does not stop OpenLiteSpeed, WordPress, MariaDB, or the host Redis service:

```bash
docker compose --env-file ops/dekan.env -f docker-compose.dekan.yml stop api courier admin
```

To stop the full Delivery stack while retaining its volumes:

```bash
docker compose --env-file ops/dekan.env -f docker-compose.dekan.yml down
```

Never add `-v` during routine rollback because that deletes Delivery database volumes.
