# CloudSage – AI Ops Oracle for Solo Engineers

CloudSage is an AI-powered Ops assistant for solo developers and tiny teams.

You paste logs and infra signals.

CloudSage predicts near-term failure risk and gives you a short, practical action plan.

Built for **The AI Champion Ship – Vibe. Code. Ship.**

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

- Daily forecast with 3 concrete actions.

- History view and trend chart.

---

## Tech stack

- **Frontend:** Next.js + TypeScript + Tailwind CSS

- **Backend:** Raindrop MCP server (TypeScript)

- **AI / memory layer:** Raindrop SmartComponents

  - SmartBuckets for raw logs and forecasts

  - SmartSQL for risk history and feedback

  - SmartMemory for project and user patterns

  - SmartInference for risk forecast and action plans

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
  vultr/          # Scripts / terraform for Vultr resources
  deploy/         # Hosting config (Netlify / Vercel / etc.)
docs/
  ARCHITECTURE.md # System architecture and design
  BUILD_PLAN.md   # MVP build plan and phases
  SRS.md          # Software requirements specification
  DEMO_SCRIPT.md  # Demo walkthrough script
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
3. Copy `.env.example` to `.env` and fill in your keys
4. Follow the build plan in `docs/BUILD_PLAN.md`

### Development

```bash
# Run frontend
npm run dev:web

# Run backend API
npm run dev:api

# Run Vultr worker (local)
npm run dev:vultr-worker
```

---

## Documentation

- **[BUILD_PLAN.md](docs/BUILD_PLAN.md)** - Detailed MVP build plan with 7 phases
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System architecture and component design
- **[SRS.md](docs/SRS.md)** - Software requirements specification
- **[DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md)** - Demo walkthrough script

---

## License

MIT License - See [LICENSE](LICENSE) for details.

