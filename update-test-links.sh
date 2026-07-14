#!/bin/bash

: "${API_KEY:?Set API_KEY before updating test links}"
BASE_URL="https://rutgonlink.site/api/v1"

# Get all test links
LINKS=$(curl -s -H "Authorization: Bearer $API_KEY" "$BASE_URL/links" | grep -o '"id":"cmozdq[^"]*"' | cut -d'"' -f4)

# Categories and their folder groups
CAT1="cmozdjsh2000q0hp112e6fmw9"  # Test Cat 1 -> Group 1
CAT2="cmozdjsu3000r0hp1hssataac"  # Test Cat 2 -> Group 2
CAT3="cmozdjt6d000s0hp1z8kwefos"  # Test Cat 3 -> Group 3

# Folders for each group
G1_FOLDERS='["cmozdkwwb000t0hp156bc6klw","cmozdpdop00100hp1hkqo59wl","cmozdpe3d00110hp128h5457c"]'
G2_FOLDERS='["cmozdpeeo00120hp1j42zrany","cmozdpers00130hp1xnr72pc7","cmozdpf5700140hp1moej0t3t"]'
G3_FOLDERS='["cmozdpfnd00150hp1uvb93y3s","cmozdpg5700160hp1xvtllxky","cmozdpgki00170hp1z64hx33x"]'

i=1
for LINK_ID in $LINKS; do
  # Distribute links across 3 categories
  CAT_INDEX=$((($i - 1) % 3))

  if [ $CAT_INDEX -eq 0 ]; then
    CAT_ID=$CAT1
    FOLDERS=$G1_FOLDERS
  elif [ $CAT_INDEX -eq 1 ]; then
    CAT_ID=$CAT2
    FOLDERS=$G2_FOLDERS
  else
    CAT_ID=$CAT3
    FOLDERS=$G3_FOLDERS
  fi

  echo "Updating link $i: $LINK_ID -> Category $((CAT_INDEX + 1))"

  # Update category and enable rotation
  curl -s -X PATCH -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
    -d "{\"categoryId\":\"$CAT_ID\",\"useFolderRotation\":true,\"folderRotationStartDate\":\"2026-05-01T00:00:00.000Z\"}" \
    "$BASE_URL/links/$LINK_ID" > /dev/null

  # Assign folders
  curl -s -X POST -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
    -d "{\"folderIds\":$FOLDERS}" \
    "$BASE_URL/links/$LINK_ID/folders" > /dev/null

  i=$((i + 1))
done

echo "Done updating $((i - 1)) links"
