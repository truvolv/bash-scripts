## 🧩 "Save" All Member Sites

This script was written to manufacture a save across all member sites to trigger the collection's hooks. Taps into your local Payload config and uses your local files to trigger the hooks. Requires a `DATABASE_URI` environment variable so Payload knows where to send the update.

### 🚀 What It Does

1. Loads all sites that need to be updated from `sites-to-update.json`.
2. Loads all completed sites from a `completed-sites.json` so it doesn't repeat the same sites.
3. Initializes Payload with your local config and desired DB setup.
4. Starts processing sites to save from the JSON file, skipping over ones that have already been processed.
5. Taps into Payload to update the site. Passes empty data in because we don't actually want to edit anything, just trigger the hooks. Payload interprets this as an update and will update the `updatedAt` time accordingly.
6. The custom `bypassCreateSiteHook` is required because this update triggers all hooks and we do not want a site to be created nor do we have the credentials to do that locally. If we don't add this and the hook gets triggered, this will throw an error. Additional tweaking is required in the `createSite.ts` local file to ingest this flag and skip accordingly.
7. The processed site is logged and the next site is started up until the `BATCH_SIZE`.

### 📁 Output Files

- **`sites-to-update.json`** — JSON file from MongoDB query that selects all sites `_id`, `tenantName`, and `name`
- **`changelog.log`** — History of what has been updated and corresponding statuses.
- **`completed-sites.json`** — All the sites that have been successfully saved.

### 🧠 Workflow

**These files will need to be run in your local `/truspeed-v2` directory.**

To get started, in `save-sites.ts` update your `BATCH_SIZE` and run `npx tsx ./save-all-sites/save-sites.ts`
