#!/bin/bash

: "${FB_TOKEN:?Set FB_TOKEN before running this test}"
SHORT_URL="https://rutgonlink.site/xem-tron-tap"

echo "=== Test Facebook Sharing Debugger API ==="
echo ""

# Endpoint đúng cho scraping
SCRAPE_URL="https://graph.facebook.com/v21.0/?id=$(echo $SHORT_URL | sed 's/:/%3A/g' | sed 's/\//%2F/g')&scrape=true&access_token=$FB_TOKEN"

echo "Đang gọi Facebook Sharing Debugger..."
echo ""

RESPONSE=$(curl -s "$SCRAPE_URL")
echo "$RESPONSE"
echo ""

if echo "$RESPONSE" | grep -q '"error"'; then
  echo "❌ Có lỗi xảy ra"
  ERROR_MSG=$(echo "$RESPONSE" | grep -o '"message":"[^"]*"' | head -1 | cut -d'"' -f4)
  ERROR_CODE=$(echo "$RESPONSE" | grep -o '"code":[0-9]*' | head -1 | cut -d':' -f2)
  echo "   Error Code: $ERROR_CODE"
  echo "   Message: $ERROR_MSG"
else
  echo "✅ Scrape thành công!"
  echo ""
  echo "Thông tin đã scrape:"
  echo "$RESPONSE" | grep -o '"og:title":"[^"]*"' | cut -d'"' -f4
  echo "$RESPONSE" | grep -o '"og:description":"[^"]*"' | cut -d'"' -f4
fi
