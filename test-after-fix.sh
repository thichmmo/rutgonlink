#!/bin/bash

: "${API_KEY:?Set API_KEY before running this test}"
APP_URL="${NEXTAUTH_URL:-http://localhost:3000}"
BASE_URL="${APP_URL%/}/api/v1"
SHORT_URL="${SHORT_URL:-${APP_URL%/}/xem-tron-tap}"

echo "=== Test Facebook Debug sau khi fix ==="
echo ""

echo "1. Test scrape link thứ 3 qua API..."
SCRAPE_RESPONSE=$(curl -s -X PATCH \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"action\":\"scrape\",\"url\":\"$SHORT_URL\"}" \
  "$BASE_URL/fb-debug")

echo "$SCRAPE_RESPONSE"
echo ""

# Parse kết quả
if echo "$SCRAPE_RESPONSE" | grep -q '"ok":true'; then
  echo "✅ Scrape thành công!"

  # Hiển thị thông tin
  TITLE=$(echo "$SCRAPE_RESPONSE" | grep -o '"title":"[^"]*"' | cut -d'"' -f4)
  DESC=$(echo "$SCRAPE_RESPONSE" | grep -o '"description":"[^"]*"' | cut -d'"' -f4)

  if [ -n "$TITLE" ]; then
    echo "   Title: $TITLE"
  fi
  if [ -n "$DESC" ]; then
    echo "   Description: $DESC"
  fi
else
  echo "❌ Scrape thất bại"
  ERROR_MSG=$(echo "$SCRAPE_RESPONSE" | grep -o '"message":"[^"]*"' | head -1 | cut -d'"' -f4)
  ERROR_CODE=$(echo "$SCRAPE_RESPONSE" | grep -o '"errorCode":[0-9]*' | head -1 | cut -d':' -f2)

  if [ -n "$ERROR_CODE" ]; then
    echo "   Error Code: $ERROR_CODE"
  fi
  if [ -n "$ERROR_MSG" ]; then
    echo "   Message: $ERROR_MSG"
  fi
fi

echo ""
echo "=== Hoàn tất ==="
