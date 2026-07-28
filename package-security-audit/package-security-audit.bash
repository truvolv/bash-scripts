#!/usr/bin/env bash
#
# Runs `npm audit --json`, writes a CSV of vulnerable packages
# (Package, Severity, Peer Dependency Of) to disk, and prints a summary
# plus the path to the CSV.
#
# "Peer Dependency Of" is blank if the package is a direct entry in
# package.json; otherwise it lists the package.json-level package(s)
# that transitively pull it in.
set -uo pipefail

USE_YARN=false
LEGACY_PEER_DEPS=false
for arg in "$@"; do
  case "$arg" in
    --yarn) USE_YARN=true ;;
    --legacy-peer-deps) LEGACY_PEER_DEPS=true ;;
  esac
done

if ! command -v jq &>/dev/null; then
  echo "Error: jq is required but not installed (brew install jq)." >&2
  exit 1
fi

if [ "$USE_YARN" = true ]; then
  echo "Running yarn audit..." >&2
    AUDIT_ARGS=(audit --json)
  if [ "$LEGACY_PEER_DEPS" = true ]; then
    AUDIT_ARGS+=(--legacy-peer-deps)
  fi
  npm i --package-lock-only "${AUDIT_ARGS[@]}"
fi


echo "Running npm audit..." >&2
AUDIT_JSON=$(npm audit --json 2>/dev/null)

# npm audit exits non-zero when vulnerabilities are found, so don't trust $?.
if ! echo "$AUDIT_JSON" | jq -e . >/dev/null 2>&1; then
  echo "Error: npm audit did not return valid JSON." >&2
  exit 1
fi

if echo "$AUDIT_JSON" | jq -e '.error' >/dev/null 2>&1; then
  echo "npm audit error: $(echo "$AUDIT_JSON" | jq -r '.error.summary // .error.code')" >&2
  exit 1
fi

VULN_COUNT=$(echo "$AUDIT_JSON" | jq '.vulnerabilities | length')
if [ "$VULN_COUNT" -eq 0 ]; then
  echo "No vulnerabilities found."
  exit 0
fi

# CSV-escape a single field: quote it if it contains a comma, quote, or newline.
csv_field() {
  local s="$1"
  if [[ "$s" == *,* || "$s" == *\"* || "$s" == *$'\n'* ]]; then
    s="${s//\"/\"\"}"
    printf '"%s"' "$s"
  else
    printf '%s' "$s"
  fi
}

# severity rank for sorting (critical first)
sev_rank() {
  case "$1" in
    critical) echo 0 ;;
    high) echo 1 ;;
    moderate) echo 2 ;;
    low) echo 3 ;;
    *) echo 4 ;;
  esac
}

OUTPUT_FILE="npm-audit-vulnerabilities-$(date +%Y%m%d-%H%M%S).csv"

{
  printf 'Package,Severity,Peer Dependency Of\n'

  # name<TAB>severity, one per vulnerable package, sorted by severity
  echo "$AUDIT_JSON" | jq -r '
    .vulnerabilities
    | to_entries[]
    | "\(.value.name)\t\(.value.severity)"
  ' | while IFS=$'\t' read -r pkg severity; do
    echo "$(sev_rank "$severity")|$pkg|$severity"
  done | sort -t'|' -k1,1n -k2,2 | cut -d'|' -f2,3 | while IFS='|' read -r pkg severity; do
    EXPLAIN_JSON=$(npm explain "$pkg" --json 2>/dev/null)
    PEER_OF=""
    if echo "$EXPLAIN_JSON" | jq -e . >/dev/null 2>&1; then
      # Walk the dependents chain up to the root. If the package is required
      # directly by the project (from has no name) it's in package.json -> blank.
      # Otherwise, collect the package.json-level package(s) that pull it in
      # transitively, however many levels deep.
      PEER_OF=$(echo "$EXPLAIN_JSON" | jq -r '
        def find_roots:
          (.dependents // [])[] as $d |
          if ($d.from.name == null or $d.from.name == "") then $d.name
          else ($d.from | find_roots)
          end;

        .[0] as $top |
        if (($top.dependents // []) | any(.from.name == null or .from.name == "")) then
          ""
        else
          ([ $top.dependents[]? | (.from | find_roots) ] | unique | join(", "))
        end
      ' 2>/dev/null)
    fi
    printf '%s,%s,%s\n' "$(csv_field "$pkg")" "$(csv_field "$severity")" "$(csv_field "$PEER_OF")"
  done
} > "$OUTPUT_FILE"

if [ "$USE_YARN" = true ]; then
  rm -f package-lock.json
fi

echo "Summary:"
echo "$AUDIT_JSON" | jq -r '
  .metadata.vulnerabilities
  | to_entries[]
  | select(.key != "total")
  | "  \(.key): \(.value)"
'
echo "  total: $(echo "$AUDIT_JSON" | jq -r '.metadata.vulnerabilities.total')"
echo
echo "CSV written to: $(cd "$(dirname "$OUTPUT_FILE")" && pwd)/$(basename "$OUTPUT_FILE")"
