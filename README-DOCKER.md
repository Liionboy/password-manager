# Password Manager - Self-Hosted

Secure, open-source password manager that you run on your own infrastructure.

## ✨ Features

- 🔐 **Encrypted password storage** (Argon2id + bcrypt for legacy)
- 👥 **Team sharing** via Groups
- 🔑 **Two-factor authentication** (TOTP)
- 📱 **Clean responsive web UI**
- 🐳 **Docker-ready** - easy self-hosting

## 🚀 Quick Start

```bash
# Using docker-compose (recommended)
curl -O https://raw.githubusercontent.com/Liionboy/password-manager/main/docker-compose.yml
# Edit .env with your settings
docker compose up -d
```

Or manually:

```bash
docker run -d \
  -p 5000:5000 \
  -p 1532:8080 \
  -e DB_PASSWORD=your_secure_password \
  -e JWT_SECRET=your_jwt_secret \
  adrianbrisca/password-manager:latest
```

Then open http://localhost:1532

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | Database host | postgres |
| `DB_PORT` | Database port | 5432 |
| `DB_USER` | Database user | postgres |
| `DB_PASSWORD` | Database password | - |
| `DB_NAME` | Database name | passwordmanager |
| `JWT_SECRET` | JWT signing secret | - |
| `PORT` | Backend port | 5000 |

## 🐳 Docker Tags

- `latest` - Current stable release
- `v2.4.0` - Specific version

## 🔒 Security

- Runs as non-root user inside container
- Read-only filesystem with dropped Linux capabilities
- CSRF protection via Helmet
- Rate limiting enabled
- Argon2id for new passwords, bcrypt for backward compatibility

## 🛠️ Tech Stack

- **Backend:** Node.js, Express, Argon2id, PostgreSQL
- **Frontend:** React, Vite, Nginx
- **Database:** PostgreSQL 15

## 📄 License

MIT

---

**🔗 Links:**
- GitHub: https://github.com/Liionboy/password-manager
- Docker Hub: https://hub.docker.com/r/adrianbrisca/password-manager
