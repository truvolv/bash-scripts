#!/bin/bash
# ============================================================
# TruSpeed Search Reindex Script
#
# Uses the search plugin's built-in POST /api/search/reindex
# endpoint — the same one the "Reindex" button calls in the
# admin UI. Iterates over every organization and calls the
# endpoint once per org by setting the `payload-tenant` cookie,
# which scopes the reindex to that org's documents. This keeps
# each request small and well within Vercel's 60-second limit.
#
# Requires: curl, jq
#
# Usage:
#   PAYLOAD_URL=https://truspeed.io \
#   ADMIN_EMAIL=admin@example.com \
#   ADMIN_PASSWORD=yourpassword \
#   bash reindex-all-orgs.sh
#
# Optional:
#   LOCALE  - defaults to "en"
# ============================================================

set -euo pipefail

PAYLOAD_URL="${PAYLOAD_URL:-http://localhost:4000}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
LOCALE="${LOCALE:-en}"

# These must match the collections listed in truspeed-v2/src/plugin/SearchOptions.ts
COLLECTIONS_JSON='["pages","posts","page_templates","sites","modals","reusable_blocks","menus","media","locations","galleries","events","categories","reviews","team-members","tags"]'

if [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASSWORD" ]; then
  echo "ERROR: ADMIN_EMAIL and ADMIN_PASSWORD are required."
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo "ERROR: jq is required.  brew install jq  OR  apt-get install jq"
  exit 1
fi

echo "============================================"
echo " TruSpeed Search Reindex"
echo " Target: $PAYLOAD_URL"
echo "============================================"
echo ""

# ---- 1. Authenticate ----
echo "Authenticating as $ADMIN_EMAIL..."
AUTH_RESPONSE=$(curl -s -X POST "$PAYLOAD_URL/api/users/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

TOKEN=$(echo "$AUTH_RESPONSE" | jq -r '.token // empty')

if [ -z "$TOKEN" ]; then
  echo "ERROR: Login failed."
  echo "Response: $AUTH_RESPONSE"
  exit 1
fi

echo "Authenticated successfully."
echo ""

# ---- 2. Fetch all organization IDs ----
echo "Fetching organizations..."
ORGS_RESPONSE=$(curl -s "$PAYLOAD_URL/api/organizations?limit=1000&depth=0" \
  -H "Authorization: JWT $TOKEN")

mapfile -t ORG_IDS < <(echo "$ORGS_RESPONSE" | jq -r '.docs[].id')
ORG_COUNT=${#ORG_IDS[@]}

if [ "$ORG_COUNT" -eq 0 ]; then
  echo "ERROR: No organizations found (or failed to fetch)."
  echo "Response: $ORGS_RESPONSE"
  exit 1
fi

echo "Found $ORG_COUNT organizations."
echo ""

# ---- 3. Reindex each org ----
# The `payload-tenant` cookie tells the multi-tenant plugin to scope
# all queries to that org, so only that org's documents are reindexed.
CURRENT=0
FAILED=()

for ORG_ID in "${ORG_IDS[@]}"; do
  CURRENT=$((CURRENT + 1))
  echo -n "[$CURRENT/$ORG_COUNT] Reindexing org $ORG_ID ... "

  RESULT=$(curl -s -X POST "$PAYLOAD_URL/api/search/reindex?locale=$LOCALE" \
    -H "Content-Type: application/json" \
    -H "Authorization: JWT $TOKEN" \
    -H "Cookie: payload-tenant=$ORG_ID" \
    -d "{\"collections\": $COLLECTIONS_JSON}")

  MESSAGE=$(echo "$RESULT" | jq -r '.message // empty')

  if [ -n "$MESSAGE" ]; then
    echo "$MESSAGE"
  else
    echo "FAILED"
    echo "  Response: $RESULT"
    FAILED+=("$ORG_ID")
  fi
done

echo ""
echo "============================================"
echo " Done ($ORG_COUNT organizations processed)"
echo "============================================"

if [ ${#FAILED[@]} -gt 0 ]; then
  echo ""
  echo "WARNING: The following orgs failed and can be retried:"
  for ORG in "${FAILED[@]}"; do
    echo ""
    echo "  curl -X POST $PAYLOAD_URL/api/search/reindex?locale=$LOCALE \\"
    echo "    -H 'Content-Type: application/json' \\"
    echo "    -H 'Authorization: JWT \$TOKEN' \\"
    echo "    -H 'Cookie: payload-tenant=$ORG' \\"
    echo "    -d '{\"collections\": $COLLECTIONS_JSON}'"
  done
fi
