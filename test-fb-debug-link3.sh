#!/bin/bash

: "${API_KEY:?Set API_KEY before running this test}"
APP_URL="${NEXTAUTH_URL:-http://localhost:3000}"
BASE_URL="${APP_URL%/}/api/v1"

echo "=== Test Facebook Debug cho Link thứ 3 ==="
echo ""

# Lấy danh sách tất cả links
echo "1. Lấy danh sách links..."
RESPONSE=$(curl -s -H "Authorization: Bearer $API_KEY" "$BASE_URL/links")

echo "Response từ API:"
echo "$RESPONSE"
echo ""

# Parse link thứ 3 bằng grep và sed
LINK_ID=$(echo "$RESPONSE" | grep -o '"id":"[^"]*"' | sed -n '3p' | cut -d'"' -f4)
SHORT_CODE=$(echo "$RESPONSE" | grep -o '"shortCode":"[^"]*"' | sed -n '3p' | cut -d'"' -f4)

if [ -z "$LINK_ID" ]; then
  echo "❌ Không tìm thấy link thứ 3"
  exit 1
fi

echo "✅ Tìm thấy link thứ 3:"
echo "   - ID: $LINK_ID"
echo "   - Short Code: $SHORT_CODE"
echo ""

# Lấy chi tiết link
echo "2. Lấy chi tiết link..."
LINK_DETAIL=$(curl -s -H "Authorization: Bearer $API_KEY" "$BASE_URL/links/$LINK_ID")
echo "$LINK_DETAIL"
echo ""

# Lấy domain từ response
DOMAIN=$(echo "$LINK_DETAIL" | grep -o '"domain":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -z "$DOMAIN" ]; then
  SHORT_URL="${APP_URL%/}/$SHORT_CODE"
else
  SHORT_URL="https://$DOMAIN/$SHORT_CODE"
fi

echo "   - URL: $SHORT_URL"
echo ""

# Test Facebook scrape
echo "3. Trigger Facebook re-scrape..."
FB_SCRAPE_URL="https://graph.facebook.com/?id=${SHORT_URL}&scrape=true"

echo "   Đang gọi: $FB_SCRAPE_URL"
FB_RESPONSE=$(curl -s "$FB_SCRAPE_URL")

echo ""
echo "📊 Kết quả Facebook scrape:"
echo "$FB_RESPONSE"
echo ""

# Kiểm tra có error không
if echo "$FB_RESPONSE" | grep -q '"error"'; then
  echo "❌ Facebook scrape có lỗi"
else
  echo "✅ Facebook scrape hoàn tất"
fi

echo ""
echo "=== Hoàn tất ==="
