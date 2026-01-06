
# Ask the user if they've set the batchSize and date in the ./rebuild-sites/rebuildSitesBeforeDate.js file
read -p "Have you set the batchSize and date in the ./rebuild-sites/rebuildSitesBeforeDate.js file? (y/n) " answer
if [[ "$answer" != "y" ]]; then
  echo "Please set the batchSize and date in the ./rebuild-sites/rebuildSitesBeforeDate.js file and run this script again."
  exit 1
fi

while true; do
  echo "Running rebuildSitesBeforeDate.js"
#   save the output of the script to a variable
  rebuildOutput=$(node ./rebuild-sites/rebuildSitesBeforeDate.js 2>&1)
  # print the output
  echo "Output: $rebuildOutput"
  # check if the output contains the string "0 projects to rebuild"
  if echo "$rebuildOutput" | grep -q "Finished rebuilding"; then
    echo "No more projects to rebuild. Exiting loop."
    break
  fi
#   check if the output contains the string "Error"
  if [[ "$rebuildOutput" == *"Error"* ]]; then
    echo "Error encountered during rebuild. Exiting loop."
    break
  fi
#   3.5 minutes let's the vercel builds finish from the previous batch
  echo "Sleeping for 3.5 minutes..."
  sleep 210
done