# Vultr Worker Service

Risk scoring worker service running on Vultr Cloud Compute.

## Overview

This service processes logs and infrastructure signals to generate risk scores and forecasts.

## Quick Start

### Local Development

```bash
npm install
npm run dev
# Worker runs on http://localhost:8080
```

### Deploy to Vultr

**Quick deploy script** (run on Vultr instance):
```bash
chmod +x deploy.sh
./deploy.sh
```

## API Endpoints

- `GET /health` - Health check (no auth required)
- `POST /score` - Calculate risk score (requires API key)

## Environment Variables

- `PORT` - Server port (default: 8080)
- `API_KEY` - Authentication key (required for /score endpoint)
- `NODE_ENV` - Environment (development/production)

## Usage

After deployment, set in backend `.env`:
```env
VULTR_WORKER_URL=http://YOUR_VULTR_IP:8080
VULTR_API_KEY=your-api-key-from-worker
```

