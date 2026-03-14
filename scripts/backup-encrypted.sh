#!/usr/bin/env bash
set -euo pipefail

# Encrypted backup for Password Manager PostgreSQL volume.
# Usage:
#   BACKUP_PASSPHRASE='your-secret' ./scripts/backup-encrypted.sh
# Optional env:
#   BACKUP_DIR=./backups
#   PROJECT_NAME=password-manager

PROJECT_NAME="${PROJECT_NAME:-password-manager}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TS="$(date +%Y%m%d-%H%M%S)"
TMP_DIR="$(mktemp -d)"
BACKUP_BASENAME="${PROJECT_NAME}-pgdata-${TS}.tar.gz"
ARCHIVE_PATH="${TMP_DIR}/${BACKUP_BASENAME}"
ENC_PATH="${BACKUP_DIR}/${BACKUP_BASENAME}.enc"
META_PATH="${ENC_PATH}.sha256"

cleanup() {
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

if [[ -z "${BACKUP_PASSPHRASE:-}" ]]; then
  echo "ERROR: BACKUP_PASSPHRASE is required"
  exit 1
fi

mkdir -p "${BACKUP_DIR}"

# Ensure volume exists
if ! docker volume inspect "${PROJECT_NAME}_pgdata" >/dev/null 2>&1; then
  echo "ERROR: Docker volume ${PROJECT_NAME}_pgdata not found"
  exit 1
fi

echo "[1/4] Creating plain tar.gz backup from Docker volume..."
docker run --rm \
  -v "${PROJECT_NAME}_pgdata:/source:ro" \
  -v "${TMP_DIR}:/backup" \
  alpine:3.20 \
  sh -c "tar -czf /backup/${BACKUP_BASENAME} -C /source ."

echo "[2/4] Encrypting backup with openssl (AES-256-CBC + PBKDF2)..."
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 -salt \
  -in "${ARCHIVE_PATH}" \
  -out "${ENC_PATH}" \
  -pass env:BACKUP_PASSPHRASE

echo "[3/4] Writing checksum..."
sha256sum "${ENC_PATH}" > "${META_PATH}"

echo "[4/4] Backup complete"
echo "Encrypted backup: ${ENC_PATH}"
echo "Checksum:         ${META_PATH}"
