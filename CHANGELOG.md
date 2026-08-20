# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.7.0] - 2026-08-21

### Added
- Per-user encrypted vault data for passwords, cards, and secure notes.

### Changed
- Hardened authentication, MFA temporary state, session handling, and password-change re-encryption.
- Updated frontend and backend security dependencies.

### Security
- Removed client-side persistence of sensitive master-password and token material.
- Added safer encryption-key validation and legacy-data migration paths.
