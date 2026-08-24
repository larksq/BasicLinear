#!/bin/sh
set -eu

docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d openlinear_ct4 < db/001-isolation.sql
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d openlinear_ct4 < db/verify-isolation.sql
