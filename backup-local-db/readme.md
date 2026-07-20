# Backup/Restore Local DB

## Purpose
These scripts back up and restore your local Mongo databases (`payload-site-builder` and `truquote-editor`) using `mongodump`/`mongorestore`. Handy before running migrations or making risky local changes so you can quickly roll back.

## Backup DB
Run `backup-db.bash` from this directory. Backups are written to `db-backups/<name>/<today's date>/`, with one folder per database.

### Default
Run with no argument to store the backup under an unnamed folder, keyed only by date:
```bash
bash backup-db.bash
```
This writes to `db-backups/<YYYY-MM-DD>/`.

### Named
Pass a name to group backups under a category, e.g. before running a migration:
```bash
bash backup-db.bash pre-migration
```
This writes to `db-backups/pre-migration/<YYYY-MM-DD>/`.

## Restore DB
Run `restore-db.bash` from this directory. It looks in `db-backups/<name>` for the most recently modified date folder and restores it with `mongorestore --drop`, overwriting your current local data.

### Most Recent
Run with no argument to restore the latest unnamed backup:
```bash
bash restore-db.bash
```

### Named
Pass the same name used when backing up to restore the latest backup in that category:
```bash
bash restore-db.bash pre-migration
```
