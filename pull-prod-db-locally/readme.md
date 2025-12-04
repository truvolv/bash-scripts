# Pull Production Atlas Database into Local Database

## Purpose
This script pull pull the current production TruSpeed-v2 database into your local Mongo. This is intended to be used for testing migration scripts.

## Setup/Use
1. Duplicate the `config.example.yaml` file and name it `config.yaml`
2. In OnePassword, find the note "TruSpeed v2 Db Login Creds"
3. Copy over the database URI into `config.yaml`
4. Copy over the `atlas-admin` user's password into `config.yaml`
5. In this script directory, run `bash pull-prod-db.bash`
6. In your local Compass, under your local db connection, in the `admin` db, you should see the production database
7. If trying to run a migration script, continue on    
8. In your local Truspeed-v2 repo, in your `.env` file, update the `DATABASE_URI=DATABASE_URI=mongodb://127.0.0.1/admin`. This is to point your local TruSpeed at the `admin` database instead of your local one which is named `payload-site-builder`  
9. Check if your local Mongo is running with replicasets - we use replicasets in production and by default, our local Mongo doesn't use those. We have run into issues where something runs fine locally and then doesn't work in prod because of the replicasets. **Make sure you test using replicasets locally**

In a terminal, run the following:
```bash
mongosh
rs.status()
```
You should see:

    "set": "rs0"
    "myState": 1

10. If you do **not** have replicasets enabled, jump to the Setup Local Replicasets section below before continuing
11. Run `yarn payload migrate` and your migration script should run on your local prod db

## Setting Up Local MongoDB Replica Set (Ubuntu/Debian)
### 1. Stop the system MongoDB service

``` bash
sudo systemctl stop mongod
```

Verify it's no longer running:

``` bash
ps aux | grep mongod
```

If only the `grep` line appears, MongoDB is stopped.

------------------------------------------------------------------------

### 2. Start MongoDB manually with replica set enabled

``` bash
sudo mongod --replSet rs0 --dbpath /var/lib/mongodb
```

Notes: - `/var/lib/mongodb` is the default DB path on Ubuntu. - This
command runs in the **foreground**---that's normal.

------------------------------------------------------------------------

### 3. Connect in another terminal

``` bash
mongosh
```

You should now connect successfully.

------------------------------------------------------------------------

### 4. Initialize the replica set

Inside `mongosh`:

``` javascript
rs.initiate()
rs.status()
```

You should see:

    "set": "rs0"
    "myState": 1

State `1` means PRIMARY.