#!/usr/bin/env bash
set -euo pipefail

# Smoke test for backup+restore flow.
# It creates a backup, restores it, then checks /api/health.
# Usage:
#   BACKUP_PASSPHRASE='your-secret' ./scripts/test-restore.sh

if [[ -z "${BACKUP_PASSPHRASE:-}" ]]; then
  echo "ERROR: BACKUP_PASSPHRASE is required"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_DIR}"

"${SCRIPT_DIR}/backup-encrypted.sh"
LATEST_BACKUP="$(ls -1t ./backups/*.enc | head -n1)"

"${SCRIPT_DIR}/restore-encrypted.sh" "${LATEST_BACKUP}"

HTTP_CODE=""
for i in {1..30}; do
  HTTP_CODE="$(curl -s -o /dev/null -w "%{http_code}" http://localhost:1532/api/health || true)"
  if [[ "${HTTP_CODE}" == "200" ]]; then
    break
  fi
  sleep 2
done

if [[ "${HTTP_CODE}" != "200" ]]; then
  echo "ERROR: Health check failed after restore (HTTP ${HTTP_CODE})"
  echo "Tip: verify backend logs: docker logs --tail=100 password-manager-backend"
  exit 1
fi

echo "Restore test passed (health=200)."
