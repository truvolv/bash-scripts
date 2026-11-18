#!/usr/bin/env bash
set -euo pipefail

# Usage: bash clone-prod-db-to-qa.bash [prod|local]  (defaults to prod)
SOURCE="${1:-prod}"

# Atlas users and database names - update these if your QA cluster differs
PROD_DB_USER="vercel-admin-user"
PROD_DB_NAME="admin"
LOCAL_DB_NAME="truquote-editor"
QA_DB_USER="qa-vercel-admin-user"
QA_DB_NAME="admin"

case "$SOURCE" in
  prod)
    SOURCE_DB_NAME="$PROD_DB_NAME"
    REQUIRED_CONFIGS=(prod-config.yaml qa-config.yaml)
    ;;
  local)
    SOURCE_DB_NAME="$LOCAL_DB_NAME"
    REQUIRED_CONFIGS=(qa-config.yaml)
    ;;
  *)
    echo "Unknown source '$SOURCE' - use 'prod' or 'local'"
    exit 1
    ;;
esac

DUMP_DIR="${SOURCE}-mongo-dump"

# make sure the needed config files exist
for config in "${REQUIRED_CONFIGS[@]}"
do
  if [ ! -f "$config" ]
  then
    echo "Missing $config - see readme.md for setup"
    exit 1
  fi
done

qa_uri=$(grep '^uri:' qa-config.yaml | sed 's/^uri:[[:space:]]*//')

# guard against accidentally restoring over Production
if [ "$SOURCE" == "prod" ]
then
  prod_uri=$(grep '^uri:' prod-config.yaml | sed 's/^uri:[[:space:]]*//')

  if [ "$prod_uri" == "$qa_uri" ]
  then
    echo "The Production and QA URIs are the same - refusing to overwrite Production"
    exit 1
  fi
fi

echo "This will DROP and replace the '$QA_DB_NAME' collections in the QA database with $SOURCE data from '$SOURCE_DB_NAME':"
echo "  QA URI: $qa_uri"
read -r -p "Type 'yes' to continue: " confirm
if [ "$confirm" != "yes" ]
then
  echo "Aborted"
  exit 1
fi

# save start time
start_time=$(date +%s)

rm -rf "$DUMP_DIR/"

if [ "$SOURCE" == "prod" ]
then
  echo "1. Running mongodump to export data from Production Atlas Database"
  mongodump --config prod-config.yaml --username "$PROD_DB_USER" --out "$DUMP_DIR/" --db "$PROD_DB_NAME" --excludeCollection system.views
else
  echo "1. Running mongodump to export data from local '$LOCAL_DB_NAME' Database"
  mongodump --out "$DUMP_DIR/" --db "$LOCAL_DB_NAME" --excludeCollection system.views
fi

echo "2. Running mongorestore to import data into QA Atlas Database"
mongorestore --config qa-config.yaml --username "$QA_DB_USER" --drop \
  --nsInclude "${SOURCE_DB_NAME}.*" \
  --nsFrom "${SOURCE_DB_NAME}.*" --nsTo "${QA_DB_NAME}.*" \
  "./$DUMP_DIR"

echo "3. Cleaning up local dump"
rm -rf "$DUMP_DIR/"

# print the time taken to run the script
end_time=$(date +%s)
duration=$((end_time - start_time))

# duration in minutes and seconds
minutes=$((duration / 60))
seconds=$((duration % 60))
echo "Time taken to run the script: $minutes minutes and $seconds seconds"
