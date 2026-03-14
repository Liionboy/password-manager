# Security & Regression Test Matrix (Milestone 8)

## Scope
Release target: `v2.4.0-dev.1`

This matrix defines the minimum validation set for every PR and for release preparation.

## Automated (CI)

| ID | Area | Test | Expected |
|---|---|---|---|
| CI-01 | Availability | `GET /api/health` after compose up | HTTP 200 |
| CI-02 | Headers | Root response has CSP + X-Frame-Options + X-Content-Type-Options | Present |
| CI-03 | Auth abuse | Repeated bad login attempts | HTTP 429 observed |
| CI-04 | Backup | `scripts/backup-encrypted.sh` | `.enc` + `.sha256` generated |
| CI-05 | SAST/secrets/deps | Security CI (gitleaks/npm audit/semgrep/codeql) | Green |

## Manual Smoke (before tagging)

| ID | Area | Test | Expected |
|---|---|---|---|
| MAN-01 | Login | Valid admin login (`admin/admin` in clean db) | Success token flow |
| MAN-02 | Password CRUD | Add/update/delete password | Works, audit intact |
| MAN-03 | Session security | Revoke one session + logout-all | Old refresh invalidated |
| MAN-04 | Restore | `scripts/test-restore.sh` with passphrase | Restore completes + health 200 |
| MAN-05 | Hardening runtime | Inspect backend/frontend containers | non-root + readOnly + capDrop ALL + no-new-privileges |

## Release Gate (v2.4.0-dev.1)

Release can be tagged only if:

1. Security CI = green
2. E2E Security Regression = green
3. Manual smoke cases MAN-01..MAN-05 passed
4. No open critical/high security findings
