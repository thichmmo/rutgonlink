#!/bin/bash

: "${API_KEY:?Set API_KEY before running this test}"
: "${FB_TOKEN:?Set FB_TOKEN before running this test}"
APP_URL="${NEXTAUTH_URL:-http://localhost:3000}"
BASE_URL="${APP_URL%/}/api/v1"
SHORT_URL="${SHORT_URL:-${APP_URL%/}/xem-tron-tap}"

echo "=== Test Facebook Debug với Token ==="
echo ""

# Bước 1: Thêm Facebook token vào hệ thống
echo "1. Thêm Facebook token vào hệ thống..."
ADD_TOKEN_RESPONSE=$(curl -s -X POST \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"label\":\"Test Token\",\"token\":\"$FB_TOKEN\"}" \
  "$BASE_URL/fb-debug")

echo "$ADD_TOKEN_RESPONSE"
echo ""

# Bước 2: Kiểm tra token có live không
echo "2. Kiểm tra tất cả tokens..."
CHECK_RESPONSE=$(curl -s -X PATCH \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"check-all"}' \
  "$BASE_URL/fb-debug")

echo "$CHECK_RESPONSE"
echo ""

# Bước 3: Test scrape link thứ 3
echo "3. Test scrape link thứ 3: $SHORT_URL"
SCRAPE_RESPONSE=$(curl -s -X PATCH \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"action\":\"scrape\",\"url\":\"$SHORT_URL\"}" \
  "$BASE_URL/fb-debug")

echo "$SCRAPE_RESPONSE"
echo ""

# Bước 4: Test với Facebook Graph API trực tiếp
echo "4. Test trực tiếp với Facebook Graph API..."
FB_DIRECT_URL="https://graph.facebook.com/?id=${SHORT_URL}&scrape=true&access_token=${FB_TOKEN}"
FB_DIRECT_RESPONSE=$(curl -s "$FB_DIRECT_URL")

echo "$FB_DIRECT_RESPONSE"
echo ""

# Kiểm tra kết quả
if echo "$SCRAPE_RESPONSE" | grep -q '"ok":true'; then
  echo "✅ Scrape thành công qua API"
else
  echo "❌ Scrape thất bại qua API"
fi

if echo "$FB_DIRECT_RESPONSE" | grep -q '"error"'; then
  echo "❌ Facebook Graph API trả về lỗi"
else
  echo "✅ Facebook Graph API thành công"
fi

echo ""
echo "=== Hoàn tất ==="
