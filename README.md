# CloudSage – AI Ops Oracle for Solo Engineers

> **✅ STATUS UPDATE (Dec 8, 2025):** Critical auth bug fixed! Email normalization now working. All features tested and functional. Ready for hackathon demo! 🎉

CloudSage is an AI-powered Ops assistant for solo developers and tiny teams.
You paste logs and infra signals.
CloudSage predicts near-term failure risk and gives you a short, practical action plan.
Built for **The AI Champion Ship – Vibe. Code. Ship.**

## 🚀 Live Demo

- **Frontend:** https://steady-melomakarona-42c054.netlify.app
- **Backend API:** https://cloudsage-api.01k844rvnc9e5n807arvr4wn0t.lmapp.run
- **Demo Video:** [Coming soon]

Try it now! Register an account and start analyzing your logs.

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

## Tech stack

- **Frontend:** Next.js + TypeScript + Tailwind CSS
- **Backend:** Raindrop MCP server (TypeScript)
- **AI / memory layer:** Raindrop SmartComponents
  - SmartBuckets for raw logs and forecasts
  - SmartSQL for risk history and feedback
  - SmartMemory for project baselines and learning
  - SmartInference for AI-powered forecast generation
- **Compute:** Vultr Cloud Compute / GPU for risk scoring worker
- **Auth (MVP):** Email + password
- **Payments (optional later):** Stripe

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

