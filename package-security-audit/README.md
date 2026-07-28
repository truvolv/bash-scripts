## 🔍 Package Security Audit

This script runs a vulnerability audit against a project's installed npm packages and writes the results to a CSV you can drop straight into a spreadsheet. For each vulnerable package it also traces the dependency tree back to whichever package(s) in `package.json` are actually responsible for pulling it in, so you know what to upgrade. Requires `jq` (`brew install jq`).

### 🚀 What It Does

1. Runs `npm audit --json` against the project in the current working directory (or the `--yarn` branch, once filled in, for yarn projects).
2. Validates the audit output and exits early if there are no vulnerabilities or if the audit itself failed.
3. Sorts every vulnerable package by severity, critical first.
4. For each vulnerable package, runs `npm explain <package> --json` and walks its dependents chain up to the root:
   - If the package is a direct entry in `package.json`, the "Peer Dependency Of" column is left blank.
   - Otherwise, it lists the `package.json`-level package(s) that transitively require it, however many levels deep the chain goes.
5. Writes `Package`, `Severity`, and `Peer Dependency Of` as a properly quoted CSV.
6. Prints a per-severity count summary (info/low/moderate/high/critical/total) and the full path to the generated CSV.

### 📁 Output Files

- **`npm-audit-vulnerabilities-<timestamp>.csv`** — one row per vulnerable package, with columns `Package`, `Severity`, and `Peer Dependency Of`. Generated fresh (timestamped, never overwritten) on each run.

### 🧠 Workflow

**Run this from inside the target project's root directory** (wherever its `package.json` / `node_modules` live), since it shells out to `npm audit` and `npm explain` in place.

To get started:

```bash
bash package-security-audit.bash
```

For yarn projects, pass the `--yarn` flag (the yarn-specific audit command still needs to be filled in inside the script's `--yarn` branch):

```bash
bash package-security-audit.bash --yarn
```
