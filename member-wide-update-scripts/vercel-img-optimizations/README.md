## 🧩 Vercel Image Optimization — Batch Updater Script

This script was written to migrate `next.config.mjs` across all member apps from manually constructing image remote patterns to using the new `createNextConfig` helper from `@truvolv/orson-seelib`. The old pattern parsed `NEXT_PUBLIC_CMS_URL` and hardcoded the `cdn.truspeed.io` hostname directly in each repo; the new pattern delegates all of that to `createNextConfig`, keeping each app's config file minimal.

### 🚀 What It Does

1. **Reads a list of repositories**

   - The script expects a `repo-list.txt` file containing one GitHub repository per line (`org-name/repo-name` format).
   - Skips blank lines and comments (`#`).

2. **Processes repositories in batches**

   - A batch size can be passed as an argument (default: `5` apps).
   - Stops automatically when the batch limit is reached.

3. **Clones and prepares each repo**

   - Clones each repository into `all-repos/` if it’s not already there.
   - Checks out the `main` or `master` branch and pulls the latest changes.

4. **Validates TurboRepo structure**

   - Skips repositories that don’t contain a `turbo.json` file or an `apps/` directory. (ie will skip repos like TruSpeed if they end up in the list by accident)

5. **Iterates through all apps inside `apps/`**  
   For each app subdirectory, the script:

   - Checks if `next.config.mjs` already uses `createNextConfig` — if so, skips the app (logs as "already updated", does not count toward batch).
   - If the file matches the standard old pattern (contains `const cmsUrl`, `const nextConfig`, and the standard `rewrites`/`redirects` imports from `orson-seelib`), overwrites it with the new `createNextConfig` version.
   - If the file has custom member edits that don't match the expected pattern, skips the overwrite and flags it in `manual-updates.csv` for manual review.
   - If no `next.config.mjs` exists in the app, logs it as skipped.

6. **Tracks progress and logs results**

   - Logs per-app updates in `logs.csv` with details on status (`success`, `partial`, `no-changes`, etc.)
   - Logs repo-level issues in `error.csv` (e.g., clone failures, missing directories).

7. **Commits and pushes changes**

   - Commits updates with a descriptive message.
   - (Optional) Creates a pull request via GitHub CLI — this section is partially commented out for manual control.

8. **Provides color-coded terminal output**
   - Green for success, yellow for skips or partial updates, red for errors.

### 📁 Output Files

- **`logs.csv`** — App-level results including repo name, app name, status, and notes.
- **`error.csv`** — Repository-level issues or skips (e.g., missing branches, failed clones).
- **`all-repos/`** — Local clones of all processed repositories.

### 🧠 Example Workflow

```bash
# Run script with default batch size of 5
bash update-repos.sh

# Run script to process 10 apps
bash update-repos.sh 10
```

### ⚙️ Requirements

- GitHub CLI (`gh`) authenticated with repo access
- Bash shell (macOS or Linux environment)
- Git installed
- Access to all repos listed in `repo-list.txt`

### 🚀 Helpful Queries

**Get all current repos**

- Run `gh auth login` to log into Github CLI
- Select `Github.com`
- Select `HTTPS` to login using Github UI
- Follow steps to login and authorize Github access
- Once authorized, run `gh repo list truvolv --limit 1000 --json nameWithOwner --jq '.[].nameWithOwner'`
- That should return all current repos in the org, be sure to omit non-member repos
