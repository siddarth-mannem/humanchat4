Tu#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)
REPO_ROOT=$(cd -- "${SCRIPT_DIR}/.." >/dev/null 2>&1 && pwd)

ENV_FILE=${ENV_FILE:-.env}
PROXY_BIN=${PROXY_BIN:-${REPO_ROOT}/cloud-sql-proxy}
LOCAL_DB_PORT=${LOCAL_DB_PORT:-5433}
MIGRATE_CMD=${MIGRATE_CMD:-npm run db:migrate}
INSTANCE_CONNECTION=${INSTANCE_CONNECTION:-}

if [[ -f "${REPO_ROOT}/${ENV_FILE}" ]]; then
  load_env_file() {
    local file="$1"
    while IFS= read -r line || [[ -n "$line" ]]; do
      line="${line%%$'\r'}"
      [[ -z "$line" || ${line:0:1} == "#" ]] && continue
      if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
        local key="${BASH_REMATCH[1]}"
        local value="${BASH_REMATCH[2]}"
        if [[ "$value" == "\""* && "$value" == *"\"" ]]; then
          value=${value#\"}
          value=${value%\"}
        fi
        export "${key}=${value}"
      fi
    done <"$file"
  }
  load_env_file "${REPO_ROOT}/${ENV_FILE}"
else
  echo "Env file ${REPO_ROOT}/${ENV_FILE} not found. Set ENV_FILE or create one." >&2
  exit 1
fi

"${SCRIPT_DIR}/verify-env.sh" >/dev/null

effective_database_url=${DATABASE_URL:?"DATABASE_URL must be set"}
proxy_pid=""

cleanup() {
  if [[ -n "${proxy_pid}" ]]; then
    if kill -0 "${proxy_pid}" >/dev/null 2>&1; then
      kill "${proxy_pid}" >/dev/null 2>&1 || true
      wait "${proxy_pid}" >/dev/null 2>&1 || true
    fi
  fi
}
trap cleanup EXIT

need_proxy=0
instance_connection="${INSTANCE_CONNECTION}"
if [[ "${effective_database_url}" == *"host=/cloudsql/"* ]]; then
  need_proxy=1
  if [[ -z "${instance_connection}" ]]; then
    instance_path=${effective_database_url##*host=}
    instance_path=${instance_path%%&*}
    instance_path=${instance_path//%2F/\/}
    instance_path=${instance_path#/}
    if [[ "${instance_path}" == cloudsql/* ]]; then
      instance_connection=${instance_path#cloudsql/}
    else
      instance_connection=${instance_path}
    fi
  fi
  if [[ -z "${instance_connection}" ]]; then
    echo "Unable to determine Cloud SQL instance connection name. Set INSTANCE_CONNECTION." >&2
    exit 1
  fi
fi

if (( need_proxy )); then
  url_no_proto=${effective_database_url#postgresql://}
  creds_part=${url_no_proto%@*}
  host_part=${url_no_proto#*@}
  db_part=${host_part#/}
  db_name=${db_part%%\?*}
  if [[ -z "${db_name}" ]]; then
    db_name=postgres
  fi
  db_user=${creds_part%%:*}
  db_pass=${creds_part#*:}

  ensure_proxy() {
    if [[ -x "${PROXY_BIN}" ]]; then
      return
    fi
    os=$(uname | tr '[:upper:]' '[:lower:]')
    arch=$(uname -m)
    case "${arch}" in
      x86_64|amd64)
        arch=amd64
        ;;
      arm64|aarch64)
        arch=arm64
        ;;
      *)
        echo "Unsupported architecture: ${arch}" >&2
        exit 1
        ;;
    esac
    url="https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.11.1/cloud-sql-proxy.${os}.${arch}"
    echo "Downloading Cloud SQL Auth Proxy from ${url}"
    curl -sSL -o "${PROXY_BIN}" "${url}"
    chmod +x "${PROXY_BIN}"
  }

  ensure_proxy

  echo "Starting Cloud SQL Auth Proxy for ${instance_connection} on port ${LOCAL_DB_PORT}"
  "${PROXY_BIN}" "${instance_connection}" --port "${LOCAL_DB_PORT}" >/tmp/cloud-sql-proxy.log 2>&1 &
  proxy_pid=$!

  if command -v nc >/dev/null 2>&1; then
    for _ in {1..20}; do
      if nc -z 127.0.0.1 "${LOCAL_DB_PORT}" >/dev/null 2>&1; then
        break
      fi
      sleep 0.5
    done
  else
    echo "nc not found; sleeping briefly to allow proxy to start"
    sleep 2
  fi

  effective_database_url="postgresql://${db_user}:${db_pass}@127.0.0.1:${LOCAL_DB_PORT}/${db_name}"
fi

echo "Running migrations via ${MIGRATE_CMD}"
(
  cd "${REPO_ROOT}"
  DATABASE_URL="${effective_database_url}" bash -lc "${MIGRATE_CMD}"
)

echo "Sync complete."
