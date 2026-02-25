# 🔐 Password Manager

A secure, self-hosted password manager application built with React, Node.js, and SQLite - all containerized with Docker.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Docker](https://img.shields.io/badge/Docker-ready-blueviolet)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

- **Secure Authentication** - User registration and login with JWT tokens
- **AES-256 Encryption** - All passwords are encrypted at rest
- **Password Generator** - Customizable password generator (length, uppercase, lowercase, numbers, symbols)
- **Categories** - Organize your passwords with custom categories
- **Search** - Real-time search across all your passwords
- **Import/Export** - Export passwords to JSON and import from other password managers
- **Copy to Clipboard** - One-click copy functionality
- **Responsive Design** - Works on desktop and mobile devices

## 🛠️ Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18 + Vite |
| Backend | Node.js + Express |
| Database | SQLite (better-sqlite3) |
| Authentication | JWT + bcrypt |
| Encryption | AES-256 (crypto-js) |
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
docker compose up --build
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

### Adding a Password

1. Click the **+ Add Password** button
2. Fill in the required fields (Title, Password)
3. Optionally add: username, URL, category, notes
4. Use the **Generate** button to create a strong password

### Password Generator Options

- **Length** - Choose between 4-64 characters
- **A-Z** - Include uppercase letters
- **a-z** - Include lowercase letters
- **0-9** - Include numbers
- **!@#** - Include special symbols

### Export/Import

- **Export** - Downloads all your passwords as a JSON file
- **Import** - Paste JSON data to import passwords from other sources

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
│       │   └── passwords.js # Password CRUD
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
            └── PasswordForm.jsx # Add/Edit password
```

## 🔧 Configuration

### Environment Variables

The following environment variables can be configured in `docker-compose.yml`:

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT tokens | `your-super-secret-jwt-key-change-in-production` |
| `ENCRYPTION_KEY` | 32-character key for AES-256 encryption | `32-char-encryption-key-here!!` |

> **Security Note:** Change the default `JWT_SECRET` and `ENCRYPTION_KEY` values in production!

## 🔒 Security Considerations

- All passwords are encrypted using AES-256 before storage
- JWT tokens expire after 24 hours
- Passwords are never stored in plain text
- SQLite database is stored in a Docker volume for persistence
- Use strong, unique passwords for your master account

## 📝 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/verify` | Verify token |

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

### Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/passwords/categories` | Get all categories |
| POST | `/api/passwords/categories` | Create category |
| DELETE | `/api/passwords/categories/:id` | Delete category |

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

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

Created by **Liionboy**

---

<p align="center">Made with ❤️ for secure password management</p>
