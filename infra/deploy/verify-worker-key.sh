#!/bin/bash
# Verify worker API key and test connection

WORKER_URL="${VULTR_WORKER_URL:-http://192.248.166.170:8080}"
EXPECTED_KEY="${VULTR_API_KEY:-90ccd4ced7150948cee67d6388452f8b732037b359874c9d41ee01413d065178}"

echo "Testing Worker API Key"
echo "======================"
echo ""
echo "Worker URL: $WORKER_URL"
echo "Testing with API Key: ${EXPECTED_KEY:0:20}..."
echo ""

# Test health (no auth)
echo "1. Testing health endpoint (no auth)..."
HEALTH=$(curl -s "$WORKER_URL/health")
if echo "$HEALTH" | grep -q "ok"; then
    echo "   ✅ Health check passed"
else
    echo "   ❌ Health check failed"
    exit 1
fi

echo ""

# Test score with Bearer token
echo "2. Testing score endpoint with Bearer token..."
SCORE_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WORKER_URL/score" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $EXPECTED_KEY" \
  -d '{
    "projectId": "test-123",
    "logs": [
      {"content": "ERROR: Test error", "timestamp": "2024-12-07T20:00:00Z"}
    ]
  }')

HTTP_CODE=$(echo "$SCORE_RESPONSE" | tail -n1)
BODY=$(echo "$SCORE_RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Score endpoint works with Bearer token"
    echo "   Response: $BODY" | head -c 200
    echo ""
else
    echo "   ❌ Score endpoint failed: HTTP $HTTP_CODE"
    echo "   Response: $BODY"
fi

echo ""

# Test score with X-API-Key header
echo "3. Testing score endpoint with X-API-Key header..."
SCORE_RESPONSE2=$(curl -s -w "\n%{http_code}" -X POST "$WORKER_URL/score" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $EXPECTED_KEY" \
  -d '{
    "projectId": "test-123",
    "logs": [
      {"content": "ERROR: Test error", "timestamp": "2024-12-07T20:00:00Z"}
    ]
  }')

HTTP_CODE2=$(echo "$SCORE_RESPONSE2" | tail -n1)
BODY2=$(echo "$SCORE_RESPONSE2" | sed '$d')

if [ "$HTTP_CODE2" = "200" ]; then
    echo "   ✅ Score endpoint works with X-API-Key header"
    echo "   Response: $BODY2" | head -c 200
    echo ""
else
    echo "   ❌ Score endpoint failed: HTTP $HTTP_CODE2"
    echo "   Response: $BODY2"
fi

echo ""
echo "If both failed, the API key on the worker doesn't match."
echo "Check the worker's .env file on the server."

