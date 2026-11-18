# Clone a Database into the QA Atlas Database

## Purpose
This script copies a source database into the QA Atlas database. It supports two sources:

- **Production** - refresh QA with real TruSpeed-v2 data, e.g. before testing migration scripts or features against production-like content.
- **Local** - push your local TruQuote (`truquote-editor`) database up to QA.

**This is destructive for QA.** Every collection in the source dump is dropped and replaced in the QA database. Collections that only exist in QA are left untouched.

Only data stored in Mongo is copied. Media files stored elsewhere (e.g. S3) are not uploaded.

---

## Option 1: Upload Production to QA

### Setup (one time)
1. Duplicate `config.example.yaml` and name it `prod-config.yaml`
2. Duplicate `config.example.yaml` again and name it `qa-config.yaml`
3. In OnePassword, find the note "TruSpeed v2 Db Login Creds"
4. Copy the Production database URI and the Production user's password into `prod-config.yaml`
5. Copy the QA database URI and the QA user's password into `qa-config.yaml`
6. Check the variables at the top of `clone-prod-db-to-qa.bash` match your clusters:
   - `PROD_DB_USER` / `PROD_DB_NAME`
   - `QA_DB_USER` / `QA_DB_NAME`

### Upload
1. In this script directory, run:
   ```bash
   bash clone-prod-db-to-qa.bash
   ```
2. Confirm the QA URI printed to the terminal and type `yes` to continue
3. In Compass, under your QA connection, verify the `admin` db (or your `QA_DB_NAME`) now has the production data

---

## Option 2: Upload your local TruQuote database to QA

### Setup (one time)
1. Duplicate `config.example.yaml` and name it `qa-config.yaml` (`prod-config.yaml` is not needed)
2. In OnePassword, find the note "TruSpeed v2 Db Login Creds"
3. Copy the QA database URI and the QA user's password into `qa-config.yaml`
4. Check the variables at the top of `clone-prod-db-to-qa.bash` match your setup:
   - `LOCAL_DB_NAME` (defaults to `truquote-editor`)
   - `QA_DB_USER` / `QA_DB_NAME`

### Upload
1. Make sure your local Mongo is running and has a `truquote-editor` database (or whatever `LOCAL_DB_NAME` is set to)
2. In this script directory, run:
   ```bash
   bash clone-prod-db-to-qa.bash local
   ```
3. Confirm the QA URI printed to the terminal and type `yes` to continue
4. In Compass, under your QA connection, verify the `admin` db (or your `QA_DB_NAME`) now has your local data

---

## Notes
- When uploading Production, the script refuses to run if the Production and QA URIs are identical, so it can't restore on top of Production.
- The dump is written to `prod-mongo-dump/` or `local-mongo-dump/` (both gitignored) and deleted once the restore finishes.
- Both `*config.yaml` files are gitignored - never commit them.
