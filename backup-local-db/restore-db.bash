#!/usr/bin/env bash

args=("$@")
dbType=${args[0]}

# if dbType is not a directory in $HOME/truvolv/db, print error message and exit
if [ ! -d "db-backups/$dbType" ]
then
  echo "DB type $dbType does not exist in the backup directory"
  exit 1
fi

# look in the db/$dbType directory, sort title, and get the path to the most recent backup, and restore that
dbDir=( $(ls -t db-backups/$dbType) )

# print the directory being restored

mongorestore --drop db-backups/$dbType/${dbDir[0]}

echo "Restoring $dbType from db-backups/$dbType/${dbDir[0]}"
