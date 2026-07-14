#!/bin/bash

: "${API_KEY:?Set API_KEY before checking tokens}"
BASE_URL="https://rutgonlink.site/api/v1"

echo "=== Kiểm tra tất cả tokens ==="
echo ""

# Lấy danh sách tokens
TOKENS_RESPONSE=$(curl -s -H "Authorization: Bearer $API_KEY" "$BASE_URL/fb-debug")

echo "Danh sách tokens:"
echo "$TOKENS_RESPONSE" | grep -o '"label":"[^"]*","masked":"[^"]*","addedAt":"[^"]*","status":"[^"]*"' | while read line; do
  LABEL=$(echo "$line" | grep -o '"label":"[^"]*"' | cut -d'"' -f4)
  MASKED=$(echo "$line" | grep -o '"masked":"[^"]*"' | cut -d'"' -f4)
  STATUS=$(echo "$line" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

  echo "  - $LABEL: $MASKED [$STATUS]"
done

echo ""
echo "Tổng số tokens:"
TOKEN_COUNT=$(echo "$TOKENS_RESPONSE" | grep -o '"id":"[^"]*"' | wc -l)
echo "  Total: $TOKEN_COUNT"

LIVE_COUNT=$(echo "$TOKENS_RESPONSE" | grep -o '"status":"live"' | wc -l)
echo "  Live: $LIVE_COUNT"

echo ""
echo "⚠️  Tất cả tokens đang bị rate limit tạm thời"
echo "    Giải pháp:"
echo "    1. Đợi 15-30 phút để Facebook bỏ block"
echo "    2. Thêm token mới chưa bị block"
echo "    3. Giảm tần suất scrape trong settings"

echo ""
echo "=== Hoàn tất ==="
