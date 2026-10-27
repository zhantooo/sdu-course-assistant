#!/usr/bin/env bash
# Local Postgres for DB-backed development, stored in ./.localdb (gitignored) so
# it survives reboots and /tmp cleanups. Usage: bash scripts/localdb.sh [start|stop|status]
set -euo pipefail

PGB="${PG_BIN:-/Library/PostgreSQL/18/bin}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/.localdb"
PGDATA="$DIR/pgdata"
PORT="${PGPORT:-55433}"
DB="sdu"

case "${1:-start}" in
  start)
    mkdir -p "$DIR"
    if [ ! -f "$PGDATA/PG_VERSION" ]; then
      echo "Initialising a new cluster…"
      "$PGB/initdb" -D "$PGDATA" -U "$USER" --auth=trust >/dev/null
    fi
    if "$PGB/pg_ctl" -D "$PGDATA" status >/dev/null 2>&1; then
      echo "Postgres already running."
    else
      "$PGB/pg_ctl" -D "$PGDATA" -o "-p $PORT -k $DIR" -l "$DIR/pg.log" -w start
    fi
    "$PGB/createdb" -h 127.0.0.1 -p "$PORT" -U "$USER" "$DB" 2>/dev/null || true
    echo "Postgres up on postgresql://$USER@127.0.0.1:$PORT/$DB"
    ;;
  stop)
    "$PGB/pg_ctl" -D "$PGDATA" stop -w 2>/dev/null || echo "Not running."
    ;;
  status)
    "$PGB/pg_ctl" -D "$PGDATA" status 2>/dev/null || echo "Not running."
    ;;
  *)
    echo "Usage: bash scripts/localdb.sh [start|stop|status]"; exit 1 ;;
esac
