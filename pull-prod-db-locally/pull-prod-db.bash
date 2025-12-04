# save start time
start_time=$(date +%s)

rm -rf prod-mongo-dump/

echo "1. Running mongodump to export data from Production Atlas Database"
mongodump --config config.yaml --username atlas-admin --out prod-mongo-dump/ --db admin --excludeCollection system.views

echo "2. Running mongorestore to import data into local MongoDB - this will show up under the 'admin' database"
mongorestore --drop ./prod-mongo-dump

# print the time taken to run the script
end_time=$(date +%s)
duration=$((end_time - start_time))

# duration in minutes and seconds
minutes=$((duration / 60))
seconds=$((duration % 60))
echo "Time taken to run the script: $minutes minutes and $seconds seconds"
