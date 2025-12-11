# CloudSage – AI Ops Oracle for Solo Engineers

> **🤖 Your AI SRE that never sleeps.** CloudSage transforms noisy logs into actionable risk forecasts.

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://steady-melomakarona-42c054.netlify.app)
[![Built on Raindrop](https://img.shields.io/badge/built%20on-Raindrop-purple)](https://raindrop.run)
[![Powered by Vultr](https://img.shields.io/badge/powered%20by-Vultr-007BFC)](https://vultr.com)

CloudSage is an AI-powered Ops assistant for solo developers and tiny teams.
Paste your logs → Get a risk score → See AI-powered forecasts → Take action.
Built for **The AI Champion Ship** hackathon.

## 🚀 Live Demo

| Component | URL |
|-----------|-----|
| **Frontend** | https://steady-melomakarona-42c054.netlify.app |
| **Backend API** | https://cloudsage-api.01kbv4q1d3d0twvhykd210v58w.lmapp.run/api |
| **Demo Video** | [Watch on YouTube](https://youtube.com/watch?v=COMING_SOON) |

**Try it now!** Register an account and use "Load Sample Logs" for instant demo.

## 📸 Screenshots

<p align="center">
  <img src="docs/images/dashboard.png" alt="Risk Dashboard" width="45%">
  <img src="docs/images/forecast.png" alt="AI Forecast" width="45%">
</p>

<p align="center">
  <img src="docs/images/action-items.png" alt="Action Items" width="45%">
  <img src="docs/images/history.png" alt="Historical Trends" width="45%">
</p>

---

## Problem

Solo engineers run production systems without an SRE team.

They see:
- growing error rates
- rising latency
- noisy logs

They lack:
- a clear risk score
- early warning
- a small action list for each day

CloudSage turns yesterday's signals into tomorrow's risk forecast.

---

## High level features

- Project-based view of your services.
- Log and signal ingest for each project.
- Vultr-backed risk analysis service.
- Risk score (0–100) with top risk labels.
- AI-powered daily forecast with 3 concrete actions (SmartInference).
- History view and trend chart.
- Learning project patterns over time (SmartMemory).

---

## 🛠️ Tech Stack

### Core Platform
| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 14 + TypeScript + Tailwind CSS |
| **Backend** | Raindrop Platform (TypeScript) |
| **Compute** | Vultr Cloud Compute |
| **Deployment** | Raindrop + Netlify |

### Raindrop SmartComponents (✅ All Four Used!)
| Component | Usage in CloudSage |
|-----------|-------------------|
| **SmartBuckets** | Store logs, forecasts, project data with AI-powered search |
| **SmartSQL** | Risk history, user data, trend analysis |
| **SmartMemory** | Project baselines, pattern learning |
| **SmartInference** | AI-powered forecast generation |

### Vultr Integration
- **Vultr Cloud Compute** - Risk scoring engine with real-time analysis
- Custom API worker for log analysis and pattern detection
- Health monitoring with latency tracking visible in UI

### Authentication (WorkOS)
- **Enterprise SSO** via WorkOS AuthKit
- Supports SAML, OIDC, Google, Microsoft, and more
- MFA and directory sync ready
- Free tier: up to 1M monthly active users

**Required Environment Variables:**
- `WORKOS_CLIENT_ID` - Your WorkOS client ID
- `WORKOS_API_KEY` - Your WorkOS API key
- `WORKOS_REDIRECT_URI` - Callback URL (e.g., `https://your-app.netlify.app/api/auth/callback`)
- `WORKOS_COOKIE_PASSWORD` - **Required**: At least 32 characters for session encryption
  - Generate with: `openssl rand -base64 32` or `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

**WorkOS Dashboard Setup (Required):**

### Step 0: Enable AuthKit (IMPORTANT!)
**⚠️ CloudSage uses AuthKit, NOT SSO!** Make sure you're configuring AuthKit, not SSO.

1. Go to https://dashboard.workos.com
2. In the left sidebar, look for **"AuthKit"** (not "SSO")
3. If you see "Set up AuthKit" button, click it and follow the setup wizard
4. If AuthKit is already set up, you should see the AuthKit dashboard
5. **Important:** The Client ID you use must be from an **AuthKit application**, not an SSO application

### Step 1: Get Your Client ID and API Key
1. Go to https://dashboard.workos.com
2. Click on "Developer" in the left sidebar → "API Keys"
   - Or go directly to: https://dashboard.workos.com/developer/api-keys
3. Your **Client ID** (starts with `client_`) and **API Key** (starts with `sk_`) are shown here
4. **Copy these values** - you'll need them for Netlify environment variables
5. **Verify:** Make sure this Client ID is associated with AuthKit, not SSO

### Step 2: Create an Organization
1. Click "Organizations" in the left sidebar
2. Click "Create Organization"
3. Name it (e.g., "CloudSage Users")
4. **Important:** Note the Organization ID (you'll see it in the URL or organization details)

### Step 3: Configure AuthKit Redirect URI
1. Go to **"AuthKit"** in the left sidebar (NOT "SSO" or "Configuration")
2. Click on **"Redirects"** or **"Configuration"** within AuthKit
3. **Add Redirect URI:**
   - Find the "Redirect URIs" section
   - Click "Add Redirect URI" or "Add"
   - Enter exactly: `https://steady-melomakarona-42c054.netlify.app/api/auth/callback`
   - **Must match EXACTLY** (including `https://` and no trailing slash)
   - Click "Save"
4. **Configure Sign-in Endpoint (Optional but recommended):**
   - In the same Redirects section, set "Sign-in endpoint" to: `https://steady-melomakarona-42c054.netlify.app/api/auth/signin`
   - This helps WorkOS redirect users properly

### Step 4: Enable Authentication Methods in AuthKit
1. Still in the **AuthKit** section, go to **"Authentication"** or **"Settings"**
2. **Enable Authentication Method:**
   - Find "Authentication Methods" or "Sign-in Methods"
   - Enable **"Email Magic Link"** (easiest for testing)
   - Or configure OAuth providers (Google, Microsoft, etc.)
   - **Note:** Make sure you're configuring AuthKit methods, not SSO methods

### Step 5: Link Organization to Application
1. Go to "Organizations" → Click on your organization
2. Check that it's active and properly configured
3. The organization should automatically be available to your AuthKit application

### Step 6: Add Users to Organization
1. Go to "Organizations" → Your Organization → "Members" tab
2. Click "Add User" or "Invite User"
3. Add your email address
4. The user will receive an invitation (if using invite) or can sign in immediately (if using Email Magic Link)

### Step 6: Set Environment Variables in Netlify
1. Go to your Netlify site dashboard
2. Site settings → Environment variables
3. Add these variables:
   - `WORKOS_CLIENT_ID` = Your Client ID (from Step 1)
   - `WORKOS_API_KEY` = Your API Key (from Step 1)
   - `WORKOS_REDIRECT_URI` = `https://steady-melomakarona-42c054.netlify.app/api/auth/callback`
   - `WORKOS_COOKIE_PASSWORD` = Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
   - `NEXT_PUBLIC_WORKOS_ENABLED` = `true`
4. **Redeploy your site** after adding environment variables

**Troubleshooting:**
- **500 Error on sign-in** → Most likely: Application not created or environment variables not set in Netlify
- **"Couldn't sign in" error** → **Most common cause:** Organization not created or user not added to organization
- **Redirect URI mismatch** → Verify the URI matches EXACTLY (case-sensitive, no trailing slash) in WorkOS dashboard
- **User not found** → Ensure your email is added to the organization (Step 5)
- **Cookie password error** → Generate a new 32+ character password: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- **Environment variables not working** → Make sure you redeployed Netlify after adding them
- **Quick test:** Visit `/auth/debug` for diagnostics

---

## Monorepo layout

```text
apps/
  web/            # Next.js frontend
  api/            # Raindrop-backed API
services/
  vultr-worker/   # Vultr risk model service
infra/
  deploy/         # Deployment scripts and tests
  vultr/          # Vultr infrastructure (Terraform)
    terraform/    # Terraform configurations
docs/
  ARCHITECTURE.md # System architecture and design
```

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Raindrop account and API key 
- Vultr account (for worker deployment)

### Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `apps/api/.env.example` to `apps/api/.env` and fill in your keys:
   - `RAINDROP_API_KEY` - Your Raindrop API key
   - `RAINDROP_MCP_URL` - Raindrop MCP server URL (default: http://localhost:3002)
   - `VULTR_WORKER_URL` - Your Vultr worker URL (optional)
4. See `docs/ARCHITECTURE.md` for Raindrop SmartComponents setup

### Development

```bash
# Run frontend
npm run dev:web

# Run backend API
npm run dev:api

# Run Vultr worker (local)
npm run dev:vultr-worker
```

### Deployment

See **[infra/deploy/DEPLOYMENT_GUIDE.md](infra/deploy/DEPLOYMENT_GUIDE.md)** for complete deployment instructions.

**Quick deploy:**
```bash
# Deploy Vultr worker
./infra/deploy/deploy-vultr-worker.sh

# Deploy backend to Raindrop
./infra/deploy/deploy-raindrop.sh

# Deploy frontend to Netlify
cd apps/web && netlify deploy --prod
```

---

## Documentation

- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System architecture and component design
- **[AI_ASSISTANT_USAGE.md](docs/AI_ASSISTANT_USAGE.md)** - How Claude Code and Gemini CLI were used in development
- **[DEPLOYMENT_GUIDE.md](infra/deploy/DEPLOYMENT_GUIDE.md)** - Complete deployment instructions
- **[Infrastructure README](infra/README.md)** - Infrastructure overview and setup


---

## Hackathon Submission

Built for **The AI Champion Ship** hackathon by LiquidMetal AI.

**Track:** Best Small Startup Agents

**Technology:**
- Raindrop Platform (SmartBuckets, SmartSQL, SmartMemory, SmartInference)
- Vultr Cloud Compute (Risk scoring worker)
- Next.js + TypeScript + Tailwind CSS
- Deployed on Netlify + Raindrop

## License

MIT License - See [LICENSE](LICENSE) for details.

