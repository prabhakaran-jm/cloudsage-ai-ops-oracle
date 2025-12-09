#!/bin/bash
# Quick script to update worker on server with dotenv fix

set -e

echo "🔄 Updating Vultr Worker with dotenv fix"
echo "========================================"
echo ""

# Navigate to worker directory
# Try multiple possible locations
if [ -d ~/cloudsage-ai-ops-oracle/services/vultr-worker ]; then
    cd ~/cloudsage-ai-ops-oracle/services/vultr-worker
elif [ -d /root/cloudsage-ai-ops-oracle/services/vultr-worker ]; then
    cd /root/cloudsage-ai-ops-oracle/services/vultr-worker
elif [ -d "$(dirname "$0")/../../services/vultr-worker" ]; then
    cd "$(dirname "$0")/../../services/vultr-worker"
else
    echo "❌ Worker directory not found. Cloning repository..."
    cd ~
    git clone https://github.com/YOUR_USERNAME/cloudsage-ai-ops-oracle.git
    cd cloudsage-ai-ops-oracle/services/vultr-worker
fi

# Pull latest code
echo "📥 Pulling latest code..."
git pull

# Install dependencies (including dotenv)
echo "📦 Installing dependencies..."
npm install

# Rebuild TypeScript
echo "🔨 Building TypeScript..."
npm run build

# Verify .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating..."
    cat > .env <<EOF
PORT=8080
API_KEY=90ccd4ced7150948cee67d6388452f8b732037b359874c9d41ee01413d065178
NODE_ENV=production
EOF
    echo "✅ Created .env file"
fi

# Restart PM2 process
echo "🔄 Restarting worker..."
pm2 restart risk-worker --update-env

# Wait a moment for restart
sleep 2

# Check status
echo ""
echo "📊 Worker Status:"
pm2 status risk-worker

# Test the worker
echo ""
echo "🧪 Testing worker endpoint..."
TEST_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:8080/score \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 90ccd4ced7150948cee67d6388452f8b732037b359874c9d41ee01413d065178" \
  -d '{
    "projectId": "test-update",
    "logs": [{"content": "ERROR: Test error", "timestamp": "2024-12-07T20:00:00Z"}]
  }')

HTTP_CODE=$(echo "$TEST_RESPONSE" | tail -n1)
BODY=$(echo "$TEST_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Worker test successful! (HTTP $HTTP_CODE)"
    echo "Response preview: $(echo "$BODY" | head -c 200)"
else
    echo "❌ Worker test failed: HTTP $HTTP_CODE"
    echo "Response: $BODY"
fi

echo ""
echo "✅ Update complete!"

