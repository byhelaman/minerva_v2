# Minerva v2

Role-based authentication management system using Supabase and Tauri.

## Requirements

- Node.js 18+
- pnpm
- Rust (for Tauri)
- Supabase account

## Local Installation

```bash
# Clone repository
git clone <url> && cd minerva_v2

# Install dependencies
pnpm install

# Configure environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Run in development
pnpm tauri dev
```

## Supabase Setup

### 1. Create Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Copy the URL and anon key to your `.env` file

### 2. Run Migrations (in order)

Execute each file in Supabase **SQL Editor**, following this order:

| Order | File | Description |
|-------|------|-------------|
| 1 | `001_roles_permissions.sql` | Roles and permissions tables + seed data |
| 2 | `002_profiles.sql` | Profiles table + auto-create triggers |
| 3 | `003_auth_hook.sql` | Auth Hook for JWT Custom Claims |
| 4 | `004_functions.sql` | RPCs: get_my_profile, update_my_display_name |
| 5 | `005_policies.sql` | RLS policies using JWT claims |
| 6 | `006_security_triggers.sql` | Privilege escalation prevention trigger |
| 7 | `007_user_management.sql` | User Management RPCs (`create_user`, `delete_user`) |
| 8 | `008_realtime_security.sql` | Enable Realtime for specific roles |
| 9 | `009_zoom_connection.sql` | Zoom Integration Tables & Vault Setup |
| 10 | `010_fix_zoom_rpc.sql` | Robust credential storage RPC (prevents duplicate keys) |

## Integrations

### Zoom Integration 🎥
Minerva v2 supports connecting a Zoom account for automated meeting creation.
- **Documentation**: See **System → Documentation** in the app.
- **Features**: Auth (OAuth 2.0), Status Check, Disconnect.
- **Security**: Based on Supabase Vault and Server-to-Server OAuth.

### 3. Enable Auth Hook

1. Go to **Dashboard → Authentication → Hooks**
2. Find **"Customize Access Token (JWT) Claims"**
3. Select schema `public`, function `custom_access_token_hook`
4. Save

### 4. Configure Email Templates (OTP)

In **Dashboard → Authentication → Email Templates**:

#### Reset Password
```html
<h2>Reset Password</h2>
<p>Use this code to reset your password:</p>
<p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 16px;">{{ .Token }}</p>
<p>This code expires in 1 hour.</p>
<p>If you didn't request a password reset, please ignore this email.</p>
```

#### Confirm Signup
```html
<h2>Confirm your signup</h2>
<p>Use this code to verify your email address:</p>
<p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 16px;">{{ .Token }}</p>
<p>This code expires in 24 hours.</p>
<p>If you didn't create an account, please ignore this email.</p>
```

## Role System

| Role | Level | Permissions |
|------|-------|-------------|
| viewer | 10 | Read-only access to own schedules |
| operator | 50 | Create/edit schedules, Zoom search |
| admin | 80 | Manage users and settings |
| super_admin | 100 | Full system control |

## Authentication Architecture

```
┌─────────────┐      ┌──────────────┐    ┌─────────────┐
│   Client    │ ───▶ │  Supabase    │───▶│  PostgreSQL │
│   (Tauri)   │      │  Auth + JWT  │    │  + RLS      │
└─────────────┘      └──────────────┘    └─────────────┘
       │                    │
       │  Custom Claims     │
       │  (user_role,       │
       │   hierarchy_level) │
       ▼                    ▼
   Reads from JWT    Auth Hook injects
   without RPC       claims on login
```

## Environment Variables

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxxx...
```

## Production Build

```bash
pnpm tauri build
```

The executable will be in `src-tauri/target/release/`.

## Security Features

- ✅ RLS enabled on all tables
- ✅ JWT Custom Claims (no extra queries per request)
- ✅ Privilege escalation prevention trigger
- ✅ SECURITY DEFINER with secure search_path
- ✅ Policies using `auth.jwt()` for performance