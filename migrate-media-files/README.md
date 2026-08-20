## 🚚 Migrate Media Files (DO Spaces → Vercel Blob)

This script migrates files from a DigitalOcean Spaces bucket to a Vercel Blob store, copying only what hasn't been migrated yet. By default it checks a local CSV manifest to decide what's already been copied (no Blob API calls needed); pass `--use-list-check` to instead check the live Blob store directly, which can also detect and re-copy size mismatches. Requires Node.js and a `.env.local` file with DO Spaces and Vercel Blob credentials.

### 🚀 What It Does

1. Loads DO Spaces and Vercel Blob credentials from environment variables (via `.env.local` in the current working directory) and exits early if any are missing.
2. Loads `csvs/uploaded_media_files.csv` (default mode, if reading from CSVs) or lists the live Vercel Blob store (`--use-list-check`) to determine what's already been migrated.
3. Lists every object in the source DO Spaces bucket, paginating through the full bucket.
4. Builds the set of objects to migrate this run, the first 50 objects by default, or the first `--batch-size` objects if given. When `--batch-size` is set and an object turns out to already be migrated, the next not-yet-considered object is pulled in to backfill it, so a full batch's worth of genuinely _new_ files gets attempted each run.
5. Copies each file, downloading it from DO Spaces, then uploading it to Vercel Blob under the same key.
6. Logs every outcome (migrated, skipped, size-mismatch re-copy, or failed) and appends each newly migrated filename to the `csvs/uploaded_media_files.csv` CSV, so later runs skip it automatically.
7. Prints a final summary of copied/skipped/failed/recopied counts.

### 📁 Output Files

- **`csvs/uploaded_media_files.csv`** — file of every filename successfully migrated. Read in at the start of each run if using CSV mode and appended to as new files copy, making runs resumable and idempotent.
- **`csvs/failed_media_uploads.csv`** — one row per failed file, with `filename`, `error`, `timestamp`. Meant for manual retry, not read back in automatically.
- **`logs/logs.log`** — verbose run log (every skip, migrate, warning, and error), appended across runs.
- **`logs/uploaded_media_files.log`** — timestamped record of each newly copied file (name + size), appended across runs.

### 🧠 Workflow

**Run this from inside the `migrate-media-files` directory** (or ensure `.env.local` lives in whatever directory you run it from), since it shells out to DO Spaces and Vercel Blob APIs and reads/writes its CSV and log files relative to its own location.

To get started:

```bash
node index.js [options]
```

#### Useful Flags

- `node index.js --dry-run` -> log what would happen, copy nothing
- `node index.js --batch-size=500` -> only migrate 500 new files this run
- `node index.js --concurrency=20` -> raise/lower parallel transfer workers
- `node index.js --use-list-check` -> check Blob's live contents instead of the CSV file
