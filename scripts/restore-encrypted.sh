#!/usr/bin/env bash
set -euo pipefail

# Restore encrypted backup into PostgreSQL volume.
# Usage:
#   BACKUP_PASSPHRASE='your-secret' ./scripts/restore-encrypted.sh ./backups/password-manager-pgdata-*.tar.gz.enc
# Optional env:
#   PROJECT_NAME=password-manager

PROJECT_NAME="${PROJECT_NAME:-password-manager}"
ENC_FILE="${1:-}"
TMP_DIR="$(mktemp -d)"
DEC_FILE="${TMP_DIR}/restore.tar.gz"

cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

if [[ -z "${ENC_FILE}" ]]; then
  echo "Usage: BACKUP_PASSPHRASE=... $0 <backup-file.enc>"
  exit 1
fi

if [[ ! -f "${ENC_FILE}" ]]; then
  echo "ERROR: Backup file not found: ${ENC_FILE}"
  exit 1
fi

if [[ -z "${BACKUP_PASSPHRASE:-}" ]]; then
  echo "ERROR: BACKUP_PASSPHRASE is required"
  exit 1
fi

echo "[1/5] Verifying checksum (if .sha256 exists)..."
if [[ -f "${ENC_FILE}.sha256" ]]; then
  sha256sum -c "${ENC_FILE}.sha256"
else
  echo "No checksum file found (${ENC_FILE}.sha256), skipping."
fi

echo "[2/5] Decrypting backup..."
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 -salt \
  -in "${ENC_FILE}" \
  -out "${DEC_FILE}" \
  -pass env:BACKUP_PASSPHRASE

echo "[3/5] Stopping services that use the DB volume..."
docker compose stop backend postgres >/dev/null

echo "[4/5] Replacing Docker volume contents..."
docker run --rm \
  -v "${PROJECT_NAME}_pgdata:/target" \
  -v "${TMP_DIR}:/restore:ro" \
  alpine:3.20 \
  sh -c "rm -rf /target/* && tar -xzf /restore/restore.tar.gz -C /target"

echo "[5/5] Starting services back..."
docker compose up -d postgres backend >/dev/null

echo "Restore completed successfully."
