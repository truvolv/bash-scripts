# Search Reindex All Orgs

## Purpose
This script reindexes the Payload search collection for every organization. It's needed when first introducing the search plugin to production, or any time new collections or fields are added to the search index and existing documents need to be re-synced.

It uses the search plugin's built-in `POST /api/search/reindex` endpoint (the same one the "Reindex" button in the admin UI triggers). Rather than clicking through 200+ organizations manually, the script fetches all org IDs and calls the endpoint once per org, using the `payload-tenant` cookie to scope each reindex to that org's documents. This keeps each request small and within Vercel's 60-second function timeout.

## Requirements
- `curl`
- `jq` — install with `brew install jq`

## Setup
No install step needed. Just ensure `curl` and `jq` are available.

## Use

### Reindex all organizations
```bash
PAYLOAD_URL=https://cms.truspeed.io \
ADMIN_EMAIL=admin@example.com \
ADMIN_PASSWORD=yourpassword \
bash search-reindex-all-orgs/reindex-all-orgs.sh
```

### Optional environment variables
| Variable | Default | Description |
|---|---|---|
| `PAYLOAD_URL` | `http://localhost:4000` | Base URL of the TruSpeed CMS |
| `LOCALE` | `en` | Locale passed to the reindex endpoint |

### Retry a single org
If an org fails, the script prints a ready-to-run curl command at the end. You'll need a fresh JWT token — get one by re-running the login call:

```bash
TOKEN=$(curl -s -X POST https://cms.truspeed.io/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"yourpassword"}' | jq -r '.token')

curl -X POST "https://cms.truspeed.io/api/search/reindex?locale=en" \
  -H "Content-Type: application/json" \
  -H "Authorization: JWT $TOKEN" \
  -H "Cookie: payload-tenant=<org-id>" \
  -d '{"collections": ["pages","posts","page_templates","sites","modals","reusable_blocks","menus","media","locations","galleries","events","categories","reviews","team-members","tags"]}'
```

## Notes
- The script is idempotent — safe to run multiple times. It will update existing search entries rather than duplicate them.
- If collections are added to or removed from `truspeed-v2/src/plugin/SearchOptions.ts`, update the `COLLECTIONS_JSON` variable at the top of the script to match.
- The script processes orgs sequentially. With 200+ orgs it will take a few minutes to complete.
