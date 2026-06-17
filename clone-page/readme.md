# clone-page

Copies a Payload CMS page from one TruSpeed environment to another (local ↔ QA ↔ prod), recursively cloning all relationship dependencies so the page works correctly in the destination.

## What it handles

| Relationship | Treatment |
|---|---|
| `forms` | Cloned (with form integration) |
| `form-integrations` | Cloned |
| `reusable_blocks` | Cloned (recursively, including any nested forms) |
| `page_templates` | Cloned (including their layout blocks) |
| `media` | Downloaded and re-uploaded to destination |
| `galleries` | Cloned |
| `locations` | Cloned |
| `sites` | Matched by slug (must already exist in destination) |
| `categories` / `tags` | Matched by slug (must already exist in destination) |
| `reviews` / `menus` / `team-members` | Skipped (relationship dropped) |

All cloned documents are suffixed with the source environment label, e.g. `"My Form (Prod clone)"`. This makes them easy to identify in the admin UI and prevents duplicate conflicts on subsequent runs (the script will prompt you to reuse or duplicate if a suffixed document already exists).

## Setup

Add to your `.env.local`:

```
PROD_PL_TOKEN=<your prod API key>
QA_PL_TOKEN=<your QA API key>
LOCAL_PL_TOKEN=<your local API key>

# Optional overrides (defaults shown)
PROD_TRUSPEED_URL=https://truspeed.io
QA_TRUSPEED_URL=https://qa.truspeed.io
LOCAL_TRUSPEED_URL=http://localhost:4000
LOCAL_TRUSPEED_ORG=localhost
```

API keys can be found/created in the TruSpeed admin under your user account settings.

## Usage

From the `bash-scripts` root:

```bash
node clone-page/index.js
```

You will be prompted for:
1. Source environment (copy FROM)
2. Destination environment (copy TO)
3. Organization slug
4. Page ID

## Notes

- The page's `slug` and `pathname` are stripped so Payload regenerates them from the title in the destination.
- Circular references (e.g. a form whose redirect points back to a page) are detected and skipped automatically.
- If a relationship document is not found in the source, the relationship is silently dropped rather than failing the whole operation.
- Block-level media (background images, carousel images, etc.) is cloned on a best-effort basis; if a download fails, that media reference is dropped.
