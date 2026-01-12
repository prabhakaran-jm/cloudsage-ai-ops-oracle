# CloudSage – AI Ops Oracle for Solo Engineers

> **🤖 Your AI SRE that never sleeps.** CloudSage transforms noisy logs into actionable risk forecasts.

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://steady-melomakarona-42c054.netlify.app)
[![Built on Raindrop](https://img.shields.io/badge/built%20on-Raindrop-purple)](https://raindrop.run)
[![Powered by Vultr](https://img.shields.io/badge/powered%20by-Vultr-007BFC)](https://vultr.com)

## One-Line Pitch
CloudSage transforms noisy logs into actionable risk forecasts with AI-powered pattern learning, giving solo engineers an SRE assistant that predicts tomorrow's problems today.

## The Problem We Solve
Solo engineers and tiny teams run production systems without SRE expertise or monitoring budgets. They face:
- Growing error rates with no clear risk assessment
- Noisy logs that take hours to analyze
- Reactive firefighting instead of proactive prevention
- No early warning system for cascading failures

**Result:** 2am pages, burnt-out founders, and preventable downtime.

## Our Solution
CloudSage is an AI-powered ops assistant that:

1. **Ingests logs** (paste, upload, or sample data)
2. **Calculates risk score** (0-100) via Vultr cloud compute
3. **Generates AI forecast** with SmartInference chain branching
4. **Recommends 3 concrete actions** (specific times, metrics, fixes)
5. **Learns patterns** with SmartMemory to improve over time

### Why It's Different
- **Forecasting, not just alerting** - Predicts tomorrow's risk, not just today's errors
- **Context-aware AI chains** - Chooses emergency, preventive, or standard analysis based on your situation
- **Transparent reasoning** - Shows exactly why it made each recommendation
- **Pattern learning** - Gets smarter about your stack with every forecast
- **Production-ready** - Auth, payments, tests, deployed live

## Tech Stack - Deep Raindrop + Vultr Integration

### Raindrop Platform (All 4 SmartComponents Used Meaningfully!)

**SmartBuckets** - Intelligent log storage
- Hierarchical key structure (`projectId/timestamp/logId`)
- Forecast caching with 24-hour TTL
- Context sampling for historical analysis (last 10 logs)
- Native API with MCP fallback for resilience

**SmartSQL** - Production-grade analytics
- 3 tables: users, projects, risk_history
- Complex trend analysis (7-day rolling averages, slope calculations)
- Proper indexes and parameter interpolation
- Transaction safety with graceful fallbacks

**SmartMemory** - AI that learns
- User preferences (alert thresholds, ignored patterns)
- Action completion tracking (learns which actions you prioritize)
- Project baselines (30-score rolling averages for anomaly detection)
- Cross-session persistence for continuous improvement

**SmartInference** - Advanced AI orchestration
- **Chain branching** - Dynamically selects AI path:
  - 🚨 Critical (score ≥70): Emergency response chain
  - 📈 Preventive (rising + score >50): 7-day lookahead
  - ✓ Standard: Normal forecast generation
- Multi-step chains visible in UI (transparent AI reasoning)
- Confidence scoring based on data quality
- Heuristic fallback for resilience

### Vultr Integration - Real Infrastructure

**Vultr Cloud Compute** - Risk scoring worker
- Custom Node.js service analyzing 5 risk factors:
  - Error rate (40 points max)
  - Log volume (25 points)
  - Latency indicators (20 points)
  - Memory pressure (10 points)
  - CPU usage (5 points)
- 142ms average latency (visible in UI)
- Health monitoring with automatic retries
- Fallback to local calculation if unavailable

**Proof of integration:**
- Live status badge showing latency + timestamp
- Infrastructure as code (Terraform in `/infra/vultr/`)
- Retry logic with exponential backoff
- Used on every log ingestion (real, not decorative)

### Production Features

**WorkOS AuthKit** - Enterprise-ready authentication
- Email magic links, OAuth (Google/Microsoft), SAML/OIDC
- Passwordless account detection
- MFA and directory sync ready
- 1M MAU free tier

**Stripe** - Payment processing
- Checkout flow with JIT user provisioning
- Pro plan ($29/month) for paid features
- Webhook infrastructure for subscription management

**Security & Reliability**
- Authorization guards (`ensureProjectAccess` middleware)
- Rate limiting (100 req/min ingest, 60 req/min forecast)
- Friendly error messages (SQL constraints → user-facing)
- Unit test coverage (5 core tests, integration suite)

## Live Demo & Code
- **Frontend:** https://steady-melomakarona-42c054.netlify.app
- **Backend API:** https://cloudsage-api.01kbv4q1d3d0twvhykd210v58w.lmapp.run/api
- **GitHub:** https://github.com/prabhakaran-jm/cloudsage-ai-ops-oracle
- **Demo Video:** https://www.youtube.com/watch?v=L55Yf8C7uY0

**Try it now:** Click "Load Sample Logs" for instant demo (no setup required)

## Target Users & Impact

**Who needs this:**
- Solo founders running production apps (500-100k users)
- Indie hackers with paying customers
- Startup CTOs with 2-5 person engineering teams
- Freelance developers managing client infrastructure

**Measurable impact:**
- **Time saved:** 2-4 hours/week on log analysis
- **Incidents prevented:** 6-24 hour early warning
- **Stress reduced:** Sleep through the night
- **Cost saved:** No $200/hr SRE consultants needed

## Technical Highlights for Judges

### Raindrop Depth
✅ All 4 SmartComponents used meaningfully (not decorative)
✅ SmartInference chain branching (shows AI orchestration mastery)
✅ SmartMemory pattern learning (continuous improvement)
✅ SmartSQL complex analytics (trend slopes, aggregations)
✅ SmartBuckets context sampling (programmatic data access)
✅ 1,360+ lines of Raindrop integration code

### Vultr Depth
✅ Custom worker service (not just API calls)
✅ Real-time latency visible in UI (proof of integration)
✅ Infrastructure as code (Terraform)
✅ Retry logic + fallback for resilience
✅ Used on every request (real compute, not decorative)

### Launch Quality
✅ Deployed live (Netlify + Raindrop + Vultr)
✅ WorkOS auth + Stripe payments
✅ Unit tests + integration suite
✅ Rate limiting + authorization guards
✅ Error handling + loading states
✅ Comprehensive documentation

## What's Next (Post-Hackathon Roadmap)
- Real-time log streaming with Vultr Valkey (Redis-compatible)
- Slack/Discord notifications for critical alerts
- Multi-project dashboards and team management
- Auto-remediation suggestions (AI-generated code fixes)
- Mobile app for on-the-go monitoring

## Feedback on Raindrop & Vultr

### What Worked Brilliantly
**Raindrop:**
- SmartInference chain transparency made debugging easy
- SmartMemory pattern learning was intuitive to implement
- SmartSQL's flexibility (native + MCP fallback) saved us
- Documentation was comprehensive

**Vultr:**
- Cloud Compute spin-up was instant
- Pricing is competitive for hackathon/startup budgets
- Terraform support made IaC easy

### What Could Be Better
**Raindrop:**
- More examples of SmartBuckets AI search (we implemented sampling instead)
- Chain branching examples in docs would help
- SmartMemory with vector embeddings for semantic search

**Vultr:**
- Valkey (Redis-compatible) setup guide would be helpful
- Global latency optimization patterns
- More managed service examples (Kafka, databases)

## Team & Development
- **Solo developer:** Built for The AI Champion Ship 2025
- **Development time:** 7 days (Dec 5-12, 2025)
- **AI assistance:** Claude Code (codebase architecture), Gemini CLI (debugging)
- **Lines of code:** ~4,500 (TypeScript + React)
- **Track:** Best Small Startup Agents

## Setup & Deployment

### Prerequisites
- Node.js 18+ and npm
- Raindrop account and API key 
- Vultr account (for worker deployment)
- WorkOS account (for authentication)
- Stripe account (optional, for payments)

### Environment Variables

**Raindrop (Backend):**
- `RAINDROP_API_KEY` - Your Raindrop API key
- `RAINDROP_MCP_URL` - Raindrop MCP server URL (default: http://localhost:3002)
- `VULTR_WORKER_URL` - Your Vultr worker URL
- `VULTR_API_KEY` - Vultr worker API key
- `JWT_SECRET` - Secret for JWT token signing

**WorkOS (Authentication):**
- `WORKOS_CLIENT_ID` - Your WorkOS client ID
- `WORKOS_API_KEY` - Your WorkOS API key
- `WORKOS_REDIRECT_URI` - Callback URL
- `WORKOS_COOKIE_PASSWORD` - At least 32 characters for session encryption

**Stripe (Payments - Optional):**
- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `STRIPE_PUBLISHABLE_KEY` - Your Stripe publishable key
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Same as publishable key (for frontend)
- `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID` - Stripe Price ID for Pro plan

### Development

```bash
# Install dependencies
npm install

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
raindrop build deploy --start --amend

# Deploy frontend to Netlify
cd apps/web && netlify deploy --prod
```

## Documentation
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - System architecture and component design
- **[AI_ASSISTANT_USAGE.md](docs/AI_ASSISTANT_USAGE.md)** - How Claude Code and Gemini CLI were used in development
- **[DEPLOYMENT_GUIDE.md](infra/deploy/DEPLOYMENT_GUIDE.md)** - Complete deployment instructions
- **[Infrastructure README](infra/README.md)** - Infrastructure overview and setup

## License & Contact
- **License:** MIT
- **GitHub:** https://github.com/prabhakaran-jm/cloudsage-ai-ops-oracle
- **Demo:** https://steady-melomakarona-42c054.netlify.app

---

Built with ❤️ for **The AI Champion Ship 2025** using LiquidMetal AI(Raindrop), Vultr, WorkOS, Stripe, Netlify, Cloudflare.


