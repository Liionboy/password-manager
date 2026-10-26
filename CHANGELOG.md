# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.8.5] - 2026-10-26

### Security

- Update the Express body-parser dependency to 1.20.9 to fix the compressed
  request denial of service (CVE-2026-111181 / GHSA-27r3-jxmh-p828).
- Update Nodemailer to 10.2.1 to fix recipient address parsing vulnerabilities
  GHSA-8c8m-p3m8-cjg8, GHSA-m943-m63m-w62w, and GHSA-85x2-q946-cp5h.
- Update Vite to 8.3.5 and follow-redirects to 1.16.2 to address the additional
  high-severity findings detected during release verification.
- Restore the frontend audit gate to HIGH, matching the backend, and remove
  the obsolete React Router exception.

### Tests

- Add compressed request regression tests, including trailing gzip bytes and
  completion of deflate requests after early decompression.
- Run backend unit tests in Security CI without relaxing vulnerability gates.

## [2.8.2] - 2026-09-11

### Changed

- Remove editable SMTP server fields from Settings; SMTP remains managed by the
  server environment while notification preferences remain user-configurable.
- Preserve stored SMTP settings when saving notification preferences from the
  updated Settings page.

## [2.8.1] - 2026-09-11

### Fixed

- Keep SMTP credentials from `.env` separate from notification preferences.
- Ignore incomplete duplicate global settings rows when selecting SMTP or notification configuration.
- Stop creating a new empty global settings row on every database initialization.
- Add regression coverage for environment SMTP and global notification preference selection.

## [2.8.0] - 2026-09-11

### Added

- Add server-side SMTP configuration through `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`,
  `SMTP_PASS`, and `SMTP_FROM` environment variables.
- Add themed confirmation dialogs for destructive and security-sensitive actions.

### Fixed

- Reuse saved server-side SMTP credentials for test emails instead of sending the
  masked password value from the browser.

## [2.7.2] - 2026-09-11

### Security

- Publish the backend `nodemailer` 9.1.1 security update in new Docker images.

## [2.7.1] - 2026-09-02

### Security
- Upgrade Alpine runtime packages to include the fix for CVE-2026-14456.

## [2.7.0] - 2026-08-21

### Added
- Per-user encrypted vault data for passwords, cards, and secure notes.

### Changed
- Hardened authentication, MFA temporary state, session handling, and password-change re-encryption.
- Updated frontend and backend security dependencies.

### Security
- Removed client-side persistence of sensitive master-password and token material.
- Added safer encryption-key validation and legacy-data migration paths.
