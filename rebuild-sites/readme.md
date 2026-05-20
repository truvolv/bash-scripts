# Rebuild Sites Before Date

## Purpose
This script is used for rebuilding all sites that have not been rebuilt since before a specified date/time. Ex if you release a bugfix and need everything rebuilt, you can run this script.

You can set the date to compare against as well as the batch size to trigger in a given interval. By default, the batch size is "1" and a new batch will be triggered every 3.5 minutes, enough time for most sites to finish rebuilding.

Any builds that fail during this will be listed at the end for further investigation.

## Setup/Use
### Initial
Run `npm i` - this script has a Node as well as a bash component

At the root directory of this repo in your .env.local file, add the variables `VERCEL_API_TOKEN` and `VERCEL_TEAM_ID`. You can create your own Vercel API Token in your Vercel account and the Team Id can be found under "Site Builder" -> "Settings" -> "General" -> "Team ID"

### Repeated Use
1. In `rebuild-sites/rebuildSitesBeforeDate.js` at the top of the file, set the `startDate` and `BATCH_SIZE` variables. 
2. In the root directory of this project, run `node rebuild-sites/rebuildSitesBeforeDate.js`
3. Enter "y"
4. Once it completes, it's likely there will be a couple deployments you need to check.