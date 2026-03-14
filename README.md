# 🔐 Password Manager

A secure, self-hosted password manager application built with React, Node.js, and PostgreSQL - all containerized with Docker.

![Version](https://img.shields.io/badge/version-2.3.4-blue)
![Docker](https://img.shields.io/badge/Docker-ready-blueviolet)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

- **Secure Authentication** - User registration and login with JWT tokens
- **Two-Factor Authentication (TOTP)** - Add an extra layer of security with authenticator apps
- **Password Recovery** - Forgot/reset password via email
- **Change Password** - Users can change their password from Profile page
- **AES-256 Encryption** - All passwords and card numbers are encrypted at rest
- **Password Generator** - Customizable password generator (length, uppercase, lowercase, numbers, symbols)
- **Password Strength Validation** - Minimum 8 characters with uppercase, lowercase, numbers, and special characters
- **Account Lockout** - Automatic account lockout after 5 failed login attempts (15 minutes)
- **Rate Limiting** - Protection against brute force attacks
- **Security Headers** - Helmet.js for enhanced security headers
- **Password Generator** - Customizable password generator (length, uppercase, lowercase, numbers, symbols)
- **Categories** - Organize your passwords and cards with custom categories (global - visible to all users)
- **Folders** - Organize passwords and cards in nested folders
- **Search** - Real-time search across all your passwords and cards
- **Import/Export** - Export passwords to JSON and import from other password managers (including Bitwarden)
- **Copy to Clipboard** - One-click copy functionality
- **Bank Cards** - Store and manage your credit/debit cards with auto-brand detection
- **Email Notifications** - Get notified via email when passwords or cards are added, updated, or deleted (SMTP)
- **Global SMTP** - Admin can configure SMTP for all users
- **Teams** - Create teams and share passwords/folders with team members
- **Role-Based Access** - Admin and user roles with different permissions
- **Admin Panel** - Admin can manage users, teams, and settings
- **Responsive Design** - Works on desktop and mobile devices

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18 + Vite |
| Backend | Node.js + Express |
| Database | PostgreSQL 15 |
| Authentication | JWT + bcrypt |
| Encryption | AES-256 (crypto-js) |
| Email | Nodemailer (SMTP) |
| Container | Docker + Nginx |

## 🚀 Quick Start

### Prerequisites

- [Docker](https://www.docker.com/get-started) installed
- [Docker Compose](https://docs.docker.com/compose/install/) installed

### Installation

1. Clone the repository:
```bash
git clone https://github.com/Liionboy/password-manager.git
cd password-manager
```

2. Start the application:
```bash
docker compose build --no-cache
```

3. Open your browser and navigate to:
```
http://localhost:1532
```

## 📖 Usage

### First Time Setup

1. Register a new account on the registration page
2. Login with your credentials
3. Start adding your passwords!

> **Note:** The first registered user becomes admin. Default admin credentials: `admin` / `admin` (after resetting the database)

### Adding a Password

1. Click the **+ Add Password** button (in the Passwords tab)
2. Fill in the required fields (Title, Password)
3. Optionally add: username, URL, category, notes
4. Use the **Generate** button to create a strong password

### Adding a Card

1. Click the **Cards** tab
2. Click **+ Add Card**
3. Fill in the required fields (Title, Card Number)
4. Card brand (Visa, Mastercard, etc.) is auto-detected

### Password Generator Options

- **Length** - Choose between 4-64 characters
- **A-Z** - Include uppercase letters
- **a-z** - Include lowercase letters
- **0-9** - Include numbers
- **!@#** - Include special symbols

### Export/Import

- **Export** - Downloads all your passwords as a JSON file
- **Import** - Paste JSON data to import passwords from other sources (supports Bitwarden export format)

### Email Notifications

1. Click **Settings** in the header (admin only)
2. Configure your SMTP server:
   - **SMTP Host** - e.g., `smtp.gmail.com`
   - **SMTP Port** - e.g., `587` (TLS) or `465` (SSL)
   - **SMTP Username** - Your email address
   - **SMTP Password** - For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833)
   - **From Email** - e.g., `Password Manager <your@email.com>`
3. Enable notifications for add/update/delete events
4. Click **Send Test Email** to verify settings

### Teams & Collaboration

1. Click **Teams** to access team management
2. **Create a team** - Give it a name (e.g., "Marketing", "IT")
3. **Add members** - As team admin, click "Manage Members" → "Add Member"
4. **Create team folders** - When creating a folder, select a team (admin only)
5. **Share passwords** - Passwords in team folders are visible to all team members

### Admin Features

The first registered user becomes the admin. Admin capabilities:
- **Users** page - Create, edit (change role), reset password, and delete users
- **Teams** page - Create teams, add/remove members, delete teams
- **Settings** page - Configure SMTP email notifications
- **Team folders** - Assign folders to teams for team visibility

### Two-Factor Authentication (2FA)

1. Click **Profile** in the header
2. Click **Enable 2FA**
3. Scan the QR code with your authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.)
4. Enter the 6-digit code from your app to verify and enable 2FA

**At login:**
1. Enter username and password
2. Enter the 6-digit code from your authenticator app

You can disable 2FA anytime from the Profile page.

### Password Recovery

1. Click **Forgot your password?** on the login page
2. Enter your username
3. Check your email for the reset link
4. Click the link and set a new password
5. Login with your new password

### Change Password

1. Click **Profile** in the header
2. Enter your current password and new password
3. Click **Save** to update your password

## 📁 Project Structure

```
password-manager/
├── docker-compose.yml     # Docker orchestration
├── nginx.conf            # Nginx configuration
├── backend/
│   ├── Dockerfile        # Backend container
│   ├── package.json     # Node.js dependencies
│   └── src/
│       ├── index.js     # Express server
│       ├── middleware/
│       │   └── auth.js  # JWT authentication
│       ├── routes/
│       │   ├── auth.js    # Auth endpoints
│       │   ├── passwords.js # Password CRUD
│       │   ├── cards.js   # Card CRUD
│       │   └── settings.js # SMTP settings
│       └── utils/
│           └── crypto.js  # AES encryption
└── frontend/
    ├── Dockerfile        # Frontend container (React + Nginx)
    ├── package.json     # React dependencies
    ├── vite.config.js   # Vite configuration
    └── src/
        ├── App.jsx      # Main application
        ├── api.js       # API client
        ├── index.css    # Styles
        ├── main.jsx     # Entry point
        └── pages/
            ├── Login.jsx       # Login page
            ├── Register.jsx     # Registration page
            ├── Dashboard.jsx    # Main dashboard
            ├── PasswordForm.jsx # Add/Edit password
            ├── CardForm.jsx     # Add/Edit card
            └── Settings.jsx     # SMTP settings
```

## 🔧 Configuration

### Environment Variables

The following environment variables can be configured in `docker-compose.yml`:

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT tokens | `your-super-secret-jwt-key-change-in-production` |
| `ENCRYPTION_KEY` | 32-character key for AES-256 encryption | `32-char-encryption-key-here!!` |
| `DB_HOST` | PostgreSQL host | `postgres` |
| `DB_USER` | PostgreSQL user | `postgres` |
| `DB_PASSWORD` | PostgreSQL password | `postgres` |
| `DB_NAME` | PostgreSQL database name | `passwordmanager` |
| `BASE_URL` | Base URL for password reset links | `http://localhost:5173` |

> **Security Note:** Change the default `JWT_SECRET` and `ENCRYPTION_KEY` values in production!

### Optional Argon2 tuning (backend)

You can tune Argon2id cost via environment variables:

- `ARGON2_MEMORY_COST` (default `19456`)
- `ARGON2_TIME_COST` (default `2`)
- `ARGON2_PARALLELISM` (default `1`)

Legacy bcrypt hashes are still accepted and will be transparently upgraded to Argon2id after successful login.

## 🔒 Security Considerations

- All passwords and card numbers are encrypted using AES-256 before storage
- JWT tokens expire after 15 minutes (MFA temp tokens after 5 minutes)
- Password hashing uses Argon2id for new/updated passwords; existing bcrypt hashes remain compatible
- Passwords and card data are never stored in plain text
- PostgreSQL database is stored in a Docker volume for persistence
- Password strength validation (minimum 8 chars + 3 character types)
- Account lockout after 5 failed login attempts (15 minutes)
- Rate limiting on all endpoints (100 req/15min general, 10 req/15min auth)
- Helmet.js for security headers (HSTS, X-Frame-Options, etc.)
- Use strong, unique passwords for your master account

## 📝 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/verify` | Verify token |
| GET | `/api/auth/me` | Get current user profile |
| PUT | `/api/auth/profile` | Update user profile (email, password) |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Reset password with token |
| POST | `/api/auth/mfa/setup` | Generate MFA QR code |
| POST | `/api/auth/mfa/enable` | Enable MFA with verification code |
| POST | `/api/auth/mfa/disable` | Disable MFA with verification code |
| POST | `/api/auth/mfa/verify-temp` | Verify MFA code after login |
| POST | `/api/auth/refresh` | Rotate refresh token and get new access token |
| POST | `/api/auth/logout` | Logout current client |
| POST | `/api/auth/logout-all` | Revoke all user sessions |
| GET | `/api/auth/sessions` | List refresh sessions for current user |
| POST | `/api/auth/sessions/:id/revoke` | Revoke one refresh session |

### Passwords
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/passwords` | Get all passwords |
| POST | `/api/passwords` | Create password |
| PUT | `/api/passwords/:id` | Update password |
| DELETE | `/api/passwords/:id` | Delete password |
| POST | `/api/passwords/generate` | Generate password |
| GET | `/api/passwords/export` | Export passwords |
| POST | `/api/passwords/import` | Import passwords |

### Cards
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cards` | Get all cards |
| POST | `/api/cards` | Create card |
| PUT | `/api/cards/:id` | Update card |
| DELETE | `/api/cards/:id` | Delete card |

### Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/passwords/categories` | Get all categories |
| POST | `/api/passwords/categories` | Create category |
| DELETE | `/api/passwords/categories/:id` | Delete category |

### Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings` | Get user settings |
| PUT | `/api/settings` | Save SMTP settings (admin only) |
| POST | `/api/settings/test-email` | Send test email |

### Teams
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/teams` | Get user's teams |
| GET | `/api/teams/all` | Get all teams (admin only) |
| POST | `/api/teams` | Create a team |
| POST | `/api/teams/join` | Join a team |
| DELETE | `/api/teams/:id` | Delete a team |
| GET | `/api/teams/:id/members` | Get team members |
| POST | `/api/teams/:id/members` | Add member to team |
| DELETE | `/api/teams/:id/members/:userId` | Remove member from team |

### Users (Admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/users` | Get all users (admin only) |
| POST | `/api/auth/users` | Create user (admin only) |
| PUT | `/api/auth/users/:id` | Update user role (admin only) |
| DELETE | `/api/auth/users/:id` | Delete user (admin only) |
| POST | `/api/auth/users/:id/reset-password` | Reset user password (admin only) |

## 🐳 Docker Commands

```bash
# Build and start containers
docker compose up --build

# Start in detached mode
docker compose up -d

# Stop containers
docker compose down

# View logs
docker compose logs -f

# Rebuild specific service
docker compose build backend
docker compose build frontend
```

## 💾 Encrypted Backup & Restore (Milestone 7)

Backup/restore is implemented for the PostgreSQL Docker volume (`password-manager_pgdata`) with OpenSSL encryption.

### Scripts

- `scripts/backup-encrypted.sh` — creates encrypted backup (`.enc`) + checksum (`.sha256`)
- `scripts/restore-encrypted.sh <file.enc>` — restores from encrypted backup
- `scripts/test-restore.sh` — smoke test: backup → restore → `/api/health` check

### 1) Create encrypted backup

```bash
cd /home/adrian/.openclaw/workspace/password-manager
BACKUP_PASSPHRASE='set-a-strong-passphrase' ./scripts/backup-encrypted.sh
```

Output is stored in `./backups/` (ignored by git).

### 2) Restore encrypted backup

```bash
cd /home/adrian/.openclaw/workspace/password-manager
BACKUP_PASSPHRASE='set-a-strong-passphrase' ./scripts/restore-encrypted.sh ./backups/<backup-file>.enc
```

### 3) Test restore end-to-end

```bash
cd /home/adrian/.openclaw/workspace/password-manager
BACKUP_PASSPHRASE='set-a-strong-passphrase' ./scripts/test-restore.sh
```

If successful, script prints: `Restore test passed (health=200).`

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

Created by **Liionboy**

---

<p align="center">Made with ❤️ for secure password management</p>
