#!/usr/bin/env bash

# take an argument for the db category
args=("$@")

dbType=${args[0]}

databases=(
    payload-site-builder
    truquote-editor
)

backupDir=db-backups/$dbType/$(date +%Y-%m-%d)

for db in "${databases[@]}"; do
    mongodump --out="$backupDir" --db="$db"
done