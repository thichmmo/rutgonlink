#!/bin/bash

: "${API_KEY:?Set API_KEY before running this test}"
APP_URL="${NEXTAUTH_URL:-http://localhost:3000}"
BASE_URL="${APP_URL%/}/api/v1"

echo "=== Test với link khác ==="
echo ""

# Lấy link đầu tiên thay vì link thứ 3
echo "1. Lấy link đầu tiên..."
RESPONSE=$(curl -s -H "Authorization: Bearer $API_KEY" "$BASE_URL/links")
LINK_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
SHORT_CODE=$(echo "$RESPONSE" | grep -o '"shortCode":"[^"]*"' | head -1 | cut -d'"' -f4)

echo "   Link ID: $LINK_ID"
echo "   Short Code: $SHORT_CODE"
echo ""

SHORT_URL="${APP_URL%/}/$SHORT_CODE"

echo "2. Test scrape: $SHORT_URL"
SCRAPE_RESPONSE=$(curl -s -X PATCH \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"action\":\"scrape\",\"url\":\"$SHORT_URL\"}" \
  "$BASE_URL/fb-debug")

echo "$SCRAPE_RESPONSE"
echo ""

if echo "$SCRAPE_RESPONSE" | grep -q '"ok":true'; then
  echo "✅ Scrape thành công với endpoint v21.0!"
else
  ERROR_CODE=$(echo "$SCRAPE_RESPONSE" | grep -o '"errorCode":[0-9]*' | head -1 | cut -d':' -f2)
  if [ "$ERROR_CODE" = "368" ]; then
    echo "⚠️  Token bị block tạm thời (Error 368)"
    echo "    Cần đợi vài phút hoặc dùng token khác"
  else
    echo "❌ Scrape thất bại với error code: $ERROR_CODE"
  fi
fi

echo ""
echo "=== Hoàn tất ==="
