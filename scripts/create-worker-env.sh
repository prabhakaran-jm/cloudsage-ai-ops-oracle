#!/bin/bash
# Create .env file for worker if it doesn't exist

WORKER_DIR="$HOME/cloudsage-ai-ops-oracle/services/vultr-worker"
ENV_FILE="$WORKER_DIR/.env"

echo "🔧 Creating .env file for Vultr Worker"
echo "========================================"
echo ""

if [ -f "$ENV_FILE" ]; then
    echo "✅ .env file already exists at: $ENV_FILE"
    echo ""
    echo "Current contents:"
    cat "$ENV_FILE"
    echo ""
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Keeping existing .env file"
        exit 0
    fi
fi

# Generate API key if not provided
API_KEY="${1:-90ccd4ced7150948cee67d6388452f8b732037b359874c9d41ee01413d065178}"

# Create .env file
cat > "$ENV_FILE" <<EOF
PORT=8080
API_KEY=$API_KEY
NODE_ENV=production
EOF

echo "✅ Created .env file at: $ENV_FILE"
echo ""
echo "Contents:"
cat "$ENV_FILE"
echo ""
echo "🔑 API Key: ${API_KEY:0:20}..."
echo ""
echo "Now restart the worker:"
echo "  cd $WORKER_DIR"
echo "  pm2 restart risk-worker"

